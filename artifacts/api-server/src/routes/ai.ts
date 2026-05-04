import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import {
  generateTts,
  prewarmPhrases,
  ElevenLabsError,
  ELEVEN_VOICE_DE_FEMALE,
  ELEVEN_VOICE_DE_FEMALE_2,
  ELEVEN_VOICE_DE_MALE,
  KIOS_STATIC_PHRASES_DE,
  KIOS_STATIC_PHRASES_EN,
} from "../lib/tts";

const router: IRouter = Router();

// Map a friendly voice name → ElevenLabs voice ID.
// Default = Sarah (warm German female), best for canteen Kios.
function resolveVoiceId(voice?: string): string {
  switch (voice) {
    case "sarah":
    case "nova":
    case "female":
      return ELEVEN_VOICE_DE_FEMALE;
    case "charlotte":
    case "shimmer":
    case "female2":
      return ELEVEN_VOICE_DE_FEMALE_2;
    case "antoni":
    case "onyx":
    case "male":
      return ELEVEN_VOICE_DE_MALE;
    default:
      // If caller passed a raw 20-char voice ID, honour it
      if (voice && /^[A-Za-z0-9]{20}$/.test(voice)) return voice;
      return ELEVEN_VOICE_DE_FEMALE;
  }
}

interface ChatBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatBody;
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: body.messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "ai chat error");
    res.write(
      `data: ${JSON.stringify({
        content:
          "\n[KI-Fehler: " +
          (err instanceof Error ? err.message : "unknown") +
          "]",
      })}\n\n`,
    );
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

interface VisionBody {
  base64: string;
  prompt: string;
}

router.post("/ai/vision", async (req: Request, res: Response) => {
  const body = req.body as VisionBody;
  if (!body?.base64 || !body?.prompt) {
    res.status(400).json({ error: "base64 and prompt required" });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: body.prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${body.base64}` },
            },
          ],
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "ai vision error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

interface JsonBody {
  prompt: string;
  schemaHint?: string;
  base64?: string;
  base64Array?: string[];
}

// Generic JSON-mode endpoint: returns parsed JSON object.
router.post("/ai/json", async (req: Request, res: Response) => {
  const body = req.body as JsonBody;
  if (!body?.prompt) {
    res.status(400).json({ error: "prompt required" });
    return;
  }
  try {
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text:
          body.prompt +
          (body.schemaHint
            ? "\n\nReturn ONLY valid minified JSON matching: " + body.schemaHint
            : "\n\nReturn ONLY valid minified JSON."),
      },
    ];
    if (body.base64Array && body.base64Array.length > 0) {
      for (const b64 of body.base64Array) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${b64}` },
        });
      }
    } else if (body.base64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${body.base64}` },
      });
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: userContent }],
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    res.json({ data: parsed });
  } catch (err) {
    req.log.error({ err }, "ai json error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

interface ParseMenuPdfBody {
  base64: string;
  locale?: "de" | "en";
}

router.post("/ai/parse-menu-pdf", async (req: Request, res: Response) => {
  const body = req.body as ParseMenuPdfBody;
  if (!body?.base64) {
    res.status(400).json({ error: "base64 PDF required" });
    return;
  }
  const lang = body.locale === "en" ? "English" : "Deutsch";
  try {
    const buf = Buffer.from(body.base64, "base64");
    if (buf.length > 15 * 1024 * 1024) {
      res.status(413).json({ error: "PDF too large (max 15 MB)" });
      return;
    }
    const result = await pdfParse(buf);
    const text = (result.text ?? "").trim();
    if (!text) {
      res.status(422).json({
        error:
          "No selectable text in PDF (scanned image PDFs are not supported – please take a photo instead).",
      });
      return;
    }
    const truncated = text.length > 24000 ? text.slice(0, 24000) : text;
    const prompt = [
      `You are KItchenOS menu reader. The text below was extracted from a printed restaurant/canteen menu PDF (Speisekarte). Reply names in ${lang}.`,
      `Extract every dish line. For each: name, optional short description, price in EUR (parse "8,50 €" or "€8.50"), category (starter/soup/salad/main/dessert/drink/side/other), type (vegan/vegetarian/fish/meat/other), allergen letters/numbers if printed (map common LMIV codes A/1=gluten, C/3=egg, G/7=milk, H/8=nuts, F/6=soy, D/4=fish, B/2=shellfish, L/9=celery, M/13=mustard, N/14=sesame).`,
      `IMPORTANT — day assignment: if the menu organises dishes by weekday (e.g. "Montag", "Mo", "Monday", a date like "12.05." or "2026-05-12"), set the "day" field for each dish to the FULL German weekday name (Montag/Dienstag/Mittwoch/Donnerstag/Freitag/Samstag/Sonntag) or to an ISO date (YYYY-MM-DD) when an exact date is printed. Set "day" to null when no day is indicated. Also set "hasWeeklyPlan": true at the root level when any day groupings are found.`,
      `Skip headers, footers, page numbers, prices-only legends, allergen tables.`,
      `--- MENU TEXT ---\n${truncated}\n--- END ---`,
      `Return ONLY valid minified JSON matching: {"restaurantName":"string","hasWeeklyPlan":true,"items":[{"name":"string","description":"string","price":number,"category":"starter|soup|salad|main|dessert|drink|side|other","type":"vegan|vegetarian|fish|meat|other","allergens":["string"],"day":"Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|YYYY-MM-DD|null"}]}`,
    ].join("\n\n");
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const out = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(out);
    } catch {
      parsed = { items: [] };
    }
    res.json({ data: parsed });
  } catch (err) {
    req.log.error({ err }, "ai parse-menu-pdf error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// ── TTS via ElevenLabs (premium voice for Kios) ────────────────────────────
// Returns MP3 audio. Multilingual Turbo v2.5 model — ~250 ms TTFB, native German.
// Server-side disk cache means repeat phrases are served in <2 ms with zero
// upstream cost. Browser HTTP cache covers the same phrase across reloads.
interface TtsBody {
  text: string;
  voice?: string; // friendly name ("nova", "sarah", "male") or raw EL voice ID
}

router.post("/ai/tts", async (req: Request, res: Response) => {
  const body = req.body as TtsBody;
  const text = (body?.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text required" });
    return;
  }
  const voiceId = resolveVoiceId(body?.voice);

  if (!process.env["ELEVENLABS_API_KEY"]) {
    req.log.warn({}, "ELEVENLABS_API_KEY not set — tts unavailable");
    res.status(502).json({ error: "tts_unavailable" });
    return;
  }

  try {
    const { buffer, cached } = await generateTts(text, voiceId);
    res.setHeader("Content-Type", "audio/mpeg");
    // POST responses are not cached by browsers/CDNs by default; we rely on the
    // server-side disk cache for cross-session reuse and the in-memory client
    // cache for in-session reuse. Header signals intent for any compatible cache.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-TTS-Cache", cached ? "HIT" : "MISS");
    res.send(buffer);
  } catch (err) {
    if (err instanceof ElevenLabsError) {
      const s = err.status;
      // 401/403 = config (bad key) → 502, hard fail (client backs off)
      // 429    = rate limit       → 429, transient
      // 5xx    = upstream         → 503, transient
      const status = s === 401 || s === 403 ? 502 : s === 429 ? 429 : 503;
      const code =
        status === 502 ? "tts_misconfigured" :
        status === 429 ? "tts_rate_limited" : "tts_upstream_error";
      req.log.warn({ status: s, msg: err.message }, "elevenlabs error");
      res.status(status).json({ error: code, upstreamStatus: s });
    } else {
      req.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "tts unknown error",
      );
      res.status(502).json({ error: "tts_unavailable" });
    }
  }
});

// Pre-warm: client (or boot script) can request a batch of phrases to be
// generated and cached on disk. Returns immediately; generation runs async.
interface PrewarmBody {
  phrases?: { text: string; voice?: string }[];
  preset?: "kios-de" | "kios-en" | "kios-all";
  /** Voice for preset phrases (friendly name like "sarah"). Defaults to female DE. */
  voice?: string;
}

// Hard caps: prevent abuse / cost drain even if endpoint is hit by random callers.
// Sized to comfortably fit KIOS_STATIC_PHRASES_DE (~140 phrases) + headroom.
const PREWARM_MAX_PHRASES = 250;
const PREWARM_MAX_TEXT_LEN = 200;
const PREWARM_MAX_TOTAL_BYTES = 60_000;

// Per-process simple in-flight guard — at most one batch running at a time
let _prewarmRunning = false;

router.post("/ai/tts/prewarm", async (req: Request, res: Response) => {
  if (!process.env["ELEVENLABS_API_KEY"]) {
    res.status(502).json({ error: "tts_unavailable" });
    return;
  }
  const body = req.body as PrewarmBody;
  const seen = new Set<string>();
  const items: { text: string; voiceId: string }[] = [];

  function tryPush(text: string, voiceId: string): boolean {
    const t = text.trim();
    if (!t || t.length > PREWARM_MAX_TEXT_LEN) return false;
    const k = `${voiceId}|${t}`;
    if (seen.has(k)) return false;
    if (items.length >= PREWARM_MAX_PHRASES) return false;
    seen.add(k);
    items.push({ text: t, voiceId });
    return true;
  }

  const presetVoiceId = resolveVoiceId(body?.voice);
  if (body?.preset === "kios-de" || body?.preset === "kios-all") {
    for (const t of KIOS_STATIC_PHRASES_DE) tryPush(t, presetVoiceId);
  }
  if (body?.preset === "kios-en" || body?.preset === "kios-all") {
    for (const t of KIOS_STATIC_PHRASES_EN) tryPush(t, presetVoiceId);
  }
  if (Array.isArray(body?.phrases)) {
    for (const p of body.phrases) {
      if (typeof p?.text !== "string") continue;
      tryPush(p.text, resolveVoiceId(p.voice));
    }
  }

  const totalBytes = items.reduce((n, x) => n + x.text.length, 0);
  if (totalBytes > PREWARM_MAX_TOTAL_BYTES) {
    res.status(413).json({ error: "payload_too_large" });
    return;
  }
  if (items.length === 0) {
    res.status(400).json({ error: "phrases or preset required" });
    return;
  }
  if (_prewarmRunning) {
    res.json({ queued: 0, skipped: "already_running" });
    return;
  }

  _prewarmRunning = true;
  res.json({ queued: items.length });

  // Fire-and-forget after responding
  void prewarmPhrases(items, req.log)
    .catch(() => { /* logged inside */ })
    .finally(() => { _prewarmRunning = false; });
});

export default router;

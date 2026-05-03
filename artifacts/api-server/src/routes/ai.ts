import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router: IRouter = Router();

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
    if (body.base64) {
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
      `You are KitchenOS menu reader. The text below was extracted from a printed restaurant/canteen menu PDF (Speisekarte). Reply names in ${lang}.`,
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

export default router;

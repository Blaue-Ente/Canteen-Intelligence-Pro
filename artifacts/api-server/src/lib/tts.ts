import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs TTS with persistent disk cache
//
// Strategy:
//   • All requests are content-addressed by SHA1(voice|model|text).
//   • Cached MP3 → served from disk in ~1ms (no upstream call).
//   • Miss → calls ElevenLabs Turbo v2.5 (~250ms TTFB, multilingual incl. German).
//   • Cached file is written best-effort; never blocks the response.
//   • Browser receives `Cache-Control: public, max-age=…` so HTTP cache layers
//     (browser, CDN) can also serve repeats with zero server hit.
// ─────────────────────────────────────────────────────────────────────────────

export const ELEVEN_VOICE_DE_FEMALE = "EXAVITQu4vr4xnSDxMaL"; // Sarah – warm
export const ELEVEN_VOICE_DE_FEMALE_2 = "XB0fDUnXU5powFXDhCwa"; // Charlotte
export const ELEVEN_VOICE_DE_MALE = "ErXwobaYiN019PkySvjV"; // Antoni – clear
export const ELEVEN_MODEL = "eleven_turbo_v2_5";

const CACHE_DIR = join(tmpdir(), "kitchenos-tts-cache");
let _cacheReady = false;

async function ensureCacheDir(): Promise<void> {
  if (_cacheReady) return;
  await mkdir(CACHE_DIR, { recursive: true });
  _cacheReady = true;
}

function cacheKey(text: string, voiceId: string): string {
  return createHash("sha1")
    .update(`${ELEVEN_MODEL}|${voiceId}|${text}`)
    .digest("hex");
}

function cachePath(key: string): string {
  return join(CACHE_DIR, `${key}.mp3`);
}

export interface TtsResult {
  buffer: Buffer;
  cached: boolean;
}

export async function getCached(
  text: string,
  voiceId: string,
): Promise<Buffer | null> {
  await ensureCacheDir();
  const key = cacheKey(text, voiceId);
  const path = cachePath(key);
  try {
    const s = await stat(path);
    if (s.size < 200) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

export class ElevenLabsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export async function generateTts(
  text: string,
  voiceId: string = ELEVEN_VOICE_DE_FEMALE,
): Promise<TtsResult> {
  await ensureCacheDir();
  const trimmed = text.trim().slice(0, 4000);
  const key = cacheKey(trimmed, voiceId);
  const path = cachePath(key);

  // Disk cache hit
  try {
    const s = await stat(path);
    if (s.size > 200) {
      const buf = await readFile(path);
      return { buffer: buf, cached: true };
    }
  } catch { /* miss */ }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: ELEVEN_MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new ElevenLabsError(
      resp.status,
      `elevenlabs ${resp.status}: ${detail.slice(0, 200)}`,
    );
  }

  const buf = Buffer.from(await resp.arrayBuffer());

  // Best-effort cache write (don't await — return ASAP)
  void writeFile(path, buf).catch(() => { /* ignore */ });

  return { buffer: buf, cached: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-warm: fire-and-forget generate a list of static phrases at boot so the
// first user interaction is instant.
// ─────────────────────────────────────────────────────────────────────────────

let _prewarmInFlight = 0;
const PREWARM_CONCURRENCY = 2; // be polite to ElevenLabs rate limits

export async function prewarmPhrases(
  phrases: { text: string; voiceId?: string }[],
  log?: { info: (msg: object, txt?: string) => void; warn: (msg: object, txt?: string) => void },
): Promise<{ generated: number; cached: number; failed: number }> {
  let generated = 0;
  let cachedCount = 0;
  let failed = 0;

  const queue = [...phrases];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      while (_prewarmInFlight >= PREWARM_CONCURRENCY) {
        await new Promise((r) => setTimeout(r, 50));
      }
      _prewarmInFlight++;
      try {
        const { cached } = await generateTts(item.text, item.voiceId ?? ELEVEN_VOICE_DE_FEMALE);
        if (cached) cachedCount++;
        else generated++;
      } catch (e) {
        failed++;
        log?.warn?.({ err: String(e), phrase: item.text.slice(0, 40) }, "tts prewarm fail");
      } finally {
        _prewarmInFlight--;
      }
    }
  }

  await Promise.all(
    Array.from({ length: PREWARM_CONCURRENCY }, () => worker()),
  );

  log?.info?.(
    { generated, cached: cachedCount, failed, total: phrases.length },
    "tts prewarm done",
  );
  return { generated, cached: cachedCount, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Static phrases used by Kios. Pre-warmed at API server boot.
// ─────────────────────────────────────────────────────────────────────────────

export const KIOS_STATIC_PHRASES_DE: string[] = [
  // Wake / acknowledgement
  "Ja?",
  "Ich höre.",
  "Verstanden.",
  "Einen Moment.",
  // Errors
  "Entschuldigung, das hat leider nicht geklappt.",
  "Das habe ich nicht verstanden. Bitte wiederholen.",
  // Navigation confirmations (mirrors QUICK_COMMANDS replies in useKios.ts)
  "Ich zeige dir den Lagerbestand.",
  "Statistik wird geöffnet.",
  "Ich öffne die Speisekarte.",
  "Zurück zur Übersicht.",
  "Ich öffne das Menü.",
  "Tagesabschluss wird geöffnet.",
  "Ich öffne Zettle.",
  "Wareneingänge werden geöffnet.",
  "Bestellvorschläge werden geladen.",
  "Inventur wird geöffnet.",
  "Dienstplan wird geöffnet.",
  "Ich zeige dir die Lieferanten.",
  "Ich zeige dir die regionalen Erzeuger.",
  "Catering wird geöffnet.",
  "Preisrechner wird geöffnet.",
  "Abfall wird geöffnet.",
  "Reste-Rezepte werden geladen.",
  "Vorbestellungen werden geöffnet.",
  "Kundenbestellungen werden geöffnet.",
  "Tagesaggregat wird geöffnet.",
  "Standortvergleich wird geöffnet.",
  "Preisserver wird geöffnet.",
  "CRM wird geöffnet.",
  "Prognose wird geöffnet.",
  "Schichtübergabe wird geöffnet.",
  "Marge-Alerts werden geöffnet.",
  "Leaderboard wird geöffnet.",
  "Berichte werden geöffnet.",
  "Gerichtsanalyse wird geöffnet.",
  "Öko-Wizard wird geöffnet.",
  "Standorte werden geöffnet.",
  "HACCP wird geöffnet.",
  "Scanner wird geöffnet.",
  "KI-Assistent wird geöffnet.",
  "Rezept wird geöffnet.",
  "Team wird geöffnet.",
  "Einstellungen werden geöffnet.",
  "Aushang wird geöffnet.",
  "Veranstaltungen werden geöffnet.",
];

export const KIOS_STATIC_PHRASES_EN: string[] = [
  "Yes?",
  "I'm listening.",
  "Got it.",
  "One moment.",
  "Sorry, something went wrong.",
];

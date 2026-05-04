import { Platform } from "react-native";

type AnyWindow = {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  speechSynthesis?: SpeechSynthesisInstance;
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtteranceInstance;
};

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

interface SpeechSynthesisVoiceLike {
  lang: string;
  name: string;
  localService: boolean;
  default: boolean;
}

interface SpeechSynthesisInstance {
  cancel: () => void;
  speak: (utterance: SpeechSynthesisUtteranceInstance) => void;
  pause: () => void;
  resume: () => void;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  getVoices: () => SpeechSynthesisVoiceLike[];
  onvoiceschanged: (() => void) | null;
}

interface SpeechSynthesisUtteranceInstance {
  lang: string;
  rate: number;
  volume: number;
  pitch: number;
  voice: SpeechSynthesisVoiceLike | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function isVoiceSupported(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  const w = window as unknown as AnyWindow;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function isTtsSupported(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as AnyWindow).speechSynthesis);
}

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg/i.test(ua);
}

// ── Voice cache ────────────────────────────────────────────────────────────
let _voices: SpeechSynthesisVoiceLike[] = [];

function loadVoices(): SpeechSynthesisVoiceLike[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return [];
  const synth = (window as unknown as AnyWindow).speechSynthesis;
  if (!synth) return [];
  const v = synth.getVoices();
  if (v.length > 0) _voices = v;
  return _voices;
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  const w = window as unknown as AnyWindow;
  if (w.speechSynthesis) {
    w.speechSynthesis.onvoiceschanged = () => { loadVoices(); };
    loadVoices();
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 1500);
  }
}

function pickVoice(locale: "de" | "en"): SpeechSynthesisVoiceLike | null {
  const voices = loadVoices();
  if (!voices.length) return null;
  const lang   = locale === "de" ? "de-DE" : "en-US";
  const prefix = lang.split("-")[0]!;

  const iosDeNames = /Anna|Helena|Petra|Markus|Yannick|Katrin|Eddy|Flo|Reed|Sandy|Shelley/i;
  const iosEnNames = /Samantha|Alex|Allison|Ava|Susan|Tom|Fred/i;
  const iosNames   = locale === "de" ? iosDeNames : iosEnNames;

  return (
    voices.find((v) => v.lang === lang && /google|natural|premium|enhanced/i.test(v.name)) ??
    voices.find((v) => v.lang === lang && !v.localService) ??
    voices.find((v) => v.lang === lang && iosNames.test(v.name)) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

export interface VoiceSession {
  stop: () => void;
}

export function startVoice(opts: {
  locale: "de" | "en";
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError?: (err: string) => void;
}): VoiceSession | null {
  if (!isVoiceSupported()) return null;
  const w = window as unknown as AnyWindow;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.locale === "de" ? "de-DE" : "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  let finalText = "";
  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i]!;
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    opts.onPartial((finalText + interim).trim());
  };
  rec.onerror = (e) => opts.onError?.(e.error);
  rec.onend = () => {
    if (finalText.trim()) opts.onFinal(finalText.trim());
    opts.onEnd();
  };
  try {
    rec.start();
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : "voice error");
    return null;
  }
  return {
    stop: () => {
      try { rec.stop(); } catch { /* ignore */ }
    },
  };
}

// ── Web Speech API TTS (fallback) ─────────────────────────────────────────
function speakWebSpeech(text: string, locale: "de" | "en", onEnd?: () => void): void {
  if (!isTtsSupported()) { onEnd?.(); return; }
  const w = window as unknown as AnyWindow;
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) { onEnd?.(); return; }

  const synth = w.speechSynthesis;
  synth.cancel();

  const u = new w.SpeechSynthesisUtterance(text);
  u.lang   = locale === "de" ? "de-DE" : "en-US";
  u.rate   = 1.0;
  u.pitch  = 1.0;
  u.volume = 1.0;

  const voice = pickVoice(locale);
  if (voice) u.voice = voice;

  let fired = false;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const fallbackMs = Math.max(2500, text.length * 75) + 1500;
  const fallbackTimer = setTimeout(() => {
    if (!fired) { fired = true; if (keepAlive) clearInterval(keepAlive); onEnd?.(); }
  }, fallbackMs);

  u.onend = () => {
    if (fired) return;
    fired = true;
    clearTimeout(fallbackTimer);
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    onEnd?.();
  };
  u.onerror = () => {
    if (fired) return;
    fired = true;
    clearTimeout(fallbackTimer);
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    onEnd?.();
  };

  setTimeout(() => {
    synth.speak(u);
    if (!isSafari()) {
      keepAlive = setInterval(() => {
        if (!synth.speaking) { clearInterval(keepAlive!); keepAlive = null; return; }
        synth.pause();
        synth.resume();
      }, 12_000);
    }
  }, 100);
}

// ── HQ TTS via ElevenLabs + Web Audio API (Safari-resilient) ──────────────
// Strategy:
//   1) Try cached AudioBuffer
//   2) Fetch MP3 from /api/ai/tts → decodeAudioData via AudioContext
//   3) Play through a fresh AudioBufferSourceNode each utterance
//   4) On any failure, fall back to Web Speech (always available offline)
//
// Why Web Audio (not <audio>): Safari iOS strips user-activation grants from
// HTMLAudioElement instances after the first playback ends — even from a
// "persistent" element with src swapping. AudioContext, by contrast, is
// blessed PERMANENTLY once .resume() is awaited inside a user gesture; all
// subsequent BufferSourceNode.start() calls play immediately, no gesture
// required. This is the documented Safari workaround
// (https://webkit.org/blog/6784/new-video-policies-for-ios/).
//
// Cache: small LRU keyed by "voice|text" — most Kios responses repeat (e.g.
// "Ja?", "Ich öffne die Speisekarte.") so cache massively reduces network
// calls + cost. We cache the DECODED AudioBuffer so playback skips both the
// network round-trip AND the ~5–20 ms decode step.

const TTS_CACHE = new Map<string, AudioBuffer>();
const TTS_CACHE_MAX = 30;

function cacheGet(key: string): AudioBuffer | undefined {
  const v = TTS_CACHE.get(key);
  if (v !== undefined) {
    // True LRU: reinsert to bump recency
    TTS_CACHE.delete(key);
    TTS_CACHE.set(key, v);
  }
  return v;
}
function cacheSet(key: string, buf: AudioBuffer): void {
  if (TTS_CACHE.size >= TTS_CACHE_MAX) {
    const first = TTS_CACHE.keys().next().value;
    if (first !== undefined) TTS_CACHE.delete(first);
  }
  TTS_CACHE.set(key, buf);
}

// ── AudioContext (Safari iOS gesture-bless: the canonical workaround) ─────
// Single shared AudioContext for the entire page lifetime. Created and
// .resume()'d synchronously inside the first user gesture (Kios pill tap,
// settings voice picker, "Hören" test button). After this one resume(),
// Safari treats the context as permanently unlocked — we can play arbitrary
// AudioBufferSourceNodes from async callbacks, timers, or speech-recognition
// events without any further gesture.
let _audioCtx: AudioContext | null = null;
let _currentSource: AudioBufferSourceNode | null = null;
// Sequence guard: every speakHQ() call increments this; only the latest token
// is allowed to start playback. Prevents stale TTS fetches from speaking older
// text after the user has moved on to a new utterance.
let _speakSeq = 0;

type AudioCtxCtor = typeof AudioContext;
function getAudioCtxCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * MUST be called synchronously inside a user gesture (e.g. button onPress).
 * Creates the shared AudioContext, calls .resume() to bless it, and plays a
 * 1-sample silent buffer to confirm the unlock. After this returns, all
 * subsequent speakHQ() calls — even from async callbacks long after the
 * gesture has expired — will play through this same AudioContext without
 * Safari blocking them.
 *
 * Idempotent — repeat calls cheaply re-resume() if Safari has suspended the
 * context (e.g. after backgrounding the tab).
 */
export function primeAudio(): void {
  if (Platform.OS !== "web") return;
  const Ctor = getAudioCtxCtor();
  if (!Ctor) return;
  try {
    if (!_audioCtx) _audioCtx = new Ctor();
    if (_audioCtx.state === "suspended") {
      void _audioCtx.resume().catch(() => { /* ignore */ });
    }
    // Play a 1-sample silent buffer to confirm the unlock landed.
    const silent = _audioCtx.createBuffer(1, 1, 22050);
    const src = _audioCtx.createBufferSource();
    src.buffer = silent;
    src.connect(_audioCtx.destination);
    src.start(0);
  } catch { /* ignore */ }
}

function stopHqAudio(): void {
  if (_currentSource) {
    try { _currentSource.onended = null; } catch { /* ignore */ }
    try { _currentSource.stop(); } catch { /* ignore — already stopped or not started */ }
    try { _currentSource.disconnect(); } catch { /* ignore */ }
    _currentSource = null;
  }
}

// Server availability: after a hard 502 (e.g. ELEVENLABS_API_KEY missing),
// pause network attempts for 60 s to avoid speech delay on every utterance.
// The server returns MP3 in <300 ms when working — much faster than Web Speech
// — so we keep the recheck window short. Successful fetch always re-enables.
let _ttsServerAvailable: boolean | null = null;
let _ttsLastChecked = 0;
const TTS_RECHECK_MS = 60_000;

function ttsBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const baseRaw = (window as unknown as { __BASE_URL__?: string }).__BASE_URL__;
  return typeof baseRaw === "string" ? baseRaw.replace(/\/+$/, "") : "";
}

/**
 * Fetch + decode a TTS phrase into an AudioBuffer ready for instant playback.
 * Returns null on any failure (network, server config, decode error). Decoding
 * happens here so the playback path stays synchronous — important on Safari
 * where AudioBufferSourceNode.start() must run promptly inside the same task
 * as the resume()/event-handler chain.
 */
async function fetchTts(text: string, voice: string): Promise<AudioBuffer | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return null;
  if (!_audioCtx) return null; // can't decode without a context — primeAudio() must run first
  if (_ttsServerAvailable === false && Date.now() - _ttsLastChecked < TTS_RECHECK_MS) {
    return null; // known-unavailable; skip network
  }
  const url = `${ttsBaseUrl()}/api/ai/tts`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    _ttsLastChecked = Date.now();
    if (!resp.ok) {
      // Only mark "server unavailable" on hard config errors (502 = misconfigured,
      // missing key). Transient errors (429 rate limit, 503 upstream) should not
      // suppress future attempts — Web Speech is used for *this* utterance only.
      if (resp.status === 502) _ttsServerAvailable = false;
      return null;
    }
    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength < 200) { _ttsServerAvailable = false; return null; }
    // decodeAudioData wants its own copy — we pass the original buffer; some
    // older Safari versions detach it on success, which is fine since we
    // never reference it again here.
    const audioBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
    _ttsServerAvailable = true;
    return audioBuffer;
  } catch {
    // Network errors (timeout, offline) or decode errors — short suppression window
    _ttsServerAvailable = false;
    _ttsLastChecked = Date.now();
    return null;
  }
}

/**
 * Pre-warm the server cache for an entire batch of phrases. Returns immediately;
 * generation runs async on the server. The phrases will be served instantly the
 * next time speakHQ() asks for them. Safe to call multiple times.
 *
 * preset = "kios-de" warms all 40+ static Kios German phrases.
 */
let _prewarmedKey: string | null = null;
export async function prewarmTtsCache(opts?: {
  preset?: "kios-de" | "kios-en" | "kios-all";
  voice?: string;
  phrases?: { text: string; voice?: string }[];
}): Promise<boolean> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return false;
  // Re-warm whenever voice changes (different voice = different cache keys server-side)
  const key = `${opts?.preset ?? "kios-de"}|${opts?.voice ?? "sarah"}`;
  if (_prewarmedKey === key && !opts?.phrases) return true;
  try {
    const resp = await fetch(`${ttsBaseUrl()}/api/ai/tts/prewarm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset: opts?.preset ?? "kios-de",
        voice: opts?.voice,
        phrases: opts?.phrases,
      }),
    });
    if (resp.ok) { _prewarmedKey = key; return true; }
    return false;
  } catch { return false; }
}

/**
 * Speak text with the highest available quality:
 *   1) ElevenLabs TTS via AudioContext — natural, near-human, Safari-resilient
 *   2) Web Speech API — fallback when network/server/AudioContext unavailable
 *
 * Always calls onEnd exactly once.
 */
export function speakHQ(
  text: string,
  locale: "de" | "en",
  onEnd?: () => void,
  voice: string = "sarah",
): void {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    speakWebSpeech(text, locale, onEnd);
    return;
  }
  // No AudioContext yet — primeAudio() never ran (e.g. user navigated here
  // without tapping Kios). Web Speech is the only path that doesn't need a
  // gesture-blessed context.
  if (!_audioCtx) {
    speakWebSpeech(text, locale, onEnd);
    return;
  }

  stopHqAudio();
  const myToken = ++_speakSeq;
  const isStale = () => myToken !== _speakSeq;
  const key = `${voice}|${text}`;
  const cached = cacheGet(key);

  const playBuffer = (buf: AudioBuffer) => {
    if (isStale()) { onEnd?.(); return; }
    if (!_audioCtx) { speakWebSpeech(text, locale, onEnd); return; }
    let fired = false;
    let safety: ReturnType<typeof setTimeout> | null = null;
    const clearSafety = () => {
      if (safety !== null) { clearTimeout(safety); safety = null; }
    };
    const done = () => {
      if (fired) return;
      fired = true;
      clearSafety();
      onEnd?.();
    };
    // Fallback to Web Speech when Web Audio playback fails. MUST clear the
    // safety timer first — otherwise it could fire mid-Web-Speech and signal
    // completion before Web Speech is actually done, restarting recognition
    // over the spoken reply.
    const fallback = () => {
      clearSafety();
      speakWebSpeech(text, locale, done);
    };
    // Safari occasionally suspends a previously-resumed AudioContext when the
    // tab backgrounds or after audio interruptions (calls, Siri, …). If we
    // call start(0) on a suspended context, Safari silently drops the playback
    // (no error, no onended) — this is the exact "first reply works, then
    // nothing" failure mode we are fixing. So when suspended, we MUST await
    // resume() before scheduling start(). Use the same `myToken` staleness
    // guard inside the async branch so a newer speakHQ can still preempt us.
    const startSource = (): void => {
      if (isStale() || !_audioCtx) { done(); return; }
      try {
        const src = _audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(_audioCtx.destination);
        src.onended = done;
        _currentSource = src;
        safety = setTimeout(() => {
          if (!fired) {
            stopHqAudio();
            done();
          }
        }, Math.ceil(buf.duration * 1000) + 1500);
        src.start(0);
      } catch {
        fallback();
      }
    };
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume().then(startSource).catch(fallback);
    } else {
      startSource();
    }
  };

  if (cached) { playBuffer(cached); return; }

  void (async () => {
    const buf = await fetchTts(text, voice);
    if (isStale()) return;
    if (buf) {
      cacheSet(key, buf);
      playBuffer(buf);
    } else {
      // Server unavailable — fall back to Web Speech
      speakWebSpeech(text, locale, onEnd);
    }
  })();
}

// ── Client-side phrase prefetch (Safari needs blob URLs ready instantly) ──
// prewarmTtsCache only warms the SERVER cache. Safari iOS additionally needs
// the blob URL ready *before* the AI/quick-command callback fires, because
// `audio.play()` after even a 200 ms server fetch can fall outside the visible
// "user activation" window. This helper fetches the most common Kios phrases
// directly into the in-memory TTS_CACHE so subsequent speakHQ() hits play
// instantly without any network round-trip.
const KIOS_HOT_PHRASES_DE: readonly string[] = [
  "Ja?",
  "Verstanden.",
  "Einen Moment.",
  "Statistik wird geöffnet.",
  "Ich öffne die Speisekarte.",
  "Tagesabschluss wird geöffnet.",
  "Ich zeige dir den Lagerbestand.",
  "Bestellvorschläge werden geladen.",
  "Inventur wird geöffnet.",
  "Dienstplan wird geöffnet.",
  "Zurück zur Übersicht.",
  "HACCP wird geöffnet.",
  "Einstellungen werden geöffnet.",
  "DGE-Standard wird geöffnet.",
  "Entschuldigung, das hat leider nicht geklappt.",
];

let _prefetchedKey: string | null = null;

export async function prefetchKiosPhrases(voice: string = "sarah"): Promise<void> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  if (!_audioCtx) return; // primeAudio() must run first; pointless without a context
  const key = `client|${voice}`;
  if (_prefetchedKey === key) return;
  const results = await Promise.all(
    KIOS_HOT_PHRASES_DE.map(async (text): Promise<boolean> => {
      const cacheKey = `${voice}|${text}`;
      if (TTS_CACHE.has(cacheKey)) return true;
      const buf = await fetchTts(text, voice);
      if (buf) { cacheSet(cacheKey, buf); return true; }
      return false;
    }),
  );
  // Only mark prefetch "done" when EVERY phrase landed in the cache. Partial
  // failures (server briefly unreachable, ElevenLabs 429 rate limit, …) leave
  // _prefetchedKey null so the next enable() call retries the missing ones.
  if (results.every(Boolean)) _prefetchedKey = key;
}

/** Legacy alias — Web Speech only. Use speakHQ for production. */
export function speak(text: string, locale: "de" | "en", onEnd?: () => void): void {
  speakWebSpeech(text, locale, onEnd);
}

export function stopSpeaking(): void {
  // Bumping the sequence invalidates any in-flight TTS fetch that hasn't played yet
  _speakSeq++;
  stopHqAudio();
  if (!isTtsSupported()) return;
  const w = window as unknown as AnyWindow;
  w.speechSynthesis?.cancel();
}

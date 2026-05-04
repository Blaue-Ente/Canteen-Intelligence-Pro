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

// ── HQ TTS via OpenAI (premium voice) ─────────────────────────────────────
// Strategy:
//   1) Try cached audio
//   2) Fetch MP3 from /api/ai/tts (OpenAI tts-1)
//   3) On any failure, fall back to Web Speech (always available offline)
//
// Cache: small LRU keyed by "voice|text" — most Kios responses repeat (e.g. "Ja?",
//   "Ich öffne die Speisekarte.") so cache massively reduces network calls + cost.

const TTS_CACHE = new Map<string, string>(); // key → blob: URL
const TTS_CACHE_MAX = 30;

function cacheGet(key: string): string | undefined {
  const v = TTS_CACHE.get(key);
  if (v !== undefined) {
    // True LRU: reinsert to bump recency
    TTS_CACHE.delete(key);
    TTS_CACHE.set(key, v);
  }
  return v;
}
function cacheSet(key: string, url: string): void {
  if (TTS_CACHE.size >= TTS_CACHE_MAX) {
    const first = TTS_CACHE.keys().next().value;
    if (first !== undefined) {
      const old = TTS_CACHE.get(first);
      if (old) try { URL.revokeObjectURL(old); } catch { /* ignore */ }
      TTS_CACHE.delete(first);
    }
  }
  TTS_CACHE.set(key, url);
}

let _currentAudio: HTMLAudioElement | null = null;
// Sequence guard: every speakHQ() call increments this; only the latest token
// is allowed to start playback. Prevents stale TTS fetches from speaking older
// text after the user has moved on to a new utterance.
let _speakSeq = 0;

function stopHqAudio(): void {
  if (_currentAudio) {
    try { _currentAudio.pause(); _currentAudio.currentTime = 0; } catch { /* ignore */ }
    _currentAudio = null;
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

async function fetchTts(text: string, voice: string): Promise<string | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return null;
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
    const blob = await resp.blob();
    if (blob.size < 200) { _ttsServerAvailable = false; return null; }
    _ttsServerAvailable = true;
    return URL.createObjectURL(blob);
  } catch {
    // Network errors (timeout, offline) — short suppression window
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
let _prewarmed = false;
export async function prewarmTtsCache(opts?: {
  preset?: "kios-de" | "kios-en" | "kios-all";
  phrases?: { text: string; voice?: string }[];
}): Promise<boolean> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return false;
  if (_prewarmed && !opts?.phrases) return true; // preset already warmed
  try {
    const resp = await fetch(`${ttsBaseUrl()}/api/ai/tts/prewarm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: opts?.preset ?? "kios-de", phrases: opts?.phrases }),
    });
    if (resp.ok) { _prewarmed = true; return true; }
    return false;
  } catch { return false; }
}

/**
 * Speak text with the highest available quality:
 *   1) OpenAI TTS (warm "nova" voice) — natural, near-human
 *   2) Web Speech API — fallback when network/server unavailable
 *
 * Always calls onEnd exactly once.
 */
export function speakHQ(
  text: string,
  locale: "de" | "en",
  onEnd?: () => void,
  voice: "nova" | "shimmer" | "alloy" | "echo" | "onyx" | "fable" = "nova",
): void {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof Audio === "undefined") {
    speakWebSpeech(text, locale, onEnd);
    return;
  }

  stopHqAudio();
  const myToken = ++_speakSeq;
  const isStale = () => myToken !== _speakSeq;
  const key = `${voice}|${text}`;
  const cached = cacheGet(key);

  const playUrl = (objectUrl: string) => {
    if (isStale()) { onEnd?.(); return; }
    let fired = false;
    const done = () => { if (!fired) { fired = true; onEnd?.(); } };
    try {
      const audio = new Audio(objectUrl);
      audio.volume = 1.0;
      audio.onended = done;
      audio.onerror = () => { speakWebSpeech(text, locale, done); };
      _currentAudio = audio;
      // Safety fallback for stuck audio
      const safety = setTimeout(() => {
        if (!fired) {
          stopHqAudio();
          done();
        }
      }, Math.max(4000, text.length * 90) + 2500);
      const wrap = audio.onended;
      audio.onended = (e) => { clearTimeout(safety); wrap?.call(audio, e); };
      audio.play().catch(() => speakWebSpeech(text, locale, done));
    } catch {
      speakWebSpeech(text, locale, done);
    }
  };

  if (cached) { playUrl(cached); return; }

  void (async () => {
    const objectUrl = await fetchTts(text, voice);
    if (isStale()) {
      // Newer speakHQ() call superseded us. Drop the result.
      if (objectUrl) try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
      return;
    }
    if (objectUrl) {
      cacheSet(key, objectUrl);
      playUrl(objectUrl);
    } else {
      // Server unavailable — fall back to Web Speech
      speakWebSpeech(text, locale, onEnd);
    }
  })();
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

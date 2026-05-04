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

/**
 * Detect Safari (includes iOS Safari and iPadOS Safari).
 * Chrome/Edge on desktop return false; Safari/WebKit returns true.
 */
export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg/i.test(ua);
}

// ── Voice cache (loaded asynchronously by the browser) ──────────────────────
let _voices: SpeechSynthesisVoiceLike[] = [];

function loadVoices(): SpeechSynthesisVoiceLike[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return [];
  const synth = (window as unknown as AnyWindow).speechSynthesis;
  if (!synth) return [];
  const v = synth.getVoices();
  if (v.length > 0) _voices = v;
  return _voices;
}

// Preload voices as soon as possible — Chrome loads them asynchronously
if (Platform.OS === "web" && typeof window !== "undefined") {
  const w = window as unknown as AnyWindow;
  if (w.speechSynthesis) {
    w.speechSynthesis.onvoiceschanged = () => { loadVoices(); };
    loadVoices();
    // Second + third attempt for slow browsers
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 1500);
  }
}

/**
 * Pick the best available TTS voice for the given locale.
 *
 * Priority order:
 *  1. Exact locale + Google/Natural/Premium/Enhanced in name (Chrome desktop)
 *  2. Exact locale + online voice (!localService) — catches Safari "enhanced" voices
 *  3. Exact locale + known high-quality iOS/macOS voice names (Anna, Helena, Petra, Markus)
 *  4. Exact locale, any voice
 *  5. Same language prefix (de-AT, de-CH …)
 *  6. null (browser default)
 */
function pickVoice(locale: "de" | "en"): SpeechSynthesisVoiceLike | null {
  const voices = loadVoices();
  if (!voices.length) return null;
  const lang   = locale === "de" ? "de-DE" : "en-US";
  const prefix = lang.split("-")[0]!;

  // Known high-quality iOS/macOS German voices (in rough quality order)
  const iosDeNames = /Anna|Helena|Petra|Markus|Yannick|Katrin|Eddy|Flo|Reed|Sandy|Shelley/i;
  const iosEnNames = /Samantha|Alex|Allison|Ava|Susan|Tom|Fred/i;
  const iosNames   = locale === "de" ? iosDeNames : iosEnNames;

  return (
    // Best: exact locale + Google/Natural/Premium label (Chrome/Edge desktop)
    voices.find((v) => v.lang === lang && /google|natural|premium|enhanced/i.test(v.name)) ??
    // Great: exact locale + online/network voice (Safari "Enhanced" voices)
    voices.find((v) => v.lang === lang && !v.localService) ??
    // Good: exact locale + known iOS/macOS quality voice name
    voices.find((v) => v.lang === lang && iosNames.test(v.name)) ??
    // OK: any exact locale voice
    voices.find((v) => v.lang === lang) ??
    // Fallback: same language prefix (de-AT, de-CH, en-GB …)
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

/**
 * Speak text via TTS.
 *
 * Fixes applied:
 * - Best available voice selected via pickVoice() (Google → online → iOS named → any).
 * - volume = 1 always set.
 * - 100 ms delay before speak() — required on iOS Safari to avoid freeze after cancel().
 * - Chrome keep-alive: pause/resume every 12 s to prevent Chrome's 15 s cutoff bug.
 * - Safety fallback timer in case onend never fires (iOS Safari quirk).
 */
export function speak(text: string, locale: "de" | "en", onEnd?: () => void): void {
  if (!isTtsSupported()) { onEnd?.(); return; }
  const w = window as unknown as AnyWindow;
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) { onEnd?.(); return; }

  const synth = w.speechSynthesis;
  synth.cancel();

  const u = new w.SpeechSynthesisUtterance(text);
  u.lang   = locale === "de" ? "de-DE" : "en-US";
  u.rate   = 1.0;   // normal rate — clearer for kitchen noise
  u.pitch  = 1.0;
  u.volume = 1.0;

  const voice = pickVoice(locale);
  if (voice) u.voice = voice;

  let fired = false;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  // Safety fallback: iOS Safari sometimes never fires onend.
  // Estimate ≈75 ms/char, minimum 2.5 s, + 1.5 s buffer.
  const fallbackMs = Math.max(2500, text.length * 75) + 1500;
  const fallbackTimer = setTimeout(() => {
    if (!fired) { fired = true; if (keepAlive) { clearInterval(keepAlive); } onEnd?.(); }
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

  // iOS Safari fix: calling speak() synchronously after cancel() freezes TTS.
  setTimeout(() => {
    synth.speak(u);

    // Chrome keep-alive: Chrome stops TTS after ~15 s of continuous speech.
    // Pause/resume every 12 s to reset the internal timer.
    // Skip on Safari — it doesn't have this bug and pause/resume can cause issues.
    if (!isSafari()) {
      keepAlive = setInterval(() => {
        if (!synth.speaking) { clearInterval(keepAlive!); keepAlive = null; return; }
        synth.pause();
        synth.resume();
      }, 12_000);
    }
  }, 100);
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  const w = window as unknown as AnyWindow;
  w.speechSynthesis?.cancel();
}

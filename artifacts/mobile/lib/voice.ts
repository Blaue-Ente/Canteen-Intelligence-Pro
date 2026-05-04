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
    // Second attempt after 500ms for slow browsers
    setTimeout(loadVoices, 500);
  }
}

/**
 * Pick the best available TTS voice for the given locale.
 * Prefers Google/premium online voices over local ones for better quality.
 */
function pickVoice(locale: "de" | "en"): SpeechSynthesisVoiceLike | null {
  const voices = loadVoices();
  if (!voices.length) return null;
  const lang = locale === "de" ? "de-DE" : "en-US";
  const prefix = lang.split("-")[0]!;
  return (
    // Best: exact locale + Google/natural/premium
    voices.find((v) => v.lang === lang && /google|natural|premium|enhanced/i.test(v.name)) ??
    // Good: exact locale
    voices.find((v) => v.lang === lang) ??
    // Fallback: same language prefix (e.g. de-AT, de-CH)
    voices.find((v) => v.lang.startsWith(prefix)) ??
    // Last resort: any voice
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
 * - Explicit voice selection (German preferred) to avoid silent/wrong voice.
 * - volume = 1 explicitly set.
 * - setTimeout(100ms) before speak() — required on iOS Safari to avoid freeze.
 * - Chrome keep-alive: pause/resume every 12 s to prevent Chrome's 15 s cutoff bug.
 * - onEnd fires when speech finishes, with a safety fallback timer.
 */
export function speak(text: string, locale: "de" | "en", onEnd?: () => void): void {
  if (!isTtsSupported()) { onEnd?.(); return; }
  const w = window as unknown as AnyWindow;
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) { onEnd?.(); return; }

  const synth = w.speechSynthesis;
  synth.cancel();

  const u = new w.SpeechSynthesisUtterance(text);
  u.lang   = locale === "de" ? "de-DE" : "en-US";
  u.rate   = 1.05;   // slightly faster — more natural for kitchen use
  u.pitch  = 1.0;
  u.volume = 1.0;    // always explicit — some browsers default below 1

  // Pick the best available voice
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;

  let fired = false;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const done = () => {
    if (fired) return;
    fired = true;
    if (keepAlive !== null) { clearInterval(keepAlive); keepAlive = null; }
    onEnd?.();
  };

  u.onend  = done;
  u.onerror = done;

  // Safety fallback: iOS Safari sometimes never fires onend.
  // Estimate ≈75 ms/char, minimum 2.5 s, + 1.5 s buffer.
  const fallbackMs = Math.max(2500, text.length * 75) + 1500;
  const fallbackTimer = setTimeout(done, fallbackMs);

  // Wrap fallback timer in done so it's cleared on real onend too
  const originalDone = done;
  u.onend = () => { clearTimeout(fallbackTimer); originalDone(); };
  u.onerror = () => { clearTimeout(fallbackTimer); originalDone(); };

  // iOS Safari fix: calling speak() synchronously after cancel() freezes TTS.
  setTimeout(() => {
    synth.speak(u);

    // Chrome keep-alive: Chrome stops TTS after ~15 s of continuous speech.
    // Pause/resume every 12 s to reset the internal timer.
    keepAlive = setInterval(() => {
      if (!synth.speaking) { clearInterval(keepAlive!); keepAlive = null; return; }
      synth.pause();
      synth.resume();
    }, 12_000);
  }, 100);
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  const w = window as unknown as AnyWindow;
  w.speechSynthesis?.cancel();
}

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

interface SpeechSynthesisInstance {
  cancel: () => void;
  speak: (utterance: SpeechSynthesisUtteranceInstance) => void;
  speaking: boolean;
  pending: boolean;
}

interface SpeechSynthesisUtteranceInstance {
  lang: string;
  rate: number;
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
 * - onEnd fires when speech actually finishes (or on iOS Safari timeout fallback).
 * - Uses setTimeout(100ms) before speak() — required on iOS Safari to avoid freeze.
 */
export function speak(text: string, locale: "de" | "en", onEnd?: () => void): void {
  if (!isTtsSupported()) {
    onEnd?.();
    return;
  }
  const w = window as unknown as AnyWindow;
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) {
    onEnd?.();
    return;
  }

  w.speechSynthesis.cancel();

  const u = new w.SpeechSynthesisUtterance(text);
  u.lang = locale === "de" ? "de-DE" : "en-US";
  u.rate = 1.0;

  if (onEnd) {
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      onEnd();
    };
    u.onend = done;
    u.onerror = done;
    // Safety fallback: iOS Safari sometimes never fires onend.
    // Estimate ≈80 ms/char, minimum 3 s, + 1.5 s buffer.
    const fallbackMs = Math.max(3000, text.length * 80) + 1500;
    setTimeout(done, fallbackMs);
  }

  // iOS Safari fix: calling speak() synchronously after cancel() freezes TTS.
  setTimeout(() => {
    w.speechSynthesis!.speak(u);
  }, 100);
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  const w = window as unknown as AnyWindow;
  w.speechSynthesis?.cancel();
}

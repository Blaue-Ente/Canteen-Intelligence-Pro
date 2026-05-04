import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { askKios } from "@/lib/kios";
import { speak, stopSpeaking } from "@/lib/voice";
import { useApp } from "@/contexts/AppContext";
import type { AppState } from "@/types";

export type KiosStatus = "off" | "idle" | "awake" | "thinking" | "speaking";

const NAV_MAP: Record<string, string> = {
  inventory: "/(tabs)/inventory",
  stats:     "/(tabs)/stats",
  menu:      "/(tabs)/menu",
  home:      "/(tabs)/",
  chat:      "/chat",
};

// AI request timeout in ms
const AI_TIMEOUT_MS = 15_000;

// All mutable values accessed from speech recognition callbacks live here
// to avoid stale-closure issues across React renders.
interface KiosMutableRefs {
  status: KiosStatus;
  phase: "wake" | "question" | "ai";
  rec: unknown;
  restartTimer: ReturnType<typeof setTimeout> | null;
  state: AppState;
}

type AnyWindow = {
  SpeechRecognition?: new () => SpeechRec;
  webkitSpeechRecognition?: new () => SpeechRec;
};

function getWindowSR(): (new () => SpeechRec) | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  const w = window as unknown as AnyWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function isVoiceAvailable(): boolean {
  return Boolean(getWindowSR());
}

export function useKios() {
  const { state } = useApp();
  const router = useRouter();

  const [status, setStatusState] = useState<KiosStatus>("off");
  const r = useRef<KiosMutableRefs>({
    status: "off",
    phase: "wake",
    rec: null,
    restartTimer: null,
    state,
  });

  // Keep state reference fresh — no re-render cost, just a ref update
  r.current.state = state;

  const setStatus = (s: KiosStatus) => {
    r.current.status = s;
    setStatusState(s);
  };

  /* ------------------------------------------------------------------ */
  /*  Core helpers                                                        */
  /* ------------------------------------------------------------------ */

  function clearRestartTimer() {
    if (r.current.restartTimer !== null) {
      clearTimeout(r.current.restartTimer);
      r.current.restartTimer = null;
    }
  }

  function stopListening() {
    clearRestartTimer();
    if (r.current.rec) {
      try { (r.current.rec as { abort(): void }).abort(); } catch { /* ignore */ }
      r.current.rec = null;
    }
  }

  function scheduleRestart(delayMs = 400) {
    clearRestartTimer();
    r.current.restartTimer = setTimeout(() => {
      if (r.current.status !== "off") {
        setStatus("idle");
        startListening();
      }
    }, delayMs);
  }

  async function handleQuestion(question: string) {
    stopListening();
    setStatus("thinking");
    const snap = r.current.state;

    // Wrap askKios with a hard timeout so we never freeze in "Denke nach…"
    let result: Awaited<ReturnType<typeof askKios>> | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      result = await Promise.race([
        askKios(question, snap),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new Error("timeout")),
          ),
        ),
      ]);
      clearTimeout(timeoutId);
    } catch {
      // AI failed or timed out — speak error and resume
      setStatus("speaking");
      speak(
        "Entschuldigung, das hat leider nicht funktioniert.",
        snap.locale,
        () => { scheduleRestart(500); },
      );
      return;
    }

    if (!result) {
      scheduleRestart(500);
      return;
    }

    // Navigate first (non-blocking)
    const navKey = result.navigate && result.navigate !== "null" ? result.navigate : null;
    if (navKey && NAV_MAP[navKey]) {
      router.push(NAV_MAP[navKey] as never);
    }

    setStatus("speaking");
    speak(result.answer, snap.locale, () => {
      // Called when TTS actually finishes (or falls back on iOS Safari)
      scheduleRestart(300);
    });
  }

  function startListening() {
    if (!isVoiceAvailable()) return;
    stopListening();

    const SR = getWindowSR();
    if (!SR) return;

    r.current.phase = "wake";

    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    r.current.rec = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const raw = String(result[0]!.transcript);
        const lower = raw.toLowerCase().trim();

        if (r.current.phase === "wake") {
          if (lower.includes("kios")) {
            r.current.phase = "question";
            setStatus("awake");
            // Speak "Ja?" — when TTS finishes, restart recognition for the question
            speak("Ja?", r.current.state.locale, () => {
              // After "Ja?" finishes, start a fresh session to capture the question
              if (r.current.status !== "off" && r.current.status !== "thinking") {
                startListening();
              }
            });

            // If the question follows immediately in the same utterance
            if (result.isFinal) {
              const afterKios = raw.slice(raw.toLowerCase().indexOf("kios") + 4).trim();
              if (afterKios.length > 2) {
                r.current.phase = "ai";
                void handleQuestion(afterKios);
              }
            }
          }
        } else if (r.current.phase === "question") {
          if (result.isFinal) {
            const question = raw.trim();
            if (question.length > 2) {
              r.current.phase = "ai";
              void handleQuestion(question);
            }
          }
        }
      }
    };

    rec.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setStatus("off");
        r.current.rec = null;
        return;
      }
      // Other errors (no-speech, aborted, network) — let onend handle restart
    };

    rec.onend = () => {
      r.current.rec = null;
      // Don't restart if: turned off, AI is processing, TTS is playing,
      // or we're waiting for "Ja?" TTS to finish (awake) — the speak() onEnd
      // callback handles restart in that case.
      const s = r.current.status;
      if (s === "off" || s === "thinking" || s === "speaking" || s === "awake") {
        return;
      }
      // Idle — auto-restart for continuous wake-word detection
      scheduleRestart(400);
    };

    try {
      rec.start();
    } catch {
      // Browser may refuse if permissions denied
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */

  function enable() {
    if (!isVoiceAvailable()) return;
    setStatus("idle");
    startListening();
  }

  function disable() {
    stopListening();
    stopSpeaking();
    setStatus("off");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRestartTimer();
      if (r.current.rec) {
        try { (r.current.rec as { abort(): void }).abort(); } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    enable,
    disable,
    isSupported: isVoiceAvailable(),
  };
}

/* ------------------------------------------------------------------ */
/*  Minimal type stubs for Web Speech API (not in @types/react-native)  */
/* ------------------------------------------------------------------ */

interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

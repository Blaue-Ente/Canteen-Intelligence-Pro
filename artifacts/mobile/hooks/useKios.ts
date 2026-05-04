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
  stats: "/(tabs)/stats",
  menu: "/(tabs)/menu",
  home: "/(tabs)/",
  chat: "/chat",
};

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

  function stopListening() {
    if (r.current.restartTimer !== null) {
      clearTimeout(r.current.restartTimer);
      r.current.restartTimer = null;
    }
    if (r.current.rec) {
      try {
        (r.current.rec as { abort(): void }).abort();
      } catch {
        // ignore
      }
      r.current.rec = null;
    }
  }

  async function handleQuestion(question: string) {
    stopListening();
    setStatus("thinking");
    const snap = r.current.state;
    try {
      const result = await askKios(question, snap);
      setStatus("speaking");
      speak(result.answer, snap.locale);

      const navKey = result.navigate && result.navigate !== "null" ? result.navigate : null;
      if (navKey && NAV_MAP[navKey]) {
        router.push(NAV_MAP[navKey] as never);
      }

      // Estimate speech duration (≈60 ms per character, min 3 s)
      const delay = Math.max(3000, result.answer.length * 60);
      r.current.restartTimer = setTimeout(() => {
        if (r.current.status !== "off") {
          setStatus("idle");
          startListening();
        }
      }, delay);
    } catch {
      speak("Entschuldigung, das hat leider nicht funktioniert.", snap.locale);
      r.current.restartTimer = setTimeout(() => {
        if (r.current.status !== "off") {
          setStatus("idle");
          startListening();
        }
      }, 3000);
    }
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
          const kiosIdx = lower.indexOf("kios");
          if (kiosIdx !== -1) {
            r.current.phase = "question";
            setStatus("awake");
            speak("Ja?", r.current.state.locale);

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
      // Other errors (no-speech, aborted) → will be handled by onend restart
    };

    rec.onend = () => {
      r.current.rec = null;
      if (r.current.status === "off" || r.current.status === "thinking" || r.current.status === "speaking") {
        return; // AI is handling things — don't restart here
      }
      // Auto-restart for continuous wake word detection
      r.current.restartTimer = setTimeout(() => {
        if (r.current.status !== "off" && r.current.status !== "thinking" && r.current.status !== "speaking") {
          startListening();
        }
      }, 400);
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
      if (r.current.restartTimer !== null) clearTimeout(r.current.restartTimer);
      if (r.current.rec) {
        try {
          (r.current.rec as { abort(): void }).abort();
        } catch {
          // ignore
        }
      }
    };
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

import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { askKios } from "@/lib/kios";
import { speak, stopSpeaking, isSafari } from "@/lib/voice";
import { useApp } from "@/contexts/AppContext";
import type { AppState } from "@/types";

export type KiosStatus = "off" | "idle" | "awake" | "thinking" | "speaking";

// ── Navigation map ───────────────────────────────────────────────────────────
const NAV_MAP: Record<string, string> = {
  inventory:  "/(tabs)/inventory",
  stats:      "/(tabs)/stats",
  menu:       "/(tabs)/menu",
  home:       "/(tabs)/",
  more:       "/(tabs)/more",
  chat:       "/chat",
  suppliers:  "/suppliers",
  producers:  "/producers",
  customers:  "/customers",
};

// AI request timeout
const AI_TIMEOUT_MS = 15_000;

// ── Wake word variants ───────────────────────────────────────────────────────
// "Kios" is commonly misrecognized by speech engines as these strings.
const WAKE_VARIANTS = [
  "kios",    // correct
  "kiosk",   // most common misrecognition
  "kias",    // phonetic variant
  "kjos",    // typo variant
  "kies",    // German "gravel" — sounds similar
  "cios",    // Italian-style misread
  "gios",    // voiced consonant swap
  "quios",   // Iberian-influenced
  "chiose",  // Italian-influenced
];

function detectWakeWord(lower: string): { found: boolean; endIndex: number } {
  for (const v of WAKE_VARIANTS) {
    const i = lower.indexOf(v);
    if (i !== -1) return { found: true, endIndex: i + v.length };
  }
  return { found: false, endIndex: -1 };
}

// ── Quick commands (bypass AI for instant response) ───────────────────────────
// These handle obvious navigation intents without an AI round-trip.
const QUICK_COMMANDS: Array<{
  patterns: RegExp[];
  nav: keyof typeof NAV_MAP;
  reply: string;
}> = [
  { patterns: [/lager|bestand|vorrat|inventar|inventory/i],         nav: "inventory",  reply: "Ich zeige dir den Lagerbestand." },
  { patterns: [/statistik|stats?|umsatz|verkauf|absatz/i],          nav: "stats",      reply: "Statistik wird geöffnet." },
  { patterns: [/men[üu]|karte|speise|gericht|rezept|menu/i],        nav: "menu",       reply: "Ich öffne die Speisekarte." },
  { patterns: [/start|home|anfang|[üu]bersicht|hauptseite|zurück/i], nav: "home",      reply: "Zurück zur Übersicht." },
  { patterns: [/chat|assistent|ki\b|ai\b|frag/i],                   nav: "chat",       reply: "KI-Assistent wird geöffnet." },
  { patterns: [/lieferant|supplier/i],                               nav: "suppliers",  reply: "Ich zeige dir die Lieferanten." },
  { patterns: [/erzeuger|produzent|producer|regional/i],             nav: "producers",  reply: "Ich zeige dir die regionalen Erzeuger." },
  { patterns: [/kund|bestell.*genehmig|customer/i],                  nav: "customers",  reply: "Kundenbestellungen werden geöffnet." },
  { patterns: [/mehr|more|einstellung|setting/i],                    nav: "more",       reply: "Ich öffne das Menü." },
];

function matchQuickCommand(question: string) {
  for (const cmd of QUICK_COMMANDS) {
    if (cmd.patterns.some((p) => p.test(question))) return cmd;
  }
  return null;
}

// ── Mutable refs (avoid stale closures in recognition callbacks) ─────────────
interface KiosRefs {
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

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useKios() {
  const { state } = useApp();
  const router    = useRouter();

  const [status, setStatusState] = useState<KiosStatus>("off");
  const r = useRef<KiosRefs>({
    status: "off",
    phase: "wake",
    rec: null,
    restartTimer: null,
    state,
  });

  // Keep state ref fresh without triggering re-renders
  r.current.state = state;

  const setStatus = (s: KiosStatus) => {
    r.current.status = s;
    setStatusState(s);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

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
        startListening("wake");
      }
    }, delayMs);
  }

  // ── Answer a question ──────────────────────────────────────────────────────

  async function handleQuestion(question: string) {
    stopListening();
    setStatus("thinking");
    const snap   = r.current.state;
    const locale = snap.locale;

    // ── Try quick command first (instant, no AI) ──────────────────────────
    const quick = matchQuickCommand(question);
    if (quick) {
      if (NAV_MAP[quick.nav]) router.push(NAV_MAP[quick.nav] as never);
      setStatus("speaking");
      speak(quick.reply, locale, () => scheduleRestart(300));
      return;
    }

    // ── AI round-trip ─────────────────────────────────────────────────────
    let result: Awaited<ReturnType<typeof askKios>> | null = null;
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
      result = await Promise.race([
        askKios(question, snap),
        new Promise<never>((_, reject) =>
          ac.signal.addEventListener("abort", () => reject(new Error("timeout"))),
        ),
      ]);
      clearTimeout(tid);
    } catch {
      setStatus("speaking");
      speak(
        locale === "de"
          ? "Entschuldigung, das hat leider nicht geklappt."
          : "Sorry, something went wrong.",
        locale,
        () => scheduleRestart(500),
      );
      return;
    }

    if (!result) { scheduleRestart(500); return; }

    const navKey = result.navigate && result.navigate !== "null" ? result.navigate : null;
    if (navKey && NAV_MAP[navKey]) router.push(NAV_MAP[navKey] as never);

    setStatus("speaking");
    speak(result.answer, locale, () => scheduleRestart(300));
  }

  // ── Recognition session ────────────────────────────────────────────────────
  // initialPhase: "wake" = listen for wake word; "question" = listen for question
  function startListening(initialPhase: "wake" | "question" = "wake") {
    if (!isVoiceAvailable()) return;
    stopListening();

    const SR = getWindowSR();
    if (!SR) return;

    r.current.phase = initialPhase;

    const rec = new SR();
    rec.lang          = "de-DE";
    // Safari/iOS has unreliable continuous recognition — use single-shot + auto-restart instead.
    rec.continuous    = !isSafari();
    rec.interimResults = true;
    r.current.rec     = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const raw    = String(result[0]!.transcript);
        const lower  = raw.toLowerCase().trim();

        if (r.current.phase === "wake") {
          const { found, endIndex } = detectWakeWord(lower);
          if (found) {
            setStatus("awake");

            // Check if question immediately follows wake word in same utterance
            const afterWake = raw.slice(endIndex).replace(/^[\s,.\-:!?]+/, "").trim();

            if (result.isFinal && afterWake.length > 3) {
              // Full sentence captured — skip "Ja?" and go straight to AI
              r.current.phase = "ai";
              void handleQuestion(afterWake);
            } else {
              // Wait for the user's question — say "Ja?" first
              r.current.phase = "question";
              speak("Ja?", r.current.state.locale, () => {
                // After "Ja?" finishes, start a QUESTION-mode session
                if (r.current.status !== "off" && r.current.status !== "thinking") {
                  startListening("question");
                }
              });
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
      const s = r.current.status;
      // Don't restart if:
      //   - turned off
      //   - AI is thinking
      //   - TTS is playing (speak's onEnd handles restart)
      //   - awake and waiting for "Ja?" to finish (speak's onEnd handles restart)
      if (s === "off" || s === "thinking" || s === "speaking" || s === "awake") return;
      scheduleRestart(400);
    };

    try { rec.start(); } catch { /* permissions denied */ }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function enable() {
    if (!isVoiceAvailable()) return;
    setStatus("idle");
    startListening("wake");
  }

  function disable() {
    stopListening();
    stopSpeaking();
    setStatus("off");
  }

  useEffect(() => {
    return () => {
      clearRestartTimer();
      if (r.current.rec) {
        try { (r.current.rec as { abort(): void }).abort(); } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, enable, disable, isSupported: isVoiceAvailable() };
}

// ── Web Speech API type stubs ────────────────────────────────────────────────

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
  results: ArrayLike<SpeechRecognitionResultItem>;
}

interface SpeechRecognitionResultItem {
  isFinal: boolean;
  0: { transcript: string };
}

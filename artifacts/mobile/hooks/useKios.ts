import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { askKios } from "@/lib/kios";
import { speakHQ, stopSpeaking, isSafari, prewarmTtsCache } from "@/lib/voice";
import { useApp } from "@/contexts/AppContext";
import type { AppState } from "@/types";

export type KiosStatus = "off" | "idle" | "awake" | "thinking" | "speaking";

// ── Navigation map ───────────────────────────────────────────────────────────
// Covers every screen in the app. Keep keys short (used in AI prompt).
const NAV_MAP: Record<string, string> = {
  // Tabs
  home:        "/(tabs)/",
  inventory:   "/(tabs)/inventory",
  menu:        "/(tabs)/menu",
  stats:       "/(tabs)/stats",
  more:        "/(tabs)/more",
  // Operations
  sales:       "/sales",        // Tagesabschluss
  zettle:      "/zettle",
  orders:      "/orders",
  procurement: "/procurement",  // Auto-Bestellung
  inventur:    "/inventur",
  dienstplan:  "/dienstplan",
  suppliers:   "/suppliers",
  producers:   "/producers",
  catering:    "/catering",
  events:      "/events",
  calculator:  "/calculator",
  waste:       "/waste",
  reste:       "/reste",
  preorder:    "/preorder",
  customers:   "/customers",
  aggregate:   "/aggregate",
  rollup:      "/rollup",
  priceserver: "/priceserver",
  crm:         "/crm",
  // KI / Insights
  forecast:    "/forecast",
  handover:    "/handover",
  margin:      "/margin",
  leaderboard: "/leaderboard",
  reports:     "/reports",
  dishanalysis:"/dishanalysis",
  okowizard:   "/okowizard",
  // Other
  locations:   "/locations",
  haccp:       "/haccp",
  scan:        "/scan",
  chat:        "/chat",
  recipe:      "/recipe",
  team:        "/team",
  settings:    "/settings",
  aushang:     "/aushang",
};

// AI request timeout
const AI_TIMEOUT_MS = 15_000;

// ── Wake word variants ───────────────────────────────────────────────────────
const WAKE_VARIANTS = [
  "kios", "kiosk", "kias", "kjos", "kies", "cios", "gios", "quios", "chiose",
];

function detectWakeWord(lower: string): { found: boolean; endIndex: number } {
  for (const v of WAKE_VARIANTS) {
    const i = lower.indexOf(v);
    if (i !== -1) return { found: true, endIndex: i + v.length };
  }
  return { found: false, endIndex: -1 };
}

// ── Quick commands (instant nav, no AI round-trip) ───────────────────────────
// Patterns are deliberately loose to catch natural phrasing:
//   "geh ins Lager", "öffne den Lagerbestand", "wie viel haben wir auf Lager",
//   "zeig mir die Bestände" → all match `/lager|bestand|vorrat|inventar/`.
// Matched in order — put more specific patterns first.
const QUICK_COMMANDS: Array<{ patterns: RegExp[]; nav: keyof typeof NAV_MAP; reply: string }> = [
  // Specific operations (must match before generic words)
  { patterns: [/tagesabschluss|tages.?abschluss|abschluss|tagesreport|kasse schließen|tag beenden/i], nav: "sales",       reply: "Tagesabschluss wird geöffnet." },
  { patterns: [/zettle|kartenterminal|karten.?lesen|terminal/i],                     nav: "zettle",      reply: "Ich öffne Zettle." },
  { patterns: [/wareneingang|waren.?eingang|lieferung erhalten|lieferung gekommen|liefer.?annahme/i], nav: "orders",      reply: "Wareneingänge werden geöffnet." },
  { patterns: [/auto.?bestell|nach.?bestell|bestell.?vorschlag|procurement|nachschub/i],              nav: "procurement", reply: "Bestellvorschläge werden geladen." },
  { patterns: [/inventur|bestands.?aufnahme|z[äa]hlen|stichtag/i],                                    nav: "inventur",    reply: "Inventur wird geöffnet." },
  { patterns: [/dienstplan|schichtplan|personalplan|wer arbeitet|wer hat schicht/i],                  nav: "dienstplan",  reply: "Dienstplan wird geöffnet." },
  { patterns: [/lieferant|supplier|gro[ßs]h[äa]ndler/i],                             nav: "suppliers",   reply: "Ich zeige dir die Lieferanten." },
  { patterns: [/erzeuger|produzent|producer|regional|bauer|hof/i],                  nav: "producers",   reply: "Ich zeige dir die regionalen Erzeuger." },
  { patterns: [/catering|cater\b/i],                                                 nav: "catering",    reply: "Catering wird geöffnet." },
  { patterns: [/veranstaltung|event\b|hochzeit|firmenfeier|geburtstag|jubil/i],     nav: "events",      reply: "Veranstaltungen werden geöffnet." },
  { patterns: [/preisrechner|kalkulation|calculator|kosten.?rechnung|preis.?berechn/i], nav: "calculator", reply: "Preisrechner wird geöffnet." },
  { patterns: [/abfall|m[üu]ll|waste|verschwend|food.?waste|wegwerf/i],             nav: "waste",       reply: "Abfall wird geöffnet." },
  { patterns: [/reste|leftover|verwert|reste.?rezept|reste.?verwertung/i],          nav: "reste",       reply: "Reste-Rezepte werden geladen." },
  { patterns: [/vorbestell|preorder|pre.?order|app.?bestell|online.?bestell/i],     nav: "preorder",    reply: "Vorbestellungen werden geöffnet." },
  { patterns: [/kund|gast.?konto|gen[eä]hmig|freischalt|business.?freigab/i],       nav: "customers",   reply: "Kundenbestellungen werden geöffnet." },
  { patterns: [/tages.?aggregat|tages.?zusammenfassung|aggregate|tages.?bilanz/i],  nav: "aggregate",   reply: "Tagesaggregat wird geöffnet." },
  { patterns: [/standorte? vergleich|filial.?vergleich|rollup|filialen vergleichen/i], nav: "rollup",   reply: "Standortvergleich wird geöffnet." },
  { patterns: [/preisserver|preis.?server|preisliste server|price server/i],         nav: "priceserver", reply: "Preisserver wird geöffnet." },
  { patterns: [/^crm$|kunden.?pfleg|kontakt.?datenbank|kunden.?stamm/i],            nav: "crm",         reply: "CRM wird geöffnet." },
  // KI / Insights
  { patterns: [/prognose|forecast|vorhersage|wetter.?vorhersage|absatz.?prognose/i], nav: "forecast",   reply: "Prognose wird geöffnet." },
  { patterns: [/[üu]bergabe|handover|schicht.?wechsel|schicht.?[üu]bergabe/i],      nav: "handover",    reply: "Schichtübergabe wird geöffnet." },
  { patterns: [/marge|margin|gewinn|deckungs.?beitrag|verlust.?gericht/i],          nav: "margin",      reply: "Marge-Alerts werden geöffnet." },
  { patterns: [/leaderboard|rangliste|top mitarbeiter|beste mitarbeiter/i],         nav: "leaderboard", reply: "Leaderboard wird geöffnet." },
  { patterns: [/bericht|report|auswert|monatsbericht|wochenbericht/i],              nav: "reports",     reply: "Berichte werden geöffnet." },
  { patterns: [/gerichts.?analy|dish.?analy|dish.?score|gericht.?bewert/i],         nav: "dishanalysis",reply: "Gerichtsanalyse wird geöffnet." },
  { patterns: [/[öo]ko.?wizard|nachhaltig|co2|bio.?wizard|klima.?bilanz/i],         nav: "okowizard",   reply: "Öko-Wizard wird geöffnet." },
  // Locations / utilities
  { patterns: [/standort|location|filiale|niederlassung/i],                          nav: "locations",   reply: "Standorte werden geöffnet." },
  { patterns: [/haccp|hygiene|temperatur.?protokoll|k[üu]hl.?temperatur|legal/i],   nav: "haccp",       reply: "HACCP wird geöffnet." },
  { patterns: [/scann?en|scanner|barcode|kamera|foto|qr.?code/i],                    nav: "scan",        reply: "Scanner wird geöffnet." },
  { patterns: [/^chat$|assistent|^ki\b|^ai\b|frag mich|frag den|sprich mit/i],      nav: "chat",        reply: "KI-Assistent wird geöffnet." },
  { patterns: [/rezept anlegen|neues rezept|rezept.?detail|rezept hinzuf/i],        nav: "recipe",      reply: "Rezept wird geöffnet." },
  { patterns: [/^team$|mitarbeiter|personal\b|kollegen/i],                          nav: "team",        reply: "Team wird geöffnet." },
  { patterns: [/einstellung|setting|konfiguration|optionen/i],                       nav: "settings",    reply: "Einstellungen werden geöffnet." },
  { patterns: [/aushang|wochenplan.?ausdruck|men[üu].?aushang|aushangs.?plan/i],    nav: "aushang",     reply: "Aushang wird geöffnet." },
  // Tabs (least specific — match last)
  { patterns: [/lager|bestand|vorrat|inventar|inventory|warenbestand/i],            nav: "inventory",   reply: "Ich zeige dir den Lagerbestand." },
  { patterns: [/statistik|^stats?\b|umsatz|verkauf|absatz|kennzahl|wie viel.*verdient|wie viel.*umsatz/i], nav: "stats", reply: "Statistik wird geöffnet." },
  { patterns: [/men[üu]|karte|speise|gericht|wochenplan|tagesgericht|essen heute/i], nav: "menu",        reply: "Ich öffne die Speisekarte." },
  { patterns: [/^start$|^home$|anfang|[üu]bersicht|hauptseite|^zur[üu]ck$|dashboard/i], nav: "home",    reply: "Zurück zur Übersicht." },
  { patterns: [/^mehr$|men[üu] mehr|einstellungs?men[üu]|^extras?$/i],               nav: "more",        reply: "Ich öffne das Menü." },
];

function matchQuickCommand(question: string) {
  for (const cmd of QUICK_COMMANDS) {
    if (cmd.patterns.some((p) => p.test(question))) return cmd;
  }
  return null;
}

// ── Mutable refs ─────────────────────────────────────────────────────────────
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

// ── Safari PWA audio unlock ──────────────────────────────────────────────────
// iOS Safari (incl. PWA / standalone mode) blocks HTML5 Audio.play() unless it's
// triggered by a user gesture. The user always taps to enable Kios, so we use
// that gesture to "unlock" audio playback for the rest of the session.
let _audioUnlocked = false;

function unlockAudio(): void {
  if (_audioUnlocked) return;
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    // 1×1 silent MP3 — plays instantly, satisfies the gesture requirement.
    const silent = new Audio(
      "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    );
    silent.volume = 0;
    silent.play().then(() => { _audioUnlocked = true; }).catch(() => { /* still ok */ });
  } catch { /* ignore */ }
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

  r.current.state = state;

  const setStatus = (s: KiosStatus) => {
    r.current.status = s;
    setStatusState(s);
  };

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

  async function handleQuestion(question: string) {
    stopListening();
    setStatus("thinking");
    const snap   = r.current.state;
    const locale = snap.locale;

    // Quick command first (instant)
    const quick = matchQuickCommand(question);
    if (quick) {
      if (NAV_MAP[quick.nav]) router.push(NAV_MAP[quick.nav] as never);
      setStatus("speaking");
      speakHQ(quick.reply, locale, () => scheduleRestart(300));
      return;
    }

    // AI round-trip
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
      speakHQ(
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
    speakHQ(result.answer, locale, () => scheduleRestart(300));
  }

  function startListening(initialPhase: "wake" | "question" = "wake") {
    if (!isVoiceAvailable()) return;
    stopListening();

    const SR = getWindowSR();
    if (!SR) return;

    r.current.phase = initialPhase;

    const rec = new SR();
    rec.lang           = "de-DE";
    rec.continuous     = !isSafari();
    rec.interimResults = true;
    r.current.rec      = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const raw    = String(result[0]!.transcript);
        const lower  = raw.toLowerCase().trim();

        if (r.current.phase === "wake") {
          const { found, endIndex } = detectWakeWord(lower);
          if (found) {
            setStatus("awake");
            const afterWake = raw.slice(endIndex).replace(/^[\s,.\-:!?]+/, "").trim();

            if (result.isFinal && afterWake.length > 3) {
              r.current.phase = "ai";
              void handleQuestion(afterWake);
            } else {
              r.current.phase = "question";
              speakHQ("Ja?", r.current.state.locale, () => {
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
    };

    rec.onend = () => {
      r.current.rec = null;
      const s = r.current.status;
      if (s === "off" || s === "thinking" || s === "speaking" || s === "awake") return;
      scheduleRestart(400);
    };

    try { rec.start(); } catch { /* permissions denied */ }
  }

  function enable() {
    if (!isVoiceAvailable()) return;
    unlockAudio();           // Safari PWA: prime audio while still in user gesture
    // Pre-warm server TTS cache for all 40+ static Kios phrases. Fire-and-forget;
    // returns immediately and the server generates them in the background. Result:
    // every "Statistik wird geöffnet." / "Ja?" / etc plays instantly with no fetch.
    void prewarmTtsCache({ preset: "kios-de" });
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

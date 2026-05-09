import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { askKios, type ConversationMessage } from "@/lib/kios";
import { generateRecipe } from "@/lib/ai";
import { searchOffline } from "@/constants/offlineKnowledge";
import { speakHQ, stopSpeaking, isSafari, prewarmTtsCache, primeAudio, prefetchKiosPhrases } from "@/lib/voice";
import { useApp } from "@/contexts/AppContext";
import {
  cancelAllTimers,
  formatDuration,
  listTimers,
  parseTimerPhrase,
  startTimer,
} from "@/lib/timers";
import type {
  AppState,
  Recipe,
  Allergen,
  OrderDraft,
  OrderDraftItem,
  Supplier,
  Employee,
  CateringEvent,
  InventoryItem,
  HaccpLog,
  WasteEntry,
  SaleEntry,
  FoodSample,
  MenuDayEntry,
} from "@/types";

export type KiosStatus = "off" | "idle" | "awake" | "thinking" | "speaking";

// ── T015 + T016c + T016f: Smart Kios pending-confirmation actions ────────────
// When a voice command would mutate state (add/remove order item, log HACCP,
// adjust inventory, log waste, import an internet recipe), we never execute it
// directly. Instead we stash it as a PendingAction and require an explicit
// spoken "Ja" before dispatching. This is critical because mis-heard commands
// during a busy service could otherwise trash production data. The 30-second
// TTL means a forgotten confirm naturally times out without leaving the kios
// in an awkward "waiting for Ja/Nein" state forever.
type PendingAction =
  | {
      kind: "addOrderItem";
      order: OrderDraft;
      newItem: OrderDraftItem;
      supplierName: string;
    }
  | {
      kind: "removeOrderItem";
      order: OrderDraft;
      itemIndex: number;
      itemName: string;
    }
  // T016c — voice mutations beyond orders.
  | {
      kind: "addHaccpEntry";
      entry: HaccpLog;
      summary: string;
    }
  | {
      kind: "setInventoryQty";
      itemId: string;
      itemName: string;
      qty: number;
      unit: InventoryItem["unit"]; // strict so executor unit check is type-safe
    }
  | {
      kind: "consumeInventoryQty";
      itemId: string;
      itemName: string;
      qty: number;  // already in inv.unit (parser did the conversion + dim check)
      unit: InventoryItem["unit"]; // snapshot of inv.unit at parse time
    }
  | {
      kind: "logWaste";
      entry: WasteEntry;
      summary: string;
    }
  // T016f — internet recipe search → import to library.
  | {
      kind: "addRecipeFromOnline";
      recipe: Recipe;
    }
  // Voice-driven menu planning: "Setze Linsensuppe auf Montag".
  | {
      kind: "setMenuByVoice";
      date: string;
      dateLabel: string;
      recipeId: string;
      recipeName: string;
    }
  // Voice-driven daily sales entry: "45 Portionen Schnitzel verkauft".
  | {
      kind: "addSaleByVoice";
      sale: SaleEntry;
      recipeName: string;
      count: number;
    }
  // Voice-driven Rückstellprobe: "Probe von Gulasch nehmen".
  | {
      kind: "addFoodSampleByVoice";
      sample: FoodSample;
      recipeName: string;
    };

// ── T016a: Conversation memory (anaphora resolution) ─────────────────────────
// After every successful smart lookup we remember the entity the user just
// asked about (recipe/inventory item/contact). Pronouns in the next question
// ("davon", "das", "die", "es", "sie") get resolved to that entity's name
// before pattern matching, so the user can naturally chain:
//   "Kios, kalorien hat Linsensuppe" → "und wie teuer ist das?"
// TTL is 3 minutes — long enough for a real follow-up, short enough that a
// stranger walking up later can't accidentally hit a stale context.
interface LastContext {
  recipe?: Recipe;
  inventoryItem?: InventoryItem;
  contact?: { name: string; role: string; phone: string };
  ts: number;
}
const ANAPHORA_TTL_MS = 3 * 60 * 1000;

// ── T015: Allergen ID → German label ─────────────────────────────────────────
// LMIV-compliant German names. Used when speaking allergen lists (e.g.
// "Linsensuppe enthält Gluten und Sellerie."). Sub-types like "Schalenfrucht"
// for nuts are deliberately not used here — the spoken short form is clearer.
const ALLERGEN_DE: Record<Allergen, string> = {
  gluten: "Gluten",
  milk: "Milch",
  egg: "Ei",
  nuts: "Nüsse",
  soy: "Soja",
  fish: "Fisch",
  shellfish: "Krebstiere",
  celery: "Sellerie",
  mustard: "Senf",
  sesame: "Sesam",
  sulphite: "Sulfit",
  lupin: "Lupinen",
  mollusc: "Weichtiere",
  peanut: "Erdnüsse",
};

function joinDeList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} und ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

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
  wastecam:    "/wastecam",
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
  // T013 + T014 additions
  production:  "/production",   // Chargen / Rückstellproben (LMHV §11)
  cleaning:    "/cleaning",     // Reinigungsplan
  kasse:       "/kasse",        // TSE / KassenSichV (Full-Modus)
  dge:         "/dge",          // DGE-Qualitätsstandard Score + Zertifikat
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
  { patterns: [/tablett.?foto|teller.?foto|tablett.?analyse|teller.?analyse|plate.?photo|plate.?analy|foto.?analy/i], nav: "wastecam", reply: "Tablett-Foto-Analyse wird geöffnet." },
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
  // T013 + T014: Production / Cleaning / Kasse / DGE
  { patterns: [/r[üu]ckstell.?probe|food.?sample|aufbewahrungs.?probe|lmhv.?probe/i], nav: "production", reply: "Produktion mit Rückstellproben wird geöffnet." },
  { patterns: [/produktion|charge\b|chargen|batch\b|production/i],                     nav: "production", reply: "Produktion wird geöffnet." },
  { patterns: [/reinigung|reinigungs.?plan|putz.?plan|cleaning|saubermachen/i],        nav: "cleaning",   reply: "Reinigungsplan wird geöffnet." },
  { patterns: [/\bkasse\b(?! schlie)|kassensystem|rechnung schreiben|tse\b|kassensichv|dsfinv|fiskal|bon drucken|bon erstellen/i], nav: "kasse", reply: "Kasse wird geöffnet." },
  { patterns: [/dge\b|qualit[äa]ts.?standard|schul.?verpflegung|kita.?verpflegung|krankenhaus.?verpflegung|senioren.?verpflegung|dge.?score|dge.?zertifikat/i], nav: "dge", reply: "DGE-Standard wird geöffnet." },
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

// ── Hands-free cooking intents (T006) ────────────────────────────────────────
// Detect timer + portion-math + active-recipe queries client-side. These never
// hit the AI server: instant response is critical when the cook's hands are
// covered in flour and they're shouting "Kios! Timer 12 Minuten!".

interface HandsFreeResult {
  reply: string;
  /** Optional async side-effect that needs the speakHQ callback to fire AFTER. */
  sideEffect?: () => void;
}

function findRecipeByName(question: string, recipes: readonly Recipe[]): Recipe | null {
  const lower = question.toLowerCase();
  // Sort longest first so "lentil soup" matches before "soup".
  const candidates = [...recipes].sort(
    (a, b) => Math.max(b.name.length, b.nameDe.length) - Math.max(a.name.length, a.nameDe.length),
  );
  for (const r of candidates) {
    if (r.nameDe && lower.includes(r.nameDe.toLowerCase())) return r;
    if (r.name && lower.includes(r.name.toLowerCase())) return r;
  }
  return null;
}

// ── T015: Inventory lookup (for order-mutation commands) ─────────────────────
// Same longest-first strategy as findRecipeByName. Searches both nameDe and
// name so "Milch" matches "Vollmilch 3,5%" if user said the short name.
function findInventoryByName(query: string, inventory: readonly InventoryItem[]): InventoryItem | null {
  const lower = query.toLowerCase().trim();
  if (!lower) return null;
  const candidates = [...inventory].sort(
    (a, b) => Math.max(b.name.length, b.nameDe.length) - Math.max(a.name.length, a.nameDe.length),
  );
  for (const inv of candidates) {
    const de = (inv.nameDe || "").toLowerCase();
    const en = (inv.name || "").toLowerCase();
    if (de && (lower.includes(de) || de.includes(lower))) return inv;
    if (en && (lower.includes(en) || en.includes(lower))) return inv;
  }
  return null;
}

// ── T015: Contact lookup (suppliers, employees, catering clients) ────────────
// "Welche Telefonnummer hat Anna?" / "Ruf METRO an"
// Returns the highest-priority match across all three contact lists. Suppliers
// win over employees win over catering clients only on tie — primary ranking
// is longest-name-first within each pool, so partial matches don't outrank
// exact ones.
interface ContactHit {
  name: string;
  role: "Lieferant" | "Mitarbeiter" | "Kunde";
  phone: string;
}

function findContact(
  query: string,
  state: AppState,
): ContactHit | null {
  const lower = query.toLowerCase().trim();
  if (!lower) return null;

  type Cand = { name: string; role: ContactHit["role"]; phone: string; len: number };
  const pool: Cand[] = [];

  for (const s of state.suppliers as readonly Supplier[]) {
    if (!s.name) continue;
    pool.push({ name: s.name, role: "Lieferant", phone: s.phone || "", len: s.name.length });
    if (s.contact && s.contact !== s.name) {
      pool.push({ name: s.contact, role: "Lieferant", phone: s.phone || "", len: s.contact.length });
    }
  }
  for (const e of (state.employees ?? []) as readonly Employee[]) {
    if (!e.name) continue;
    pool.push({ name: e.name, role: "Mitarbeiter", phone: e.phone || "", len: e.name.length });
  }
  for (const ev of (state.events ?? []) as readonly CateringEvent[]) {
    if (!ev.clientName) continue;
    pool.push({
      name: ev.clientName,
      role: "Kunde",
      phone: ev.clientPhone || "",
      len: ev.clientName.length,
    });
  }

  pool.sort((a, b) => b.len - a.len);
  for (const c of pool) {
    if (lower.includes(c.name.toLowerCase())) {
      return { name: c.name, role: c.role, phone: c.phone };
    }
  }
  return null;
}

// ── T015: Quantity + unit parser for order mutations ─────────────────────────
// "5 Liter Milch", "10 kg Mehl", "Brot" (defaults to 1 Stück).
// Returns { qty, unit, rest } where rest is the leftover text used for
// inventory name matching.
function parseQtyUnit(raw: string): { qty: number; unit: string; rest: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogramm|g|gramm|liter|l|stück|stueck|stk|packung|pck|dose|flasche|kiste)?\s+(.+)$/i);
  if (m) {
    const qty = Number(m[1]!.replace(",", "."));
    const unit = (m[2] || "Stück").replace(/^kilo(gramm)?$/i, "kg").replace(/^liter$/i, "l").replace(/^gramm$/i, "g").replace(/^stueck$/i, "Stück").replace(/^stk$/i, "Stück").replace(/^pck$/i, "Packung");
    return { qty, unit, rest: m[3]!.trim() };
  }
  return { qty: 1, unit: "Stück", rest: trimmed };
}

// ── T016b: date-range + day-name helpers ─────────────────────────────────────
// Translate German temporal phrases ("heute", "gestern", "diese Woche",
// "letzten Monat") into ISO date ranges for sales/waste aggregation.
// Used by handleSmartLookups data-intent patterns.
const GERMAN_DAYS = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];

function dateRangeFromPhrase(lower: string): { from: string; to: string; label: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (/\bheute\b/.test(lower)) return { from: todayStr, to: todayStr, label: "heute" };
  if (/\bgestern\b/.test(lower)) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = y.toISOString().slice(0, 10);
    return { from: s, to: s, label: "gestern" };
  }
  if (/\bdiese\s+woche\b/.test(lower)) {
    const wd = (today.getDay() + 6) % 7; // Mon=0
    const start = new Date(today);
    start.setDate(start.getDate() - wd);
    return { from: start.toISOString().slice(0, 10), to: todayStr, label: "diese Woche" };
  }
  if (/\bletzte\s+woche\b/.test(lower)) {
    const wd = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(start.getDate() - wd - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: "letzte Woche" };
  }
  if (/\bdiesen?\s+monat\b/.test(lower)) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: start.toISOString().slice(0, 10), to: todayStr, label: "diesen Monat" };
  }
  if (/\bletzten?\s+monat\b/.test(lower)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: "letzten Monat" };
  }
  return null;
}

// "Wer arbeitet morgen / am Freitag" → resolve to a single ISO date.
function parseSingleDay(lower: string): { iso: string; label: string } | null {
  if (/\bmorgen\b/.test(lower)) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return { iso: t.toISOString().slice(0, 10), label: "morgen" };
  }
  if (/\bheute\b/.test(lower)) {
    return { iso: new Date().toISOString().slice(0, 10), label: "heute" };
  }
  if (/\bübermorgen\b|\buebermorgen\b/.test(lower)) {
    const t = new Date();
    t.setDate(t.getDate() + 2);
    return { iso: t.toISOString().slice(0, 10), label: "übermorgen" };
  }
  for (let i = 0; i < GERMAN_DAYS.length; i++) {
    if (lower.includes(GERMAN_DAYS[i]!)) {
      const today = new Date();
      const cur = today.getDay();
      let delta = (i - cur + 7) % 7;
      if (delta === 0) delta = 7; // "am Montag" said on Monday → next Monday
      const d = new Date(today);
      d.setDate(d.getDate() + delta);
      const name = GERMAN_DAYS[i]!;
      return { iso: d.toISOString().slice(0, 10), label: `am ${name[0]!.toUpperCase()}${name.slice(1)}` };
    }
  }
  return null;
}

// ── T016g: rush-mode detection (terse replies in busy hours) ─────────────────
// Lunch service in German Mensen runs 11:30-13:30, dinner 17:30-19:30.
// During those windows Kios trims greetings/filler so the cook gets the
// answer faster. Outside rush, the verbose form is friendlier.
// (SaleEntry is a daily aggregate — no per-minute timestamps — so we can't
// derive sales velocity from state. Time-of-day is the only signal.)
function isRushMode(): boolean {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 11 * 60 + 30 && mins <= 13 * 60 + 30) return true;
  if (mins >= 17 * 60 + 30 && mins <= 19 * 60 + 30) return true;
  return false;
}

// Terse one-word reply for navigation commands during rush. Falls back to
// the verbose reply when no terse label is mapped, so unknown nav keys still
// get spoken (just at the normal length).
const TERSE_NAV_LABELS: Record<string, string> = {
  inventory: "Lager.", stats: "Statistik.", menu: "Speisekarte.", home: "Übersicht.",
  more: "Mehr.", sales: "Tagesabschluss.", zettle: "Zettle.", orders: "Wareneingänge.",
  procurement: "Bestellvorschläge.", inventur: "Inventur.", dienstplan: "Dienstplan.",
  suppliers: "Lieferanten.", producers: "Erzeuger.", catering: "Catering.",
  events: "Events.", calculator: "Rechner.", waste: "Abfall.", wastecam: "Tablett-Foto.",
  reste: "Reste.", preorder: "Vorbestellungen.", customers: "Kunden.",
  forecast: "Prognose.", handover: "Übergabe.", margin: "Margen.",
  leaderboard: "Leaderboard.", reports: "Berichte.", dishanalysis: "Analyse.",
  okowizard: "Öko.", locations: "Standorte.", haccp: "HACCP.", scan: "Scanner.",
  chat: "Chat.", recipe: "Rezept.", team: "Team.", settings: "Einstellungen.",
  aushang: "Aushang.", production: "Produktion.", cleaning: "Reinigung.",
  kasse: "Kasse.", dge: "DGE.", aggregate: "Aggregat.", rollup: "Standorte.",
  priceserver: "Preisserver.", crm: "CRM.",
};
function terseQuickReply(nav: string, fallback: string): string {
  return TERSE_NAV_LABELS[nav] ?? fallback;
}

// ── T016a: anaphora pre-resolver ─────────────────────────────────────────────
// Replace pronouns ("davon"/"dazu"/"das"/"die"/"es"/"sie"/"der") with the
// last-referenced entity's name. Only fires when context is fresh (within
// ANAPHORA_TTL_MS) and the question contains pronouns in positions where
// they obviously stand for an entity (after a verb like ist/von/für/hat/kostet
// or at end of question). Returns the rewritten question + lower form.
function expandAnaphora(
  question: string,
  lower: string,
  ctx: LastContext | null,
): { question: string; lower: string } {
  if (!ctx || Date.now() - ctx.ts > ANAPHORA_TTL_MS) return { question, lower };
  const ent =
    ctx.recipe?.nameDe ||
    ctx.recipe?.name ||
    ctx.inventoryItem?.nameDe ||
    ctx.inventoryItem?.name ||
    ctx.contact?.name ||
    "";
  if (!ent) return { question, lower };
  // 1) "davon" / "dazu" anywhere → entity
  // 2) "ist|von|für|hat|kostet|enthält|enthaelt|bekommt das|die|es|sie|der" → "<verb> <entity>"
  // 3) trailing "das|die|es|sie?" at end of question → entity
  const replaced = question
    .replace(/\b(davon|dazu)\b/gi, ent)
    .replace(/\b(ist|von|für|fuer|hat|kostet|enth[äa]lt|bekommt|teuer)\s+(das|die|es|sie|der)\b/gi,
      (_m, v: string) => `${v} ${ent}`)
    .replace(/\b(das|die|es|sie)\s*\??\s*$/i, ent + (question.trimEnd().endsWith("?") ? "?" : ""));
  return { question: replaced, lower: replaced.toLowerCase().trim() };
}

// ── T016c: HACCP voice command parser ────────────────────────────────────────
// "Notiere Kühltemperatur 5 Grad" / "Kühlschrank 2 hat 4 Grad" /
// "Tiefkühl mit minus 18 Grad" / "Lieferung 6 Grad"
// Returns null when the sentence isn't clearly a HACCP entry — we deliberately
// don't fire on every "X Grad" mention to avoid false positives like
// "wie viel Grad ist es draußen".
function parseHaccpFromText(lower: string): { entry: HaccpLog; summary: string } | null {
  const tempMatch = lower.match(/(-?\s*\d+(?:[.,]\d+)?)\s*(?:°|grad|c\b|celsius)/i);
  if (!tempMatch) return null;
  if (!/k[üu]hl|gefrier|tiefk[üu]hl|temperatur|lieferung/.test(lower)) return null;
  if (!/notiere|miss|setze|erfass|hat|mit|protokoll|^k[üu]hl|^gefrier|^tiefk[üu]hl|^lieferung/.test(lower)) return null;
  const temp = Number(tempMatch[1]!.replace(",", ".").replace(/\s+/g, ""));
  if (!Number.isFinite(temp) || temp < -50 || temp > 50) return null;
  let type: HaccpLog["type"] = "fridge";
  if (/tiefk[üu]hl|gefrier/.test(lower)) type = "freezer";
  else if (/lieferung|delivery|wareneingang/.test(lower)) type = "delivery";
  const locMatch = lower.match(/(k[üu]hlschrank|k[üu]hlraum|gefrierschrank|gefrierraum|tiefk[üu]hlschrank|tiefk[üu]hlraum)\s*(\d+|[a-z])?/i);
  let locBase: string;
  if (type === "delivery") locBase = "Wareneingang";
  else if (type === "freezer") locBase = locMatch && /raum/i.test(locMatch[1]!) ? "Tiefkühlraum" : "Tiefkühlschrank";
  else locBase = locMatch && /raum/i.test(locMatch[1]!) ? "Kühlraum" : "Kühlschrank";
  const locSuffix = locMatch?.[2] ? " " + locMatch[2]!.toUpperCase() : "";
  const location = locBase + locSuffix;
  const ok = type === "freezer" ? temp <= -15 : temp <= 7;
  const entry: HaccpLog = {
    id: `kios-${Date.now().toString(36)}`,
    date: new Date().toISOString(),
    type,
    location,
    temperature: temp,
    ok,
    source: "manual",
  };
  return { entry, summary: `${location} mit ${temp} Grad` };
}

// ── T016c — unit-safe inventory parsing helpers ──────────────────────────
// Architect feedback: spoken units (kg/l/ml/g/Stück) MUST be converted into
// the item's actual storage unit, AND dimensional class must match (mass↔mass,
// vol↔vol, pcs↔pcs). Without this, "setze Mehl (g) auf 2 kg" would write
// `2` instead of `2000`, or "verbrauche 2 kg Eier (pcs)" would consume 2000
// pieces. We reject mismatches and let the user re-phrase.
type UnitDim = "mass" | "vol" | "pcs";
function dimOfInvUnit(u: InventoryItem["unit"]): UnitDim {
  if (u === "kg" || u === "g") return "mass";
  if (u === "l" || u === "ml") return "vol";
  return "pcs";
}
// Returns { dim, factorToBaseG_or_ml }: kg→{mass,1000}, g→{mass,1}, l→{vol,1000},
// ml→{vol,1}, Stück/pcs/stk→{pcs,1}. Spoken phrasings normalised here.
function parseSpokenUnit(raw: string | undefined): { dim: UnitDim; factor: number } | null {
  if (!raw) return null;
  const u = raw.toLowerCase().trim();
  if (u === "kg" || u === "kilo" || u === "kilogramm") return { dim: "mass", factor: 1000 };
  if (u === "g" || u === "gramm") return { dim: "mass", factor: 1 };
  if (u === "l" || u === "liter") return { dim: "vol", factor: 1000 };
  if (u === "ml") return { dim: "vol", factor: 1 };
  if (u === "stk" || u === "stück" || u === "stueck" || u === "pcs") return { dim: "pcs", factor: 1 };
  return null;
}
// Convert qty in spoken unit → qty in target inv.unit. Returns null on
// dimension mismatch (e.g. spoken "kg" against pcs item).
function convertToInvUnit(qty: number, spoken: { dim: UnitDim; factor: number }, invUnit: InventoryItem["unit"]): number | null {
  if (dimOfInvUnit(invUnit) !== spoken.dim) return null;
  const baseQty = qty * spoken.factor; // in g or ml or pcs
  if (invUnit === "kg" || invUnit === "l") return Math.round((baseQty / 1000) * 1000) / 1000;
  if (invUnit === "g" || invUnit === "ml") return Math.round(baseQty * 1000) / 1000;
  return Math.round(baseQty); // pcs — integer count
}

// Discriminated parse result: success | dim-mismatch (so caller can speak a
// helpful clarification instead of falling through to "I didn't understand").
type InvParseFail = { error: "dimMismatch"; itemName: string; spokenUnit: string; invUnit: InventoryItem["unit"] };

// "Setze Milch auf 12 Liter" / "Stelle Mehl auf 5 kg"
function parseInventorySet(
  lower: string,
  inventory: readonly InventoryItem[],
): { item: InventoryItem; qty: number; unit: InventoryItem["unit"] } | InvParseFail | null {
  // Unit token list MUST cover everything parseSpokenUnit normalises, otherwise
  // "setze Mehl auf 2 kilogramm" would slip through with unit captured as
  // empty → parser would assume qty is already in inv.unit and write "2g"
  // instead of "2000g". End-anchored to reject trailing junk tokens.
  const m = lower.match(/(?:setze|stelle|aktualisiere|update)\s+(.+?)\s+auf\s+(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogramm|g|gramm|liter|l|ml|stück|stueck|stk|pcs)?\s*$/i);
  if (!m) return null;
  const inv = findInventoryByName(m[1]!.trim(), inventory);
  if (!inv) return null;
  const qty = Number(m[2]!.replace(",", "."));
  if (!Number.isFinite(qty) || qty < 0) return null;
  // Default: if user omitted the unit, assume they meant the inv.unit.
  const spoken = parseSpokenUnit(m[3]) ?? { dim: dimOfInvUnit(inv.unit), factor: inv.unit === "kg" || inv.unit === "l" ? 1000 : 1 };
  const inInvUnit = convertToInvUnit(
    qty,
    m[3] ? spoken : { dim: dimOfInvUnit(inv.unit), factor: 1 }, // omitted unit → qty already in inv.unit
    inv.unit,
  );
  if (inInvUnit === null) {
    return { error: "dimMismatch", itemName: inv.nameDe || inv.name, spokenUnit: m[3] || "", invUnit: inv.unit };
  }
  // When unit was omitted we treated qty as already in inv.unit; the helper
  // above multiplies by 1 so the math is right but the returned value is
  // rounded — make sure we keep the original qty in that case.
  const finalQty = m[3] ? inInvUnit : qty;
  return { item: inv, qty: finalQty, unit: inv.unit };
}

// "Verbrauche 2 kg Mehl" / "Buche 500 Gramm Salz ab"
function parseInventoryConsume(
  lower: string,
  inventory: readonly InventoryItem[],
): { item: InventoryItem; qty: number; unit: InventoryItem["unit"] } | InvParseFail | null {
  // Same unit-token completeness as parseInventorySet — must cover every form
  // parseSpokenUnit normalises, else we'd silently miss the unit and fall into
  // the "no unit → assume inv.unit" path with wrong magnitude.
  const m = lower.match(/(?:verbrauch(?:e|t)?|nimm|buche?|abzieh(?:en)?)\s+(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogramm|g|gramm|liter|l|ml|stück|stueck|stk|pcs)?\s+(.+?)(?:\s+ab)?$/i);
  if (!m) return null;
  const qty = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const inv = findInventoryByName(m[3]!.trim(), inventory);
  if (!inv) return null;
  if (!m[2]) {
    // No spoken unit — assume the user meant the item's own unit.
    return { item: inv, qty, unit: inv.unit };
  }
  const spoken = parseSpokenUnit(m[2]);
  if (!spoken) return null;
  const inInvUnit = convertToInvUnit(qty, spoken, inv.unit);
  if (inInvUnit === null) {
    return { error: "dimMismatch", itemName: inv.nameDe || inv.name, spokenUnit: m[2], invUnit: inv.unit };
  }
  return { item: inv, qty: inInvUnit, unit: inv.unit };
}

// "Notiere 500 Gramm Brot weggeworfen" / "200 Gramm Salat in den Müll"
function parseWasteFromText(
  lower: string,
  inventory: readonly InventoryItem[],
): { entry: WasteEntry; summary: string } | null {
  if (!/weggeworfen|in\s+den\s+m[üu]ll|entsorgt|verschwendet/.test(lower)) return null;
  const m = lower.match(/(\d+(?:[.,]\d+)?)\s*(gramm|g|kg|kilo|kilogramm)\s+([\wäöüß-]+(?:\s+[\wäöüß-]+){0,3}?)\s+(?:weggeworfen|in\s+den\s+m[üu]ll|entsorgt|verschwendet)/i);
  if (!m) return null;
  let grams = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(grams) || grams <= 0) return null;
  if (/^kg|kilo/i.test(m[2]!)) grams *= 1000;
  const itemName = m[3]!.trim();
  const inv = findInventoryByName(itemName, inventory);
  let cost = 0;
  if (inv) {
    const pricePerKg =
      inv.unit === "kg" ? inv.pricePerUnit
      : inv.unit === "g" ? inv.pricePerUnit * 1000
      : inv.pricePerUnit;
    cost = (pricePerKg * grams) / 1000;
  }
  const entry: WasteEntry = {
    id: `kios-${Date.now().toString(36)}`,
    date: new Date().toISOString().slice(0, 10),
    grams: Math.round(grams),
    reason: "preparation",
    cost: Math.round(cost * 100) / 100,
    ...(inv ? { inventoryId: inv.id } : {}),
  };
  return { entry, summary: `${Math.round(grams)} Gramm ${inv?.nameDe || inv?.name || itemName}` };
}

// ── T016d: NL recipe search (filters: category/price/kcal/allergens/type) ────
const ALLERGEN_DE_TO_KEY: Array<{ token: RegExp; key: Allergen }> = [
  { token: /gluten|weizen|getreide/i, key: "gluten" },
  { token: /milch|laktose|lactose/i, key: "milk" },
  { token: /\bei\b|eier/i, key: "egg" },
  { token: /n[üu]ss/i, key: "nuts" },
  { token: /soja/i, key: "soy" },
  { token: /\bfisch\b/i, key: "fish" },
  { token: /krebs|garnele|krustentier/i, key: "shellfish" },
  { token: /sellerie/i, key: "celery" },
  { token: /senf/i, key: "mustard" },
  { token: /sesam/i, key: "sesame" },
  { token: /sulfit|schwefel/i, key: "sulphite" },
  { token: /lupin/i, key: "lupin" },
  { token: /weichtier|muschel/i, key: "mollusc" },
  { token: /erdnu/i, key: "peanut" },
];

// ── Block 2: Ingredient substitution dictionary ───────────────────────────────
// Voice: "Womit kann ich Butter ersetzen?" / "Ich habe kein Mehl, was nehme ich?"
const SUBSTITUTES: Array<{ tokens: RegExp; item: string; subs: string }> = [
  { tokens: /butter/i,                            item: "Butter",      subs: "Margarine oder Kokosöl" },
  { tokens: /milch\b/i,                           item: "Milch",       subs: "Hafermilch, Mandelmilch oder Sojamilch" },
  { tokens: /\bei\b|eier/i,                       item: "Ei",          subs: "Apfelmus (80 g pro Ei) oder Leinsamen mit Wasser" },
  { tokens: /\bmehl\b/i,                          item: "Mehl",        subs: "Dinkelmehl oder glutenfreiem Reismehl" },
  { tokens: /zucker/i,                            item: "Zucker",      subs: "Honig, Agavendicksaft oder Erythrit" },
  { tokens: /sahne/i,                             item: "Sahne",       subs: "Kokosmilch oder Hafercreme" },
  { tokens: /raps[öo]l|sonnenblumen[öo]l/i,       item: "Pflanzenöl",  subs: "Rapsöl oder Sonnenblumenöl — beide sind austauschbar" },
  { tokens: /oliven[öo]l/i,                       item: "Olivenöl",    subs: "Rapsöl in gleicher Menge" },
  { tokens: /zitrone|zitronensaft/i,              item: "Zitronensaft",subs: "Weißweinessig (halb so viel) oder Limettensaft" },
  { tokens: /tomatenmark|tomatensauce/i,          item: "Tomatenmark", subs: "Passata oder frisch eingekochten Tomaten" },
  { tokens: /\bjoghurt\b/i,                       item: "Joghurt",     subs: "Saurer Sahne oder Quark" },
  { tokens: /\bessig\b/i,                         item: "Essig",       subs: "Apfelessig oder Zitronensaft" },
  { tokens: /\bschinken\b/i,                      item: "Schinken",    subs: "Speck oder Räuchertofu (vegetarisch)" },
  { tokens: /\bparmesan\b/i,                      item: "Parmesan",    subs: "Grana Padano oder Pecorino" },
  { tokens: /paniermehl|semmelbr[öo]sel/i,        item: "Paniermehl",  subs: "gemahlenen Haferflocken oder zerkleinerten Crackern" },
];

// ── Block 1: Nav reply phrase variants (natural language rotation) ────────────
// Varies the spoken reply for popular nav commands so Kios doesn't always
// sound the same. Falls back to the QUICK_COMMANDS reply in rush mode.
const NAV_REPLY_VARIANTS: Partial<Record<string, readonly string[]>> = {
  inventory:   ["Ich zeige dir den Lagerbestand.", "Hier der aktuelle Bestand.", "Lager wird geöffnet."],
  menu:        ["Speisekarte wird geöffnet.", "Ich öffne den Wochenplan.", "Hier kommt der Speiseplan."],
  stats:       ["Statistik wird geöffnet.", "Hier die Verkaufszahlen.", "Auswertungen werden geladen."],
  haccp:       ["HACCP wird geöffnet.", "Ich öffne das Hygieneprotokoll.", "Temperaturprotokolle werden geladen."],
  procurement: ["Bestellvorschläge werden geladen.", "Ich öffne die Nachbestellung.", "Bestellung wird vorbereitet."],
  sales:       ["Tagesabschluss wird geöffnet.", "Hier der Tagesbericht.", "Tagesverkäufe werden geladen."],
  waste:       ["Abfallprotokoll wird geöffnet.", "Ich zeige die Abfalleinträge.", "Abfall wird geöffnet."],
  dienstplan:  ["Dienstplan wird geöffnet.", "Ich öffne den Schichtplan.", "Hier die Personalplanung."],
};

function pickNavReply(navKey: string, fallback: string, rush: boolean): string {
  if (rush) return fallback;
  const variants = NAV_REPLY_VARIANTS[navKey];
  if (variants && variants.length > 0) {
    return variants[Math.floor(Math.random() * variants.length)]!;
  }
  return fallback;
}

function handleRecipeSearch(lower: string, recipes: readonly Recipe[]): string | null {
  if (!/\b(finde|zeige?|gib mir|welche|liste)\b/.test(lower)) return null;
  let pool = [...recipes];
  let hits = 0;
  if (/\bvegan\b/.test(lower)) { pool = pool.filter((r) => r.category === "vegan"); hits++; }
  else if (/\bvegetarisch\b/.test(lower)) { pool = pool.filter((r) => r.category === "vegan" || r.category === "vegetarian"); hits++; }
  else if (/\bfleisch\w*\b/.test(lower)) { pool = pool.filter((r) => r.category === "meat"); hits++; }
  else if (/\bfisch\w*\b/.test(lower)) { pool = pool.filter((r) => r.category === "fish"); hits++; }
  else if (/\bkinder/.test(lower)) { pool = pool.filter((r) => r.category === "kids"); hits++; }
  if (/suppen?|eintopf/.test(lower)) { pool = pool.filter((r) => r.type === "soup" || /suppe|eintopf/i.test(r.nameDe + " " + r.name)); hits++; }
  else if (/salate?\b/.test(lower)) { pool = pool.filter((r) => r.type === "salad" || /salat/i.test(r.nameDe + " " + r.name)); hits++; }
  else if (/desserts?\b|nachtisch|nachspeise/.test(lower)) { pool = pool.filter((r) => r.type === "dessert"); hits++; }
  const priceMax = lower.match(/unter\s+(\d+(?:[.,]\d+)?)\s*(?:euro|€)/i);
  if (priceMax) {
    const max = Number(priceMax[1]!.replace(",", "."));
    pool = pool.filter((r) => r.sellPrice > 0 && r.sellPrice < max);
    hits++;
  }
  const kcalMax = lower.match(/unter\s+(\d+)\s*(?:kcal|kalorien)/i);
  if (kcalMax) {
    const max = Number(kcalMax[1]);
    pool = pool.filter((r) => typeof r.kcalPerPortion === "number" && r.kcalPerPortion < max);
    hits++;
  }
  const ohneMatch = lower.match(/ohne\s+([\wäöü]+)/i);
  if (ohneMatch) {
    for (const { token, key } of ALLERGEN_DE_TO_KEY) {
      if (token.test(ohneMatch[1]!)) {
        pool = pool.filter((r) => !r.allergens.includes(key));
        hits++;
        break;
      }
    }
  }
  if (hits === 0) return null;
  if (pool.length === 0) return "Ich habe keine passenden Gerichte in deinen Rezepten gefunden.";
  const top = pool.slice(0, 3).map((r) => {
    const price = r.sellPrice > 0 ? ` (${r.sellPrice.toFixed(2).replace(".", ",")} Euro)` : "";
    return `${r.nameDe || r.name}${price}`;
  });
  const more = pool.length > 3 ? ` Insgesamt ${pool.length} Treffer.` : "";
  return `Ich habe gefunden: ${joinDeList(top)}.${more}`;
}

// ── T016e: morning briefing composer ─────────────────────────────────────────
// Pulls expiring items, low-stock count, today's events, and yesterday's
// waste cost into one short paragraph. Returns null if there's nothing to
// report (so we don't fire an empty briefing).
function composeMorningBriefing(state: AppState): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const parts: string[] = [];
  const todayEvents = (state.events ?? []).filter((e) => e.eventDate === today);
  if (todayEvents.length > 0) {
    const confirmed = todayEvents.filter((e) => e.status === "bestaetigt" || e.status === "produktion").length;
    parts.push(
      `Heute ${todayEvents.length === 1 ? "ist 1 Veranstaltung" : `sind ${todayEvents.length} Veranstaltungen`} geplant${confirmed > 0 ? `, davon ${confirmed} bestätigt` : ""}.`,
    );
  }
  const expiring = state.inventory.filter((i) => {
    if (!i.expiresAt) return false;
    const days = (new Date(i.expiresAt).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 2;
  });
  if (expiring.length > 0) {
    const names = expiring.slice(0, 3).map((i) => i.nameDe || i.name);
    parts.push(`${expiring.length} ${expiring.length === 1 ? "Artikel läuft" : "Artikel laufen"} bald ab: ${joinDeList(names)}.`);
  }
  const low = state.inventory.filter((i) => i.quantity <= i.minQuantity).length;
  if (low > 0) {
    parts.push(`${low} ${low === 1 ? "Artikel ist" : "Artikel sind"} unter Mindestbestand.`);
  }
  const yWaste = (state.waste ?? []).filter((w) => w.date === yesterday).reduce((n, w) => n + (w.cost ?? 0), 0);
  if (yWaste > 5) {
    parts.push(`Gestern wurden ${yWaste.toFixed(0)} Euro Abfall erfasst.`);
  }
  const tomEvents = (state.events ?? []).filter((e) => e.eventDate === tomorrow);
  if (tomEvents.length > 0) {
    parts.push(`Morgen ${tomEvents.length === 1 ? "1 weitere Veranstaltung" : `${tomEvents.length} weitere Veranstaltungen`}.`);
  }

  // ── Block 4: Proactive time-aware reminders ───────────────────────────────
  const nowHour = new Date().getHours();

  // HACCP reminder: if past 13:00 and no temperature log exists for today.
  if (nowHour >= 13) {
    const haccpToday = (state.haccp ?? []).filter((h) => h.date === today).length;
    if (haccpToday === 0) {
      parts.push("Achtung: Noch keine Temperaturmessung im HACCP-Protokoll für heute.");
    }
  }

  // End-of-day reminder: if past 16:00 and no sales entry for today.
  if (nowHour >= 16) {
    const salesToday = (state.sales ?? []).filter((s) => s.date === today).length;
    if (salesToday === 0) {
      parts.push("Hinweis: Kein Tagesabschluss für heute erfasst.");
    }
  }

  if (parts.length === 0) return null;
  const greeting = nowHour < 11 ? "Guten Morgen" : nowHour < 17 ? "Hallo" : "Guten Abend";
  return `${greeting}, Chef. ${parts.join(" ")}`;
}

// ── T015: Smart lookups (recipe info, contacts, order mutations) ─────────────
// Runs BEFORE handleHandsFree so contact/recipe-info patterns can use the
// dedicated longest-first matchers without competing with timer/portion regex.
// Returns SmartLookupResult or null.
//   - reply: what Kios should say
//   - pending: optional PendingAction → handleQuestion will switch to confirm
//     phase and stash this for the Ja/Nein response.
//   - context: T016a — the entity (recipe/inventory/contact) the user just
//     asked about, so subsequent questions can resolve "davon"/"das"/"es".
interface SmartLookupResult {
  reply: string;
  pending?: PendingAction;
  context?: Partial<Omit<LastContext, "ts">>;
}

function handleSmartLookups(
  questionRaw: string,
  state: AppState,
  lastContext: LastContext | null,
): SmartLookupResult | null {
  // T016a — anaphora pre-resolver: rewrite "davon"/"das"/"es" → entity.
  const { question, lower } = expandAnaphora(questionRaw, questionRaw.toLowerCase().trim(), lastContext);

  // ── Contact phone lookup ───────────────────────────────────────────────
  const contactPattern = /(?:welche\s+)?(?:telefon(?:nummer)?|nummer|kontakt|email|mail)\s+(?:hat|von|für)\s+(.+?)\??$/i;
  const callPattern = /^(?:ruf|wähle|anrufen)\s+(.+?)(?:\s+an)?\??$/i;
  const contactMatch = lower.match(contactPattern) ?? lower.match(callPattern);
  if (contactMatch) {
    const queryName = contactMatch[1]!.trim();
    const hit = findContact(queryName, state);
    if (!hit) return { reply: `Ich habe keinen Kontakt namens ${queryName} gefunden.` };
    if (!hit.phone) return { reply: `Für ${hit.name} (${hit.role}) ist keine Telefonnummer hinterlegt.` };
    return {
      reply: `${hit.name}, ${hit.role}: ${hit.phone}.`,
      context: { contact: hit },
    };
  }

  // ── Recipe kcal lookup ─────────────────────────────────────────────────
  const kcalMatch = lower.match(/(?:wie\s+viele?\s+)?(?:kalorien|kcal)\s+(?:hat|sind\s+in|von|für)\s+(.+?)\??$/i);
  if (kcalMatch) {
    const r = findRecipeByName(kcalMatch[1]!, state.recipes);
    if (!r) return { reply: `Ich habe das Rezept ${kcalMatch[1]} nicht gefunden.` };
    if (typeof r.kcalPerPortion !== "number") {
      return { reply: `Für ${r.nameDe || r.name} habe ich keine Kalorien-Angabe hinterlegt.`, context: { recipe: r } };
    }
    return {
      reply: `${r.nameDe || r.name} hat ca. ${Math.round(r.kcalPerPortion)} Kilokalorien pro Portion.`,
      context: { recipe: r },
    };
  }

  // ── Recipe allergen lookup ─────────────────────────────────────────────
  const allergenMatch = lower.match(/(?:welche\s+)?allergene?\s+(?:hat|sind\s+in|von|enthält|enthaelt)\s+(.+?)\??$/i);
  if (allergenMatch) {
    const r = findRecipeByName(allergenMatch[1]!, state.recipes);
    if (!r) return { reply: `Ich habe das Rezept ${allergenMatch[1]} nicht gefunden.` };
    if (!r.allergens || r.allergens.length === 0) {
      return { reply: `${r.nameDe || r.name} enthält keine kennzeichnungspflichtigen Allergene.`, context: { recipe: r } };
    }
    const labels = r.allergens.map((a) => ALLERGEN_DE[a] ?? a);
    return { reply: `${r.nameDe || r.name} enthält ${joinDeList(labels)}.`, context: { recipe: r } };
  }

  // ── Recipe price lookup ────────────────────────────────────────────────
  const priceMatch = lower.match(/(?:wie\s+(?:teuer|viel\s+kostet)|preis\s+(?:von|für)|verkaufspreis\s+(?:von|für))\s+(?:ist\s+)?(.+?)\??$/i);
  if (priceMatch) {
    const r = findRecipeByName(priceMatch[1]!, state.recipes);
    if (!r) return { reply: `Ich habe das Rezept ${priceMatch[1]} nicht gefunden.` };
    if (!r.sellPrice) return { reply: `Für ${r.nameDe || r.name} ist kein Verkaufspreis hinterlegt.`, context: { recipe: r } };
    return {
      reply: `${r.nameDe || r.name} kostet ${r.sellPrice.toFixed(2).replace(".", ",")} Euro.`,
      context: { recipe: r },
    };
  }

  // ── Recipe diet check ──────────────────────────────────────────────────
  const dietMatch = lower.match(/^ist\s+(.+?)\s+(vegan|vegetarisch|fleisch|fisch)\??$/i);
  if (dietMatch) {
    const r = findRecipeByName(dietMatch[1]!, state.recipes);
    if (!r) return { reply: `Ich habe das Rezept ${dietMatch[1]} nicht gefunden.` };
    const want = dietMatch[2]!.toLowerCase();
    const got = r.category;
    const isMatch =
      (want === "vegan" && got === "vegan") ||
      (want === "vegetarisch" && (got === "vegan" || got === "vegetarian")) ||
      (want === "fleisch" && got === "meat") ||
      (want === "fisch" && got === "fish");
    const catDe: Record<string, string> = { vegan: "vegan", vegetarian: "vegetarisch", meat: "ein Fleischgericht", fish: "ein Fischgericht", kids: "ein Kindergericht" };
    return {
      reply: isMatch ? `Ja, ${r.nameDe || r.name} ist ${catDe[got] ?? got}.` : `Nein, ${r.nameDe || r.name} ist ${catDe[got] ?? got}.`,
      context: { recipe: r },
    };
  }

  // ── T016b: shift query ────────────────────────────────────────────────
  // "Wer arbeitet heute / morgen / am Freitag"
  if (/wer\s+arbeitet|wer\s+(?:hat|macht)\s+(?:heute|morgen|schicht)|schicht\s+(?:heute|morgen)/i.test(lower)) {
    const day = parseSingleDay(lower) ?? { iso: new Date().toISOString().slice(0, 10), label: "heute" };
    const shifts = (state.shifts ?? []).filter((s) => s.date === day.iso);
    if (shifts.length === 0) return { reply: `${day.label[0]!.toUpperCase()}${day.label.slice(1)} sind keine Schichten eingeteilt.` };
    const empMap = new Map((state.employees ?? []).map((e) => [e.id, e.name]));
    const names = Array.from(new Set(shifts.map((s) => empMap.get(s.employeeId) || s.employeeId)));
    return {
      reply: `${day.label[0]!.toUpperCase()}${day.label.slice(1)} ${names.length === 1 ? "ist 1 Mitarbeiter eingeteilt" : `sind ${names.length} Mitarbeiter eingeteilt`}: ${joinDeList(names)}.`,
    };
  }

  // ── T016b: waste cost in date range ───────────────────────────────────
  if (/(?:wie\s+viel(?:e)?|wieviel)\s+(?:abfall|m[üu]ll|verschwendet|weggeworfen)|abfall.*kosten|wegwerf/i.test(lower)) {
    const range = dateRangeFromPhrase(lower) ?? { from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), label: "heute" };
    const items = (state.waste ?? []).filter((w) => w.date >= range.from && w.date <= range.to);
    const totalCost = items.reduce((n, w) => n + (w.cost ?? 0), 0);
    const totalGrams = items.reduce((n, w) => n + (w.grams ?? 0), 0);
    if (items.length === 0) return { reply: `${range.label[0]!.toUpperCase()}${range.label.slice(1)} wurde kein Abfall erfasst.` };
    const kg = totalGrams >= 1000 ? `${(totalGrams / 1000).toFixed(1)} Kilo` : `${Math.round(totalGrams)} Gramm`;
    return {
      reply: `${range.label[0]!.toUpperCase()}${range.label.slice(1)} wurden ${kg} Abfall im Wert von ${totalCost.toFixed(2).replace(".", ",")} Euro erfasst.`,
    };
  }

  // ── T016b: revenue / portion count ────────────────────────────────────
  if (/umsatz|verdient|eingenommen|wieviele?\s+portion|wie\s+viele?\s+portion/i.test(lower)) {
    const range = dateRangeFromPhrase(lower) ?? { from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), label: "heute" };
    const sales = state.sales.filter((s) => s.date >= range.from && s.date <= range.to);
    if (sales.length === 0) return { reply: `${range.label[0]!.toUpperCase()}${range.label.slice(1)} wurden noch keine Verkäufe erfasst.` };
    const portions = sales.reduce((n, s) => n + s.sold, 0);
    const revenue = sales.reduce((n, s) => {
      if (s.revenue && s.revenue > 0) return n + s.revenue;
      const r = state.recipes.find((rc) => rc.id === s.recipeId);
      return n + s.sold * (r?.sellPrice ?? 0);
    }, 0);
    if (/portion/i.test(lower)) {
      return { reply: `${range.label[0]!.toUpperCase()}${range.label.slice(1)} wurden ${portions} Portionen verkauft.` };
    }
    return {
      reply: `${range.label[0]!.toUpperCase()}${range.label.slice(1)}: ${portions} Portionen, ca. ${revenue.toFixed(0)} Euro Umsatz.`,
    };
  }

  // ── T016b: top customer (catering aggregate) ──────────────────────────
  if (/top\s+kund|gr[öo][ßs]te[rn]?\s+kund|wichtigste[rn]?\s+kund|umsatz.*kund|kund.*umsatz/i.test(lower)) {
    const range = dateRangeFromPhrase(lower);
    const events = (state.events ?? []).filter((e) => {
      if (!e.clientName) return false;
      if (!range) return true;
      return e.eventDate >= range.from && e.eventDate <= range.to;
    });
    if (events.length === 0) return { reply: range ? `${range.label[0]!.toUpperCase()}${range.label.slice(1)} habe ich keine Veranstaltungen.` : "Ich habe noch keine Catering-Kunden erfasst." };
    const agg = new Map<string, { count: number; revenue: number }>();
    for (const e of events) {
      const prev = agg.get(e.clientName) ?? { count: 0, revenue: 0 };
      // CateringEvent revenue = sum of menuItems (pricePerPortion × portions).
      // No flat perPersonCents on CateringEvent (that's CateringRequest).
      const eventRevenue = (e.menuItems ?? []).reduce((n, m) => n + (m.pricePerPortion ?? 0) * (m.portions ?? 0), 0);
      agg.set(e.clientName, { count: prev.count + 1, revenue: prev.revenue + eventRevenue });
    }
    const top = Array.from(agg.entries()).sort((a, b) => b[1].revenue - a[1].revenue || b[1].count - a[1].count)[0]!;
    const label = range ? `${range.label} ` : "";
    return {
      reply: `Top-Kunde ${label}ist ${top[0]} mit ${top[1].count} Veranstaltung${top[1].count === 1 ? "" : "en"}${top[1].revenue > 0 ? `, ca. ${top[1].revenue.toFixed(0)} Euro` : ""}.`,
    };
  }

  // ── T016d: NL recipe search (vegan, soup, ohne Gluten, unter X Euro) ──
  const nlSearch = handleRecipeSearch(lower, state.recipes);
  if (nlSearch) return { reply: nlSearch };

  // ── T016f: Internet recipe search (delegates to AI) ───────────────────
  // Trigger only when the user explicitly asks to search/idea/discover.
  // Returns reply=null here — handled async in handleQuestion via a special
  // marker because this path needs an AI round-trip.
  const onlineMatch = lower.match(/(?:suche|finde|gib mir|brauche|hast du)\s+(?:eine?\s+)?(?:rezept|idee|inspiration)\s+(?:für|fuer)\s+(.+?)\??$/i)
    ?? lower.match(/(?:rezept|idee)\s+für\s+(.+?)\??$/i);
  if (onlineMatch) {
    // Marker: empty reply + special pending kind. handleQuestion will detect
    // and trigger the AI fetch + confirm flow.
    return {
      reply: "__T016F_FETCH__:" + onlineMatch[1]!.trim(),
    };
  }

  // ── T016c: HACCP voice mutation ───────────────────────────────────────
  const haccpParsed = parseHaccpFromText(lower);
  if (haccpParsed) {
    return {
      reply: `Soll ich ${haccpParsed.summary} im HACCP-Protokoll erfassen? Sage Ja oder Nein.`,
      pending: { kind: "addHaccpEntry", entry: haccpParsed.entry, summary: haccpParsed.summary },
    };
  }

  // ── T016c: Inventory SET voice mutation ───────────────────────────────
  const invSetRaw = parseInventorySet(lower, state.inventory);
  // Dimension mismatch → speak a clear clarification, do NOT queue a pending
  // action with corrupted units.
  if (invSetRaw && "error" in invSetRaw) {
    return {
      reply: `Einheit passt nicht: ${invSetRaw.itemName} wird in ${invSetRaw.invUnit} geführt, du hast ${invSetRaw.spokenUnit} gesagt. Bitte nochmal mit passender Einheit.`,
    };
  }
  const invSet = invSetRaw;
  if (invSet) {
    return {
      reply: `Soll ich ${invSet.item.nameDe || invSet.item.name} auf ${invSet.qty} ${invSet.unit} setzen? Sage Ja oder Nein.`,
      pending: { kind: "setInventoryQty", itemId: invSet.item.id, itemName: invSet.item.nameDe || invSet.item.name, qty: invSet.qty, unit: invSet.unit },
      context: { inventoryItem: invSet.item },
    };
  }

  // ── T016c: Inventory CONSUME voice mutation ───────────────────────────
  const invConsumeRaw = parseInventoryConsume(lower, state.inventory);
  if (invConsumeRaw && "error" in invConsumeRaw) {
    return {
      reply: `Einheit passt nicht: ${invConsumeRaw.itemName} wird in ${invConsumeRaw.invUnit} geführt, du hast ${invConsumeRaw.spokenUnit} gesagt. Bitte nochmal mit passender Einheit.`,
    };
  }
  const invConsume = invConsumeRaw;
  if (invConsume) {
    // Parser already converted into inv.unit and validated dimension match.
    const u = invConsume.unit;
    const unitDe = u === "kg" ? "Kilo" : u === "g" ? "Gramm" : u === "l" ? "Liter" : u === "ml" ? "Milliliter" : "Stück";
    return {
      reply: `Soll ich ${invConsume.qty} ${unitDe} ${invConsume.item.nameDe || invConsume.item.name} vom Bestand abziehen? Sage Ja oder Nein.`,
      pending: { kind: "consumeInventoryQty", itemId: invConsume.item.id, itemName: invConsume.item.nameDe || invConsume.item.name, qty: invConsume.qty, unit: invConsume.unit },
      context: { inventoryItem: invConsume.item },
    };
  }

  // ── T016c: Waste voice mutation ───────────────────────────────────────
  const wasteParsed = parseWasteFromText(lower, state.inventory);
  if (wasteParsed) {
    return {
      reply: `Soll ich ${wasteParsed.summary} als Abfall erfassen? Sage Ja oder Nein.`,
      pending: { kind: "logWaste", entry: wasteParsed.entry, summary: wasteParsed.summary },
    };
  }

  // ── Order item: ADD ────────────────────────────────────────────────────
  const addMatch = question.toLowerCase().match(/(?:füge|fuege|tu|nimm|leg)\s+(.+?)\s+(?:zur|zum|in\s+die|in\s+den|in)\s+bestellung\s+(?:hinzu|dazu|rein)?/i);
  if (addMatch) {
    const draft = (state.orders ?? []).filter((o) => o.status === "draft")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!draft) return { reply: "Es gibt keine offene Bestellung. Öffne erst die Bestellvorschläge." };
    const { qty, unit, rest } = parseQtyUnit(addMatch[1]!);
    const inv = findInventoryByName(rest, state.inventory);
    const itemName = inv ? (inv.nameDe || inv.name) : rest;
    const finalUnit = inv?.unit || unit;
    const newItem: OrderDraftItem = {
      name: itemName,
      quantity: qty,
      unit: finalUnit,
      ...(inv ? { inventoryId: inv.id } : {}),
      reason: "Per Sprachbefehl hinzugefügt",
    };
    return {
      reply: `Soll ich ${qty} ${finalUnit} ${itemName} zur Bestellung bei ${draft.supplierName} hinzufügen? Sage Ja oder Nein.`,
      pending: { kind: "addOrderItem", order: draft, newItem, supplierName: draft.supplierName },
      ...(inv ? { context: { inventoryItem: inv } } : {}),
    };
  }

  // ── Order item: REMOVE ─────────────────────────────────────────────────
  const removeMatch = lower.match(/(?:entferne|streiche|lösche|loesche|nimm)\s+(.+?)\s+(?:aus|von)\s+(?:der\s+)?bestellung/i);
  if (removeMatch) {
    const draft = (state.orders ?? []).filter((o) => o.status === "draft")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!draft || draft.items.length === 0) return { reply: "Es gibt keine offene Bestellung mit Artikeln." };
    const target = removeMatch[1]!.toLowerCase().trim();
    const idx = draft.items.findIndex((it) => it.name.toLowerCase().includes(target) || target.includes(it.name.toLowerCase()));
    if (idx === -1) return { reply: `${removeMatch[1]} ist nicht in der Bestellung bei ${draft.supplierName}.` };
    const itemName = draft.items[idx]!.name;
    return {
      reply: `Soll ich ${itemName} aus der Bestellung bei ${draft.supplierName} entfernen? Sage Ja oder Nein.`,
      pending: { kind: "removeOrderItem", order: draft, itemIndex: idx, itemName },
    };
  }

  // ── Block 1: "Was kannst du?" / help command ──────────────────────────────
  if (/was\s+kannst\s+du|welche\s+(?:befehle|kommandos|funktionen)|hilf\s+mir\b|kios\s+hilfe/i.test(lower)) {
    return {
      reply:
        "Ich kann Timer stellen, Temperaturen protokollieren, Bestand abfragen, " +
        "Rezepte suchen, den Menüplan per Stimme befüllen, Verkäufe erfassen, " +
        "Rückstellproben anlegen und durch die App navigieren.",
    };
  }

  // ── Block 2: Ingredient substitution ─────────────────────────────────────
  // "Womit kann ich Butter ersetzen?" / "Kein Mehl vorhanden, Alternative?"
  const subMatch =
    lower.match(/(?:womit|wie)\s+kann\s+ich\s+(.+?)\s+(?:ersetzen|erstatten|austauschen)\??$/i) ??
    lower.match(/(?:kein(?:e)?|nicht\s+mehr)\s+(.+?)\s+(?:da|vorhanden|auf\s+lager)/i) ??
    lower.match(/(?:ersatz|alternative)\s+(?:f[üu]r)\s+(.+?)\??$/i);
  if (subMatch) {
    const query = subMatch[1]!.toLowerCase();
    const hit = SUBSTITUTES.find((s) => s.tokens.test(query));
    if (hit) {
      return { reply: `Für ${hit.item} kannst du ${hit.subs} verwenden.` };
    }
    return { reply: `Für ${subMatch[1]} habe ich leider keinen Ersatz gespeichert.` };
  }

  // ── Block 2: Ingredient availability check ────────────────────────────────
  // "Habe ich alles für Linsensuppe?" / "Haben wir genug Zutaten für Schnitzel?"
  const availMatch = lower.match(
    /(?:hab(?:e|en)?\s+(?:ich|wir)\s+alles\s+f[üu]r|reichen\s+die\s+zutaten\s+f[üu]r|zutaten\s+(?:f[üu]r|von))\s+(.+?)\??$/i,
  );
  if (availMatch) {
    const recipe = findRecipeByName(availMatch[1]!, state.recipes);
    if (!recipe) {
      return { reply: `Ich habe ${availMatch[1]} nicht in deinen Rezepten gefunden.` };
    }
    const missing: string[] = [];
    for (const ing of recipe.ingredients) {
      if (!ing.inventoryId) continue;
      const inv = state.inventory.find((i) => i.id === ing.inventoryId);
      if (!inv) { missing.push(ing.inventoryId); continue; }
      if (inv.quantity <= inv.minQuantity) missing.push(inv.nameDe || inv.name);
    }
    if (missing.length === 0) {
      return {
        reply: `Alle Zutaten für ${recipe.nameDe || recipe.name} sind ausreichend auf Lager.`,
        context: { recipe },
      };
    }
    return {
      reply: `Achtung: ${joinDeList(missing.slice(0, 3))} ${missing.length === 1 ? "ist" : "sind"} unter Mindestbestand für ${recipe.nameDe || recipe.name}.`,
      context: { recipe },
    };
  }

  // ── Block 2: Prep time lookup ─────────────────────────────────────────────
  // "Wie lange braucht Schnitzel?" / "Wie lange dauert Linsensuppe?"
  const prepMatch = lower.match(
    /(?:wie\s+lange?\s+(?:dauert?|braucht?|kocht?)|zubereitungszeit|kochzeit)\s+(?:f[üu]r\s+)?(.+?)\??$/i,
  );
  if (prepMatch) {
    const recipe = findRecipeByName(prepMatch[1]!, state.recipes);
    if (!recipe) {
      return { reply: `Ich habe ${prepMatch[1]} nicht in deinen Rezepten gefunden.` };
    }
    const t = recipe.cookTimeMin;
    if (!t) {
      return { reply: `Für ${recipe.nameDe || recipe.name} ist keine Kochzeit hinterlegt.`, context: { recipe } };
    }
    return { reply: `${recipe.nameDe || recipe.name} braucht ca. ${t} Minuten.`, context: { recipe } };
  }

  // ── Block 3: Voice menu planning ─────────────────────────────────────────
  // "Setze Linsensuppe auf Montag" / "Plane Schnitzel für Dienstag ein"
  const menuSetMatch = lower.match(
    /(?:setze?|trage?\s+ein|plane?(?:\s+ein)?|schreibe?)\s+(.+?)\s+(?:auf|f[üu]r|am)\s+(.+?)(?:\s+ein)?\??$/i,
  );
  if (menuSetMatch) {
    const recipe = findRecipeByName(menuSetMatch[1]!, state.recipes);
    if (!recipe) {
      return { reply: `Ich habe ${menuSetMatch[1]} nicht in deinen Rezepten gefunden.` };
    }
    const dayResult = parseSingleDay(menuSetMatch[2]!.trim().toLowerCase());
    if (!dayResult) {
      return {
        reply: `Den Tag "${menuSetMatch[2]}" habe ich nicht verstanden. Sage z.B. Montag, morgen oder übermorgen.`,
      };
    }
    const rName = recipe.nameDe || recipe.name;
    return {
      reply: `Soll ich ${rName} für ${dayResult.label} in den Speiseplan eintragen? Sage Ja oder Nein.`,
      pending: { kind: "setMenuByVoice", date: dayResult.iso, dateLabel: dayResult.label, recipeId: recipe.id, recipeName: rName },
      context: { recipe },
    };
  }

  // ── Block 3: Voice daily sales entry ─────────────────────────────────────
  // "Wir haben 45 Portionen Schnitzel verkauft" / "45 Portionen Linsensuppe heute"
  const saleVoiceMatch =
    lower.match(/(\d+)\s+(?:portionen?|st[üu]ck|mal)\s+(.+?)\s+(?:heute\s+)?(?:verkauft|serviert)\b/i) ??
    lower.match(/(?:wir\s+haben\s+|ich\s+habe\s+)?(\d+)\s+(?:portionen?|st[üu]ck)\s+(.+?)\s+(?:verkauft|serviert)/i);
  if (saleVoiceMatch) {
    const count = Number(saleVoiceMatch[1]);
    const recipe = findRecipeByName(saleVoiceMatch[2]!, state.recipes);
    if (!recipe) {
      return { reply: `${saleVoiceMatch[2]} habe ich nicht in deinen Rezepten.` };
    }
    const today = new Date().toISOString().slice(0, 10);
    const sale: SaleEntry = {
      id: `kios-${Date.now().toString(36)}`,
      date: today,
      recipeId: recipe.id,
      sold: count,
      cooked: count,
      revenue: count * (recipe.sellPrice ?? 0),
      source: "manual",
    };
    const rName = recipe.nameDe || recipe.name;
    return {
      reply: `Soll ich ${count} Portionen ${rName} für heute als verkauft erfassen? Sage Ja oder Nein.`,
      pending: { kind: "addSaleByVoice", sale, recipeName: rName, count },
      context: { recipe },
    };
  }

  // ── Block 3: Voice Rückstellprobe ─────────────────────────────────────────
  // "Rückstellprobe von Gulasch nehmen" / "Probe für Linsensuppe erfassen"
  const sampleMatch =
    lower.match(/(?:r[üu]ckstell)?probe\s+(?:von|f[üu]r|von\s+dem)\s+(.+?)(?:\s+nehmen|\s+erfassen)?\??$/i) ??
    lower.match(/(?:nehme?|nimm|erfasse?)\s+(?:r[üu]ckstell)?probe\s+(?:von|f[üu]r)\s+(.+?)\??$/i);
  if (sampleMatch) {
    const recipe = findRecipeByName(sampleMatch[1]!, state.recipes);
    const recipeName = recipe ? (recipe.nameDe || recipe.name) : sampleMatch[1]!;
    const today = new Date().toISOString().slice(0, 10);
    const retDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const sample: FoodSample = {
      id: `kios-${Date.now().toString(36)}`,
      date: today,
      recipeId: recipe?.id ?? "",
      recipeName,
      amountGrams: 100,
      retentionUntil: retDate,
      taken: true,
    };
    return {
      reply: `Soll ich eine Rückstellprobe von ${recipeName} (100 g, Aufbewahrung bis ${retDate}) erfassen? Sage Ja oder Nein.`,
      pending: { kind: "addFoodSampleByVoice", sample, recipeName },
      ...(recipe ? { context: { recipe } } : {}),
    };
  }

  return null;
}

function handleHandsFree(
  question: string,
  state: AppState,
  speakAndRestart: (text: string) => void,
): HandsFreeResult | null {
  const lower = question.toLowerCase();
  const isDe = state.locale === "de";

  // ── Cancel all timers ──────────────────────────────────────────────────
  if (/(alle|all)\s*timer\s*(stopp|abbrech|cancel|stop|l[öo]sch)/i.test(lower)) {
    const n = cancelAllTimers();
    return {
      reply: isDe
        ? n === 0 ? "Es laufen keine Timer." : `${n} Timer abgebrochen.`
        : n === 0 ? "No timers running." : `${n} timers cancelled.`,
    };
  }

  // ── List timers ────────────────────────────────────────────────────────
  if (/(welche|wieviele?|wie viele|how many|list).*timer|timer.*(laufen|liste|status|running)/i.test(lower)) {
    const ts = listTimers();
    if (ts.length === 0) {
      return { reply: isDe ? "Es laufen keine Timer." : "No timers running." };
    }
    const summary = ts
      .slice(0, 3)
      .map((t) => `${t.label}: ${formatDuration(Math.max(0, t.dueAt - Date.now()))}`)
      .join(", ");
    return {
      reply: isDe ? `Aktive Timer: ${summary}.` : `Active timers: ${summary}.`,
    };
  }

  // ── Start a timer ──────────────────────────────────────────────────────
  if (/timer|stell.*(minuten|sekunden|stunde)/i.test(lower)) {
    const parsed = parseTimerPhrase(lower);
    if (parsed) {
      const fireText = isDe
        ? `Achtung, Timer ${parsed.label} ist abgelaufen.`
        : `Attention, timer ${parsed.label} has finished.`;
      startTimer(parsed.label, parsed.ms, () => {
        // Speak when the timer fires. Voice settings are on the snapshot taken
        // at start time — adequate for short kitchen timers.
        speakHQ(fireText, state.locale, () => { /* no-op */ }, state.kiosVoice);
      });
      return {
        reply: isDe
          ? `Timer für ${formatDuration(parsed.ms)} gestartet.`
          : `Timer for ${formatDuration(parsed.ms)} started.`,
      };
    }
  }

  // ── Portion math ───────────────────────────────────────────────────────
  // "Wie viel Salz für 80 Portionen Schnitzel?" / "How much salt for 80 portions of schnitzel?"
  const portionMatch = lower.match(/(\d+)\s*(?:portion|portionen|servings?|stück|stueck)/);
  if (portionMatch) {
    const targetCount = Number(portionMatch[1]);
    const recipe = findRecipeByName(question, state.recipes);
    if (recipe && targetCount > 0) {
      // Optional: ingredient name in question.
      const ingredientHit = state.inventory.find((inv) =>
        lower.includes((inv.nameDe || inv.name).toLowerCase()),
      );
      // Default base portion = recipe portionGrams.
      const sumGrams = recipe.ingredients.reduce((acc, ing) => {
        if (ingredientHit && ing.inventoryId !== ingredientHit.id) return acc;
        return acc + ing.grams * targetCount;
      }, 0);
      if (ingredientHit) {
        const display = sumGrams >= 1000 ? `${(sumGrams / 1000).toFixed(1)} kg` : `${Math.round(sumGrams)} g`;
        const recipeName = isDe ? recipe.nameDe : recipe.name;
        const ingName = isDe ? ingredientHit.nameDe : ingredientHit.name;
        return {
          reply: isDe
            ? `Für ${targetCount} Portionen ${recipeName} brauchst du ${display} ${ingName}.`
            : `For ${targetCount} portions of ${recipeName} you need ${display} of ${ingName}.`,
        };
      }
      const totalKg = (recipe.portionGrams * targetCount) / 1000;
      const recipeName = isDe ? recipe.nameDe : recipe.name;
      return {
        reply: isDe
          ? `Für ${targetCount} Portionen ${recipeName} brauchst du ca. ${totalKg.toFixed(1)} Kilo Zutaten.`
          : `For ${targetCount} portions of ${recipeName} you need about ${totalKg.toFixed(1)} kg of ingredients.`,
      };
    }
  }

  // ── Recipe step reading ────────────────────────────────────────────────
  // "Lies Schritt 3 von Schnitzel" / "Read step 2 of lentil soup"
  const stepMatch = lower.match(/(?:schritt|step)\s*(\d+)/);
  if (stepMatch) {
    const stepIdx = Number(stepMatch[1]) - 1;
    const recipe = findRecipeByName(question, state.recipes);
    if (recipe && stepIdx >= 0) {
      const steps = isDe ? recipe.stepsDe ?? recipe.steps : recipe.steps;
      if (steps && steps.length > 0) {
        if (stepIdx >= steps.length) {
          return {
            reply: isDe
              ? `Es gibt nur ${steps.length} Schritte in diesem Rezept.`
              : `This recipe only has ${steps.length} steps.`,
          };
        }
        const stepText = steps[stepIdx]!;
        return {
          reply: isDe ? `Schritt ${stepIdx + 1}: ${stepText}` : `Step ${stepIdx + 1}: ${stepText}`,
        };
      }
    }
  }

  void speakAndRestart; // reserved for future side-effects
  return null;
}

// ── Mutable refs ─────────────────────────────────────────────────────────────
// Phase machine (T015 expansion):
//   wake     — listening for the wake word "Kios"
//   question — heard wake, listening for the actual question
//   ai       — AI/handler is processing; ignore audio
//   followup — Kios just spoke; listen for next question WITHOUT requiring
//              the wake word (10-second window). On timeout → wake.
//   confirm  — a destructive action is pending; listen for Ja/Nein
//              (30-second window). On timeout → cancel + back to wake.
// Maximum number of Q+A exchanges to keep in the conversation ring buffer.
// Enough for a natural chained conversation; not so many that the prompt bloats.
const CONV_HISTORY_MAX = 6;

interface KiosRefs {
  status: KiosStatus;
  phase: "wake" | "question" | "ai" | "followup" | "confirm";
  rec: unknown;
  restartTimer: ReturnType<typeof setTimeout> | null;
  /** TTL for the followup window (auto-revert to wake on silence). */
  followupTtl: ReturnType<typeof setTimeout> | null;
  /** Pending mutation awaiting Ja/Nein. */
  pendingAction: PendingAction | null;
  /** TTL for the confirm window (auto-cancel on silence). */
  pendingTtl: ReturnType<typeof setTimeout> | null;
  state: AppState;
  /** T016a — last referenced entity for anaphora resolution. */
  lastContext: LastContext | null;
  /** Block 1 — last spoken text so "Wiederhole" can replay it. */
  lastSpokenText: string;
  /** Conversation ring buffer — last N Q+A pairs for multi-turn memory. */
  convHistory: ConversationMessage[];
}

// Time windows (T015). Tuned for kitchen-floor reality:
//   followup: long enough to think and ask a follow-up; short enough that
//             the kios returns to wake-mode before the next person walks up.
//   confirm:  long enough to glance at the screen, weigh, and reply; short
//             enough that an unattended kios doesn't sit waiting forever.
const FOLLOWUP_WINDOW_MS = 10_000;
const CONFIRM_WINDOW_MS  = 30_000;

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
  const { state, dispatch } = useApp();
  const router    = useRouter();

  const [status, setStatusState] = useState<KiosStatus>("off");
  const r = useRef<KiosRefs>({
    status: "off",
    phase: "wake",
    rec: null,
    restartTimer: null,
    followupTtl: null,
    pendingAction: null,
    pendingTtl: null,
    state,
    lastContext: null,
    lastSpokenText: "",
    convHistory: [],
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

  function clearFollowupTtl() {
    if (r.current.followupTtl !== null) {
      clearTimeout(r.current.followupTtl);
      r.current.followupTtl = null;
    }
  }

  function clearPendingTtl() {
    if (r.current.pendingTtl !== null) {
      clearTimeout(r.current.pendingTtl);
      r.current.pendingTtl = null;
    }
  }

  function clearAllTimers() {
    clearRestartTimer();
    clearFollowupTtl();
    clearPendingTtl();
  }

  function stopListening() {
    clearAllTimers();
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

  // T015: Continuous-conversation window. After Kios speaks, listen for the
  // next question WITHOUT requiring the wake word for FOLLOWUP_WINDOW_MS.
  // If the window elapses with no final transcript, fall back to wake-mode.
  function scheduleFollowup(delayMs = 300) {
    clearRestartTimer();
    clearFollowupTtl();
    r.current.restartTimer = setTimeout(() => {
      if (r.current.status === "off") return;
      setStatus("idle");
      startListening("followup");
      // Hard TTL: even if recognition stays alive (Safari is chatty), force
      // the demotion to wake-mode after the window expires so a stranger
      // walking up later can't accidentally trigger a command.
      r.current.followupTtl = setTimeout(() => {
        if (r.current.status === "off") return;
        if (r.current.phase === "followup") {
          r.current.phase = "wake";
          // No need to stop+start recognition; the next final transcript
          // simply gets evaluated against the wake-word matcher.
        }
      }, FOLLOWUP_WINDOW_MS);
    }, delayMs);
  }

  // T015: Listen for Ja/Nein on a pending mutation. The confirm window is
  // longer than followup because the user needs time to glance at the screen
  // and weigh the action. On timeout, the pending action is cancelled
  // silently and we revert to wake-mode (NOT followup — once a confirm
  // expires, there's no useful conversational context to continue).
  function scheduleConfirm(delayMs = 300) {
    clearRestartTimer();
    clearPendingTtl();
    r.current.restartTimer = setTimeout(() => {
      if (r.current.status === "off") return;
      setStatus("idle");
      startListening("confirm");
      // TTL: always clear pendingAction regardless of current phase. SR
      // races (Safari onend → wake demotion) could otherwise leave a stale
      // pendingAction lingering in memory after the timeout expires.
      r.current.pendingTtl = setTimeout(() => {
        if (r.current.status === "off") return;
        r.current.pendingAction = null;
        if (r.current.phase === "confirm") r.current.phase = "wake";
      }, CONFIRM_WINDOW_MS);
    }, delayMs);
  }

  async function handleQuestion(question: string) {
    stopListening();
    setStatus("thinking");
    const snap   = r.current.state;
    const locale = snap.locale;
    const lower  = question.toLowerCase().trim();

    // Block 1: "Wiederhole" / "Nochmal" — replay the last spoken text without
    // an AI round-trip. Useful when the cook was distracted or the kitchen
    // was noisy and they missed the answer.
    if (/\b(wiederhole?|nochmal|noch\s+einmal|was\s+hast\s+du\s+gesagt|was\s+sagtest\s+du)\b/i.test(question)) {
      const last = r.current.lastSpokenText;
      setStatus("speaking");
      speakHQ(
        last || "Ich habe noch nichts gesagt.",
        locale,
        () => scheduleFollowup(300),
        snap.kiosVoice,
      );
      return;
    }

    // T015: Smart lookups (recipe info, contacts, order mutations) BEFORE
    // hands-free intents — contact names ("ruf X an") and recipe info
    // ("kalorien hat X") deserve dedicated regex without competing with the
    // looser timer/portion patterns. A returned `pending` triggers the
    // Ja/Nein confirm phase.
    // T016a — pass the last-referenced entity for anaphora pre-resolver.
    const smart = handleSmartLookups(question, snap, r.current.lastContext);
    if (smart) {
      // T016a — anaphora context lifecycle:
      //  - hit with `context` → refresh (extend TTL on the new entity)
      //  - hit without `context` → clear (a non-entity intent just answered;
      //    keeping a stale recipe/inv reference would let later "wie teuer
      //    ist das?" resolve wrongly to it).
      if (smart.context) {
        r.current.lastContext = { ...smart.context, ts: Date.now() };
      } else {
        r.current.lastContext = null;
      }

      // T016f — internet recipe search marker. handleSmartLookups returns
      // a marker reply; we kick off the AI fetch here, then queue a
      // confirm-pending action ("Soll ich es hinzufügen?").
      if (smart.reply.startsWith("__T016F_FETCH__:")) {
        const query = smart.reply.slice("__T016F_FETCH__:".length).trim();
        setStatus("speaking");
        speakHQ(`Einen Moment, ich suche nach ${query}.`, locale, () => {
          void (async () => {
            try {
              const gen = await generateRecipe({ idea: query, locale: "de" });
              // generateRecipe returns allergens as string[]; the Recipe type
              // requires the strict Allergen union. Filter to the known
              // tokens (the AI prompt already constrains to this set, but a
               // defensive filter prevents bad model output from breaking us).
              const ALLERGEN_KEYS: ReadonlyArray<Allergen> = [
                "gluten", "milk", "egg", "nuts", "soy", "fish", "shellfish",
                "celery", "mustard", "sesame", "sulphite", "lupin", "mollusc", "peanut",
              ];
              const safeAllergens: Allergen[] = (gen.allergens ?? [])
                .filter((a): a is Allergen => ALLERGEN_KEYS.includes(a as Allergen));
              const recipe: Recipe = {
                id: `kios-${Date.now().toString(36)}`,
                name: gen.name,
                nameDe: gen.nameDe,
                type: gen.type,
                category: gen.category,
                meat: gen.meat,
                portionGrams: gen.portionGrams,
                ingredients: [],
                allergens: safeAllergens,
                steps: gen.steps,
                stepsDe: gen.stepsDe,
                basePrice: gen.basePrice,
                sellPrice: gen.sellPrice,
                cookTimeMin: gen.cookTimeMin,
                ...(typeof gen.kcalPerPortion === "number" ? { kcalPerPortion: gen.kcalPerPortion } : {}),
              };
              r.current.pendingAction = { kind: "addRecipeFromOnline", recipe };
              const kcalPart = typeof recipe.kcalPerPortion === "number" ? `, ${Math.round(recipe.kcalPerPortion)} Kalorien pro Portion` : "";
              setStatus("speaking");
              speakHQ(
                `Vorschlag: ${recipe.nameDe}${kcalPart}. Soll ich es zu deinen Rezepten hinzufügen? Sage Ja oder Nein.`,
                locale,
                () => scheduleConfirm(200),
                snap.kiosVoice,
              );
            } catch {
              setStatus("speaking");
              speakHQ(
                "Ich konnte kein passendes Rezept generieren. Versuche es bitte später.",
                locale,
                () => scheduleFollowup(400),
                snap.kiosVoice,
              );
            }
          })();
        }, snap.kiosVoice);
        return;
      }

      if (smart.pending) {
        r.current.pendingAction = smart.pending;
      }
      r.current.lastSpokenText = smart.reply;
      setStatus("speaking");
      speakHQ(smart.reply, locale, () => {
        if (smart.pending) {
          // Speak finished → arm confirm listening. The Ja/Nein handler
          // lives in rec.onresult phase==="confirm" branch below.
          scheduleConfirm(200);
        } else {
          scheduleFollowup(300);
        }
      }, snap.kiosVoice);
      return;
    }

    // Hands-free cooking intents next (timer / portion math / step reading).
    const handsFree = handleHandsFree(question, snap, () => { /* unused */ });
    if (handsFree) {
      setStatus("speaking");
      speakHQ(handsFree.reply, locale, () => {
        if (handsFree.sideEffect) handsFree.sideEffect();
        scheduleFollowup(300);
      }, snap.kiosVoice);
      return;
    }

    // Quick command (instant nav).
    // T016g — in rush hours (lunch/dinner service) Kios speaks the terse
    // form ("Lager." instead of "Ich zeige dir den Lagerbestand.") to get
    // the cook back to work faster.
    const quick = matchQuickCommand(question);
    if (quick) {
      if (NAV_MAP[quick.nav]) router.push(NAV_MAP[quick.nav] as never);
      setStatus("speaking");
      // Block 1: terse in rush-mode, randomised phrase variant otherwise.
      const replyText = isRushMode()
        ? terseQuickReply(quick.nav, quick.reply)
        : pickNavReply(quick.nav, quick.reply, false);
      r.current.lastSpokenText = replyText;
      speakHQ(replyText, locale, () => scheduleFollowup(300), snap.kiosVoice);
      return;
    }

    // ── Correction handler ────────────────────────────────────────────────
    // "Das war falsch" / "Das stimmt nicht" → pop the last exchange from
    // history so the wrong answer doesn't contaminate follow-up context.
    if (/\b(das\s+war\s+falsch|das\s+stimmt\s+nicht|falsche\s+antwort|du\s+hast\s+dich\s+geirrt)\b/i.test(lower)) {
      const hist = r.current.convHistory;
      if (hist.length >= 2) {
        // Remove the last Q+A pair (user + kios)
        r.current.convHistory = hist.slice(0, -2);
      }
      setStatus("speaking");
      const sorry = "Entschuldigung — ich habe die falsche Antwort aus meinem Gedächtnis gelöscht. Bitte stelle die Frage neu.";
      r.current.lastSpokenText = sorry;
      speakHQ(sorry, locale, () => scheduleFollowup(400), snap.kiosVoice);
      return;
    }

    // AI round-trip — pass conversation history for multi-turn memory
    let result: Awaited<ReturnType<typeof askKios>> | null = null;
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
      result = await Promise.race([
        askKios(question, snap, r.current.convHistory),
        new Promise<never>((_, reject) =>
          ac.signal.addEventListener("abort", () => reject(new Error("timeout"))),
        ),
      ]);
      clearTimeout(tid);
    } catch {
      // AI unreachable — try offline knowledge first, then escalate to chat.
      const offline = searchOffline(question);
      if (offline) {
        setStatus("speaking");
        r.current.lastSpokenText = offline.answerShort;
        speakHQ(offline.answerShort, locale, () => scheduleFollowup(500), snap.kiosVoice);
        return;
      }
      // Nothing found offline — escalate to the AI chat screen.
      const escalateMsg = locale === "de"
        ? "Ich leite das an den KI-Assistenten weiter."
        : "Forwarding your question to the AI assistant.";
      dispatch({ type: "setPendingChatQuery", query: question });
      setStatus("speaking");
      speakHQ(escalateMsg, locale, () => {
        router.push(NAV_MAP["chat"] as never);
        scheduleFollowup(500);
      }, snap.kiosVoice);
      return;
    }

    if (!result) { scheduleFollowup(500); return; }

    // ── Update conversation ring buffer ───────────────────────────────────
    // Push user Q + Kios answer; trim to CONV_HISTORY_MAX pairs (2 messages each).
    r.current.convHistory = [
      ...r.current.convHistory,
      { role: "user" as const, text: question },
      { role: "kios" as const, text: result.answer },
    ].slice(-(CONV_HISTORY_MAX * 2));

    const navKey = result.navigate && result.navigate !== "null" ? result.navigate : null;

    // When Kios explicitly routes to chat, store the question so chat.tsx
    // can auto-send it and produce a full AI response.
    if (navKey === "chat") {
      dispatch({ type: "setPendingChatQuery", query: question });
    }

    if (navKey && NAV_MAP[navKey]) router.push(NAV_MAP[navKey] as never);

    r.current.lastSpokenText = result.answer;
    setStatus("speaking");

    // Speak answer, then — after a short pause — speak suggestion if present.
    // The suggestion is a follow-up question (e.g. "Soll ich nachbestellen?")
    // that keeps the conversation alive without needing the wake word again.
    const suggestion = result.suggestion?.trim() ?? null;
    speakHQ(result.answer, locale, () => {
      if (suggestion && !isRushMode()) {
        // In rush mode skip suggestion entirely — the cook is busy.
        setTimeout(() => {
          speakHQ(suggestion, locale, () => scheduleFollowup(400), snap.kiosVoice);
        }, 400);
      } else {
        scheduleFollowup(300);
      }
    }, snap.kiosVoice);
  }

  // T015: Execute a confirmed pending mutation. Called from the Ja-branch in
  // rec.onresult below. Speaks a result then hands back to followup so the
  // user can chain commands ("Ja" → "Erledigt." → "und füg auch Brot hinzu").
  //
  // Concurrency: the order snapshot in `pending.order` was captured when the
  // user issued the voice command (up to 30s ago). In that window the same
  // order may have been edited via the UI on another tab/device. We MUST
  // re-fetch from current state and merge — never blindly overwrite.
  // For remove, the stale `itemIndex` becomes meaningless after edits, so we
  // re-locate by `itemName` (substring match, same as the original lookup).
  function executePendingAction() {
    const pending = r.current.pendingAction;
    r.current.pendingAction = null;
    clearPendingTtl();
    if (!pending) {
      scheduleRestart(300);
      return;
    }
    const locale = r.current.state.locale;
    const voice  = r.current.state.kiosVoice;
    setStatus("speaking");

    // ── Order mutations (T015) ─────────────────────────────────────────
    if (pending.kind === "addOrderItem" || pending.kind === "removeOrderItem") {
      const liveOrder = (r.current.state.orders ?? []).find((o) => o.id === pending.order.id);
      if (!liveOrder || liveOrder.status !== "draft") {
        speakHQ(
          "Die Bestellung wurde inzwischen geändert oder gesendet. Aktion abgebrochen.",
          locale, () => scheduleFollowup(400), voice,
        );
        return;
      }
      if (pending.kind === "addOrderItem") {
        const next: OrderDraft = { ...liveOrder, items: [...liveOrder.items, pending.newItem] };
        dispatch({ type: "updateOrder", order: next });
        const it = pending.newItem;
        speakHQ(`Erledigt: ${it.quantity} ${it.unit} ${it.name} hinzugefügt.`, locale, () => scheduleFollowup(300), voice);
      } else {
        const target = pending.itemName.toLowerCase();
        const idx = liveOrder.items.findIndex((it) =>
          it.name.toLowerCase() === target ||
          it.name.toLowerCase().includes(target) ||
          target.includes(it.name.toLowerCase()),
        );
        if (idx === -1) {
          speakHQ(
            `${pending.itemName} ist nicht mehr in der Bestellung. Aktion abgebrochen.`,
            locale, () => scheduleFollowup(400), voice,
          );
          return;
        }
        const next: OrderDraft = { ...liveOrder, items: liveOrder.items.filter((_, i) => i !== idx) };
        dispatch({ type: "updateOrder", order: next });
        speakHQ(`Erledigt: ${pending.itemName} entfernt.`, locale, () => scheduleFollowup(300), voice);
      }
      return;
    }

    // ── T016c — HACCP entry ───────────────────────────────────────────
    if (pending.kind === "addHaccpEntry") {
      dispatch({ type: "addHaccp", log: pending.entry });
      speakHQ(`Erledigt: ${pending.summary} im HACCP-Protokoll erfasst.`, locale, () => scheduleFollowup(300), voice);
      return;
    }

    // ── T016c — Inventory SET ─────────────────────────────────────────
    // Re-fetch by id: the item may have been edited or deleted in the
    // 30-second confirm window. Never blindly overwrite using a stale
    // snapshot — that's how voice mutations corrupt production data.
    // Also abort if inv.unit changed since parse (qty was converted into
    // the parse-time unit and would be wrong against the new unit).
    if (pending.kind === "setInventoryQty") {
      const inv = (r.current.state.inventory ?? []).find((i) => i.id === pending.itemId);
      if (!inv) {
        speakHQ(`Der Artikel ${pending.itemName} wurde inzwischen gelöscht. Aktion abgebrochen.`, locale, () => scheduleFollowup(400), voice);
        return;
      }
      if (inv.unit !== pending.unit) {
        speakHQ(`Die Einheit von ${inv.nameDe || inv.name} hat sich geändert. Bitte wiederhole den Befehl.`, locale, () => scheduleFollowup(400), voice);
        return;
      }
      const next: InventoryItem = { ...inv, quantity: pending.qty };
      dispatch({ type: "updateInventory", item: next });
      speakHQ(`Erledigt: ${inv.nameDe || inv.name} auf ${pending.qty} ${pending.unit} gesetzt.`, locale, () => scheduleFollowup(300), voice);
      return;
    }

    // ── T016c — Inventory CONSUME (decrement) ─────────────────────────
    // pending.qty/.unit are already in the (parse-time) inv.unit. Re-check
    // unit hasn't changed before applying.
    if (pending.kind === "consumeInventoryQty") {
      const inv = (r.current.state.inventory ?? []).find((i) => i.id === pending.itemId);
      if (!inv) {
        speakHQ(`Der Artikel ${pending.itemName} wurde inzwischen gelöscht. Aktion abgebrochen.`, locale, () => scheduleFollowup(400), voice);
        return;
      }
      if (inv.unit !== pending.unit) {
        speakHQ(`Die Einheit von ${inv.nameDe || inv.name} hat sich geändert. Bitte wiederhole den Befehl.`, locale, () => scheduleFollowup(400), voice);
        return;
      }
      const newQty = Math.max(0, inv.quantity - pending.qty);
      const next: InventoryItem = { ...inv, quantity: Math.round(newQty * 1000) / 1000 };
      dispatch({ type: "updateInventory", item: next });
      speakHQ(
        `Erledigt: ${pending.itemName} verbraucht. Restbestand ${next.quantity} ${inv.unit}.`,
        locale, () => scheduleFollowup(300), voice,
      );
      return;
    }

    // ── T016c — Waste log ─────────────────────────────────────────────
    if (pending.kind === "logWaste") {
      dispatch({ type: "addWaste", entry: pending.entry });
      speakHQ(`Erledigt: ${pending.summary} als Abfall erfasst.`, locale, () => scheduleFollowup(300), voice);
      return;
    }

    // ── T016f — Add recipe imported from internet search ─────────────
    if (pending.kind === "addRecipeFromOnline") {
      dispatch({ type: "addRecipe", recipe: pending.recipe });
      speakHQ(
        `Erledigt: ${pending.recipe.nameDe} zu deinen Rezepten hinzugefügt.`,
        locale, () => scheduleFollowup(300), voice,
      );
      return;
    }

    // ── Block 3 — Voice menu planning ────────────────────────────────
    if (pending.kind === "setMenuByVoice") {
      const existing = r.current.state.menu.find((m) => m.date === pending.date);
      const entry: MenuDayEntry = {
        date: pending.date,
        recipeIds: existing
          ? [...existing.recipeIds.filter((id) => id !== pending.recipeId), pending.recipeId]
          : [pending.recipeId],
      };
      dispatch({ type: "setMenu", entry });
      speakHQ(
        `Erledigt: ${pending.recipeName} für ${pending.dateLabel} in den Speiseplan eingetragen.`,
        locale, () => scheduleFollowup(300), voice,
      );
      return;
    }

    // ── Block 3 — Voice daily sales entry ────────────────────────────
    if (pending.kind === "addSaleByVoice") {
      dispatch({ type: "addSale", sale: pending.sale });
      speakHQ(
        `Erledigt: ${pending.count} Portionen ${pending.recipeName} als Tagesverkauf erfasst.`,
        locale, () => scheduleFollowup(300), voice,
      );
      return;
    }

    // ── Block 3 — Voice Rückstellprobe ───────────────────────────────
    if (pending.kind === "addFoodSampleByVoice") {
      dispatch({ type: "addFoodSample", sample: pending.sample });
      speakHQ(
        `Erledigt: Rückstellprobe von ${pending.recipeName} erfasst. Aufbewahrung bis ${pending.sample.retentionUntil}.`,
        locale, () => scheduleFollowup(300), voice,
      );
      return;
    }
  }

  function cancelPendingAction(spoken = true) {
    r.current.pendingAction = null;
    clearPendingTtl();
    if (spoken) {
      const locale = r.current.state.locale;
      const voice  = r.current.state.kiosVoice;
      setStatus("speaking");
      speakHQ("Abgebrochen.", locale, () => scheduleFollowup(300), voice);
    } else {
      scheduleFollowup(300);
    }
  }

  function startListening(initialPhase: "wake" | "question" | "followup" | "confirm" = "wake") {
    if (!isVoiceAvailable()) return;
    // Note: do NOT call stopListening() here — callers (scheduleFollowup,
    // scheduleConfirm) have already cleared the recognition instance and
    // we want to PRESERVE the followup/pending TTLs they just armed.
    if (r.current.rec) {
      try { (r.current.rec as { abort(): void }).abort(); } catch { /* ignore */ }
      r.current.rec = null;
    }

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
              // T016g — in rush hours skip the "Ja?" prompt entirely and go
              // straight to listening. Saves ~600 ms per command.
              if (isRushMode()) {
                if (r.current.status !== "off" && r.current.status !== "thinking") {
                  startListening("question");
                }
              } else {
                speakHQ("Ja?", r.current.state.locale, () => {
                  if (r.current.status !== "off" && r.current.status !== "thinking") {
                    startListening("question");
                  }
                }, r.current.state.kiosVoice);
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
        } else if (r.current.phase === "followup") {
          // T015: Continuous conversation — treat any final transcript as
          // a question, no wake word required. The TTL armed by
          // scheduleFollowup will demote us back to "wake" if nobody
          // speaks during the window.
          if (result.isFinal) {
            const question = raw.trim();
            if (question.length > 2) {
              clearFollowupTtl();
              r.current.phase = "ai";
              void handleQuestion(question);
            }
          }
        } else if (r.current.phase === "confirm") {
          // T015: Awaiting Ja/Nein on a pending mutation.
          if (result.isFinal) {
            const yes = /\b(ja|jawohl|jo|ok|okay|gerne|machen|mach|bestätige|bestaetige)\b/.test(lower);
            const no  = /\b(nein|nö|noe|nicht|abbruch|abbrechen|stop|stopp|cancel|vergiss)\b/.test(lower);
            const abortRec = () => {
              if (r.current.rec) {
                try { (r.current.rec as { abort(): void }).abort(); } catch { /* ignore */ }
                r.current.rec = null;
              }
            };
            if (yes && !no) {
              r.current.phase = "ai";
              abortRec();
              clearAllTimers();
              executePendingAction();
            } else if (no && !yes) {
              r.current.phase = "ai";
              abortRec();
              clearAllTimers();
              cancelPendingAction(true);
            } else if (yes && no) {
              // Ambiguous (e.g. "ja nicht" / "nein, ok"). Re-prompt AND
              // re-arm the confirm TTL so the action cannot expire while
              // we're still speaking the clarification or waiting for the
              // user's next attempt. Architect feedback: leaving the
              // original TTL alive could fire mid-clarification, killing
              // the pending action right before the user says "Ja".
              if (r.current.pendingTtl !== null) {
                clearTimeout(r.current.pendingTtl);
                r.current.pendingTtl = null;
              }
              setStatus("speaking");
              speakHQ(
                "Bitte antworte nur mit Ja oder Nein.",
                r.current.state.locale,
                () => {
                  if (r.current.status === "off") return;
                  setStatus("idle");
                  startListening("confirm");
                  // Re-arm a fresh TTL after the clarification finishes.
                  r.current.pendingTtl = setTimeout(() => {
                    if (r.current.status === "off") return;
                    r.current.pendingAction = null;
                    if (r.current.phase === "confirm") r.current.phase = "wake";
                  }, CONFIRM_WINDOW_MS);
                },
                r.current.state.kiosVoice,
              );
            }
            // Truly unrelated text (e.g. background noise transcribed as
            // a sentence): ignore and keep listening — TTL still armed.
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
    // Safari iOS gesture-bless: create + .resume() the shared AudioContext
    // RIGHT NOW (still inside the user's tap). Once unlocked here, the context
    // stays blessed for the entire page lifetime — every subsequent speakHQ()
    // call (from async fetches, recognition callbacks, timers) plays through
    // a fresh AudioBufferSourceNode without needing another user gesture.
    primeAudio();
    // Server-side warm: tell the API to pre-generate every static phrase MP3.
    void prewarmTtsCache({ preset: "kios-de", voice: state.kiosVoice });
    // Client-side warm: fetch the hottest phrases into the browser blob cache
    // so quick replies ("Ja?", "Statistik wird geöffnet.", …) play instantly
    // with zero network latency — critical on Safari where even 200 ms of
    // fetch latency can drop us outside the user-activation window.
    void prefetchKiosPhrases(state.kiosVoice);
    setStatus("idle");
    // T016e — proactive morning briefing. If 12+ hours have passed since the
    // last briefing AND there's something worth reporting (events / expiring
    // items / low stock / yesterday waste), speak it once. Listening starts
    // AFTER the briefing finishes so the spoken text doesn't get clipped by
    // an overlapping wake-listener restart.
    void (async () => {
      let spoken = false;
      try {
        const raw = await AsyncStorage.getItem("kios:lastBriefingAt");
        const last = raw ? Number(raw) : 0;
        const now = Date.now();
        if (!Number.isFinite(last) || now - last >= 12 * 3600 * 1000) {
          const briefing = composeMorningBriefing(r.current.state);
          if (briefing) {
            spoken = true;
            await AsyncStorage.setItem("kios:lastBriefingAt", String(now));
            // Guard: if disable() races against this async block, status
            // becomes "off" and we must NOT speak or restart listening.
            if (r.current.status === "off") return;
            setStatus("speaking");
            speakHQ(briefing, r.current.state.locale, () => {
              if (r.current.status === "off") return;
              setStatus("idle");
              startListening("wake");
            }, r.current.state.kiosVoice);
          }
        }
      } catch { /* briefing is best-effort; never block enable() */ }
      // Same guard: don't restart listening if disable() ran during the await.
      if (!spoken && r.current.status !== "off") startListening("wake");
    })();
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

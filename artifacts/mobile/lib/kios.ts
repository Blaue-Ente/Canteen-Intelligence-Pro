import { generateJson } from "@/lib/ai";
import { scoreMenu, next7DayWindow } from "@/lib/dge";
import { getWeatherCache, buildWeatherContext } from "@/lib/weather";
import type { AppState, DgeScore, DgeStandard, InventoryItem } from "@/types";

// ─── Preorder context cache ───────────────────────────────────────────────────
// Updated by preorder.tsx after every poll so Kios has live, structured data
// about pending orders — without needing an extra API call at question time.
export interface PreorderCtx {
  locationCode: string;
  locationName: string;        // readable name, e.g. "Samariterstraße"
  totalNew: number;            // orders with status "new" (unacknowledged)
  totalOpen: number;           // all non-cancelled, non-served orders
  totalPortions: number;       // total portions across open orders

  // Top dishes across all dates, sorted by qty desc
  // e.g. "25× Schnitzel (Di 13.05)", "12× Suppe (Mo 12.05)"
  summaryLines: string[];

  // Per-date totals — one line per delivery day
  // e.g. "Di 13.05: 45 Portionen — 25× Schnitzel, 20× Gulasch"
  byDateLines: string[];

  // Per-customer breakdown — one line per customer (top 10)
  // e.g. "S3 (Di 13.05): 2× Schnitzel, 1× Suppe"
  customerLines: string[];

  // Per-menu-slot totals (from weekly menu join) — only if weekly menu loaded
  // e.g. "Menü 1: 25× Schnitzel, 20× Gulasch", "Menü 2: 15× Pasta"
  menuSlotLines: string[];

  updatedAt: string;
}
let preorderCtxCache: PreorderCtx | null = null;

export function updatePreorderCache(ctx: PreorderCtx | null): void {
  preorderCtxCache = ctx;
}

// Memoize the DGE score across Kios questions — recipes/menu/inventory rarely
// change between voice commands, so recomputing the 7-day score on every
// "Hey Kios" wake-up is wasted CPU on iPad. Invalidate by length-based signature
// (cheap O(1)) plus the active standard. Worst case we miss a single edit; the
// next state mutation reshapes the signature and we recompute.
let dgeCache: { sig: string; score: DgeScore } | null = null;
function memoizedDgeScore(state: AppState, standard: DgeStandard): DgeScore | null {
  const win = next7DayWindow();
  const sig = `${standard}|${win.fromDate}|${state.recipes.length}|${state.menu.length}|${state.inventory.length}|${state.locale ?? "de"}`;
  if (dgeCache && dgeCache.sig === sig) return dgeCache.score;
  try {
    const score = scoreMenu({
      recipes: state.recipes,
      menu: state.menu,
      inventory: state.inventory,
      standard,
      fromDate: win.fromDate,
      toDate: win.toDate,
      isDe: (state.locale ?? "de").startsWith("de"),
    });
    dgeCache = { sig, score };
    return score;
  } catch {
    return null;
  }
}

// All known navigation targets. Kept in sync with NAV_MAP in useKios.ts.
export type KiosNav =
  | "home" | "inventory" | "menu" | "stats" | "more"
  | "sales" | "zettle" | "orders" | "procurement" | "inventur"
  | "dienstplan" | "suppliers" | "producers" | "catering" | "events"
  | "calculator" | "waste" | "wastecam" | "reste" | "preorder" | "customers"
  | "aggregate" | "rollup" | "priceserver" | "crm"
  | "forecast" | "handover" | "margin" | "leaderboard"
  | "reports" | "dishanalysis" | "okowizard"
  | "locations" | "haccp" | "scan" | "chat" | "recipe" | "team"
  | "settings" | "aushang"
  | "production" | "cleaning" | "kasse" | "dge"
  | "null";

// ─── Conversation memory ─────────────────────────────────────────────────────
// Passed from useKios.ts so Kios can resolve anaphora and chain questions
// naturally ("Und was ist damit?" after "Was hat S3 bestellt?").
export interface ConversationMessage {
  role: "user" | "kios";
  text: string;
}

export interface KiosResponse {
  answer: string;
  navigate: KiosNav | null;
  /** Optional follow-up suggestion spoken after the answer, e.g. "Soll ich die Portionen anpassen?" */
  suggestion?: string | null;
}

// ─── Proactive anomaly detection ─────────────────────────────────────────────
export interface KiosAnomaly {
  severity: "warn" | "critical";
  title: string;
  body: string;
}

/**
 * Cross-checks the live preorder cache against the current inventory and
 * returns any anomalies Kios should proactively report (e.g. not enough stock
 * for ordered portions, unusually low preorder volume, etc.).
 * Best-effort: returns [] when inputs are empty.
 */
export function checkPreorderAnomalies(
  poc: PreorderCtx,
  inventory: readonly InventoryItem[],
): KiosAnomaly[] {
  if (!poc || poc.totalOpen === 0) return [];
  const anomalies: KiosAnomaly[] = [];

  // Build: dishName → total ordered portions (across all dates)
  const dishDemand = new Map<string, number>();
  for (const line of poc.summaryLines) {
    // Format: "25× Schnitzel (Di 13.05)"
    const m = line.match(/^(\d+)×\s+(.+?)\s*\(/);
    if (m) dishDemand.set(m[2]!, Number(m[1]));
  }

  // Check inventory coverage for each ordered dish
  for (const [dish, portions] of dishDemand) {
    const lower = dish.toLowerCase();
    const inv = inventory.find((i) => {
      const n = (i.nameDe || i.name).toLowerCase();
      return n.includes(lower) || lower.includes(n);
    });
    if (!inv) continue;

    // Rough: assume 200g per portion for solid food, 300ml for liquids
    const gramsPerPortion = inv.unit === "l" || inv.unit === "ml" ? 0.3 : 0.2;
    const neededKg = portions * gramsPerPortion;
    const availKg =
      inv.unit === "kg" ? inv.quantity
      : inv.unit === "g" ? inv.quantity / 1000
      : inv.unit === "l" ? inv.quantity
      : inv.unit === "ml" ? inv.quantity / 1000
      : 0;

    if (availKg > 0 && availKg < neededKg * 0.5) {
      anomalies.push({
        severity: "critical",
        title: `⚠ Bestand kritisch: ${inv.nameDe || inv.name}`,
        body: `${portions} Portionen ${dish} bestellt, aber nur ${availKg.toFixed(1)} ${inv.unit === "l" || inv.unit === "ml" ? "l" : "kg"} im Lager (benötigt ca. ${neededKg.toFixed(1)} kg).`,
      });
    } else if (availKg > 0 && availKg < neededKg) {
      anomalies.push({
        severity: "warn",
        title: `⚡ Bestand knapp: ${inv.nameDe || inv.name}`,
        body: `${portions} Portionen ${dish} bestellt. Nur ${availKg.toFixed(1)} ${inv.unit === "l" || inv.unit === "ml" ? "l" : "kg"} verfügbar.`,
      });
    }
  }

  return anomalies;
}

export function buildKitchenContext(state: AppState): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // ── Inventory ───────────────────────────────────────────────────────────
  const low: string[] = [];
  const ok: string[] = [];
  [...state.inventory]
    .sort((a, b) => a.quantity / (a.minQuantity || 1) - b.quantity / (b.minQuantity || 1))
    .slice(0, 30)
    .forEach((i) => {
      const name = i.nameDe || i.name;
      const entry = `${name}: ${i.quantity}${i.unit}`;
      if (i.quantity <= i.minQuantity) low.push(`⚠ ${entry}`);
      else ok.push(entry);
    });
  const inventoryLines = [...low, ...ok].join(", ") || "Kein Bestand";
  const lowCount = low.length;
  const expiringSoon = state.inventory
    .filter((i) => {
      if (!i.expiresAt) return false;
      const days = (new Date(i.expiresAt).getTime() - Date.now()) / 86_400_000;
      return days >= 0 && days <= 3;
    })
    .slice(0, 5)
    .map((i) => `${i.nameDe || i.name} (${i.expiresAt})`)
    .join(", ");

  // ── Menu (today + tomorrow) ─────────────────────────────────────────────
  const todayEntry = state.menu.find((m) => m.date === today);
  const todayMenu = todayEntry
    ? todayEntry.recipeIds.map((id) => state.recipes.find((r) => r.id === id)?.nameDe ?? id).join(", ")
    : "Kein Menü für heute geplant";
  const tomorrowEntry = state.menu.find((m) => m.date === tomorrow);
  const tomorrowMenu = tomorrowEntry
    ? tomorrowEntry.recipeIds.map((id) => state.recipes.find((r) => r.id === id)?.nameDe ?? id).join(", ")
    : null;

  // ── Sales — today + last 14 days ────────────────────────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const salesMap = new Map<string, { sold: number; cooked: number }>();
  state.sales
    .filter((s) => s.date >= cutoffDate)
    .forEach((s) => {
      const prev = salesMap.get(s.recipeId) ?? { sold: 0, cooked: 0 };
      salesMap.set(s.recipeId, { sold: prev.sold + s.sold, cooked: prev.cooked + s.cooked });
    });
  const salesLines = Array.from(salesMap.entries())
    .sort((a, b) => b[1].sold - a[1].sold)
    .slice(0, 10)
    .map(([id, v]) => `${state.recipes.find((r) => r.id === id)?.nameDe ?? id}: ${v.sold} verk./${v.cooked} gek.`)
    .join(" | ");

  const todaySales = state.sales.filter((s) => s.date === today);
  const todayPortions = todaySales.reduce((n, s) => n + s.sold, 0);
  const todayRevenue = todaySales.reduce((n, s) => {
    const price = state.recipes.find((r) => r.id === s.recipeId)?.sellPrice ?? 0;
    return n + s.sold * price;
  }, 0);
  const todayWasteCount = todaySales.reduce((n, s) => n + Math.max(0, s.cooked - s.sold), 0);

  // ── Catering events ─────────────────────────────────────────────────────
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);
  const upcomingEvents = (state.events ?? [])
    .filter((e) => e.eventDate >= today && e.eventDate <= in30Str)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const eventsStr = upcomingEvents.slice(0, 5)
    .map((e) => `${e.eventDate} "${e.title}" (${e.guestCount} Gäste, ${e.status})`)
    .join("; ");
  const eventsTodayTomorrow = upcomingEvents
    .filter((e) => e.eventDate === today || e.eventDate === tomorrow).length;

  // ── Waste / leftovers ───────────────────────────────────────────────────
  const todayWasteCost = (state.waste ?? [])
    .filter((w) => w.date === today)
    .reduce((n, w) => n + (w.cost ?? 0), 0);


  // ── Margins ─────────────────────────────────────────────────────────────
  const lowMargin = state.recipes
    .filter((r) => r.sellPrice > 0 && r.basePrice / r.sellPrice > 0.4)
    .slice(0, 3)
    .map((r) => r.nameDe || r.name)
    .join(", ");

  // ── Suppliers / locations / team / catering / HACCP ──────────────────────
  const supplierCount = state.suppliers.length;
  const locationCount = (state.locations ?? []).length;
  const teamCount     = (state.employees ?? []).length;
  const recipeCount   = state.recipes.length;
  const cateringOpen  = (state.catering ?? []).filter((c) => c.status === "new" || c.status === "draft").length;
  const haccpToday    = (state.haccp ?? []).filter((h) => h.date === today).length;
  const ordersOpen    = (state.orders ?? []).filter((o) => o.status === "draft" || o.status === "sent").length;
  const handoverRecent = (state.handovers ?? []).filter((h) => h.date >= today).length;

  // ── T013: Rückstellproben (food retention samples per LMHV §11) ─────────
  // Samples are valid for 7 days after preparation (date + 7 = retentionUntil).
  const samples = state.foodSamples ?? [];
  const activeSamples = samples.filter((s) => s.retentionUntil >= today).length;
  const samplesToday  = samples.filter((s) => s.date === today).length;
  const samplesPending = samples.filter((s) => !s.taken && s.retentionUntil >= today).length;

  // ── Preorder Branding ────────────────────────────────────────────────────
  const brandingName  = state.preorderBranding?.restaurantName;
  const brandingColor = state.preorderBranding?.primaryColor;

  // ── Öko-Challenges ───────────────────────────────────────────────────────
  const okoScore       = state.okoProgress?.score ?? 0;
  const okoCompletions = state.okoProgress?.completions?.length ?? 0;
  const okoEnabled     = state.okoEnabled ?? false;

  // ── Inventory transfer (multi-location context) ──────────────────────────
  const multiLocation = (state.locations ?? []).length > 1;

  // ── T013: Subscription tier + app mode ──────────────────────────────────
  const tier    = state.subscription?.tier ?? "free";
  const appMode = state.appMode ?? "lite";

  // ── T014: DGE compliance (only when standard is opted-in) ───────────────
  let dgeLine: string | null = null;
  if (state.dgeStandard) {
    const dge = memoizedDgeScore(state, state.dgeStandard);
    if (dge) {
      const status = dge.overall >= 80 ? "konform" : dge.overall >= 60 ? "teilkonform" : "nicht konform";
      const open   = dge.criteria.filter((c) => !c.met).length;
      dgeLine = `DGE-Standard ${state.dgeStandard}: ${dge.overall}/100 (${status}), ${open} Kriterien offen`;
    }
  }

  // ── Preorder context (live cache from polling) ───────────────────────────
  const poc = preorderCtxCache;

  return [
    `Datum: ${today}`,
    `Abo-Tarif: ${tier}, App-Modus: ${appMode}`,
    `Heutige Karte: ${todayMenu}`,
    tomorrowMenu ? `Morgen: ${tomorrowMenu}` : null,
    `Heutige Verkäufe: ${todayPortions} Portionen, ca. ${todayRevenue.toFixed(0)}€ Umsatz` +
      (todayWasteCount > 0 ? `, ${todayWasteCount} übrig (Reste)` : ""),
    todayWasteCost > 0 ? `Heutiger Abfall-Wert: ${todayWasteCost.toFixed(0)}€` : null,
    `Lager (${lowCount} unter Mindestbestand): ${inventoryLines}`,
    expiringSoon ? `Läuft bald ab: ${expiringSoon}` : null,
    `Verkäufe letzte 14 Tage: ${salesLines || "Keine Daten"}`,
    eventsStr ? `Veranstaltungen (30 Tage): ${eventsStr}` : null,
    eventsTodayTomorrow > 0 ? `Heute/morgen ${eventsTodayTomorrow} Event(s)!` : null,
    cateringOpen > 0 ? `${cateringOpen} offene Catering-Anfragen` : null,
    ordersOpen > 0 ? `${ordersOpen} offene Bestellungen` : null,
    handoverRecent > 0 ? `${handoverRecent} Schichtübergabe(n) heute` : null,
    lowMargin ? `Niedrige Marge: ${lowMargin}` : null,
    haccpToday > 0 ? `HACCP heute: ${haccpToday} Einträge erfasst` : null,
    `Rückstellproben: ${activeSamples} aktiv (LMHV §11, 7-Tage-Frist)` +
      (samplesToday > 0 ? `, ${samplesToday} heute neu` : "") +
      (samplesPending > 0 ? `, ${samplesPending} noch nicht physisch genommen` : ""),
    dgeLine,
    `Stamm: ${recipeCount} Rezepte, ${supplierCount} Lieferanten, ${locationCount} Standorte, ${teamCount} Mitarbeiter`,
    multiLocation ? `Multi-Standort aktiv: Bestand-Transfer zwischen Standorten möglich (Inventur-Seite)` : null,
    okoEnabled ? `Öko-Wizard: ${okoScore} Punkte, ${okoCompletions} erledigte Aufgaben` : null,
    brandingName ? `Vorbestellung-Branding: Name "${brandingName}"${brandingColor ? `, Farbe ${brandingColor}` : ""}` : null,
    // Live preorder summary — injected from polling cache (see preorder.tsx)
    poc
      ? [
          `Vorbestellungen bei ${poc.locationName || poc.locationCode} (${poc.locationCode}):` +
            ` ${poc.totalNew} NEU, ${poc.totalOpen} offen, ${poc.totalPortions} Portionen gesamt`,
          poc.byDateLines.length > 0
            ? `  Tage: ${poc.byDateLines.join(" | ")}`
            : null,
          poc.menuSlotLines.length > 0
            ? `  Menüs: ${poc.menuSlotLines.join(" | ")}`
            : null,
          poc.customerLines.length > 0
            ? `  Kunden: ${poc.customerLines.join(" | ")}`
            : null,
        ].filter(Boolean).join("\n")
      : null,
  ].filter(Boolean).join("\n");
}

const NAV_LIST = [
  "home", "inventory", "menu", "stats", "more",
  "sales", "zettle", "orders", "procurement", "inventur", "dienstplan",
  "suppliers", "producers", "catering", "events", "calculator",
  "waste", "wastecam", "reste", "preorder", "customers", "aggregate", "rollup",
  "priceserver", "crm", "forecast", "handover", "margin", "leaderboard",
  "reports", "dishanalysis", "okowizard", "locations", "haccp", "scan",
  "chat", "recipe", "team", "settings", "aushang",
  "production", "cleaning", "kasse", "dge", "null",
].join("|");

const SCHEMA_HINT = `{"answer":"string","navigate":"${NAV_LIST}","suggestion":"string|null"}`;

// ── Time-of-day tone signal ──────────────────────────────────────────────────
function getTimeOfDayHint(): string {
  const h = new Date().getHours();
  if (h < 9)  return "Frühschicht (vor 09:00): freundlicher Morgengruß-Ton, proaktiver Tagesbriefing-Stil.";
  if (h < 12) return "Vorbereitungszeit (09–12): sachlich, präzise, Fokus auf Produktion und Einkauf.";
  if (h < 14) return "Mittagsservice (12–14): RUSH MODE — ultrakurze Antworten, keine Floskeln.";
  if (h < 17) return "Nachbereitungszeit (14–17): entspannt, ausführlicher für Planungsfragen.";
  if (h < 20) return "Abendschicht (17–20): RUSH MODE — kurze Antworten; nach 19:00 Tagesabschluss-Tipps.";
  return "Spätschicht (nach 20:00): ruhig, Fokus auf Abschluss und Vorbereitung für morgen.";
}

export async function askKios(
  question: string,
  state: AppState,
  history: readonly ConversationMessage[] = [],
): Promise<KiosResponse> {
  const ctx = buildKitchenContext(state);
  const lowCount = state.inventory.filter((i) => i.quantity <= i.minQuantity).length;
  const weather = getWeatherCache();
  const weatherLine = weather ? `\nAktuelles Wetter: ${buildWeatherContext(weather)}` : "";
  const timeHint = getTimeOfDayHint();

  // Embed last ≤6 exchanges so Kios can resolve anaphora and chain questions
  const historyBlock = history.length > 0
    ? "\nBisheriger Gesprächsverlauf (älteste zuerst):\n" +
      history.map((m) => `  [${m.role === "user" ? "Koch" : "Kios"}]: ${m.text}`).join("\n") +
      "\n"
    : "";

  const prompt = `\
Du bist "Kios", der intelligente Küchen-Assistent von KitchenOS auf einem iPad in einer deutschen Profiküche.

Persönlichkeit & Verhalten:
- Du bist ein echter Profi-Assistent, der mitdenkt — nicht nur ein Sprachrohr.
- Verknüpfe Informationen aus verschiedenen Bereichen (Bestand + Bestellungen + Wetter + Personal).
- Wenn du unsicher bist, sag es ehrlich: "Basierend auf den letzten Daten schätze ich..." oder "Dazu habe ich keine genauen Daten."
- Nutze den Gesprächsverlauf für Folgefragen — "davon", "das", "sie" beziehen sich auf das zuletzt genannte Thema.
- Schlage proaktiv eine sinnvolle nächste Aktion vor (Feld "suggestion") — kurzer Satz als Frage.

Ton: ${timeHint}

Antwort-Regeln:
- Sprache: Deutsch. "answer": max. 1 Satz, max. 20 Wörter, kein Markdown, keine Symbole.
- "suggestion": 1 kurze Folgefrage ODER null. Beispiele: "Soll ich die Portionen im Produktionsplan anpassen?", "Möchtest du Schnitzel nachbestellen?"
- Sei konkret mit echten Zahlen aus dem Status unten.
- "navigate" nur wenn ein klarer App-Bereich gemeint ist, sonst "null".
- Bei Wetterfragen: nutze die Wetterdaten und verbinde sie mit Prognose/Absatz (Regen → mehr Suppe-Nachfrage etc.).

App-Bereiche (verwende den Schlüssel als "navigate"):

KÜCHE & BESTAND
  inventory   = Lager, Bestand, Vorrat, Mindestbestand
  inventur    = Inventur / Bestandsaufnahme zählen
  procurement = Auto-Bestellvorschläge (Bestellung erstellen)
  orders      = Wareneingang / Lieferung erhalten
  suppliers   = Lieferanten verwalten
  producers   = Regionale Erzeuger (Bauern, Höfe)
  scan        = Barcode/Etikett scannen, Produkt fotografieren

MENÜ & REZEPTE
  menu        = Wochenplan, heutige Karte, Gericht zuweisen
  recipe      = Einzelnes Rezept anlegen/bearbeiten
  reste       = Reste verwerten — Rezepte aus Übrigem
  calculator  = Preiskalkulation, Foodcost, Verkaufspreis
  okowizard   = Öko-Wizard, CO2, Bio/Regional-Anteil

VERKAUF & KASSE
  sales       = Tagesabschluss (verkaufte Portionen/Reste eintragen)
  zettle      = Zettle Kartenterminal Sync
  stats       = Verkaufsstatistik, Top-Gerichte, Umsatz
  margin      = Marge-Alerts, niedrige Deckungsbeiträge
  dishanalysis= Detaillierte Gericht-Analyse (Score)
  reports     = Berichte, Auswertungen
  aggregate   = Tageszusammenfassung pro Standort
  rollup      = Multi-Standort-Vergleich
  priceserver = Zentrale Preise pro Standort

VORBESTELLUNG & KUNDEN
  preorder    = App-Vorbestellungen (von Gästen)
  customers   = Kundenkonten (Geschäftskunden genehmigen)
  crm         = CRM, Kundenpflege
  catering    = Catering-Aufträge
  events      = Veranstaltungen / Großevents
  forecast    = Bedarfs-/Wetter-Prognose

PERSONAL & LOGISTIK
  dienstplan  = Schichtplan, Personalplanung
  team        = Mitarbeiter-Liste
  handover    = Schichtübergabe
  leaderboard = Mitarbeiter-Rangliste
  locations   = Standorte / Filialen verwalten

QUALITÄT & RECHT
  haccp       = HACCP, Hygiene, Temperaturprotokoll, Allergen-Doku, BLE-Bluetooth-Thermometer
  production  = Produktion / Chargen / Rückstellproben (LMHV §11, 7 Tage)
  cleaning    = Reinigungsplan, Reinigungs-Nachweis
  dge         = DGE-Qualitätsstandard Score (Schule/Kita/Krankenhaus/Senioren), DGE-Zertifikat-PDF
  waste       = Abfallerfassung
  wastecam    = Tablett-Foto-Analyse (KI schätzt Reste aus Foto)
  aushang     = Wochenplan-Aushang (Ausdruck)
  kasse       = Kasse / Rechnung / TSE / KassenSichV / DSFinV-K (nur Full-Modus)

ALLGEMEIN
  home        = Startseite / Übersicht
  more        = Mehr-Menü (Übersicht aller Bereiche)
  chat        = KI-Assistent für komplexe Fragen, Rezeptideen
  settings    = Einstellungen, Nutzer, Benachrichtigungen
  null        = Keine Navigation, nur Antwort

Aktueller Küchen-Status:
${ctx}${weatherLine}
${historyBlock}
Beispiele mit suggestion-Feld:
  "Muss ich nachbestellen?" → answer: "${lowCount > 0 ? `Ja, ${lowCount} Artikel unter Mindestbestand.` : "Nein, alles in Ordnung."}" navigate: procurement suggestion: "Soll ich einen Bestellvorschlag erstellen?"
  "Was hat S3 zum Dienstag bestellt?" → answer: "S3 hat 2 Portionen Schnitzel und 1 Suppe für Dienstag bestellt." navigate: preorder suggestion: "Soll ich die Bestellung für S3 bestätigen?"
  "Wie oft Menü 1 für Samariterstraße?" → answer: "Menü 1 bei Samariterstraße wurde [X]-mal bestellt, insgesamt [Y] Portionen." navigate: preorder suggestion: "Möchtest du den Produktionsplan für Menü 1 öffnen?"
  "Wie ist das Wetter?" → answer: "Aktuell [T]°C und [Beschreibung]. Morgen [T2]°C — [Prog]." navigate: null suggestion: "Bei Regen empfehle ich mehr Suppe einzuplanen — soll ich die Prognose öffnen?"
  "Wird es morgen regnen?" → answer: "Morgen [Beschreibung], [T_min]–[T_max]°C, [X] mm Niederschlag erwartet." navigate: forecast suggestion: "Soll ich die Bedarfsprognose für morgen anpassen?"
  "Haben wir genug für Schnitzel morgen?" → answer: "Du hast [X] kg Fleisch — für [N] Portionen Schnitzel reicht das [gut/knapp]." navigate: inventory suggestion: "Soll ich Fleisch auf die Bestellliste setzen?"
  "Womit kann ich Butter ersetzen?" → answer: "Butter lässt sich durch Margarine oder Kokosöl ersetzen." navigate: null suggestion: null
  "Was kannst du?" → answer: "Timer, Temperaturen, Bestand, Rezepte, Menüplanung, Wetter, Vorbestellungen — einfach fragen." navigate: null suggestion: null
  "Das war falsch" → answer: "Entschuldigung — bitte formuliere deine Frage neu, ich versuche es besser." navigate: null suggestion: null

Frage: "${question}"`.trim();

  return generateJson<KiosResponse>(prompt, SCHEMA_HINT);
}

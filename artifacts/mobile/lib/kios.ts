import { generateJson } from "@/lib/ai";
import type { AppState } from "@/types";

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
  | "null";

export interface KiosResponse {
  answer: string;
  navigate: KiosNav | null;
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

  return [
    `Datum: ${today}`,
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
    `Stamm: ${recipeCount} Rezepte, ${supplierCount} Lieferanten, ${locationCount} Standorte, ${teamCount} Mitarbeiter`,
  ].filter(Boolean).join("\n");
}

const NAV_LIST = [
  "home", "inventory", "menu", "stats", "more",
  "sales", "zettle", "orders", "procurement", "inventur", "dienstplan",
  "suppliers", "producers", "catering", "events", "calculator",
  "waste", "wastecam", "reste", "preorder", "customers", "aggregate", "rollup",
  "priceserver", "crm", "forecast", "handover", "margin", "leaderboard",
  "reports", "dishanalysis", "okowizard", "locations", "haccp", "scan",
  "chat", "recipe", "team", "settings", "aushang", "null",
].join("|");

const SCHEMA_HINT = `{"answer":"string","navigate":"${NAV_LIST}"}`;

export async function askKios(question: string, state: AppState): Promise<KiosResponse> {
  const ctx = buildKitchenContext(state);
  const lowCount = state.inventory.filter((i) => i.quantity <= i.minQuantity).length;

  const prompt = `\
Du bist "Kios", der smarte Küchen-Assistent von KitchenOS auf einem iPad in einer deutschen Profiküche.

Antwort-Regeln:
- Sprache: Deutsch, max. 1 Satz, max. 18 Wörter.
- Für Sprachausgabe: kein Markdown, keine Symbole, keine Klammern, keine Aufzählungen.
- Sei konkret mit Zahlen aus dem Status. Vermeide Phrasen wie "schau in der Statistik".
- Wenn keine Daten vorliegen: das ehrlich sagen ("Dazu habe ich noch keine Daten.").
- "navigate" wählst du nur, wenn die Frage einen klaren Bereich betrifft, sonst "null".

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
  haccp       = HACCP, Hygiene, Temperaturprotokoll, Allergen-Doku
  waste       = Abfallerfassung
  wastecam    = Tablett-Foto-Analyse (KI schätzt Reste aus Foto)
  aushang     = Wochenplan-Aushang (Ausdruck)

ALLGEMEIN
  home        = Startseite / Übersicht
  more        = Mehr-Menü (Übersicht aller Bereiche)
  chat        = KI-Assistent für komplexe Fragen, Rezeptideen
  settings    = Einstellungen, Nutzer, Benachrichtigungen
  null        = Keine Navigation, nur Antwort

Aktueller Küchen-Status:
${ctx}

Beispiele:
  "Wie viel Milch?" → answer: "Du hast aktuell [X] Liter Milch im Lager." navigate: inventory
  "Was kochen wir morgen?" → answer: "Morgen stehen [Gericht1] und [Gericht2] auf dem Plan." navigate: menu
  "Muss ich nachbestellen?" → answer: "${lowCount > 0 ? `Ja, ${lowCount} Artikel sind unter Mindestbestand.` : "Nein, alles in Ordnung."}" navigate: procurement
  "Wie war der Umsatz?" → answer: "Heute wurden bisher [X] Portionen für ca. [Y]€ verkauft." navigate: stats
  "Catering diese Woche?" → answer: "Ja, [Anzahl] Veranstaltungen, die nächste am [Datum]." navigate: catering
  "Wer wartet auf Genehmigung?" → answer: "[N] Geschäftskunden warten auf deine Freigabe." navigate: customers
  "Welche Marge ist schlecht?" → answer: "Niedrige Marge bei [Gericht1] und [Gericht2]." navigate: margin
  "Was läuft bald ab?" → answer: "[Produkt] läuft am [Datum] ab." navigate: inventory
  "Mach den Tagesabschluss" → answer: "Tagesabschluss wird geöffnet." navigate: sales
  "Hygiene-Check" → answer: "HACCP-Protokoll wird geöffnet." navigate: haccp
  "Wie viel Abfall heute?" → answer: "Heute wurden [X]€ Abfall erfasst." navigate: waste
  "Erkläre Reste-Rezepte" → answer: "Hier kannst du aus Übrigem neue Gerichte vorschlagen lassen." navigate: reste

Frage: "${question}"`.trim();

  return generateJson<KiosResponse>(prompt, SCHEMA_HINT);
}

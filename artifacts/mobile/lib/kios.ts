import { generateJson } from "@/lib/ai";
import type { AppState } from "@/types";

export interface KiosResponse {
  answer: string;
  navigate:
    | "inventory"
    | "stats"
    | "menu"
    | "home"
    | "chat"
    | "suppliers"
    | "producers"
    | "customers"
    | "more"
    | "null"
    | null;
}

export function buildKitchenContext(state: AppState): string {
  const today = new Date().toISOString().slice(0, 10);

  // Inventory — low stock items first, max 30
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

  // Today's menu
  const todayEntry = state.menu.find((m) => m.date === today);
  const menuStr = todayEntry
    ? todayEntry.recipeIds
        .map((id) => state.recipes.find((r) => r.id === id)?.nameDe ?? id)
        .join(", ")
    : "Kein Menü für heute geplant";

  // Sales — last 14 days, top 10 by volume
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
    .map(([id, v]) => {
      const name = state.recipes.find((r) => r.id === id)?.nameDe ?? id;
      return `${name}: ${v.sold} verk./${v.cooked} gek.`;
    })
    .join(" | ");

  // Today's sales summary
  const todaySales = state.sales.filter((s) => s.date === today);
  const todayPortions = todaySales.reduce((n, s) => n + s.sold, 0);
  const todayRevenue = todaySales.reduce((n, s) => {
    const price = state.recipes.find((r) => r.id === s.recipeId)?.sellPrice ?? 0;
    return n + s.sold * price;
  }, 0);

  // Catering events — upcoming (next 30 days) + active statuses
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);
  const upcomingEvents = (state.events ?? [])
    .filter((e) => e.eventDate >= today && e.eventDate <= in30Str)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 5)
    .map((e) => `${e.eventDate} "${e.title}" (${e.guestCount} Gäste, Status: ${e.status})`)
    .join("; ");

  // Waste today
  const todayWaste = (state.waste ?? [])
    .filter((w) => w.date === today)
    .reduce((n, w) => n + (w.cost ?? 0), 0);

  // Suppliers count
  const supplierCount = state.suppliers.length;

  return [
    `Datum: ${today}`,
    `Heutige Karte: ${menuStr}`,
    `Heutige Verkäufe: ${todayPortions} Portionen, ca. ${todayRevenue.toFixed(0)}€ Umsatz`,
    todayWaste > 0 ? `Heutiger Abfall: ${todayWaste.toFixed(0)}€` : null,
    `Lager (${lowCount} unter Mindestbestand): ${inventoryLines}`,
    `Verkäufe letzte 14 Tage: ${salesLines || "Keine Daten"}`,
    supplierCount > 0 ? `Gespeicherte Lieferanten: ${supplierCount}` : null,
    upcomingEvents ? `Kommende Veranstaltungen (30 Tage): ${upcomingEvents}` : null,
  ].filter(Boolean).join("\n");
}

const SCHEMA_HINT = '{"answer":"string","navigate":"inventory|stats|menu|home|chat|suppliers|producers|customers|more|null"}';

export async function askKios(question: string, state: AppState): Promise<KiosResponse> {
  const ctx = buildKitchenContext(state);
  const lowCount = state.inventory.filter((i) => i.quantity <= i.minQuantity).length;

  const prompt = `\
Du bist "Kios", der smarte Küchen-Assistent von KitchenOS — eingebaut in ein iPad in einer deutschen Profiküche.
Regeln:
- Antworte auf Deutsch, max. 1 Satz, max. 15 Wörter.
- Schreib für Sprachausgabe: kein Markdown, keine Symbole, keine Klammern, keine Listen.
- Nutze die Zahlen aus dem Küchen-Status direkt in der Antwort — sei konkret, nicht vage.
- Wähle "navigate" nur wenn die Frage klar auf einen Bereich verweist, sonst "null".

Navigation:
  inventory  → Lager, Bestand, Vorräte, was haben wir, nachbestellen
  stats      → Statistik, Umsatz, Verkäufe, was läuft gut
  menu       → Speisekarte, Menü, Gerichte, was kochen wir
  home       → Übersicht, Startseite, zurück
  chat       → komplexe Fragen, Rezepte, Ideen, KI-Assistent
  suppliers  → Lieferanten, Bestellung aufgeben
  producers  → regionale Erzeuger
  customers  → Kunden, Vorbestellungen, Genehmigungen
  more       → Einstellungen, HACCP, Catering, Berichte
  null       → nur Antwort, kein Bildschirmwechsel nötig

Aktueller Küchen-Status:
${ctx}

Beispiele:
  "Wie viel Milch haben wir?" → answer: "Laut Lager habt ihr [X] Liter Milch." navigate: inventory
  "Was kochen wir heute?" → answer: "Heute stehen [Gericht1] und [Gericht2] auf dem Plan." navigate: menu
  "Muss ich was nachbestellen?" → answer: "${lowCount > 0 ? `Ja, ${lowCount} Artikel sind unter Mindestbestand.` : "Nein, der Lagerbestand ist in Ordnung."}" navigate: inventory
  "Was läuft gut?" → answer: "Die Statistik zeigt dir die meistverkauften Gerichte." navigate: stats
  "Wie war der Umsatz heute?" → answer: "Heute wurden bisher [X] Portionen verkauft." navigate: stats
  "Haben wir Veranstaltungen?" → answer: "Ja, demnächst [Titel] am [Datum]." navigate: more

Frage: "${question}"`.trim();

  return generateJson<KiosResponse>(prompt, SCHEMA_HINT);
}

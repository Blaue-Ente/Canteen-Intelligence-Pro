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

  // Suppliers count
  const supplierCount = state.suppliers.length;

  return [
    `Datum: ${today}`,
    `Heutige Karte: ${menuStr}`,
    `Lager (⚠=Nachbestellung nötig): ${inventoryLines}`,
    `Verkäufe (14 Tage): ${salesLines || "Keine Daten"}`,
    `Gespeicherte Lieferanten: ${supplierCount}`,
  ].join("\n");
}

const SCHEMA_HINT = '{"answer":"string","navigate":"inventory|stats|menu|home|chat|suppliers|producers|customers|more|null"}';

export async function askKios(question: string, state: AppState): Promise<KiosResponse> {
  const ctx = buildKitchenContext(state);

  const prompt = `\
Du bist "Kios", der smarte Küchen-Assistent von KitchenOS.
Deine Antworten sind SEHR kurz (1 Satz, max. 15 Wörter), auf Deutsch, für Sprachausgabe optimiert.
KEIN Markdown, keine Klammern, keine Listen — nur gesprochenes Deutsch.

Navigationsregeln (wähle das passende Ziel oder "null"):
  "inventory"  → Lager / Bestand / Vorräte anzeigen
  "stats"      → Statistik / Umsatz / Verkäufe / Absatz
  "menu"       → Speisekarte / Menüplan / Gerichte
  "home"       → Hauptseite / Übersicht / Startseite
  "chat"       → KI-Assistent / Chat / tiefere Fragen
  "suppliers"  → Lieferanten / Bestellungen
  "producers"  → Erzeuger / regionale Produzenten
  "customers"  → Kunden / Kundenbestellungen / Vorbestellungen
  "more"       → Einstellungen / Sonstiges
  "null"       → nur Antwort, keine Navigation

Aktueller Küchen-Status:
${ctx}

Beispiele für gute Antworten:
  Frage: "Wie viel Milch haben wir?" → answer: "Ihr habt 12 Liter Milch im Lager." navigate: "inventory"
  Frage: "Was kochen wir heute?" → answer: "Heute gibt es ${state.menu.length ? "laut Plan " : ""}${state.menu.find((m) => m.date === new Date().toISOString().slice(0, 10))?.recipeIds?.length ? "die geplanten Gerichte" : "noch nichts geplant"}." navigate: "menu"
  Frage: "Was läuft gut?" → answer: "Die meistverkauften Gerichte siehst du in der Statistik." navigate: "stats"
  Frage: "Muss ich was bestellen?" → answer: "Ja, ${state.inventory.filter((i) => i.quantity <= i.minQuantity).length} Artikel haben Mindestbestand erreicht." navigate: "inventory"

Frage: "${question}"`.trim();

  return generateJson<KiosResponse>(prompt, SCHEMA_HINT);
}

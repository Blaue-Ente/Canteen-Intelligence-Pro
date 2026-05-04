import { generateJson } from "@/lib/ai";
import type { AppState } from "@/types";

export interface KiosResponse {
  answer: string;
  navigate: "inventory" | "stats" | "menu" | "home" | "chat" | "null" | null;
}

export function buildKitchenContext(state: AppState): string {
  const today = new Date().toISOString().slice(0, 10);

  // Inventory — low stock first, max 25 items
  const inventoryLines = [...state.inventory]
    .sort((a, b) => {
      const aLow = a.quantity <= a.minQuantity ? 1 : 0;
      const bLow = b.quantity <= b.minQuantity ? 1 : 0;
      return bLow - aLow;
    })
    .slice(0, 25)
    .map((i) => {
      const name = i.nameDe || i.name;
      const low = i.quantity <= i.minQuantity ? " (NIEDRIG)" : "";
      return `${name}: ${i.quantity}${i.unit}${low}`;
    })
    .join(", ");

  // Today's menu
  const todayEntry = state.menu.find((m) => m.date === today);
  const menuStr = todayEntry
    ? todayEntry.recipeIds
        .map((id) => state.recipes.find((r) => r.id === id)?.nameDe ?? id)
        .join(", ")
    : "Kein Menü für heute geplant";

  // Last 14 days sales aggregated per recipe
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const salesMap = new Map<string, { sold: number; cooked: number }>();
  state.sales
    .filter((s) => s.date >= cutoff)
    .forEach((s) => {
      const prev = salesMap.get(s.recipeId) ?? { sold: 0, cooked: 0 };
      salesMap.set(s.recipeId, {
        sold: prev.sold + s.sold,
        cooked: prev.cooked + s.cooked,
      });
    });

  const salesLines = Array.from(salesMap.entries())
    .map(([id, v]) => {
      const name = state.recipes.find((r) => r.id === id)?.nameDe ?? id;
      return `${name}: ${v.sold} verk. / ${v.cooked} gek.`;
    })
    .slice(0, 15)
    .join(" | ");

  return [
    `Datum: ${today}`,
    `Heutige Karte: ${menuStr}`,
    `Lager: ${inventoryLines || "Kein Bestand"}`,
    `Verkäufe (14 Tage): ${salesLines || "Keine Daten"}`,
  ].join("\n");
}

export async function askKios(
  question: string,
  state: AppState,
): Promise<KiosResponse> {
  const context = buildKitchenContext(state);
  return generateJson<KiosResponse>(
    [
      `Du bist "Kios", der Sprach-Assistent von KItchenOS für die professionelle Küche.`,
      `Beantworte die Frage kurz auf Deutsch (1–2 Sätze, für Sprachausgabe optimiert, kein Markdown, keine Klammern).`,
      `Gib einen Navigations-Hinweis zurück wenn sinnvoll:`,
      `  "inventory" = Lager/Bestand fragen`,
      `  "stats"     = Verkäufe/Statistik anzeigen`,
      `  "menu"      = Karte/Menüplanung öffnen`,
      `  "home"      = Übersicht`,
      `  "chat"      = KI-Assistent öffnen`,
      `  "null"      = keine Navigation nötig`,
      ``,
      `Aktueller Küchen-Kontext:`,
      context,
      ``,
      `Frage: "${question}"`,
    ].join("\n"),
    '{"answer":"string","navigate":"inventory|stats|menu|home|chat|null"}',
  );
}

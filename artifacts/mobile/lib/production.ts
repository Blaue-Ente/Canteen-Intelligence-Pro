import type { Ingredient, InventoryItem, Locale, MenuDayEntry, Recipe } from "@/types";

/**
 * Production batch sheet planning.
 *
 * Apicbase-parity feature: from a date + menu + planned portion counts, build
 * a station-grouped checklist of ingredients to mise-en-place. Quantities are
 * yield-scaled (recipe defines per-portion grams; we multiply by planned count
 * and convert to the most ergonomic unit for the kitchen).
 */

export type Station = "kalt" | "warm" | "backerei" | "spuelkueche";

export const STATION_ORDER: readonly Station[] = ["kalt", "warm", "backerei", "spuelkueche"];

export const STATION_LABEL: Record<Station, { de: string; en: string }> = {
  kalt: { de: "Kalte Küche", en: "Cold prep" },
  warm: { de: "Warme Küche", en: "Hot line" },
  backerei: { de: "Bäckerei / Patisserie", en: "Bakery / pastry" },
  spuelkueche: { de: "Spülküche / Mise en place", en: "Dishwash / mise en place" },
};

/** Map a recipe to its primary prep station based on dish type + ingredients. */
export function stationFor(recipe: Recipe): Station {
  switch (recipe.type) {
    case "soup":
    case "main":
    case "side":
      return "warm";
    case "salad":
    case "drink":
      return "kalt";
    case "dessert":
      return "backerei";
    default:
      return "warm";
  }
}

export interface ScaledIngredient {
  inventoryId: string;
  name: string;
  /** Total grams needed for the planned portion count of this recipe. */
  totalGrams: number;
  /** Display-friendly quantity (kg if ≥ 1000g, otherwise g). */
  display: { value: number; unit: "g" | "kg" | "l" | "ml" | "pcs" };
}

export interface RecipeBatch {
  recipe: Recipe;
  station: Station;
  plannedCount: number;
  ingredients: ScaledIngredient[];
}

export interface ProductionPlan {
  date: string;
  totalPortions: number;
  byStation: Record<Station, RecipeBatch[]>;
  /** All recipes flat, in original menu order — useful for "no station" overview. */
  flat: RecipeBatch[];
}

function scaleIngredient(
  ing: Ingredient,
  recipePortionGrams: number,
  recipeServedGrams: number,
  plannedCount: number,
  inventory: InventoryItem[],
): ScaledIngredient {
  const inv = inventory.find((i) => i.id === ing.inventoryId);
  // Each portion uses `ing.grams * (servedGrams / recipePortionGrams)` of the ingredient.
  // Then multiply by planned cooked portions.
  const perPortion = ing.grams * (recipeServedGrams / recipePortionGrams);
  const totalGrams = perPortion * plannedCount;

  // Display in kg/l for liquids and bulk dry; pcs stays pcs; small grams stay g.
  const unit = inv?.unit ?? "g";
  let display: ScaledIngredient["display"];
  if (unit === "pcs") {
    display = { value: Math.ceil(totalGrams), unit: "pcs" };
  } else if (unit === "l" || unit === "kg") {
    display = { value: Math.round((totalGrams / 1000) * 100) / 100, unit };
  } else if (unit === "ml") {
    display = totalGrams >= 1000
      ? { value: Math.round((totalGrams / 1000) * 100) / 100, unit: "l" }
      : { value: Math.round(totalGrams), unit: "ml" };
  } else {
    display = totalGrams >= 1000
      ? { value: Math.round((totalGrams / 1000) * 100) / 100, unit: "kg" }
      : { value: Math.round(totalGrams), unit: "g" };
  }

  return {
    inventoryId: ing.inventoryId,
    name: inv ? inv.nameDe : ing.inventoryId,
    totalGrams,
    display,
  };
}

export function buildProductionPlan(
  date: string,
  menu: MenuDayEntry | undefined,
  recipes: Recipe[],
  inventory: InventoryItem[],
  /** Override planned counts (per recipeId). Falls back to menu.plannedCount or 0. */
  countOverrides?: Record<string, number>,
): ProductionPlan {
  const byStation: Record<Station, RecipeBatch[]> = {
    kalt: [],
    warm: [],
    backerei: [],
    spuelkueche: [],
  };
  const flat: RecipeBatch[] = [];
  let totalPortions = 0;

  if (!menu) return { date, totalPortions, byStation, flat };

  for (const recipeId of menu.recipeIds) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) continue;
    const plannedCount =
      countOverrides?.[recipeId] ??
      menu.plannedCount?.[recipeId] ??
      0;
    if (plannedCount <= 0) continue;

    const servedGrams = menu.portionOverrides?.[recipeId] ?? recipe.portionGrams;
    const station = stationFor(recipe);

    const batch: RecipeBatch = {
      recipe,
      station,
      plannedCount,
      ingredients: recipe.ingredients.map((ing) =>
        scaleIngredient(ing, recipe.portionGrams, servedGrams, plannedCount, inventory),
      ),
    };
    byStation[station].push(batch);
    flat.push(batch);
    totalPortions += plannedCount;
  }

  return { date, totalPortions, byStation, flat };
}

/**
 * Render a printable HTML page for the production sheet.
 * Designed for A4 portrait + monochrome printing in the kitchen.
 */
export function productionSheetHtml(plan: ProductionPlan, locale: Locale): string {
  const isDe = locale === "de";
  const t = (de: string, en: string) => (isDe ? de : en);
  const dateLabel = new Date(plan.date).toLocaleDateString(isDe ? "de-DE" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stationSection = (station: Station) => {
    const batches = plan.byStation[station];
    if (batches.length === 0) return "";
    const label = STATION_LABEL[station][isDe ? "de" : "en"];
    return `
      <section class="station">
        <h2>${label}</h2>
        ${batches.map((b) => `
          <div class="recipe">
            <h3>
              <span class="check"></span>
              ${escapeHtml(isDe ? b.recipe.nameDe : b.recipe.name)}
              <span class="count">× ${b.plannedCount} ${t("Portionen", "portions")}</span>
            </h3>
            <table>
              <thead>
                <tr>
                  <th class="ck"></th>
                  <th>${t("Zutat", "Ingredient")}</th>
                  <th class="qty">${t("Menge", "Quantity")}</th>
                </tr>
              </thead>
              <tbody>
                ${b.ingredients.map((ing) => `
                  <tr>
                    <td class="ck"><span class="check"></span></td>
                    <td>${escapeHtml(ing.name)}</td>
                    <td class="qty">${formatNum(ing.display.value)} ${ing.display.unit}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `).join("")}
      </section>
    `;
  };

  return `<!doctype html>
<html lang="${isDe ? "de" : "en"}">
<head>
  <meta charset="utf-8" />
  <title>${t("Produktionsplan", "Production sheet")} — ${dateLabel}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
    header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
    h1 { margin: 0 0 4px 0; font-size: 20pt; }
    .meta { font-size: 10pt; color: #555; }
    .station { margin-top: 18px; page-break-inside: avoid; }
    .station h2 { font-size: 13pt; background: #111; color: #fff; padding: 4px 10px; margin: 0 0 8px 0; }
    .recipe { margin: 10px 0 14px 0; page-break-inside: avoid; }
    .recipe h3 { font-size: 11pt; margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px; }
    .recipe h3 .count { color: #555; font-weight: 400; font-size: 10pt; margin-left: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #ddd; }
    th { background: #f4f4f4; font-weight: 600; font-size: 9pt; }
    .qty { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ck { width: 16px; }
    .check { display: inline-block; width: 12px; height: 12px; border: 1.4px solid #111; border-radius: 2px; vertical-align: middle; }
    footer { margin-top: 24px; font-size: 8pt; color: #888; border-top: 1px solid #ccc; padding-top: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>${t("Produktionsplan", "Production sheet")}</h1>
    <div class="meta">${dateLabel} · ${plan.totalPortions} ${t("Portionen geplant", "portions planned")}</div>
  </header>
  ${STATION_ORDER.map(stationSection).join("")}
  <footer>KitchenOS · ${new Date().toLocaleString(isDe ? "de-DE" : "en-US")}</footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

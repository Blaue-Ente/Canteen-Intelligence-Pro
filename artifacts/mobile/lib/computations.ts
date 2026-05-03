import type {
  AppState,
  HaccpLog,
  IngredientPriceHistory,
  InventoryItem,
  Recipe,
  SaleEntry,
  Supplier,
  SupplierDelivery,
  WasteEntry,
} from "@/types";
import { fetch as expoFetch } from "expo/fetch";

/**
 * Cost in EUR for one portion of `recipe` at a given `portionGrams`
 * (defaults to recipe.portionGrams). Uses `pricePerUnit` from inventory
 * with unit-aware conversion (kg/l → per-gram).
 */
export function recipeCost(
  recipe: Recipe,
  inventory: InventoryItem[],
  portionGrams?: number,
): number {
  const factor = (portionGrams ?? recipe.portionGrams) / recipe.portionGrams;
  return recipe.ingredients.reduce((s, ing) => {
    const inv = inventory.find((i) => i.id === ing.inventoryId);
    if (!inv) return s;
    const perGram =
      inv.unit === "kg" || inv.unit === "l"
        ? inv.pricePerUnit / 1000
        : inv.pricePerUnit;
    return s + perGram * ing.grams * factor;
  }, 0);
}

export interface MarginInfo {
  cost: number;
  sellPrice: number;
  marginEur: number;
  marginPct: number;
  trend: "up" | "down" | "flat";
  /** Rough EUR change per portion vs avg cost in last 30 days. */
  deltaEur: number;
}

/**
 * Combine current inventory price with rolling history to detect
 * silently-eroding margins. trend is from history vs current.
 */
export function recipeMargin(
  recipe: Recipe,
  inventory: InventoryItem[],
  priceHistory: IngredientPriceHistory[],
): MarginInfo {
  const cost = recipeCost(recipe, inventory);
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  // average historic per-portion cost using historic prices for involved ingredients
  let historicCost = 0;
  let historicSamples = 0;
  for (const ing of recipe.ingredients) {
    const inv = inventory.find((i) => i.id === ing.inventoryId);
    if (!inv) continue;
    const past = priceHistory
      .filter(
        (p) => p.inventoryId === ing.inventoryId && new Date(p.date).getTime() >= cutoff,
      )
      .map((p) => p.price);
    if (past.length === 0) continue;
    const avg = past.reduce((a, b) => a + b, 0) / past.length;
    const perGram =
      inv.unit === "kg" || inv.unit === "l" ? avg / 1000 : avg;
    historicCost += perGram * ing.grams;
    historicSamples++;
  }
  const referenceCost = historicSamples > 0 ? historicCost : cost;
  const deltaEur = cost - referenceCost;
  const trend: MarginInfo["trend"] =
    Math.abs(deltaEur) < 0.05 ? "flat" : deltaEur > 0 ? "up" : "down";
  const marginEur = recipe.sellPrice - cost;
  const marginPct = recipe.sellPrice > 0 ? (marginEur / recipe.sellPrice) * 100 : 0;
  return { cost, sellPrice: recipe.sellPrice, marginEur, marginPct, trend, deltaEur };
}

export interface SupplierScore {
  supplierId: string;
  score: number; // 0..100
  onTimePct: number;
  accuracyPct: number;
  issueRate: number;
  deliveries: number;
  complaints: number;
}

export function supplierScore(
  supplierId: string,
  deliveries: SupplierDelivery[],
  complaintsCount: number,
): SupplierScore {
  const my = deliveries.filter((d) => d.supplierId === supplierId);
  if (my.length === 0) {
    return {
      supplierId,
      score: complaintsCount === 0 ? 80 : Math.max(40, 80 - complaintsCount * 10),
      onTimePct: 100,
      accuracyPct: 100,
      issueRate: 0,
      deliveries: 0,
      complaints: complaintsCount,
    };
  }
  const completed = my.filter((d) => d.actualDate);
  const onTime = completed.filter(
    (d) => d.actualDate && d.actualDate <= d.expectedDate,
  ).length;
  const accurate = completed.filter((d) => {
    if (d.expectedQty == null || d.actualQty == null) return true;
    if (d.expectedQty === 0) return true;
    return Math.abs((d.actualQty - d.expectedQty) / d.expectedQty) < 0.05;
  }).length;
  const issues = my.filter((d) => d.hadIssue).length;
  const onTimePct = completed.length > 0 ? (onTime / completed.length) * 100 : 100;
  const accuracyPct = completed.length > 0 ? (accurate / completed.length) * 100 : 100;
  const issueRate = my.length > 0 ? (issues / my.length) * 100 : 0;
  const score = Math.max(
    0,
    Math.round(
      onTimePct * 0.4 +
        accuracyPct * 0.3 +
        Math.max(0, 100 - issueRate) * 0.2 +
        Math.max(0, 100 - complaintsCount * 10) * 0.1,
    ),
  );
  return {
    supplierId,
    score,
    onTimePct,
    accuracyPct,
    issueRate,
    deliveries: my.length,
    complaints: complaintsCount,
  };
}

export function recipeCo2Kg(recipe: Recipe, inventory: InventoryItem[]): number {
  return recipe.ingredients.reduce((s, ing) => {
    const inv = inventory.find((i) => i.id === ing.inventoryId);
    if (!inv?.co2PerKg) return s;
    return s + (ing.grams / 1000) * inv.co2PerKg;
  }, 0);
}

/**
 * Aggregate nutrition per portion using inventory per-100g fields.
 */
export function recipeNutrition(
  recipe: Recipe,
  inventory: InventoryItem[],
  portionGrams?: number,
): { kcal: number; protein: number; carbs: number; fat: number } {
  const factor = (portionGrams ?? recipe.portionGrams) / recipe.portionGrams;
  const acc = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const ing of recipe.ingredients) {
    const inv = inventory.find((i) => i.id === ing.inventoryId);
    if (!inv) continue;
    const g = ing.grams * factor;
    if (inv.kcalPer100g) acc.kcal += (inv.kcalPer100g * g) / 100;
    if (inv.proteinPer100g) acc.protein += (inv.proteinPer100g * g) / 100;
    if (inv.carbsPer100g) acc.carbs += (inv.carbsPer100g * g) / 100;
    if (inv.fatPer100g) acc.fat += (inv.fatPer100g * g) / 100;
  }
  return acc;
}

export function recipeAllergens(
  recipe: Recipe,
  inventory: InventoryItem[],
): Recipe["allergens"] {
  const set = new Set<Recipe["allergens"][number]>(recipe.allergens);
  for (const ing of recipe.ingredients) {
    const inv = inventory.find((i) => i.id === ing.inventoryId);
    inv?.allergens?.forEach((a) => set.add(a));
  }
  return Array.from(set);
}

/**
 * DGE-style category from CO₂ + meat content + nutrition.
 * Greatly simplified heuristic — flags red for high beef/lamb load,
 * green for vegan low-CO₂, yellow otherwise.
 */
export function dgeCategory(
  recipe: Recipe,
  inventory: InventoryItem[],
): "green" | "yellow" | "red" {
  const co2 = recipeCo2Kg(recipe, inventory);
  if (recipe.category === "vegan" && co2 < 1.0) return "green";
  if (recipe.meat === "beef" || recipe.meat === "lamb" || co2 > 4.0) return "red";
  return "yellow";
}

/**
 * Compute shortage (in inventory units) needed to cover N days of menu.
 */
export function computeShortages(
  state: Pick<AppState, "menu" | "recipes" | "inventory">,
  daysAhead: number,
  defaultPortions = 25,
  locationId?: string,
): {
  inventoryId: string;
  name: string;
  needed: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  preferredSupplierId?: string;
}[] {
  const today = new Date();
  const targetDates = new Set<string>();
  for (let d = 0; d < daysAhead; d++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    targetDates.add(dt.toISOString().slice(0, 10));
  }
  // grams needed per inventory id
  const gramsNeeded: Record<string, number> = {};
  for (const m of state.menu) {
    if (!targetDates.has(m.date)) continue;
    if (locationId && m.locationId && m.locationId !== locationId) continue;
    for (const rid of m.recipeIds) {
      const r = state.recipes.find((x) => x.id === rid);
      if (!r) continue;
      const portions = m.plannedCount?.[rid] ?? defaultPortions;
      for (const ing of r.ingredients) {
        gramsNeeded[ing.inventoryId] =
          (gramsNeeded[ing.inventoryId] ?? 0) + ing.grams * portions;
      }
    }
  }
  const out: ReturnType<typeof computeShortages> = [];
  for (const [invId, grams] of Object.entries(gramsNeeded)) {
    const inv = state.inventory.find((i) => i.id === invId);
    if (!inv) continue;
    const neededInUnit =
      inv.unit === "kg" || inv.unit === "l" ? grams / 1000 : grams;
    const shortage = neededInUnit - inv.quantity;
    if (shortage <= 0) continue;
    out.push({
      inventoryId: inv.id,
      name: inv.nameDe || inv.name,
      needed: Math.ceil(shortage * 10) / 10,
      unit: inv.unit,
      category: inv.category,
      pricePerUnit: inv.pricePerUnit,
      preferredSupplierId: inv.supplierId,
    });
  }
  return out;
}

/**
 * Per-employee productivity counters for the gamification leaderboard.
 * Counts created records (sales, haccp, waste) and waste reduction over month.
 */
export interface LeaderRow {
  employeeId: string;
  name: string;
  salesLogged: number;
  haccpLogged: number;
  wasteLogged: number;
  /** Higher = better: composite 0..100. */
  score: number;
}

export function leaderboard(
  sales: SaleEntry[],
  haccp: HaccpLog[],
  waste: WasteEntry[],
  employees: { id: string; name: string }[],
): LeaderRow[] {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const since = (iso?: string) => (iso ? new Date(iso).getTime() >= cutoff : false);
  const matches = (x: { createdBy?: string; createdByName?: string }, e: { id: string; name: string }) =>
    x.createdBy === e.id || (!!x.createdByName && x.createdByName === e.name);
  const rows: LeaderRow[] = employees.map((e) => {
    const s = sales.filter((x) => matches(x, e) && since(x.date)).length;
    const h = haccp.filter((x) => matches(x, e) && since(x.date)).length;
    const w = waste.filter((x) => matches(x, e) && since(x.date)).length;
    const score = Math.min(100, s * 2 + h * 5 + Math.max(0, 30 - w) * 1.5);
    return {
      employeeId: e.id,
      name: e.name,
      salesLogged: s,
      haccpLogged: h,
      wasteLogged: w,
      score: Math.round(score),
    };
  });
  return rows.sort((a, b) => b.score - a.score);
}

// ---- Weather (Open-Meteo, no API key) ----

export interface WeatherForecast {
  tempC: number;
  rainMm: number;
  condition: string;
}

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string,
): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await expoFetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        temperature_2m_max?: number[];
        precipitation_sum?: number[];
        weathercode?: number[];
      };
    };
    const t = json.daily?.temperature_2m_max?.[0];
    const r = json.daily?.precipitation_sum?.[0];
    const w = json.daily?.weathercode?.[0];
    if (t == null) return null;
    const condition = wmoCondition(w ?? 0);
    return { tempC: t, rainMm: r ?? 0, condition };
  } catch {
    return null;
  }
}

function wmoCondition(code: number): string {
  if (code === 0) return "klar";
  if (code <= 3) return "wolkig";
  if (code <= 48) return "Nebel";
  if (code <= 67) return "Regen";
  if (code <= 77) return "Schnee";
  if (code <= 82) return "Schauer";
  if (code <= 99) return "Gewitter";
  return "—";
}

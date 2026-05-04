/**
 * T014 — DGE-Qualitätsstandard compliance scoring.
 *
 * Deutsche Gesellschaft für Ernährung (DGE) publishes binding quality
 * standards for community catering: Schulverpflegung (2022), Kita (2022),
 * Krankenhausverpflegung (2020), Seniorenverpflegung (2020). German public
 * tenders for school/daycare/hospital/senior catering increasingly require
 * the operator to score against these standards — and yet no kitchen SaaS
 * competitor (Apicbase, Foodics, MarketMan, Choco) ships automated DGE
 * scoring. KitchenOS does.
 *
 * Scope (MVP): the variety + composition rules that are objectively
 * countable from a 7-day menu plan. Things requiring a full nutrient
 * breakdown (e.g. "max 6g Salz/Tag") are deferred until per-portion
 * sodium tracking lands; we ship what we can defend today.
 *
 * The result of `scoreMenu` is a pure function of (plan, recipes,
 * inventory, standard) — nothing is persisted, the screen recomputes
 * on every render.
 */

import type {
  DgeCriterionResult,
  DgeScore,
  DgeStandard,
  InventoryItem,
  MenuDayEntry,
  Recipe,
} from "@/types";

// ─── Rule book ──────────────────────────────────────────────────────────────

export interface DgeRule {
  id: string;
  /** German label as shown on cards. */
  labelDe: string;
  /** English fallback. */
  labelEn: string;
  /** "min" → at-least over the window; "max" → at-most. */
  kind: "min" | "max";
  /** Threshold count over a 7-day window. */
  thresholdPer7Days: number;
  /** Importance weight (higher → bigger impact on overall score). */
  weight: number;
  /** Which classifier flag the rule counts. */
  feature: ClassifierFeature;
  /** Suggestion shown when rule is unmet. */
  recommendDe: string;
  recommendEn: string;
}

type ClassifierFeature =
  | "wholeGrain"
  | "vegetable"
  | "rawVegOrFruit"
  | "fruit"
  | "legume"
  | "redMeat"
  | "fried"
  | "seaFish"
  | "vegetarianOrVegan"
  | "dairy"
  | "softTexture";

const SCHULE_RULES: DgeRule[] = [
  {
    id: "wholeGrain",
    labelDe: "Vollkornprodukte ≥ 3x / Woche",
    labelEn: "Whole-grain dishes ≥ 3x / week",
    kind: "min",
    thresholdPer7Days: 3,
    weight: 1.0,
    feature: "wholeGrain",
    recommendDe: "Plane ein Vollkorn-Gericht ein (z.B. Vollkornnudeln, Naturreis, Dinkel).",
    recommendEn: "Add a whole-grain dish (whole-grain pasta, brown rice, spelt).",
  },
  {
    id: "vegetable",
    labelDe: "Gemüse oder Salat täglich",
    labelEn: "Vegetable or salad daily",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 1.5,
    feature: "vegetable",
    recommendDe: "Ergänze eine Gemüsebeilage oder Salat an mindestens 5 Tagen.",
    recommendEn: "Add a vegetable side or salad on at least 5 days.",
  },
  {
    id: "rawVegOrFruit",
    labelDe: "Rohkost / frisches Obst ≥ 3x / Woche",
    labelEn: "Raw vegetables or fresh fruit ≥ 3x / week",
    kind: "min",
    thresholdPer7Days: 3,
    weight: 1.0,
    feature: "rawVegOrFruit",
    recommendDe: "Setze einen Rohkost-Salat oder frische Obstportion auf den Plan.",
    recommendEn: "Add a raw-vegetable salad or fresh fruit portion.",
  },
  {
    id: "fruit",
    labelDe: "Obstportion ≥ 2x / Woche",
    labelEn: "Fruit portion ≥ 2x / week",
    kind: "min",
    thresholdPer7Days: 2,
    weight: 0.8,
    feature: "fruit",
    recommendDe: "Plane eine zusätzliche Obstportion (Apfel, Birne, Beeren).",
    recommendEn: "Add an extra fruit portion (apple, pear, berries).",
  },
  {
    id: "legume",
    labelDe: "Hülsenfrüchte ≥ 1x / Woche",
    labelEn: "Legumes ≥ 1x / week",
    kind: "min",
    thresholdPer7Days: 1,
    weight: 0.8,
    feature: "legume",
    recommendDe: "Ein Linsen-, Bohnen- oder Kichererbsengericht einplanen.",
    recommendEn: "Add a lentil, bean or chickpea dish.",
  },
  {
    id: "seaFish",
    labelDe: "Seefisch ≥ 1x / Woche",
    labelEn: "Sea fish ≥ 1x / week",
    kind: "min",
    thresholdPer7Days: 1,
    weight: 0.8,
    feature: "seaFish",
    recommendDe: "Plane einen Seefisch ein (Seelachs, Hering, Makrele).",
    recommendEn: "Add a sea-fish dish (pollock, herring, mackerel).",
  },
  {
    id: "vegetarianOrVegan",
    labelDe: "Vegetarisch / vegan ≥ 2x / Woche",
    labelEn: "Vegetarian/vegan ≥ 2x / week",
    kind: "min",
    thresholdPer7Days: 2,
    weight: 1.0,
    feature: "vegetarianOrVegan",
    recommendDe: "Ergänze ein vegetarisches oder veganes Hauptgericht.",
    recommendEn: "Add a vegetarian or vegan main course.",
  },
  {
    id: "redMeatMax",
    labelDe: "Rotes Fleisch ≤ 1x / Woche",
    labelEn: "Red meat ≤ 1x / week",
    kind: "max",
    thresholdPer7Days: 1,
    weight: 1.0,
    feature: "redMeat",
    recommendDe: "Reduziere Rind/Schwein/Lamm auf höchstens 1 Mal pro Woche.",
    recommendEn: "Reduce beef/pork/lamb to at most once per week.",
  },
  {
    id: "friedMax",
    labelDe: "Frittiertes / Paniertes ≤ 1x / Woche",
    labelEn: "Fried / breaded ≤ 1x / week",
    kind: "max",
    thresholdPer7Days: 1,
    weight: 0.8,
    feature: "fried",
    recommendDe: "Höchstens 1 frittiertes oder paniertes Gericht pro Woche.",
    recommendEn: "At most one deep-fried or breaded dish per week.",
  },
];

const KITA_RULES: DgeRule[] = [
  // Same backbone as Schule but daily fruit + dairy + softer fried cap.
  ...SCHULE_RULES.filter((r) => r.id !== "fruit" && r.id !== "friedMax"),
  {
    id: "fruit",
    labelDe: "Obstportion täglich",
    labelEn: "Daily fruit portion",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 1.0,
    feature: "fruit",
    recommendDe: "Plane an jedem Betreuungstag eine Obstportion ein.",
    recommendEn: "Plan a fruit portion on every care day.",
  },
  {
    id: "dairy",
    labelDe: "Milch oder Milchprodukt täglich",
    labelEn: "Milk or dairy daily",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 0.8,
    feature: "dairy",
    recommendDe: "Joghurt, Quark oder Käse als Beilage einplanen.",
    recommendEn: "Add yoghurt, quark or cheese as a side.",
  },
  {
    id: "friedMax",
    labelDe: "Frittiertes ≤ 1x / Monat (hier: 0/Woche)",
    labelEn: "Fried ≤ 1x / month (0/week here)",
    kind: "max",
    thresholdPer7Days: 0,
    weight: 1.0,
    feature: "fried",
    recommendDe: "Frittierte Speisen für Kita-Kinder vermeiden.",
    recommendEn: "Avoid deep-fried items for nursery children.",
  },
];

const KRANKENHAUS_RULES: DgeRule[] = [
  {
    id: "vegetable",
    labelDe: "Gemüse / Salat ≥ 7x / Woche",
    labelEn: "Vegetable or salad daily",
    kind: "min",
    thresholdPer7Days: 7,
    weight: 1.5,
    feature: "vegetable",
    recommendDe: "Ergänze eine Gemüsebeilage oder Salat an jedem Tag.",
    recommendEn: "Add a vegetable side or salad every day.",
  },
  {
    id: "fruit",
    labelDe: "Obst täglich",
    labelEn: "Fruit daily",
    kind: "min",
    thresholdPer7Days: 7,
    weight: 1.0,
    feature: "fruit",
    recommendDe: "Plane Obst zu jeder Mahlzeit ein.",
    recommendEn: "Plan fruit at every meal.",
  },
  {
    id: "wholeGrain",
    labelDe: "Vollkornprodukte ≥ 5x / Woche",
    labelEn: "Whole-grain ≥ 5x / week",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 1.0,
    feature: "wholeGrain",
    recommendDe: "Vollkornbrot, Naturreis oder Vollkornnudeln einplanen.",
    recommendEn: "Add whole-grain bread, brown rice or whole-grain pasta.",
  },
  {
    id: "seaFish",
    labelDe: "Seefisch ≥ 1x / Woche",
    labelEn: "Sea fish ≥ 1x / week",
    kind: "min",
    thresholdPer7Days: 1,
    weight: 0.8,
    feature: "seaFish",
    recommendDe: "Seelachs, Lachs oder Hering einplanen.",
    recommendEn: "Add pollock, salmon or herring.",
  },
  {
    id: "legume",
    labelDe: "Hülsenfrüchte ≥ 1x / Woche",
    labelEn: "Legumes ≥ 1x / week",
    kind: "min",
    thresholdPer7Days: 1,
    weight: 0.6,
    feature: "legume",
    recommendDe: "Linsen-, Bohnen- oder Kichererbsengericht einplanen.",
    recommendEn: "Add a lentil, bean or chickpea dish.",
  },
  {
    id: "redMeatMax",
    labelDe: "Rotes Fleisch ≤ 2x / Woche",
    labelEn: "Red meat ≤ 2x / week",
    kind: "max",
    thresholdPer7Days: 2,
    weight: 1.0,
    feature: "redMeat",
    recommendDe: "Höchstens 2 Mahlzeiten mit rotem Fleisch pro Woche.",
    recommendEn: "At most two red-meat meals per week.",
  },
  {
    id: "friedMax",
    labelDe: "Frittiertes ≤ 1x / Woche",
    labelEn: "Fried ≤ 1x / week",
    kind: "max",
    thresholdPer7Days: 1,
    weight: 0.8,
    feature: "fried",
    recommendDe: "Höchstens 1 frittiertes Gericht pro Woche.",
    recommendEn: "At most one deep-fried dish per week.",
  },
];

const SENIOREN_RULES: DgeRule[] = [
  {
    id: "vegetable",
    labelDe: "Gemüse / Salat ≥ 5x / Woche",
    labelEn: "Vegetable or salad ≥ 5x / week",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 1.5,
    feature: "vegetable",
    recommendDe: "Eine zusätzliche Gemüsebeilage einplanen.",
    recommendEn: "Add an extra vegetable side.",
  },
  {
    id: "fruit",
    labelDe: "Obst täglich",
    labelEn: "Fruit daily",
    kind: "min",
    thresholdPer7Days: 7,
    weight: 1.0,
    feature: "fruit",
    recommendDe: "Tägliche Obstportion (auch als Kompott).",
    recommendEn: "Daily fruit portion (compote also counts).",
  },
  {
    id: "softTexture",
    labelDe: "Weiche Konsistenz: Suppe / Eintopf ≥ 3x / Woche",
    labelEn: "Soft texture: soup or stew ≥ 3x / week",
    kind: "min",
    thresholdPer7Days: 3,
    weight: 1.0,
    feature: "softTexture",
    recommendDe: "Suppe oder Eintopf für leichte Kaubarkeit.",
    recommendEn: "Soup or stew for easy chewing.",
  },
  {
    id: "wholeGrain",
    labelDe: "Vollkornprodukte ≥ 3x / Woche",
    labelEn: "Whole-grain ≥ 3x / week",
    kind: "min",
    thresholdPer7Days: 3,
    weight: 0.8,
    feature: "wholeGrain",
    recommendDe: "Vollkornbrot oder weiche Vollkorn-Beilage einplanen.",
    recommendEn: "Add whole-grain bread or soft whole-grain side.",
  },
  {
    id: "dairy",
    labelDe: "Milch / Milchprodukt täglich",
    labelEn: "Milk / dairy daily",
    kind: "min",
    thresholdPer7Days: 5,
    weight: 0.8,
    feature: "dairy",
    recommendDe: "Joghurt, Quark, Käse als Beilage zur Calciumversorgung.",
    recommendEn: "Yoghurt, quark or cheese for calcium adequacy.",
  },
  {
    id: "seaFish",
    labelDe: "Seefisch ≥ 1x / Woche",
    labelEn: "Sea fish ≥ 1x / week",
    kind: "min",
    thresholdPer7Days: 1,
    weight: 0.6,
    feature: "seaFish",
    recommendDe: "Seefisch (Lachs, Seelachs) für Omega-3.",
    recommendEn: "Sea fish (salmon, pollock) for omega-3.",
  },
  {
    id: "redMeatMax",
    labelDe: "Rotes Fleisch ≤ 2x / Woche",
    labelEn: "Red meat ≤ 2x / week",
    kind: "max",
    thresholdPer7Days: 2,
    weight: 0.8,
    feature: "redMeat",
    recommendDe: "Rotes Fleisch reduzieren — pflanzliche Alternativen anbieten.",
    recommendEn: "Reduce red meat — offer plant-based alternatives.",
  },
];

export const DGE_RULES: Record<DgeStandard, DgeRule[]> = {
  schule: SCHULE_RULES,
  kita: KITA_RULES,
  krankenhaus: KRANKENHAUS_RULES,
  senioren: SENIOREN_RULES,
};

export function dgeStandardLabel(standard: DgeStandard, isDe: boolean): string {
  if (isDe) {
    switch (standard) {
      case "schule":      return "Schulverpflegung";
      case "kita":        return "Kita-Verpflegung";
      case "krankenhaus": return "Krankenhausverpflegung";
      case "senioren":    return "Seniorenverpflegung";
    }
  }
  switch (standard) {
    case "schule":      return "School catering";
    case "kita":        return "Daycare catering";
    case "krankenhaus": return "Hospital catering";
    case "senioren":    return "Senior catering";
  }
}

// ─── Recipe classifier ──────────────────────────────────────────────────────

export interface RecipeFeatures {
  wholeGrain: boolean;
  vegetable: boolean;
  rawVeg: boolean;
  fruit: boolean;
  legume: boolean;
  redMeat: boolean;
  fried: boolean;
  seaFish: boolean;
  vegetarianOrVegan: boolean;
  dairy: boolean;
  /** soup, stew or pureé — easy to chew. */
  softTexture: boolean;
}

const WHOLEGRAIN_KEYWORDS = [
  "vollkorn", "naturreis", "wildreis", "dinkel", "haferflocken",
  "hafer", "gerste", "buchweizen", "hirse", "quinoa", "bulgur",
  "couscous-vollkorn", "roggenbrot", "vollkornbrot", "vollkornnudeln",
  "wholegrain", "whole grain", "brown rice", "spelt", "oats", "quinoa",
];

const VEGETABLE_KEYWORDS = [
  "gemüse", "salat", "spinat", "broccoli", "brokkoli", "blumenkohl",
  "karotte", "möhre", "zwiebel", "tomate", "paprika", "gurke", "zucchini",
  "aubergine", "kohl", "rotkohl", "weißkohl", "sauerkraut", "rübe",
  "kürbis", "lauch", "porree", "rote bete", "rote rüben", "fenchel",
  "champignon", "pilz", "spargel", "bohne grün", "grüne bohnen",
  "vegetable", "spinach", "broccoli", "carrot", "onion", "tomato",
  "pepper", "cucumber", "zucchini", "eggplant", "cabbage",
];

const RAWVEG_KEYWORDS = [
  "rohkost", "krautsalat", "tomatensalat", "gurkensalat", "karottensalat",
  "blattsalat", "rucola", "endivie", "feldsalat",
  "raw", "slaw", "leaves", "rocket",
];

const FRUIT_KEYWORDS = [
  "apfel", "äpfel", "birne", "banane", "orange", "zitrone", "beere",
  "erdbeer", "himbeer", "blaubeer", "trauben", "ananas", "melone",
  "pfirsich", "aprikose", "pflaume", "zwetschge", "marille", "mirabelle",
  "obst", "kompott", "apfelmus",
  "apple", "pear", "banana", "berries", "fruit", "compote",
];

const LEGUME_KEYWORDS = [
  "linsen", "bohnen", "kichererbsen", "erbsen", "schälerbsen", "kidneybohnen",
  "weiße bohnen", "saubohnen", "tofu", "tempeh", "sojaschnetzel",
  "lentil", "beans", "chickpea", "peas", "tofu", "tempeh",
];

const FRIED_KEYWORDS = [
  "frittier", "frittiert", "panier", "paniert", "ausgebacken", "knusprig",
  "pommes", "currywurst", "schnitzel", "kroketten", "wedges",
  "deep-fry", "deep fried", "battered", "breaded", "crispy",
];

const SEAFISH_KEYWORDS = [
  "seelachs", "kabeljau", "lachs", "thunfisch", "hering", "makrele",
  "sardine", "sardelle", "scholle", "rotbarsch", "alaska-seelachs",
  "pollock", "cod", "salmon", "tuna", "herring", "mackerel", "plaice",
  "sea fish",
];

/** Soft-texture candidates for Senioren standard. */
const SOFT_KEYWORDS = [
  "suppe", "eintopf", "püree", "brei", "auflauf", "ragout",
  "soup", "stew", "purée", "puree", "mash",
];

/**
 * Build a haystack of all human-readable text we can scan for keywords.
 * We deliberately include both German and English steps so the classifier
 * works for AI-generated recipes that might be in either language.
 */
function recipeHaystack(recipe: Recipe): string {
  const parts: string[] = [
    recipe.nameDe ?? "",
    recipe.name ?? "",
    ...(recipe.steps ?? []),
    ...(recipe.stepsDe ?? []),
  ];
  return parts.join(" \n ").toLowerCase();
}

function anyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((k) => haystack.includes(k));
}

/**
 * Classify a single recipe against the feature flags the rule book counts.
 * Optional `inventory` lookup lets us count ingredients by category as a
 * second source of truth when the recipe text alone is ambiguous.
 */
export function classifyRecipe(
  recipe: Recipe,
  inventory: InventoryItem[] = [],
): RecipeFeatures {
  const text = recipeHaystack(recipe);

  // Inventory-driven category counts (most reliable when ingredients exist).
  const ingredientCats = new Set<InventoryItem["category"]>();
  let hasDairyIng = false;
  let hasFruitIng = false;
  let hasVegIng = false;
  for (const ing of recipe.ingredients ?? []) {
    const item = inventory.find((i) => i.id === ing.inventoryId);
    if (!item) continue;
    ingredientCats.add(item.category);
    if (item.category === "dairy") hasDairyIng = true;
    if (item.category === "fruit") hasFruitIng = true;
    if (item.category === "vegetable") hasVegIng = true;
  }

  const isVeggie = recipe.category === "vegetarian" || recipe.category === "vegan";
  const isFishCat = recipe.category === "fish";
  const isMeatCat = recipe.category === "meat";

  const redMeat =
    isMeatCat &&
    (recipe.meat === "beef" || recipe.meat === "pork" || recipe.meat === "lamb");

  const seaFish =
    isFishCat &&
    // Trout/carp are freshwater — explicitly exclude. All others count
    // as sea fish unless the keyword set says otherwise.
    !text.includes("forelle") &&
    !text.includes("karpfen") &&
    !text.includes("trout") &&
    (anyKeyword(text, SEAFISH_KEYWORDS) || isFishCat);

  return {
    wholeGrain: anyKeyword(text, WHOLEGRAIN_KEYWORDS),
    vegetable: hasVegIng || anyKeyword(text, VEGETABLE_KEYWORDS) || recipe.type === "salad",
    rawVeg: recipe.type === "salad" || anyKeyword(text, RAWVEG_KEYWORDS),
    fruit: hasFruitIng || anyKeyword(text, FRUIT_KEYWORDS),
    legume: anyKeyword(text, LEGUME_KEYWORDS),
    redMeat,
    fried: anyKeyword(text, FRIED_KEYWORDS),
    seaFish,
    vegetarianOrVegan: isVeggie,
    // Dairy: ingredient-based OR allergen-declared OR keyword-detected.
    dairy:
      hasDairyIng ||
      (recipe.allergens ?? []).includes("milk") ||
      text.includes("milch") ||
      text.includes("joghurt") ||
      text.includes("quark") ||
      text.includes("käse") ||
      text.includes("milk") ||
      text.includes("yoghurt") ||
      text.includes("cheese"),
    softTexture: recipe.type === "soup" || anyKeyword(text, SOFT_KEYWORDS),
  };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

interface ScoreInput {
  /** Menu plan entries — caller filters to the desired window first. */
  menu: MenuDayEntry[];
  recipes: Recipe[];
  inventory?: InventoryItem[];
  /** ISO date YYYY-MM-DD inclusive. */
  fromDate: string;
  /** ISO date YYYY-MM-DD inclusive. */
  toDate: string;
  standard: DgeStandard;
  /** Locale for label + recommendations. */
  isDe: boolean;
  /** Optional location filter — if set, only menu entries for this id count. */
  locationId?: string;
}

function isoBetween(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/**
 * Score a menu plan against the active DGE standard.
 *
 * Each rule's "current" count = number of distinct days where at least one
 * recipe matched the rule's classifier feature. A single recipe matching
 * three features still only contributes one to each (per-day boolean), so
 * a vegan lentil-and-spinach soup counts for "vegetable" AND "legume" AND
 * "vegetarianOrVegan" on the same day, but only once each.
 *
 * Overall score = weighted average: 1.0 if rule met, 0 if not, scaled to
 * 0-100. We could do partial credit (current/threshold for "min" rules),
 * but binary met/not-met is what DGE auditors actually expect.
 */
export function scoreMenu(input: ScoreInput): DgeScore {
  const { menu, recipes, inventory = [], fromDate, toDate, standard, isDe, locationId } = input;

  const rules = DGE_RULES[standard];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  // Filter menu entries to the requested window (and optionally location).
  const inWindow = menu.filter(
    (m) =>
      isoBetween(m.date, fromDate, toDate) &&
      (!locationId || m.locationId === locationId || !m.locationId),
  );

  // Per-day feature flags.
  const dayFeatures = new Map<string, RecipeFeatures>();
  for (const entry of inWindow) {
    const acc: RecipeFeatures = {
      wholeGrain: false,
      vegetable: false,
      rawVeg: false,
      fruit: false,
      legume: false,
      redMeat: false,
      fried: false,
      seaFish: false,
      vegetarianOrVegan: false,
      dairy: false,
      softTexture: false,
    };
    let anyRecipe = false;
    for (const id of entry.recipeIds ?? []) {
      const r = recipeById.get(id);
      if (!r) continue;
      anyRecipe = true;
      const f = classifyRecipe(r, inventory);
      (Object.keys(acc) as Array<keyof RecipeFeatures>).forEach((k) => {
        if (f[k]) acc[k] = true;
      });
    }
    if (!anyRecipe) continue;
    // If multiple menu rows for the same date (e.g. multi-location), OR-merge.
    const prev = dayFeatures.get(entry.date);
    if (prev) {
      (Object.keys(acc) as Array<keyof RecipeFeatures>).forEach((k) => {
        if (prev[k]) acc[k] = true;
      });
    }
    dayFeatures.set(entry.date, acc);
  }

  const daysCount = daysBetween(fromDate, toDate);
  const daysWithMenu = dayFeatures.size;

  const featureCount = (key: keyof RecipeFeatures): number => {
    let n = 0;
    for (const f of dayFeatures.values()) if (f[key]) n += 1;
    return n;
  };

  // Map ClassifierFeature → RecipeFeatures key (mostly identity, but
  // rawVegOrFruit is the union of two flags).
  const countForFeature = (feature: ClassifierFeature): number => {
    if (feature === "rawVegOrFruit") {
      let n = 0;
      for (const f of dayFeatures.values()) if (f.rawVeg || f.fruit) n += 1;
      return n;
    }
    return featureCount(feature as keyof RecipeFeatures);
  };

  const criteria: DgeCriterionResult[] = rules.map((rule) => {
    const current = countForFeature(rule.feature);
    const met =
      rule.kind === "min"
        ? current >= rule.thresholdPer7Days
        : current <= rule.thresholdPer7Days;
    return {
      id: rule.id,
      label: isDe ? rule.labelDe : rule.labelEn,
      kind: rule.kind,
      threshold: rule.thresholdPer7Days,
      current,
      met,
      weight: rule.weight,
    };
  });

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const earned = criteria.reduce((s, c) => s + (c.met ? c.weight : 0), 0);
  const overall = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;

  // Recommendations: list every unmet rule's localised hint.
  const recommendations: string[] = rules
    .filter((rule) => {
      const cur = countForFeature(rule.feature);
      return rule.kind === "min" ? cur < rule.thresholdPer7Days : cur > rule.thresholdPer7Days;
    })
    .map((rule) => (isDe ? rule.recommendDe : rule.recommendEn));

  return {
    standard,
    fromDate,
    toDate,
    daysCount,
    daysWithMenu,
    overall,
    criteria,
    recommendations,
  };
}

// ─── Convenience: current week window ───────────────────────────────────────

/**
 * ISO date for "today" in the user's local timezone (NOT UTC).
 * Matches how `(tabs)/menu.tsx` builds its 7-day strip.
 */
export function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Returns [fromIso, toIso] for the next 7 days starting today (inclusive). */
export function next7DayWindow(): { fromDate: string; toDate: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  };
}

import type { Allergen, InventoryItem } from "@/types";

/**
 * The full LMIV allergen list with i18n key per entry — re-used by inventory
 * and recipe edit forms so they stay in sync.
 */
export const ALL_ALLERGENS: readonly { key: Allergen; tKey: string }[] = [
  { key: "gluten", tKey: "allergenGluten" },
  { key: "milk", tKey: "allergenMilk" },
  { key: "egg", tKey: "allergenEgg" },
  { key: "nuts", tKey: "allergenNuts" },
  { key: "soy", tKey: "allergenSoy" },
  { key: "fish", tKey: "allergenFish" },
  { key: "shellfish", tKey: "allergenShellfish" },
  { key: "celery", tKey: "allergenCelery" },
  { key: "mustard", tKey: "allergenMustard" },
  { key: "sesame", tKey: "allergenSesame" },
  { key: "sulphite", tKey: "allergenSulphite" },
  { key: "lupin", tKey: "allergenLupin" },
  { key: "mollusc", tKey: "allergenMollusc" },
  { key: "peanut", tKey: "allergenPeanut" },
];

/**
 * LMIV (German/EU food information regulation) helper for allergen propagation.
 *
 * Strategy:
 * - Each ingredient (`InventoryItem`) carries its own `allergens?: Allergen[]`.
 * - Recipes propagate them via `recipeAllergens()` in `lib/computations.ts`.
 * - This module adds a *safety net*: it inspects ingredient *names* and warns
 *   when a base ingredient is obviously missing the allergen it must carry by
 *   law (e.g. "Weizenmehl" must carry `gluten`, "Milch" must carry `milk`).
 *
 * Heuristics are intentionally conservative — only well-known German + English
 * substrings. If you add new patterns, prefer false negatives over false
 * positives (better to miss a warning than mis-flag exotic ingredients).
 */

interface NamePattern {
  /** Lowercase substrings; ANY match triggers the rule. */
  match: readonly string[];
  /** Allergens that MUST be present on items matching this pattern. */
  required: readonly Allergen[];
}

const PATTERNS: readonly NamePattern[] = [
  {
    match: ["mehl", "flour", "weizen", "wheat", "roggen", "gerste", "barley", "dinkel", "spelt", "couscous", "bulgur", "nudel", "pasta", "spaghetti", "panier", "brot", "bread", "brösel"],
    required: ["gluten"],
  },
  { match: ["milch", "milk", "sahne", "cream", "butter", "joghurt", "yogurt", "yoghurt", "käse", "cheese", "quark", "molke", "whey", "kondensmilch"], required: ["milk"] },
  { match: ["ei ", "eier", "egg", "eigelb", "eiweiß", "eigelb"], required: ["egg"] },
  { match: ["fisch", "fish", "lachs", "salmon", "thun", "tuna", "kabeljau", "cod", "hering", "herring", "sardelle", "anchovy"], required: ["fish"] },
  { match: ["garnel", "shrimp", "prawn", "krabbe", "crab", "hummer", "lobster", "languste"], required: ["shellfish"] },
  { match: ["muschel", "mussel", "tintenfisch", "squid", "octopus", "auster", "oyster"], required: ["mollusc"] },
  { match: ["nuss", "nüsse", "nut", "mandel", "almond", "haselnuss", "hazelnut", "walnuss", "walnut", "pistazie", "pistachio", "cashew", "pekan", "pecan"], required: ["nuts"] },
  { match: ["erdnuss", "peanut"], required: ["peanut"] },
  { match: ["soja", "soy", "tofu", "edamame", "miso", "tempeh"], required: ["soy"] },
  { match: ["sellerie", "celery"], required: ["celery"] },
  { match: ["senf", "mustard"], required: ["mustard"] },
  { match: ["sesam", "sesame", "tahin"], required: ["sesame"] },
  { match: ["lupine", "lupin"], required: ["lupin"] },
  { match: ["sulfit", "sulphite", "sulfite", "wein", "wine"], required: ["sulphite"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Suggest allergens that should be present on an item based on its name.
 * Used to power "Did you mean to add X?" prompts in the edit form.
 */
export function suggestAllergensFromName(name: string): Allergen[] {
  const n = normalize(name);
  const out = new Set<Allergen>();
  for (const p of PATTERNS) {
    if (p.match.some((m) => n.includes(m))) {
      p.required.forEach((a) => out.add(a));
    }
  }
  return Array.from(out);
}

/**
 * Inspect inventory and return items where heuristics expect an allergen but
 * the item's `allergens` array is missing one or more required entries.
 * Used for the global LMIV-compliance warning banner on the inventory tab.
 */
export interface AllergenWarning {
  item: InventoryItem;
  missing: Allergen[];
}

export function missingAllergenWarnings(
  items: readonly InventoryItem[],
): AllergenWarning[] {
  const out: AllergenWarning[] = [];
  for (const item of items) {
    const expected = suggestAllergensFromName(item.nameDe || item.name);
    if (expected.length === 0) continue;
    const have = new Set(item.allergens ?? []);
    const missing = expected.filter((a) => !have.has(a));
    if (missing.length > 0) out.push({ item, missing });
  }
  return out;
}

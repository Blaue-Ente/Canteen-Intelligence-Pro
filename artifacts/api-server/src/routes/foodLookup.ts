import { Router } from "express";

const router = Router();

// Simple in-memory cache: barcode → { data, fetchedAt }
const CACHE = new Map<string, { data: FoodProduct; fetchedAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 h

export interface FoodProduct {
  barcode: string;
  name: string;
  nameDe?: string;
  brand?: string;
  nutriScore?: "a" | "b" | "c" | "d" | "e";
  kcalPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  saltPer100g?: number;
  allergens: string[];
  imageUrl?: string;
  quantity?: string;
  categories: string[];
  countries: string[];
}

function normalize(barcode: string, raw: Record<string, unknown>): FoodProduct {
  const product = (raw["product"] ?? {}) as Record<string, unknown>;
  const nutriments = (product["nutriments"] ?? {}) as Record<string, unknown>;

  // allergens_tags look like ["en:gluten", "en:milk"] — strip prefix
  const allergenTags = (product["allergens_tags"] as string[] | undefined) ?? [];
  const allergens = allergenTags.map((t) => t.replace(/^[a-z]{2}:/, ""));

  // categories_tags → clean list
  const catTags = (product["categories_tags"] as string[] | undefined) ?? [];
  const categories = catTags.map((t) => t.replace(/^[a-z]{2}:/, "")).filter(Boolean);

  const countriesTags = (product["countries_tags"] as string[] | undefined) ?? [];
  const countries = countriesTags.map((t) => t.replace(/^[a-z]{2}:/, "")).filter(Boolean);

  const ns = (product["nutriscore_grade"] as string | undefined)?.toLowerCase();
  const nutriScore = ["a", "b", "c", "d", "e"].includes(ns ?? "") ? (ns as FoodProduct["nutriScore"]) : undefined;

  const pick = (key: string): number | undefined => {
    const v = nutriments[key];
    return typeof v === "number" ? Math.round(v * 10) / 10 : undefined;
  };

  return {
    barcode,
    name: (product["product_name"] as string | undefined) ?? (product["product_name_de"] as string | undefined) ?? "Unbekanntes Produkt",
    nameDe: (product["product_name_de"] as string | undefined),
    brand: (product["brands"] as string | undefined),
    nutriScore,
    kcalPer100g: pick("energy-kcal_100g"),
    proteinPer100g: pick("proteins_100g"),
    fatPer100g: pick("fat_100g"),
    carbsPer100g: pick("carbohydrates_100g"),
    saltPer100g: pick("salt_100g"),
    allergens,
    imageUrl: (product["image_front_small_url"] as string | undefined) ?? (product["image_url"] as string | undefined),
    quantity: (product["quantity"] as string | undefined),
    categories,
    countries,
  };
}

/**
 * GET /api/food-lookup/:barcode
 *
 * Proxies Open Food Facts v3 API.
 * Returns a normalized FoodProduct object.
 * Caches results in-memory for 24h.
 */
router.get("/food-lookup/:barcode", async (req, res) => {
  const { barcode } = req.params;

  if (!/^\d{8,14}$/.test(barcode)) {
    res.status(400).json({ error: "Ungültiger Barcode (8–14 Ziffern erwartet)." });
    return;
  }

  // Check cache
  const cached = CACHE.get(barcode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_de,brands,nutriments,nutriscore_grade,allergens_tags,allergens,image_front_small_url,image_url,quantity,categories_tags,countries_tags`;

    const response = await fetch(url, {
      headers: { "User-Agent": "KitchenOS/1.0 (contact@kitchenos.de)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      req.log.warn({ barcode, status: response.status }, "Open Food Facts returned non-OK status");
      res.status(502).json({ error: "Open Food Facts nicht erreichbar." });
      return;
    }

    const raw = (await response.json()) as Record<string, unknown>;

    if (raw["status"] === 0 || raw["status"] === "failure") {
      res.status(404).json({ error: "Produkt nicht gefunden." });
      return;
    }

    const product = normalize(barcode, raw);
    CACHE.set(barcode, { data: product, fetchedAt: Date.now() });

    res.json(product);
  } catch (err) {
    req.log.error({ err, barcode }, "food-lookup fetch error");
    res.status(502).json({ error: "Open Food Facts konnte nicht erreicht werden." });
  }
});

export default router;

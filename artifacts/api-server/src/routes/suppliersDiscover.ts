import { Router, type IRouter, type Response } from "express";
import { db, supplierDirectory } from "@workspace/db";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Berlin + Brandenburg rough bounding box
const BBOX = { south: 51.36, west: 11.27, north: 53.56, east: 14.77 };

const CATEGORIES: Record<string, { osmTags: string[]; productGroups: string[] }> = {
  butcher: { osmTags: ["shop=butcher"], productGroups: ["meat"] },
  bakery: { osmTags: ["shop=bakery", "shop=pastry"], productGroups: ["bread", "dry"] },
  cheese: { osmTags: ["shop=cheese"], productGroups: ["dairy"] },
  greengrocer: { osmTags: ["shop=greengrocer", "shop=farm"], productGroups: ["vegetable", "fruit"] },
  seafood: { osmTags: ["shop=seafood"], productGroups: ["fish"] },
  beverages: {
    osmTags: ["shop=beverages", "shop=alcohol", "shop=wine"],
    productGroups: ["drink"],
  },
  wholesale: {
    osmTags: ["shop=wholesale"],
    productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"],
  },
  organic: { osmTags: ["shop=organic", "shop=health_food"], productGroups: ["dry", "vegetable"] },
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildOverpassQuery(category: string): string {
  const cfg = CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const filters = cfg.osmTags
    .map((tag) => {
      const [k, v] = tag.split("=");
      return `node["${k}"="${v}"](${bbox});way["${k}"="${v}"](${bbox});`;
    })
    .join("");
  return `[out:json][timeout:25];(${filters});out center tags 200;`;
}

function formatAddress(tags: Record<string, string>): string {
  const street = tags["addr:street"];
  const num = tags["addr:housenumber"];
  const postcode = tags["addr:postcode"];
  const city = tags["addr:city"];
  const parts = [
    [street, num].filter(Boolean).join(" "),
    [postcode, city].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ");
}

async function fetchOverpass(category: string): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(category);
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = (await r.json()) as OverpassResponse;
  return j.elements ?? [];
}

interface DirectoryRow {
  id: string;
  source: "osm" | "google" | "manual";
  name: string;
  category: string;
  productGroups: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
}

async function refreshCategory(category: string): Promise<DirectoryRow[]> {
  const elements = await fetchOverpass(category);
  const cfg = CATEGORIES[category]!;
  const rows = elements
    .map((e) => {
      const tags = e.tags ?? {};
      const lat = e.lat ?? e.center?.lat ?? null;
      const lng = e.lon ?? e.center?.lon ?? null;
      const name = tags["name"];
      if (!name) return null;
      return {
        id: `osm:${e.type[0]}${e.id}`,
        source: "osm" as const,
        externalId: `${e.type[0]}${e.id}`,
        name,
        category,
        productGroups: cfg.productGroups,
        address: formatAddress(tags) || null,
        lat,
        lng,
        phone: tags["phone"] ?? tags["contact:phone"] ?? null,
        website: tags["website"] ?? tags["contact:website"] ?? null,
        email: tags["email"] ?? tags["contact:email"] ?? null,
        rating: null,
        raw: tags,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await db
      .insert(supplierDirectory)
      .values(rows)
      .onConflictDoUpdate({
        target: supplierDirectory.id,
        set: {
          name: supplierDirectory.name,
          address: supplierDirectory.address,
          phone: supplierDirectory.phone,
          website: supplierDirectory.website,
          email: supplierDirectory.email,
          cachedAt: new Date(),
        },
      });
  }
  return rows.map(({ raw: _raw, externalId: _e, ...rest }) => rest);
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

router.get("/suppliers/discover", requireAuth, async (req, res: Response) => {
  const category = String(req.query.category ?? "");
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  if (!CATEGORIES[category]) {
    res.status(400).json({ error: "category required", categories: Object.keys(CATEGORIES) });
    return;
  }

  const cached = await db
    .select()
    .from(supplierDirectory)
    .where(eq(supplierDirectory.category, category))
    .limit(500);

  let rows = cached;
  const stale =
    cached.length === 0 ||
    cached.every((r) => Date.now() - new Date(r.cachedAt).getTime() > TTL_MS);

  if (stale) {
    try {
      const fresh = await refreshCategory(category);
      const ids = fresh.map((f) => f.id);
      if (ids.length > 0) {
        rows = await db
          .select()
          .from(supplierDirectory)
          .where(inArray(supplierDirectory.id, ids));
      }
    } catch (err) {
      req.log.warn({ err }, "overpass refresh failed");
      if (rows.length === 0) {
        res.status(502).json({ error: "Overpass unavailable" });
        return;
      }
    }
  }

  let results = rows.map((r) => ({
    id: r.id,
    source: r.source,
    name: r.name,
    category: r.category,
    productGroups: r.productGroups,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    phone: r.phone,
    website: r.website,
    email: r.email,
    rating: r.rating,
  }));

  if (q) {
    results = results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q),
    );
  }

  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const distKm = (a: number, b: number, c: number, d: number) => {
      const R = 6371;
      const toRad = (n: number) => (n * Math.PI) / 180;
      const dLat = toRad(c - a);
      const dLng = toRad(d - b);
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x));
    };
    results = results
      .map((r) => ({
        ...r,
        distanceKm: r.lat !== null && r.lng !== null ? distKm(lat, lng, r.lat, r.lng) : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }

  // Optional Google enrichment for top 10 if API key present
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey && results.length > 0) {
    try {
      const top = results.slice(0, 10);
      await Promise.all(
        top.map(async (r) => {
          if (r.phone && r.rating) return;
          const gr = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
              `${r.name} ${r.address ?? ""}`,
            )}&inputtype=textquery&fields=place_id,rating,formatted_phone_number&key=${googleKey}`,
          );
          if (!gr.ok) return;
          const gj = (await gr.json()) as {
            candidates?: { rating?: number; formatted_phone_number?: string }[];
          };
          const c = gj.candidates?.[0];
          if (!c) return;
          if (c.rating) r.rating = c.rating;
          if (c.formatted_phone_number) r.phone = r.phone ?? c.formatted_phone_number;
        }),
      );
    } catch (err) {
      req.log.warn({ err }, "google places enrichment failed");
    }
  }

  res.json({ category, count: results.length, results: results.slice(0, 100) });
});

router.get("/suppliers/categories", requireAuth, (_req, res: Response) => {
  res.json({
    categories: Object.entries(CATEGORIES).map(([id, cfg]) => ({
      id,
      productGroups: cfg.productGroups,
    })),
  });
});

export default router;

// satisfy TS unused checks for filter helpers
void and;
void gte;
void lte;

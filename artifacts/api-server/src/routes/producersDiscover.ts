import { Router, type IRouter, type Response } from "express";
import { db, supplierDirectory } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// Berlin + Brandenburg bounding box (same scale as suppliers endpoint)
const BBOX = { south: 51.36, west: 11.27, north: 53.56, east: 14.77 };

const PRODUCER_CATEGORIES: Record<string, { osmTags: string[]; productGroups: string[]; labelDe: string }> = {
  farm: {
    osmTags: ["landuse=farmyard", "place=farm"],
    productGroups: ["vegetable", "fruit", "meat", "dairy"],
    labelDe: "Bauernhof",
  },
  market_garden: {
    osmTags: ["landuse=greenhouse_horticulture", "shop=farm"],
    productGroups: ["vegetable", "fruit"],
    labelDe: "Gemüsegärtner",
  },
  orchard: {
    osmTags: ["landuse=orchard", "landuse=vineyard"],
    productGroups: ["fruit"],
    labelDe: "Obstanbau",
  },
  dairy_farm: {
    osmTags: ["amenity=dairy_kitchen"],
    productGroups: ["dairy"],
    labelDe: "Milchbetrieb",
  },
  cheese: {
    osmTags: ["shop=cheese", "craft=cheese"],
    productGroups: ["dairy"],
    labelDe: "Käserei",
  },
  mill: {
    osmTags: ["craft=mill", "man_made=watermill", "man_made=windmill"],
    productGroups: ["dry"],
    labelDe: "Getreidemühle",
  },
  organic: {
    osmTags: ["shop=organic", "shop=health_food"],
    productGroups: ["vegetable", "fruit", "dry"],
    labelDe: "Bio-Betrieb",
  },
  direct_sales: {
    osmTags: ["shop=farm", "amenity=marketplace"],
    productGroups: ["vegetable", "fruit", "meat", "dairy"],
    labelDe: "Direktvermarktung",
  },
  butcher_farm: {
    osmTags: ["craft=butcher"],
    productGroups: ["meat"],
    labelDe: "Hofmetzgerei",
  },
  beekeeper: {
    osmTags: ["craft=beekeeper"],
    productGroups: ["other"],
    labelDe: "Imkerei",
  },
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

function buildProducerQuery(category: string): string {
  const cfg = PRODUCER_CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const filters = cfg.osmTags
    .map((tag) => {
      const [k, v] = tag.split("=");
      return `node["${k}"="${v}"](${bbox});way["${k}"="${v}"](${bbox});relation["${k}"="${v}"](${bbox});`;
    })
    .join("");
  return `[out:json][timeout:30];(${filters});out center tags 200;`;
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

async function fetchOverpassProducers(category: string): Promise<OverpassElement[]> {
  const query = buildProducerQuery(category);
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = (await r.json()) as OverpassResponse;
  return j.elements ?? [];
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const PRODUCER_CACHE_PREFIX = "prod:";

async function refreshProducerCategory(category: string) {
  const elements = await fetchOverpassProducers(category);
  const cfg = PRODUCER_CATEGORY_CONFIG(category);
  const rows = elements
    .map((e) => {
      const tags = e.tags ?? {};
      const lat = e.lat ?? e.center?.lat ?? null;
      const lng = e.lon ?? e.center?.lon ?? null;
      const name = tags["name"];
      if (!name) return null;
      return {
        id: `${PRODUCER_CACHE_PREFIX}${e.type[0]}${e.id}`,
        source: "osm" as const,
        externalId: `${e.type[0]}${e.id}`,
        name,
        category: `producer_${category}`,
        productGroups: cfg.productGroups,
        address: formatAddress(tags) || null,
        lat,
        lng,
        phone: tags["phone"] ?? tags["contact:phone"] ?? null,
        website: tags["website"] ?? tags["contact:website"] ?? null,
        email: tags["email"] ?? tags["contact:email"] ?? null,
        rating: null,
        raw: tags,
        organic: tags["organic"] === "yes" || tags["shop"] === "organic" || false,
        certified: tags["organic:certified"] === "yes" || false,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const dbRows = rows.map(({ raw: _raw, externalId: _e, organic: _o, certified: _c, ...rest }) => rest);
    await db
      .insert(supplierDirectory)
      .values(dbRows)
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
  return rows.map(({ raw: _raw, externalId: _e, ...rest }) => ({
    ...rest,
    id: rest.id,
  }));
}

function PRODUCER_CATEGORY_CONFIG(category: string) {
  const cfg = PRODUCER_CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  return cfg;
}

router.get("/producers/discover", async (req, res: Response) => {
  const category = String(req.query.category ?? "farm");
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  if (!PRODUCER_CATEGORIES[category]) {
    res.status(400).json({ error: "invalid category", categories: Object.keys(PRODUCER_CATEGORIES) });
    return;
  }

  const dbCategory = `producer_${category}`;
  const cached = await db
    .select()
    .from(supplierDirectory)
    .where(eq(supplierDirectory.category, dbCategory))
    .limit(500);

  let rows = cached;
  const stale =
    cached.length === 0 ||
    cached.every((r) => Date.now() - new Date(r.cachedAt).getTime() > TTL_MS);

  if (stale) {
    try {
      const fresh = await refreshProducerCategory(category);
      const ids = fresh.map((f) => f.id);
      if (ids.length > 0) {
        rows = await db
          .select()
          .from(supplierDirectory)
          .where(inArray(supplierDirectory.id, ids));
      }
    } catch (err) {
      req.log.warn({ err }, "overpass producers refresh failed");
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
    isProducer: true,
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
        if (!("distanceKm" in a) || a.distanceKm === null) return 1;
        if (!("distanceKm" in b) || b.distanceKm === null) return -1;
        return (a.distanceKm as number) - (b.distanceKm as number);
      });
  }

  res.json({
    category,
    categoryLabelDe: PRODUCER_CATEGORIES[category]?.labelDe,
    count: results.length,
    results: results.slice(0, 100),
  });
});

router.get("/producers/categories", (_req, res: Response) => {
  res.json({
    categories: Object.entries(PRODUCER_CATEGORIES).map(([id, cfg]) => ({
      id,
      labelDe: cfg.labelDe,
      productGroups: cfg.productGroups,
    })),
  });
});

export default router;

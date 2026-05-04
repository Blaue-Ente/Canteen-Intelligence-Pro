import { Router, type IRouter, type Response } from "express";
import { db, supplierDirectory } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// ─── Category config ────────────────────────────────────────────────────────
const CATEGORIES: Record<string, { osmTags: string[]; productGroups: string[]; placesKeyword: string }> = {
  butcher:     { osmTags: ["shop=butcher"],                              productGroups: ["meat"],                                     placesKeyword: "Fleischerei Metzgerei Fleischwaren" },
  bakery:      { osmTags: ["shop=bakery", "shop=pastry"],                productGroups: ["bread", "dry"],                             placesKeyword: "Bäckerei Backwaren Großhandel" },
  cheese:      { osmTags: ["shop=cheese"],                               productGroups: ["dairy"],                                    placesKeyword: "Käserei Käsehandel Molkerei" },
  greengrocer: { osmTags: ["shop=greengrocer", "shop=farm"],             productGroups: ["vegetable", "fruit"],                       placesKeyword: "Gemüsehandel Obst Gemüse Großhandel" },
  seafood:     { osmTags: ["shop=seafood"],                              productGroups: ["fish"],                                     placesKeyword: "Fischhandel Fischgroßhandel Fischerei" },
  beverages:   { osmTags: ["shop=beverages", "shop=alcohol", "shop=wine"], productGroups: ["drink"],                                  placesKeyword: "Getränkehandel Getränke Großhandel" },
  wholesale:   { osmTags: ["shop=wholesale"],                            productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"], placesKeyword: "Lebensmittel Großhandel" },
  organic:     { osmTags: ["shop=organic", "shop=health_food"],          productGroups: ["dry", "vegetable"],                         placesKeyword: "Bio-Laden Bioladen Naturkost" },
};

// ─── Haversine ──────────────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Nominatim PLZ geocoding ────────────────────────────────────────────────
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; suburb?: string; postcode?: string };
}

async function geocodePlzNominatim(plz: string): Promise<{ lat: number; lng: number; city: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(plz)}&countrycodes=de&format=json&limit=1&addressdetails=1`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "KitchenOS/1.0 (contact@kitchenos.de)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as NominatimResult[];
    if (!j[0]) return null;
    const item = j[0];
    const city = item.address?.city ?? item.address?.town ?? item.address?.village ?? item.address?.suburb ?? plz;
    return { lat: parseFloat(item.lat), lng: parseFloat(item.lon), city };
  } catch {
    return null;
  }
}

// ─── Google Places Nearby Search ────────────────────────────────────────────
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";

interface PlacesResult {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
}
interface PlacesResponse {
  status: string;
  results: PlacesResult[];
}

async function fetchGooglePlaces(
  keyword: string,
  lat: number,
  lng: number,
  radiusM: number,
): Promise<PlacesResult[]> {
  if (!GOOGLE_PLACES_KEY) throw new Error("no places key");
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(Math.min(50_000, radiusM)),
    keyword,
    language: "de",
    key: GOOGLE_PLACES_KEY,
  });
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`Places API ${r.status}`);
  const j = (await r.json()) as PlacesResponse;
  if (j.status !== "OK" && j.status !== "ZERO_RESULTS") {
    throw new Error(`Places status: ${j.status}`);
  }
  return j.results ?? [];
}

// ─── Overpass nearby search (fallback after Places) ─────────────────────────
interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse { elements: OverpassElement[] }

function buildOverpassAroundQuery(category: string, lat: number, lng: number, radiusM: number): string {
  const cfg = CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  const around = `around:${radiusM},${lat},${lng}`;
  const filters = cfg.osmTags
    .map((tag) => {
      const [k, v] = tag.split("=");
      return `node["${k}"="${v}"](${around});way["${k}"="${v}"](${around});`;
    })
    .join("");
  return `[out:json][timeout:12];(${filters});out center tags 80;`;
}

async function fetchOverpassAround(
  category: string, lat: number, lng: number, radiusM: number,
): Promise<OverpassElement[]> {
  const query = buildOverpassAroundQuery(category, lat, lng, radiusM);
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(14_000),
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = (await r.json()) as OverpassResponse;
  return j.elements ?? [];
}

function formatAddress(tags: Record<string, string>): string {
  const street = tags["addr:street"];
  const num = tags["addr:housenumber"];
  const postcode = tags["addr:postcode"];
  const city = tags["addr:city"];
  return [[street, num].filter(Boolean).join(" "), [postcode, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

// ─── Static fallback data ───────────────────────────────────────────────────
const FALLBACK: Record<string, Array<{
  id: string; name: string; address: string | null;
  lat: number; lng: number; phone: string | null;
  website: string | null; rating: number | null; productGroups: string[];
}>> = {
  butcher: [
    { id: "fb:bt:1", name: "Fleischerei Domke", address: "Berliner Str. 22, 12167 Berlin", lat: 52.43, lng: 13.32, phone: "+49 30 7918870", website: null, rating: 4.5, productGroups: ["meat"] },
    { id: "fb:bt:2", name: "Hofmetzgerei Finkenkrug", address: "Finkenkrugweg 8, 14612 Falkensee", lat: 52.56, lng: 13.09, phone: "+49 3322 24410", website: null, rating: 4.4, productGroups: ["meat"] },
    { id: "fb:bt:3", name: "Metzgerei Kümmel", address: "Karl-Marx-Str. 74, 12043 Berlin", lat: 52.48, lng: 13.43, phone: null, website: null, rating: 4.6, productGroups: ["meat"] },
    { id: "fb:bt:4", name: "Landfleischerei Rehfelde", address: "Bahnhofstr. 5, 15378 Rehfelde", lat: 52.55, lng: 13.88, phone: "+49 33435 1220", website: null, rating: 4.3, productGroups: ["meat"] },
    { id: "fb:bt:5", name: "Hofschlachterei Zossen", address: "Kirchstr. 2, 15806 Zossen", lat: 52.22, lng: 13.45, phone: null, website: null, rating: null, productGroups: ["meat"] },
  ],
  bakery: [
    { id: "fb:bk:1", name: "Bäckerei Siebert", address: "Kastanienallee 12, 10435 Berlin", lat: 52.54, lng: 13.41, phone: "+49 30 44013020", website: null, rating: 4.7, productGroups: ["bread", "dry"] },
    { id: "fb:bk:2", name: "Landbäckerei Grabow", address: "Marktplatz 3, 16727 Velten", lat: 52.68, lng: 13.18, phone: null, website: null, rating: 4.5, productGroups: ["bread", "dry"] },
    { id: "fb:bk:3", name: "Bäckerei Dreißig", address: "Frankfurter Allee 60, 10247 Berlin", lat: 52.51, lng: 13.46, phone: null, website: null, rating: 4.4, productGroups: ["bread", "dry"] },
    { id: "fb:bk:4", name: "Bäckerei & Konditorei Ludwig", address: "Bahnhofstr. 1, 15806 Zossen", lat: 52.22, lng: 13.45, phone: null, website: null, rating: 4.2, productGroups: ["bread", "dry"] },
    { id: "fb:bk:5", name: "Landbäckerei Friesack", address: "Mühlenplatz 2, 14662 Friesack", lat: 52.73, lng: 12.59, phone: null, website: null, rating: 4.1, productGroups: ["bread", "dry"] },
  ],
  cheese: [
    { id: "fb:ch:1", name: "Käserei Gransee", address: "Marktplatz 4, 16775 Gransee", lat: 53.00, lng: 13.16, phone: null, website: null, rating: 4.3, productGroups: ["dairy"] },
    { id: "fb:ch:2", name: "Bergkäse Berlin", address: "Pappelallee 45, 10437 Berlin", lat: 52.54, lng: 13.43, phone: "+49 30 44671820", website: "bergkaese-berlin.de", rating: 4.8, productGroups: ["dairy"] },
    { id: "fb:ch:3", name: "Ziegenkäserei Belzig", address: "Wiesenstr. 2, 14806 Bad Belzig", lat: 52.14, lng: 12.59, phone: "+49 33841 20400", website: null, rating: 4.7, productGroups: ["dairy"] },
    { id: "fb:ch:4", name: "Schafkäserei Fehrbellin", address: "Hauptstr. 9, 16833 Fehrbellin", lat: 52.81, lng: 12.77, phone: null, website: null, rating: null, productGroups: ["dairy"] },
  ],
  greengrocer: [
    { id: "fb:gg:1", name: "Gemüsebau Kemnitz", address: "Kemnitz 8, 15328 Golzow", lat: 52.55, lng: 14.35, phone: null, website: null, rating: 4.0, productGroups: ["vegetable", "fruit"] },
    { id: "fb:gg:2", name: "Berliner Stadtgut Tempelhof", address: "Tempelhofer Feld, 12101 Berlin", lat: 52.47, lng: 13.40, phone: null, website: "stadtgut-tempelhof.de", rating: 4.7, productGroups: ["vegetable", "fruit"] },
    { id: "fb:gg:3", name: "Gärtnerei Schöneiche", address: "Dorfaue 5, 15566 Schöneiche", lat: 52.46, lng: 13.69, phone: "+49 30 6492100", website: null, rating: 4.5, productGroups: ["vegetable"] },
    { id: "fb:gg:4", name: "Gemüsegarten Rohrbeck", address: "Rohrbeck 12, 14547 Beelitz", lat: 52.23, lng: 12.91, phone: "+49 33204 390", website: null, rating: 4.2, productGroups: ["vegetable"] },
    { id: "fb:gg:5", name: "Erdhof Seewalde", address: "Seewalde 2, 39579 Kalbe", lat: 52.66, lng: 11.37, phone: "+49 39080 48010", website: null, rating: 4.6, productGroups: ["vegetable", "fruit"] },
  ],
  seafood: [
    { id: "fb:sf:1", name: "Fischhandel Berlin-Mitte", address: "Große Bäckerstr. 11, 10115 Berlin", lat: 52.53, lng: 13.38, phone: "+49 30 28048820", website: null, rating: 4.6, productGroups: ["fish"] },
    { id: "fb:sf:2", name: "Nordsee Großhandel Berlin", address: "Beusselstr. 44, 10553 Berlin", lat: 52.53, lng: 13.33, phone: null, website: null, rating: 4.2, productGroups: ["fish"] },
    { id: "fb:sf:3", name: "Fischmarkt Eberswalde", address: "Marktplatz 1, 16225 Eberswalde", lat: 52.83, lng: 13.82, phone: null, website: null, rating: 4.1, productGroups: ["fish"] },
    { id: "fb:sf:4", name: "Fischhandlung Potsdam", address: "Friedrich-Ebert-Str. 5, 14467 Potsdam", lat: 52.40, lng: 13.06, phone: null, website: null, rating: 4.3, productGroups: ["fish"] },
  ],
  beverages: [
    { id: "fb:bv:1", name: "Berliner Brauhaus", address: "Rollbergstr. 26, 12053 Berlin", lat: 52.48, lng: 13.43, phone: "+49 30 6900990", website: null, rating: 4.5, productGroups: ["drink"] },
    { id: "fb:bv:2", name: "Getränke Direkt GmbH", address: "Beusselstr. 2, 10553 Berlin", lat: 52.53, lng: 13.33, phone: null, website: null, rating: 4.3, productGroups: ["drink"] },
    { id: "fb:bv:3", name: "Weingut Töplitz", address: "Töplitz 14, 14552 Michendorf", lat: 52.36, lng: 12.94, phone: "+49 33207 38450", website: "weingut-toepl.de", rating: 4.6, productGroups: ["drink"] },
    { id: "fb:bv:4", name: "Spreequell Getränkehandel", address: "Köpenicker Str. 12, 10179 Berlin", lat: 52.50, lng: 13.43, phone: null, website: null, rating: 4.1, productGroups: ["drink"] },
  ],
  wholesale: [
    { id: "fb:ws:1", name: "METRO Berlin Friedrichshain", address: "Möllendorffstr. 49, 10367 Berlin", lat: 52.52, lng: 13.48, phone: "+49 30 5549810", website: "metro.de", rating: 4.2, productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"] },
    { id: "fb:ws:2", name: "Selgros Potsdam", address: "Großbeerenstr. 200, 14480 Potsdam", lat: 52.36, lng: 13.12, phone: "+49 331 7484620", website: "selgros.de", rating: 4.1, productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"] },
    { id: "fb:ws:3", name: "METRO Berlin Tempelhof", address: "Columbiadamm 6, 10965 Berlin", lat: 52.47, lng: 13.40, phone: "+49 30 69509810", website: "metro.de", rating: 4.0, productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"] },
    { id: "fb:ws:4", name: "Selgros Eberswalde", address: "Breitscheidstr. 20, 16225 Eberswalde", lat: 52.83, lng: 13.79, phone: null, website: "selgros.de", rating: null, productGroups: ["meat", "dairy", "vegetable", "fruit", "dry", "frozen"] },
  ],
  organic: [
    { id: "fb:og:1", name: "Bioland-Hof Schoenhorst", address: "Schoenhorst 5, 16818 Karwe", lat: 52.86, lng: 12.64, phone: "+49 33925 740", website: null, rating: 4.7, productGroups: ["dry", "vegetable"] },
    { id: "fb:og:2", name: "Demeter Hof Marienfelde", address: "Marienfelder Allee 99, 12277 Berlin", lat: 52.41, lng: 13.36, phone: null, website: null, rating: 4.5, productGroups: ["dry", "vegetable"] },
    { id: "fb:og:3", name: "Bio-Markt Naturkost Berlin", address: "Kollwitzstr. 10, 10405 Berlin", lat: 52.54, lng: 13.42, phone: "+49 30 4422970", website: null, rating: 4.6, productGroups: ["dry", "vegetable"] },
    { id: "fb:og:4", name: "Ökolandbau Demnitz", address: "Dorfstr. 3, 15518 Beeskow", lat: 52.17, lng: 14.24, phone: "+49 33661 9000", website: null, rating: 4.3, productGroups: ["dry", "vegetable"] },
    { id: "fb:og:5", name: "Bio Company Schöneberg", address: "Goltzstr. 24, 10781 Berlin", lat: 52.49, lng: 13.35, phone: "+49 30 23454650", website: "biocompany.de", rating: 4.5, productGroups: ["dry", "vegetable"] },
  ],
};

// ─── Geocode endpoint ───────────────────────────────────────────────────────
router.get("/suppliers/geocode", async (req, res: Response) => {
  const plz = String(req.query.plz ?? "").trim();
  if (!/^\d{5}$/.test(plz)) {
    res.status(400).json({ error: "plz must be a 5-digit German postcode" });
    return;
  }
  try {
    const result = await geocodePlzNominatim(plz);
    if (!result) {
      res.status(404).json({ error: "PLZ nicht gefunden" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.warn({ err }, "nominatim geocode failed");
    res.status(502).json({ error: "Geocoding nicht verfügbar" });
  }
});

// ─── Discover endpoint ──────────────────────────────────────────────────────
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

type ResultRow = {
  id: string; source: string; name: string; category: string;
  productGroups: string[]; address: string | null;
  lat: number | null; lng: number | null;
  phone: string | null; website: string | null; email: string | null;
  rating: number | null; distanceKm?: number; isFallback?: boolean;
};

router.get("/suppliers/discover", async (req, res: Response) => {
  const category = String(req.query.category ?? "");
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const radiusKm = Math.min(100, Math.max(1, Number(req.query.radiusKm ?? 25)));

  if (!CATEGORIES[category]) {
    res.status(400).json({ error: "category required", categories: Object.keys(CATEGORIES) });
    return;
  }

  const hasLocation = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const cfg = CATEGORIES[category]!;

  let results: ResultRow[] = [];
  let usingFallback = false;
  let source: "google" | "osm" | "db" | "fallback" = "fallback";

  if (hasLocation) {
    const radiusM = radiusKm * 1000;

    // 1) Google Places Nearby Search (primary)
    if (!results.length && GOOGLE_PLACES_KEY) {
      try {
        const places = await fetchGooglePlaces(cfg.placesKeyword, lat!, lng!, radiusM);
        const mapped: ResultRow[] = places
          .map((p) => ({
            id: `google:${p.place_id}`,
            source: "google",
            name: p.name,
            category,
            productGroups: cfg.productGroups,
            address: p.vicinity ?? null,
            lat: p.geometry.location.lat,
            lng: p.geometry.location.lng,
            phone: null,
            website: null,
            email: null,
            rating: p.rating ?? null,
            distanceKm: distKm(lat!, lng!, p.geometry.location.lat, p.geometry.location.lng),
          }))
          .filter((r) => (r.distanceKm ?? 0) <= radiusKm);

        if (mapped.length > 0) {
          results = mapped;
          source = "google";
          // Cache async
          const dbRows = mapped.slice(0, 100).map((r) => ({
            id: r.id, source: "google" as const, name: r.name, category: r.category,
            productGroups: r.productGroups, address: r.address,
            lat: r.lat, lng: r.lng, phone: r.phone, website: r.website, email: r.email, rating: r.rating,
          }));
          db.insert(supplierDirectory)
            .values(dbRows)
            .onConflictDoUpdate({ target: supplierDirectory.id, set: { name: supplierDirectory.name, address: supplierDirectory.address, cachedAt: new Date() } })
            .catch(() => {});
        }
      } catch (err) {
        req.log.warn({ err }, "google places failed — trying overpass");
      }
    }

    // 2) Overpass (fallback if Places failed or no key)
    if (!results.length) {
      try {
        const elements = await fetchOverpassAround(category, lat!, lng!, radiusM);
        const mapped: ResultRow[] = elements
          .map((e) => {
            const tags = e.tags ?? {};
            const eLat = e.lat ?? e.center?.lat ?? null;
            const eLng = e.lon ?? e.center?.lon ?? null;
            const name = tags["name"];
            if (!name || eLat === null || eLng === null) return null;
            return {
              id: `osm:${e.type[0]}${e.id}`,
              source: "osm",
              name,
              category,
              productGroups: cfg.productGroups,
              address: formatAddress(tags) || null,
              lat: eLat, lng: eLng,
              phone: tags["phone"] ?? tags["contact:phone"] ?? null,
              website: tags["website"] ?? tags["contact:website"] ?? null,
              email: tags["email"] ?? tags["contact:email"] ?? null,
              rating: null,
              distanceKm: distKm(lat!, lng!, eLat, eLng),
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .filter((r) => (r.distanceKm ?? 0) <= radiusKm);

        if (mapped.length > 0) {
          results = mapped;
          source = "osm";
          const dbRows = mapped.slice(0, 100).map((r) => ({
            id: r.id, source: "osm" as const, name: r.name, category: r.category,
            productGroups: r.productGroups, address: r.address,
            lat: r.lat, lng: r.lng, phone: r.phone, website: r.website, email: r.email, rating: r.rating,
          }));
          db.insert(supplierDirectory)
            .values(dbRows)
            .onConflictDoUpdate({ target: supplierDirectory.id, set: { name: supplierDirectory.name, address: supplierDirectory.address, cachedAt: new Date() } })
            .catch(() => {});
        }
      } catch (err) {
        req.log.warn({ err }, "overpass around also failed");
      }
    }
  }

  // 3) DB cache (no location, or live search failed)
  if (!results.length) {
    const cached = await db
      .select().from(supplierDirectory)
      .where(eq(supplierDirectory.category, category))
      .limit(300);
    const fresh = cached.filter((r) => Date.now() - new Date(r.cachedAt).getTime() < TTL_MS);
    if (fresh.length > 0) {
      source = "db";
      results = fresh.map((r) => ({
        id: r.id, source: r.source, name: r.name, category: r.category,
        productGroups: r.productGroups, address: r.address,
        lat: r.lat, lng: r.lng, phone: r.phone, website: r.website, email: r.email, rating: r.rating,
        distanceKm: hasLocation && r.lat !== null && r.lng !== null
          ? distKm(lat!, lng!, r.lat, r.lng) : undefined,
      }));
      // Filter by radius if we have location
      if (hasLocation) {
        results = results.filter((r) => (r.distanceKm ?? 0) <= radiusKm);
      }
    }
  }

  // 4) Static fallback — always shown if everything above failed
  if (!results.length) {
    usingFallback = true;
    source = "fallback";
    const fb = FALLBACK[category] ?? [];
    results = fb.map((r) => ({
      ...r, source: "fallback", category, email: null, isFallback: true,
      distanceKm: hasLocation ? distKm(lat!, lng!, r.lat, r.lng) : undefined,
    }));
  }

  // ── Text filter ────────────────────────────────────────────────────────────
  if (q) {
    results = results.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.address ?? "").toLowerCase().includes(q),
    );
  }

  // ── Sort by distance, then by name ────────────────────────────────────────
  results.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ category, count: results.length, radiusKm, usingFallback, source, results: results.slice(0, 100) });
});

router.get("/suppliers/categories", (_req, res: Response) => {
  res.json({
    categories: Object.entries(CATEGORIES).map(([id, cfg]) => ({
      id, productGroups: cfg.productGroups,
    })),
  });
});

export default router;

void inArray;

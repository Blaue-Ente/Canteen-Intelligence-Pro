import { Router, type IRouter, type Response } from "express";
import { db, supplierDirectory } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Default bounding box used only when the caller did NOT provide a location
// (lat/lng). The default covers Berlin + Brandenburg because that's where the
// historical static fallback dataset is centred. Any caller that supplies a
// location uses an `around:radius,lat,lng` query instead, which works for the
// whole of Germany (and beyond).
const DEFAULT_BBOX = { south: 51.36, west: 11.27, north: 53.56, east: 14.77 };

const PRODUCER_CATEGORIES: Record<string, { osmTags: string[]; productGroups: string[]; labelDe: string }> = {
  farm: {
    osmTags: ["landuse=farmyard", "place=farm", "shop=farm"],
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
    osmTags: ["amenity=dairy_kitchen", "shop=dairy"],
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
    osmTags: ["craft=butcher", "shop=butcher"],
    productGroups: ["meat"],
    labelDe: "Hofmetzgerei",
  },
  beekeeper: {
    osmTags: ["craft=beekeeper", "shop=honey"],
    productGroups: ["other"],
    labelDe: "Imkerei",
  },
};

// ---------------------------------------------------------------------------
// Static fallback data — shown ONLY when every live and cached path fails.
// These are representative Berlin/Brandenburg producers; they're a last
// resort so the UI is never empty. Distance is computed but the radius
// filter is intentionally NOT applied to fallback rows — otherwise users
// far from Berlin would see an empty screen even though the API "succeeded".
// ---------------------------------------------------------------------------
interface FallbackRow {
  id: string;
  source: "fallback";
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
  isProducer: true;
}

const FALLBACK: Record<string, FallbackRow[]> = {
  farm: [
    { id: "fb:farm:1", source: "fallback", name: "Gut Gothendorf", category: "producer_farm", productGroups: ["vegetable", "meat"], address: "Gothendorf 1, 16348 Wandlitz", lat: 52.78, lng: 13.52, phone: "+49 33397 700", website: null, email: null, rating: 4.6, isProducer: true },
    { id: "fb:farm:2", source: "fallback", name: "Hof Brieselang", category: "producer_farm", productGroups: ["vegetable", "dairy"], address: "Döberitzer Str. 4, 14665 Brieselang", lat: 52.57, lng: 12.98, phone: "+49 33232 1234", website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:farm:3", source: "fallback", name: "Agrargenossenschaft Neutrebbin", category: "producer_farm", productGroups: ["meat", "dairy"], address: "Dorfstr. 12, 15320 Neutrebbin", lat: 52.62, lng: 14.41, phone: null, website: null, email: null, rating: null, isProducer: true },
    { id: "fb:farm:4", source: "fallback", name: "Landgut Pretschen", category: "producer_farm", productGroups: ["vegetable", "fruit"], address: "Pretschen 5, 15910 Schönwald", lat: 51.93, lng: 14.0, phone: null, website: null, email: null, rating: 4.1, isProducer: true },
    { id: "fb:farm:5", source: "fallback", name: "Ökolandbau Demnitz", category: "producer_farm", productGroups: ["vegetable", "meat"], address: "Dorfstr. 3, 15518 Beeskow", lat: 52.17, lng: 14.24, phone: "+49 33661 9000", website: null, email: null, rating: 4.3, isProducer: true },
    { id: "fb:farm:6", source: "fallback", name: "Hof Havelmoor", category: "producer_farm", productGroups: ["dairy", "meat"], address: "Havelmoorweg 1, 14778 Westheide", lat: 52.41, lng: 12.38, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
  market_garden: [
    { id: "fb:mg:1", source: "fallback", name: "Gärtnerei Rohrbeck", category: "producer_market_garden", productGroups: ["vegetable"], address: "Rohrbeck 12, 14547 Beelitz", lat: 52.23, lng: 12.91, phone: "+49 33204 390", website: null, email: null, rating: 4.2, isProducer: true },
    { id: "fb:mg:2", source: "fallback", name: "Gemüsebau Kemnitz", category: "producer_market_garden", productGroups: ["vegetable", "fruit"], address: "Kemnitz 8, 15328 Golzow", lat: 52.55, lng: 14.35, phone: null, website: null, email: null, rating: 4.0, isProducer: true },
    { id: "fb:mg:3", source: "fallback", name: "Gärtnerei Schöneiche", category: "producer_market_garden", productGroups: ["vegetable"], address: "Dorfaue 5, 15566 Schöneiche", lat: 52.46, lng: 13.69, phone: "+49 30 6492100", website: null, email: null, rating: 4.5, isProducer: true },
    { id: "fb:mg:4", source: "fallback", name: "Berliner Stadtgut Tempelhof", category: "producer_market_garden", productGroups: ["vegetable", "fruit"], address: "Tempelhofer Feld, 12101 Berlin", lat: 52.47, lng: 13.40, phone: null, website: "stadtgut-tempelhof.de", email: null, rating: 4.7, isProducer: true },
    { id: "fb:mg:5", source: "fallback", name: "Gärtnerei Rahnsdorf", category: "producer_market_garden", productGroups: ["vegetable"], address: "Fürstenwalder Damm 400, 12589 Berlin", lat: 52.44, lng: 13.71, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
  orchard: [
    { id: "fb:orch:1", source: "fallback", name: "Obstgut Werder (Havel)", category: "producer_orchard", productGroups: ["fruit"], address: "Obstbaumallee 1, 14542 Werder (Havel)", lat: 52.38, lng: 12.94, phone: "+49 3327 7340", website: null, email: null, rating: 4.8, isProducer: true },
    { id: "fb:orch:2", source: "fallback", name: "Mosterei Kremmen", category: "producer_orchard", productGroups: ["fruit"], address: "Lindenallee 3, 16766 Kremmen", lat: 52.77, lng: 12.99, phone: null, website: null, email: null, rating: 4.3, isProducer: true },
    { id: "fb:orch:3", source: "fallback", name: "Obstplantage Lübbenow", category: "producer_orchard", productGroups: ["fruit"], address: "Plantage 1, 16909 Wittstock", lat: 53.15, lng: 12.49, phone: null, website: null, email: null, rating: null, isProducer: true },
    { id: "fb:orch:4", source: "fallback", name: "Weinbau Töplitz", category: "producer_orchard", productGroups: ["fruit"], address: "Töplitz 14, 14552 Michendorf", lat: 52.36, lng: 12.94, phone: "+49 33207 38450", website: "weingut-toepl.de", email: null, rating: 4.6, isProducer: true },
  ],
  dairy_farm: [
    { id: "fb:df:1", source: "fallback", name: "Molkerei Rüdersdorf", category: "producer_dairy_farm", productGroups: ["dairy"], address: "Seebad 1, 15562 Rüdersdorf", lat: 52.47, lng: 13.80, phone: "+49 33638 78780", website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:df:2", source: "fallback", name: "Milchhof Altlandsberg", category: "producer_dairy_farm", productGroups: ["dairy"], address: "Berliner Allee 8, 15345 Altlandsberg", lat: 52.56, lng: 13.74, phone: null, website: null, email: null, rating: 4.2, isProducer: true },
    { id: "fb:df:3", source: "fallback", name: "Hofmolkerei Buchholz", category: "producer_dairy_farm", productGroups: ["dairy"], address: "Dorfstr. 7, 17268 Buchholz", lat: 53.24, lng: 13.43, phone: null, website: null, email: null, rating: null, isProducer: true },
    { id: "fb:df:4", source: "fallback", name: "Biohof Meyenburg", category: "producer_dairy_farm", productGroups: ["dairy"], address: "Meyenburg 3, 16945 Meyenburg", lat: 53.31, lng: 12.25, phone: "+49 33968 600", website: null, email: null, rating: 4.5, isProducer: true },
  ],
  cheese: [
    { id: "fb:ch:1", source: "fallback", name: "Ziegenkaeserei Belzig", category: "producer_cheese", productGroups: ["dairy"], address: "Wiesenstr. 2, 14806 Bad Belzig", lat: 52.14, lng: 12.59, phone: "+49 33841 20400", website: null, email: null, rating: 4.7, isProducer: true },
    { id: "fb:ch:2", source: "fallback", name: "Käserei Gransee", category: "producer_cheese", productGroups: ["dairy"], address: "Marktplatz 4, 16775 Gransee", lat: 53.00, lng: 13.16, phone: null, website: null, email: null, rating: 4.3, isProducer: true },
    { id: "fb:ch:3", source: "fallback", name: "Bergkaese Berlin", category: "producer_cheese", productGroups: ["dairy"], address: "Pappelallee 45, 10437 Berlin", lat: 52.54, lng: 13.43, phone: "+49 30 44671820", website: "bergkaese-berlin.de", email: null, rating: 4.8, isProducer: true },
    { id: "fb:ch:4", source: "fallback", name: "Schafkaeserei Fehrbellin", category: "producer_cheese", productGroups: ["dairy"], address: "Hauptstr. 9, 16833 Fehrbellin", lat: 52.81, lng: 12.77, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
  mill: [
    { id: "fb:ml:1", source: "fallback", name: "Muehle Liebenthal", category: "producer_mill", productGroups: ["dry"], address: "Mühlenweg 1, 16775 Liebenthal", lat: 53.08, lng: 12.97, phone: null, website: null, email: null, rating: 4.5, isProducer: true },
    { id: "fb:ml:2", source: "fallback", name: "Getreidemühle Neustadt", category: "producer_mill", productGroups: ["dry"], address: "Mühlenstr. 12, 16845 Neustadt", lat: 52.84, lng: 12.44, phone: "+49 33970 12340", website: null, email: null, rating: 4.2, isProducer: true },
    { id: "fb:ml:3", source: "fallback", name: "Bockwindmuehle Trebbin", category: "producer_mill", productGroups: ["dry"], address: "Mahlower Str. 6, 14959 Trebbin", lat: 52.22, lng: 13.21, phone: null, website: null, email: null, rating: null, isProducer: true },
    { id: "fb:ml:4", source: "fallback", name: "Mühle Friesack", category: "producer_mill", productGroups: ["dry"], address: "Mühlenplatz 2, 14662 Friesack", lat: 52.73, lng: 12.59, phone: null, website: null, email: null, rating: 4.0, isProducer: true },
  ],
  organic: [
    { id: "fb:org:1", source: "fallback", name: "Bioland-Hof Schoenhorst", category: "producer_organic", productGroups: ["vegetable", "fruit", "dry"], address: "Schoenhorst 5, 16818 Karwe", lat: 52.86, lng: 12.64, phone: "+49 33925 740", website: null, email: null, rating: 4.7, isProducer: true },
    { id: "fb:org:2", source: "fallback", name: "Demeter Hof Marienfelde", category: "producer_organic", productGroups: ["vegetable", "dairy"], address: "Marienfelder Allee 99, 12277 Berlin", lat: 52.41, lng: 13.36, phone: null, website: null, email: null, rating: 4.5, isProducer: true },
    { id: "fb:org:3", source: "fallback", name: "Bio-Hof Kneese", category: "producer_organic", productGroups: ["vegetable", "fruit"], address: "Kneese 3, 19205 Gadebusch", lat: 53.70, lng: 11.10, phone: null, website: null, email: null, rating: null, isProducer: true },
    { id: "fb:org:4", source: "fallback", name: "Oekohof Gruenthal", category: "producer_organic", productGroups: ["vegetable", "dry"], address: "Gruenthal 7, 16244 Altenhof", lat: 52.94, lng: 13.68, phone: "+49 33363 500", website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:org:5", source: "fallback", name: "Bio-Markt Naturkost Berlin", category: "producer_organic", productGroups: ["vegetable", "fruit", "dry"], address: "Kollwitzstr. 10, 10405 Berlin", lat: 52.54, lng: 13.42, phone: "+49 30 4422970", website: null, email: null, rating: 4.6, isProducer: true },
  ],
  direct_sales: [
    { id: "fb:ds:1", source: "fallback", name: "Hofladen Gross Mutz", category: "producer_direct_sales", productGroups: ["vegetable", "dairy", "meat"], address: "Dorfstr. 5, 16775 Gross Mutz", lat: 53.07, lng: 13.08, phone: null, website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:ds:2", source: "fallback", name: "Erdhof Seewalde", category: "producer_direct_sales", productGroups: ["vegetable", "fruit"], address: "Seewalde 2, 39579 Kalbe", lat: 52.66, lng: 11.37, phone: "+49 39080 48010", website: null, email: null, rating: 4.6, isProducer: true },
    { id: "fb:ds:3", source: "fallback", name: "Direktvermarktung Hof Teltow", category: "producer_direct_sales", productGroups: ["vegetable", "dairy"], address: "Potsdamer Str. 22, 14513 Teltow", lat: 52.40, lng: 13.27, phone: null, website: null, email: null, rating: 4.2, isProducer: true },
    { id: "fb:ds:4", source: "fallback", name: "Bauernmarkt Eberswalde", category: "producer_direct_sales", productGroups: ["vegetable", "fruit", "meat"], address: "Marktplatz 1, 16225 Eberswalde", lat: 52.83, lng: 13.82, phone: null, website: null, email: null, rating: 4.3, isProducer: true },
    { id: "fb:ds:5", source: "fallback", name: "Hofladen Breese", category: "producer_direct_sales", productGroups: ["vegetable", "dairy"], address: "Breese 10, 19322 Breese", lat: 53.11, lng: 11.74, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
  butcher_farm: [
    { id: "fb:bf:1", source: "fallback", name: "Hofmetzgerei Finkenkrug", category: "producer_butcher_farm", productGroups: ["meat"], address: "Finkenkrugweg 8, 14612 Falkensee", lat: 52.56, lng: 13.09, phone: "+49 3322 24410", website: null, email: null, rating: 4.5, isProducer: true },
    { id: "fb:bf:2", source: "fallback", name: "Landmetzger Kuehdorf", category: "producer_butcher_farm", productGroups: ["meat"], address: "Kuehdorf 3, 15926 Luckau", lat: 51.84, lng: 13.72, phone: null, website: null, email: null, rating: 4.3, isProducer: true },
    { id: "fb:bf:3", source: "fallback", name: "Fleischerei Rehfelde", category: "producer_butcher_farm", productGroups: ["meat"], address: "Bahnhofstr. 5, 15378 Rehfelde", lat: 52.55, lng: 13.88, phone: "+49 33435 1220", website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:bf:4", source: "fallback", name: "Hofschlachterei Zossen", category: "producer_butcher_farm", productGroups: ["meat"], address: "Kirchstr. 2, 15806 Zossen", lat: 52.22, lng: 13.45, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
  beekeeper: [
    { id: "fb:bk:1", source: "fallback", name: "Imkerei Weissensee", category: "producer_beekeeper", productGroups: ["other"], address: "Langhansstr. 60, 13086 Berlin", lat: 52.55, lng: 13.46, phone: "+49 30 9242190", website: null, email: null, rating: 4.7, isProducer: true },
    { id: "fb:bk:2", source: "fallback", name: "Stadtimkerei Prenzlauer Berg", category: "producer_beekeeper", productGroups: ["other"], address: "Sredzkistr. 64, 10405 Berlin", lat: 52.54, lng: 13.44, phone: null, website: "berliner-stadtimker.de", email: null, rating: 4.8, isProducer: true },
    { id: "fb:bk:3", source: "fallback", name: "Imkerhof Strausberg", category: "producer_beekeeper", productGroups: ["other"], address: "Waldweg 3, 15344 Strausberg", lat: 52.58, lng: 13.88, phone: null, website: null, email: null, rating: 4.5, isProducer: true },
    { id: "fb:bk:4", source: "fallback", name: "Brandenburger Imkerei Niemeck", category: "producer_beekeeper", productGroups: ["other"], address: "Niemeck 5, 14822 Brück", lat: 52.22, lng: 12.74, phone: "+49 33844 310", website: null, email: null, rating: 4.4, isProducer: true },
    { id: "fb:bk:5", source: "fallback", name: "Imkerei Erkner", category: "producer_beekeeper", productGroups: ["other"], address: "Berliner Str. 12, 15537 Erkner", lat: 52.42, lng: 13.75, phone: null, website: null, email: null, rating: null, isProducer: true },
  ],
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

// ─── Overpass query builders ────────────────────────────────────────────────
function buildAroundQuery(category: string, lat: number, lng: number, radiusM: number): string {
  const cfg = PRODUCER_CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  const around = `around:${radiusM},${lat},${lng}`;
  const filters = cfg.osmTags
    .map((tag) => {
      const [k, v] = tag.split("=");
      return `node["${k}"="${v}"](${around});way["${k}"="${v}"](${around});relation["${k}"="${v}"](${around});`;
    })
    .join("");
  // 14s timeout matches the suppliers route — keeps total request under
  // the api-server's request budget and lets the client see a quick fallback
  // if Overpass is slow.
  return `[out:json][timeout:14];(${filters});out center tags 200;`;
}

function buildBboxQuery(category: string): string {
  const cfg = PRODUCER_CATEGORIES[category];
  if (!cfg) throw new Error("invalid category");
  const bbox = `${DEFAULT_BBOX.south},${DEFAULT_BBOX.west},${DEFAULT_BBOX.north},${DEFAULT_BBOX.east}`;
  const filters = cfg.osmTags
    .map((tag) => {
      const [k, v] = tag.split("=");
      return `node["${k}"="${v}"](${bbox});way["${k}"="${v}"](${bbox});relation["${k}"="${v}"](${bbox});`;
    })
    .join("");
  return `[out:json][timeout:25];(${filters});out center tags 200;`;
}

async function runOverpass(query: string, timeoutMs: number): Promise<OverpassElement[]> {
  // Overpass rejects requests without a User-Agent with HTTP 406.
  // Node's native fetch does NOT send a default UA, so we must set one.
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "KitchenOS/1.0 (contact@kitchenos.de)",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(timeoutMs),
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
  const parts = [
    [street, num].filter(Boolean).join(" "),
    [postcode, city].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ");
}

// ─── Map Overpass element → result row (unsaved) ────────────────────────────
type MappedRow = {
  id: string;
  source: "osm";
  name: string;
  category: string;
  productGroups: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: null;
  isProducer: true;
  distanceKm?: number;
};

function mapElements(
  elements: OverpassElement[],
  category: string,
  origin: { lat: number; lng: number } | null,
): MappedRow[] {
  const cfg = PRODUCER_CATEGORIES[category]!;
  return elements
    .map((e): MappedRow | null => {
      const tags = e.tags ?? {};
      const lat = e.lat ?? e.center?.lat ?? null;
      const lng = e.lon ?? e.center?.lon ?? null;
      const name = tags["name"];
      if (!name || lat === null || lng === null) return null;
      return {
        id: `osm:${e.type[0]}${e.id}`,
        source: "osm",
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
        isProducer: true,
        distanceKm: origin ? distKm(origin.lat, origin.lng, lat, lng) : undefined,
      };
    })
    .filter((r): r is MappedRow => r !== null);
}

// ─── DB cache helpers ───────────────────────────────────────────────────────
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

async function cacheRows(rows: MappedRow[]): Promise<void> {
  if (!rows.length) return;
  const dbRows = rows.slice(0, 200).map(({ distanceKm: _d, isProducer: _p, ...rest }) => rest);
  try {
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
  } catch {
    // swallow cache errors — we still return live results to the caller
  }
}

router.get("/producers/discover", async (req, res: Response) => {
  const category = String(req.query.category ?? "farm");
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const radiusKm = req.query.radiusKm
    ? Math.min(200, Math.max(1, Number(req.query.radiusKm)))
    : null;

  if (!PRODUCER_CATEGORIES[category]) {
    res.status(400).json({ error: "invalid category", categories: Object.keys(PRODUCER_CATEGORIES) });
    return;
  }

  const hasLocation =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const origin = hasLocation ? { lat: lat!, lng: lng! } : null;
  const dbCategory = `producer_${category}`;

  type ResultRow = MappedRow | (FallbackRow & { distanceKm?: number; isFallback?: true });

  let results: ResultRow[] = [];
  let source: "osm" | "db" | "fallback" = "fallback";
  let usingFallback = false;

  // 1) Live Overpass — `around:` query when we have a location, BBOX otherwise.
  try {
    const query = hasLocation
      ? buildAroundQuery(category, lat!, lng!, (radiusKm ?? 50) * 1000)
      : buildBboxQuery(category);
    const timeoutMs = hasLocation ? 15_000 : 26_000;
    const elements = await runOverpass(query, timeoutMs);
    const mapped = mapElements(elements, category, origin);
    if (mapped.length > 0) {
      results = mapped;
      source = "osm";
      // Persist to cache asynchronously (fire-and-forget)
      void cacheRows(mapped);
    }
  } catch (err) {
    req.log.warn({ err, category }, "overpass producers query failed");
  }

  // 2) DB cache — only if Overpass returned nothing.
  if (!results.length) {
    try {
      const cached = await db
        .select()
        .from(supplierDirectory)
        .where(eq(supplierDirectory.category, dbCategory))
        .limit(500);
      const fresh = cached.filter((r) => Date.now() - new Date(r.cachedAt).getTime() < TTL_MS);
      if (fresh.length > 0) {
        const mapped: MappedRow[] = fresh
          .filter((r) => r.lat !== null && r.lng !== null)
          .map((r) => ({
            id: r.id,
            source: "osm" as const,
            name: r.name,
            category: r.category,
            productGroups: r.productGroups,
            address: r.address,
            lat: r.lat,
            lng: r.lng,
            phone: r.phone,
            website: r.website,
            email: r.email,
            rating: null,
            isProducer: true as const,
            distanceKm: origin && r.lat !== null && r.lng !== null
              ? distKm(origin.lat, origin.lng, r.lat, r.lng)
              : undefined,
          }));
        // Apply radius filter against cached rows (cache may include rows
        // far outside the requested radius from previous queries).
        const filtered = origin && radiusKm !== null
          ? mapped.filter((r) => (r.distanceKm ?? Infinity) <= radiusKm)
          : mapped;
        if (filtered.length > 0) {
          results = filtered;
          source = "db";
        }
      }
    } catch (err) {
      req.log.warn({ err, category }, "producers db cache lookup failed");
    }
  }

  // 3) Static fallback — last resort. NOT filtered by radius, otherwise users
  //    far from Berlin would see an empty screen even though the API replied
  //    successfully. Distance is still computed for sorting / display.
  if (!results.length) {
    usingFallback = true;
    source = "fallback";
    const fb = FALLBACK[category] ?? [];
    results = fb.map((r) => ({
      ...r,
      distanceKm:
        origin && r.lat !== null && r.lng !== null
          ? distKm(origin.lat, origin.lng, r.lat, r.lng)
          : undefined,
      isFallback: true as const,
    }));
  }

  // ── Optional in-memory text filter ──────────────────────────────────────
  if (q) {
    results = results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q),
    );
  }

  // ── Sort by distance (when available), then by name ─────────────────────
  results.sort((a, b) => {
    const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });

  res.json({
    category,
    categoryLabelDe: PRODUCER_CATEGORIES[category]?.labelDe,
    count: results.length,
    usingFallback,
    source,
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

void inArray;

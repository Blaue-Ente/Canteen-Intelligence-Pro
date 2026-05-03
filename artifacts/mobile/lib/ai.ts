import { fetch as expoFetch } from "expo/fetch";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function streamChat(
  messages: AiChatMessage[],
  onChunk: (delta: string) => void,
): Promise<string> {
  const res = await expoFetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  const flushLines = (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const obj = JSON.parse(payload) as { content?: string; done?: boolean };
        if (obj.content) {
          full += obj.content;
          onChunk(obj.content);
        }
      } catch {
        // ignore malformed line
      }
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    flushLines(decoder.decode(value, { stream: true }));
  }
  flushLines(decoder.decode());
  if (buffer.length > 0) flushLines("\n");
  return full;
}

export async function analyzePhoto(
  base64: string,
  prompt: string,
): Promise<string> {
  const res = await expoFetch(`${API_BASE}/api/ai/vision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, prompt }),
  });
  if (!res.ok) throw new Error(`Vision failed: ${res.status}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}

export async function generateJson<T>(
  prompt: string,
  schemaHint?: string,
  base64?: string,
): Promise<T> {
  const res = await expoFetch(`${API_BASE}/api/ai/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, schemaHint, base64 }),
  });
  if (!res.ok) throw new Error(`JSON failed: ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ---- Domain helpers ----

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: "kg" | "g" | "l" | "ml" | "pcs";
  pricePerUnit: number;
  category?: string;
}

export interface ParsedReceipt {
  supplier?: string;
  date?: string;
  total?: number;
  items: ParsedReceiptItem[];
}

export async function parseReceiptImage(base64: string): Promise<ParsedReceipt> {
  return generateJson<ParsedReceipt>(
    "You are a German restaurant accountant. Read this supplier receipt or Lieferschein and extract every line item. Use German item names. Convert pieces (Stk) to pcs, kilogramm to kg, liter to l. Estimate price_per_unit_eur if only total is shown. category may be one of: meat, dairy, vegetable, fruit, dry, spice, drink, frozen, other.",
    '{"supplier":"string","date":"YYYY-MM-DD","total":number,"items":[{"name":"string","quantity":number,"unit":"kg|g|l|ml|pcs","pricePerUnit":number,"category":"string"}]}',
    base64,
  );
}

export interface GeneratedMenu {
  days: { date: string; recipeIds: string[]; rationale?: string }[];
}

export async function generateWeekMenu(args: {
  recipes: { id: string; name: string; type: string; category: string; meat: string }[];
  startDate: string;
  lowStockNames: string[];
  locale: "de" | "en";
}): Promise<GeneratedMenu> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const list = args.recipes
    .map((r) => `${r.id}: ${r.name} (${r.type}/${r.category}/${r.meat})`)
    .join("\n");
  return generateJson<GeneratedMenu>(
    [
      `You are KitchenOS, planning a 7-day weekly menu for a German restaurant. Reply rationale in ${lang}.`,
      `Available recipes:\n${list}`,
      `Each day MUST contain 3 recipe IDs from the list: 1 starter/soup or salad, 1 main, 1 dessert/side – pick the closest matching types if exact missing.`,
      `Balance over the week: at least 2 vegan/vegetarian mains, no two consecutive days with the same meat type, prefer using these low-stock items first: ${args.lowStockNames.join(", ") || "(none)"}.`,
      `Start date: ${args.startDate}. Return 7 consecutive days.`,
    ].join("\n"),
    '{"days":[{"date":"YYYY-MM-DD","recipeIds":["string"],"rationale":"string"}]}',
  );
}

// ---- Phase 3 helpers ----

export interface ParsedCatering {
  fromEmail?: string;
  customer?: string;
  subject?: string;
  guests: number;
  date?: string;
  dietary?: string;
  blocks: { recipeIds: string[]; notes: string }[];
  confidence?: number;
}

export async function parseCateringEmail(args: {
  body: string;
  recipes: { id: string; name: string; category: string }[];
  locale: "de" | "en";
}): Promise<ParsedCatering> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const list = args.recipes.map((r) => `${r.id}: ${r.name} (${r.category})`).join("\n");
  return generateJson<ParsedCatering>(
    [
      `You are KitchenOS, parsing an inbound German catering enquiry. Reply notes in ${lang}.`,
      `Extract: customer/company, sender email, intended date (ISO YYYY-MM-DD if derivable), guest count (integer), dietary requirements (free text in ${lang}), and group dishes into 1-3 menu BLOCKS (e.g. "vegetarian", "meat", "kids"). For each block list recipe IDs that best match using ONLY ids from the catalogue below.`,
      `Catalogue:\n${list}`,
      `Email body:\n"""${args.body}"""`,
    ].join("\n\n"),
    '{"customer":"string","fromEmail":"string","subject":"string","guests":number,"date":"YYYY-MM-DD","dietary":"string","blocks":[{"recipeIds":["string"],"notes":"string"}],"confidence":number}',
  );
}

export interface ParsedZettleItem {
  name: string;
  recipeId?: string;
  soldCount: number;
  revenue?: number;
}
export interface ParsedZettleReport {
  date?: string;
  total?: number;
  items: ParsedZettleItem[];
}

export async function parseZettleReport(args: {
  base64: string;
  recipes: { id: string; name: string }[];
}): Promise<ParsedZettleReport> {
  const list = args.recipes.map((r) => `${r.id}: ${r.name}`).join("\n");
  return generateJson<ParsedZettleReport>(
    [
      "You are reading a Zettle / iZettle Z-report (Tagesabschluss) screenshot or printout from a German restaurant POS.",
      "Extract every sold item line with its name, quantity sold and revenue in EUR. Match each item to a recipe id from the catalogue when reasonably similar (case-insensitive German match), otherwise leave recipeId empty.",
      `Catalogue:\n${list}`,
    ].join("\n\n"),
    '{"date":"YYYY-MM-DD","total":number,"items":[{"name":"string","recipeId":"string","soldCount":number,"revenue":number}]}',
    args.base64,
  );
}

export interface DistributedOrder {
  supplierId: string;
  reason?: string;
  items: { name: string; quantity: number; unit: string; inventoryId?: string; estimatedPrice?: number }[];
}
export interface DistributedOrderResult {
  orders: DistributedOrder[];
}

// ---- Phase 6A helpers ----

export interface ForecastResult {
  expectedGuests: number;
  recommendations: { recipeId: string; portions: number }[];
  rationale: string;
}

export async function aiForecast(args: {
  date: string;
  weather?: { tempC: number; rainMm: number; condition: string };
  avgGuestsPerDay: number;
  recentSales: { recipeId: string; recipeName: string; avgSold: number }[];
  isWeekend: boolean;
  locale: "de" | "en";
}): Promise<ForecastResult> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const sales = args.recentSales
    .map((s) => `${s.recipeId}: ${s.recipeName} — Ø ${s.avgSold.toFixed(1)} verkauft/Tag`)
    .join("\n");
  const weather = args.weather
    ? `${args.weather.condition}, ${args.weather.tempC.toFixed(0)}°C, ${args.weather.rainMm.toFixed(0)}mm Regen`
    : "unbekannt";
  return generateJson<ForecastResult>(
    [
      `Du bist KitchenOS Forecast-KI für eine deutsche Kantine. Antworte rationale auf ${lang}.`,
      `Datum: ${args.date} (${args.isWeekend ? "Wochenende" : "Werktag"}). Wetter: ${weather}. Ø Gäste/Tag: ${args.avgGuestsPerDay}.`,
      `Letzte 14 Tage Verkäufe pro Gericht:\n${sales}`,
      `Aufgabe: schätze Gäste-Anzahl morgen (regen/wochenende anpassen) und empfohlene Kochmenge pro Gericht (ganze Portionen).`,
      `Regel: bei Regen +20% Suppe, -15% Salat. Wochenende -25% gesamt. Vermeide Überproduktion: Empfehlung ≤ 1.1× Ø verkauft.`,
    ].join("\n\n"),
    '{"expectedGuests":number,"recommendations":[{"recipeId":"string","portions":number}],"rationale":"string"}',
  );
}

export interface HandoverSummary {
  summary: string;
  actions: string[];
}

export async function aiHandover(args: {
  transcript: string;
  locale: "de" | "en";
}): Promise<HandoverSummary> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<HandoverSummary>(
    [
      `Du bist KitchenOS Schichtübergabe-Assistent. Antworte auf ${lang}.`,
      `Fasse das gesprochene Übergabeprotokoll in 3-6 prägnanten Bullet-Points zusammen ("summary") und extrahiere konkrete Aufgaben für die nächste Schicht ("actions" — kurze Imperative wie "Techniker für Kühlung 3 anrufen").`,
      `Transkript:\n"""${args.transcript}"""`,
    ].join("\n\n"),
    '{"summary":"string","actions":["string"]}',
  );
}

export interface ResteSuggestion {
  recipes: { name: string; ingredients: string[]; steps: string[]; matchScore: number }[];
}

export async function aiResteRezepte(args: {
  leftovers: { name: string; quantity: number; unit: string }[];
  locale: "de" | "en";
}): Promise<ResteSuggestion> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const list = args.leftovers
    .map((l) => `- ${l.quantity} ${l.unit} ${l.name}`)
    .join("\n");
  return generateJson<ResteSuggestion>(
    [
      `Du bist KitchenOS Reste-Koch. Antworte auf ${lang}.`,
      `Aus diesen Resten der Kantine, schlage 3 schnelle Rezepte vor, die maximal Reste verwerten. Pro Rezept: Name, Zutatenliste, 3-5 Schritte, matchScore 0-100 (wie viel der Reste verwendet wird).`,
      `Reste:\n${list}`,
    ].join("\n\n"),
    '{"recipes":[{"name":"string","ingredients":["string"],"steps":["string"],"matchScore":number}]}',
  );
}

export interface IngredientEnrichment {
  allergens: string[];
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  co2PerKg: number;
  dgeCategory: "green" | "yellow" | "red";
}

export async function aiEnrichIngredient(args: {
  name: string;
  category: string;
}): Promise<IngredientEnrichment> {
  return generateJson<IngredientEnrichment>(
    [
      `Du bist Lebensmittelchemiker. Liefere für die folgende Zutat (deutsche Kantine) realistische Schätzwerte:`,
      `Zutat: ${args.name} (Kategorie: ${args.category})`,
      `LMIV-Allergene aus dieser Liste auswählen: gluten, milk, egg, nuts, soy, fish, shellfish, celery, mustard, sesame, sulphite, lupin, mollusc, peanut.`,
      `Nährwerte pro 100g, CO₂ in kg/kg (cradle-to-gate, EU-Schnitt). dgeCategory: green = häufig, yellow = mäßig, red = selten.`,
    ].join("\n\n"),
    '{"allergens":["string"],"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"co2PerKg":number,"dgeCategory":"green|yellow|red"}',
  );
}

export interface TrayReturnAnalysis {
  dishGuess: string;
  leftoverPct: number;
  estimatedGrams: number;
  reasonHypothesis: string;
}

export async function aiTrayReturn(args: { base64: string; locale: "de" | "en" }): Promise<TrayReturnAnalysis> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<TrayReturnAnalysis>(
    `Du bist KitchenOS Tablett-Analyse. Schau dir das zurückgebrachte Tablett an und liefere: erkanntes Gericht (dishGuess), Restanteil 0-100% (leftoverPct), geschätzte verbleibende Gramm (estimatedGrams), kurze Hypothese warum nicht aufgegessen (reasonHypothesis). Antworte auf ${lang}.`,
    '{"dishGuess":"string","leftoverPct":number,"estimatedGrams":number,"reasonHypothesis":"string"}',
    args.base64,
  );
}

export async function distributeOrder(args: {
  shortages: {
    inventoryId: string;
    name: string;
    needed: number;
    unit: string;
    category: string;
    pricePerUnit: number;
    preferredSupplierId?: string;
  }[];
  suppliers: { id: string; name: string; categories: string[] }[];
  locale: "de" | "en";
}): Promise<DistributedOrderResult> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const supplierList = args.suppliers
    .map((s) => `${s.id}: ${s.name} [${s.categories.join(",")}]`)
    .join("\n");
  const itemList = args.shortages
    .map(
      (i) =>
        `${i.inventoryId}: ${i.name} – brauche ${i.needed}${i.unit} (Kategorie: ${i.category}, €${i.pricePerUnit}/${i.unit}, bevorzugt: ${i.preferredSupplierId ?? "—"})`,
    )
    .join("\n");
  return generateJson<DistributedOrderResult>(
    [
      `You are KitchenOS auto-purchasing assistant. Group the following shortage list into one order per supplier, choosing the best matching supplier by category (or honour preferredSupplierId when present). Reply notes in ${lang}.`,
      `Suppliers:\n${supplierList}`,
      `Shortages (round up to a sensible whole-pack order quantity ≥ needed):\n${itemList}`,
      "Each order MUST list: supplierId, items (name, quantity, unit, inventoryId, estimatedPrice). Add a short reason field describing why this supplier was chosen.",
    ].join("\n\n"),
    '{"orders":[{"supplierId":"string","reason":"string","items":[{"name":"string","quantity":number,"unit":"string","inventoryId":"string","estimatedPrice":number}]}]}',
  );
}

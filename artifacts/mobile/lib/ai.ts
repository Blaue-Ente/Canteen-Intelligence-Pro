import { fetch as expoFetch } from "expo/fetch";
import { authHeaders } from "@/lib/api";

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
    headers: await authHeaders(),
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
    headers: await authHeaders(),
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
  base64Array?: string[],
): Promise<T> {
  const res = await expoFetch(`${API_BASE}/api/ai/json`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ prompt, schemaHint, base64, base64Array }),
  });
  if (!res.ok) throw new Error(`JSON failed: ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ---- Chef persona ----
// Prepended to recipe/menu generators so the LLM behaves like a master chef
// with deep knowledge of classic German canteen / Mensa cooking and the
// canonical cookbooks (Dr. Oetker Schulkochbuch, Henriette Davidis "Praktisches
// Kochbuch", Bayerisches Kochbuch / Maria Hofmann, "Mensa-Kochbuch", "Das
// große Buch der Hausmannskost", Tim Mälzer Heimat). Use this for any
// generator that should produce authentic, well-portioned, allergen-aware
// recipes / menus suitable for a German canteen.
export const CHEF_PERSONA =
  "You are KItchenOS Master Chef – a German Küchenchef with 25 years of canteen, institutional, and à-la-carte experience. " +
  "You have memorised hundreds of classic German Hausmannskost recipes (Wiener Schnitzel, Sauerbraten, Königsberger Klopse, Rouladen, Gulasch, Schweinebraten, Maultaschen, Käsespätzle, Kartoffelsuppe, Linsensuppe, Erbsensuppe, Frikadellen, Currywurst, Bratkartoffeln, Apfelstrudel, Kaiserschmarrn, Milchreis, Grießbrei, Rote Grütze …) plus regional Bavarian, Swabian, Rheinisch and Norddeutsch dishes. " +
  "You know the canonical books by heart: Dr. Oetker Schulkochbuch, Henriette Davidis Praktisches Kochbuch, Bayerisches Kochbuch (Maria Hofmann), Das große GU Kochbuch, Mensa-Kochbuch, Tim Mälzer Heimat, DGE-Ratgeber Schulverpflegung, DGE-Ratgeber Seniorenverpflegung. " +
  "You are fully trained in all four DGE-Qualitätsstandards: Schulverpflegung, Kita-Verpflegung, Krankenhausverpflegung and Senioreneinrichtungen. " +
  "You know IDDSI texture levels (3–7) for dysphagia diets, LMIV allergen labelling (14 Hauptallergene), HACCP §4 LMHV, and institutional portion sizes per age/setting. " +
  "You always cook with: realistic institutional portion sizes, exact gram weights, correct LMIV allergen letters (A–R), kcal per portion, and step-by-step German technique (anschwitzen, ablöschen, durchziehen lassen). " +
  "When generating recipes for Kita always adapt texture and portion for the age group. " +
  "When generating recipes for Senioren always flag IDDSI level and calcium/protein content. " +
  "When generating recipes for Krankenhaus always state the Kostform (VK/LVK/DK/natriumarm etc.) and flag allergens. " +
  "When asked for a recipe you give a complete, runnable recipe a Köchin can prepare today with standard kitchen equipment.";

// ---- Domain helpers ----

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  category?: string;
}

export interface ParsedPfandItem {
  name: string;
  quantity: number;
  unit: string;
  pfandValue?: number;
}

export interface ParsedReceipt {
  supplier?: string;
  date?: string;
  total?: number;
  items: ParsedReceiptItem[];
  pfandItems?: ParsedPfandItem[];
}

export async function parseReceiptImage(pages: string[]): Promise<ParsedReceipt> {
  const prompt = [
    "You are a German restaurant accountant. Read this supplier receipt or Lieferschein (may span multiple pages/photos) and extract every line item.",
    "Use German item names as printed. Convert pieces (Stk) to pcs, kilogramm to kg, liter to l. Estimate pricePerUnit if only total is shown.",
    "category may be one of: meat, dairy, vegetable, fruit, dry, spice, drink, frozen, other.",
    "IMPORTANT — Pfand/Leergut: separately identify any deposit or return items such as 'Pfand-Kiste', 'Pfandkiste', 'Rollbehälter', 'Rollbehälter-Pfand', 'Leergut', 'Pfandgut', 'Euro-Kiste', 'Gitterbox', 'Pfandflasche'. List them in pfandItems with their count, unit and pfandValue (€ per unit) when shown. Do NOT include Pfand items in the regular items array.",
  ].join("\n");
  return generateJson<ParsedReceipt>(
    prompt,
    '{"supplier":"string","date":"YYYY-MM-DD","total":number,"items":[{"name":"string","quantity":number,"unit":"kg|g|l|ml|pcs|Kiste|Karton|Bund|Sack","pricePerUnit":number,"category":"string"}],"pfandItems":[{"name":"string","quantity":number,"unit":"string","pfandValue":number}]}',
    undefined,
    pages,
  );
}

export interface OrderRequestItem {
  name: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface ParsedOrderRequest {
  items: OrderRequestItem[];
  supplierHint?: string;
  deliveryDate?: string;
}

export async function parseOrderRequest(args: {
  text: string;
  locale: "de" | "en";
}): Promise<ParsedOrderRequest> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<ParsedOrderRequest>(
    [
      `Du bist KItchenOS Bestellassistent. Analysiere den folgenden Freitext und extrahiere eine strukturierte Bestellliste (Bestellliste) für einen Lebensmittellieferanten. Antworte auf ${lang}.`,
      `Erkenne Mengen, Einheiten (kg, g, l, ml, Stk, Kiste, Bund, Packung, Flasche, Kanister, Sack, Beutel, Karton, Palette) und Artikelnamen. Füge optionale Notizen pro Artikel hinzu wenn vorhanden.`,
      `Erkenne auch Pfand-Rückgaben wie "Rollbehälter zurück", "Pfandkisten zurückgeben" und liste sie als Artikel mit negativer Menge ODER als Notiz.`,
      `Wenn ein Lieferantenname erwähnt wird (z.B. "bei Metro bestellen", "Frischemarkt Müller"), gib ihn in supplierHint an.`,
      `Wenn ein Lieferdatum genannt wird ("morgen", "Freitag", "15.05."), gib es als ISO-Datum (YYYY-MM-DD) in deliveryDate an.`,
      `Freitext:\n"""${args.text}"""`,
    ].join("\n\n"),
    '{"items":[{"name":"string","quantity":number,"unit":"string","note":"string"}],"supplierHint":"string","deliveryDate":"YYYY-MM-DD"}',
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
      CHEF_PERSONA,
      `Plan a 7-day weekly menu for a German canteen. Reply rationale in ${lang}.`,
      `Available recipes:\n${list}`,
      `Each day MUST contain EXACTLY 4 recipe IDs from the list, in this fixed order:`,
      `  1) SOUP — type='soup' (Suppe).`,
      `  2) VEGETARIAN MAIN — type='main' AND category in {vegan, vegetarian}.`,
      `  3) MEAT MAIN — type='main' AND category in {meat, fish}.`,
      `  4) HEALTHY SURPRISE — a delightful, light, nutritious option that varies day-to-day: a fresh salad bowl, a vegan grain bowl, a fish dish, a colorful side, or a light dessert (yogurt/fruit). Should feel like a pleasant change of pace and complement the other three. Avoid heavy fried/creamy dishes for this slot.`,
      `If an EXACT type/category match is missing in the available recipes, pick the closest matching one rather than skipping the slot — every day must have 4 IDs.`,
      `Balance over the week: rotate cuisines (German, Italian, Asian, etc.); no two consecutive days with the same meat type for slot 3; vary the surprise slot across the 7 days. Prefer using these low-stock items first: ${args.lowStockNames.join(", ") || "(none)"}.`,
      `Start date: ${args.startDate}. Return 7 consecutive days.`,
    ].join("\n"),
    '{"days":[{"date":"YYYY-MM-DD","recipeIds":["string","string","string","string"],"rationale":"string"}]}',
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
      `You are KItchenOS, parsing an inbound German catering enquiry. Reply notes in ${lang}.`,
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
      `Du bist KItchenOS Forecast-KI für eine deutsche Kantine. Antworte rationale auf ${lang}.`,
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
      `Du bist KItchenOS Schichtübergabe-Assistent. Antworte auf ${lang}.`,
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
      `Du bist KItchenOS Reste-Koch. Antworte auf ${lang}.`,
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
    `Du bist KItchenOS Tablett-Analyse. Schau dir das zurückgebrachte Tablett an und liefere: erkanntes Gericht (dishGuess), Restanteil 0-100% (leftoverPct), geschätzte verbleibende Gramm (estimatedGrams), kurze Hypothese warum nicht aufgegessen (reasonHypothesis). Antworte auf ${lang}.`,
    '{"dishGuess":"string","leftoverPct":number,"estimatedGrams":number,"reasonHypothesis":"string"}',
    args.base64,
  );
}

// ---- Phase 6B helpers ----

export interface ParsedMenuItem {
  name: string;
  description?: string;
  price: number;
  category?: "starter" | "soup" | "salad" | "main" | "dessert" | "drink" | "side" | "other";
  type?: "vegan" | "vegetarian" | "fish" | "meat" | "other";
  allergens?: string[];
  /**
   * Day this dish is planned for, as extracted from the menu.
   * Can be a full German or English weekday name ("Montag", "Monday"),
   * a short abbreviation ("Mo", "Di", "Mon", "Tue"),
   * or an ISO date ("YYYY-MM-DD").
   * Null/undefined = menu has no per-day assignment.
   */
  day?: string | null;
}
export interface ParsedMenu {
  restaurantName?: string;
  /** True when the menu contains explicit per-day dish assignments. */
  hasWeeklyPlan?: boolean;
  items: ParsedMenuItem[];
}

export async function parseMenuPdf(args: {
  base64: string;
  locale: "de" | "en";
}): Promise<ParsedMenu> {
  const res = await expoFetch(`${API_BASE}/api/ai/parse-menu-pdf`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ base64: args.base64, locale: args.locale }),
  });
  if (!res.ok) {
    let msg = `PDF parse failed: ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const json = (await res.json()) as { data: ParsedMenu };
  return json.data;
}

export interface GeneratedRecipe {
  nameDe: string;
  name: string;
  type: "soup" | "main" | "salad" | "dessert" | "side" | "drink";
  category: "vegan" | "vegetarian" | "meat" | "fish" | "kids";
  meat: "beef" | "pork" | "chicken" | "lamb" | "turkey" | "none";
  portionGrams: number;
  allergens: string[];
  stepsDe: string[];
  steps: string[];
  basePrice: number;
  sellPrice: number;
  cookTimeMin: number;
  kcalPerPortion: number;
}

export async function generateRecipe(args: {
  idea?: string;
  availableIngredients?: string[];
  locale: "de" | "en";
}): Promise<GeneratedRecipe> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const ideaPart = args.idea
    ? `Compose ONE complete recipe matching the user's idea: "${args.idea}".`
    : "";
  const mixerPart = args.availableIngredients && args.availableIngredients.length > 0
    ? `The cook has these ingredients on hand: ${args.availableIngredients.join(", ")}. Choose ONE delicious dish from your cookbook knowledge that uses MOSTLY these ingredients (assume basic pantry: salt, pepper, oil, butter, flour, sugar, herbs, spices). Prefer authentic classics over fusion.`
    : "";
  return generateJson<GeneratedRecipe>(
    [
      CHEF_PERSONA,
      ideaPart,
      mixerPart,
      `Always provide both nameDe (Deutsch) and name (English), and both stepsDe (Deutsch) and steps (English). Reply notes in ${lang}.`,
      `Constraints: portionGrams 250-450, 4-8 numbered cooking steps, allergens use ONLY these tokens: gluten, milk, egg, nuts, soy, fish, shellfish, celery, mustard, sesame, sulphite, lupin, mollusc, peanut. Realistic basePrice (food cost EUR per portion) and sellPrice (canteen list price EUR), cookTimeMin (active+passive), integer kcalPerPortion.`,
    ].filter(Boolean).join("\n\n"),
    '{"nameDe":"string","name":"string","type":"soup|main|salad|dessert|side|drink","category":"vegan|vegetarian|meat|fish|kids","meat":"beef|pork|chicken|lamb|turkey|none","portionGrams":number,"allergens":["string"],"stepsDe":["string"],"steps":["string"],"basePrice":number,"sellPrice":number,"cookTimeMin":number,"kcalPerPortion":number}',
  );
}

export async function detectIngredientsFromPhoto(args: {
  base64: string;
  locale: "de" | "en";
}): Promise<{ ingredients: string[] }> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<{ ingredients: string[] }>(
    `You are a kitchen vision assistant. Look at this photo and list every distinct edible ingredient you can identify (raw vegetables, fruits, packaged products, meats, fish, dairy, herbs, spices visible). Reply with concise ingredient names in ${lang}, no quantities, no prepositions.`,
    '{"ingredients":["string"]}',
    args.base64,
  );
}

export async function parseMenuImage(args: {
  base64: string;
  locale: "de" | "en";
}): Promise<ParsedMenu> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<ParsedMenu>(
    [
      `You are KItchenOS menu reader. The photo shows a printed restaurant/canteen menu (Speisekarte). Reply names in ${lang}.`,
      `Extract every dish line. For each: name, optional short description, price in EUR (parse "8,50 €" or "€8.50"), category (starter/soup/salad/main/dessert/drink/side/other), type (vegan/vegetarian/fish/meat/other based on description), allergen letters/numbers if printed (map common LMIV codes A/1=gluten, C/3=egg, G/7=milk, H/8=nuts, F/6=soy, D/4=fish, B/2=shellfish, L/9=celery, M/13=mustard, N/14=sesame, etc.).`,
      `IMPORTANT — day assignment: if the menu organises dishes by weekday (e.g. "Montag", "Mo", "Monday", "Lundi", a date like "12.05.", "2026-05-12"), set the "day" field to the FULL German weekday name (Montag/Dienstag/Mittwoch/Donnerstag/Freitag/Samstag/Sonntag) or to an ISO date (YYYY-MM-DD) if an exact date is printed. If no day grouping exists, set "day" to null.`,
      `Also set "hasWeeklyPlan": true at the root level when you find any day groupings, false otherwise.`,
      `Skip headers, footers, prices-only legends, allergen tables.`,
    ].join("\n\n"),
    '{"restaurantName":"string","hasWeeklyPlan":true,"items":[{"name":"string","description":"string","price":number,"category":"starter|soup|salad|main|dessert|drink|side|other","type":"vegan|vegetarian|fish|meat|other","allergens":["string"],"day":"Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|YYYY-MM-DD|null"}]}',
    args.base64,
  );
}

export interface DishVisionResult {
  dishGuess: string;
  kcalPerPortion: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  notes?: string;
}

// ---- Dish Performance Analysis ----

export interface DishAnalysisInput {
  recipeId: string;
  nameDe: string;
  category: string;
  sold: number;
  revenue: number;
  marginPct: number;
  wasteRatioPct: number;
  daysOnMenu: number;
}

export interface DishAnalysisResult {
  topDishes: { recipeId: string; reason: string }[];
  dropDishes: { recipeId: string; reason: string }[];
  tips: string[];
}

export async function aiDishAnalysis(args: {
  dishes: DishAnalysisInput[];
  locale: "de" | "en";
}): Promise<DishAnalysisResult> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const rows = args.dishes
    .map(
      (d) =>
        `- ${d.nameDe} (${d.category}): ${d.sold} Port. verkauft, €${d.revenue.toFixed(0)} Umsatz, Marge ${d.marginPct.toFixed(0)}%, Verlustquote ${d.wasteRatioPct.toFixed(0)}%, ${d.daysOnMenu} Tage in Karte`,
    )
    .join("\n");
  return generateJson<DishAnalysisResult>(
    [
      `Du bist KItchenOS Speisekarten-Analyst für eine deutsche Mensa. Antworte auf ${lang}.`,
      `Analysiere die folgenden Gerichte nach Umsatz, Marge, Absatz und Verlustquote. Empfehle:`,
      `- topDishes: 1-3 Gerichte, die weiterhin gesetzt werden sollten (hoher Absatz, gute Marge, niedriger Verlust)`,
      `- dropDishes: 1-3 Gerichte, die vom Speiseplan gestrichen oder überarbeitet werden sollten (niedrige Marge, hoher Verlust, wenig Absatz)`,
      `- tips: 2-4 konkrete Handlungsempfehlungen auf Basis der Daten (z.B. Portionsgröße anpassen, Preis erhöhen, Zutaten wechseln)`,
      `Gerichte:\n${rows}`,
    ].join("\n\n"),
    '{"topDishes":[{"recipeId":"string","reason":"string"}],"dropDishes":[{"recipeId":"string","reason":"string"}],"tips":["string"]}',
  );
}

export async function aiDishVision(args: {
  base64: string;
  locale: "de" | "en";
}): Promise<DishVisionResult> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  return generateJson<DishVisionResult>(
    [
      `Du bist Lebensmittelchemiker und Gastronom. Antworte notes auf ${lang}.`,
      `Identifiziere das Gericht auf dem Foto und schätze Nährwerte pro Portion (kcal, Protein g, KH g, Fett g) sowie LMIV-Allergene.`,
      `Allergene NUR aus: gluten, milk, egg, nuts, soy, fish, shellfish, celery, mustard, sesame, sulphite, lupin, mollusc, peanut.`,
    ].join("\n\n"),
    '{"dishGuess":"string","kcalPerPortion":number,"proteinG":number,"carbsG":number,"fatG":number,"allergens":["string"],"notes":"string"}',
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
      `You are KItchenOS auto-purchasing assistant. Group the following shortage list into one order per supplier, choosing the best matching supplier by category (or honour preferredSupplierId when present). Reply notes in ${lang}.`,
      `Suppliers:\n${supplierList}`,
      `Shortages (round up to a sensible whole-pack order quantity ≥ needed):\n${itemList}`,
      "Each order MUST list: supplierId, items (name, quantity, unit, inventoryId, estimatedPrice). Add a short reason field describing why this supplier was chosen.",
    ].join("\n\n"),
    '{"orders":[{"supplierId":"string","reason":"string","items":[{"name":"string","quantity":number,"unit":"string","inventoryId":"string","estimatedPrice":number}]}]}',
  );
}

// ---- Event Offer Generator ----

export interface EventOfferTotals {
  foodCost: number;
  staffCost: number;
  equipmentCost: number;
  transportCost: number;
  overhead: number;
  vatAmount: number;
  grandTotal: number;
  perPerson: number;
}

export interface EventOfferInput {
  title: string;
  clientName: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  guestCount: number;
  notes?: string;
  menuItems: { name: string; portions: number; pricePerPortion: number }[];
  totals: EventOfferTotals;
  locale: "de" | "en";
}

export async function generateEventOffer(input: EventOfferInput): Promise<string> {
  const lang = input.locale === "de" ? "German" : "English";
  const lines = [
    `You are a professional German catering company's office manager. Write a formal catering offer (Angebot) in ${lang}.`,
    `Event: "${input.title}"`,
    `Client: ${input.clientName}`,
    `Date: ${input.eventDate}${input.eventTime ? " " + input.eventTime : ""}`,
    input.venue ? `Venue: ${input.venue}` : "",
    `Guests: ${input.guestCount}`,
    input.notes ? `Special notes: ${input.notes}` : "",
    "",
    "Menu:",
    ...input.menuItems.map(
      (m) =>
        `  - ${m.name}: ${m.portions} Portionen × €${m.pricePerPortion.toFixed(2)} = €${(m.portions * m.pricePerPortion).toFixed(2)}`,
    ),
    "",
    "Cost summary:",
    `  Wareneinsatz: €${input.totals.foodCost.toFixed(2)}`,
    input.totals.staffCost > 0
      ? `  Personal: €${input.totals.staffCost.toFixed(2)}`
      : "",
    input.totals.equipmentCost > 0
      ? `  Ausstattung: €${input.totals.equipmentCost.toFixed(2)}`
      : "",
    input.totals.transportCost > 0
      ? `  Transport: €${input.totals.transportCost.toFixed(2)}`
      : "",
    `  Gemeinkosten: €${input.totals.overhead.toFixed(2)}`,
    `  MwSt.: €${input.totals.vatAmount.toFixed(2)}`,
    `  Gesamtbetrag: €${input.totals.grandTotal.toFixed(2)}`,
    `  Pro Person: €${input.totals.perPerson.toFixed(2)}`,
    "",
    "Write a professional, courteous offer letter of 150–250 words. Include a reference number placeholder [ANGEBOT-XXXX], today's date, all key event details, itemised menu with prices, the cost summary, payment terms (Zahlungsziel 14 Tage netto), and a warm German closing (Wir freuen uns auf Ihre Rückmeldung). Return ONLY the plain offer text — no JSON, no markdown, no code blocks.",
  ].filter(Boolean);

  return generateJson<string>(
    lines.join("\n"),
    '"string – the complete offer letter as plain text"',
  );
}

// ── T010: Supplier price-list ingest (email body / pasted PDF text) ─────────

export interface ParsedPriceListItem {
  /** Original ingredient name as printed by the supplier (German preferred). */
  name: string;
  /** Unit such as kg, l, Stk, Karton, Bund. */
  unit: string;
  /** Net price per unit in EUR. */
  pricePerUnit: number;
  /** Optional supplier SKU / Artikelnummer. */
  code?: string;
  category?: string;
}

export interface ParsedPriceList {
  supplier?: string;
  /** ISO YYYY-MM-DD start of validity if printed. */
  validFrom?: string;
  validTo?: string;
  items: ParsedPriceListItem[];
}

/**
 * Parse a free-form supplier price list (email body, PDF text, WhatsApp dump).
 * Returns structured price entries usable for price-history / order calc.
 */
export async function parseSupplierPriceList(args: { text: string; locale: "de" | "en" }): Promise<ParsedPriceList> {
  const lang = args.locale === "de" ? "Deutsch" : "English";
  const prompt = [
    `You are a German Großhandel buyer. Parse this supplier price list (email body, PDF text or WhatsApp dump) into structured items.`,
    `Output language: ${lang}. Use German item names exactly as printed.`,
    `Detect the supplier name from header/footer if possible. Detect validFrom/validTo dates if printed (Gültig ab / Gültig bis / Preisliste KW…).`,
    `Convert pieces (Stk, St., Stück) → "pcs", Kilogramm → "kg", Liter → "l", Gramm → "g", Milliliter → "ml". Keep "Kiste", "Karton", "Bund", "Sack" verbatim.`,
    `category may be: meat, dairy, vegetable, fruit, dry, spice, drink, frozen, other.`,
    `Use the NET price per unit (€). Skip Pfand/Leergut, headlines and totals.`,
    "",
    "TEXT:",
    args.text,
  ].join("\n");
  return generateJson<ParsedPriceList>(
    prompt,
    '{"supplier":"string","validFrom":"YYYY-MM-DD","validTo":"YYYY-MM-DD","items":[{"name":"string","unit":"kg|g|l|ml|pcs|Kiste|Karton|Bund|Sack","pricePerUnit":number,"code":"string","category":"string"}]}',
  );
}

// ── Recipe book import ────────────────────────────────────────────────────────
// Accepts a PDF (base64) or raw text (JSONL / CSV). Returns structured recipes
// ready to be dispatched into the app's local recipe library.

export interface ImportedRecipe {
  nameDe: string;
  name: string;
  type: "soup" | "main" | "salad" | "dessert" | "side" | "drink";
  category: "vegan" | "vegetarian" | "meat" | "fish" | "kids";
  meat: "beef" | "pork" | "chicken" | "lamb" | "turkey" | "none";
  portionGrams: number;
  basePrice: number;
  sellPrice: number;
  cookTimeMin: number;
  kcalPerPortion?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  allergens: string[];
  stepsDe: string[];
  steps: string[];
  ingredients: [];
}

export async function importRecipesFromSource(args: {
  base64?: string;
  text?: string;
  locale: "de" | "en";
}): Promise<ImportedRecipe[]> {
  const res = await expoFetch(`${API_BASE}/api/ai/import-recipes`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ base64: args.base64, text: args.text, locale: args.locale }),
  });
  if (!res.ok) {
    let msg = `Import failed: ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const json = (await res.json()) as { recipes: ImportedRecipe[] };
  return json.recipes ?? [];
}

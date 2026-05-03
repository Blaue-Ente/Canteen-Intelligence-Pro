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

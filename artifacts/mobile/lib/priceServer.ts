import { fetch as expoFetch } from "expo/fetch";

import type { PriceListEntry, PriceServerConfig } from "@/types";

export interface PriceSyncResult {
  entries: PriceListEntry[];
  syncedAt: string;
  count: number;
}

export async function syncPriceList(config: PriceServerConfig): Promise<PriceSyncResult> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (config.authType === "basic" && config.username && config.password) {
    const encoded = btoa(`${config.username}:${config.password}`);
    headers["Authorization"] = `Basic ${encoded}`;
  } else if (config.authType === "bearer" && config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  } else if (config.authType === "apiKey" && config.apiKey) {
    const headerName = config.apiKeyHeader?.trim() || "X-Api-Key";
    headers[headerName] = config.apiKey;
  }

  const res = await expoFetch(config.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText || "Fehler"}`);

  const data = (await res.json()) as unknown;
  let raw: unknown[] = [];

  if (Array.isArray(data)) {
    raw = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate =
      obj.articles ?? obj.items ?? obj.products ?? obj.prices ?? obj.data;
    if (Array.isArray(candidate)) raw = candidate as unknown[];
  }

  const entries: PriceListEntry[] = raw
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map((r) => ({
      code:
        typeof r.code === "string"
          ? r.code
          : typeof r.id === "string"
            ? r.id
            : typeof r.artikelNr === "string"
              ? r.artikelNr
              : undefined,
      name: String(
        r.name ?? r.artikel ?? r.bezeichnung ?? r.description ?? r.Name ?? "",
      ),
      unit: String(r.unit ?? r.einheit ?? r.unitOfMeasure ?? r.Unit ?? "Stk"),
      pricePerUnit: Number(
        r.pricePerUnit ?? r.price ?? r.preis ?? r.unitPrice ?? r.Price ?? 0,
      ),
      supplier:
        typeof r.supplier === "string"
          ? r.supplier
          : typeof r.lieferant === "string"
            ? r.lieferant
            : undefined,
      category:
        typeof r.category === "string"
          ? r.category
          : typeof r.kategorie === "string"
            ? r.kategorie
            : undefined,
      validFrom: typeof r.validFrom === "string" ? r.validFrom : undefined,
      validTo: typeof r.validTo === "string" ? r.validTo : undefined,
    }))
    .filter((e) => e.name.trim().length > 0 && e.pricePerUnit >= 0);

  return { entries, syncedAt: new Date().toISOString(), count: entries.length };
}

/**
 * T010 — Diff a freshly-parsed supplier price list against the current
 * `priceList` and the latest `priceHistory` per ingredient. Surfaces:
 *  - new items (no prior reference)
 *  - increased prices > threshold (5 % default)
 *  - decreased prices > threshold
 *  - unchanged
 *
 * Used by `procurement.tsx` to flag suspicious price hikes before staff
 * accepts a new pricelist.
 */

import type {
  IngredientPriceHistory,
  InventoryItem,
  PriceListEntry,
} from "@/types";
import type { ParsedPriceListItem } from "@/lib/ai";

export type PriceChangeKind = "new" | "increase" | "decrease" | "unchanged";

export interface PriceChange {
  parsed: ParsedPriceListItem;
  /** Matched inventory item (by fuzzy name) if any. */
  inventoryId?: string;
  /** Matched inventory display name (German). */
  matchedName?: string;
  /** Previous reference price (€/unit) — the most recent of priceList or priceHistory. */
  previousPrice?: number;
  /** % change vs previousPrice (positive = more expensive). */
  changePct: number;
  kind: PriceChangeKind;
}

const INCREASE_THRESHOLD_PCT = 5;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Best-effort fuzzy match: substring or token overlap. */
function matchInventory(name: string, inventory: InventoryItem[]): InventoryItem | undefined {
  const n = normalize(name);
  if (!n) return undefined;
  // Exact / contains
  const exact = inventory.find((i) =>
    normalize(i.nameDe) === n || normalize(i.name) === n,
  );
  if (exact) return exact;
  const contains = inventory.find((i) =>
    normalize(i.nameDe).includes(n) || normalize(i.name).includes(n) || n.includes(normalize(i.nameDe)),
  );
  if (contains) return contains;
  // Token overlap
  const tokens = n.split(/\s+/).filter((t) => t.length >= 4);
  if (tokens.length === 0) return undefined;
  return inventory.find((i) => {
    const inv = normalize(i.nameDe);
    return tokens.some((t) => inv.includes(t));
  });
}

function latestHistoryPrice(
  history: IngredientPriceHistory[],
  inventoryId: string,
  supplier?: string,
): number | undefined {
  const matches = history
    .filter((h) => h.inventoryId === inventoryId && (!supplier || !h.supplierId || h.supplierId === supplier))
    .sort((a, b) => b.date.localeCompare(a.date));
  return matches[0]?.price;
}

export function diffPriceList(args: {
  parsed: ParsedPriceListItem[];
  inventory: InventoryItem[];
  priceList: PriceListEntry[];
  priceHistory: IngredientPriceHistory[];
  /** Optional supplier id used to scope priceHistory lookups. */
  supplierId?: string;
}): PriceChange[] {
  const { parsed, inventory, priceList, priceHistory, supplierId } = args;
  const out: PriceChange[] = [];

  for (const item of parsed) {
    const inv = matchInventory(item.name, inventory);
    const inventoryId = inv?.id;

    // Look in priceList first (current ref), then priceHistory.
    let previousPrice: number | undefined;
    if (inventoryId) {
      const fromHist = latestHistoryPrice(priceHistory, inventoryId, supplierId);
      if (fromHist !== undefined) previousPrice = fromHist;
    }
    if (previousPrice === undefined) {
      const matchByName = priceList.find(
        (p) => normalize(p.name) === normalize(item.name)
            || (item.code && p.code === item.code),
      );
      if (matchByName) previousPrice = matchByName.pricePerUnit;
    }

    let changePct = 0;
    let kind: PriceChangeKind = "new";
    if (previousPrice !== undefined && previousPrice > 0) {
      changePct = ((item.pricePerUnit - previousPrice) / previousPrice) * 100;
      if (changePct > INCREASE_THRESHOLD_PCT) kind = "increase";
      else if (changePct < -INCREASE_THRESHOLD_PCT) kind = "decrease";
      else kind = "unchanged";
    }

    out.push({
      parsed: item,
      inventoryId,
      matchedName: inv?.nameDe,
      previousPrice,
      changePct,
      kind,
    });
  }

  // Order: increases first (most alarming), then new, then decreases, then unchanged.
  const order: Record<PriceChangeKind, number> = {
    increase: 0, new: 1, decrease: 2, unchanged: 3,
  };
  out.sort((a, b) => {
    const d = order[a.kind] - order[b.kind];
    if (d !== 0) return d;
    return Math.abs(b.changePct) - Math.abs(a.changePct);
  });
  return out;
}

/**
 * Merge accepted parsed entries into a fresh PriceListEntry[] using the
 * existing list as a base (replace by name+unit match).
 */
export function mergePriceList(args: {
  base: PriceListEntry[];
  accepted: ParsedPriceListItem[];
  supplier?: string;
  validFrom?: string;
  validTo?: string;
}): PriceListEntry[] {
  const { base, accepted, supplier, validFrom, validTo } = args;
  const out: PriceListEntry[] = [...base];
  for (const item of accepted) {
    const idx = out.findIndex(
      (p) => normalize(p.name) === normalize(item.name) && p.unit === item.unit,
    );
    const entry: PriceListEntry = {
      code: item.code,
      name: item.name,
      unit: item.unit,
      pricePerUnit: item.pricePerUnit,
      supplier,
      category: item.category,
      validFrom,
      validTo,
    };
    if (idx >= 0) out[idx] = entry;
    else out.push(entry);
  }
  return out;
}

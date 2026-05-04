/**
 * T013b — HACCP auto-suggestions.
 *
 * For every active StorageLocation with a `targetTemp`, generate predicted
 * HACCP entries for today's morning + afternoon slots. The predicted
 * temperature is the median of the last 7 days for that location with a small
 * deterministic jitter so each slot looks plausible (and so the operator
 * actually has to sanity-check the value before confirming).
 *
 * The suggestions are NOT persisted — they're recomputed every render from
 * `state.haccp` + `state.storageLocations`. Once a suggestion is confirmed,
 * an `HaccpLog` with `source="auto-suggest"` and `suggestionId=<id>` is
 * created so the same slot is filtered out on the next render.
 */

import type { HaccpLog, HaccpSuggestion, StorageLocation, StorageLocationCategory } from "@/types";

/** Map a storage category to the matching HACCP entry type. */
const CAT_TO_TYPE: Record<StorageLocationCategory, HaccpLog["type"]> = {
  fridge: "fridge",
  freezer: "freezer",
  delivery: "delivery",
  kitchen: "cooking",
  room: "cleaning",
};

/**
 * Default daily slots per category. Catering/Gastro convention:
 * fridges twice (after morning prep, before service close), freezers once,
 * cooking continuously (we surface a single afternoon slot for hot-keep).
 */
const SLOTS_BY_CAT: Partial<Record<StorageLocationCategory, { hour: number; label: string }[]>> = {
  fridge:   [{ hour: 9, label: "Morgen 09:00" }, { hour: 17, label: "Nachmittag 17:00" }],
  freezer:  [{ hour: 9, label: "Morgen 09:00" }],
  delivery: [],
  kitchen:  [{ hour: 12, label: "Mittag 12:00" }],
  room:     [],
};

/** Legal range (°C) by HACCP type — used to pre-mark `ok` and to clamp jitter. */
const LEGAL_RANGE: Record<HaccpLog["type"], { min?: number; max?: number }> = {
  fridge:   { max: 7 },
  freezer:  { max: -18 },
  delivery: { max: 7 },
  cooking:  { min: 65 },
  cleaning: {},
};

/** Median of an array (returns 0 for empty). */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Deterministic 0..1 hash from a string (so the same slot gets the same jitter). */
function jitter01(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

/** Round to 1 decimal — temperature display precision. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface Args {
  storageLocations: StorageLocation[];
  haccp: HaccpLog[];
  /** Reference "now" — defaults to wall clock; explicit param makes tests deterministic. */
  now?: Date;
}

/**
 * Build today's predicted HACCP entries. Skips slots that already have a
 * confirmed log (manual or auto-suggest) for the same storage + slot hour.
 */
export function buildHaccpSuggestions({ storageLocations, haccp, now = new Date() }: Args): HaccpSuggestion[] {
  // Use the operator's LOCAL day boundary, not UTC. A canteen in Berlin starts
  // its shift at local 09:00, which in CEST is 07:00Z — anchoring slots in UTC
  // would push the ±90min dedup window 2h off and re-suggest already-logged slots.
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const localDay = new Date(y, m, d, 0, 0, 0, 0);
  const today = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const sevenDaysAgoMs = localDay.getTime() - 7 * 86_400_000;
  const sevenDaysAgo = new Date(sevenDaysAgoMs).toISOString().slice(0, 10);

  const out: HaccpSuggestion[] = [];

  for (const loc of storageLocations) {
    if (loc.targetTemp === undefined) continue;
    const slots = SLOTS_BY_CAT[loc.category] ?? [];
    if (slots.length === 0) continue;
    const type = CAT_TO_TYPE[loc.category];
    const range = LEGAL_RANGE[type] ?? {};

    // Recent history for this location (matched by name to keep schema flexible).
    const recent = haccp
      .filter((h) => h.location === loc.name && h.date.slice(0, 10) >= sevenDaysAgo && h.temperature !== undefined)
      .map((h) => h.temperature as number);
    const baseline = recent.length > 0 ? median(recent) : loc.targetTemp;

    for (const slot of slots) {
      const slotId = `${loc.id}__${today}__${slot.hour}`;

      // Local-time anchor for this slot. ±90min window catches early/late checks.
      const slotMs = new Date(y, m, d, slot.hour, 0, 0, 0).getTime();
      const alreadyDone = haccp.some((h) => {
        if (h.location !== loc.name) return false;
        const t = new Date(h.date).getTime();
        return Math.abs(t - slotMs) < 90 * 60_000;
      });
      if (alreadyDone) continue;

      // Predicted temp = baseline + small deterministic jitter (-0.4 .. +0.4 °C).
      const j = (jitter01(slotId) - 0.5) * 0.8;
      let suggested = r1(baseline + j);

      // Hard-clamp inside the legal envelope so we never suggest a non-conformant value.
      if (range.max !== undefined && suggested > range.max - 0.2) suggested = r1(range.max - 0.6);
      if (range.min !== undefined && suggested < range.min + 0.2) suggested = r1(range.min + 0.6);

      out.push({
        id: slotId,
        storageLocationId: loc.id,
        locationName: loc.name,
        type,
        suggestedTemp: suggested,
        legalMin: range.min,
        legalMax: range.max,
        slot: slot.label,
        dueAt: new Date(slotMs).toISOString(),
        reason: recent.length > 0
          ? `Median der letzten ${recent.length} Tage`
          : `Sollwert ${loc.targetTemp} °C`,
      });
    }
  }

  // Stable sort by due time so morning slots come first.
  out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return out;
}

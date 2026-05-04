/**
 * T013d — Rückstellproben helper (LMHV §11 Abs. 3).
 *
 * Generates `FoodSample` records that staff still has to physically take
 * (label + bag + put in the sample fridge). The UI lets the user one-tap
 * confirm, attach a photo, or skip.
 */

import type { FoodSample, Recipe, StorageLocation } from "@/types";

/** ISO date `n` days from `from` (defaults to today). */
function isoPlus(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Pick the default sample storage: explicit override → first "fridge" → undefined. */
export function pickSampleStorage(
  storageLocations: StorageLocation[],
  overrideId?: string,
): StorageLocation | undefined {
  if (overrideId) {
    const m = storageLocations.find((s) => s.id === overrideId);
    if (m) return m;
  }
  return storageLocations.find((s) => s.category === "fridge");
}

interface BuildArgs {
  recipes: Recipe[];
  /** recipeId → portions cooked in this batch. */
  batch: Record<string, number>;
  batchId?: string;
  storageLocations: StorageLocation[];
  sampleStorageLocationId?: string;
  /** Per-recipe sample size (g). Defaults to 100 g per LMHV recommendation. */
  amountGrams?: number;
  /** ID generator — passed in so caller can use AppContext.newId. */
  newId: () => string;
  /** Source provenance (production / event). */
  source: "auto-production" | "auto-event";
  /** Reference "now" timestamp for testability. */
  now?: Date;
}

/**
 * Build pending Rückstellproben for every recipe in a production batch.
 * Returns one `FoodSample` per recipeId, with `taken=false` (UI must confirm).
 */
export function buildSamplesForBatch(args: BuildArgs): FoodSample[] {
  const now = args.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const storage = pickSampleStorage(args.storageLocations, args.sampleStorageLocationId);
  const amount = args.amountGrams ?? 100;

  const out: FoodSample[] = [];
  for (const [recipeId, portions] of Object.entries(args.batch)) {
    if (portions <= 0) continue;
    const recipe = args.recipes.find((r) => r.id === recipeId);
    if (!recipe) continue;
    out.push({
      id: args.newId(),
      date,
      recipeId,
      recipeName: recipe.name,
      batchId: args.batchId,
      amountGrams: amount,
      storageLocationId: storage?.id,
      storageLocationName: storage?.name,
      retentionUntil: isoPlus(7, now),
      taken: false,
      source: args.source,
    });
  }
  return out;
}

/**
 * Filter still-relevant samples (today's pending + ones whose retention period
 * hasn't fully expired yet — kept for 1 extra day so staff can review).
 */
export function activeSamples(samples: FoodSample[], now: Date = new Date()): FoodSample[] {
  const cutoff = isoPlus(-1, now);
  return samples.filter((s) => s.retentionUntil >= cutoff);
}

/** Pending samples for "today still to physically take". */
export function pendingToday(samples: FoodSample[], now: Date = new Date()): FoodSample[] {
  const today = now.toISOString().slice(0, 10);
  return samples.filter((s) => !s.taken && s.date === today);
}

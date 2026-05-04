/**
 * Money helpers — single source of truth for EUR arithmetic.
 *
 * JavaScript floats cannot represent decimal cents exactly
 * (`0.1 + 0.2 === 0.30000000000000004`). Naive sums of EUR amounts therefore
 * drift, which on tax-relevant invoices can yield 1-2 cent mismatches between
 * line totals and grand totals — a real fiscal risk.
 *
 * Strategy: convert to integer cents, do all arithmetic on integers, convert
 * back at the boundary. All exported helpers accept and return EUR (number)
 * but internally use cents.
 *
 * Usage:
 *   const total = sumMoney(items.map((i) => mulMoney(i.qty, i.unitPrice)));
 *   format(total) // "12.34"
 */

/** Convert EUR (e.g. 12.345) to integer cents (1235). Half-away-from-zero. */
export function toCents(eur: number): number {
  if (!Number.isFinite(eur)) return 0;
  // Add a tiny epsilon then floor — handles 0.1+0.2 style binary noise reliably
  // for inputs up to ~10^12 EUR (more than enough for catering invoices).
  return Math.round(eur * 100);
}

/** Convert integer cents back to EUR. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Add an arbitrary number of EUR amounts with no float drift. */
export function sumMoney(values: readonly number[]): number {
  let cents = 0;
  for (const v of values) cents += toCents(v);
  return fromCents(cents);
}

/** Add two EUR amounts. */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/** Subtract b from a (EUR). */
export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiply EUR by a (possibly fractional) quantity. The quantity is treated
 * as an arbitrary float (e.g. 1.5 portions, 3.25 kg); the result is rounded
 * to whole cents.
 */
export function mulMoney(eur: number, qty: number): number {
  if (!Number.isFinite(eur) || !Number.isFinite(qty)) return 0;
  return Math.round(toCents(eur) * qty) / 100;
}

/** Apply a percentage (e.g. 19 for 19%) to an EUR amount, rounded to cents. */
export function pctOfMoney(eur: number, pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(toCents(eur) * pct) / 10000;
}

/** Round any EUR amount to whole cents. */
export function roundMoney(eur: number): number {
  return fromCents(toCents(eur));
}

/** Locale-aware EUR formatter — always 2 decimals, German number style. */
export function formatEUR(
  eur: number,
  opts?: { withSymbol?: boolean; locale?: "de" | "en" },
): string {
  const safe = Number.isFinite(eur) ? roundMoney(eur) : 0;
  const fmt = new Intl.NumberFormat(opts?.locale === "en" ? "en-IE" : "de-DE", {
    style: opts?.withSymbol === false ? "decimal" : "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return fmt.format(safe);
}

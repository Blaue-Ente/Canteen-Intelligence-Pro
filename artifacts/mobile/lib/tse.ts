/**
 * T011 — TSE client wrapper for the mobile cash-register screen.
 *
 * Three responsibilities:
 *   1. Call /api/tse/sign and return a fully populated `SignedSale`.
 *   2. Build the BMF-compliant `processData` string for a Kassenbeleg-V1.
 *   3. Build a DSFinV-K-style JSON export from a list of SignedSales.
 *
 * The client is mode-agnostic: it always calls the same endpoint regardless
 * of whether the server is running stub or real fiskaly. The provider
 * returned by the server is propagated into `SignedSale.provider` so the
 * UI can warn the operator when stub signatures are produced.
 */

import { fetch as expoFetch } from "expo/fetch";
import { roundMoney, toCents, sumMoney, mulMoney } from "@/lib/money";
import { authHeaders } from "@/lib/api";
import type { SaleEntry, SignedSale, TseConfig, TseProvider } from "@/types";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface SignServerResponse {
  provider: TseProvider;
  serialNumber: string;
  signatureCounter: number;
  signature: string;
  time: string;
  txNumber: number;
  processType: string;
  processData: string;
}

/**
 * Build the `processData` field per BMF Kassenbeleg-V1 schema.
 * Format: "Beleg^<gross>_<vat19>_<vat7>_<vat0>_<vatSpecial>^<gross>:Bar"
 * (we use only Bar/cash for now — card/EC could be added later).
 */
export function buildProcessData(args: {
  gross: number;
  vatPct: number;
  paymentMethod?: "Bar" | "Unbar";
}): string {
  const gross = roundMoney(args.gross);
  const vat = args.vatPct > 0 ? roundMoney((gross * args.vatPct) / (100 + args.vatPct)) : 0;
  const vat19 = args.vatPct === 19 ? vat : 0;
  const vat7  = args.vatPct === 7  ? vat : 0;
  const vat0  = args.vatPct === 0  ? 0 : 0;
  const fmt = (n: number) => n.toFixed(2);
  return `Beleg^${fmt(gross)}_${fmt(vat19)}_${fmt(vat7)}_${fmt(vat0)}_0.00^${fmt(gross)}:${args.paymentMethod ?? "Bar"}`;
}

/** Compute next sequential transaction number from current SignedSale list. */
export function nextTxNumber(prior: SignedSale[]): number {
  if (prior.length === 0) return 1;
  const max = prior.reduce((m, s) => Math.max(m, s.tseTxNumber), 0);
  return max + 1;
}

/**
 * Sign a SaleEntry with the TSE backend and return a SignedSale ready to be
 * dispatched into AppContext via { type: "addSignedSale" }.
 *
 * Throws if the server is unreachable. Caller is responsible for showing
 * the error and advising the operator NOT to hand over the receipt
 * (legal requirement: no signature ⇒ no Beleg).
 */
export async function signSale(args: {
  sale: SaleEntry;
  vatPct: number;
  config: TseConfig;
  prior: SignedSale[];
}): Promise<SignedSale> {
  const txNumber = nextTxNumber(args.prior);
  const processData = buildProcessData({ gross: args.sale.revenue, vatPct: args.vatPct });
  const res = await expoFetch(`${API_BASE}/api/tse/sign`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      txNumber,
      kassennummer: args.config.kassennummer || "K-001",
      processType: "Kassenbeleg-V1",
      processData,
    }),
  });
  if (!res.ok) throw new Error(`TSE sign failed: ${res.status}`);
  const r = (await res.json()) as SignServerResponse;
  return {
    ...args.sale,
    tseTxNumber: r.txNumber,
    tseSerial: r.serialNumber,
    tseSignatureCounter: r.signatureCounter,
    tseSignature: r.signature,
    tseTime: r.time,
    processType: r.processType,
    processData: r.processData,
    provider: r.provider,
    vatPct: args.vatPct,
  };
}

// ─── DSFinV-K export ────────────────────────────────────────────────────────

export interface DsfinvkRow {
  Z_KASSE_ID: string;
  Z_ERSTELLUNG: string;
  BON_NR: number;
  BON_TYP: string;
  BON_NAME: string;
  TSE_TA_NR: number;
  TSE_TA_SIGZ: number;
  TSE_TA_SIG: string;
  TSE_TA_START: string;
  TSE_TA_ENDE: string;
  TSE_SERIAL: string;
  PROCESS_DATA: string;
  GROSS_EUR: number;
  VAT_PCT: number;
  PROVIDER: TseProvider;
}

/**
 * Minimal DSFinV-K-style JSON export. Real DSFinV-K is a 25+ table CSV bundle;
 * this helper produces a single flat JSON suitable for forensic review and
 * for handing to a Steuerberater who will stamp it before submission.
 */
export function exportDsfinvk(args: {
  signedSales: SignedSale[];
  kassennummer: string;
  fromDate: string;
  toDate: string;
}): { kasse: string; from: string; to: string; rows: DsfinvkRow[]; totals: { gross: number; vat19: number; vat7: number; vat0: number } } {
  const inRange = args.signedSales
    .filter((s) => s.date >= args.fromDate && s.date <= args.toDate)
    .sort((a, b) => a.tseTxNumber - b.tseTxNumber);
  const rows: DsfinvkRow[] = inRange.map((s) => ({
    Z_KASSE_ID: args.kassennummer,
    Z_ERSTELLUNG: new Date().toISOString(),
    BON_NR: s.tseTxNumber,
    BON_TYP: "Beleg",
    BON_NAME: s.processType,
    TSE_TA_NR: s.tseTxNumber,
    TSE_TA_SIGZ: s.tseSignatureCounter,
    TSE_TA_SIG: s.tseSignature,
    TSE_TA_START: s.tseTime,
    TSE_TA_ENDE: s.tseTime,
    TSE_SERIAL: s.tseSerial,
    PROCESS_DATA: s.processData,
    GROSS_EUR: roundMoney(s.revenue),
    VAT_PCT: s.vatPct,
    PROVIDER: s.provider,
  }));
  // Extract the VAT (Steuer) portion from gross: tax = gross − gross / (1 + rate).
  // The previous formula `pctOfMoney(g, rate) / (1+rate)` was mathematically wrong
  // (computed rate% of gross, then divided — produced ~16% of gross for 19%).
  const totals = inRange.reduce(
    (acc, s) => {
      const g = s.revenue;
      acc.gross = acc.gross + g;
      if (s.vatPct === 19) acc.vat19 += g - g / 1.19;
      else if (s.vatPct === 7) acc.vat7 += g - g / 1.07;
      else acc.vat0 += g;
      return acc;
    },
    { gross: 0, vat19: 0, vat7: 0, vat0: 0 },
  );
  return {
    kasse: args.kassennummer,
    from: args.fromDate,
    to: args.toDate,
    rows,
    totals: {
      gross: roundMoney(totals.gross),
      vat19: roundMoney(totals.vat19),
      vat7: roundMoney(totals.vat7),
      vat0: roundMoney(totals.vat0),
    },
  };
}

/**
 * Daily Z-Bon (Tagesabschluss): aggregate every signed sale on a given date.
 * Returns the totals + signed-sale count + a printable plain-text body.
 */
export function buildZBon(args: { signedSales: SignedSale[]; date: string; kassennummer: string }): {
  date: string;
  count: number;
  gross: number;
  vat19Gross: number;
  vat7Gross: number;
  vat0Gross: number;
  cashGross: number;
  cardGross: number;
  cashCount: number;
  cardCount: number;
  txStart: number;
  txEnd: number;
  body: string;
} {
  const day = args.signedSales.filter((s) => s.date === args.date)
    .sort((a, b) => a.tseTxNumber - b.tseTxNumber);
  const gross = sumMoney(day.map((s) => s.revenue));
  const vat19Gross = sumMoney(day.filter((s) => s.vatPct === 19).map((s) => s.revenue));
  const vat7Gross  = sumMoney(day.filter((s) => s.vatPct === 7).map((s) => s.revenue));
  const vat0Gross  = sumMoney(day.filter((s) => s.vatPct === 0).map((s) => s.revenue));
  const vat19Net = vat19Gross / 1.19;
  const vat7Net  = vat7Gross  / 1.07;

  const cashEntries = day.filter((s) => (s.paymentMethod ?? "cash") !== "card");
  const cardEntries = day.filter((s) => s.paymentMethod === "card");
  const cashGross = sumMoney(cashEntries.map((s) => s.revenue));
  const cardGross = sumMoney(cardEntries.map((s) => s.revenue));
  const cashCount = cashEntries.length;
  const cardCount = cardEntries.length;

  const txStart = day[0]?.tseTxNumber ?? 0;
  const txEnd   = day[day.length - 1]?.tseTxNumber ?? 0;
  const body = [
    `Z-BON  Kasse ${args.kassennummer}  ${args.date}`,
    `Belege: ${day.length}  (Nr. ${txStart} – ${txEnd})`,
    `Brutto gesamt: ${gross.toFixed(2)} €`,
    `  davon 19 %: ${vat19Gross.toFixed(2)} €  (USt ${(vat19Gross - vat19Net).toFixed(2)} €)`,
    `  davon  7 %: ${vat7Gross.toFixed(2)} €  (USt ${(vat7Gross - vat7Net).toFixed(2)} €)`,
    `  davon  0 %: ${vat0Gross.toFixed(2)} €`,
    ``,
    `Zahlungsarten:`,
    `  💵 Bar:   ${cashCount} Belege  ${cashGross.toFixed(2)} €`,
    `  💳 Karte: ${cardCount} Belege  ${cardGross.toFixed(2)} €`,
  ].join("\n");
  return {
    date: args.date, count: day.length, gross,
    vat19Gross, vat7Gross, vat0Gross,
    cashGross, cardGross, cashCount, cardCount,
    txStart, txEnd, body,
  };
}

// Touch unused imports (kept for future calc extensions to avoid TS warnings).
void toCents;
void mulMoney;

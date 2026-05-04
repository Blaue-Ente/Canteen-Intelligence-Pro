/**
 * T014d — DGE-Qualitätsstandard compliance certificate (PDF/HTML).
 *
 * Generates an audit-friendly one-pager showing:
 *  - operator + period + standard
 *  - overall score gauge
 *  - per-criterion table (current vs threshold, met/unmet)
 *  - day-by-day menu breakdown
 *  - signature block for the catering manager
 *
 * Output is HTML — the caller passes it to `sharePdf()` from `lib/pdf.ts`,
 * which on native uses `expo-print` to materialise a PDF and on web opens
 * a print dialog.
 */

import type {
  CompanyProfile,
  DgeScore,
  Locale,
  MenuDayEntry,
  Recipe,
} from "@/types";
import { dgeStandardLabel } from "@/lib/dge";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!,
  );
}

function fmtDate(iso: string, isDe: boolean): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(isDe ? "de-DE" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function gaugeColor(overall: number): string {
  if (overall >= 80) return "#16a34a"; // green
  if (overall >= 60) return "#f59e0b"; // amber
  return "#dc2626";                    // red
}

interface DgeCertificateInput {
  score: DgeScore;
  recipes: Recipe[];
  menu: MenuDayEntry[];
  company?: CompanyProfile;
  /** Optional location label (e.g. multi-site operators). */
  locationLabel?: string;
  locale: Locale;
}

export function dgeCertificateHtml(input: DgeCertificateInput): string {
  const { score, recipes, menu, company, locationLabel, locale } = input;
  const isDe = locale === "de";
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const standardLabel = dgeStandardLabel(score.standard, isDe);

  const L = isDe
    ? {
        title: "DGE-Konformitätsbescheinigung",
        subtitle: "Bewertung des Speiseplans nach DGE-Qualitätsstandard",
        operator: "Betreiber",
        location: "Standort",
        period: "Zeitraum",
        standard: "Qualitätsstandard",
        overall: "Gesamtbewertung",
        ofScore: "von 100 Punkten",
        criteriaMet: "Kriterien erfüllt",
        criteria: "Kriterien",
        threshold: "Schwelle",
        current: "Aktuell",
        result: "Ergebnis",
        met: "Erfüllt",
        notMet: "Offen",
        weeklyMenu: "Speiseplan",
        day: "Tag",
        dishes: "Gerichte",
        none: "kein Plan",
        signatureLine: "Unterschrift Küchenleitung / Datum",
        disclaimer:
          "Diese Bescheinigung dokumentiert die automatische Auswertung des Speiseplans im genannten Zeitraum nach den Qualitätsstandards der Deutschen Gesellschaft für Ernährung e.V. Sie ersetzt keine offizielle DGE-Zertifizierung.",
      }
    : {
        title: "DGE Compliance Certificate",
        subtitle: "Menu plan scored against the DGE quality standard",
        operator: "Operator",
        location: "Location",
        period: "Period",
        standard: "Quality standard",
        overall: "Overall score",
        ofScore: "out of 100",
        criteriaMet: "criteria met",
        criteria: "Criteria",
        threshold: "Threshold",
        current: "Current",
        result: "Result",
        met: "Met",
        notMet: "Open",
        weeklyMenu: "Menu plan",
        day: "Day",
        dishes: "Dishes",
        none: "no plan",
        signatureLine: "Signature kitchen manager / date",
        disclaimer:
          "This certificate documents the automated scoring of the menu plan against the quality standards published by the German Nutrition Society. It does not replace an official DGE certification.",
      };

  const tone = gaugeColor(score.overall);
  const metCount = score.criteria.filter((c) => c.met).length;

  // Day-by-day breakdown.
  const allDays: string[] = [];
  {
    const start = new Date(score.fromDate + "T00:00:00Z");
    for (let i = 0; i < score.daysCount; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      allDays.push(d.toISOString().slice(0, 10));
    }
  }
  const dayRows = allDays
    .map((iso) => {
      const dishes = menu
        .filter((m) => m.date === iso)
        .flatMap((m) => m.recipeIds ?? [])
        .map((id) => recipeById.get(id))
        .filter((r): r is Recipe => !!r)
        .map((r) => isDe ? r.nameDe : r.name);
      const cell = dishes.length > 0
        ? dishes.map((d) => escapeHtml(d)).join(", ")
        : `<span class="muted">${L.none}</span>`;
      return `<tr>
        <td style="white-space:nowrap;width:110px">${fmtDate(iso, isDe)}</td>
        <td>${cell}</td>
      </tr>`;
    })
    .join("");

  // Criteria rows.
  const critRows = score.criteria
    .map((c) => {
      const limit = c.kind === "min" ? `≥ ${c.threshold}` : `≤ ${c.threshold}`;
      const badgeBg = c.met ? "#dcfce7" : "#fee2e2";
      const badgeFg = c.met ? "#166534" : "#991b1b";
      return `<tr>
        <td>${escapeHtml(c.label)}</td>
        <td class="right">${limit}</td>
        <td class="right">${c.current}</td>
        <td class="right"><span class="pill" style="background:${badgeBg};color:${badgeFg}">
          ${c.met ? L.met : L.notMet}
        </span></td>
      </tr>`;
    })
    .join("");

  const operatorBlock = company
    ? `<div><strong>${escapeHtml(company.name ?? "")}</strong></div>
       ${company.address ? `<div class="muted">${escapeHtml(company.address)}</div>` : ""}
       ${company.email ? `<div class="muted">${escapeHtml(company.email)}</div>` : ""}`
    : `<div class="muted">—</div>`;

  return `<!DOCTYPE html>
<html lang="${isDe ? "de" : "en"}"><head><meta charset="utf-8"/>
<title>${escapeHtml(L.title)}</title>
<style>
  body { font-family: -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif; color:#1c1917; padding:36px; max-width:760px; margin:auto; }
  h1 { font-size:24px; margin:0 0 4px; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#78716c; margin:24px 0 8px; }
  .muted { color:#78716c; font-size:12px; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #f59e0b; padding-bottom:10px; }
  .brand { color:#f59e0b; font-weight:700; font-size:13px; letter-spacing:.12em; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
  .meta-cell { padding:10px 14px; background:#f5f5f4; border-radius:8px; }
  .meta-label { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#78716c; }
  .meta-val { font-size:14px; font-weight:600; margin-top:2px; }
  .gauge-wrap { display:flex; align-items:center; gap:24px; margin:24px 0; padding:18px; background:#fafaf9; border-radius:12px; }
  .gauge-num { font-size:64px; font-weight:800; color:${tone}; line-height:1; }
  .gauge-bar { flex:1; height:14px; background:#e7e5e4; border-radius:999px; overflow:hidden; margin-top:10px; }
  .gauge-fill { height:100%; background:${tone}; width:${score.overall}%; }
  .gauge-meta { font-size:12px; color:#78716c; margin-top:6px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #e7e5e4; font-size:12px; }
  th { color:#78716c; font-weight:600; font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
  .right { text-align:right; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  .signature { margin-top:48px; display:flex; gap:32px; }
  .sig-line { flex:1; border-top:1px solid #1c1917; padding-top:6px; font-size:11px; color:#78716c; }
  .footer { margin-top:24px; font-size:10px; color:#78716c; border-top:1px solid #e7e5e4; padding-top:10px; text-align:center; }
</style></head><body>
  <div class="header">
    <div>
      <div class="brand">KITCHENOS</div>
      <h1>${escapeHtml(L.title)}</h1>
      <div class="muted">${escapeHtml(L.subtitle)}</div>
    </div>
    <div class="muted">${new Date().toLocaleDateString(isDe ? "de-DE" : "en-GB")}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-cell">
      <div class="meta-label">${L.operator}</div>
      <div class="meta-val">${operatorBlock}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">${L.standard}</div>
      <div class="meta-val">${escapeHtml(standardLabel)}</div>
      <div class="meta-label" style="margin-top:8px">${L.period}</div>
      <div class="meta-val">${fmtDate(score.fromDate, isDe)} – ${fmtDate(score.toDate, isDe)}</div>
      ${locationLabel ? `<div class="meta-label" style="margin-top:8px">${L.location}</div>
        <div class="meta-val">${escapeHtml(locationLabel)}</div>` : ""}
    </div>
  </div>

  <div class="gauge-wrap">
    <div class="gauge-num">${score.overall}</div>
    <div style="flex:1">
      <div class="meta-label">${L.overall}</div>
      <div style="font-size:13px;font-weight:600;margin-top:2px">${score.overall} / 100</div>
      <div class="gauge-bar"><div class="gauge-fill"></div></div>
      <div class="gauge-meta">${metCount} / ${score.criteria.length} ${L.criteriaMet}  ·  ${score.daysWithMenu}/${score.daysCount} ${isDe ? "Tage geplant" : "days planned"}</div>
    </div>
  </div>

  <h2>${L.criteria}</h2>
  <table>
    <thead><tr>
      <th>${L.criteria}</th>
      <th class="right">${L.threshold}</th>
      <th class="right">${L.current}</th>
      <th class="right">${L.result}</th>
    </tr></thead>
    <tbody>${critRows}</tbody>
  </table>

  <h2>${L.weeklyMenu}</h2>
  <table>
    <thead><tr>
      <th>${L.day}</th>
      <th>${L.dishes}</th>
    </tr></thead>
    <tbody>${dayRows}</tbody>
  </table>

  <div class="signature">
    <div class="sig-line">${L.signatureLine}</div>
    <div class="sig-line">${L.signatureLine}</div>
  </div>

  <div class="footer">${L.disclaimer}</div>
</body></html>`;
}

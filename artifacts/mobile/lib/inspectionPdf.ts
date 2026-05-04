/**
 * T008 — One-tap inspection mode PDF for Lebensmittelkontrolle / food-safety audits.
 *
 * Combines into a single A4 booklet:
 *  1. Cover page (operator address + period + signature line)
 *  2. HACCP temperature log (filtered to selected period)
 *  3. Master cleaning schedule + completion log
 *  4. LMIV allergen poster (per recipe — propagated from ingredients)
 *  5. Storage temperature targets table
 *
 * Designed so a Lebensmittelkontrolleur can flip through one PDF instead of
 * the operator scrambling through binders. All sections are print-friendly
 * (mono colours, page-break-inside: avoid).
 */

import type {
  Allergen,
  AppState,
  CleaningCompletion,
  CleaningTask,
  CompanyProfile,
  HaccpLog,
  Locale,
  Recipe,
  StorageLocation,
} from "@/types";
import { recipeAllergens } from "@/lib/computations";

export interface InspectionPdfArgs {
  state: AppState;
  /** ISO yyyy-mm-dd start date (inclusive). */
  fromDate: string;
  /** ISO yyyy-mm-dd end date (inclusive). */
  toDate: string;
}

const ALLERGEN_LABEL: Record<Allergen, { de: string; en: string }> = {
  gluten:    { de: "Gluten",                en: "Gluten" },
  milk:      { de: "Milch",                 en: "Milk" },
  egg:       { de: "Ei",                    en: "Egg" },
  nuts:      { de: "Schalenfrüchte",        en: "Tree nuts" },
  soy:       { de: "Soja",                  en: "Soy" },
  fish:      { de: "Fisch",                 en: "Fish" },
  shellfish: { de: "Krebstiere",            en: "Crustaceans" },
  celery:    { de: "Sellerie",              en: "Celery" },
  mustard:   { de: "Senf",                  en: "Mustard" },
  sesame:    { de: "Sesam",                 en: "Sesame" },
  sulphite:  { de: "Schwefeldioxid/Sulfite",en: "Sulphites" },
  lupin:     { de: "Lupinen",               en: "Lupin" },
  mollusc:   { de: "Weichtiere",            en: "Molluscs" },
  peanut:    { de: "Erdnüsse",              en: "Peanuts" },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "de" ? "de-DE" : "en-US");
}

function fmtDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function inRange(iso: string, fromDate: string, toDate: string): boolean {
  const d = iso.slice(0, 10);
  return d >= fromDate && d <= toDate;
}

// ── Section renderers ────────────────────────────────────────────────────────

function renderCover(profile: CompanyProfile | undefined, args: InspectionPdfArgs, t: (de: string, en: string) => string): string {
  const isDe = args.state.locale === "de";
  const periodLabel = `${fmtDate(args.fromDate, args.state.locale)} – ${fmtDate(args.toDate, args.state.locale)}`;
  return `
    <section class="cover">
      <h1>${t("Lebensmittelkontrolle", "Food safety inspection")}</h1>
      <h2>${t("Dokumentations-Mappe", "Documentation booklet")}</h2>
      <table class="meta">
        <tr><th>${t("Betrieb", "Operator")}</th><td>${escapeHtml(profile?.name ?? "—")}</td></tr>
        <tr><th>${t("Anschrift", "Address")}</th><td>${escapeHtml(profile?.address ?? "—")}</td></tr>
        <tr><th>${t("Steuer-Nr.", "Tax ID")}</th><td>${escapeHtml(profile?.taxId ?? "—")}</td></tr>
        <tr><th>${t("Zeitraum", "Period")}</th><td>${periodLabel}</td></tr>
        <tr><th>${t("Erstellt am", "Generated")}</th><td>${new Date().toLocaleString(isDe ? "de-DE" : "en-US")}</td></tr>
      </table>
      <div class="legal">
        ${t(
          "Dieses Dokument fasst die intern erfassten HACCP-Messungen, Reinigungsnachweise, Allergen-Information (LMIV) und Lager-Sollwerte für den oben genannten Zeitraum zusammen.",
          "This booklet bundles HACCP temperature logs, cleaning records, LMIV allergen information and storage targets for the period above.",
        )}
      </div>
      <div class="signbox">
        <div class="sline"></div>
        <div class="slabel">${t("Unterschrift Betriebsleitung", "Operator signature")}</div>
      </div>
    </section>
  `;
}

function renderHaccpSection(logs: HaccpLog[], args: InspectionPdfArgs, t: (de: string, en: string) => string): string {
  const isDe = args.state.locale === "de";
  const filtered = logs
    .filter((l) => inRange(l.date, args.fromDate, args.toDate))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) {
    return `
      <section class="page">
        <h2>1. ${t("HACCP Temperatur-Protokoll", "HACCP temperature log")}</h2>
        <p class="empty">${t("Keine Einträge im Zeitraum.", "No entries in this period.")}</p>
      </section>
    `;
  }

  const rows = filtered.map((l) => `
    <tr class="${l.ok ? "" : "fail"}">
      <td>${fmtDateTime(l.date, args.state.locale)}</td>
      <td>${typeLabel(l.type, isDe)}</td>
      <td>${escapeHtml(l.location)}</td>
      <td class="qty">${l.temperature !== undefined ? `${l.temperature.toFixed(1)} °C` : "—"}</td>
      <td>${l.ok ? "OK" : "⚠"}</td>
      <td>${escapeHtml(l.note ?? "")}</td>
    </tr>
  `).join("");

  return `
    <section class="page">
      <h2>1. ${t("HACCP Temperatur-Protokoll", "HACCP temperature log")}</h2>
      <table class="grid">
        <thead>
          <tr>
            <th>${t("Datum", "Date")}</th>
            <th>${t("Bereich", "Area")}</th>
            <th>${t("Ort", "Location")}</th>
            <th class="qty">${t("Temp", "Temp")}</th>
            <th>${t("Status", "Status")}</th>
            <th>${t("Notiz", "Note")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function typeLabel(type: HaccpLog["type"], isDe: boolean): string {
  if (isDe) {
    switch (type) {
      case "fridge":   return "Kühlung";
      case "freezer":  return "Tiefkühl";
      case "delivery": return "Wareneingang";
      case "cleaning": return "Reinigung";
      case "cooking":  return "Heißhaltung";
    }
  } else {
    switch (type) {
      case "fridge":   return "Fridge";
      case "freezer":  return "Freezer";
      case "delivery": return "Delivery";
      case "cleaning": return "Cleaning";
      case "cooking":  return "Hot hold";
    }
  }
}

function freqLabel(freq: CleaningTask["frequency"], isDe: boolean): string {
  if (isDe) {
    switch (freq) {
      case "daily":     return "täglich";
      case "weekly":    return "wöchentlich";
      case "monthly":   return "monatlich";
      case "quarterly": return "vierteljährlich";
    }
  } else {
    switch (freq) {
      case "daily":     return "daily";
      case "weekly":    return "weekly";
      case "monthly":   return "monthly";
      case "quarterly": return "quarterly";
    }
  }
}

function renderCleaningSection(
  tasks: CleaningTask[],
  log: CleaningCompletion[],
  args: InspectionPdfArgs,
  t: (de: string, en: string) => string,
): string {
  const isDe = args.state.locale === "de";
  const taskRows = tasks.filter((tk) => tk.active).map((tk) => {
    const completions = log
      .filter((c) => c.taskId === tk.id && inRange(c.completedAt, args.fromDate, args.toDate));
    const last = completions[completions.length - 1];
    return `
      <tr>
        <td>${escapeHtml(isDe ? tk.name : (tk.nameEn ?? tk.name))}</td>
        <td>${freqLabel(tk.frequency, isDe)}</td>
        <td class="qty">${completions.length}</td>
        <td>${last ? fmtDateTime(last.completedAt, args.state.locale) : "—"}</td>
        <td>${last ? escapeHtml(last.by) : "—"}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="page">
      <h2>2. ${t("Reinigungsplan & Nachweise", "Cleaning schedule & records")}</h2>
      <table class="grid">
        <thead>
          <tr>
            <th>${t("Aufgabe", "Task")}</th>
            <th>${t("Intervall", "Frequency")}</th>
            <th class="qty">${t("Im Zeitraum", "In period")}</th>
            <th>${t("Letzte Ausführung", "Last completion")}</th>
            <th>${t("Durch", "By")}</th>
          </tr>
        </thead>
        <tbody>${taskRows || `<tr><td colspan="5" class="empty">${t("Keine aktiven Aufgaben.", "No active tasks.")}</td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function renderAllergenSection(
  recipes: Recipe[],
  inventory: AppState["inventory"],
  args: InspectionPdfArgs,
  t: (de: string, en: string) => string,
): string {
  const isDe = args.state.locale === "de";
  const rows = recipes
    .slice(0, 100) // soft cap to keep printable
    .map((r) => {
      const all = recipeAllergens(r, inventory);
      const labels = all
        .map((a) => ALLERGEN_LABEL[a]?.[isDe ? "de" : "en"] ?? a)
        .join(", ") || `<span class="empty">—</span>`;
      return `
        <tr>
          <td>${escapeHtml(isDe ? r.nameDe || r.name : r.name || r.nameDe)}</td>
          <td>${escapeHtml(r.category)}</td>
          <td>${labels}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="page">
      <h2>3. ${t("Allergen-Auflistung (LMIV)", "Allergen listing (LMIV)")}</h2>
      <p class="hint">${t(
        "Allergene werden aus den Zutaten der Rezepte automatisch abgeleitet (EU 1169/2011).",
        "Allergens are auto-derived from recipe ingredients (EU 1169/2011).",
      )}</p>
      <table class="grid">
        <thead>
          <tr>
            <th>${t("Gericht", "Dish")}</th>
            <th>${t("Kategorie", "Category")}</th>
            <th>${t("Enthaltene Allergene", "Allergens")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderStorageSection(
  storage: StorageLocation[],
  args: InspectionPdfArgs,
  t: (de: string, en: string) => string,
): string {
  const isDe = args.state.locale === "de";
  const rows = storage.map((s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${catLabel(s.category, isDe)}</td>
      <td class="qty">${s.targetTemp !== undefined ? `${s.targetTemp.toFixed(1)} °C` : "—"}</td>
    </tr>
  `).join("");
  return `
    <section class="page">
      <h2>4. ${t("Lager-Sollwerte", "Storage targets")}</h2>
      <table class="grid">
        <thead>
          <tr>
            <th>${t("Lagerort", "Location")}</th>
            <th>${t("Kategorie", "Category")}</th>
            <th class="qty">${t("Sollwert", "Target")}</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3" class="empty">${t("Keine Lagerorte definiert.", "No storage locations defined.")}</td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function catLabel(cat: StorageLocation["category"], isDe: boolean): string {
  if (isDe) {
    switch (cat) {
      case "fridge":   return "Kühlung";
      case "freezer":  return "Tiefkühl";
      case "room":     return "Raum";
      case "kitchen":  return "Küche";
      case "delivery": return "Wareneingang";
    }
  } else {
    switch (cat) {
      case "fridge":   return "Fridge";
      case "freezer":  return "Freezer";
      case "room":     return "Room";
      case "kitchen":  return "Kitchen";
      case "delivery": return "Delivery";
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function inspectionPdfHtml(args: InspectionPdfArgs): string {
  const isDe = args.state.locale === "de";
  const t = (de: string, en: string) => (isDe ? de : en);

  return `<!doctype html>
<html lang="${isDe ? "de" : "en"}">
<head>
  <meta charset="utf-8" />
  <title>${t("Lebensmittelkontrolle", "Food safety inspection")} — ${args.fromDate} – ${args.toDate}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
    section { page-break-after: always; }
    section:last-child { page-break-after: auto; }
    .cover { padding: 40px 0; }
    .cover h1 { font-size: 28pt; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .cover h2 { font-size: 14pt; font-weight: 400; color: #555; margin: 0 0 32px 0; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .meta th { text-align: left; width: 32%; padding: 6px 8px; background: #f4f4f4; font-weight: 600; font-size: 10pt; }
    .meta td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 10pt; }
    .legal { font-size: 10pt; color: #444; line-height: 1.5; margin-bottom: 60px; }
    .signbox { margin-top: 80px; }
    .sline { width: 60%; border-top: 1px solid #111; margin-bottom: 4px; }
    .slabel { font-size: 9pt; color: #555; }
    .page h2 { font-size: 13pt; background: #111; color: #fff; padding: 6px 12px; margin: 0 0 12px 0; }
    .page .hint { font-size: 9pt; color: #555; margin: 0 0 8px 0; }
    table.grid { width: 100%; border-collapse: collapse; font-size: 10pt; }
    table.grid th, table.grid td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; }
    table.grid th { background: #f4f4f4; font-weight: 600; font-size: 9pt; }
    table.grid .qty { text-align: right; font-variant-numeric: tabular-nums; }
    table.grid tr.fail td { background: #fff4f4; color: #a40000; font-weight: 600; }
    .empty { color: #999; font-style: italic; text-align: center; padding: 16px 0; }
    footer { margin-top: 24px; font-size: 8pt; color: #888; border-top: 1px solid #ccc; padding-top: 6px; }
  </style>
</head>
<body>
  ${renderCover(args.state.companyProfile, args, t)}
  ${renderHaccpSection(args.state.haccp, args, t)}
  ${renderCleaningSection(args.state.cleaningTasks ?? [], args.state.cleaningLog ?? [], args, t)}
  ${renderAllergenSection(args.state.recipes, args.state.inventory, args, t)}
  ${renderStorageSection(args.state.storageLocations, args, t)}
</body>
</html>`;
}

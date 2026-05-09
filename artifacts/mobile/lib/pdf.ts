import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { CateringEvent, CateringRequest, CompanyProfile, OrderDraft, Recipe, Locale } from "@/types";

const baseHtml = (title: string, body: string) => `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif; color: #1c1917; padding: 36px; max-width: 720px; margin: auto; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #1c1917; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #78716c; margin: 28px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e7e5e4; font-size: 13px; }
  th { color: #78716c; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .right { text-align: right; }
  .muted { color: #78716c; font-size: 12px; }
  .total { font-size: 16px; font-weight: 700; margin-top: 16px; text-align: right; }
  .badge { display: inline-block; padding: 3px 8px; background: #fef3c7; color: #92400e; border-radius: 999px; font-size: 11px; font-weight: 600; margin-right: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }
  .brand { color: #f59e0b; font-weight: 700; font-size: 13px; letter-spacing: .12em; }
  .footer { margin-top: 36px; font-size: 11px; color: #78716c; border-top: 1px solid #e7e5e4; padding-top: 12px; text-align: center; }
</style></head><body>${body}</body></html>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!,
  );
}

export function orderHtml(order: OrderDraft, locale: Locale): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const labels = locale === "de"
    ? { title: "Bestellung", supplier: "Lieferant", date: "Datum", item: "Artikel", qty: "Menge", price: "Preis", total: "Geschätzte Summe", note: "Notiz" }
    : { title: "Order", supplier: "Supplier", date: "Date", item: "Item", qty: "Qty", price: "Price", total: "Estimated total", note: "Note" };
  const total = order.total ?? order.items.reduce((s, it) => s + (it.estimatedPrice ?? 0) * it.quantity, 0);
  const rows = order.items
    .map(
      (it) => `<tr>
        <td>${escapeHtml(it.name)}</td>
        <td class="right">${it.quantity} ${escapeHtml(it.unit)}</td>
        <td class="right">${it.estimatedPrice ? `€${(it.estimatedPrice * it.quantity).toFixed(2)}` : "—"}</td>
      </tr>`,
    )
    .join("");
  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${labels.title}</h1>
      </div>
      <div class="muted">${new Date(order.createdAt).toLocaleDateString(fmt)}</div>
    </div>
    <h2>${labels.supplier}</h2>
    <div>${escapeHtml(order.supplierName)}${order.supplierEmail ? ` · <span class="muted">${escapeHtml(order.supplierEmail)}</span>` : ""}</div>
    ${order.notes ? `<div class="muted" style="margin-top:6px">${escapeHtml(order.notes)}</div>` : ""}
    <h2>${labels.item}</h2>
    <table>
      <thead><tr><th>${labels.item}</th><th class="right">${labels.qty}</th><th class="right">${labels.price}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">${labels.total}: €${total.toFixed(2)}</div>
    <div class="footer">KItchenOS · ${labels.title} #${order.id.slice(0, 8)}</div>
  `;
  return baseHtml(labels.title, body);
}

export function cateringOfferHtml(
  req: CateringRequest,
  recipes: Recipe[],
  locale: Locale,
): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const labels = locale === "de"
    ? { title: "Catering-Angebot", customer: "Kunde", date: "Termin", guests: "Gäste", dietary: "Hinweise", menu: "Menü-Vorschlag", subtotal: "Pro Person", total: "Geschätzte Summe", note: "Hinweis" }
    : { title: "Catering offer", customer: "Customer", date: "Event date", guests: "Guests", dietary: "Notes", menu: "Suggested menu", subtotal: "Per person", total: "Estimated total", note: "Note" };

  let perPerson = 0;
  const blocks = req.parsed
    .map((block, idx) => {
      const items = block.recipeIds
        .map((id) => recipes.find((r) => r.id === id))
        .filter((r): r is Recipe => !!r);
      const blockSum = items.reduce((s, r) => s + r.sellPrice, 0);
      perPerson += blockSum;
      const rows = items
        .map((r) => {
          const allergens = r.allergens.length
            ? r.allergens.map((a) => `<span class="badge">${escapeHtml(a)}</span>`).join("")
            : `<span class="muted">—</span>`;
          return `<tr>
            <td>${escapeHtml(locale === "de" ? r.nameDe : r.name)}</td>
            <td>${allergens}</td>
            <td class="right">€${r.sellPrice.toFixed(2)}</td>
          </tr>`;
        })
        .join("");
      return `<h2>${labels.menu} ${idx + 1}${block.notes ? ` · <span class="muted" style="text-transform:none;letter-spacing:0">${escapeHtml(block.notes)}</span>` : ""}</h2>
        <table>
          <thead><tr><th>${escapeHtml(labels.menu)}</th><th>${escapeHtml(locale === "de" ? "Allergene" : "Allergens")}</th><th class="right">${escapeHtml(labels.subtotal)}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");
  const total = perPerson * (req.guests || 1);
  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${labels.title}</h1>
      </div>
      <div class="muted">${new Date(req.receivedAt).toLocaleDateString(fmt)}</div>
    </div>
    <h2>${labels.customer}</h2>
    <div>${escapeHtml(req.fromEmail)}</div>
    <div class="muted" style="margin-top:6px">
      ${labels.date}: <strong>${escapeHtml(req.date)}</strong> &nbsp;·&nbsp; ${labels.guests}: <strong>${req.guests}</strong>
      ${req.dietary ? ` &nbsp;·&nbsp; ${labels.dietary}: ${escapeHtml(req.dietary)}` : ""}
    </div>
    ${blocks}
    <div class="total">${labels.subtotal}: €${perPerson.toFixed(2)}<br/>${labels.total} (${req.guests}× ): €${total.toFixed(2)}</div>
    <div class="footer">KItchenOS · ${escapeHtml(req.subject)}</div>
  `;
  return baseHtml(labels.title, body);
}

export function aushangHtml(
  recipe: Recipe,
  data: {
    nutrition: { kcal: number; protein: number; carbs: number; fat: number };
    co2: number;
    dge: "green" | "yellow" | "red";
    allergens: string[];
  },
  locale: Locale,
): string {
  const labels =
    locale === "de"
      ? { title: "LMIV-Aushang", per: "pro Portion", allergens: "Allergene", none: "Keine bekannt", co2: "CO₂-Fußabdruck", dge: "DGE-Empfehlung", green: "Empfohlen", yellow: "Akzeptabel", red: "Eingeschränkt" }
      : { title: "LMIV poster", per: "per portion", allergens: "Allergens", none: "None known", co2: "CO₂ footprint", dge: "DGE recommendation", green: "Recommended", yellow: "Acceptable", red: "Limited" };
  const dgeLabel = data.dge === "green" ? labels.green : data.dge === "yellow" ? labels.yellow : labels.red;
  const dgeColor = data.dge === "green" ? "#16a34a" : data.dge === "yellow" ? "#ca8a04" : "#dc2626";
  const allergensHtml =
    data.allergens.length === 0
      ? `<span class="muted">${labels.none}</span>`
      : data.allergens.map((a) => `<span class="badge">${escapeHtml(a)}</span>`).join("");
  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${labels.title}</h1>
      </div>
    </div>
    <h1 style="font-size:32px;margin:24px 0 8px">${escapeHtml(locale === "de" ? recipe.nameDe : recipe.name)}</h1>
    <div style="color:${dgeColor};font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase">
      ● ${labels.dge}: ${dgeLabel}
    </div>
    <h2>${locale === "de" ? "Nährwerte" : "Nutrition"} (${labels.per})</h2>
    <table>
      <tbody>
        <tr><td>kcal</td><td class="right">${Math.round(data.nutrition.kcal)}</td></tr>
        <tr><td>${locale === "de" ? "Eiweiß" : "Protein"}</td><td class="right">${data.nutrition.protein.toFixed(1)} g</td></tr>
        <tr><td>${locale === "de" ? "Kohlenhydrate" : "Carbs"}</td><td class="right">${data.nutrition.carbs.toFixed(1)} g</td></tr>
        <tr><td>${locale === "de" ? "Fett" : "Fat"}</td><td class="right">${data.nutrition.fat.toFixed(1)} g</td></tr>
      </tbody>
    </table>
    <h2>${labels.co2}</h2>
    <div style="font-size:32px;font-weight:700">${data.co2.toFixed(2)} <span style="font-size:14px;color:#78716c">kg CO₂e ${labels.per}</span></div>
    <h2>${labels.allergens}</h2>
    <div>${allergensHtml}</div>
    <div class="footer">KItchenOS · ${labels.title} · ${escapeHtml(recipe.id.slice(0, 8))}</div>
  `;
  return baseHtml(labels.title, body);
}

// ---- Event Invoice (Rechnung) ----

export interface InvoiceTotals {
  foodCost: number;
  staffCost: number;
  equipmentCost: number;
  transportCost: number;
  overhead: number;
  vatAmount: number;
  grandTotal: number;
  perPerson: number;
}

export function eventInvoiceHtml(
  event: CateringEvent,
  totals: InvoiceTotals,
  vatPct: number,
  company: CompanyProfile | undefined,
  locale: "de" | "en",
): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const cur = (v: number) => `€${v.toFixed(2)}`;
  const L = locale === "de"
    ? {
        invoice: "RECHNUNG",
        from: "Absender",
        to: "Rechnungsempfänger",
        invoiceNo: "Rechnungsnummer",
        invoiceDate: "Rechnungsdatum",
        due: "Zahlungsziel",
        event: "Veranstaltung",
        venue: "Veranstaltungsort",
        guests: "Gäste",
        pos: "Pos.",
        description: "Leistungsbeschreibung",
        qty: "Menge",
        unit: "Einheit",
        unitPrice: "Einzelpreis",
        total: "Betrag",
        netto: "Zwischensumme (netto)",
        vat: `MwSt. ${vatPct} %`,
        brutto: "Gesamtbetrag (brutto)",
        perPerson: "Pro Person",
        payment: "Zahlungshinweis",
        paymentText: (iban: string, days: number) =>
          `Bitte überweisen Sie den Betrag innerhalb von ${days} Tagen auf folgendes Konto: IBAN ${iban}. Verwendungszweck: Rechnungsnummer.`,
        portions: "Port.",
        staff: "Personalkosten",
        equipment: "Ausstattung",
        transport: "Transport",
        overhead: "Gemeinkosten",
        thanks: "Vielen Dank für Ihr Vertrauen!",
      }
    : {
        invoice: "INVOICE",
        from: "From",
        to: "Bill to",
        invoiceNo: "Invoice no.",
        invoiceDate: "Invoice date",
        due: "Due date",
        event: "Event",
        venue: "Venue",
        guests: "Guests",
        pos: "No.",
        description: "Description",
        qty: "Qty",
        unit: "Unit",
        unitPrice: "Unit price",
        total: "Amount",
        netto: "Subtotal (net)",
        vat: `VAT ${vatPct} %`,
        brutto: "Total (gross)",
        perPerson: "Per person",
        payment: "Payment instructions",
        paymentText: (iban: string, days: number) =>
          `Please transfer the amount within ${days} days to: IBAN ${iban}. Reference: Invoice number.`,
        portions: "port.",
        staff: "Staff costs",
        equipment: "Equipment",
        transport: "Transport",
        overhead: "Overhead",
        thanks: "Thank you for your trust!",
      };

  const companyName = company?.name ?? "KitchenOS";
  const companyAddr = company?.address ?? "";
  const companyIban = company?.iban ?? "—";
  const companyTax = company?.taxId ? (locale === "de" ? `St.-Nr.: ${company.taxId}` : `Tax ID: ${company.taxId}`) : "";
  const companyEmail = company?.email ?? "";
  const companyPhone = company?.phone ?? "";
  const payDays = event.paymentDueDays ?? 14;
  const invoiceDate = event.invoiceDate ?? new Date().toISOString().slice(0, 10);
  const dueDateObj = new Date(invoiceDate);
  dueDateObj.setDate(dueDateObj.getDate() + payDays);
  const dueDate = dueDateObj.toLocaleDateString(fmt);

  let pos = 1;
  const menuRows = event.menuItems.map((item) => {
    const lineTotal = item.portions * item.pricePerPortion;
    return `<tr>
      <td>${pos++}</td>
      <td>${escapeHtml(item.recipeName)}</td>
      <td class="right">${item.portions}</td>
      <td>${L.portions}</td>
      <td class="right">${cur(item.pricePerPortion)}</td>
      <td class="right">${cur(lineTotal)}</td>
    </tr>`;
  });

  const extraRows: string[] = [];
  if (totals.staffCost > 0)
    extraRows.push(`<tr><td>${pos++}</td><td>${L.staff}</td><td class="right">1</td><td>Psch.</td><td class="right">${cur(totals.staffCost)}</td><td class="right">${cur(totals.staffCost)}</td></tr>`);
  if (totals.equipmentCost > 0)
    extraRows.push(`<tr><td>${pos++}</td><td>${L.equipment}</td><td class="right">1</td><td>Psch.</td><td class="right">${cur(totals.equipmentCost)}</td><td class="right">${cur(totals.equipmentCost)}</td></tr>`);
  if (totals.transportCost > 0)
    extraRows.push(`<tr><td>${pos++}</td><td>${L.transport}</td><td class="right">1</td><td>Psch.</td><td class="right">${cur(totals.transportCost)}</td><td class="right">${cur(totals.transportCost)}</td></tr>`);
  if (totals.overhead > 0)
    extraRows.push(`<tr><td>${pos++}</td><td>${L.overhead}</td><td class="right">1</td><td>Psch.</td><td class="right">${cur(totals.overhead)}</td><td class="right">${cur(totals.overhead)}</td></tr>`);

  const body = `
    <style>
      .two-col { display:flex; justify-content:space-between; gap:24px; margin-bottom:28px; }
      .addr-block { flex:1; }
      .addr-block strong { display:block; margin-bottom:4px; font-size:13px; }
      .addr-block div { font-size:12px; color:#57534e; line-height:1.6; }
      .meta-grid { display:grid; grid-template-columns:auto auto; gap:4px 24px; font-size:12px; }
      .meta-grid .label { color:#78716c; }
      .meta-grid .val { font-weight:600; }
      .invoice-title { font-size:28px; font-weight:800; letter-spacing:.05em; color:#1c1917; margin:0 0 20px; }
      .pos-table th { font-size:10px; }
      .pos-table td { font-size:12px; }
      .summary { margin-top:20px; text-align:right; }
      .summary table { margin-left:auto; min-width:240px; }
      .summary td { font-size:13px; padding:4px 8px; }
      .summary .grand { font-size:17px; font-weight:800; color:#1c1917; border-top:2px solid #f59e0b; }
      .payment-box { margin-top:28px; background:#fef9f0; border:1px solid #fcd34d; border-radius:8px; padding:14px; font-size:12px; line-height:1.6; color:#57534e; }
      .payment-box strong { color:#1c1917; }
      .thanks { margin-top:24px; text-align:center; font-size:13px; color:#78716c; font-style:italic; }
    </style>
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <div class="invoice-title">${L.invoice}</div>
      </div>
      <div class="meta-grid">
        <span class="label">${L.invoiceNo}</span><span class="val">${escapeHtml(event.invoiceNo ?? "—")}</span>
        <span class="label">${L.invoiceDate}</span><span class="val">${new Date(invoiceDate).toLocaleDateString(fmt)}</span>
        <span class="label">${L.due}</span><span class="val">${dueDate}</span>
      </div>
    </div>

    <div class="two-col" style="margin-top:24px">
      <div class="addr-block">
        <strong>${L.from}</strong>
        <div>${escapeHtml(companyName)}<br/>${escapeHtml(companyAddr).replace(/, /g, "<br/>")}</div>
        ${companyEmail ? `<div>${escapeHtml(companyEmail)}</div>` : ""}
        ${companyPhone ? `<div>${escapeHtml(companyPhone)}</div>` : ""}
        ${companyTax ? `<div>${escapeHtml(companyTax)}</div>` : ""}
      </div>
      <div class="addr-block">
        <strong>${L.to}</strong>
        <div>${escapeHtml(event.clientName)}</div>
        ${event.clientAddress ? `<div>${escapeHtml(event.clientAddress).replace(/, /g, "<br/>")}</div>` : ""}
        ${event.clientEmail ? `<div>${escapeHtml(event.clientEmail)}</div>` : ""}
        ${event.clientPhone ? `<div>${escapeHtml(event.clientPhone)}</div>` : ""}
      </div>
    </div>

    <h2>${L.event}: ${escapeHtml(event.title)}</h2>
    <div style="font-size:12px;color:#57534e;margin-bottom:16px">
      ${L.event.replace(":", "")}: <strong>${new Date(event.eventDate).toLocaleDateString(fmt)}${event.eventTime ? " " + event.eventTime : ""}</strong>
      ${event.venue ? ` &nbsp;·&nbsp; ${L.venue}: <strong>${escapeHtml(event.venue)}</strong>` : ""}
      &nbsp;·&nbsp; ${L.guests}: <strong>${event.guestCount}</strong>
    </div>

    <table class="pos-table">
      <thead>
        <tr>
          <th style="width:32px">${L.pos}</th>
          <th>${L.description}</th>
          <th class="right" style="width:60px">${L.qty}</th>
          <th style="width:50px">${L.unit}</th>
          <th class="right" style="width:90px">${L.unitPrice}</th>
          <th class="right" style="width:90px">${L.total}</th>
        </tr>
      </thead>
      <tbody>
        ${menuRows.join("")}
        ${extraRows.join("")}
      </tbody>
    </table>

    <div class="summary">
      <table>
        <tr><td>${L.netto}</td><td class="right">${cur(totals.grandTotal - totals.vatAmount)}</td></tr>
        <tr><td>${L.vat}</td><td class="right">${cur(totals.vatAmount)}</td></tr>
        <tr class="grand"><td><strong>${L.brutto}</strong></td><td class="right"><strong>${cur(totals.grandTotal)}</strong></td></tr>
        ${event.guestCount > 0 ? `<tr><td style="color:#78716c;font-size:12px">${L.perPerson}</td><td class="right" style="color:#78716c;font-size:12px">${cur(totals.perPerson)}</td></tr>` : ""}
      </table>
    </div>

    <div class="payment-box">
      <strong>${L.payment}:</strong><br/>
      ${L.paymentText(companyIban, payDays)}
    </div>
    <div class="thanks">${L.thanks}</div>
    <div class="footer">${escapeHtml(companyName)} · ${L.invoiceNo}: ${escapeHtml(event.invoiceNo ?? "—")}</div>
  `;
  return baseHtml(`${L.invoice} ${event.invoiceNo ?? ""}`, body);
}

// ---- Transport Checklist (Transportcheckliste) ----

function isHotDish(name: string): boolean {
  const cold = /salat|dessert|eis|kalt|cold|tiramisu|mousse|pudding|obst|fruit|salad/i;
  return !cold.test(name);
}

function gnCount(portions: number, hot: boolean): number {
  return Math.max(1, Math.ceil(portions / (hot ? 20 : 25)));
}

export function eventTransportChecklistHtml(
  event: CateringEvent,
  locale: "de" | "en",
): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const L = locale === "de"
    ? {
        title: "Transportcheckliste",
        event: "Veranstaltung",
        date: "Datum",
        venue: "Veranstaltungsort",
        guests: "Gäste",
        dish: "Gericht",
        portions: "Portionen",
        containers: "GN-Behälter",
        type: "Typ",
        temp: "Temperaturzone",
        hot: "Warmgericht",
        cold: "Kaltspeise",
        minTemp: "min. +65 °C",
        maxTemp: "max. +7 °C",
        vehicleNote: "Fahrzeugplanung",
        hotVehicle: "Thermobehälter / Heißhaltebox",
        coldVehicle: "Kühlbox / Kühlfahrzeug",
        haccp: "HACCP-Hinweis: Temperatur bei Abfahrt UND Ankunft dokumentieren.",
        sign: "Fahrer",
        signLine: "Unterschrift / Datum",
        check: "□",
        totalContainers: "Gesamt GN-Behälter",
        hot_req: "Warm (≥65°C)",
        cold_req: "Kalt (≤7°C)",
      }
    : {
        title: "Transport Checklist",
        event: "Event",
        date: "Date",
        venue: "Venue",
        guests: "Guests",
        dish: "Dish",
        portions: "Portions",
        containers: "GN containers",
        type: "Type",
        temp: "Temperature zone",
        hot: "Hot dish",
        cold: "Cold dish",
        minTemp: "min. +65 °C",
        maxTemp: "max. +7 °C",
        vehicleNote: "Vehicle planning",
        hotVehicle: "Insulated container / hot box",
        coldVehicle: "Cool box / refrigerated vehicle",
        haccp: "HACCP note: document temperature at departure AND arrival.",
        sign: "Driver",
        signLine: "Signature / Date",
        check: "□",
        totalContainers: "Total GN containers",
        hot_req: "Hot (≥65°C)",
        cold_req: "Cold (≤7°C)",
      };

  let totalHot = 0;
  let totalCold = 0;

  const rows = event.menuItems.map((item) => {
    const hot = isHotDish(item.recipeName);
    const gn = gnCount(item.portions, hot);
    if (hot) totalHot += gn; else totalCold += gn;
    return `<tr>
      <td>${L.check}</td>
      <td>${escapeHtml(item.recipeName)}</td>
      <td class="right">${item.portions}</td>
      <td>${gn}× <strong>GN 1/1</strong> 65mm</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${hot ? "#fee2e2" : "#dbeafe"};color:${hot ? "#991b1b" : "#1e40af"}">${hot ? L.hot : L.cold}</span></td>
      <td style="font-size:11px;color:#57534e">${hot ? L.minTemp : L.maxTemp}</td>
    </tr>`;
  });

  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${L.title}</h1>
      </div>
      <div class="muted">${new Date(event.eventDate).toLocaleDateString(fmt)}</div>
    </div>

    <h2>${L.event}</h2>
    <div style="font-size:13px;margin-bottom:8px">
      <strong>${escapeHtml(event.title)}</strong><br/>
      ${new Date(event.eventDate).toLocaleDateString(fmt)}${event.eventTime ? " · " + event.eventTime : ""}
      ${event.venue ? ` · ${escapeHtml(event.venue)}` : ""}
      &nbsp;·&nbsp; ${L.guests}: <strong>${event.guestCount}</strong>
    </div>

    <h2>${L.dish}</h2>
    ${rows.length === 0
      ? `<div class="muted">—</div>`
      : `<table>
          <thead>
            <tr>
              <th style="width:24px"></th>
              <th>${L.dish}</th>
              <th class="right">${L.portions}</th>
              <th>${L.containers}</th>
              <th>${L.temp}</th>
              <th>°C</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>`}

    <div style="margin-top:20px;display:flex;gap:24px">
      <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px">
        <div style="font-weight:700;font-size:12px;color:#9a3412;margin-bottom:6px">🔴 ${L.hot_req} — ${totalHot} GN</div>
        <div style="font-size:12px;color:#57534e">${L.hotVehicle}</div>
      </div>
      <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px">
        <div style="font-weight:700;font-size:12px;color:#1e40af;margin-bottom:6px">🔵 ${L.cold_req} — ${totalCold} GN</div>
        <div style="font-size:12px;color:#57534e">${L.coldVehicle}</div>
      </div>
    </div>

    <div style="margin-top:20px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;font-size:12px;color:#713f12">
      ⚠️ ${L.haccp}
    </div>

    <div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">${L.sign}</div>
        <div style="border-bottom:1px solid #1c1917;height:40px"></div>
        <div style="font-size:11px;color:#78716c;margin-top:4px">${L.signLine}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">${L.totalContainers}</div>
        <div style="font-size:24px;font-weight:800">${totalHot + totalCold}</div>
        <div style="font-size:11px;color:#78716c">${totalHot} warm · ${totalCold} kalt</div>
      </div>
    </div>
    <div class="footer">KItchenOS · ${L.title} · ${escapeHtml(event.title)}</div>
  `;
  return baseHtml(L.title, body);
}

// ---- Preorder Delivery Sheet (Lieferschein / Tagesübersicht für Vorbestellungen) ----

interface PreorderSheetItem { name: string; qty: number; price: number; }
interface PreorderSheetOrder {
  id: string;
  guestName: string;
  guestNote?: string | null;
  wantedFor?: string | null;
  items: PreorderSheetItem[];
  total: number;
  currency: string;
}

export function preorderDeliverySheetHtml(
  orders: PreorderSheetOrder[],
  locationName: string,
  locale: "de" | "en",
): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const today = new Date().toLocaleDateString(fmt);
  const L = locale === "de"
    ? {
        title: "Lieferschein — Vorbestellungen",
        date: "Datum",
        location: "Standort",
        summary: "Gesamtübersicht Portionen",
        dish: "Gericht",
        qty: "Anzahl",
        gnNote: "GN-Behälter",
        orders: "Einzelne Bestellungen",
        customer: "Gast",
        items: "Bestellte Gerichte",
        total: "Summe",
        note: "Hinweis",
        haccp: "HACCP-Hinweis: Temperatur bei Abfahrt (≥65°C warm, ≤7°C kalt) und bei Ankunft dokumentieren.",
        driver: "Fahrer",
        sign: "Unterschrift / Datum",
        hot: "Warmgericht",
        cold: "Kaltspeise",
      }
    : {
        title: "Delivery Sheet — Pre-orders",
        date: "Date",
        location: "Location",
        summary: "Total Portions Summary",
        dish: "Dish",
        qty: "Qty",
        gnNote: "GN containers",
        orders: "Individual Orders",
        customer: "Guest",
        items: "Ordered dishes",
        total: "Total",
        note: "Note",
        haccp: "HACCP note: document temperature at departure (≥65°C hot, ≤7°C cold) and at arrival.",
        driver: "Driver",
        sign: "Signature / Date",
        hot: "Hot dish",
        cold: "Cold dish",
      };

  // Aggregate dish totals across all orders
  const dishTotals = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.items) {
      dishTotals.set(item.name, (dishTotals.get(item.name) ?? 0) + item.qty);
    }
  }

  let totalHotGn = 0;
  let totalColdGn = 0;
  const summaryRows = [...dishTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, qty]) => {
      const hot = isHotDish(name);
      const gn = gnCount(qty, hot);
      if (hot) totalHotGn += gn; else totalColdGn += gn;
      return `<tr>
        <td>□</td>
        <td>${escapeHtml(name)}</td>
        <td class="right" style="font-weight:700">${qty}</td>
        <td>${gn}× <strong>GN 1/1</strong></td>
        <td><span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${hot ? "#fee2e2" : "#dbeafe"};color:${hot ? "#991b1b" : "#1e40af"}">${hot ? L.hot : L.cold}</span></td>
      </tr>`;
    })
    .join("");

  const orderRows = orders.map((o) => {
    const itemLines = o.items.map((it) =>
      `<li>${it.qty}× ${escapeHtml(it.name)} — €${(it.price * it.qty).toFixed(2)}</li>`,
    ).join("");
    return `<tr>
      <td style="vertical-align:top;font-weight:700;white-space:nowrap">${escapeHtml(o.guestName)}</td>
      <td><ul style="margin:0;padding-left:16px;font-size:12px">${itemLines}</ul>
        ${o.guestNote ? `<div style="font-size:11px;color:#78716c;font-style:italic;margin-top:4px">„${escapeHtml(o.guestNote)}"</div>` : ""}
      </td>
      <td class="right" style="font-weight:700;vertical-align:top;white-space:nowrap">€${o.total.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${L.title}</h1>
      </div>
      <div class="muted">${today} · ${escapeHtml(locationName)}</div>
    </div>

    <h2>${L.summary}</h2>
    <table>
      <thead><tr><th style="width:24px"></th><th>${L.dish}</th><th class="right">${L.qty}</th><th>${L.gnNote}</th><th>Typ</th></tr></thead>
      <tbody>${summaryRows || `<tr><td colspan="5" class="muted">—</td></tr>`}</tbody>
    </table>

    <div style="margin-top:16px;display:flex;gap:20px">
      <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px">
        <div style="font-weight:700;font-size:12px;color:#9a3412">🔴 Warm ≥65°C — ${totalHotGn} GN</div>
        <div style="font-size:11px;color:#57534e;margin-top:2px">Thermobehälter / Heißhaltebox</div>
      </div>
      <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px">
        <div style="font-weight:700;font-size:12px;color:#1e40af">🔵 Kalt ≤7°C — ${totalColdGn} GN</div>
        <div style="font-size:11px;color:#57534e;margin-top:2px">Kühlbox / Kühlfahrzeug</div>
      </div>
    </div>

    <h2 style="margin-top:24px">${L.orders} (${orders.length})</h2>
    <table>
      <thead><tr><th>${L.customer}</th><th>${L.items}</th><th class="right">${L.total}</th></tr></thead>
      <tbody>${orderRows || `<tr><td colspan="3" class="muted">—</td></tr>`}</tbody>
    </table>

    <div style="margin-top:20px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;font-size:12px;color:#713f12">
      ⚠️ ${L.haccp}
    </div>

    <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">${L.driver}</div>
        <div style="border-bottom:1px solid #1c1917;height:40px"></div>
        <div style="font-size:11px;color:#78716c;margin-top:4px">${L.sign}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">Gesamt GN</div>
        <div style="font-size:24px;font-weight:800">${totalHotGn + totalColdGn}</div>
        <div style="font-size:11px;color:#78716c">${totalHotGn} warm · ${totalColdGn} kalt</div>
      </div>
    </div>
    <div class="footer">KItchenOS · ${L.title} · ${escapeHtml(locationName)} · ${today}</div>
  `;
  return baseHtml(L.title, body);
}

// ---- Preorder HACCP Begleitdokument ----

export function preorderHaccpSheetHtml(
  orders: PreorderSheetOrder[],
  locationName: string,
  locale: "de" | "en",
): string {
  const fmt = locale === "de" ? "de-DE" : "en-GB";
  const today = new Date().toLocaleDateString(fmt);
  const now = new Date().toLocaleTimeString(fmt, { hour: "2-digit", minute: "2-digit" });

  // Aggregate
  const dishTotals = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.items) {
      dishTotals.set(item.name, (dishTotals.get(item.name) ?? 0) + item.qty);
    }
  }

  const tempRows = [...dishTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, qty]) => {
      const hot = isHotDish(name);
      const target = hot ? "≥65°C" : "≤7°C";
      return `<tr>
        <td>${escapeHtml(name)}</td>
        <td class="right">${qty}</td>
        <td style="font-size:11px;color:${hot ? "#991b1b" : "#1e40af"};font-weight:600">${target}</td>
        <td style="width:90px;border:1px solid #ccc">&nbsp;</td>
        <td style="width:90px;border:1px solid #ccc">&nbsp;</td>
        <td style="width:80px;border:1px solid #ccc">&nbsp;</td>
      </tr>`;
    })
    .join("");

  const checklist = locale === "de"
    ? [
        "□ Thermobehälter / Kühlbox auf Temperatur geprüft",
        "□ Gerichte korrekt etikettiert (Gericht, Datum, Allergene)",
        "□ Rückstellprobe entnommen und beschriftet",
        "□ Fahrzeug sauber und desinfiziert",
        "□ Uhrzeit der Abfahrt dokumentiert",
      ]
    : [
        "□ Thermal/cool container temperature verified",
        "□ Dishes correctly labelled (name, date, allergens)",
        "□ Food sample (Rückstellprobe) taken and labelled",
        "□ Vehicle clean and sanitised",
        "□ Departure time documented",
      ];

  const body = `
    <div class="header">
      <div>
        <div class="brand">KITCHENOS</div>
        <h1>${locale === "de" ? "HACCP Begleitdokument — Auslieferung" : "HACCP Delivery Record"}</h1>
      </div>
      <div class="muted">${today} · ${escapeHtml(locationName)}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px;font-size:12px">
      <div><strong>${locale === "de" ? "Datum" : "Date"}:</strong> ${today}</div>
      <div><strong>${locale === "de" ? "Uhrzeit Produktion" : "Production time"}:</strong> ${now}</div>
      <div><strong>${locale === "de" ? "Standort" : "Location"}:</strong> ${escapeHtml(locationName)}</div>
    </div>

    <h2 style="margin-top:20px">${locale === "de" ? "Vor-Abfahrt Checkliste" : "Pre-departure Checklist"}</h2>
    <div style="font-size:12px;line-height:2.0">
      ${checklist.map((c) => `<div>${escapeHtml(c)}</div>`).join("")}
    </div>

    <h2 style="margin-top:20px">${locale === "de" ? "Temperaturprotokoll" : "Temperature Log"}</h2>
    <table>
      <thead><tr>
        <th>${locale === "de" ? "Gericht" : "Dish"}</th>
        <th class="right">${locale === "de" ? "Portionen" : "Portions"}</th>
        <th>${locale === "de" ? "Zieltemp." : "Target temp."}</th>
        <th>${locale === "de" ? "Temp. bei Abfahrt" : "Temp. at departure"}</th>
        <th>${locale === "de" ? "Temp. bei Ankunft" : "Temp. at arrival"}</th>
        <th>${locale === "de" ? "Kürzel" : "Initials"}</th>
      </tr></thead>
      <tbody>${tempRows || `<tr><td colspan="6" class="muted">—</td></tr>`}</tbody>
    </table>

    <div style="margin-top:16px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px;font-size:11px;color:#713f12">
      ⚠️ ${locale === "de"
        ? "Temperaturen abweichend von Zielwert: Produkt nicht ausliefern, Vorgesetzten informieren, CCP-Protokoll ausfüllen."
        : "Temperature deviates from target: do not deliver, inform supervisor, complete CCP record."}
    </div>

    <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">${locale === "de" ? "Fahrer" : "Driver"}</div>
        <div style="border-bottom:1px solid #1c1917;height:40px"></div>
        <div style="font-size:11px;color:#78716c;margin-top:4px">${locale === "de" ? "Unterschrift / Datum" : "Signature / Date"}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#78716c;margin-bottom:4px">${locale === "de" ? "Empfänger (Unterschrift bei Ankunft)" : "Recipient (signature on arrival)"}</div>
        <div style="border-bottom:1px solid #1c1917;height:40px"></div>
        <div style="font-size:11px;color:#78716c;margin-top:4px">${locale === "de" ? "Unterschrift / Uhrzeit" : "Signature / Time"}</div>
      </div>
    </div>
    <div class="footer">KItchenOS · HACCP · ${escapeHtml(locationName)} · ${today}</div>
  `;
  return baseHtml(locale === "de" ? "HACCP Begleitdokument" : "HACCP Delivery Record", body);
}

export async function sharePdf(html: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => setTimeout(() => w.print(), 250));
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }
}

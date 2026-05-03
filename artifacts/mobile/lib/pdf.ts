import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { CateringRequest, OrderDraft, Recipe, Locale } from "@/types";

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
    <div class="footer">KitchenOS · ${labels.title} #${order.id.slice(0, 8)}</div>
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
    <div class="footer">KitchenOS · ${escapeHtml(req.subject)}</div>
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
    <div class="footer">KitchenOS · ${labels.title} · ${escapeHtml(recipe.id.slice(0, 8))}</div>
  `;
  return baseHtml(labels.title, body);
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

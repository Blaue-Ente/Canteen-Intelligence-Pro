import React, { useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChart, HBar, PieLegend } from "@/components/Chart";
import { Badge, Button, Card, Chip, SectionHeader, Stat } from "@/components/ui";
import { sharePdf } from "@/lib/pdf";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { recipeCost } from "@/lib/computations";

// ── helpers ──────────────────────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w = new Date(d.getFullYear(), 0, 4);
  return Math.round(((d.getTime() - w.getTime()) / 86400000 - 3 + ((w.getDay() + 6) % 7)) / 7) + 1;
}

function startOfWeek(offset = 0): Date {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() - dow + offset * 7);
  return mon;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function fmtEur(n: number) {
  return `€${n.toFixed(0)}`;
}

function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

const DOW_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// ── component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [kpiPeriod, setKpiPeriod] = useState<"week" | "month">("week");
  const [exporting, setExporting] = useState(false);
  const isDe = state.locale === "de";

  // ── 1. Wochenbericht / KPI Vergleich ──────────────────────────────────────
  const kpi = useMemo(() => {
    const now = new Date();
    let currFrom: Date, currTo: Date, prevFrom: Date, prevTo: Date;
    if (kpiPeriod === "week") {
      currFrom = startOfWeek(0);
      currTo = now;
      prevFrom = startOfWeek(-1);
      prevTo = startOfWeek(0);
    } else {
      currFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      currTo = now;
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    function agg(from: Date, to: Date) {
      const rows = state.sales.filter((s) => {
        const d = new Date(s.date);
        return d >= from && d < to;
      });
      return {
        revenue: rows.reduce((s, x) => s + x.revenue, 0),
        sold: rows.reduce((s, x) => s + x.sold, 0),
        cooked: rows.reduce((s, x) => s + x.cooked, 0),
        waste: rows.reduce((s, x) => s + x.cooked - x.sold, 0),
        days: Math.max(1, daysBetween(from, to)),
      };
    }
    const curr = agg(currFrom, currTo);
    const prev = agg(prevFrom, prevTo);
    return { curr, prev };
  }, [state.sales, kpiPeriod]);

  const revDelta = delta(kpi.curr.revenue, kpi.prev.revenue);
  const soldDelta = delta(kpi.curr.sold, kpi.prev.sold);
  const wastePct = kpi.curr.cooked > 0 ? Math.round((kpi.curr.waste / kpi.curr.cooked) * 100) : 0;
  const prevWastePct = kpi.prev.cooked > 0 ? Math.round((kpi.prev.waste / kpi.prev.cooked) * 100) : 0;

  // ── 2. Abfall-Analyse ─────────────────────────────────────────────────────
  const wasteAnalysis = useMemo(() => {
    const reasons = ["spoilage", "overproduction", "preparation", "plate"] as const;
    const colors = [c.destructive, c.warning, c.chartB, c.chartC];
    const totals = reasons.map((r, i) => {
      const entries = state.waste.filter((w) => w.reason === r);
      return {
        label: t(r as never),
        reason: r,
        cost: entries.reduce((s, w) => s + w.cost, 0),
        grams: entries.reduce((s, w) => s + w.grams, 0),
        color: colors[i]!,
      };
    });
    const maxCost = Math.max(1, ...totals.map((x) => x.cost));

    // 7-day trend
    const trend7: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cost = state.waste.filter((w) => w.date.startsWith(key)).reduce((s, w) => s + w.cost, 0);
      trend7.push({ label: DOW_LABELS[(d.getDay() + 6) % 7]!, value: cost });
    }
    return { totals, maxCost, trend7 };
  }, [state.waste, c, t]);

  // ── 3. Wareneinsatz & Inventurwert ────────────────────────────────────────
  const stockData = useMemo(() => {
    const CAT_COLORS: Record<string, string> = {
      meat: c.destructive,
      dairy: c.warning,
      vegetable: c.success,
      fruit: c.chartA,
      dry: c.chartB,
      spice: c.chartC,
      drink: c.chartD,
      frozen: "#818cf8",
      other: c.mutedForeground,
    };
    const byCategory = new Map<string, number>();
    let totalValue = 0;
    for (const item of state.inventory) {
      const unitValue =
        item.unit === "kg" || item.unit === "l"
          ? item.pricePerUnit * item.quantity
          : item.pricePerUnit * item.quantity;
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + unitValue);
      totalValue += unitValue;
    }
    const segments = Array.from(byCategory.entries())
      .map(([cat, value]) => ({ label: cat, value, color: CAT_COLORS[cat] ?? c.muted }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // expiring ≤7 days
    const now = Date.now();
    const expiring7 = state.inventory.filter((i) => {
      if (!i.expiresAt) return false;
      const diff = (new Date(i.expiresAt).getTime() - now) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    const expiring14 = state.inventory.filter((i) => {
      if (!i.expiresAt) return false;
      const diff = (new Date(i.expiresAt).getTime() - now) / 86400000;
      return diff > 7 && diff <= 14;
    });
    const belowMin = state.inventory.filter((i) => i.quantity < i.minQuantity);

    // Food cost ratio: recipe cost of sold portions vs revenue (last 30 days)
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const recentSales = state.sales.filter((s) => new Date(s.date) >= cutoff30);
    let totalCostOfSold = 0;
    let totalRevenue = 0;
    for (const sale of recentSales) {
      const recipe = state.recipes.find((r) => r.id === sale.recipeId);
      if (!recipe) continue;
      const cost = recipeCost(recipe, state.inventory);
      totalCostOfSold += cost * sale.sold;
      totalRevenue += sale.revenue;
    }
    const foodCostRatio = totalRevenue > 0 ? (totalCostOfSold / totalRevenue) * 100 : 0;

    return { totalValue, segments, expiring7, expiring14, belowMin, foodCostRatio };
  }, [state.inventory, state.sales, state.recipes, c]);

  // ── 4. Catering-Pipeline ──────────────────────────────────────────────────
  const cateringData = useMemo(() => {
    const statuses = ["anfrage", "angebot", "bestaetigt", "produktion", "abgeschlossen", "abgesagt"] as const;
    const statusColors: Record<string, string> = {
      anfrage: c.mutedForeground,
      angebot: c.chartB,
      bestaetigt: c.chartA,
      produktion: c.warning,
      abgeschlossen: c.success,
      abgesagt: c.destructive,
    };
    function eventTotal(ev: (typeof state.events)[number]) {
      const food = ev.menuItems.reduce((s, m) => s + m.portions * m.pricePerPortion, 0);
      const overhead = (ev.overheadPct ?? 15) / 100;
      const vat = (ev.vatPct ?? 19) / 100;
      const extras = (ev.staffCost ?? 0) + (ev.equipmentCost ?? 0) + (ev.transportCost ?? 0);
      const net = food * (1 + overhead) + extras;
      return net * (1 + vat);
    }

    const pipeline = statuses.map((s) => {
      const evs = state.events.filter((e) => e.status === s);
      return {
        status: s,
        count: evs.length,
        value: evs.reduce((sum, e) => sum + eventTotal(e), 0),
        color: statusColors[s]!,
      };
    });

    // Monthly revenue (last 6 months, abgeschlossen only)
    const months: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("de-DE", { month: "short" });
      const evs = state.events.filter((e) => {
        if (e.status !== "abgeschlossen") return false;
        const eDate = new Date(e.eventDate);
        return eDate.getFullYear() === d.getFullYear() && eDate.getMonth() === d.getMonth();
      });
      months.push({ label, value: evs.reduce((s, e) => s + eventTotal(e), 0) });
    }

    const paidInvoices = state.events.filter((e) => e.invoicePaid && e.status === "abgeschlossen");
    const unpaidInvoices = state.events.filter(
      (e) => !e.invoicePaid && e.status === "abgeschlossen" && e.invoiceNo,
    );
    const paidValue = paidInvoices.reduce((s, e) => s + eventTotal(e), 0);
    const unpaidValue = unpaidInvoices.reduce((s, e) => s + eventTotal(e), 0);

    return { pipeline, months, paidValue, unpaidValue, paidCount: paidInvoices.length, unpaidCount: unpaidInvoices.length };
  }, [state.events, c]);

  // ── 5. HACCP-Konformität ──────────────────────────────────────────────────
  const haccpData = useMemo(() => {
    const now = new Date();
    const days30 = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days30.add(d.toISOString().slice(0, 10));
    }
    const logsInPeriod = state.haccp.filter((h) => days30.has(h.date.slice(0, 10)));
    const datesWithLog = new Set(logsInPeriod.map((h) => h.date.slice(0, 10)));
    const compliancePct = Math.round((datesWithLog.size / 30) * 100);

    const types = ["fridge", "freezer", "delivery", "cleaning", "cooking"] as const;
    const typeLabels: Record<string, string> = {
      fridge: "Kühlschrank",
      freezer: "Tiefkühler",
      delivery: "Lieferung",
      cleaning: "Reinigung",
      cooking: "Garen",
    };
    const byType = types.map((tp) => ({
      label: typeLabels[tp]!,
      value: logsInPeriod.filter((h) => h.type === tp).length,
    }));
    const maxByType = Math.max(1, ...byType.map((x) => x.value));

    const issues = logsInPeriod.filter((h) => !h.ok).length;

    // Last 7 days log count
    const trend7: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend7.push({
        label: DOW_LABELS[(d.getDay() + 6) % 7]!,
        value: logsInPeriod.filter((h) => h.date.startsWith(key)).length,
      });
    }

    return { compliancePct, byType, maxByType, issues, datesWithLog: datesWithLog.size, trend7 };
  }, [state.haccp]);

  // ── 6. Wochentag-Performance ──────────────────────────────────────────────
  const weekdayData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 90);
    const recentSales = state.sales.filter((s) => new Date(s.date) >= cutoff);

    const sumRev = [0, 0, 0, 0, 0, 0, 0];
    const cntRev = [0, 0, 0, 0, 0, 0, 0];
    for (const s of recentSales) {
      const dow = (new Date(s.date).getDay() + 6) % 7;
      sumRev[dow]! += s.revenue;
      cntRev[dow]!++;
    }
    return DOW_LABELS.map((label, i) => ({
      label,
      value: cntRev[i]! > 0 ? sumRev[i]! / cntRev[i]! : 0,
    }));
  }, [state.sales]);

  const bestDay = weekdayData.reduce(
    (best, d, i) => (d.value > (weekdayData[best]?.value ?? 0) ? i : best),
    0,
  );

  // ── helpers ───────────────────────────────────────────────────────────────
  function DeltaBadge({ d, invertColor }: { d: number | null; invertColor?: boolean }) {
    if (d === null) return null;
    const positive = invertColor ? d < 0 : d > 0;
    const tone = d === 0 ? "default" : positive ? "success" : "destructive";
    return <Badge label={`${d > 0 ? "+" : ""}${d}%`} tone={tone} />;
  }

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const fmt = isDe ? "de-DE" : "en-GB";
      const today = new Date().toLocaleDateString(fmt);
      const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]!);
      const periodLabel = kpiPeriod === "week" ? (isDe ? "Woche" : "Week") : (isDe ? "Monat" : "Month");
      const wasteRows = wasteAnalysis.totals.map((w) =>
        `<tr><td>${esc(w.label)}</td><td style="text-align:right">€${w.cost.toFixed(2)}</td><td style="text-align:right">${w.grams}g</td></tr>`,
      ).join("");
      const html = `<!DOCTYPE html><html lang="${isDe ? "de" : "en"}"><head><meta charset="utf-8"/><title>${isDe ? "Berichte" : "Reports"}</title>
<style>body{font-family:system-ui,sans-serif;color:#1c1917;padding:36px;max-width:720px;margin:auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:28px 0 8px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e7e5e4;font-size:13px}
th{color:#78716c;font-weight:600;font-size:11px;text-transform:uppercase}
.header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #f59e0b;padding-bottom:8px}
.brand{color:#f59e0b;font-weight:700;font-size:13px;letter-spacing:.12em}
.footer{margin-top:36px;font-size:11px;color:#78716c;border-top:1px solid #e7e5e4;padding-top:12px;text-align:center}
</style></head><body>
<div class="header"><div><div class="brand">KITCHENOS</div><h1>${isDe ? "Berichte" : "Reports"}</h1></div>
<div style="font-size:12px;color:#78716c">${esc(periodLabel)} · ${today}</div></div>
<h2>${isDe ? "KPI Vergleich" : "KPI Comparison"}</h2>
<table><thead><tr><th>${isDe ? "Kennzahl" : "Metric"}</th><th style="text-align:right">${isDe ? "Aktuell" : "Current"}</th><th style="text-align:right">${isDe ? "Vorperiode" : "Previous"}</th></tr></thead><tbody>
<tr><td>${isDe ? "Umsatz" : "Revenue"}</td><td style="text-align:right">€${kpi.curr.revenue.toFixed(2)}</td><td style="text-align:right">€${kpi.prev.revenue.toFixed(2)}</td></tr>
<tr><td>${isDe ? "Portionen verkauft" : "Portions sold"}</td><td style="text-align:right">${kpi.curr.sold}</td><td style="text-align:right">${kpi.prev.sold}</td></tr>
<tr><td>${isDe ? "Verlust" : "Waste"}</td><td style="text-align:right">${wastePct}%</td><td style="text-align:right">${prevWastePct}%</td></tr>
</tbody></table>
<h2>${isDe ? "Abfall-Analyse" : "Waste Analysis"}</h2>
<table><thead><tr><th>${isDe ? "Kategorie" : "Category"}</th><th style="text-align:right">${isDe ? "Kosten" : "Cost"}</th><th style="text-align:right">Gramm</th></tr></thead><tbody>${wasteRows}</tbody></table>
<div class="footer">KItchenOS · ${isDe ? "Berichte" : "Reports"}</div></body></html>`;
      await sharePdf(html, `berichte_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 110,
          gap: 14,
        }}
      >
        {/* Header */}
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
          {t("reportsTitle")}
        </Text>

        {/* ── 1. KPI Vergleich ────────────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionHeader title={t("wochenbericht")} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip label={t("week")} active={kpiPeriod === "week"} onPress={() => setKpiPeriod("week")} />
              <Chip label={t("month")} active={kpiPeriod === "month"} onPress={() => setKpiPeriod("month")} />
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <KpiRow
              label={t("revenue")}
              curr={fmtEur(kpi.curr.revenue)}
              prev={fmtEur(kpi.prev.revenue)}
              delta={<DeltaBadge d={revDelta} />}
              c={c}
            />
            <KpiRow
              label={t("sold") + " (Port.)"}
              curr={String(kpi.curr.sold)}
              prev={String(kpi.prev.sold)}
              delta={<DeltaBadge d={soldDelta} />}
              c={c}
            />
            <KpiRow
              label={t("wasteRatio")}
              curr={`${wastePct}%`}
              prev={`${prevWastePct}%`}
              delta={<DeltaBadge d={delta(wastePct, prevWastePct)} invertColor />}
              c={c}
            />
            <KpiRow
              label={t("avgPerDay")}
              curr={fmtEur(kpi.curr.revenue / kpi.curr.days)}
              prev={fmtEur(kpi.prev.revenue / Math.max(1, kpi.prev.days))}
              delta={null}
              c={c}
            />
          </View>
        </Card>

        {/* ── 2. Abfall-Analyse ───────────────────────────────────────────── */}
        <Card>
          <SectionHeader title={t("wasteAnalysis")} />
          {state.waste.length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {t("noData")}
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <Stat
                  label={t("wasteTotal")}
                  value={`${(state.waste.reduce((s, w) => s + w.grams, 0) / 1000).toFixed(1)} kg`}
                  icon="trash-2"
                  tone="warning"
                />
                <Stat
                  label={t("wasteCost")}
                  value={fmtEur(state.waste.reduce((s, w) => s + w.cost, 0))}
                  icon="trending-down"
                  tone="destructive"
                />
              </View>

              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {t("wasteByReason")}
              </Text>
              {wasteAnalysis.totals.map((item) => (
                <HBar
                  key={item.reason}
                  label={item.label}
                  value={item.cost}
                  max={wasteAnalysis.maxCost}
                  color={item.color}
                  suffix=" €"
                />
              ))}

              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                {t("wasteTrend7d")}
              </Text>
              <BarChart data={wasteAnalysis.trend7} height={140} />
            </>
          )}
        </Card>

        {/* ── 3. Wareneinsatz & Lager ─────────────────────────────────────── */}
        <Card>
          <SectionHeader title={t("wareneinsatzLager")} />
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <Stat
              label={t("stockValue")}
              value={fmtEur(stockData.totalValue)}
              icon="package"
              tone="default"
            />
            <Stat
              label={t("foodCostRatio")}
              value={`${stockData.foodCostRatio.toFixed(1)}%`}
              icon="percent"
              tone={stockData.foodCostRatio > 35 ? "destructive" : stockData.foodCostRatio > 28 ? "warning" : "success"}
            />
          </View>

          {stockData.foodCostRatio > 0 ? (
            <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {stockData.foodCostRatio > 35
                  ? "⚠ Wareneinsatzquote über Zielwert (30 %). Rezepte prüfen."
                  : stockData.foodCostRatio > 28
                    ? "Wareneinsatzquote im akzeptablen Bereich (Ziel: <30 %)."
                    : "✓ Wareneinsatzquote unter 28 % — sehr effizient."}
              </Text>
            </View>
          ) : null}

          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {t("stockByCategory")}
          </Text>
          <PieLegend segments={stockData.segments.map((s) => ({ ...s, label: s.label }))} />

          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AlertBox
              count={stockData.expiring7.length}
              label={t("expiring7")}
              tone={stockData.expiring7.length > 0 ? "destructive" : "success"}
              c={c}
            />
            <AlertBox
              count={stockData.expiring14.length}
              label={t("expiring14")}
              tone={stockData.expiring14.length > 0 ? "warning" : "default"}
              c={c}
            />
            <AlertBox
              count={stockData.belowMin.length}
              label={t("belowMin")}
              tone={stockData.belowMin.length > 0 ? "warning" : "default"}
              c={c}
            />
          </View>
        </Card>

        {/* ── 4. Catering-Pipeline ────────────────────────────────────────── */}
        <Card>
          <SectionHeader title={t("cateringPipeline")} />
          {state.events.length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {t("noData")}
            </Text>
          ) : (
            <>
              <View style={{ gap: 8, marginBottom: 14 }}>
                {cateringData.pipeline
                  .filter((p) => p.count > 0)
                  .map((p) => (
                    <View
                      key={p.status}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
                      <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        {t(("status" + p.status.charAt(0).toUpperCase() + p.status.slice(1)) as never)}
                      </Text>
                      <Badge label={String(p.count)} tone="default" />
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12, minWidth: 64, textAlign: "right" }}>
                        {fmtEur(p.value)}
                      </Text>
                    </View>
                  ))}
              </View>

              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <Stat
                  label={t("paidInvoices")}
                  value={`${cateringData.paidCount} · ${fmtEur(cateringData.paidValue)}`}
                  icon="check-circle"
                  tone="success"
                />
                <Stat
                  label={t("unpaidInvoices")}
                  value={`${cateringData.unpaidCount} · ${fmtEur(cateringData.unpaidValue)}`}
                  icon="clock"
                  tone={cateringData.unpaidCount > 0 ? "warning" : "default"}
                />
              </View>

              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                {t("cateringRevenueMonthly")}
              </Text>
              <BarChart data={cateringData.months} height={150} />
            </>
          )}
        </Card>

        {/* ── 5. HACCP-Konformität ─────────────────────────────────────────── */}
        <Card>
          <SectionHeader title={t("haccpCompliance")} />
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <Stat
              label={t("complianceRate")}
              value={`${haccpData.compliancePct}%`}
              icon="shield"
              tone={haccpData.compliancePct >= 80 ? "success" : haccpData.compliancePct >= 50 ? "warning" : "destructive"}
            />
            <Stat
              label={t("daysLogged")}
              value={`${haccpData.datesWithLog} / 30`}
              icon="calendar"
              tone="default"
            />
            <Stat
              label={t("haccpIssues")}
              value={String(haccpData.issues)}
              icon="alert-triangle"
              tone={haccpData.issues > 0 ? "destructive" : "success"}
            />
          </View>

          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {t("checksByType")}
          </Text>
          {haccpData.byType.map((item) => (
            <HBar
              key={item.label}
              label={item.label}
              value={item.value}
              max={haccpData.maxByType}
              suffix=" Logs"
            />
          ))}

          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            {t("logsLast7d")}
          </Text>
          <BarChart data={haccpData.trend7} height={130} />
        </Card>

        {/* ── 6. Wochentag-Performance ────────────────────────────────────── */}
        <Card>
          <SectionHeader title={t("weekdayPerformance")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8 }}>
            {t("weekdayDesc")}
          </Text>
          {weekdayData.every((d) => d.value === 0) ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {t("noData")}
            </Text>
          ) : (
            <>
              <BarChart
                data={weekdayData.map((d, i) => ({
                  ...d,
                  color: i === bestDay ? c.success : undefined,
                }))}
                height={160}
              />
              <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, marginTop: 10 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {t("bestDay")}: {DOW_LABELS[bestDay]} · {fmtEur(weekdayData[bestDay]?.value ?? 0)} Ø
                </Text>
              </View>
            </>
          )}
        </Card>

        <Button
          label={exporting ? (isDe ? "PDF wird erstellt…" : "Generating PDF…") : (isDe ? "PDF exportieren" : "Export PDF")}
          icon="download"
          variant="secondary"
          onPress={exportPdf}
        />
      </ScrollView>
    </View>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function KpiRow({
  label,
  curr,
  prev,
  delta,
  c,
}: {
  label: string;
  curr: string;
  prev: string;
  delta: React.ReactNode;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: c.border,
        gap: 8,
      }}
    >
      <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
        {label}
      </Text>
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14, minWidth: 60, textAlign: "right" }}>
        {curr}
      </Text>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, minWidth: 48, textAlign: "right" }}>
        {prev}
      </Text>
      <View style={{ minWidth: 48, alignItems: "flex-end" }}>{delta}</View>
    </View>
  );
}

function AlertBox({
  count,
  label,
  tone,
  c,
}: {
  count: number;
  label: string;
  tone: "destructive" | "warning" | "success" | "default";
  c: ReturnType<typeof useColors>;
}) {
  const toneColor =
    tone === "destructive"
      ? c.destructive
      : tone === "warning"
        ? c.warning
        : tone === "success"
          ? c.success
          : c.foreground;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.muted,
        borderRadius: 8,
        padding: 10,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text style={{ color: toneColor, fontFamily: "Inter_700Bold", fontSize: 20 }}>{count}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChart, HBar, PieLegend } from "@/components/Chart";
import { Card, Chip, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Range = "today" | "week" | "month" | "day";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function withinRange(date: string, r: Range, pickedDay?: string): boolean {
  if (r === "day") return date === pickedDay;
  const now = new Date();
  const diff = (now.getTime() - new Date(date).getTime()) / (24 * 3600 * 1000);
  if (r === "today") return diff < 1;
  if (r === "week") return diff <= 7;
  return diff <= 31;
}

function fmtDay(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()]!;
  return `${day} ${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export default function Stats() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [range, setRange] = useState<Range>("week");
  const [pickedDay, setPickedDay] = useState<string>(dateKey(new Date()));

  // Last 14 days for the day picker
  const dayOptions = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return dateKey(d);
    });
  }, []);

  const sales = useMemo(
    () => state.sales.filter((s) => withinRange(s.date, range, pickedDay)),
    [state.sales, range, pickedDay],
  );

  const cooked = sales.reduce((s, x) => s + x.cooked, 0);
  const sold = sales.reduce((s, x) => s + x.sold, 0);
  const revenue = sales.reduce((s, x) => s + x.revenue, 0);
  const wasteRatio = cooked > 0 ? Math.round(((cooked - sold) / cooked) * 100) : 0;

  // Best sellers
  const bySold = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => m.set(s.recipeId, (m.get(s.recipeId) ?? 0) + s.sold));
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
  }, [sales]);

  // By group
  const byGroup = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => {
      const r = state.recipes.find((x) => x.id === s.recipeId);
      if (!r) return;
      m.set(r.category, (m.get(r.category) ?? 0) + s.sold);
    });
    const colors = [c.chartA, c.chartB, c.chartC, c.chartD, c.success];
    return Array.from(m.entries()).map(([label, v], i) => ({
      label: t(label as never),
      value: v,
      color: colors[i % colors.length]!,
    }));
  }, [sales, state.recipes, c, t]);

  // By meat type
  const byMeat = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => {
      const r = state.recipes.find((x) => x.id === s.recipeId);
      if (!r || r.meat === "none") return;
      m.set(r.meat, (m.get(r.meat) ?? 0) + s.sold);
    });
    return Array.from(m.entries())
      .map(([k, v]) => ({ label: t(k as never), value: v }))
      .sort((a, b) => b.value - a.value);
  }, [sales, state.recipes, t]);

  // Cooked vs sold last 7 days
  const last7 = useMemo(() => {
    const days: { label: string; value: number; altValue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = state.sales.filter((s) => s.date === key);
      const c2 = day.reduce((a, b) => a + b.cooked, 0);
      const s2 = day.reduce((a, b) => a + b.sold, 0);
      days.push({ label: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][d.getDay() === 0 ? 6 : d.getDay() - 1]!, value: s2, altValue: c2 });
    }
    return days;
  }, [state.sales]);

  const maxBest = bySold[0]?.v ?? 1;

  // Per-recipe cooked vs sold
  const perDish = useMemo(() => {
    const m = new Map<string, { cooked: number; sold: number; revenue: number }>();
    sales.forEach((s) => {
      const prev = m.get(s.recipeId) ?? { cooked: 0, sold: 0, revenue: 0 };
      m.set(s.recipeId, { cooked: prev.cooked + s.cooked, sold: prev.sold + s.sold, revenue: prev.revenue + s.revenue });
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.cooked - a.cooked)
      .slice(0, 8);
  }, [sales]);
  const maxPerDish = perDish.reduce((m, x) => Math.max(m, x.cooked, x.sold), 1);

  const rangeOptions: Range[] = ["today", "day", "week", "month"];
  const rangeLabels: Record<Range, string> = {
    today: state.locale === "de" ? "Heute" : "Today",
    day: state.locale === "de" ? "Tag" : "Day",
    week: state.locale === "de" ? "Woche" : "Week",
    month: state.locale === "de" ? "Monat" : "Month",
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          padding: 16,
          paddingBottom: insets.bottom + 110,
          gap: 14,
        }}
      >
        {/* Header + range selector */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {t("stats")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {rangeOptions.map((r) => (
              <Chip key={r} label={rangeLabels[r]} active={range === r} onPress={() => setRange(r)} />
            ))}
          </View>
        </View>

        {/* Day picker strip */}
        {range === "day" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
          >
            {dayOptions.map((d) => (
              <Pressable
                key={d}
                onPress={() => setPickedDay(d)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: pickedDay === d ? c.primary : c.card,
                    borderWidth: 1,
                    borderColor: pickedDay === d ? c.primary : c.border,
                    alignItems: "center",
                    minWidth: 60,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={{ color: pickedDay === d ? c.primaryForeground : c.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                  {fmtDay(d)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* KPI row */}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: isTablet ? "wrap" : "nowrap" }}>
          <Stat label={t("cooked")} value={String(cooked)} icon="play-circle" />
          <Stat label={t("sold")} value={String(sold)} icon="check-circle" tone="success" />
          <Stat label={t("revenue")} value={`€${revenue.toFixed(0)}`} icon="trending-up" tone="warning" />
          <Stat label="Verlust" value={`${wasteRatio}%`} icon="alert-triangle" tone={wasteRatio > 12 ? "destructive" : "default"} />
        </View>

        {/* Day-specific: per dish detail */}
        {range === "day" && (
          <Card>
            <SectionHeader title={state.locale === "de" ? `Tagesdetail · ${fmtDay(pickedDay)}` : `Day Detail · ${fmtDay(pickedDay)}`} />
            {perDish.length === 0 ? (
              <View style={{ padding: 16, alignItems: "center", gap: 8 }}>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                  {state.locale === "de" ? "Keine Verkäufe für diesen Tag." : "No sales for this day."}
                </Text>
              </View>
            ) : (
              perDish.map((p) => {
                const r = state.recipes.find((x) => x.id === p.id);
                if (!r) return null;
                const waste = p.cooked > 0 ? Math.round(((p.cooked - p.sold) / p.cooked) * 100) : 0;
                return (
                  <View key={p.id} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {state.locale === "de" ? r.nameDe : r.name}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <Text style={{ color: c.success, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          €{p.revenue.toFixed(2)}
                        </Text>
                        <Text style={{ color: waste > 15 ? c.destructive : waste > 8 ? c.warning : c.success, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                          {waste}% Verlust
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: 3 }}>
                      <HBar label={`${t("cooked")} (${p.cooked})`} value={p.cooked} max={maxPerDish} />
                      <HBar label={`${t("sold")} (${p.sold})`} value={p.sold} max={maxPerDish} />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        )}

        {/* Weekly bar chart (hide for "day" view) */}
        {range !== "day" && (
          <Card>
            <SectionHeader title={t("cookedVsSold")} />
            <BarChart data={last7} showAlt height={170} />
            <View style={{ flexDirection: "row", gap: 14, marginTop: 8, justifyContent: "center" }}>
              <Legend color={c.chartA} label={t("sold")} />
              <Legend color={c.chartD} label={t("cooked")} />
            </View>
          </Card>
        )}

        {/* Per-dish breakdown */}
        <Card>
          <SectionHeader title={t("perDish")} />
          {perDish.length === 0 ? (
            <Text style={{ color: c.mutedForeground, textAlign: "center", padding: 12, fontFamily: "Inter_400Regular" }}>
              Keine Daten
            </Text>
          ) : (
            perDish.map((p) => {
              const r = state.recipes.find((x) => x.id === p.id);
              if (!r) return null;
              const waste = p.cooked > 0 ? Math.round(((p.cooked - p.sold) / p.cooked) * 100) : 0;
              return (
                <View key={p.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {state.locale === "de" ? r.nameDe : r.name}
                    </Text>
                    <Text style={{ color: waste > 15 ? c.destructive : waste > 8 ? c.warning : c.success, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                      {waste}% Verlust
                    </Text>
                  </View>
                  <View style={{ gap: 3 }}>
                    <HBar label={t("cooked")} value={p.cooked} max={maxPerDish} />
                    <HBar label={t("sold")} value={p.sold} max={maxPerDish} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card>
          <SectionHeader title={t("bestSellers")} />
          {bySold.length === 0 ? (
            <Text style={{ color: c.mutedForeground, textAlign: "center", padding: 12, fontFamily: "Inter_400Regular" }}>
              Keine Daten
            </Text>
          ) : (
            bySold.map((b) => {
              const r = state.recipes.find((x) => x.id === b.id);
              if (!r) return null;
              return (
                <HBar
                  key={b.id}
                  label={state.locale === "de" ? r.nameDe : r.name}
                  value={b.v}
                  max={maxBest}
                  suffix=" Port."
                />
              );
            })
          )}
        </Card>

        <Card>
          <SectionHeader title={t("byGroup")} />
          <PieLegend segments={byGroup} />
        </Card>

        <Card>
          <SectionHeader title={t("byMeat")} />
          {byMeat.length === 0 ? (
            <Text style={{ color: c.mutedForeground, textAlign: "center", padding: 12, fontFamily: "Inter_400Regular" }}>
              Keine Fleischgerichte verkauft
            </Text>
          ) : (
            <BarChart data={byMeat} height={150} />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

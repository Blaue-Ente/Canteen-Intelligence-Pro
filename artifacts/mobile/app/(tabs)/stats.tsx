import React, { useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChart, HBar, PieLegend } from "@/components/Chart";
import { Card, Chip, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Range = "today" | "week" | "month";

function withinRange(date: string, r: Range): boolean {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / (24 * 3600 * 1000);
  if (r === "today") return diff < 1;
  if (r === "week") return diff <= 7;
  return diff <= 31;
}

export default function Stats() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [range, setRange] = useState<Range>("week");

  const sales = useMemo(() => state.sales.filter((s) => withinRange(s.date, range)), [state.sales, range]);

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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {t("stats")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["today", "week", "month"] as Range[]).map((r) => (
              <Chip key={r} label={t(r)} active={range === r} onPress={() => setRange(r)} />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("cooked")} value={String(cooked)} icon="play-circle" />
          <Stat label={t("sold")} value={String(sold)} icon="check-circle" tone="success" />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("revenue")} value={`€${revenue.toFixed(0)}`} icon="trending-up" tone="warning" />
          <Stat label="Verlust" value={`${wasteRatio}%`} icon="alert-triangle" tone={wasteRatio > 12 ? "destructive" : "default"} />
        </View>

        <Card>
          <SectionHeader title={t("cookedVsSold")} />
          <BarChart data={last7} showAlt height={170} />
          <View style={{ flexDirection: "row", gap: 14, marginTop: 8, justifyContent: "center" }}>
            <Legend color={c.chartA} label={t("sold")} />
            <Legend color={c.chartD} label={t("cooked")} />
          </View>
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

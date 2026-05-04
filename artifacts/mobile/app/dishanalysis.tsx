import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChart, HBar } from "@/components/Chart";
import { Badge, Button, Card, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { aiDishAnalysis, type DishAnalysisResult } from "@/lib/ai";
import { recipeMargin } from "@/lib/computations";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DishRow {
  recipeId: string;
  nameDe: string;
  nameEn: string;
  category: string;
  sold: number;
  cooked: number;
  revenue: number;
  marginPct: number;
  wasteRatioPct: number;
  daysOnMenu: number;
  avgPerDay: number;
  score: number;
}

// ─── Score weights ────────────────────────────────────────────────────────────
// 40 % sold volume (normalised), 30 % margin %, 20 % low waste, 10 % revenue
function calcScore(sold: number, marginPct: number, wasteRatioPct: number, revenue: number,
  maxSold: number, maxRevenue: number) {
  const soldN = maxSold > 0 ? sold / maxSold : 0;
  const marginN = Math.max(0, Math.min(1, marginPct / 100));
  const wasteN = Math.max(0, 1 - wasteRatioPct / 100);
  const revN = maxRevenue > 0 ? revenue / maxRevenue : 0;
  return Math.round((soldN * 40 + marginN * 30 + wasteN * 20 + revN * 10));
}

const PERIOD_DAYS = 90;

export default function DishAnalysis() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [aiResult, setAiResult] = useState<DishAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Build per-recipe KPIs ────────────────────────────────────────────────
  const dishes = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS);

    const map = new Map<string, { sold: number; cooked: number; revenue: number; days: Set<string> }>();
    for (const s of state.sales) {
      if (new Date(s.date) < cutoff) continue;
      const prev = map.get(s.recipeId) ?? { sold: 0, cooked: 0, revenue: 0, days: new Set() };
      prev.sold += s.sold;
      prev.cooked += s.cooked;
      prev.revenue += s.revenue;
      prev.days.add(s.date);
      map.set(s.recipeId, prev);
    }

    const rows: Omit<DishRow, "score">[] = [];
    for (const [recipeId, v] of map.entries()) {
      const recipe = state.recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;
      const margin = recipeMargin(recipe, state.inventory, state.priceHistory);
      const wasteRatioPct = v.cooked > 0 ? ((v.cooked - v.sold) / v.cooked) * 100 : 0;
      rows.push({
        recipeId,
        nameDe: recipe.nameDe,
        nameEn: recipe.name,
        category: recipe.category,
        sold: v.sold,
        cooked: v.cooked,
        revenue: v.revenue,
        marginPct: margin.marginPct,
        wasteRatioPct,
        daysOnMenu: v.days.size,
        avgPerDay: v.days.size > 0 ? v.sold / v.days.size : 0,
      });
    }

    const maxSold = Math.max(1, ...rows.map((r) => r.sold));
    const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));

    const scored: DishRow[] = rows.map((r) => ({
      ...r,
      score: calcScore(r.sold, r.marginPct, r.wasteRatioPct, r.revenue, maxSold, maxRevenue),
    }));
    return scored.sort((a, b) => b.score - a.score);
  }, [state.sales, state.recipes, state.inventory, state.priceHistory]);

  const topDishes = dishes.slice(0, 5);
  const flopDishes = [...dishes].sort((a, b) => a.score - b.score).slice(0, 3);
  const maxScore = 100;

  // ── Chart: top 8 by sold ──────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      [...dishes]
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 8)
        .map((d) => ({
          label: (state.locale === "de" ? d.nameDe : d.nameEn).split(" ")[0] ?? d.nameDe,
          value: d.sold,
        })),
    [dishes, state.locale],
  );

  // ── AI analysis ──────────────────────────────────────────────────────────
  const runAi = async () => {
    if (dishes.length === 0) {
      Alert.alert(t("noData"), t("dishAnalysisNeedData"));
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await aiDishAnalysis({
        dishes: dishes.map((d) => ({
          recipeId: d.recipeId,
          nameDe: d.nameDe,
          category: d.category,
          sold: d.sold,
          revenue: d.revenue,
          marginPct: d.marginPct,
          wasteRatioPct: d.wasteRatioPct,
          daysOnMenu: d.daysOnMenu,
        })),
        locale: state.locale,
      });
      setAiResult(result);
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const recipeName = (id: string) => {
    const r = state.recipes.find((x) => x.id === id);
    if (!r) return id;
    return state.locale === "de" ? r.nameDe : r.name;
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
        <View>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {t("dishAnalysisTitle")}
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 }}>
            {t("dishAnalysisDesc")}
          </Text>
        </View>

        {dishes.length === 0 ? (
          <Card>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", padding: 16 }}>
              {t("noData")}
            </Text>
          </Card>
        ) : (
          <>
            {/* ── Überblick Stats ─────────────────────────────────────────── */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat
                label={t("dishesTracked")}
                value={String(dishes.length)}
                icon="book-open"
                tone="default"
              />
              <Stat
                label={t("totalSoldPeriod")}
                value={String(dishes.reduce((s, d) => s + d.sold, 0))}
                icon="check-circle"
                tone="success"
              />
              <Stat
                label={t("totalRevenuePeriod")}
                value={`€${dishes.reduce((s, d) => s + d.revenue, 0).toFixed(0)}`}
                icon="trending-up"
                tone="warning"
              />
            </View>

            {/* ── Top Verkäufe Balken ──────────────────────────────────────── */}
            <Card>
              <SectionHeader title={t("topSellerChart")} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8 }}>
                {t("last90Days")}
              </Text>
              <BarChart data={chartData} height={160} />
            </Card>

            {/* ── Top Performer (Scorecard) ─────────────────────────────── */}
            <Card>
              <SectionHeader title={t("topPerformer")} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12 }}>
                {t("dishScoreDesc")}
              </Text>
              {topDishes.map((d, idx) => (
                <DishRow
                  key={d.recipeId}
                  rank={idx + 1}
                  name={state.locale === "de" ? d.nameDe : d.nameEn}
                  score={d.score}
                  maxScore={maxScore}
                  sold={d.sold}
                  revenue={d.revenue}
                  marginPct={d.marginPct}
                  wasteRatioPct={d.wasteRatioPct}
                  avgPerDay={d.avgPerDay}
                  tone="success"
                  c={c}
                  t={t}
                />
              ))}
            </Card>

            {/* ── Flop / Kandidaten zum Streichen ─────────────────────────── */}
            <Card style={{ borderColor: c.warning, borderWidth: 1.5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Feather name="alert-triangle" size={15} color={c.warning} />
                <SectionHeader title={t("flopDishes")} />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12 }}>
                {t("flopDishesDesc")}
              </Text>
              {flopDishes.map((d, idx) => (
                <DishRow
                  key={d.recipeId}
                  rank={idx + 1}
                  name={state.locale === "de" ? d.nameDe : d.nameEn}
                  score={d.score}
                  maxScore={maxScore}
                  sold={d.sold}
                  revenue={d.revenue}
                  marginPct={d.marginPct}
                  wasteRatioPct={d.wasteRatioPct}
                  avgPerDay={d.avgPerDay}
                  tone="destructive"
                  c={c}
                  t={t}
                />
              ))}
            </Card>

            {/* ── Vollständige Scorecard ────────────────────────────────────── */}
            <Card>
              <SectionHeader title={t("fullScorecard")} />
              {dishes.map((d) => {
                const tone =
                  d.score >= 70 ? "success" : d.score >= 40 ? "warning" : "destructive";
                return (
                  <View
                    key={d.recipeId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 7,
                      borderBottomWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}
                    >
                      {state.locale === "de" ? d.nameDe : d.nameEn}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, minWidth: 48, textAlign: "right" }}>
                      {d.sold} Port.
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, minWidth: 44, textAlign: "right" }}>
                      {d.marginPct.toFixed(0)}% M
                    </Text>
                    <Badge label={`${d.score}`} tone={tone} />
                  </View>
                );
              })}
            </Card>

            {/* ── KI-Analyse ───────────────────────────────────────────────── */}
            <Card>
              <SectionHeader title={t("aiDishAnalysis")} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 14 }}>
                {t("aiDishAnalysisDesc")}
              </Text>

              {aiLoading ? (
                <View style={{ alignItems: "center", padding: 20, gap: 12 }}>
                  <ActivityIndicator color={c.primary} size="large" />
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    {t("aiAnalysing")}
                  </Text>
                </View>
              ) : aiResult ? (
                <AiResultView result={aiResult} recipeName={recipeName} c={c} t={t} onReset={() => setAiResult(null)} />
              ) : (
                <Button label={t("runAiAnalysis")} icon="cpu" onPress={() => void runAi()} />
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DishRow({
  rank, name, score, maxScore, sold, revenue, marginPct, wasteRatioPct, avgPerDay, tone, c, t,
}: {
  rank: number;
  name: string;
  score: number;
  maxScore: number;
  sold: number;
  revenue: number;
  marginPct: number;
  wasteRatioPct: number;
  avgPerDay: number;
  tone: "success" | "destructive";
  c: ReturnType<typeof useColors>;
  t: ReturnType<typeof useT>;
}) {
  const scoreColor = tone === "success" ? c.success : c.destructive;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: tone === "success" ? c.success : c.destructive,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>
            {rank}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
          {name}
        </Text>
        <Text style={{ color: scoreColor, fontFamily: "Inter_700Bold", fontSize: 18 }}>{score}</Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>{t("score")}</Text>
      </View>

      <HBar label={t("score")} value={score} max={maxScore} color={scoreColor} />

      <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        <MiniStat label={t("sold")} value={`${sold}`} c={c} />
        <MiniStat label={`€`} value={`${revenue.toFixed(0)}`} c={c} />
        <MiniStat
          label={t("margin")}
          value={`${marginPct.toFixed(0)}%`}
          color={marginPct >= 50 ? c.success : marginPct >= 30 ? c.warning : c.destructive}
          c={c}
        />
        <MiniStat
          label={t("wasteRatio")}
          value={`${wasteRatioPct.toFixed(0)}%`}
          color={wasteRatioPct <= 8 ? c.success : wasteRatioPct <= 15 ? c.warning : c.destructive}
          c={c}
        />
        <MiniStat label="Ø/Tag" value={`${avgPerDay.toFixed(1)}`} c={c} />
      </View>
    </View>
  );
}

function MiniStat({
  label, value, color, c,
}: {
  label: string;
  value: string;
  color?: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ backgroundColor: c.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 9, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: color ?? c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
        {value}
      </Text>
    </View>
  );
}

function AiResultView({
  result, recipeName, c, t, onReset,
}: {
  result: DishAnalysisResult;
  recipeName: (id: string) => string;
  c: ReturnType<typeof useColors>;
  t: ReturnType<typeof useT>;
  onReset: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      {/* Top dishes */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Feather name="star" size={15} color={c.success} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
            {t("aiTopDishes")}
          </Text>
        </View>
        {result.topDishes.map((d, i) => (
          <View key={i} style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <Text style={{ color: c.success, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              ✓ {recipeName(d.recipeId)}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 }}>
              {d.reason}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ height: 1, backgroundColor: c.border }} />

      {/* Drop dishes */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Feather name="trash-2" size={15} color={c.destructive} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
            {t("aiDropDishes")}
          </Text>
        </View>
        {result.dropDishes.map((d, i) => (
          <View key={i} style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <Text style={{ color: c.destructive, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              ✕ {recipeName(d.recipeId)}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 }}>
              {d.reason}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ height: 1, backgroundColor: c.border }} />

      {/* Tips */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Feather name="zap" size={15} color={c.warning} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
            {t("aiTips")}
          </Text>
        </View>
        {result.tips.map((tip, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>•</Text>
            <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>
              {tip}
            </Text>
          </View>
        ))}
      </View>

      <Button label={t("runAiAnalysisAgain")} icon="refresh-cw" variant="ghost" onPress={onReset} />
    </View>
  );
}

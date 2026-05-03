import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { recipeMargin } from "@/lib/computations";

export default function Margin() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const rows = useMemo(() => {
    return state.recipes
      .map((r) => ({ recipe: r, margin: recipeMargin(r, state.inventory, state.priceHistory) }))
      .sort((a, b) => a.margin.marginPct - b.margin.marginPct);
  }, [state.recipes, state.inventory, state.priceHistory]);

  const alerts = rows.filter((x) => x.margin.marginPct < 40 || x.margin.trend === "up");

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("marginAlerts")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {state.locale === "de"
              ? "Wo verlierst du leise Geld — sortiert nach Marge, Warnung bei steigenden Kosten."
              : "Where you silently lose money — sorted by margin, alert on rising costs."}
          </Text>
        </Card>

        {alerts.length > 0 ? (
          <Card style={{ borderColor: c.warning }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="alert-triangle" size={16} color={c.warning} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {alerts.length} {state.locale === "de" ? "Warnungen" : "alerts"}
              </Text>
            </View>
          </Card>
        ) : null}

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="trending-up" title={t("empty")} />
          </Card>
        ) : (
          rows.map(({ recipe, margin }) => {
            const tone = margin.marginPct < 30 ? "destructive" : margin.marginPct < 50 ? "warning" : "success";
            return (
              <Card key={recipe.id} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                    {state.locale === "de" ? recipe.nameDe : recipe.name}
                  </Text>
                  <Badge label={`${margin.marginPct.toFixed(0)}%`} tone={tone} />
                </View>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8, alignItems: "center" }}>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {t("cost")}: €{margin.cost.toFixed(2)}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {t("price")}: €{margin.sellPrice.toFixed(2)}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather
                      name={margin.trend === "up" ? "trending-up" : margin.trend === "down" ? "trending-down" : "minus"}
                      size={14}
                      color={margin.trend === "up" ? c.destructive : margin.trend === "down" ? c.success : c.mutedForeground}
                    />
                    <Text
                      style={{
                        color: margin.trend === "up" ? c.destructive : margin.trend === "down" ? c.success : c.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                      }}
                    >
                      {margin.deltaEur >= 0 ? "+" : ""}€{margin.deltaEur.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

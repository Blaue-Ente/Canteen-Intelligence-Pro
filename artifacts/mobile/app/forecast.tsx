import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { aiForecast } from "@/lib/ai";
import { fetchWeather } from "@/lib/computations";

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Forecast() {
  const { state, dispatch, currentLocation } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(tomorrowKey());
  const existing = useMemo(
    () => state.forecasts.find((f) => f.date === date && (f.locationId ?? "") === (state.currentLocationId ?? "")),
    [state.forecasts, date, state.currentLocationId],
  );

  const recentSales = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400000;
    const byRecipe: Record<string, { sold: number; days: Set<string> }> = {};
    for (const s of state.sales) {
      if (new Date(s.date).getTime() < cutoff) continue;
      const e = byRecipe[s.recipeId] ?? { sold: 0, days: new Set() };
      e.sold += s.sold;
      e.days.add(s.date);
      byRecipe[s.recipeId] = e;
    }
    return Object.entries(byRecipe).map(([rid, v]) => {
      const r = state.recipes.find((x) => x.id === rid);
      return {
        recipeId: rid,
        recipeName: r ? (state.locale === "de" ? r.nameDe : r.name) : rid,
        avgSold: v.sold / Math.max(1, v.days.size),
      };
    });
  }, [state.sales, state.recipes, state.locale]);

  const generate = async () => {
    setBusy(true);
    try {
      const lat = currentLocation?.lat ?? state.locations[0]?.lat ?? 52.52;
      const lng = currentLocation?.lng ?? state.locations[0]?.lng ?? 13.39;
      const weather = (await fetchWeather(lat, lng, date)) ?? undefined;
      const avg = currentLocation?.avgGuestsPerDay ?? 150;
      const dow = new Date(date).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const result = await aiForecast({
        date,
        weather,
        avgGuestsPerDay: avg,
        recentSales,
        isWeekend,
        locale: state.locale,
      });
      const recommendations: Record<string, number> = {};
      for (const r of result.recommendations) {
        recommendations[r.recipeId] = Math.max(0, Math.round(r.portions));
      }
      dispatch({
        type: "upsertForecast",
        forecast: {
          date,
          locationId: state.currentLocationId,
          weather,
          expectedGuests: Math.max(0, Math.round(result.expectedGuests)),
          recommendations,
          rationale: result.rationale,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (e) {
      Alert.alert("KI", e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const applyToMenu = () => {
    if (!existing) return;
    const planned = { ...existing.recommendations };
    const ids = Object.keys(planned);
    const exMenu = state.menu.find((m) => m.date === date);
    dispatch({
      type: "setMenu",
      entry: {
        date,
        recipeIds: exMenu?.recipeIds?.length ? exMenu.recipeIds : ids,
        plannedCount: planned,
        portionOverrides: exMenu?.portionOverrides,
      },
    });
    Alert.alert(state.locale === "de" ? "Übernommen" : "Applied", "");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("forecast")} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1, 2, 3, 4].map((d) => {
              const dt = new Date();
              dt.setDate(dt.getDate() + d);
              const k = dt.toISOString().slice(0, 10);
              const active = date === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setDate(k)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: c.radius,
                    backgroundColor: active ? c.primary : c.muted,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? c.primaryForeground : c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 11,
                    }}
                  >
                    {dt.toLocaleDateString(state.locale === "de" ? "de-DE" : "en-GB", { weekday: "short" })}
                  </Text>
                  <Text
                    style={{
                      color: active ? c.primaryForeground : c.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 10,
                      marginTop: 2,
                    }}
                  >
                    {dt.getDate()}.{dt.getMonth() + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label={busy ? t("thinking") : t("forecastTomorrow")}
            icon="cpu"
            loading={busy}
            onPress={generate}
            style={{ marginTop: 12 }}
          />
        </Card>

        {existing ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label={t("expectedGuests")} value={String(existing.expectedGuests)} icon="users" tone="success" />
              <Stat
                label={t("weather")}
                value={existing.weather ? `${existing.weather.tempC.toFixed(0)}°` : "—"}
                hint={existing.weather?.condition}
                icon="cloud"
              />
            </View>
            <Card>
              <SectionHeader title={state.locale === "de" ? "Empfehlung pro Gericht" : "Per-recipe recommendation"} />
              {Object.entries(existing.recommendations).map(([rid, portions]) => {
                const r = state.recipes.find((x) => x.id === rid);
                if (!r) return null;
                const recent = recentSales.find((s) => s.recipeId === rid)?.avgSold ?? 0;
                return (
                  <View
                    key={rid}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderColor: c.border,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {state.locale === "de" ? r.nameDe : r.name}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                        Ø {recent.toFixed(1)} {state.locale === "de" ? "verkauft" : "sold"}
                      </Text>
                    </View>
                    <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                      {portions}
                    </Text>
                  </View>
                );
              })}
              {existing.rationale ? (
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    marginTop: 10,
                    fontStyle: "italic",
                  }}
                >
                  {existing.rationale}
                </Text>
              ) : null}
              <Button
                label={state.locale === "de" ? "In Menü übernehmen" : "Apply to menu"}
                icon="check"
                style={{ marginTop: 12 }}
                onPress={applyToMenu}
              />
            </Card>
          </>
        ) : busy ? (
          <Card>
            <View style={{ alignItems: "center", padding: 20 }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
                {t("thinking")}
              </Text>
            </View>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon="cpu"
              title={state.locale === "de" ? "Noch keine Prognose" : "No forecast yet"}
              body={state.locale === "de" ? "Tippe auf „Morgen kochen“ für KI-Empfehlung." : "Tap „forecast“ for AI suggestion."}
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

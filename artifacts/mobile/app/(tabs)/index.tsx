import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { recipeMargin } from "@/lib/computations";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const { state, dispatch, currentLocation } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const today = todayKey();
  const todayMenu = state.menu.find((m) => m.date === today);
  const todayRecipes = (todayMenu?.recipeIds ?? [])
    .map((id) => state.recipes.find((r) => r.id === id))
    .filter(Boolean);

  const todaySales = state.sales.filter((s) => s.date === today);
  const cookedToday = todaySales.reduce((s, x) => s + x.cooked, 0);
  const soldToday = todaySales.reduce((s, x) => s + x.sold, 0);
  const revenueToday = todaySales.reduce((s, x) => s + x.revenue, 0);

  const lowStock = useMemo(
    () => state.inventory.filter((i) => i.quantity < i.minQuantity),
    [state.inventory],
  );

  const tomorrowForecast = state.forecasts.find(
    (f) => f.date === tomorrowKey() && (f.locationId ?? "") === (state.currentLocationId ?? ""),
  );
  const lastHandover = state.handovers[0];
  const marginAlerts = useMemo(
    () =>
      state.recipes
        .map((r) => ({ recipe: r, m: recipeMargin(r, state.inventory, state.priceHistory) }))
        .filter((x) => x.m.marginPct < 35 || x.m.trend === "up"),
    [state.recipes, state.inventory, state.priceHistory],
  );

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    return state.inventory.filter((i) => {
      if (!i.expiresAt) return false;
      const t = new Date(i.expiresAt).getTime();
      return t - now < 4 * 24 * 3600 * 1000;
    });
  }, [state.inventory]);

  const briefs = [
    lowStock.length > 0
      ? `${lowStock.length} ${t("lowStock").toLowerCase()} – ${lowStock
          .slice(0, 2)
          .map((i) => (state.locale === "de" ? i.nameDe : i.name))
          .join(", ")}`
      : t("aiBrief1"),
    expiringSoon.length > 0
      ? `${expiringSoon.length}× ${t("expiringSoon").toLowerCase()}`
      : t("aiBrief2"),
    t("aiBrief3"),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 110,
          paddingHorizontal: 16,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Location switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => dispatch({ type: "setCurrentLocation", id: undefined })}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: !state.currentLocationId ? c.primary : c.muted,
              borderWidth: 1,
              borderColor: !state.currentLocationId ? c.primary : c.border,
            }}
          >
            <Text
              style={{
                color: !state.currentLocationId ? c.primaryForeground : c.foreground,
                fontFamily: "Inter_500Medium",
                fontSize: 12,
              }}
            >
              ⌂ {t("allLocations")}
            </Text>
          </Pressable>
          {state.locations.map((loc) => {
            const active = state.currentLocationId === loc.id;
            return (
              <Pressable
                key={loc.id}
                onPress={() => dispatch({ type: "setCurrentLocation", id: loc.id })}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? c.primary : c.muted,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.border,
                }}
              >
                <Text
                  style={{
                    color: active ? c.primaryForeground : c.foreground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                  }}
                >
                  {loc.code ?? loc.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push("/locations")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: c.muted,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Feather name="settings" size={12} color={c.mutedForeground} />
          </Pressable>
        </ScrollView>

        {/* AI Hero */}
        <Pressable onPress={() => router.push("/chat")}>
          <LinearGradient
            colors={[c.primary, "#b45309"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: c.radius + 4,
              padding: 18,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="cpu" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Inter_700Bold",
                    fontSize: 17,
                  }}
                >
                  {t("morningBrief")}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  KitchenOS · KI
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#fff" />
            </View>
            {briefs.map((b, i) => (
              <View
                key={i}
                style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#fff",
                    marginTop: 7,
                  }}
                />
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  {b}
                </Text>
              </View>
            ))}
          </LinearGradient>
        </Pressable>

        {/* Quick stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("cooked")} value={String(cookedToday)} icon="play-circle" tone="default" />
          <Stat label={t("sold")} value={String(soldToday)} icon="check-circle" tone="success" />
          <Stat
            label={t("revenue")}
            value={`€${revenueToday.toFixed(0)}`}
            icon="trending-up"
            tone="warning"
          />
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <QuickAction icon="camera" label={t("scan")} onPress={() => router.push("/scan")} />
          <QuickAction icon="cpu" label={t("forecast")} onPress={() => router.push("/forecast")} />
          <QuickAction icon="message-square" label={t("handover")} onPress={() => router.push("/handover")} />
          <QuickAction icon="thermometer" label="HACCP" onPress={() => router.push("/haccp")} />
        </View>

        {/* Forecast widget */}
        <Card onPress={() => router.push("/forecast")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 38, height: 38, borderRadius: 10,
                backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
              }}
            >
              <Feather name="cpu" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {t("forecastTomorrow")}
              </Text>
              {tomorrowForecast ? (
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 }}>
                  {tomorrowForecast.expectedGuests} {t("expectedGuests").toLowerCase()}
                  {tomorrowForecast.weather ? ` · ${tomorrowForecast.weather.tempC.toFixed(0)}° ${tomorrowForecast.weather.condition}` : ""}
                </Text>
              ) : (
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  {state.locale === "de" ? "Tippen, um KI-Prognose zu generieren" : "Tap to generate AI forecast"}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </View>
        </Card>

        {/* Margin alerts */}
        {marginAlerts.length > 0 && (
          <Card onPress={() => router.push("/margin")} style={{ borderColor: c.warning + "55" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="alert-triangle" size={18} color={c.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {marginAlerts.length} {t("marginAlerts")}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  {marginAlerts.slice(0, 2).map((x) => state.locale === "de" ? x.recipe.nameDe : x.recipe.name).join(" · ")}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={c.mutedForeground} />
            </View>
          </Card>
        )}

        {/* Last handover */}
        {lastHandover && (
          <Card onPress={() => router.push("/handover")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="message-square" size={14} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13, flex: 1 }}>
                {t("handover")}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                {new Date(lastHandover.date).toLocaleDateString(state.locale === "de" ? "de-DE" : "en-GB")}
              </Text>
            </View>
            <Text numberOfLines={2} style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, lineHeight: 19 }}>
              {lastHandover.summary}
            </Text>
          </Card>
        )}

        {/* Today's menu */}
        <View>
          <SectionHeader
            title={t("today") + " · " + t("menu")}
            action={t("open")}
            onAction={() => router.push("/(tabs)/menu")}
          />
          {todayRecipes.length === 0 ? (
            <Card>
              <EmptyState icon="book-open" title={t("empty")} />
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {todayRecipes.map((r) => {
                if (!r) return null;
                return (
                  <Card
                    key={r.id}
                    onPress={() => router.push(`/recipe/${r.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: c.accent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather
                        name={
                          r.type === "soup"
                            ? "coffee"
                            : r.type === "dessert"
                              ? "gift"
                              : r.type === "salad"
                                ? "feather"
                                : "circle"
                        }
                        size={18}
                        color={c.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 15,
                        }}
                      >
                        {state.locale === "de" ? r.nameDe : r.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          marginTop: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <Badge label={t(r.category)} tone="accent" />
                        <Badge label={`${r.portionGrams}g`} />
                        <Badge label={`€${r.sellPrice.toFixed(2)}`} tone="success" />
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={c.mutedForeground} />
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* Low stock */}
        {lowStock.length > 0 && (
          <View>
            <SectionHeader
              title={t("lowStock")}
              action={t("open")}
              onAction={() => router.push("/(tabs)/inventory")}
            />
            <Card style={{ padding: 0 }}>
              {lowStock.slice(0, 4).map((i, idx, arr) => (
                <View
                  key={i.id}
                  style={{
                    padding: 14,
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderColor: c.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 14,
                      }}
                    >
                      {state.locale === "de" ? i.nameDe : i.name}
                    </Text>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {i.quantity} {i.unit} / {t("minStock")}: {i.minQuantity}{" "}
                      {i.unit}
                    </Text>
                  </View>
                  <Badge label={t("lowStock")} tone="destructive" />
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: 14,
          alignItems: "center",
          gap: 6,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Feather name={icon} size={20} color={c.primary} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

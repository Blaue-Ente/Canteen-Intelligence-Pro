import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  const { state } = useApp();
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
          <QuickAction
            icon="camera"
            label={t("scan")}
            onPress={() => router.push("/scan")}
          />
          <QuickAction
            icon="message-circle"
            label={t("chat")}
            onPress={() => router.push("/chat")}
          />
          <QuickAction
            icon="dollar-sign"
            label={t("calculator")}
            onPress={() => router.push("/calculator")}
          />
          <QuickAction
            icon="thermometer"
            label="HACCP"
            onPress={() => router.push("/haccp")}
          />
        </View>

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

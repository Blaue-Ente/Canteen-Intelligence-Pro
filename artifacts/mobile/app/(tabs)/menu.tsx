import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { generateWeekMenu } from "@/lib/ai";

const DAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Menu() {
  const { state, dispatch } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  const selectedDate = dateKey(days[selectedIdx]!);
  const entry = state.menu.find((m) => m.date === selectedDate) ?? { date: selectedDate, recipeIds: [] };
  const dayRecipes = entry.recipeIds.map((id) => state.recipes.find((r) => r.id === id)).filter(Boolean);

  const labelDays = state.locale === "de" ? DAYS_DE : DAYS_EN;
  const filteredRecipes = state.recipes.filter((r) => filter === "all" || r.category === filter || r.type === filter);

  const aiGenerate = async () => {
    setGenerating(true);
    try {
      const lowStock = state.inventory
        .filter((i) => i.quantity < i.minQuantity)
        .map((i) => i.nameDe);
      const result = await generateWeekMenu({
        recipes: state.recipes.map((r) => ({
          id: r.id,
          name: state.locale === "de" ? r.nameDe : r.name,
          type: r.type,
          category: r.category,
          meat: r.meat,
        })),
        startDate: dateKey(days[0]!),
        lowStockNames: lowStock,
        locale: state.locale,
      });
      const validIds = new Set(state.recipes.map((r) => r.id));
      (result.days ?? []).forEach((d) => {
        const ids = (d.recipeIds ?? []).filter((id) => validIds.has(id));
        if (ids.length > 0) {
          dispatch({ type: "setMenu", entry: { date: d.date, recipeIds: ids } });
        }
      });
      Alert.alert("KI", "Wochenkarte aktualisiert.");
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : "KI nicht verfügbar");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
              {t("weeklyMenu")}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {selectedDate}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                Alert.alert(t("rotate") + "?", "Tausche Wochenkarte rotierend.", [
                  { text: t("cancel") },
                  { text: t("rotate"), onPress: () => dispatch({ type: "rotateMenu" }) },
                ]);
              }}
              style={({ pressed }) => [
                { width: 38, height: 38, borderRadius: 12, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="refresh-cw" size={16} color={c.foreground} />
            </Pressable>
            <Pressable
              onPress={aiGenerate}
              disabled={generating}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: c.primary,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  height: 38,
                  opacity: generating ? 0.6 : 1,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <Feather name="cpu" size={14} color={c.primaryForeground} />
              )}
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {t("generate")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
      >
        {days.map((d, i) => {
          const active = i === selectedIdx;
          return (
            <Pressable
              key={i}
              onPress={() => setSelectedIdx(i)}
              style={({ pressed }) => [
                {
                  width: 56,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: active ? c.primary : c.card,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.border,
                  alignItems: "center",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                {labelDays[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </Text>
              <Text style={{ color: active ? c.primaryForeground : c.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 }}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110, gap: 14 }}>
        <SectionHeader title={t("today") + " · " + t("menu")} action="+ " onAction={() => setPicker(true)} />
        {dayRecipes.length === 0 ? (
          <Card>
            <EmptyState icon="book-open" title={t("empty")} body="Tippe + um Gerichte hinzuzufügen." />
          </Card>
        ) : (
          dayRecipes.map((r) => {
            if (!r) return null;
            return (
              <Card
                key={r.id}
                onPress={() => router.push(`/recipe/${r.id}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: c.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.primary }}>
                    {r.portionGrams}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {state.locale === "de" ? r.nameDe : r.name}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge label={t(r.type)} tone="accent" />
                    <Badge label={t(r.category)} />
                    {r.allergens.length > 0 ? (
                      <Badge label={`${r.allergens.length} Allergene`} tone="warning" />
                    ) : null}
                    <Badge label={`€${r.sellPrice.toFixed(2)}`} tone="success" />
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    dispatch({
                      type: "setMenu",
                      entry: { date: selectedDate, recipeIds: entry.recipeIds.filter((x) => x !== r.id) },
                    });
                  }}
                  style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.6 }]}
                  hitSlop={6}
                >
                  <Feather name="x" size={16} color={c.mutedForeground} />
                </Pressable>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal visible={picker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicker(false)}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderColor: c.border,
            }}
          >
            <Pressable onPress={() => setPicker(false)}>
              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>{t("close")}</Text>
            </Pressable>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>{t("recipes")}</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {(["all", "soup", "main", "salad", "dessert", "vegan", "vegetarian", "meat", "fish"] as const).map((k) => (
              <Chip key={k} label={k} active={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 30 }}>
            {filteredRecipes.map((r) => {
              const inMenu = entry.recipeIds.includes(r.id);
              return (
                <Card
                  key={r.id}
                  onPress={() => {
                    if (inMenu) return;
                    dispatch({
                      type: "setMenu",
                      entry: { date: selectedDate, recipeIds: [...entry.recipeIds, r.id] },
                    });
                    setPicker(false);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {state.locale === "de" ? r.nameDe : r.name}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                      <Badge label={t(r.type)} />
                      <Badge label={t(r.category)} tone="accent" />
                    </View>
                  </View>
                  <Feather name={inMenu ? "check-circle" : "plus-circle"} size={20} color={inMenu ? c.success : c.primary} />
                </Card>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

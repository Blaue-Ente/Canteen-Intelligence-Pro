import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import * as ImagePicker from "expo-image-picker";

import { detectIngredientsFromPhoto, generateRecipe, generateWeekMenu } from "@/lib/ai";
import { next7DayWindow, scoreMenu } from "@/lib/dge";
import { SEED_RECIPES } from "@/lib/seedRecipes";
import type { Allergen, DishCategory, DishType, MeatType, Recipe } from "@/types";

const ALLERGEN_TOKENS: Allergen[] = [
  "gluten", "milk", "egg", "nuts", "soy", "fish", "shellfish",
  "celery", "mustard", "sesame", "sulphite", "lupin", "mollusc", "peanut",
];

function rid() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

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
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState("");
  const [aiPromptBusy, setAiPromptBusy] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [mixerText, setMixerText] = useState("");
  const [mixerBusy, setMixerBusy] = useState(false);
  const [mixerDetecting, setMixerDetecting] = useState(false);

  const importClassics = () => {
    const seeds = SEED_RECIPES;
    const doImport = () => {
      let added = 0;
      seeds.forEach((s) => {
        const exists = state.recipes.some(
          (r) => r.nameDe.toLowerCase() === s.nameDe.toLowerCase(),
        );
        if (exists) return;
        const recipe: Recipe = {
          ...s,
          id: rid(),
          ingredients: [],
          allergens: s.allergens.filter((a): a is Allergen =>
            (ALLERGEN_TOKENS as string[]).includes(a),
          ),
        };
        dispatch({ type: "addRecipe", recipe });
        added += 1;
      });
      Alert.alert("KItchenOS", t("classicsImported").replace("{n}", String(added)));
    };
    if (state.recipes.length === 0) {
      doImport();
      return;
    }
    Alert.alert(
      t("importClassics"),
      t("importClassicsConfirm").replace("{n}", String(seeds.length)),
      [{ text: t("cancel") }, { text: t("importClassics"), onPress: doImport }],
    );
  };

  const buildRecipe = (g: Awaited<ReturnType<typeof generateRecipe>>, fallbackName: string): Recipe => ({
    id: rid(),
    nameDe: g.nameDe || fallbackName,
    name: g.name || fallbackName,
    type: (g.type as DishType) ?? "main",
    category: (g.category as DishCategory) ?? "vegetarian",
    meat: (g.meat as MeatType) ?? "none",
    portionGrams: Math.max(150, Math.min(600, Math.round(g.portionGrams ?? 350))),
    ingredients: [],
    allergens: (g.allergens ?? []).filter((a): a is Allergen =>
      (ALLERGEN_TOKENS as string[]).includes(a),
    ),
    steps: g.steps ?? [],
    stepsDe: g.stepsDe ?? [],
    basePrice: Number(g.basePrice ?? 2.5),
    sellPrice: Number(g.sellPrice ?? 8.5),
    cookTimeMin: Math.max(5, Math.round(g.cookTimeMin ?? 30)),
    kcalPerPortion: g.kcalPerPortion ? Math.round(g.kcalPerPortion) : undefined,
    source: "ai",
  });

  const submitAiRecipe = async () => {
    const idea = aiPromptText.trim();
    if (!idea) return;
    setAiPromptBusy(true);
    try {
      const g = await generateRecipe({ idea, locale: state.locale });
      dispatch({ type: "addRecipe", recipe: buildRecipe(g, idea) });
      setAiPromptText("");
      setAiPromptOpen(false);
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : "KI nicht verfügbar");
    } finally {
      setAiPromptBusy(false);
    }
  };

  const photographIngredients = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Kamera", "Keine Kameraberechtigung.");
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.6,
      });
      if (r.canceled || !r.assets[0]?.base64) return;
      setMixerDetecting(true);
      const { ingredients } = await detectIngredientsFromPhoto({
        base64: r.assets[0].base64,
        locale: state.locale,
      });
      const existing = mixerText.trim();
      const merged = [
        ...(existing ? existing.split(",").map((s) => s.trim()).filter(Boolean) : []),
        ...ingredients,
      ];
      setMixerText(Array.from(new Set(merged)).join(", "));
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : "Vision nicht verfügbar");
    } finally {
      setMixerDetecting(false);
    }
  };

  const submitMixer = async () => {
    const ingredients = mixerText.split(",").map((s) => s.trim()).filter(Boolean);
    if (ingredients.length === 0) return;
    setMixerBusy(true);
    try {
      const g = await generateRecipe({ availableIngredients: ingredients, locale: state.locale });
      dispatch({ type: "addRecipe", recipe: buildRecipe(g, ingredients.slice(0, 3).join(" + ")) });
      setMixerText("");
      setMixerOpen(false);
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : "KI nicht verfügbar");
    } finally {
      setMixerBusy(false);
    }
  };

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
      Alert.alert("KI", state.locale === "de"
        ? "Wochenkarte erstellt: 1 Suppe + 1 Vegetarisch + 1 Fleisch + 1 gesunde Überraschung pro Tag."
        : "Weekly menu created: 1 soup + 1 vegetarian + 1 meat + 1 healthy surprise per day.");
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
            {/* T014: live DGE compliance badge — only shown when standard active. */}
            {state.dgeStandard ? (() => {
              const w = next7DayWindow();
              const sc = scoreMenu({
                menu: state.menu,
                recipes: state.recipes,
                inventory: state.inventory,
                fromDate: w.fromDate,
                toDate: w.toDate,
                standard: state.dgeStandard!,
                isDe: state.locale === "de",
                locationId: state.currentLocationId,
              });
              const tone = sc.overall >= 80 ? "success" : sc.overall >= 60 ? "warning" : "destructive";
              return (
                <Pressable onPress={() => router.push("/dge")} style={{ marginTop: 6 }}>
                  <Badge tone={tone} label={`DGE ${sc.overall}/100`} />
                </Pressable>
              );
            })() : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/scan?mode=menu")}
              style={({ pressed }) => [
                { width: 38, height: 38, borderRadius: 12, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel={t("scanMenu")}
            >
              <Feather name="camera" size={16} color={c.foreground} />
            </Pressable>
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
          <Card style={{ gap: 12 }}>
            <EmptyState icon="book-open" title={t("empty")} body="Tippe + um Gerichte hinzuzufügen." />
            <Button
              label={t("scanMenu")}
              icon="camera"
              variant="secondary"
              onPress={() => router.push("/scan?mode=menu")}
            />
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
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => setMixerOpen(true)} hitSlop={6}>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>🥗 {t("mixer")}</Text>
              </Pressable>
              <Pressable onPress={() => setAiPromptOpen(true)} hitSlop={6}>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>+ {t("aiRecipe")}</Text>
              </Pressable>
            </View>
          </View>
          {state.recipes.length === 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Pressable
                onPress={importClassics}
                style={({ pressed }) => [
                  {
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    backgroundColor: c.muted, borderRadius: 12, padding: 12,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Feather name="book-open" size={16} color={c.foreground} />
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {t("importClassics")} ({SEED_RECIPES.length})
                </Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {(["all", "soup", "main", "salad", "dessert", "vegan", "vegetarian", "meat", "fish"] as const).map((k) => (
              <Chip key={k} label={k} active={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
          {/* Selected count bar */}
          {entry.recipeIds.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: c.accent,
                borderBottomWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {entry.recipeIds.length} {state.locale === "de" ? "Gericht(e) ausgewählt" : "dish(es) selected"}
              </Text>
              <Pressable
                onPress={() => setPicker(false)}
                style={({ pressed }) => [
                  {
                    backgroundColor: c.primary,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {state.locale === "de" ? "Fertig" : "Done"}
                </Text>
              </Pressable>
            </View>
          )}
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 30 }}>
            {filteredRecipes.map((r) => {
              const inMenu = entry.recipeIds.includes(r.id);
              return (
                <Card
                  key={r.id}
                  onPress={() => {
                    const newIds = inMenu
                      ? entry.recipeIds.filter((x) => x !== r.id)
                      : [...entry.recipeIds, r.id];
                    dispatch({
                      type: "setMenu",
                      entry: { date: selectedDate, recipeIds: newIds },
                    });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderWidth: inMenu ? 1.5 : 0,
                    borderColor: inMenu ? c.primary : "transparent",
                    backgroundColor: inMenu ? c.accent : c.card,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: inMenu ? c.primary : c.muted,
                      flexShrink: 0,
                    }}
                  >
                    <Feather
                      name={inMenu ? "check" : "plus"}
                      size={16}
                      color={inMenu ? c.primaryForeground : c.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {state.locale === "de" ? r.nameDe : r.name}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      <Badge label={t(r.type)} />
                      <Badge label={t(r.category)} tone="accent" />
                      <Badge label={`€${r.sellPrice.toFixed(2)}`} tone="success" />
                      {((state.locale === "de" ? r.stepsDe : r.steps)?.length ?? 0) > 0 ? (
                        <Badge label={`${(state.locale === "de" ? r.stepsDe : r.steps).length} ${t("steps")}`} />
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      setPicker(false);
                      router.push(`/recipe/${r.id}`);
                    }}
                    hitSlop={10}
                    style={({ pressed }) => [
                      { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.muted },
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityLabel={t("viewRecipe")}
                  >
                    <Feather name="info" size={16} color={c.foreground} />
                  </Pressable>
                </Card>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={mixerOpen} animationType="fade" transparent onRequestClose={() => setMixerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              🥗 {t("mixer")}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {t("mixerSubtitle")}
            </Text>
            <Pressable
              onPress={photographIngredients}
              disabled={mixerDetecting}
              style={({ pressed }) => [
                {
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: c.muted, borderRadius: 10, padding: 12,
                  opacity: mixerDetecting ? 0.6 : 1,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {mixerDetecting ? (
                <ActivityIndicator size="small" color={c.foreground} />
              ) : (
                <Feather name="camera" size={16} color={c.foreground} />
              )}
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {mixerDetecting ? t("detecting") : t("mixerPhotoButton")}
              </Text>
            </Pressable>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              {t("mixerIngredientsLabel")}
            </Text>
            <TextInput
              value={mixerText}
              onChangeText={setMixerText}
              placeholder={state.locale === "de" ? "Tomate, Zwiebel, Hähnchen, Reis…" : "Tomato, onion, chicken, rice…"}
              placeholderTextColor={c.mutedForeground}
              multiline
              style={{
                color: c.foreground,
                backgroundColor: c.muted,
                borderRadius: 10,
                padding: 12,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                minHeight: 80,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Pressable onPress={() => setMixerOpen(false)} style={{ padding: 10 }}>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={submitMixer}
                disabled={mixerBusy || !mixerText.trim()}
                style={({ pressed }) => [
                  {
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, height: 38,
                    opacity: mixerBusy || !mixerText.trim() ? 0.5 : 1,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {mixerBusy ? (
                  <ActivityIndicator size="small" color={c.primaryForeground} />
                ) : (
                  <Feather name="cpu" size={14} color={c.primaryForeground} />
                )}
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {t("mixerSuggest")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={aiPromptOpen} animationType="fade" transparent onRequestClose={() => setAiPromptOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              + {t("aiRecipe")}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {t("aiRecipePrompt")}
            </Text>
            <TextInput
              value={aiPromptText}
              onChangeText={setAiPromptText}
              placeholder={state.locale === "de" ? "Rinderroulade…" : "Beef roulade…"}
              placeholderTextColor={c.mutedForeground}
              autoFocus
              multiline
              style={{
                color: c.foreground,
                backgroundColor: c.muted,
                borderRadius: 10,
                padding: 12,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                minHeight: 70,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Pressable onPress={() => setAiPromptOpen(false)} style={{ padding: 10 }}>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={submitAiRecipe}
                disabled={aiPromptBusy || !aiPromptText.trim()}
                style={({ pressed }) => [
                  {
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, height: 38,
                    opacity: aiPromptBusy || !aiPromptText.trim() ? 0.5 : 1,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {aiPromptBusy ? (
                  <ActivityIndicator size="small" color={c.primaryForeground} />
                ) : (
                  <Feather name="cpu" size={14} color={c.primaryForeground} />
                )}
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {t("create")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { dgeCategory, recipeCo2Kg, recipeNutrition } from "@/lib/computations";
import type { Allergen } from "@/types";

const ALL_ALLERGENS: { key: Allergen; tKey: string }[] = [
  { key: "gluten", tKey: "allergenGluten" },
  { key: "milk", tKey: "allergenMilk" },
  { key: "egg", tKey: "allergenEgg" },
  { key: "nuts", tKey: "allergenNuts" },
  { key: "soy", tKey: "allergenSoy" },
  { key: "fish", tKey: "allergenFish" },
  { key: "shellfish", tKey: "allergenShellfish" },
  { key: "celery", tKey: "allergenCelery" },
  { key: "mustard", tKey: "allergenMustard" },
  { key: "sesame", tKey: "allergenSesame" },
  { key: "sulphite", tKey: "allergenSulphite" },
  { key: "lupin", tKey: "allergenLupin" },
  { key: "mollusc", tKey: "allergenMollusc" },
  { key: "peanut", tKey: "allergenPeanut" },
];

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const recipe = state.recipes.find((r) => r.id === id);
  const [portion, setPortion] = useState(String(recipe?.portionGrams ?? 350));
  const [editAllergens, setEditAllergens] = useState(false);
  const [editPrice, setEditPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(String(recipe?.sellPrice ?? ""));
  const author = useAuthor();

  const toggleAllergen = (a: Allergen) => {
    if (!recipe) return;
    const has = recipe.allergens.includes(a);
    const next = has
      ? recipe.allergens.filter((x) => x !== a)
      : [...recipe.allergens, a];
    dispatch({ type: "updateRecipe", recipe: { ...recipe, allergens: next } });
  };

  const cost = useMemo(() => {
    if (!recipe) return 0;
    const factor = (Number(portion) || recipe.portionGrams) / recipe.portionGrams;
    return recipe.ingredients.reduce((s, ing) => {
      const inv = state.inventory.find((i) => i.id === ing.inventoryId);
      if (!inv) return s;
      const perGram = inv.unit === "kg" || inv.unit === "l" ? inv.pricePerUnit / 1000 : inv.pricePerUnit;
      return s + perGram * ing.grams * factor;
    }, 0);
  }, [recipe, portion, state.inventory]);

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Stack.Screen options={{ title: t("recipes") }} />
        <EmptyState icon="alert-triangle" title="Rezept nicht gefunden" />
      </View>
    );
  }

  const margin = recipe.sellPrice - cost;
  const marginPct = recipe.sellPrice > 0 ? (margin / recipe.sellPrice) * 100 : 0;
  const nutrition = recipeNutrition(recipe, state.inventory);
  const co2 = recipeCo2Kg(recipe, state.inventory);
  const dge = dgeCategory(recipe, state.inventory);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: state.locale === "de" ? recipe.nameDe : recipe.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {state.locale === "de" ? recipe.nameDe : recipe.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Badge label={t(recipe.type)} tone="accent" />
            <Badge label={t(recipe.category)} />
            {recipe.meat !== "none" ? <Badge label={t(recipe.meat)} /> : null}
            <Badge label={`${recipe.cookTimeMin} min`} />
            {recipe.kcalPerPortion ? <Badge label={`${recipe.kcalPerPortion} kcal`} /> : null}
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("cost")} value={`€${cost.toFixed(2)}`} icon="trending-down" />
          <Stat label={t("price")} value={`€${recipe.sellPrice.toFixed(2)}`} icon="tag" />
          <Stat label={t("margin")} value={`${marginPct.toFixed(0)}%`} icon="trending-up" tone={marginPct > 50 ? "success" : "warning"} />
        </View>

        <Card>
          <SectionHeader
            title={t("sellPrice")}
            action={editPrice ? t("save") : t("editPrice")}
            onAction={() => {
              if (editPrice) {
                const p = Number(priceInput.replace(",", "."));
                if (!Number.isNaN(p) && p >= 0) {
                  dispatch({ type: "updateRecipe", recipe: { ...recipe, sellPrice: p } });
                }
                setEditPrice(false);
              } else {
                setPriceInput(String(recipe.sellPrice ?? ""));
                setEditPrice(true);
              }
            }}
          />
          {editPrice ? (
            <Field
              label="EUR"
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="numeric"
              placeholder="9.90"
            />
          ) : (
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
              €{recipe.sellPrice.toFixed(2)}
            </Text>
          )}
        </Card>

        <Card>
          <SectionHeader title={t("portion")} />
          <Field label="g" value={portion} onChangeText={setPortion} keyboardType="numeric" />
        </Card>

        <Card>
          <SectionHeader title={t("ingredients")} />
          {recipe.ingredients.map((ing, i) => {
            const inv = state.inventory.find((x) => x.id === ing.inventoryId);
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {inv ? (state.locale === "de" ? inv.nameDe : inv.name) : "?"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {ing.grams} g
                </Text>
              </View>
            );
          })}
        </Card>

        <Card>
          <SectionHeader
            title={t("allergens")}
            action={editAllergens ? t("close") : t("editAllergens")}
            onAction={() => setEditAllergens((v) => !v)}
          />
          {editAllergens ? (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {ALL_ALLERGENS.map((a) => (
                <Chip
                  key={a.key}
                  label={t(a.tKey as never)}
                  active={recipe.allergens.includes(a.key)}
                  onPress={() => toggleAllergen(a.key)}
                />
              ))}
            </View>
          ) : recipe.allergens.length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {state.locale === "de" ? "Keine" : "None"}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {recipe.allergens.map((a) => {
                const meta = ALL_ALLERGENS.find((x) => x.key === a);
                return <Badge key={a} label={meta ? t(meta.tKey as never) : a} tone="warning" />;
              })}
            </View>
          )}
        </Card>

        <Card>
          <SectionHeader title={t("steps")} />
          {(state.locale === "de" ? recipe.stepsDe : recipe.steps).map((s, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: c.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 }}>
                {s}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <SectionHeader title={`LMIV · CO₂ · DGE`} />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Badge
              label={dge === "green" ? t("dgeGreen") : dge === "yellow" ? t("dgeYellow") : t("dgeRed")}
              tone={dge === "green" ? "success" : dge === "yellow" ? "warning" : "destructive"}
            />
            <Badge label={`${co2.toFixed(2)} kg CO₂e`} tone="accent" />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label="kcal" value={String(Math.round(nutrition.kcal))} icon="zap" />
            <Stat label="P" value={`${nutrition.protein.toFixed(0)}g`} icon="activity" />
            <Stat label="KH" value={`${nutrition.carbs.toFixed(0)}g`} icon="circle" />
            <Stat label="F" value={`${nutrition.fat.toFixed(0)}g`} icon="droplet" />
          </View>
          <Button
            label={t("aushangCreate")}
            icon="printer"
            variant="secondary"
            style={{ marginTop: 12 }}
            onPress={() => router.push(`/aushang/${recipe.id}`)}
          />
        </Card>

        <Button
          label="Verkauf erfassen (+1)"
          icon="plus-circle"
          onPress={() => {
            dispatch({
              type: "addSale",
              sale: {
                id: newId(),
                date: new Date().toISOString().slice(0, 10),
                recipeId: recipe.id,
                cooked: 1,
                sold: 1,
                revenue: recipe.sellPrice,
                ...author,
              },
            });
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}

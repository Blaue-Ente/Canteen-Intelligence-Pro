import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const recipe = state.recipes.find((r) => r.id === id);
  const [portion, setPortion] = useState(String(recipe?.portionGrams ?? 350));

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
          <SectionHeader title={t("allergens")} />
          {recipe.allergens.length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Keine</Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {recipe.allergens.map((a) => (
                <Badge key={a} label={a} tone="warning" />
              ))}
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
              },
            });
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}

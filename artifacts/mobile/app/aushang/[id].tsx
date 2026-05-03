import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { dgeCategory, recipeAllergens, recipeCo2Kg, recipeNutrition } from "@/lib/computations";
import { aushangHtml, sharePdf } from "@/lib/pdf";

export default function Aushang() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const recipe = state.recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Stack.Screen options={{ title: "Aushang" }} />
        <EmptyState icon="alert-triangle" title="Rezept nicht gefunden" />
      </View>
    );
  }

  const nutrition = recipeNutrition(recipe, state.inventory);
  const co2 = recipeCo2Kg(recipe, state.inventory);
  const dge = dgeCategory(recipe, state.inventory);
  const allergens = recipeAllergens(recipe, state.inventory);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: t("aushang") }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {state.locale === "de" ? recipe.nameDe : recipe.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Badge
              label={dge === "green" ? t("dgeGreen") : dge === "yellow" ? t("dgeYellow") : t("dgeRed")}
              tone={dge === "green" ? "success" : dge === "yellow" ? "warning" : "destructive"}
            />
            <Badge label={`${recipe.portionGrams}g`} />
            <Badge label={`€${recipe.sellPrice.toFixed(2)}`} tone="accent" />
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label="kcal" value={String(Math.round(nutrition.kcal))} icon="zap" />
          <Stat label="P" value={`${nutrition.protein.toFixed(0)}g`} icon="activity" />
          <Stat label="KH" value={`${nutrition.carbs.toFixed(0)}g`} icon="circle" />
          <Stat label="F" value={`${nutrition.fat.toFixed(0)}g`} icon="droplet" />
        </View>

        <Card>
          <SectionHeader title={t("co2Footprint")} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 28 }}>
            {co2.toFixed(2)} <Text style={{ fontSize: 14, color: c.mutedForeground }}>kg CO₂e</Text>
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }}>
            {state.locale === "de" ? "pro Portion" : "per portion"}
          </Text>
        </Card>

        <Card>
          <SectionHeader title={t("allergens")} />
          {allergens.length === 0 ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {state.locale === "de" ? "Keine bekannt" : "None known"}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {allergens.map((a) => (
                <Badge key={a} label={a} tone="warning" />
              ))}
            </View>
          )}
        </Card>

        <Button
          label={t("aushangCreate") + " · PDF"}
          icon="share-2"
          onPress={async () => {
            try {
              await sharePdf(
                aushangHtml(recipe, { nutrition, co2, dge, allergens }, state.locale),
                `aushang-${recipe.id.slice(0, 8)}`,
              );
            } catch (e) {
              Alert.alert("PDF", e instanceof Error ? e.message : "");
            }
          }}
        />
      </ScrollView>
    </View>
  );
}

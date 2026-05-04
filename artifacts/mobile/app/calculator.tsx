import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Badge, Card, Chip, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { addMoney, mulMoney, pctOfMoney, roundMoney, sumMoney } from "@/lib/money";

export default function Calculator() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const [recipeId, setRecipeId] = useState<string>(state.recipes[0]?.id ?? "");
  const [portion, setPortion] = useState("350");
  const [margin, setMargin] = useState("65");
  const [overhead, setOverhead] = useState("15");

  const recipe = state.recipes.find((r) => r.id === recipeId);

  const result = useMemo(() => {
    if (!recipe) return null;
    const factor = (Number(portion) || recipe.portionGrams) / recipe.portionGrams;
    // Cost in EUR, rounded per-line to cents to match how invoices add up.
    const ingredientCost = sumMoney(
      recipe.ingredients.map((ing) => {
        const inv = state.inventory.find((i) => i.id === ing.inventoryId);
        if (!inv) return 0;
        const perGram =
          inv.unit === "kg" || inv.unit === "l" ? inv.pricePerUnit / 1000 : inv.pricePerUnit;
        return mulMoney(perGram, ing.grams * factor);
      }),
    );
    const ovh = pctOfMoney(ingredientCost, Number(overhead) || 0);
    const totalCost = addMoney(ingredientCost, ovh);
    const desiredMargin = Number(margin) / 100;
    const sell = roundMoney(totalCost / Math.max(0.05, 1 - desiredMargin));
    // VAT: still 19% default here (recipe-level VAT config arrives in T003);
    // route through pctOfMoney so the cent-rounding is consistent.
    const sellWithVat = addMoney(sell, pctOfMoney(sell, 19));
    return { ingredientCost, ovh, totalCost, sell, sellWithVat };
  }, [recipe, portion, margin, overhead, state.inventory]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }}>
        <Card>
          <SectionHeader title="Gericht" />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {state.recipes.map((r) => (
              <Chip
                key={r.id}
                label={state.locale === "de" ? r.nameDe : r.name}
                active={recipeId === r.id}
                onPress={() => setRecipeId(r.id)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Field label="Portion (g)" value={portion} onChangeText={setPortion} keyboardType="numeric" />
            <Field label="Gewünschte Marge %" value={margin} onChangeText={setMargin} keyboardType="numeric" />
            <Field label="Gemeinkosten %" value={overhead} onChangeText={setOverhead} keyboardType="numeric" />
          </View>
        </Card>

        {result ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label="Zutaten" value={`€${result.ingredientCost.toFixed(2)}`} icon="package" />
              <Stat label="Gemeinkosten" value={`€${result.ovh.toFixed(2)}`} icon="briefcase" />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label="Total Kosten" value={`€${result.totalCost.toFixed(2)}`} icon="trending-down" tone="warning" />
              <Stat label="Netto VK" value={`€${result.sell.toFixed(2)}`} icon="tag" tone="success" />
            </View>
            <Card>
              <SectionHeader title="Verkaufspreis (inkl. 19% MwSt.)" />
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 36 }}>
                  €{result.sellWithVat.toFixed(2)}
                </Text>
                {recipe ? (
                  <Badge
                    label={`Ist: €${recipe.sellPrice.toFixed(2)}`}
                    tone={recipe.sellPrice > result.sell ? "success" : "warning"}
                  />
                ) : null}
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6 }}>
                Empfehlung basierend auf aktuellen Einkaufspreisen.
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

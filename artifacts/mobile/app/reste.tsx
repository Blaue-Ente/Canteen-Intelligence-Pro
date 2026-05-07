import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { EcoHint } from "@/components/EcoHint";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { aiResteRezepte, type ResteSuggestion } from "@/lib/ai";

export default function Reste() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ResteSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  const expSoon = state.inventory.filter((i) => {
    if (!i.expiresAt) return false;
    return new Date(i.expiresAt).getTime() - Date.now() < 4 * 86400000;
  });

  const candidates = expSoon.length > 0 ? expSoon : state.inventory.slice(0, 12);

  const toggle = (id: string) => setPicked((p) => ({ ...p, [id]: !p[id] }));

  const suggest = async () => {
    const leftovers = candidates
      .filter((i) => picked[i.id])
      .map((i) => ({
        name: state.locale === "de" ? i.nameDe : i.name,
        quantity: i.quantity,
        unit: i.unit,
      }));
    if (leftovers.length === 0) {
      Alert.alert(state.locale === "de" ? "Bitte Reste wählen" : "Pick leftovers");
      return;
    }
    setBusy(true);
    try {
      const r = await aiResteRezepte({ leftovers, locale: state.locale });
      setResult(r);
    } catch (e) {
      Alert.alert("KI", e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        {/* Öko-Tipp: Resteverwertung */}
        <EcoHint
          challengeId="useReste"
          contextDe="Reste verwerten = 15 Öko-Punkte sichern"
          contextEn="Use leftovers = earn 15 eco points"
        />

        <Card>
          <SectionHeader title={t("resteRezepte")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {state.locale === "de"
              ? "Wähle Zutaten, die bald ablaufen — KI schlägt 3 schnelle Rezepte vor."
              : "Pick items that expire soon — AI suggests 3 fast recipes."}
          </Text>
        </Card>

        <Card style={{ padding: 0 }}>
          {candidates.map((i, idx, arr) => {
            const exSoon = i.expiresAt && new Date(i.expiresAt).getTime() - Date.now() < 4 * 86400000;
            return (
              <Pressable
                key={i.id}
                onPress={() => toggle(i.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                  borderColor: c.border,
                }}
              >
                <Feather
                  name={picked[i.id] ? "check-square" : "square"}
                  size={18}
                  color={picked[i.id] ? c.primary : c.mutedForeground}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {state.locale === "de" ? i.nameDe : i.name}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {i.quantity} {i.unit}
                    {i.expiresAt ? ` · ${new Date(i.expiresAt).toLocaleDateString()}` : ""}
                  </Text>
                </View>
                {exSoon ? <Badge label={t("expiringSoon")} tone="warning" /> : null}
              </Pressable>
            );
          })}
        </Card>

        <Button label={busy ? t("thinking") : t("suggestRecipes")} icon="cpu" loading={busy} onPress={suggest} />

        {result ? (
          result.recipes.map((r, i) => (
            <Card key={i}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                  {r.name}
                </Text>
                <Badge label={`${r.matchScore}%`} tone="success" />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8 }}>
                {r.ingredients.join(" · ")}
              </Text>
              <View style={{ marginTop: 10, gap: 6 }}>
                {r.steps.map((s, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                      {idx + 1}.
                    </Text>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 18 }}>
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))
        ) : busy ? (
          <View style={{ alignItems: "center", padding: 12 }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <Card>
            <EmptyState icon="refresh-ccw" title={state.locale === "de" ? "Noch keine Vorschläge" : "No suggestions yet"} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

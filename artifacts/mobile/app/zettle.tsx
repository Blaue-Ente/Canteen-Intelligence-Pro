import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { parseZettleReport, type ParsedZettleReport } from "@/lib/ai";

export default function Zettle() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedZettleReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (source: "camera" | "library") => {
    setErr(null);
    setParsed(null);
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setErr("Kamerazugriff verweigert");
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });
      if (!r.canceled && r.assets[0]) {
        setUri(r.assets[0].uri);
        setB64(r.assets[0].base64 ?? null);
      }
    } else {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });
      if (!r.canceled && r.assets[0]) {
        setUri(r.assets[0].uri);
        setB64(r.assets[0].base64 ?? null);
      }
    }
  };

  const analyze = async () => {
    if (!b64) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await parseZettleReport({
        base64: b64,
        recipes: state.recipes.map((r) => ({
          id: r.id,
          name: state.locale === "de" ? r.nameDe : r.name,
        })),
      });
      setParsed(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!parsed) return;
    const date = parsed.date ?? new Date().toISOString().slice(0, 10);
    let count = 0;
    parsed.items.forEach((it) => {
      if (!it.recipeId) return;
      const recipe = state.recipes.find((r) => r.id === it.recipeId);
      if (!recipe) return;
      const sold = Math.max(0, Math.round(it.soldCount));
      if (sold === 0) return;
      dispatch({
        type: "addSale",
        sale: {
          id: newId(),
          date,
          recipeId: recipe.id,
          cooked: sold,
          sold,
          revenue: it.revenue ?? sold * recipe.sellPrice,
          source: "zettle",
        },
      });
      count++;
    });
    Alert.alert("Zettle", `${count} Verkäufe importiert.`, [
      { text: "OK", onPress: () => router.replace("/(tabs)/stats") },
    ]);
  };

  const matched = parsed?.items.filter((i) => i.recipeId).length ?? 0;
  const unmatched = parsed?.items.filter((i) => !i.recipeId).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="credit-card" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                Zettle / iZettle
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {t("connectZettle")}
              </Text>
            </View>
            <Badge label="bald" tone="warning" />
          </View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
            {state.locale === "de"
              ? "Bis zur API-Verbindung kannst du den täglichen Z-Report fotografieren – die KI ordnet jede Position automatisch deinen Rezepten zu und schreibt die Verkäufe ins Statistik-Modul."
              : "Until API integration, snap the daily Z-report photo – the AI matches each line to your recipes and writes sales straight into the stats module."}
          </Text>
        </Card>

        <Card>
          <SectionHeader title={t("importZettle")} />
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: "100%", height: 240, borderRadius: c.radius, backgroundColor: c.muted, marginBottom: 10 }}
              resizeMode="contain"
            />
          ) : (
            <EmptyState icon="camera" title="Foto Z-Report" body="Tag-Endabschluss bitte ausgedruckt oder am Bildschirm fotografieren." />
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Kamera" icon="camera" onPress={() => pick("camera")} variant={uri ? "secondary" : "primary"} style={{ flex: 1 }} />
            <Button label="Galerie" icon="image" variant="secondary" onPress={() => pick("library")} style={{ flex: 1 }} />
          </View>
          {uri ? (
            <Button
              label={busy ? t("thinking") : t("analyze")}
              icon="cpu"
              onPress={analyze}
              loading={busy}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Card>

        {err ? (
          <Card style={{ borderColor: c.destructive }}>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>{err}</Text>
          </Card>
        ) : null}

        {busy && !parsed ? (
          <Card>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("thinking")}
              </Text>
            </View>
          </Card>
        ) : null}

        {parsed ? (
          <Card>
            <SectionHeader title="Z-Report" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label="Datum" value={parsed.date ?? "—"} icon="calendar" />
              <Stat label={t("revenue")} value={`€${(parsed.total ?? 0).toFixed(0)}`} icon="trending-up" tone="success" />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Badge label={`${matched} erkannt`} tone="success" />
              {unmatched > 0 ? <Badge label={`${unmatched} unbekannt`} tone="warning" /> : null}
            </View>
            <View style={{ marginTop: 12, gap: 6 }}>
              {parsed.items.map((it, i) => {
                const recipe = it.recipeId ? state.recipes.find((r) => r.id === it.recipeId) : undefined;
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 8,
                      borderBottomWidth: i === parsed.items.length - 1 ? 0 : 1,
                      borderColor: c.border,
                    }}
                  >
                    <Feather
                      name={recipe ? "check-circle" : "help-circle"}
                      size={14}
                      color={recipe ? c.success : c.mutedForeground}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        {it.name}
                      </Text>
                      {recipe ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                          → {state.locale === "de" ? recipe.nameDe : recipe.name}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      ×{it.soldCount}
                    </Text>
                    {it.revenue ? (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, width: 60, textAlign: "right" }}>
                        €{it.revenue.toFixed(2)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <Button label={t("applyToSales")} icon="check" onPress={apply} style={{ marginTop: 14 }} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

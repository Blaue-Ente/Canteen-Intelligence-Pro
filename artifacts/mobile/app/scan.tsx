import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { analyzePhoto } from "@/lib/ai";

type Mode = "receipt" | "delivery" | "nutrition";

const MODE_PROMPTS: Record<Mode, string> = {
  receipt:
    "Extract every line item from this German restaurant supplier receipt or invoice. Return JSON: {items:[{name, quantity, unit, price_per_unit_eur, total_eur}], supplier, date, total_eur}. Use German item names if printed.",
  delivery:
    "This is a German Lieferschein / delivery note. Extract delivered items as JSON: {items:[{name, quantity, unit}], supplier, date, notes}.",
  nutrition:
    "Identify the dish in the photo. Estimate per-portion nutrition (kcal, protein g, carbs g, fat g) and list likely allergens (LMIV). Return as concise German bullet list.",
};

export default function Scan() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const [mode, setMode] = useState<Mode>("receipt");
  const [uri, setUri] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFrom = async (source: "camera" | "library") => {
    setError(null);
    setResult(null);
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Kamerazugriff verweigert");
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!r.canceled && r.assets[0]) {
        setUri(r.assets[0].uri);
        setB64(r.assets[0].base64 ?? null);
      }
    } else {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
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
    setError(null);
    try {
      const lang = state.locale === "de" ? "Antworte auf Deutsch." : "Reply in English.";
      const text = await analyzePhoto(b64, MODE_PROMPTS[mode] + " " + lang);
      setResult(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["receipt", "delivery", "nutrition"] as Mode[]).map((m) => (
            <Chip
              key={m}
              label={
                m === "receipt"
                  ? "Rechnung"
                  : m === "delivery"
                    ? "Lieferschein"
                    : "Nährwerte"
              }
              active={mode === m}
              onPress={() => {
                setMode(m);
                setResult(null);
              }}
            />
          ))}
        </View>

        <Card>
          {uri ? (
            <View style={{ gap: 12 }}>
              <Image
                source={{ uri }}
                style={{ width: "100%", height: 240, borderRadius: c.radius, backgroundColor: c.muted }}
                resizeMode="cover"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  label="Neu"
                  icon="x"
                  variant="ghost"
                  onPress={() => {
                    setUri(null);
                    setB64(null);
                    setResult(null);
                  }}
                />
                <Button label={busy ? "..." : "Analysieren"} icon="cpu" onPress={analyze} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <EmptyState icon="camera" title="Foto aufnehmen" body="Beleg, Lieferschein oder Gericht für KI-Analyse." />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label="Kamera" icon="camera" onPress={() => pickFrom("camera")} style={{ flex: 1 }} />
                <Button label="Galerie" icon="image" variant="secondary" onPress={() => pickFrom("library")} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </Card>

        {error ? (
          <Card style={{ borderColor: c.destructive }}>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>{error}</Text>
          </Card>
        ) : null}

        {busy && !result ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("thinking")}
              </Text>
            </View>
          </Card>
        ) : null}

        {result ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="check-circle" size={16} color={c.success} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                Ergebnis
              </Text>
              <Badge label="KI" tone="accent" />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>
              {result}
            </Text>
          </Card>
        ) : null}

        <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 12 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
            {t("close")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

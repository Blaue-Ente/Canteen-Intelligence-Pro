import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { analyzePhoto, parseReceiptImage, type ParsedReceipt } from "@/lib/ai";
import type { InventoryItem } from "@/types";

type Mode = "receipt" | "delivery" | "nutrition";

const NUTRITION_PROMPT =
  "Identify the dish in the photo. Estimate per-portion nutrition (kcal, protein g, carbs g, fat g) and list likely allergens (LMIV). Return as concise German bullet list.";

const CAT_MAP: Record<string, InventoryItem["category"]> = {
  meat: "meat",
  fleisch: "meat",
  dairy: "dairy",
  milch: "dairy",
  vegetable: "vegetable",
  gemuese: "vegetable",
  gemüse: "vegetable",
  fruit: "fruit",
  obst: "fruit",
  dry: "dry",
  trocken: "dry",
  spice: "spice",
  gewuerz: "spice",
  drink: "drink",
  getraenk: "drink",
  frozen: "frozen",
  tk: "frozen",
};

export default function Scan() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch, newId } = useApp();
  const [mode, setMode] = useState<Mode>("receipt");
  const [uri, setUri] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [textResult, setTextResult] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUri(null);
    setB64(null);
    setTextResult(null);
    setParsed(null);
    setPicked({});
    setError(null);
  };

  const pickFrom = async (source: "camera" | "library") => {
    setError(null);
    setTextResult(null);
    setParsed(null);
    setPicked({});
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
      if (mode === "nutrition") {
        const lang = state.locale === "de" ? "Antworte auf Deutsch." : "Reply in English.";
        const text = await analyzePhoto(b64, NUTRITION_PROMPT + " " + lang);
        setTextResult(text);
      } else {
        const data = await parseReceiptImage(b64);
        setParsed(data);
        const initialPicked: Record<number, boolean> = {};
        (data.items ?? []).forEach((_, i) => {
          initialPicked[i] = true;
        });
        setPicked(initialPicked);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const importPicked = () => {
    if (!parsed) return;
    const now = new Date().toISOString();
    (parsed.items ?? []).forEach((it, i) => {
      if (!picked[i]) return;
      const cat: InventoryItem["category"] =
        CAT_MAP[(it.category ?? "").toLowerCase()] ?? "other";
      const item: InventoryItem = {
        id: newId(),
        name: it.name,
        nameDe: it.name,
        unit: it.unit ?? "pcs",
        quantity: Number(it.quantity) || 0,
        minQuantity: 0,
        pricePerUnit: Number(it.pricePerUnit) || 0,
        category: cat,
        updatedAt: now,
      };
      dispatch({ type: "addInventory", item });
    });
    router.replace("/(tabs)/inventory");
  };

  const togglePick = (i: number) =>
    setPicked((p) => ({ ...p, [i]: !p[i] }));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["receipt", "delivery", "nutrition"] as Mode[]).map((m) => (
            <Chip
              key={m}
              label={m === "receipt" ? "Rechnung" : m === "delivery" ? "Lieferschein" : "Nährwerte"}
              active={mode === m}
              onPress={() => {
                setMode(m);
                setTextResult(null);
                setParsed(null);
              }}
            />
          ))}
        </View>

        <Card>
          {uri ? (
            <View style={{ gap: 12 }}>
              <Image
                source={{ uri }}
                style={{ width: "100%", height: 220, borderRadius: c.radius, backgroundColor: c.muted }}
                resizeMode="cover"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label="Neu" icon="x" variant="ghost" onPress={reset} />
                <Button
                  label={busy ? "..." : "Analysieren"}
                  icon="cpu"
                  onPress={analyze}
                  loading={busy}
                  style={{ flex: 1 }}
                />
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

        {busy && !textResult && !parsed ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("thinking")}
              </Text>
            </View>
          </Card>
        ) : null}

        {textResult ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="check-circle" size={16} color={c.success} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                Ergebnis
              </Text>
              <Badge label="KI" tone="accent" />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }}>
              {textResult}
            </Text>
          </Card>
        ) : null}

        {parsed ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Feather name="file-text" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {parsed.supplier ?? "Beleg"}
              </Text>
              {parsed.total ? <Badge label={`€${parsed.total.toFixed(2)}`} tone="success" /> : null}
            </View>
            {parsed.date ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8 }}>
                {parsed.date}
              </Text>
            ) : null}
            {(parsed.items ?? []).length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
                Keine Positionen erkannt.
              </Text>
            ) : (
              (parsed.items ?? []).map((it, i) => (
                <Pressable
                  key={i}
                  onPress={() => togglePick(i)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderColor: c.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather
                    name={picked[i] ? "check-square" : "square"}
                    size={18}
                    color={picked[i] ? c.primary : c.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                      {it.name}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {it.quantity} {it.unit} · €{Number(it.pricePerUnit ?? 0).toFixed(2)}/{it.unit}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
            {(parsed.items ?? []).length > 0 ? (
              <Button
                label={`Ins Lager übernehmen (${Object.values(picked).filter(Boolean).length})`}
                icon="download"
                onPress={importPicked}
                style={{ marginTop: 14 }}
              />
            ) : null}
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

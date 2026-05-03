import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  aiDishVision,
  aiTrayReturn,
  parseMenuImage,
  parseMenuPdf,
  parseReceiptImage,
  type DishVisionResult,
  type ParsedMenu,
  type ParsedReceipt,
  type TrayReturnAnalysis,
} from "@/lib/ai";
import type { Allergen, InventoryItem, Recipe } from "@/types";

type Mode = "receipt" | "delivery" | "nutrition" | "tray" | "menu";

const ALLOWED_ALLERGENS: Allergen[] = [
  "gluten", "milk", "egg", "nuts", "soy", "fish", "shellfish",
  "celery", "mustard", "sesame", "sulphite", "lupin", "mollusc", "peanut",
];

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
  const params = useLocalSearchParams<{ mode?: string }>();
  const { state, dispatch, newId } = useApp();
  const initialMode: Mode =
    params.mode === "menu" ||
    params.mode === "nutrition" ||
    params.mode === "tray" ||
    params.mode === "delivery"
      ? params.mode
      : "receipt";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [uri, setUri] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [textResult, setTextResult] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [tray, setTray] = useState<TrayReturnAnalysis | null>(null);
  const [menuParsed, setMenuParsed] = useState<ParsedMenu | null>(null);
  const [dishVision, setDishVision] = useState<DishVisionResult | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [applyToRecipeId, setApplyToRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUri(null);
    setB64(null);
    setTextResult(null);
    setParsed(null);
    setTray(null);
    setMenuParsed(null);
    setDishVision(null);
    setApplyToRecipeId(null);
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

  const pickPdfMenu = async () => {
    setError(null);
    setMenuParsed(null);
    setPicked({});
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets[0]) return;
      const asset = r.assets[0];
      setBusy(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const data = await parseMenuPdf({ base64, locale: state.locale });
      setMode("menu");
      setMenuParsed(data);
      const initialPicked: Record<number, boolean> = {};
      (data.items ?? []).forEach((_, i) => {
        initialPicked[i] = true;
      });
      setPicked(initialPicked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF-Fehler");
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    if (!b64) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "nutrition") {
        const r = await aiDishVision({ base64: b64, locale: state.locale });
        setDishVision(r);
      } else if (mode === "tray") {
        const r = await aiTrayReturn({ base64: b64, locale: state.locale });
        setTray(r);
      } else if (mode === "menu") {
        const data = await parseMenuImage({ base64: b64, locale: state.locale });
        setMenuParsed(data);
        const initialPicked: Record<number, boolean> = {};
        (data.items ?? []).forEach((_, i) => {
          initialPicked[i] = true;
        });
        setPicked(initialPicked);
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

  const importPickedDishes = () => {
    if (!menuParsed) return;
    (menuParsed.items ?? []).forEach((it, i) => {
      if (!picked[i]) return;
      const allergens = (it.allergens ?? [])
        .map((a) => a.toLowerCase())
        .filter((a): a is Allergen => ALLOWED_ALLERGENS.includes(a as Allergen));
      const cat: Recipe["category"] =
        it.type === "vegan" ? "vegan" : it.type === "vegetarian" ? "vegetarian" : "meat";
      const meat: Recipe["meat"] =
        it.type === "meat" ? "pork" : "none";
      const dishType: Recipe["type"] =
        it.category === "soup"
          ? "soup"
          : it.category === "salad" || it.category === "starter"
            ? "salad"
            : it.category === "dessert"
              ? "dessert"
              : it.category === "side"
                ? "side"
                : it.category === "drink"
                  ? "drink"
                  : "main";
      const recipe: Recipe = {
        id: newId(),
        name: it.name,
        nameDe: it.name,
        type: dishType,
        category: cat,
        meat,
        allergens,
        ingredients: [],
        steps: it.description ? [it.description] : [],
        stepsDe: it.description ? [it.description] : [],
        sellPrice: Number(it.price) || 0,
        basePrice: Number(it.price) || 0,
        portionGrams: 350,
        cookTimeMin: 15,
      };
      dispatch({ type: "addRecipe", recipe });
    });
    router.replace("/(tabs)/index" as never);
  };

  const applyDishToRecipe = () => {
    if (!dishVision || !applyToRecipeId) return;
    const r = state.recipes.find((x) => x.id === applyToRecipeId);
    if (!r) return;
    const allergens = (dishVision.allergens ?? [])
      .map((a) => a.toLowerCase())
      .filter((a): a is Allergen => ALLOWED_ALLERGENS.includes(a as Allergen));
    const merged = Array.from(new Set([...r.allergens, ...allergens]));
    dispatch({
      type: "updateRecipe",
      recipe: { ...r, allergens: merged, kcalPerPortion: Math.round(dishVision.kcalPerPortion) },
    });
    setApplyToRecipeId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["receipt", "delivery", "nutrition", "tray", "menu"] as Mode[]).map((m) => (
            <Chip
              key={m}
              label={
                m === "receipt"
                  ? "Rechnung"
                  : m === "delivery"
                    ? "Lieferschein"
                    : m === "nutrition"
                      ? "Nährwerte"
                      : m === "tray"
                        ? t("trayReturn")
                        : t("scanMenu")
              }
              active={mode === m}
              onPress={() => {
                setMode(m);
                setTextResult(null);
                setParsed(null);
                setTray(null);
                setMenuParsed(null);
                setDishVision(null);
                setApplyToRecipeId(null);
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
              {mode === "menu" && Platform.OS !== "web" ? (
                <Button
                  label={busy ? t("parsingPdf") : t("pickPdf")}
                  icon="file-text"
                  variant="ghost"
                  onPress={pickPdfMenu}
                  loading={busy}
                />
              ) : null}
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

        {dishVision ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="zap" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {dishVision.dishGuess}
              </Text>
              <Badge label={`${Math.round(dishVision.kcalPerPortion)} kcal`} tone="accent" />
            </View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 }}>
              P {dishVision.proteinG.toFixed(0)}g · KH {dishVision.carbsG.toFixed(0)}g · F {dishVision.fatG.toFixed(0)}g
            </Text>
            {dishVision.allergens.length > 0 ? (
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {dishVision.allergens.map((a) => (
                  <Badge key={a} label={a} tone="warning" />
                ))}
              </View>
            ) : null}
            {dishVision.notes ? (
              <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, fontStyle: "italic", marginBottom: 10 }}>
                {dishVision.notes}
              </Text>
            ) : null}
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 }}>
              {t("applyToRecipe")}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {state.recipes.slice(0, 12).map((r) => (
                <Chip
                  key={r.id}
                  label={state.locale === "de" ? r.nameDe : r.name}
                  active={applyToRecipeId === r.id}
                  onPress={() => setApplyToRecipeId(r.id === applyToRecipeId ? null : r.id)}
                />
              ))}
            </View>
            <Button
              label={t("applyToRecipe")}
              icon="check"
              onPress={applyDishToRecipe}
              disabled={!applyToRecipeId}
            />
          </Card>
        ) : null}

        {menuParsed ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Feather name="book-open" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {menuParsed.restaurantName ?? t("detectedDishes")}
              </Text>
            </View>
            {(menuParsed.items ?? []).length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
                {t("none")}
              </Text>
            ) : (
              (menuParsed.items ?? []).map((it, i) => (
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
                    {it.description ? (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {it.description}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {it.type ? <Badge label={it.type} /> : null}
                      {it.category ? <Badge label={it.category} /> : null}
                      {(it.allergens ?? []).map((a) => (
                        <Badge key={a} label={a} tone="warning" />
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    €{Number(it.price ?? 0).toFixed(2)}
                  </Text>
                </Pressable>
              ))
            )}
            {(menuParsed.items ?? []).length > 0 ? (
              <Button
                label={`${t("importDishes")} (${Object.values(picked).filter(Boolean).length})`}
                icon="download"
                onPress={importPickedDishes}
                style={{ marginTop: 14 }}
              />
            ) : null}
          </Card>
        ) : null}

        {tray ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="trash-2" size={16} color={c.warning} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {tray.dishGuess}
              </Text>
              <Badge label={`${tray.leftoverPct}%`} tone={tray.leftoverPct > 30 ? "destructive" : "warning"} />
            </View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              ≈ {tray.estimatedGrams} g
            </Text>
            <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, lineHeight: 19, fontStyle: "italic" }}>
              {tray.reasonHypothesis}
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

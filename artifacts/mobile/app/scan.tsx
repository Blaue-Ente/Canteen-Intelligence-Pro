import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  aiDishVision,
  aiTrayReturn,
  parseMenuImage,
  parseMenuPdf,
  parseOrderRequest,
  parseReceiptImage,
  type DishVisionResult,
  type ParsedMenu,
  type ParsedOrderRequest,
  type ParsedReceipt,
  type TrayReturnAnalysis,
} from "@/lib/ai";
import type { Allergen, InventoryItem, Recipe } from "@/types";

type Mode = "receipt" | "delivery" | "nutrition" | "tray" | "menu" | "order";

interface Page {
  uri: string;
  b64: string;
}

const ALLOWED_ALLERGENS: Allergen[] = [
  "gluten", "milk", "egg", "nuts", "soy", "fish", "shellfish",
  "celery", "mustard", "sesame", "sulphite", "lupin", "mollusc", "peanut",
];

const CAT_MAP: Record<string, InventoryItem["category"]> = {
  meat: "meat", fleisch: "meat",
  dairy: "dairy", milch: "dairy",
  vegetable: "vegetable", gemuese: "vegetable", gemüse: "vegetable",
  fruit: "fruit", obst: "fruit",
  dry: "dry", trocken: "dry",
  spice: "spice", gewuerz: "spice",
  drink: "drink", getraenk: "drink",
  frozen: "frozen", tk: "frozen",
};

export default function Scan() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { state, dispatch, newId } = useApp();

  const initialMode: Mode =
    params.mode === "menu" || params.mode === "nutrition" ||
    params.mode === "tray" || params.mode === "delivery" || params.mode === "order"
      ? params.mode
      : "receipt";

  const [mode, setMode] = useState<Mode>(initialMode);

  // ---- Multi-page state ----
  const [pages, setPages] = useState<Page[]>([]);

  // ---- Shared state ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Scan results ----
  const [textResult, setTextResult] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [tray, setTray] = useState<TrayReturnAnalysis | null>(null);
  const [menuParsed, setMenuParsed] = useState<ParsedMenu | null>(null);
  const [dishVision, setDishVision] = useState<DishVisionResult | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [applyToRecipeId, setApplyToRecipeId] = useState<string | null>(null);

  // ---- Order / Bestellliste state ----
  const [orderText, setOrderText] = useState("");
  const [parsedOrder, setParsedOrder] = useState<ParsedOrderRequest | null>(null);
  const [isListening, setIsListening] = useState(false);

  const reset = () => {
    setPages([]);
    setTextResult(null);
    setParsed(null);
    setTray(null);
    setMenuParsed(null);
    setDishVision(null);
    setApplyToRecipeId(null);
    setPicked({});
    setError(null);
    setParsedOrder(null);
    setOrderText("");
    setIsListening(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setTextResult(null);
    setParsed(null);
    setTray(null);
    setMenuParsed(null);
    setDishVision(null);
    setApplyToRecipeId(null);
    setParsedOrder(null);
  };

  // ---- Photo picking (appends to pages) ----
  const pickFrom = async (source: "camera" | "library") => {
    setError(null);
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError("Kamerazugriff verweigert"); return; }
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!r.canceled && r.assets[0] && r.assets[0].base64) {
        setPages((prev) => [...prev, { uri: r.assets[0].uri, b64: r.assets[0].base64! }]);
      }
    } else {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!r.canceled && r.assets[0] && r.assets[0].base64) {
        setPages((prev) => [...prev, { uri: r.assets[0].uri, b64: r.assets[0].base64! }]);
      }
    }
  };

  const removePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- PDF menu ----
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
      (data.items ?? []).forEach((_, i) => { initialPicked[i] = true; });
      setPicked(initialPicked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF-Fehler");
    } finally {
      setBusy(false);
    }
  };

  // ---- Main analyze ----
  const analyze = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const b64s = pages.map((p) => p.b64);
      if (mode === "nutrition") {
        const r = await aiDishVision({ base64: b64s[0], locale: state.locale });
        setDishVision(r);
      } else if (mode === "tray") {
        const r = await aiTrayReturn({ base64: b64s[0], locale: state.locale });
        setTray(r);
      } else if (mode === "menu") {
        const data = await parseMenuImage({ base64: b64s[0], locale: state.locale });
        setMenuParsed(data);
        const initialPicked: Record<number, boolean> = {};
        (data.items ?? []).forEach((_, i) => { initialPicked[i] = true; });
        setPicked(initialPicked);
      } else {
        // receipt + delivery: send ALL pages
        const data = await parseReceiptImage(b64s);
        setParsed(data);
        const initialPicked: Record<number, boolean> = {};
        (data.items ?? []).forEach((_, i) => { initialPicked[i] = true; });
        setPicked(initialPicked);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  // ---- Bestellliste ----
  const analyzeOrder = async () => {
    if (!orderText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await parseOrderRequest({ text: orderText, locale: state.locale });
      setParsedOrder(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    if (Platform.OS !== "web") return;
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => unknown) | undefined;
    if (!SR) { setError("Spracherkennung wird in diesem Browser nicht unterstützt."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any;
    recognition.lang = state.locale === "de" ? "de-DE" : "en-US";
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = String(e.results[0][0].transcript);
      setOrderText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const copyOrderList = async () => {
    if (!parsedOrder) return;
    const lines = parsedOrder.items.map(
      (it) => `${it.quantity} ${it.unit} ${it.name}${it.note ? ` (${it.note})` : ""}`,
    );
    if (parsedOrder.supplierHint) lines.unshift(`Lieferant: ${parsedOrder.supplierHint}`);
    if (parsedOrder.deliveryDate) lines.unshift(`Lieferdatum: ${parsedOrder.deliveryDate}`);
    const text = lines.join("\n");
    await Share.share({ message: text, title: t("orderListTitle") });
  };

  const toInventoryUnit = (raw: string): InventoryItem["unit"] => {
    const u = (raw ?? "").toLowerCase();
    if (u === "kg") return "kg";
    if (u === "g") return "g";
    if (u === "l" || u === "liter" || u === "litre") return "l";
    if (u === "ml") return "ml";
    return "pcs";
  };

  const importOrderToStock = () => {
    if (!parsedOrder) return;
    const now = new Date().toISOString();
    parsedOrder.items.forEach((it) => {
      const item: InventoryItem = {
        id: newId(),
        name: it.name,
        nameDe: it.name,
        unit: toInventoryUnit(it.unit),
        quantity: Math.max(0, it.quantity),
        minQuantity: 0,
        pricePerUnit: 0,
        category: "other",
        updatedAt: now,
      };
      dispatch({ type: "addInventory", item });
    });
    Alert.alert("✓", t("orderImported"));
    router.replace("/(tabs)/inventory");
  };

  // ---- Receipt import ----
  const importPicked = () => {
    if (!parsed) return;
    const now = new Date().toISOString();
    (parsed.items ?? []).forEach((it, i) => {
      if (!picked[i]) return;
      const cat: InventoryItem["category"] = CAT_MAP[(it.category ?? "").toLowerCase()] ?? "other";
      const item: InventoryItem = {
        id: newId(),
        name: it.name,
        nameDe: it.name,
        unit: toInventoryUnit(it.unit ?? "pcs"),
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

  const togglePick = (i: number) => setPicked((p) => ({ ...p, [i]: !p[i] }));

  // ---- Menu import helpers ----
  const dayNameToIndex = (day: string): number | null => {
    const d = day.trim().toLowerCase();
    const map: Record<string, number> = {
      montag: 0, mo: 0, monday: 0, mon: 0, lundi: 0,
      dienstag: 1, di: 1, tuesday: 1, tue: 1, mardi: 1,
      mittwoch: 2, mi: 2, wednesday: 2, wed: 2, mercredi: 2,
      donnerstag: 3, do: 3, thursday: 3, thu: 3, jeudi: 3,
      freitag: 4, fr: 4, friday: 4, fri: 4, vendredi: 4,
      samstag: 5, sa: 5, saturday: 5, sat: 5, samedi: 5,
      sonntag: 6, so: 6, sunday: 6, sun: 6, dimanche: 6,
    };
    return map[d] ?? null;
  };

  const nextWeekDate = (dayIndex: number): string => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + daysToMonday);
    nextMon.setDate(nextMon.getDate() + dayIndex);
    return nextMon.toISOString().slice(0, 10);
  };

  const importPickedDishes = () => {
    if (!menuParsed) return;
    const dayMap = new Map<string, string[]>();
    (menuParsed.items ?? []).forEach((it, i) => {
      if (!picked[i]) return;
      const allergens = (it.allergens ?? [])
        .map((a) => a.toLowerCase())
        .filter((a): a is Allergen => ALLOWED_ALLERGENS.includes(a as Allergen));
      const cat: Recipe["category"] =
        it.type === "vegan" ? "vegan" : it.type === "vegetarian" ? "vegetarian" : "meat";
      const meat: Recipe["meat"] = it.type === "meat" ? "pork" : "none";
      const dishType: Recipe["type"] =
        it.category === "soup" ? "soup"
        : it.category === "salad" || it.category === "starter" ? "salad"
        : it.category === "dessert" ? "dessert"
        : it.category === "side" ? "side"
        : it.category === "drink" ? "drink"
        : "main";
      const recipeId = newId();
      const recipe: Recipe = {
        id: recipeId,
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
      const rawDay = it.day ?? null;
      if (rawDay) {
        let targetDate: string | null = null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDay)) {
          targetDate = rawDay;
        } else {
          const idx = dayNameToIndex(rawDay);
          if (idx !== null) targetDate = nextWeekDate(idx);
        }
        if (targetDate) {
          if (!dayMap.has(targetDate)) dayMap.set(targetDate, []);
          dayMap.get(targetDate)!.push(recipeId);
        }
      }
    });
    dayMap.forEach((recipeIds, date) => {
      dispatch({ type: "setMenu", entry: { date, recipeIds } });
    });
    router.replace("/(tabs)/menu");
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

  const hasPages = pages.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>

        {/* ---- Mode chips ---- */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["receipt", "delivery", "nutrition", "tray", "menu", "order"] as Mode[]).map((m) => (
            <Chip
              key={m}
              label={
                m === "receipt" ? "Rechnung"
                : m === "delivery" ? "Lieferschein"
                : m === "nutrition" ? "Nährwerte"
                : m === "tray" ? t("trayReturn")
                : m === "menu" ? t("scanMenu")
                : t("orderMode")
              }
              active={mode === m}
              onPress={() => switchMode(m)}
            />
          ))}
        </View>

        {/* ---- Bestellliste mode ---- */}
        {mode === "order" ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Feather name="list" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {t("orderListTitle")}
              </Text>
              {Platform.OS === "web" && (
                <Pressable
                  onPress={startListening}
                  style={{
                    backgroundColor: isListening ? c.destructive : c.primary,
                    borderRadius: 20,
                    width: 36,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="mic" size={16} color="#fff" />
                </Pressable>
              )}
            </View>
            {isListening && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ActivityIndicator color={c.primary} size="small" />
                <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {t("listening")}
                </Text>
              </View>
            )}
            <TextInput
              value={orderText}
              onChangeText={setOrderText}
              placeholder={t("orderInputPlaceholder")}
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={5}
              style={{
                color: c.foreground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                backgroundColor: c.muted,
                borderRadius: c.radius,
                padding: 12,
                minHeight: 110,
                textAlignVertical: "top",
                marginBottom: 10,
              }}
            />
            <Button
              label={busy ? "..." : t("parseOrder")}
              icon="cpu"
              onPress={analyzeOrder}
              loading={busy}
              disabled={!orderText.trim() || busy}
            />
          </Card>
        ) : (
          /* ---- Photo / scan area ---- */
          <Card>
            {hasPages ? (
              <View style={{ gap: 12 }}>
                {/* Thumbnail grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {pages.map((p, idx) => (
                      <View key={idx} style={{ position: "relative" }}>
                        <Image
                          source={{ uri: p.uri }}
                          style={{ width: 100, height: 130, borderRadius: c.radius, backgroundColor: c.muted }}
                          resizeMode="cover"
                        />
                        <Pressable
                          onPress={() => removePage(idx)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            backgroundColor: "rgba(0,0,0,0.6)",
                            borderRadius: 10,
                            width: 20,
                            height: 20,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="x" size={12} color="#fff" />
                        </Pressable>
                        <View style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          backgroundColor: c.primary,
                          borderRadius: 8,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                        }}>
                          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 10 }}>
                            {idx + 1}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {pages.length} {t("pageCount")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    label="Seite +"
                    icon="camera"
                    variant="secondary"
                    onPress={() => pickFrom("camera")}
                  />
                  <Button
                    label="Galerie +"
                    icon="image"
                    variant="ghost"
                    onPress={() => pickFrom("library")}
                  />
                  <Button label="Neu" icon="x" variant="ghost" onPress={reset} />
                  <Button
                    label={busy ? "..." : pages.length > 1 ? t("analyzeAll") : "Analysieren"}
                    icon="cpu"
                    onPress={analyze}
                    loading={busy}
                    style={{ flex: 1, minWidth: 140 }}
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
                {(mode === "receipt" || mode === "delivery") && (
                  <View style={{
                    backgroundColor: c.primary + "12",
                    borderRadius: 8,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <Feather name="info" size={14} color={c.primary} />
                    <Text style={{ color: c.primary, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>
                      Mehrere Seiten? Einfach mehrmals fotografieren — alle werden zusammen analysiert.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}

        {/* ---- Error ---- */}
        {error ? (
          <Card style={{ borderColor: c.destructive }}>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>{error}</Text>
          </Card>
        ) : null}

        {/* ---- Loading ---- */}
        {busy && !textResult && !parsed && !parsedOrder ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("thinking")}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ---- Bestellliste result ---- */}
        {parsedOrder ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="shopping-cart" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {t("orderListTitle")}
              </Text>
              <Badge label={`${parsedOrder.items.length}`} tone="accent" />
            </View>
            {parsedOrder.supplierHint ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Feather name="truck" size={13} color={c.mutedForeground} />
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {parsedOrder.supplierHint}
                </Text>
              </View>
            ) : null}
            {parsedOrder.deliveryDate ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Feather name="calendar" size={13} color={c.mutedForeground} />
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {parsedOrder.deliveryDate}
                </Text>
              </View>
            ) : null}
            {(parsedOrder.items ?? []).map((it, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderColor: c.border,
                  gap: 10,
                }}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: c.primary + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                    {it.quantity}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {it.name}
                  </Text>
                  {it.note ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 }}>
                      {it.note}
                    </Text>
                  ) : null}
                </View>
                <Badge label={it.unit} />
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Button
                label={t("copyList")}
                icon="share"
                variant="secondary"
                onPress={copyOrderList}
                style={{ flex: 1 }}
              />
              <Button
                label={t("importToStock")}
                icon="download"
                onPress={importOrderToStock}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {/* ---- Text result ---- */}
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

        {/* ---- Dish vision result ---- */}
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
                {dishVision.allergens.map((a) => <Badge key={a} label={a} tone="warning" />)}
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

        {/* ---- Menu result ---- */}
        {menuParsed ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Feather name="book-open" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {menuParsed.restaurantName ?? t("detectedDishes")}
              </Text>
            </View>
            {menuParsed.hasWeeklyPlan && (
              <View style={{
                backgroundColor: c.primary + "18",
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}>
                <Feather name="calendar" size={15} color={c.primary} />
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }}>
                  Wochenplan erkannt — Gerichte werden in die nächste Woche eingeplant.
                </Text>
              </View>
            )}
            {(menuParsed.items ?? []).length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>{t("none")}</Text>
            ) : (
              (menuParsed.items ?? []).map((it, i) => (
                <Pressable
                  key={i}
                  onPress={() => togglePick(i)}
                  style={({ pressed }) => [{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: c.border,
                  }, pressed && { opacity: 0.7 }]}
                >
                  <Feather
                    name={picked[i] ? "check-square" : "square"}
                    size={18}
                    color={picked[i] ? c.primary : c.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {it.day ? (
                        <View style={{ backgroundColor: c.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 10 }}>
                            {it.day.length <= 3 ? it.day.toUpperCase() : it.day.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                        {it.name}
                      </Text>
                    </View>
                    {it.description ? (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {it.description}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {it.type ? <Badge label={it.type} /> : null}
                      {it.category ? <Badge label={it.category} /> : null}
                      {(it.allergens ?? []).map((a) => <Badge key={a} label={a} tone="warning" />)}
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

        {/* ---- Tray result ---- */}
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

        {/* ---- Receipt / Lieferschein result ---- */}
        {parsed ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Feather name="file-text" size={16} color={c.primary} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                {parsed.supplier ?? "Beleg"}
              </Text>
              {parsed.total ? <Badge label={`€${parsed.total.toFixed(2)}`} tone="success" /> : null}
              {pages.length > 1 && (
                <Badge label={`${pages.length} Seiten`} tone="accent" />
              )}
            </View>
            {parsed.date ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8 }}>
                {parsed.date}
              </Text>
            ) : null}

            {/* Regular items */}
            {(parsed.items ?? []).length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
                Keine Positionen erkannt.
              </Text>
            ) : (
              (parsed.items ?? []).map((it, i) => (
                <Pressable
                  key={i}
                  onPress={() => togglePick(i)}
                  style={({ pressed }) => [{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: c.border,
                  }, pressed && { opacity: 0.7 }]}
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

            {/* Pfand section */}
            {(parsed.pfandItems ?? []).length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Feather name="refresh-cw" size={14} color={c.warning} />
                  <Text style={{ color: c.warning, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    {t("pfandItems")}
                  </Text>
                </View>
                {(parsed.pfandItems ?? []).map((pf, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderColor: c.border + "80",
                      backgroundColor: c.warning + "08",
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      marginBottom: 2,
                    }}
                  >
                    <Feather name="box" size={15} color={c.warning} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                        {pf.name}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 }}>
                        {pf.quantity} {pf.unit}
                        {pf.pfandValue ? ` · €${Number(pf.pfandValue).toFixed(2)} ${t("pfandValue")}` : ""}
                      </Text>
                    </View>
                    <Badge label="Pfand" tone="warning" />
                  </View>
                ))}
              </View>
            ) : null}

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

import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { lookupBarcode, NUTRI_COLOR, NUTRI_LABEL, type FoodProduct } from "@/lib/foodLookup";
import type { Allergen, InventoryItem } from "@/types";

// Map OFF allergen strings → our Allergen type
const ALLERGEN_MAP: Record<string, Allergen> = {
  gluten: "gluten", milk: "milk", dairy: "milk", egg: "egg", eggs: "egg",
  nuts: "nuts", nut: "nuts", peanuts: "peanut", peanut: "peanut",
  soybeans: "soy", soy: "soy", fish: "fish", crustaceans: "shellfish",
  shellfish: "shellfish", celery: "celery", mustard: "mustard",
  sesame: "sesame", sulphites: "sulphite", sulphite: "sulphite",
  lupin: "lupin", molluscs: "mollusc", mollusc: "mollusc",
};

function mapAllergens(raw: string[]): Allergen[] {
  const result = new Set<Allergen>();
  for (const a of raw) {
    const key = a.toLowerCase().replace(/[^a-z]/g, "");
    if (ALLERGEN_MAP[key]) result.add(ALLERGEN_MAP[key]);
  }
  return [...result];
}

function NutriScoreBadge({ grade }: { grade: string }) {
  const bg = NUTRI_COLOR[grade] ?? "#aaa";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
          {grade.toUpperCase()}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: "#888", fontFamily: "Inter_400Regular" }}>
        {NUTRI_LABEL[grade] ?? ""}
      </Text>
    </View>
  );
}

function MacroRow({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value == null) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#666" }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#222" }}>
        {value} {unit}
      </Text>
    </View>
  );
}

export default function BarcodeScanner() {
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { dispatch, newId } = useApp();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const lastBarcode = useRef<string>("");

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (!scanning || loading || data === lastBarcode.current) return;
      lastBarcode.current = data;
      setScanning(false);
      setLoading(true);
      try {
        const result = await lookupBarcode(data);
        setProduct(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        Alert.alert("Nicht gefunden", msg, [
          {
            text: "Erneut scannen",
            onPress: () => {
              lastBarcode.current = "";
              setScanning(true);
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [scanning, loading],
  );

  const addToInventory = () => {
    if (!product) return;
    const allergens = mapAllergens(product.allergens);
    const item: InventoryItem = {
      id: newId(),
      name: product.name,
      nameDe: product.nameDe ?? product.name,
      unit: "kg",
      quantity: 1,
      minQuantity: 0,
      pricePerUnit: 0,
      category: "other",
      updatedAt: new Date().toISOString(),
      allergens,
      kcalPer100g: product.kcalPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
    };
    dispatch({ type: "addInventory", item });
    Alert.alert("Hinzugefügt", `„${item.name}" wurde zum Inventar hinzugefügt.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const resetScan = () => {
    setProduct(null);
    lastBarcode.current = "";
    setScanning(true);
  };

  // ── Permission not yet granted ───────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Feather name="camera-off" size={48} color={c.mutedForeground} />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: c.foreground, textAlign: "center" }}>
          Kamerazugriff erforderlich
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, textAlign: "center" }}>
          Um Barcodes zu scannen, wird Zugriff auf die Kamera benötigt.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Zugriff erlauben</Text>
        </Pressable>
      </View>
    );
  }

  // ── Result view ─────────────────────────────────────────────────────────────
  if (product) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Product header */}
        <View style={{ backgroundColor: c.card, padding: 20, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, flexShrink: 1 }}>
                {product.nameDe ?? product.name}
              </Text>
              {product.nameDe && product.name !== product.nameDe && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                  {product.name}
                </Text>
              )}
              {product.brand && (
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.primary }}>
                  {product.brand}
                </Text>
              )}
            </View>
            <Pressable onPress={resetScan} style={{ padding: 8 }}>
              <Feather name="refresh-cw" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>

          {product.quantity && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              Packungsgröße: {product.quantity}
            </Text>
          )}

          {product.nutriScore && <NutriScoreBadge grade={product.nutriScore} />}
        </View>

        {/* Nährwerte */}
        <View style={{ margin: 16, backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 2 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground, marginBottom: 8 }}>
            Nährwerte pro 100 g
          </Text>
          <MacroRow label="Energie" value={product.kcalPer100g} unit="kcal" />
          <MacroRow label="Protein" value={product.proteinPer100g} unit="g" />
          <MacroRow label="Kohlenhydrate" value={product.carbsPer100g} unit="g" />
          <MacroRow label="Fett" value={product.fatPer100g} unit="g" />
          <MacroRow label="Salz" value={product.saltPer100g} unit="g" />
          {product.kcalPer100g == null && product.proteinPer100g == null && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              Keine Nährwertdaten verfügbar.
            </Text>
          )}
        </View>

        {/* Allergene */}
        {product.allergens.length > 0 && (
          <View style={{ marginHorizontal: 16, backgroundColor: "#fff3cd", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#856404", marginBottom: 8 }}>
              Allergene
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {product.allergens.map((a) => (
                <View key={a} style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#856404" }}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Barcode */}
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            Barcode: {product.barcode} · Quelle: Open Food Facts
          </Text>
        </View>

        {/* Aktionen */}
        <View style={{ marginHorizontal: 16, marginTop: 20, gap: 10 }}>
          <Pressable
            onPress={addToInventory}
            style={({ pressed }) => ({
              backgroundColor: c.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>
              Zum Inventar hinzufügen
            </Text>
          </Pressable>
          <Pressable
            onPress={resetScan}
            style={({ pressed }) => ({
              backgroundColor: c.muted,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
              Neues Produkt scannen
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Camera view ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanning ? handleBarcode : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
      >
        {/* Overlay */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {/* Scanning frame */}
          <View
            style={{
              width: 260,
              height: 160,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: "#f59e0b",
              backgroundColor: "transparent",
            }}
          />
          <Text
            style={{
              marginTop: 20,
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: "#fff",
              opacity: 0.85,
            }}
          >
            {loading ? "Produkt wird geladen…" : "Barcode in den Rahmen halten"}
          </Text>
          {loading && <ActivityIndicator color="#f59e0b" style={{ marginTop: 12 }} />}
        </View>
      </CameraView>

      {/* Web fallback — manual barcode entry */}
      {Platform.OS === "web" && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 20,
            left: 20,
            right: 20,
            backgroundColor: "rgba(0,0,0,0.7)",
            borderRadius: 14,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" }}>
            Kamera-Scan ist im Browser eingeschränkt.{"\n"}Barcode manuell eingeben:
          </Text>
          <ManualBarcodeInput onSubmit={(code) => handleBarcode({ data: code })} loading={loading} primary={c.primary} />
        </View>
      )}
    </View>
  );
}

// Simple manual input component for web fallback
function ManualBarcodeInput({
  onSubmit,
  loading,
  primary,
}: {
  onSubmit: (code: string) => void;
  loading: boolean;
  primary: string;
}) {
  const [value, setValue] = React.useState("");
  const { TextInput } = require("react-native");
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="z.B. 4006381333931"
        placeholderTextColor="#888"
        keyboardType="number-pad"
        style={{
          flex: 1,
          backgroundColor: "#222",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: "#fff",
          fontFamily: "Inter_400Regular",
          fontSize: 14,
        }}
        onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
      />
      <Pressable
        onPress={() => value.trim() && onSubmit(value.trim())}
        disabled={loading}
        style={{
          backgroundColor: primary,
          borderRadius: 8,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          opacity: loading ? 0.5 : 1,
        }}
      >
        <Feather name="search" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface PriceEntry {
  id: string;
  orgId: string;
  locationCode: string;
  clerkUserId: string;
  dishType: string;
  agreedPrice: number;
  currency: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

const DISH_TYPES = [
  "Hauptgericht 1",
  "Hauptgericht 2",
  "Hauptgericht 3",
  "Suppe",
  "Dessert",
  "Beilage",
  "Salat",
  "Getränk",
  "Sonstiges",
];

export default function PriceListScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ clerkUserId: string; displayName: string; locationCode: string }>();

  const { clerkUserId, displayName, locationCode } = params;

  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [dishType, setDishType] = useState(DISH_TYPES[0]!);
  const [customType, setCustomType] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomType, setShowCustomType] = useState(false);

  const load = useCallback(async () => {
    if (!clerkUserId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PriceEntry[]>(
        `/api/preorder/staff/price-lists?clerkUserId=${encodeURIComponent(clerkUserId)}${locationCode ? `&locationCode=${encodeURIComponent(locationCode)}` : ""}`,
      );
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [clerkUserId, locationCode]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const finalType = showCustomType ? customType.trim() : dishType;
    const priceNum = parseFloat(price.replace(",", "."));
    if (!finalType) { Alert.alert("Fehler", "Bitte Essen-Typ eingeben."); return; }
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert("Fehler", "Bitte einen gültigen Preis eingeben."); return; }

    setSaving(true);
    try {
      await apiFetch("/api/preorder/staff/price-lists", {
        method: "POST",
        body: {
          locationCode: locationCode ?? "",
          clerkUserId,
          dishType: finalType,
          agreedPrice: priceNum,
          currency: "EUR",
          note: note.trim() || null,
        },
      });
      setPrice("");
      setNote("");
      await load();
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = (id: string, dt: string) => {
    Alert.alert("Preisvereinbarung löschen", `"${dt}" löschen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/preorder/staff/price-lists/${encodeURIComponent(id)}`, { method: "DELETE" });
            await load();
          } catch (e) {
            Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const inputStyle = {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    padding: 10, color: c.foreground, backgroundColor: c.card,
    fontFamily: "Inter_400Regular", fontSize: 14,
  };
  const labelStyle = { color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <SectionHeader title="Preisvereinbarungen" />
            <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: 2 }}>
              {displayName ?? clerkUserId}
              {locationCode ? ` · ${locationCode}` : ""}
            </Text>
          </View>
        </View>

        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          Lege individuelle Preise pro Essen-Kategorie fest. Diese Preise werden beim Tagesabschluss automatisch angewendet — unabhängig vom Menü-Listenpreis.
        </Text>

        {/* Add / edit entry form */}
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            Preisvereinbarung hinzufügen / bearbeiten
          </Text>

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Essen-Kategorie</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {DISH_TYPES.map((dt) => (
                <Pressable
                  key={dt}
                  onPress={() => { setDishType(dt); setShowCustomType(false); }}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: !showCustomType && dishType === dt ? c.primary : c.muted,
                    borderWidth: 1,
                    borderColor: !showCustomType && dishType === dt ? c.primary : c.border,
                  }}
                >
                  <Text style={{
                    color: !showCustomType && dishType === dt ? c.primaryForeground : c.foreground,
                    fontSize: 12, fontFamily: "Inter_500Medium",
                  }}>
                    {dt}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowCustomType(true)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: showCustomType ? c.primary : c.muted,
                  borderWidth: 1,
                  borderColor: showCustomType ? c.primary : c.border,
                }}
              >
                <Text style={{
                  color: showCustomType ? c.primaryForeground : c.foreground,
                  fontSize: 12, fontFamily: "Inter_500Medium",
                }}>+ Eigener Typ</Text>
              </Pressable>
            </View>
          </View>

          {showCustomType && (
            <View style={{ gap: 4 }}>
              <Text style={labelStyle}>Eigener Essen-Typ</Text>
              <TextInput
                style={inputStyle}
                value={customType}
                onChangeText={setCustomType}
                placeholder="z.B. Diätkost, Vegetarisch"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          )}

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Vereinbarter Preis (€) *</Text>
            <TextInput
              style={inputStyle}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="z.B. 7,50"
              placeholderTextColor={c.mutedForeground}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Notiz (optional)</Text>
            <TextInput
              style={inputStyle}
              value={note}
              onChangeText={setNote}
              placeholder="z.B. Vertrag 2026, gültig bis Dez."
              placeholderTextColor={c.mutedForeground}
            />
          </View>

          <Button
            label={saving ? "Speichern…" : "Preisvereinbarung speichern"}
            onPress={save}
            disabled={saving}
          />
        </Card>

        {/* Existing entries */}
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
          Aktuelle Vereinbarungen
        </Text>

        {loading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : error ? (
          <Card><Text style={{ color: c.destructive }}>{error}</Text></Card>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="tag"
            title="Keine Preisvereinbarungen"
            body="Noch keine individuellen Preise für diesen Kunden hinterlegt."
          />
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {entry.dishType}
                  </Text>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                    {entry.agreedPrice.toFixed(2).replace(".", ",")} {entry.currency}
                  </Text>
                  {entry.note ? (
                    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{entry.note}</Text>
                  ) : null}
                  <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                    Stand: {new Date(entry.updatedAt).toLocaleDateString("de")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => deleteEntry(entry.id, entry.dishType)}
                  style={{ padding: 8 }}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={16} color={c.destructive} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

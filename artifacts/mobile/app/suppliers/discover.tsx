import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Chip, SectionHeader } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch, type DiscoverSupplier } from "@/lib/api";
import type { Supplier } from "@/types";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "butcher", label: "Fleischerei" },
  { id: "bakery", label: "Bäckerei" },
  { id: "cheese", label: "Käse" },
  { id: "greengrocer", label: "Obst & Gemüse" },
  { id: "seafood", label: "Fisch" },
  { id: "beverages", label: "Getränke" },
  { id: "wholesale", label: "Großhandel" },
  { id: "organic", label: "Bio-Markt" },
];

export default function DiscoverSuppliers() {
  const c = useColors();
  const router = useRouter();
  const { state, dispatch, newId } = useApp();
  const [category, setCategory] = useState("butcher");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoverSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ results: DiscoverSupplier[] }>(
        `/api/suppliers/discover?category=${encodeURIComponent(cat)}`,
      );
      setResults(r.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  const filtered = query
    ? results.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          (r.address ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : results;

  const save = (r: DiscoverSupplier) => {
    const supplier: Supplier = {
      id: newId(),
      name: r.name,
      contact: "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      category: r.productGroups,
      rating: r.rating ?? 0,
      notes: `Quelle: ${r.source.toUpperCase()}${r.website ? ` · ${r.website}` : ""}`,
    };
    const exists = state.suppliers.some(
      (s) => s.name.toLowerCase() === supplier.name.toLowerCase() && s.address === supplier.address,
    );
    if (exists) {
      Alert.alert("Bereits gespeichert", `${supplier.name} ist schon in deiner Liste.`);
      return;
    }
    dispatch({ type: "addSupplier", supplier });
    Alert.alert("Gespeichert", `${supplier.name} wurde zu deinen Lieferanten hinzugefügt.`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <SectionHeader title="Lieferanten in Berlin & Brandenburg" />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 8 }}>
            Quelle: OpenStreetMap (Overpass). Tippe auf eine Kategorie und durchsuche die Ergebnisse.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((cat) => (
              <Chip key={cat.id} label={cat.label} active={category === cat.id} onPress={() => setCategory(cat.id)} />
            ))}
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Suchen (Name, Stadt, PLZ…)"
            placeholderTextColor={c.mutedForeground}
            style={{
              marginTop: 12,
              backgroundColor: c.muted,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: c.foreground,
              fontFamily: "Inter_500Medium",
              fontSize: 15,
            }}
          />
        </Card>

        {loading && (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
            <Text style={{ marginTop: 8, color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              Daten werden geladen…
            </Text>
          </View>
        )}

        {error && (
          <Card>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>Fehler: {error}</Text>
            <Button label="Erneut versuchen" onPress={() => load(category)} variant="secondary" />
          </Card>
        )}

        {!loading && !error && (
          <>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", paddingHorizontal: 4 }}>
              {filtered.length} Ergebnisse
            </Text>
            {filtered.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => save(r)}
                activeOpacity={0.8}
              >
                <Card>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{r.name}</Text>
                  {r.address && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 }}>
                      {r.address}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                    {r.phone && (
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>📞 {r.phone}</Text>
                    )}
                    {r.website && (
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }} numberOfLines={1}>
                        🌐 {r.website.replace(/^https?:\/\//, "").slice(0, 30)}
                      </Text>
                    )}
                    {r.rating != null && (
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>★ {r.rating.toFixed(1)}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {r.productGroups.map((g) => (
                      <View
                        key={g}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: c.muted,
                        }}
                      >
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>{g}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ marginTop: 8, color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    + Zu Lieferanten hinzufügen
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Button label="Zurück" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </View>
  );
}

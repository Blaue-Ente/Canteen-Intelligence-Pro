import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import type { Supplier } from "@/types";

interface ProducerResult {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  productGroups: string[];
  distanceKm?: number | null;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

const CATEGORIES: CategoryDef[] = [
  { id: "farm", label: "Bauernhof", icon: "home" },
  { id: "market_garden", label: "Gemüsegärtner", icon: "sun" },
  { id: "orchard", label: "Obstanbau", icon: "feather" },
  { id: "dairy_farm", label: "Milchbetrieb", icon: "droplet" },
  { id: "cheese", label: "Käserei", icon: "package" },
  { id: "mill", label: "Getreidemühle", icon: "wind" },
  { id: "organic", label: "Bio-Betrieb", icon: "check-circle" },
  { id: "direct_sales", label: "Direktvermarktung", icon: "shopping-bag" },
  { id: "butcher_farm", label: "Hofmetzgerei", icon: "scissors" },
  { id: "beekeeper", label: "Imkerei", icon: "star" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
);

export default function ProducersScreen() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const [category, setCategory] = useState("farm");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProducerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void (async () => {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => {},
          );
        }
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const loc = await Location.getCurrentPositionAsync({});
      setPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const load = useCallback(
    async (cat: string) => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/producers/discover?category=${encodeURIComponent(cat)}${
          pos ? `&lat=${pos.lat}&lng=${pos.lng}` : ""
        }`;
        const r = await apiFetch<{ results: ProducerResult[] }>(url);
        setResults(r.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [pos],
  );

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

  const save = (r: ProducerResult) => {
    const supplier: Supplier = {
      id: newId(),
      name: r.name,
      contact: "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      category: [...r.productGroups, "regional", CATEGORY_MAP[category] ?? category],
      rating: r.rating ?? 0,
      notes: `Erzeuger · ${CATEGORY_MAP[category] ?? category}${r.website ? ` · ${r.website}` : ""}`,
    };
    const exists = state.suppliers.some(
      (s) => s.name.toLowerCase() === supplier.name.toLowerCase() && s.address === supplier.address,
    );
    if (exists) {
      Alert.alert(
        state.locale === "de" ? "Bereits gespeichert" : "Already saved",
        `${supplier.name} ${state.locale === "de" ? "ist schon in deiner Lieferantenliste." : "is already in your supplier list."}`,
      );
      return;
    }
    dispatch({ type: "addSupplier", supplier });
    Alert.alert(
      "✓",
      state.locale === "de"
        ? `${supplier.name} wurde zu Lieferanten hinzugefügt.`
        : `${supplier.name} added to suppliers.`,
    );
  };

  const catDef = CATEGORIES.find((cat) => cat.id === category);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {/* Header */}
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#d1fae5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="sunrise" size={20} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
                {t("producersTitle")}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 }}>
                {t("producersSubtitle")}
              </Text>
            </View>
          </View>

          {pos && (
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Feather name="map-pin" size={12} color="#059669" />
              <Text style={{ color: "#059669", fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {t("nearby")}
              </Text>
            </View>
          )}

          {/* Category chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                active={category === cat.id}
                onPress={() => setCategory(cat.id)}
              />
            ))}
          </View>

          {/* Search */}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={state.locale === "de" ? "Suchen (Name, Ort, PLZ…)" : "Search (name, city, postcode…)"}
            placeholderTextColor={c.mutedForeground}
            style={{
              marginTop: 4,
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

        {/* Loading */}
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color="#059669" />
            <Text style={{ marginTop: 8, color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {state.locale === "de" ? "Daten werden geladen…" : "Loading…"}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <Card>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>
              {state.locale === "de" ? "Fehler" : "Error"}: {error}
            </Text>
            <Button
              label={state.locale === "de" ? "Erneut versuchen" : "Retry"}
              onPress={() => load(category)}
              variant="secondary"
            />
          </Card>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
              <Feather name={catDef?.icon ?? "feather"} size={14} color="#059669" />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                {filtered.length} {state.locale === "de" ? "Ergebnisse" : "results"} ·{" "}
                <Text style={{ color: c.foreground }}>{CATEGORY_MAP[category]}</Text>
              </Text>
            </View>

            {filtered.length === 0 && !loading && (
              <Card>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
                  {state.locale === "de"
                    ? "Keine Ergebnisse. Versuche eine andere Kategorie."
                    : "No results. Try a different category."}
                </Text>
              </Card>
            )}

            {filtered.map((r) => (
              <TouchableOpacity key={r.id} onPress={() => save(r)} activeOpacity={0.8}>
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: "#d1fae5",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Feather name={catDef?.icon ?? "feather"} size={16} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                        {r.name}
                      </Text>
                      {r.address ? (
                        <Text
                          style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}
                        >
                          {r.address}
                        </Text>
                      ) : null}
                    </View>
                    {r.distanceKm != null ? (
                      <Badge label={`${r.distanceKm.toFixed(1)} km`} tone="success" />
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    {r.phone ? (
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        📞 {r.phone}
                      </Text>
                    ) : null}
                    {r.website ? (
                      <Text
                        style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}
                        numberOfLines={1}
                      >
                        🌐 {r.website.replace(/^https?:\/\//, "").slice(0, 28)}
                      </Text>
                    ) : null}
                    {r.rating != null ? (
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        ★ {r.rating.toFixed(1)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {r.productGroups.map((g) => (
                      <View
                        key={g}
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: "#d1fae5",
                        }}
                      >
                        <Text style={{ color: "#065f46", fontFamily: "Inter_500Medium", fontSize: 11 }}>{g}</Text>
                      </View>
                    ))}
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: "#d1fae5",
                      }}
                    >
                      <Text style={{ color: "#065f46", fontFamily: "Inter_500Medium", fontSize: 11 }}>
                        🌱 regional
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: "#059669", fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 }}>
                    + {state.locale === "de" ? "Als Lieferant speichern" : "Save as supplier"}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Info box */}
        <Card style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", borderWidth: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Feather name="info" size={14} color="#059669" />
            <Text style={{ color: "#065f46", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {state.locale === "de" ? "Warum regionale Erzeuger?" : "Why local producers?"}
            </Text>
          </View>
          <Text style={{ color: "#047857", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
            {state.locale === "de"
              ? "Kürzere Transportwege bedeuten weniger CO₂, frischere Ware und stärken die lokale Wirtschaft. Gespeicherte Erzeuger erscheinen in deiner Lieferantenliste."
              : "Shorter transport routes mean less CO₂, fresher produce and support the local economy. Saved producers appear in your supplier list."}
          </Text>
        </Card>

        <Button label={state.locale === "de" ? "Zurück" : "Back"} onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </View>
  );
}

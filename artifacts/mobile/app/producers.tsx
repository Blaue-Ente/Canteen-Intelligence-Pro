import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Badge, Button, Card, Chip } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
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
  isFallback?: boolean;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

const CATEGORIES: CategoryDef[] = [
  { id: "farm",          label: "Bauernhof",          icon: "home" },
  { id: "market_garden", label: "Gemüsegärtner",      icon: "sun" },
  { id: "orchard",       label: "Obstanbau",           icon: "feather" },
  { id: "dairy_farm",    label: "Milchbetrieb",        icon: "droplet" },
  { id: "cheese",        label: "Käserei",             icon: "package" },
  { id: "mill",          label: "Getreidemühle",       icon: "wind" },
  { id: "organic",       label: "Bio-Betrieb",         icon: "check-circle" },
  { id: "direct_sales",  label: "Direktvermarktung",   icon: "shopping-bag" },
  { id: "butcher_farm",  label: "Hofmetzgerei",        icon: "scissors" },
  { id: "beekeeper",     label: "Imkerei",             icon: "star" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

const RADIUS_STEPS = [10, 25, 50, 100, 200];

export default function ProducersScreen() {
  const { state, dispatch, newId } = useApp();
  const c = useColors();
  const router = useRouter();

  const [category, setCategory] = useState("farm");
  const [query, setQuery] = useState("");
  const [plz, setPlz] = useState("");
  const [plzCity, setPlzCity] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [results, setResults] = useState<ProducerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const plzRef = useRef<TextInput>(null);

  // ── Load producers ────────────────────────────────────────────────────────
  const load = useCallback(
    async (cat: string, loc: { lat: number; lng: number } | null, radius: number) => {
      setLoading(true);
      setError(null);
      setUsingFallback(false);
      try {
        const params = new URLSearchParams({ category: cat });
        if (loc) {
          params.set("lat", String(loc.lat));
          params.set("lng", String(loc.lng));
          params.set("radiusKm", String(radius));
        }
        const r = await apiFetch<{ results: ProducerResult[]; usingFallback?: boolean }>(
          `/api/producers/discover?${params.toString()}`,
        );
        setResults(r.results);
        setUsingFallback(r.usingFallback ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load fallback data on mount
  useEffect(() => {
    void load(category, null, radiusKm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PLZ Suchen ────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    Keyboard.dismiss();
    if (plz.length === 0) {
      void load(category, null, radiusKm);
      return;
    }
    if (!/^\d{5}$/.test(plz)) {
      setError("PLZ muss 5 Ziffern haben.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const r = await apiFetch<{ lat: number; lng: number; city: string }>(
        `/api/suppliers/geocode?plz=${encodeURIComponent(plz)}`,
      );
      const loc = { lat: r.lat, lng: r.lng };
      setCoords(loc);
      setPlzCity(r.city);
      await load(category, loc, radiusKm);
    } catch {
      setError("PLZ nicht gefunden. Bitte prüfen.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleCategory = (cat: string) => {
    setCategory(cat);
    void load(cat, coords, radiusKm);
  };

  const handleRadius = (km: number) => {
    setRadiusKm(km);
    void load(category, coords, km);
  };

  // ── Save as supplier ──────────────────────────────────────────────────────
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

  const filtered = query
    ? results.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          (r.address ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : results;

  const catDef = CATEGORIES.find((cat) => cat.id === category);
  const locationLabel = coords && plzCity
    ? `${plzCity} · ${radiusKm} km Umkreis`
    : state.locale === "de" ? "Berlin / Brandenburg" : "Berlin / Brandenburg";

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>

        {/* ── Header card ─────────────────────────────────────────────── */}
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: "#d1fae5",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Feather name="sunrise" size={20} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
                {state.locale === "de" ? "Lokale Erzeuger" : "Local Producers"}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 }}>
                {locationLabel}
              </Text>
            </View>
          </View>

          {/* PLZ + Suchen */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                ref={plzRef}
                value={plz}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 5);
                  setPlz(digits);
                  if (digits.length < 5) { setCoords(null); setPlzCity(null); }
                }}
                placeholder={state.locale === "de" ? "PLZ eingeben (optional)" : "Enter postcode (optional)"}
                placeholderTextColor={c.mutedForeground}
                keyboardType="numeric"
                maxLength={5}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                style={{
                  backgroundColor: c.muted,
                  borderColor: coords ? "#059669" : c.border,
                  borderWidth: 1.5,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: c.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  letterSpacing: 1,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={geocoding || loading}
              style={{
                backgroundColor: "#059669",
                borderRadius: 10,
                paddingHorizontal: 16,
                justifyContent: "center",
                alignItems: "center",
                opacity: geocoding || loading ? 0.6 : 1,
              }}
            >
              {geocoding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="search" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* PLZ confirmed + clear */}
          {coords && plzCity && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="map-pin" size={12} color="#059669" />
              <Text style={{ color: "#059669", fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {plzCity} ({plz}) · Umkreissuche aktiv
              </Text>
              <TouchableOpacity
                onPress={() => { setCoords(null); setPlzCity(null); setPlz(""); void load(category, null, radiusKm); }}
                style={{ marginLeft: "auto" }}
              >
                <Feather name="x" size={14} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Radius */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              {state.locale === "de" ? `Umkreis${coords ? "" : " (nach PLZ-Eingabe aktiv)"}` : `Radius${coords ? "" : " (enter PLZ first)"}`}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {RADIUS_STEPS.map((km) => (
                <TouchableOpacity
                  key={km}
                  onPress={() => handleRadius(km)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: radiusKm === km ? "#059669" : c.border,
                    backgroundColor: radiusKm === km ? "#059669" : "transparent",
                  }}
                >
                  <Text style={{ color: radiusKm === km ? "#fff" : c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {km} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                active={category === cat.id}
                onPress={() => handleCategory(cat.id)}
              />
            ))}
          </View>

          {/* Text filter */}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={state.locale === "de" ? "Suchen (Name, Ort…)" : "Search (name, city…)"}
            placeholderTextColor={c.mutedForeground}
            style={{
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

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color="#059669" />
            <Text style={{ marginTop: 8, color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {state.locale === "de" ? "Daten werden geladen…" : "Loading…"}
            </Text>
          </View>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <Card>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>
              {state.locale === "de" ? "Fehler" : "Error"}: {error}
            </Text>
            <Button
              label={state.locale === "de" ? "Erneut versuchen" : "Retry"}
              onPress={handleSearch}
              variant="secondary"
            />
          </Card>
        )}

        {/* ── Fallback notice ─────────────────────────────────────────── */}
        {usingFallback && !loading && !error && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#fffbeb",
              borderColor: "#fde68a",
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Feather name="info" size={13} color="#d97706" />
            <Text style={{ color: "#92400e", fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>
              {state.locale === "de"
                ? "Beispieldaten — PLZ eingeben für Erzeuger in deiner Nähe."
                : "Sample data — enter postcode for producers near you."}
            </Text>
          </View>
        )}

        {/* ── Results count ────────────────────────────────────────────── */}
        {!loading && !error && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <Feather name={catDef?.icon ?? "feather"} size={14} color="#059669" />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {filtered.length} {state.locale === "de" ? "Ergebnisse" : "results"} ·{" "}
              <Text style={{ color: c.foreground }}>{CATEGORY_MAP[category]}</Text>
            </Text>
          </View>
        )}

        {/* ── Empty ───────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <Card>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
              {state.locale === "de"
                ? "Keine Ergebnisse. Kategorie oder Umkreis ändern."
                : "No results. Try a different category or radius."}
            </Text>
          </Card>
        )}

        {/* ── Results list ─────────────────────────────────────────────── */}
        {!loading && !error && filtered.map((r) => (
          <TouchableOpacity key={r.id} onPress={() => save(r)} activeOpacity={0.8}>
            <Card style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    backgroundColor: "#d1fae5",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <Feather name={catDef?.icon ?? "feather"} size={16} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {r.name}
                  </Text>
                  {r.address ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
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
                  <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }} numberOfLines={1}>
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
                  <View key={g} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "#d1fae5" }}>
                    <Text style={{ color: "#065f46", fontFamily: "Inter_500Medium", fontSize: 11 }}>{g}</Text>
                  </View>
                ))}
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "#d1fae5" }}>
                  <Text style={{ color: "#065f46", fontFamily: "Inter_500Medium", fontSize: 11 }}>🌱 regional</Text>
                </View>
              </View>

              <Text style={{ color: "#059669", fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 }}>
                + {state.locale === "de" ? "Als Lieferant speichern" : "Save as supplier"}
              </Text>
            </Card>
          </TouchableOpacity>
        ))}

        {/* ── Info box ─────────────────────────────────────────────────── */}
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

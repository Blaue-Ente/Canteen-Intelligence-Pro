import { Feather } from "@expo/vector-icons";
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
import { useRouter } from "expo-router";
import { Button, Card, Chip } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { getCurrentLocation, LocationDeniedError } from "@/lib/location";
import type { Supplier } from "@/types";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "butcher",      label: "Fleischerei" },
  { id: "bakery",      label: "Bäckerei" },
  { id: "cheese",      label: "Käse" },
  { id: "greengrocer", label: "Obst & Gemüse" },
  { id: "seafood",     label: "Fisch" },
  { id: "beverages",   label: "Getränke" },
  { id: "wholesale",   label: "Großhandel" },
  { id: "organic",     label: "Bio-Markt" },
];

const RADIUS_STEPS = [5, 10, 25, 50, 100];

interface DiscoverSupplier {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  email?: string | null;
  rating: number | null;
  productGroups: string[];
  distanceKm?: number;
  isFallback?: boolean;
}

export default function DiscoverSuppliers() {
  const c = useColors();
  const router = useRouter();
  const { state, dispatch, newId } = useApp();

  const [category, setCategory] = useState("butcher");
  const [query, setQuery] = useState("");
  const [plz, setPlz] = useState("");
  const [plzCity, setPlzCity] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<DiscoverSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const plzRef = useRef<TextInput>(null);

  // ── Load results ──────────────────────────────────────────────────────────
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
        const r = await apiFetch<{
          results: DiscoverSupplier[];
          usingFallback?: boolean;
          count: number;
        }>(`/api/suppliers/discover?${params.toString()}`);
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

  // Initial load: show fallback data right away without PLZ
  useEffect(() => {
    void load(category, null, radiusKm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PLZ + Search button ───────────────────────────────────────────────────
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

  // ── Auto-detect device location ───────────────────────────────────────────
  const handleUseMyLocation = async () => {
    Keyboard.dismiss();
    setLocating(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setCoords({ lat: loc.lat, lng: loc.lng });
      setPlzCity(loc.city ?? "Mein Standort");
      setPlz("");
      await load(category, { lat: loc.lat, lng: loc.lng }, radiusKm);
    } catch (err) {
      if (err instanceof LocationDeniedError) {
        setError("Standort-Zugriff verweigert. Bitte Berechtigung erteilen oder PLZ eingeben.");
      } else {
        setError("Standort konnte nicht ermittelt werden. Bitte PLZ eingeben.");
      }
    } finally {
      setLocating(false);
    }
  };

  // ── Category change ───────────────────────────────────────────────────────
  const handleCategory = (cat: string) => {
    setCategory(cat);
    void load(cat, coords, radiusKm);
  };

  // ── Radius change ─────────────────────────────────────────────────────────
  const handleRadius = (km: number) => {
    setRadiusKm(km);
    void load(category, coords, km);
  };

  // ── Save supplier ─────────────────────────────────────────────────────────
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
      notes: `Quelle: Lieferantensuche${r.website ? ` · ${r.website}` : ""}`,
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

  const filtered = query
    ? results.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          (r.address ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : results;

  const locationLabel = coords && plzCity
    ? `${plzCity} · ${radiusKm} km Umkreis`
    : "Ganz Deutschland / Berlin–Brandenburg";

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>

        {/* ── Header card ─────────────────────────────────────────────── */}
        <Card style={{ gap: 12 }}>
          <View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              Lieferanten finden
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {locationLabel}
            </Text>
          </View>

          {/* PLZ + Suchen row */}
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
                placeholder="PLZ (optional)"
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
                backgroundColor: c.primary,
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

          {/* Mein Standort button */}
          <TouchableOpacity
            onPress={handleUseMyLocation}
            disabled={locating || loading || geocoding}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderColor: c.primary,
              borderWidth: 1.5,
              borderRadius: 10,
              paddingVertical: 9,
              opacity: locating || loading || geocoding ? 0.6 : 1,
            }}
          >
            {locating ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <Feather name="navigation" size={14} color={c.primary} />
            )}
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {locating ? "Standort wird ermittelt…" : "Mein Standort verwenden"}
            </Text>
          </TouchableOpacity>

          {/* Location confirmed */}
          {coords && plzCity && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="map-pin" size={12} color="#059669" />
              <Text style={{ color: "#059669", fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {plzCity}{plz ? ` (${plz})` : ""} · Umkreissuche aktiv
              </Text>
              <TouchableOpacity
                onPress={() => { setCoords(null); setPlzCity(null); setPlz(""); void load(category, null, radiusKm); }}
                style={{ marginLeft: "auto" }}
              >
                <Feather name="x" size={14} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Radius selector */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              Umkreis {coords ? "" : "(nach PLZ-Eingabe aktiv)"}
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
                    borderColor: radiusKm === km ? c.primary : c.border,
                    backgroundColor: radiusKm === km ? c.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: radiusKm === km ? "#fff" : c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {km} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category chips */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              Kategorie
            </Text>
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
          </View>

          {/* Text search */}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filtern (Name, Adresse…)"
            placeholderTextColor={c.mutedForeground}
            style={{
              backgroundColor: c.muted,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: c.foreground,
              fontFamily: "Inter_500Medium",
              fontSize: 14,
            }}
          />
        </Card>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={c.primary} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              Suche läuft…
            </Text>
          </View>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Feather name="alert-circle" size={16} color={c.destructive} />
              <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", flex: 1 }}>
                {error}
              </Text>
            </View>
            <Button label="Erneut versuchen" onPress={handleSearch} variant="secondary" />
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
              Beispieldaten — PLZ eingeben für echte Ergebnisse in deiner Nähe.
            </Text>
          </View>
        )}

        {/* ── Results ─────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, paddingHorizontal: 4 }}>
              {filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}
              {coords && plzCity ? ` · ${plzCity}, ${radiusKm} km` : ""}
            </Text>

            {filtered.map((r) => (
              <TouchableOpacity key={r.id} onPress={() => save(r)} activeOpacity={0.8}>
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View
                      style={{
                        width: 38, height: 38, borderRadius: 10,
                        backgroundColor: c.muted,
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <Feather name="shopping-bag" size={16} color={c.primary} />
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
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: "#d1fae5", flexShrink: 0 }}>
                        <Text style={{ color: "#065f46", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                          {r.distanceKm.toFixed(1)} km
                        </Text>
                      </View>
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
                        🌐 {r.website.replace(/^https?:\/\//, "").slice(0, 30)}
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
                      <View key={g} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.muted }}>
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>{g}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 }}>
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

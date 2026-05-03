import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function Suppliers() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
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

  const suppliers = pos
    ? [...state.suppliers].sort((a, b) => {
        if (!a.lat || !a.lng) return 1;
        if (!b.lat || !b.lng) return -1;
        return distanceKm(pos, { lat: a.lat, lng: a.lng }) - distanceKm(pos, { lat: b.lat, lng: b.lng });
      })
    : state.suppliers;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
        <SectionHeader title={t("suppliers")} />
        {pos ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Feather name="map-pin" size={12} color={c.primary} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              {t("nearby")}
            </Text>
          </View>
        ) : null}

        {suppliers.length === 0 ? (
          <Card>
            <EmptyState icon="users" title={t("empty")} />
          </Card>
        ) : (
          suppliers.map((s) => {
            const dist = pos && s.lat && s.lng ? distanceKm(pos, { lat: s.lat, lng: s.lng }) : null;
            return (
              <Card
                key={s.id}
                onPress={() => router.push(`/supplier/${s.id}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: c.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="briefcase" size={18} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {s.name}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {s.address}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {s.category.map((cat) => (
                      <Badge key={cat} label={cat} />
                    ))}
                    <Badge label={`★ ${s.rating}`} tone="accent" />
                    {dist !== null ? <Badge label={`${dist.toFixed(1)} km`} tone="success" /> : null}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={c.mutedForeground} />
              </Card>
            );
          })
        )}

        <Button
          label="Lieferanten in Berlin/Brandenburg finden"
          icon="search"
          onPress={() => router.push("/suppliers/discover")}
        />
        <Button label={t("addSupplier")} icon="plus" variant="ghost" onPress={() => router.push("/supplier/new")} />
      </ScrollView>
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { Location } from "@/types";

export default function Locations() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const rollup = useMemo(() => {
    return state.locations.map((loc) => {
      const sales = state.sales.filter((s) => s.locationId === loc.id);
      const today = new Date().toISOString().slice(0, 10);
      const todayRev = sales.filter((s) => s.date === today).reduce((a, x) => a + x.revenue, 0);
      const lowStock = state.inventory.filter(
        (i) => i.locationId === loc.id && i.quantity < i.minQuantity,
      ).length;
      const wasteWeek = state.waste
        .filter((w) => w.locationId === loc.id)
        .filter((w) => Date.now() - new Date(w.date).getTime() < 7 * 86400000)
        .reduce((a, x) => a + x.cost, 0);
      return { loc, todayRev, lowStock, wasteWeek };
    });
  }, [state.locations, state.sales, state.inventory, state.waste]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("location")} />
          <Pressable
            onPress={() => dispatch({ type: "setCurrentLocation", id: undefined })}
            style={{
              padding: 12,
              borderRadius: c.radius,
              backgroundColor: !state.currentLocationId ? c.primary : c.muted,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Feather
              name="globe"
              size={18}
              color={!state.currentLocationId ? c.primaryForeground : c.foreground}
            />
            <Text
              style={{
                color: !state.currentLocationId ? c.primaryForeground : c.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                flex: 1,
              }}
            >
              {t("allLocations")}
            </Text>
            {!state.currentLocationId ? (
              <Feather name="check" size={16} color={c.primaryForeground} />
            ) : null}
          </Pressable>
          <View style={{ height: 8 }} />
          {state.locations.map((loc) => {
            const active = state.currentLocationId === loc.id;
            return (
              <Pressable
                key={loc.id}
                onPress={() => dispatch({ type: "setCurrentLocation", id: loc.id })}
                style={{
                  padding: 12,
                  borderRadius: c.radius,
                  backgroundColor: active ? c.primary : c.muted,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: active ? c.primaryForeground : c.card,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? c.primary : c.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 11,
                    }}
                  >
                    {loc.code ?? loc.name.slice(0, 3).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: active ? c.primaryForeground : c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                    }}
                  >
                    {loc.name}
                  </Text>
                  {loc.address ? (
                    <Text
                      style={{
                        color: active ? c.primaryForeground + "cc" : c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {loc.address}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setEditing(loc);
                    setOpen(true);
                  }}
                  hitSlop={10}
                >
                  <Feather
                    name="edit-2"
                    size={14}
                    color={active ? c.primaryForeground : c.mutedForeground}
                  />
                </Pressable>
              </Pressable>
            );
          })}
          <Button
            label={t("addLocation")}
            icon="plus"
            variant="ghost"
            onPress={() => {
              setEditing(null);
              setOpen(true);
            }}
          />
        </Card>

        <SectionHeader title={t("rollup")} />
        {rollup.length === 0 ? (
          <Card>
            <EmptyState icon="map-pin" title={t("empty")} />
          </Card>
        ) : (
          rollup.map(({ loc, todayRev, lowStock, wasteWeek }) => (
            <Card key={loc.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 }}>
                  {loc.name}
                </Text>
                {loc.isPrimary ? <Badge label="primary" tone="accent" /> : null}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Stat label={t("revenue")} value={`€${todayRev.toFixed(0)}`} icon="trending-up" tone="success" />
                <Stat label={t("lowStock")} value={String(lowStock)} icon="package" tone={lowStock > 0 ? "warning" : "default"} />
                <Stat label="Waste 7d" value={`€${wasteWeek.toFixed(0)}`} icon="trash-2" tone={wasteWeek > 50 ? "destructive" : "default"} />
              </View>
            </Card>
          ))
        )}

        <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 12 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
            {t("close")}
          </Text>
        </Pressable>
      </ScrollView>

      <LocationModal
        open={open}
        location={editing}
        onClose={() => setOpen(false)}
        onSave={(loc) => {
          if (editing) dispatch({ type: "updateLocation", location: loc });
          else dispatch({ type: "addLocation", location: loc });
          setOpen(false);
        }}
        onDelete={(id) => {
          Alert.alert("Löschen?", "", [
            { text: "Abbrechen" },
            {
              text: "Löschen",
              style: "destructive",
              onPress: () => {
                dispatch({ type: "removeLocation", id });
                setOpen(false);
              },
            },
          ]);
        }}
        newId={newId}
      />
    </View>
  );
}

function LocationModal({
  open,
  location,
  onClose,
  onSave,
  onDelete,
  newId,
}: {
  open: boolean;
  location: Location | null;
  onClose: () => void;
  onSave: (l: Location) => void;
  onDelete: (id: string) => void;
  newId: () => string;
}) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(location?.name ?? "");
  const [code, setCode] = useState(location?.code ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [phone, setPhone] = useState(location?.phone ?? "");
  const [lat, setLat] = useState(String(location?.lat ?? ""));
  const [lng, setLng] = useState(String(location?.lng ?? ""));
  const [avg, setAvg] = useState(String(location?.avgGuestsPerDay ?? "100"));

  React.useEffect(() => {
    if (open) {
      setName(location?.name ?? "");
      setCode(location?.code ?? "");
      setAddress(location?.address ?? "");
      setPhone(location?.phone ?? "");
      setLat(String(location?.lat ?? ""));
      setLng(String(location?.lng ?? ""));
      setAvg(String(location?.avgGuestsPerDay ?? "100"));
    }
  }, [open, location]);

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderColor: c.border,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>
              {t("cancel")}
            </Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
            {location ? t("location") : t("addLocation")}
          </Text>
          <View style={{ width: 70 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 60 }}>
          <Field label={t("name")} value={name} onChangeText={setName} />
          <Field label="Code" value={code} onChangeText={setCode} />
          <Field label="Adresse" value={address} onChangeText={setAddress} multiline />
          <Field label="Telefon" value={phone} onChangeText={setPhone} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Lat" value={lat} onChangeText={setLat} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Lng" value={lng} onChangeText={setLng} keyboardType="numeric" />
            </View>
          </View>
          <Field label={t("expectedGuests") + " (Ø/Tag)"} value={avg} onChangeText={setAvg} keyboardType="numeric" />
          <Button
            label={t("save")}
            icon="check"
            onPress={() =>
              onSave({
                id: location?.id ?? newId(),
                name,
                code: code || undefined,
                address: address || undefined,
                phone: phone || undefined,
                lat: lat ? Number(lat) : undefined,
                lng: lng ? Number(lng) : undefined,
                avgGuestsPerDay: Number(avg) || undefined,
                isPrimary: location?.isPrimary,
                createdAt: location?.createdAt ?? new Date().toISOString(),
              })
            }
          />
          {location ? (
            <Button label="Löschen" icon="trash-2" variant="destructive" onPress={() => onDelete(location.id)} />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

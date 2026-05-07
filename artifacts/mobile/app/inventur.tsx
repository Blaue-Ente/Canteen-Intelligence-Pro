import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { InventurCount, InventurSession } from "@/types";

// ─── Inventory Transfer Modal ────────────────────────────────────────────────
function TransferModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const c = useColors();
  const isDe = state.locale === "de";
  const [itemId, setItemId] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [qty, setQty] = useState("");

  const otherLocations = state.locations.filter((l) => {
    const item = state.inventory.find((i) => i.id === itemId);
    return item ? l.id !== item.locationId : true;
  });

  function doTransfer() {
    const parsed = Number(qty.replace(",", "."));
    if (!itemId || !toLoc || !parsed || parsed <= 0) {
      Alert.alert(isDe ? "Ungültige Eingabe" : "Invalid input", "");
      return;
    }
    dispatch({ type: "transferInventory", fromItemId: itemId, toLocationId: toLoc, qty: parsed });
    setItemId(""); setToLoc(""); setQty("");
    onClose();
    Alert.alert("✓", isDe ? "Bestand transferiert." : "Stock transferred.");
  }

  const item = state.inventory.find((i) => i.id === itemId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="shuffle" size={18} color={c.primary} />
          <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
            {isDe ? "Bestand transferieren" : "Transfer Stock"}
          </Text>
          <Pressable onPress={onClose}><Feather name="x" size={20} color={c.mutedForeground} /></Pressable>
        </View>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
          {isDe ? "Wähle Artikel, Zielstandort und Menge:" : "Select item, target location and quantity:"}
        </Text>
        {/* Item selector */}
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: -8 }}>
          {isDe ? "Artikel" : "Item"}
        </Text>
        <ScrollView style={{ maxHeight: 140, borderWidth: 1, borderColor: c.border, borderRadius: 8 }} nestedScrollEnabled>
          {state.inventory.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => { setItemId(i.id); setToLoc(""); }}
              style={{ padding: 10, backgroundColor: itemId === i.id ? c.muted : "transparent" }}
            >
              <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                {isDe ? i.nameDe : i.name} — {i.quantity} {i.unit}
                {i.locationId ? ` (${state.locations.find((l) => l.id === i.locationId)?.name ?? i.locationId})` : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* Target location */}
        {item && (
          <>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: -8 }}>
              {isDe ? "Zielstandort" : "Target location"}
            </Text>
            <ScrollView style={{ maxHeight: 110, borderWidth: 1, borderColor: c.border, borderRadius: 8 }} nestedScrollEnabled>
              {otherLocations.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setToLoc(l.id)}
                  style={{ padding: 10, backgroundColor: toLoc === l.id ? c.muted : "transparent" }}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{l.name}</Text>
                </Pressable>
              ))}
              {otherLocations.length === 0 && (
                <Text style={{ padding: 10, color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {isDe ? "Keine anderen Standorte vorhanden." : "No other locations available."}
                </Text>
              )}
            </ScrollView>
          </>
        )}
        {/* Quantity */}
        <Field
          label={isDe ? `Menge (max. ${item?.quantity ?? "?"} ${item?.unit ?? ""})` : `Quantity (max. ${item?.quantity ?? "?"} ${item?.unit ?? ""})`}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          placeholder="1"
        />
        <Button label={isDe ? "Transferieren" : "Transfer"} icon="shuffle" onPress={doTransfer} />
      </View>
    </Modal>
  );
}

export default function Inventur() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const [transferOpen, setTransferOpen] = useState(false);

  const open = useMemo(
    () => state.inventurs.find((s) => s.status === "open"),
    [state.inventurs],
  );
  const closed = useMemo(
    () => state.inventurs.filter((s) => s.status === "closed"),
    [state.inventurs],
  );

  const author = useAuthor();
  const start = () => {
    const session: InventurSession = {
      id: newId(),
      startedAt: new Date().toISOString(),
      status: "open",
      counts: state.inventory.map<InventurCount>((i) => ({
        inventoryId: i.id,
        expectedQty: i.quantity,
        unit: i.unit,
        pricePerUnit: i.pricePerUnit,
      })),
      ...author,
    };
    dispatch({ type: "addInventur", session });
  };

  const setActual = (cIdx: number, value: string) => {
    if (!open) return;
    const v = value === "" ? undefined : Number(value.replace(",", "."));
    const next: InventurSession = {
      ...open,
      counts: open.counts.map((cnt, i) =>
        i === cIdx ? { ...cnt, actualQty: Number.isNaN(v) ? undefined : v } : cnt,
      ),
    };
    dispatch({ type: "updateInventur", session: next });
  };

  const close = () => {
    if (!open) return;
    let totalLoss = 0;
    open.counts.forEach((cnt) => {
      if (cnt.actualQty == null) return;
      const diff = cnt.expectedQty - cnt.actualQty;
      totalLoss += diff * cnt.pricePerUnit;
    });
    Alert.alert(
      t("closeInventur"),
      state.locale === "de"
        ? `Differenzwert: €${totalLoss.toFixed(2)}\nIst-Mengen werden ins Lager übernommen.`
        : `Variance value: €${totalLoss.toFixed(2)}\nActual quantities will be applied to stock.`,
      [
        { text: t("cancel") },
        {
          text: t("save"),
          onPress: () => {
            open.counts.forEach((cnt) => {
              if (cnt.actualQty == null) return;
              const inv = state.inventory.find((x) => x.id === cnt.inventoryId);
              if (!inv) return;
              dispatch({
                type: "updateInventory",
                item: { ...inv, quantity: cnt.actualQty, updatedAt: new Date().toISOString() },
              });
            });
            dispatch({
              type: "updateInventur",
              session: {
                ...open,
                status: "closed",
                closedAt: new Date().toISOString(),
                varianceValue: totalLoss,
              },
            });
          },
        },
      ],
    );
  };

  const cancel = () => {
    if (!open) return;
    Alert.alert(t("delete"), "", [
      { text: t("cancel") },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => dispatch({ type: "removeInventur", id: open.id }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TransferModal visible={transferOpen} onClose={() => setTransferOpen(false)} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {/* T008: Inventory Transfer between locations */}
        {state.locations.length > 1 && (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="shuffle" size={16} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {state.locale === "de" ? "Bestand transferieren" : "Transfer stock"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                  {state.locale === "de"
                    ? "Artikel zwischen Standorten verschieben"
                    : "Move items between locations"}
                </Text>
              </View>
              <Button
                label={state.locale === "de" ? "Transfer" : "Transfer"}
                icon="shuffle"
                variant="ghost"
                onPress={() => setTransferOpen(true)}
              />
            </View>
          </Card>
        )}
        {!open ? (
          <Card>
            <EmptyState
              icon="clipboard"
              title={t("noInventur")}
              body={
                state.locale === "de"
                  ? "Inventur erfasst Ist-Mengen aller Artikel und vergleicht sie mit dem System."
                  : "A stocktake captures actual quantities of all items and compares them with the system."
              }
            />
            <View style={{ height: 12 }} />
            <Button label={t("startInventur")} icon="play" onPress={start} />
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="clipboard" size={18} color={c.warning} />
                <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  {t("inventurOpen")}
                </Text>
                <Badge label={t("draft")} tone="warning" />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }}>
                {new Date(open.startedAt).toLocaleString()} · {open.counts.length} {t("positions")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button label={t("closeInventur")} icon="check" onPress={close} style={{ flex: 1 }} />
                <Button label={t("cancel")} icon="x" variant="ghost" onPress={cancel} />
              </View>
            </Card>

            <Card style={{ padding: 0 }}>
              {open.counts.map((cnt, idx) => {
                const inv = state.inventory.find((x) => x.id === cnt.inventoryId);
                if (!inv) return null;
                const diff =
                  cnt.actualQty == null ? null : cnt.actualQty - cnt.expectedQty;
                return (
                  <View
                    key={cnt.inventoryId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: idx < open.counts.length - 1 ? 1 : 0,
                      borderColor: c.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {state.locale === "de" ? inv.nameDe : inv.name}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                        {t("expectedQty")}: {cnt.expectedQty} {cnt.unit}
                      </Text>
                    </View>
                    <TextInput
                      value={cnt.actualQty?.toString() ?? ""}
                      onChangeText={(v) => setActual(idx, v)}
                      placeholder={String(cnt.expectedQty)}
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numeric"
                      style={{
                        width: 76,
                        backgroundColor: c.background,
                        borderColor: c.border,
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        color: c.foreground,
                        fontFamily: "Inter_500Medium",
                        textAlign: "right",
                      }}
                    />
                    <View style={{ width: 48, alignItems: "flex-end" }}>
                      {diff == null ? (
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>—</Text>
                      ) : (
                        <Text
                          style={{
                            color: Math.abs(diff) < 0.01 ? c.success : diff > 0 ? c.success : c.destructive,
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                          }}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toFixed(diff % 1 === 0 ? 0 : 1)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {closed.length > 0 ? (
          <>
            <SectionHeader title={t("history")} />
            {closed.map((s) => {
              const counted = s.counts.filter((cnt) => cnt.actualQty != null).length;
              return (
                <Card key={s.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check-circle" size={16} color={c.success} />
                    <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {new Date(s.closedAt ?? s.startedAt).toLocaleDateString()}
                    </Text>
                    <Badge label={t("inventurClosed")} tone="success" />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Stat
                      label={t("variance")}
                      value={`€${(s.varianceValue ?? 0).toFixed(2)}`}
                      tone={(s.varianceValue ?? 0) > 0 ? "destructive" : "success"}
                    />
                    <Stat label={t("inventory")} value={`${counted}/${s.counts.length}`} />
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

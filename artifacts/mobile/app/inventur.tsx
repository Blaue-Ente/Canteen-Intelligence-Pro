import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { Badge, Button, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { InventurCount, InventurSession } from "@/types";

export default function Inventur() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();

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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
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

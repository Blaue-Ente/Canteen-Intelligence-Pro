import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { computeShortages } from "@/lib/computations";
import type { OrderDraft } from "@/types";

const DAY_OPTIONS = [3, 5, 7, 14] as const;

export default function Procurement() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const author = useAuthor();
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);

  const shortages = useMemo(
    () => computeShortages(state, days, 25, state.currentLocationId),
    [state, days],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof shortages>();
    for (const s of shortages) {
      const supId = s.preferredSupplierId ?? state.suppliers.find((sup) => sup.category.includes(s.category))?.id ?? "_unassigned";
      const arr = m.get(supId) ?? [];
      arr.push(s);
      m.set(supId, arr);
    }
    return Array.from(m.entries());
  }, [shortages, state.suppliers]);

  const createOrders = () => {
    let count = 0;
    for (const [supId, items] of grouped) {
      const sup = state.suppliers.find((s) => s.id === supId) ?? state.suppliers[0];
      if (!sup) continue;
      const order: OrderDraft = {
        id: newId(),
        supplierId: sup.id,
        supplierName: sup.name,
        supplierEmail: sup.email,
        items: items.map((it) => ({
          name: it.name,
          quantity: it.needed,
          unit: it.unit,
          inventoryId: it.inventoryId,
          estimatedPrice: it.pricePerUnit,
          reason: state.locale === "de" ? `Bedarf ${days} Tage` : `Need ${days} days`,
        })),
        total: items.reduce((a, x) => a + x.needed * x.pricePerUnit, 0),
        status: "draft",
        createdAt: new Date().toISOString(),
        notes: state.locale === "de" ? `Auto-Bestellung aus Menü-Bedarf (${days} Tage)` : `Auto-order from menu need (${days} days)`,
        ...author,
      };
      dispatch({ type: "addOrder", order });
      count++;
    }
    if (count === 0) {
      Alert.alert(state.locale === "de" ? "Keine Lieferanten" : "No suppliers", "");
      return;
    }
    router.push("/orders");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("autoProcurement")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {state.locale === "de"
              ? "KI prüft dein Menü, errechnet fehlende Zutaten und erzeugt Bestellungen pro Lieferant."
              : "AI checks your menu, computes missing ingredients and generates per-supplier orders."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {DAY_OPTIONS.map((d) => (
              <Chip key={d} label={`${d} ${t("days")}`} active={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        </Card>

        {shortages.length === 0 ? (
          <Card>
            <EmptyState
              icon="check-circle"
              title={state.locale === "de" ? "Alles gedeckt" : "All covered"}
              body={state.locale === "de" ? "Aktueller Bestand reicht für den Zeitraum." : "Current stock is sufficient."}
            />
          </Card>
        ) : (
          <>
            {grouped.map(([supId, items]) => {
              const sup = state.suppliers.find((s) => s.id === supId);
              const subtotal = items.reduce((a, x) => a + x.needed * x.pricePerUnit, 0);
              return (
                <Card key={supId}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Feather name="truck" size={16} color={c.primary} />
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8, flex: 1 }}>
                      {sup?.name ?? (state.locale === "de" ? "Ohne Lieferant" : "Unassigned")}
                    </Text>
                    <Badge label={`€${subtotal.toFixed(0)}`} tone="success" />
                  </View>
                  {items.map((it) => (
                    <View
                      key={it.inventoryId}
                      style={{
                        flexDirection: "row",
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
                        {it.name}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        {it.needed} {it.unit}
                      </Text>
                    </View>
                  ))}
                </Card>
              );
            })}
            <Button label={t("createOrder")} icon="send" onPress={createOrders} />
            <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 12 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
                {t("close")}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

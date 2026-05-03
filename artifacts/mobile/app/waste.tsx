import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { WasteEntry } from "@/types";

const REASONS: WasteEntry["reason"][] = ["spoilage", "overproduction", "preparation", "plate"];

export default function Waste() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const [grams, setGrams] = useState("");
  const [reason, setReason] = useState<WasteEntry["reason"]>("spoilage");
  const [cost, setCost] = useState("");

  const total = state.waste.reduce((s, w) => s + w.cost, 0);
  const totalGrams = state.waste.reduce((s, w) => s + w.grams, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label="Gesamt" value={`${(totalGrams / 1000).toFixed(1)} kg`} icon="trash-2" tone="warning" />
          <Stat label="Verlust" value={`€${total.toFixed(0)}`} icon="trending-down" tone="destructive" />
        </View>

        <Card>
          <SectionHeader title={t("addLog")} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {REASONS.map((r) => (
              <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <Field label="Menge (g)" value={grams} onChangeText={setGrams} keyboardType="numeric" />
          <View style={{ height: 10 }} />
          <Field label="Kosten (€)" value={cost} onChangeText={setCost} keyboardType="numeric" />
          <View style={{ height: 12 }} />
          <Button
            label={t("save")}
            icon="check"
            onPress={() => {
              dispatch({
                type: "addWaste",
                entry: {
                  id: newId(),
                  date: new Date().toISOString(),
                  grams: Number(grams) || 0,
                  reason,
                  cost: Number(cost) || 0,
                },
              });
              setGrams("");
              setCost("");
            }}
          />
        </Card>

        <Card style={{ padding: 0 }}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <SectionHeader title={t("history")} />
          </View>
          {state.waste.length === 0 ? (
            <EmptyState icon="trash-2" title={t("empty")} />
          ) : (
            state.waste.map((w, i, arr) => (
              <View
                key={w.id}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderColor: c.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Feather name="trash-2" size={18} color={c.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {w.grams} g · {w.reason}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {new Date(w.date).toLocaleString()}
                  </Text>
                </View>
                <Badge label={`€${w.cost.toFixed(2)}`} tone="destructive" />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

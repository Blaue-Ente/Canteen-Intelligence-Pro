import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { leaderboard } from "@/lib/computations";

export default function Leaderboard() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const rows = useMemo(
    () => leaderboard(state.sales, state.haccp, state.waste, state.employees),
    [state.sales, state.haccp, state.waste, state.employees],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("leaderboard")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {state.locale === "de"
              ? "Wer trägt am meisten zur Kantine bei? Punkte aus Verkäufen, HACCP-Logs und niedriger Verschwendung."
              : "Who contributes the most? Points from sales, HACCP logs and low waste."}
          </Text>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="users" title={state.locale === "de" ? "Noch kein Team" : "No team yet"} />
          </Card>
        ) : (
          rows.map((row, idx) => (
            <Card key={row.employeeId}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: idx === 0 ? "#fcd34d" : idx === 1 ? "#d4d4d8" : idx === 2 ? "#fdba74" : c.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: idx < 3 ? "#1c1917" : c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {row.name}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <Badge label={`${row.salesLogged} ${t("sold").toLowerCase()}`} />
                    <Badge label={`${row.haccpLogged} HACCP`} tone="accent" />
                    <Badge label={`${row.wasteLogged} ${t("waste").toLowerCase()}`} tone={row.wasteLogged > 5 ? "warning" : "default"} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                    {row.score}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                    {t("score")}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

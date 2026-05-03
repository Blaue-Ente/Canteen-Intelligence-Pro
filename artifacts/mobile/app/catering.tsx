import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Text, View } from "react-native";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Catering() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 4 }}>
          Eingehende Catering-Anfragen werden automatisch von der KI gelesen und in Bestellungen pro Lieferant aufgeteilt.
        </Text>

        {state.catering.length === 0 ? (
          <Card>
            <EmptyState icon="mail" title={t("empty")} />
          </Card>
        ) : (
          state.catering.map((req) => (
            <Card key={req.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {req.subject}
                </Text>
                <Badge
                  label={req.status}
                  tone={req.status === "new" ? "warning" : req.status === "confirmed" ? "success" : "default"}
                />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }}>
                {req.fromEmail} · {req.guests} Gäste · {req.date}
              </Text>
              <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 10, lineHeight: 19 }}>
                {req.body}
              </Text>

              <View
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderColor: c.border,
                  gap: 10,
                }}
              >
                <SectionHeader title="KI-Vorschlag" />
                {req.parsed.map((p, i) => (
                  <View key={i} style={{ gap: 6 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Block {i + 1} · {p.notes}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {p.recipeIds
                        .map((id) => state.recipes.find((r) => r.id === id))
                        .filter(Boolean)
                        .map((r) => (
                          <Badge key={r!.id} label={state.locale === "de" ? r!.nameDe : r!.name} tone="accent" />
                        ))}
                    </View>
                  </View>
                ))}
              </View>

              <View
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderColor: c.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Feather name="truck" size={14} color={c.primary} />
                <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                  Auto-Bestellung wird auf {state.suppliers.length} Lieferanten verteilt
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

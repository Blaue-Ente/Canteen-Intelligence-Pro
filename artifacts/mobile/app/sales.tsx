import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Sales() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [date, setDate] = useState(dateKey(new Date()));
  const [drafts, setDrafts] = useState<Record<string, { cooked: string; sold: string }>>({});

  const todaysMenu = state.menu.find((m) => m.date === date);
  const candidateIds = useMemo(() => {
    if (todaysMenu && todaysMenu.recipeIds.length > 0) return todaysMenu.recipeIds;
    return state.recipes.slice(0, 6).map((r) => r.id);
  }, [todaysMenu, state.recipes]);

  const days = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return dateKey(d);
    });
  }, []);

  const totals = useMemo(() => {
    let cooked = 0;
    let sold = 0;
    let revenue = 0;
    candidateIds.forEach((rid) => {
      const r = state.recipes.find((x) => x.id === rid);
      if (!r) return;
      const d = drafts[rid];
      if (!d) return;
      cooked += Number(d.cooked) || 0;
      sold += Number(d.sold) || 0;
      revenue += (Number(d.sold) || 0) * r.sellPrice;
    });
    return { cooked, sold, revenue };
  }, [drafts, candidateIds, state.recipes]);

  const submit = () => {
    candidateIds.forEach((rid) => {
      const r = state.recipes.find((x) => x.id === rid);
      if (!r) return;
      const d = drafts[rid];
      if (!d || (!d.cooked && !d.sold)) return;
      dispatch({
        type: "addSale",
        sale: {
          id: newId(),
          date,
          recipeId: rid,
          cooked: Number(d.cooked) || 0,
          sold: Number(d.sold) || 0,
          revenue: (Number(d.sold) || 0) * r.sellPrice,
        },
      });
    });
    setDrafts({});
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <SectionHeader title="Tagesabschluss" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {days.map((d) => (
              <Chip key={d} label={d.slice(5)} active={date === d} onPress={() => setDate(d)} />
            ))}
          </ScrollView>
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("cooked")} value={String(totals.cooked)} icon="play-circle" />
          <Stat label={t("sold")} value={String(totals.sold)} icon="check-circle" tone="success" />
          <Stat label={t("revenue")} value={`€${totals.revenue.toFixed(0)}`} icon="trending-up" tone="warning" />
        </View>

        {candidateIds.length === 0 ? (
          <Card>
            <EmptyState icon="book-open" title={t("empty")} body="Keine Karte für diesen Tag." />
          </Card>
        ) : (
          candidateIds.map((rid) => {
            const r = state.recipes.find((x) => x.id === rid);
            if (!r) return null;
            const d = drafts[rid] ?? { cooked: "", sold: "" };
            return (
              <Card key={rid}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="circle" size={16} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {state.locale === "de" ? r.nameDe : r.name}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      €{r.sellPrice.toFixed(2)} · {r.portionGrams}g
                    </Text>
                  </View>
                  <Badge label={t(r.category)} />
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <NumField
                    label={t("cooked")}
                    value={d.cooked}
                    onChange={(v) => setDrafts((s) => ({ ...s, [rid]: { ...d, cooked: v } }))}
                  />
                  <NumField
                    label={t("sold")}
                    value={d.sold}
                    onChange={(v) => setDrafts((s) => ({ ...s, [rid]: { ...d, sold: v } }))}
                  />
                </View>
              </Card>
            );
          })
        )}

        <Button label={t("save")} icon="check" onPress={submit} />
      </ScrollView>
    </View>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  const c = useColors();
  const n = Number(value) || 0;
  return (
    <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: c.radius, padding: 10 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
        <Pressable
          onPress={() => onChange(String(Math.max(0, n - 1)))}
          style={({ pressed }) => [
            { width: 28, height: 28, borderRadius: 8, backgroundColor: c.card, alignItems: "center", justifyContent: "center" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="minus" size={14} color={c.foreground} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={c.mutedForeground}
          style={{
            flex: 1,
            textAlign: "center",
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 18,
            paddingVertical: 0,
          }}
        />
        <Pressable
          onPress={() => onChange(String(n + 1))}
          style={({ pressed }) => [
            { width: 28, height: 28, borderRadius: 8, backgroundColor: c.card, alignItems: "center", justifyContent: "center" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="plus" size={14} color={c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

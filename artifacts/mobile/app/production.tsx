import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { sharePdf } from "@/lib/pdf";
import {
  buildProductionPlan,
  productionSheetHtml,
  STATION_LABEL,
  STATION_ORDER,
  type Station,
} from "@/lib/production";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ProductionScreen() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(todayKey());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const menu = state.menu.find((m) => m.date === date);

  const numericOverrides = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(overrides)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  }, [overrides]);

  const plan = useMemo(
    () => buildProductionPlan(date, menu, state.recipes, state.inventory, numericOverrides),
    [date, menu, state.recipes, state.inventory, numericOverrides],
  );

  const totalLines = plan.flat.reduce((s, b) => s + b.ingredients.length, 0);
  const doneCount = Object.values(done).filter(Boolean).length;

  const exportPdf = async () => {
    if (plan.totalPortions === 0) {
      Alert.alert(
        state.locale === "de" ? "Keine Portionen geplant" : "No portions planned",
        state.locale === "de"
          ? "Bitte trage geplante Portionsmengen ein, bevor du das PDF erstellst."
          : "Please enter planned portion counts before creating the PDF.",
      );
      return;
    }
    setBusy(true);
    try {
      const html = productionSheetHtml(plan, state.locale);
      await sharePdf(html, `production-${date}.pdf`);
    } catch (e) {
      Alert.alert("PDF", e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
          {t("productionTitle")}
        </Text>
        <Pressable
          onPress={exportPdf}
          disabled={busy || plan.totalPortions === 0}
          style={({ pressed }) => [
            {
              backgroundColor: c.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              opacity: busy || plan.totalPortions === 0 ? 0.5 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="printer" size={14} color={c.primaryForeground} />
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            PDF
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 80 }}>
        <Card style={{ gap: 10 }}>
          <Field label={t("date")} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" webType="date" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label={t("portionsPlanned")} value={String(plan.totalPortions)} icon="users" tone="default" />
            <Stat label={t("recipesCount")} value={String(plan.flat.length)} icon="book-open" tone="default" />
            <Stat
              label={t("checked")}
              value={`${doneCount}/${totalLines}`}
              icon="check-square"
              tone={totalLines > 0 && doneCount === totalLines ? "success" : "default"}
            />
          </View>
        </Card>

        {!menu || menu.recipeIds.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t("noMenuForDay")}
            body={state.locale === "de" ? "Erst Menü planen, dann zurückkommen." : "Plan the menu first, then come back."}
          />
        ) : (
          <Card style={{ gap: 10 }}>
            <SectionHeader title={t("plannedCounts")} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              {state.locale === "de"
                ? "Wie viele Portionen sollen heute pro Gericht gekocht werden?"
                : "How many portions should be cooked per dish today?"}
            </Text>
            {menu.recipeIds.map((rid) => {
              const r = state.recipes.find((x) => x.id === rid);
              if (!r) return null;
              const fallback = menu.plannedCount?.[rid] ?? 0;
              return (
                <View
                  key={rid}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {state.locale === "de" ? r.nameDe : r.name}
                  </Text>
                  <TextInput
                    value={overrides[rid] ?? (fallback > 0 ? String(fallback) : "")}
                    onChangeText={(v) => setOverrides((p) => ({ ...p, [rid]: v }))}
                    placeholder={String(fallback || 0)}
                    placeholderTextColor={c.mutedForeground}
                    keyboardType="numeric"
                    style={{
                      width: 82,
                      textAlign: "right",
                      backgroundColor: c.muted,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      color: c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                    }}
                  />
                </View>
              );
            })}
          </Card>
        )}

        {plan.totalPortions > 0 && STATION_ORDER.map((station) => (
          <StationBlock
            key={station}
            station={station}
            batches={plan.byStation[station]}
            done={done}
            setDone={setDone}
            locale={state.locale}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function StationBlock({
  station,
  batches,
  done,
  setDone,
  locale,
}: {
  station: Station;
  batches: ReturnType<typeof buildProductionPlan>["byStation"][Station];
  done: Record<string, boolean>;
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  locale: "de" | "en";
}) {
  const c = useColors();
  const t = useT();
  if (batches.length === 0) return null;
  const label = STATION_LABEL[station][locale === "de" ? "de" : "en"];
  const stationLines = batches.flatMap((b) =>
    b.ingredients.map((ing) => `${b.recipe.id}:${ing.inventoryId}`),
  );
  const stationDone = stationLines.filter((k) => done[k]).length;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
          {label}
        </Text>
        <Badge label={`${stationDone}/${stationLines.length}`} tone={stationDone === stationLines.length ? "success" : "default"} />
      </View>
      {batches.map((b) => (
        <View key={b.recipe.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {locale === "de" ? b.recipe.nameDe : b.recipe.name}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
              × {b.plannedCount} {t("portions")}
            </Text>
          </View>
          {b.ingredients.map((ing) => {
            const k = `${b.recipe.id}:${ing.inventoryId}`;
            const checked = !!done[k];
            return (
              <Pressable
                key={k}
                onPress={() => setDone((p) => ({ ...p, [k]: !p[k] }))}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: checked ? c.success + "1a" : c.muted,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 1.6,
                    borderColor: checked ? c.success : c.border,
                    backgroundColor: checked ? c.success : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {checked ? <Feather name="check" size={13} color="#fff" /> : null}
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: c.foreground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    textDecorationLine: checked ? "line-through" : "none",
                  }}
                >
                  {ing.name}
                </Text>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {formatNum(ing.display.value)} {ing.display.unit}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

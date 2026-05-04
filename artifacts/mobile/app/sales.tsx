import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Returns true if current local time is within the HH:mm window (inclusive). */
function isInWindow(start: string, end: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = (sh ?? 0) * 60 + (sm ?? 0);
  const e = (eh ?? 0) * 60 + (em ?? 0);
  if (s <= e) return cur >= s && cur <= e;
  // overnight window (e.g. 22:00–02:00)
  return cur >= s || cur <= e;
}

export default function Sales() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [date, setDate] = useState(dateKey(new Date()));
  const [drafts, setDrafts] = useState<Record<string, { cooked: string; sold: string; portion: string }>>({});

  const prefs = state.notificationPrefs;
  const isToday = date === dateKey(new Date());
  // Lock: only-add mode when window is enabled AND today is selected AND currently inside window
  const locked =
    prefs.salesWindowEnabled &&
    isToday &&
    isInWindow(prefs.salesWindowStart, prefs.salesWindowEnd);

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

  const author = useAuthor();
  const submit = () => {
    candidateIds.forEach((rid) => {
      const r = state.recipes.find((x) => x.id === rid);
      if (!r) return;
      const d = drafts[rid];
      if (!d || (!d.cooked && !d.sold)) return;
      const portion = Number(d.portion) || r.portionGrams;
      dispatch({
        type: "addSale",
        sale: {
          id: newId(),
          date,
          recipeId: rid,
          cooked: Number(d.cooked) || 0,
          sold: Number(d.sold) || 0,
          revenue: (Number(d.sold) || 0) * r.sellPrice,
          portionGrams: portion,
          source: "manual",
          ...author,
        },
      });
      if (portion !== r.portionGrams) {
        dispatch({ type: "updateRecipe", recipe: { ...r, portionGrams: portion } });
      }
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

        {/* Lock-window banner */}
        {prefs.salesWindowEnabled && isToday && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: locked ? "#fef9c3" : "#f0fdf4",
              borderWidth: 1,
              borderColor: locked ? "#fde047" : "#bbf7d0",
            }}
          >
            <Feather name={locked ? "lock" : "unlock"} size={15} color={locked ? "#a16207" : "#16a34a"} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: locked ? "#a16207" : "#15803d", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {locked
                  ? state.locale === "de"
                    ? "Erfassungsfenster aktiv – nur Erhöhungen möglich"
                    : "Entry window active – additions only"
                  : state.locale === "de"
                    ? `Erfassungsfenster: ${prefs.salesWindowStart} – ${prefs.salesWindowEnd}`
                    : `Entry window: ${prefs.salesWindowStart} – ${prefs.salesWindowEnd}`}
              </Text>
              <Text style={{ color: locked ? "#92400e" : "#166534", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>
                {locked
                  ? state.locale === "de"
                    ? "Bitte keine Stornierungen während des Mittagsservice. Nur hinzufügen erlaubt."
                    : "No reductions during service. You may only add counts."
                  : state.locale === "de"
                    ? "Außerhalb des Fensters: vollständige Bearbeitung möglich."
                    : "Outside window: full editing allowed."}
              </Text>
            </View>
          </View>
        )}

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
            const d = drafts[rid] ?? { cooked: "", sold: "", portion: "" };
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
                      €{r.sellPrice.toFixed(2)} · Standard {r.portionGrams}g
                    </Text>
                  </View>
                  <Badge label={t(r.category)} />
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <NumField
                    label={t("cooked")}
                    value={d.cooked}
                    locked={locked}
                    onChange={(v) => setDrafts((s) => ({ ...s, [rid]: { ...d, cooked: v } }))}
                  />
                  <NumField
                    label={t("sold")}
                    value={d.sold}
                    locked={locked}
                    onChange={(v) => setDrafts((s) => ({ ...s, [rid]: { ...d, sold: v } }))}
                  />
                  <NumField
                    label={t("portion") + " g"}
                    value={d.portion}
                    placeholder={String(r.portionGrams)}
                    step={10}
                    locked={false}
                    onChange={(v) => setDrafts((s) => ({ ...s, [rid]: { ...d, portion: v } }))}
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
  placeholder,
  step = 1,
  locked = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  step?: number;
  locked?: boolean;
}) {
  const c = useColors();
  const n = Number(value) || 0;

  const handleChange = (v: string) => {
    if (locked) {
      // In lock mode: only allow the value to increase
      const next = Number(v) || 0;
      if (next < n) return;
    }
    onChange(v);
  };

  const handleDecrement = () => {
    if (locked) return; // blocked during service window
    onChange(String(Math.max(0, n - step)));
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: locked ? "#fef9c3" : c.muted,
        borderRadius: c.radius,
        padding: 10,
        borderWidth: locked ? 1 : 0,
        borderColor: locked ? "#fde047" : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, flex: 1 }}>
          {label}
        </Text>
        {locked && (
          <Feather name="lock" size={10} color="#a16207" />
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Pressable
          onPress={handleDecrement}
          disabled={locked}
          style={({ pressed }) => [
            {
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: c.card,
              alignItems: "center",
              justifyContent: "center",
              opacity: locked ? 0.3 : 1,
            },
            pressed && !locked && { opacity: 0.7 },
          ]}
        >
          <Feather name="minus" size={14} color={c.foreground} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={handleChange}
          keyboardType="numeric"
          placeholder={placeholder ?? "0"}
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
          onPress={() => onChange(String(n + step))}
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

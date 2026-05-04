import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { CateringEvent, EventStatus } from "@/types";

const ALL_STATUSES: EventStatus[] = [
  "anfrage",
  "angebot",
  "bestaetigt",
  "produktion",
  "abgeschlossen",
  "abgesagt",
];

const STATUS_COLORS: Record<EventStatus, string> = {
  anfrage: "#3b82f6",
  angebot: "#f59e0b",
  bestaetigt: "#22c55e",
  produktion: "#a855f7",
  abgeschlossen: "#6b7280",
  abgesagt: "#ef4444",
};

function calcTotal(ev: CateringEvent): number {
  const food = ev.menuItems.reduce((s, i) => s + i.portions * i.pricePerPortion, 0);
  const sub =
    food + (ev.staffCost ?? 0) + (ev.equipmentCost ?? 0) + (ev.transportCost ?? 0);
  const oh = sub * ((ev.overheadPct ?? 15) / 100);
  return (sub + oh) * (1 + (ev.vatPct ?? 19) / 100);
}

function fmtMoney(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function EventsScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useApp();

  const [filter, setFilter] = useState<EventStatus | "all">("all");

  const statusLabel: Record<EventStatus | "all", string> = {
    all: t("all"),
    anfrage: t("statusAnfrage"),
    angebot: t("statusAngebot"),
    bestaetigt: t("statusBestaetigt"),
    produktion: t("statusProduktion"),
    abgeschlossen: t("statusAbgeschlossen"),
    abgesagt: t("statusAbgesagt"),
  };

  const events = useMemo(() => {
    const list =
      filter === "all"
        ? state.events
        : state.events.filter((e) => e.status === filter);
    return [...list].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [state.events, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 10,
          backgroundColor: c.background,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
            {t("events")}
          </Text>
          <Pressable onPress={() => router.push("/eventdetail?id=new")} style={{ padding: 4 }}>
            <Feather name="plus" size={24} color={c.accent} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(["all", ...ALL_STATUSES] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setFilter(s)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor:
                  filter === s
                    ? s === "all"
                      ? c.accent
                      : STATUS_COLORS[s]
                    : c.muted,
              }}
            >
              <Text
                style={{
                  color: filter === s ? "#fff" : c.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                }}
              >
                {statusLabel[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {events.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Feather name="calendar" size={44} color={c.mutedForeground} />
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
            }}
          >
            {t("noEvents")}
          </Text>
          <Pressable
            onPress={() => router.push("/eventdetail?id=new")}
            style={{
              marginTop: 4,
              backgroundColor: c.accent,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {t("newEvent")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <Card style={{ padding: 14 }}>
              <Pressable onPress={() => router.push(`/eventdetail?id=${item.id}`)}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_700Bold",
                        fontSize: 16,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                      }}
                    >
                      {item.clientName}
                    </Text>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                      }}
                    >
                      {fmtDate(item.eventDate)}
                      {item.eventTime ? " · " + item.eventTime : ""}
                      {" · "}
                      {item.guestCount} {t("guestCount")}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <View
                      style={{
                        backgroundColor: STATUS_COLORS[item.status] + "22",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: STATUS_COLORS[item.status],
                      }}
                    >
                      <Text
                        style={{
                          color: STATUS_COLORS[item.status],
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 11,
                        }}
                      >
                        {statusLabel[item.status]}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: c.accent,
                        fontFamily: "Inter_700Bold",
                        fontSize: 15,
                      }}
                    >
                      €{fmtMoney(calcTotal(item))}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Card>
          )}
        />
      )}
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { CateringEvent, EventStatus } from "@/types";

function calcGrandTotal(ev: CateringEvent): number {
  const foodCost = ev.menuItems.reduce((s, i) => s + i.portions * i.pricePerPortion, 0);
  const staffCost = ev.staffCost ?? 0;
  const equipmentCost = ev.equipmentCost ?? 0;
  const transportCost = ev.transportCost ?? 0;
  const overheadPct = ev.overheadPct ?? 15;
  const vatPct = ev.vatPct ?? 19;
  const sub = foodCost + staffCost + equipmentCost + transportCost;
  const overhead = sub * (overheadPct / 100);
  const withOverhead = sub + overhead;
  return withOverhead * (1 + vatPct / 100);
}

interface ClientGroup {
  key: string;
  name: string;
  email?: string;
  phone?: string;
  events: CateringEvent[];
  totalRevenue: number;
  lastEventDate: string;
  unpaidInvoices: number;
}

const STATUS_DOT: Record<EventStatus, string> = {
  anfrage: "#3b82f6",
  angebot: "#f59e0b",
  bestaetigt: "#22c55e",
  produktion: "#a855f7",
  abgeschlossen: "#6b7280",
  abgesagt: "#ef4444",
};

export default function CRMScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useApp();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const clients = useMemo<ClientGroup[]>(() => {
    const map = new Map<string, ClientGroup>();
    for (const ev of state.events) {
      const key = ev.clientEmail?.toLowerCase() || ev.clientName.toLowerCase();
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          name: ev.clientName,
          email: ev.clientEmail,
          phone: ev.clientPhone,
          events: [],
          totalRevenue: 0,
          lastEventDate: ev.eventDate,
          unpaidInvoices: 0,
        };
        map.set(key, group);
      }
      group.events.push(ev);
      group.totalRevenue += calcGrandTotal(ev);
      if (ev.eventDate > group.lastEventDate) group.lastEventDate = ev.eventDate;
      if (ev.invoiceNo && !ev.invoicePaid) group.unpaidInvoices++;
    }
    const list = Array.from(map.values());
    list.sort((a, b) => b.lastEventDate.localeCompare(a.lastEventDate));
    return list;
  }, [state.events]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase() ?? "").includes(q),
    );
  }, [clients, search]);

  const fmt = state.locale === "de" ? "de-DE" : "en-GB";

  const statusLabel: Record<EventStatus, string> = {
    anfrage: t("statusAnfrage"),
    angebot: t("statusAngebot"),
    bestaetigt: t("statusBestaetigt"),
    produktion: t("statusProduktion"),
    abgeschlossen: t("statusAbgeschlossen"),
    abgesagt: t("statusAbgesagt"),
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
          gap: 10,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            {t("crm")}
          </Text>
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.muted,
            borderRadius: 10,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Feather name="search" size={16} color={c.mutedForeground} />
          <Text
            onPress={() => {}}
            style={{ flex: 1, color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 10 }}
            suppressHighlighting
          >
            {search || (
              <Text style={{ color: c.mutedForeground }}>
                {state.locale === "de" ? "Kunden suchen…" : "Search clients…"}
              </Text>
            )}
          </Text>
        </View>

        {/* Stats bar */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: 10, padding: 12, alignItems: "center" }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>{clients.length}</Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
              {state.locale === "de" ? "Kunden" : "Clients"}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: 10, padding: 12, alignItems: "center" }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>{state.events.length}</Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
              {t("eventsCount")}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: 10, padding: 12, alignItems: "center" }}>
            <Text style={{ color: c.accent, fontFamily: "Inter_700Bold", fontSize: 16 }}>
              €{clients.reduce((s, cl) => s + cl.totalRevenue, 0).toLocaleString(fmt, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
              {t("totalRevenue")}
            </Text>
          </View>
        </View>

        {/* Client list */}
        {filtered.length === 0 ? (
          <Text style={{ color: c.mutedForeground, textAlign: "center", padding: 32, fontFamily: "Inter_400Regular" }}>
            {t("noClients")}
          </Text>
        ) : (
          filtered.map((cl) => (
            <Card key={cl.key} style={{ padding: 0, overflow: "hidden" }}>
              {/* Client header row */}
              <Pressable
                onPress={() => setExpanded(expanded === cl.key ? null : cl.key)}
                style={{ padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.accent + "22",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: c.accent, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {cl.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {cl.name}
                  </Text>
                  {cl.email ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {cl.email}
                    </Text>
                  ) : null}
                  {cl.phone ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {cl.phone}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {cl.events.length} {t("eventsCount")}
                    </Text>
                    <Text style={{ color: c.accent, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      €{cl.totalRevenue.toLocaleString(fmt, { maximumFractionDigits: 0 })} {t("totalRevenue").toLowerCase()}
                    </Text>
                    {cl.unpaidInvoices > 0 && (
                      <Text style={{ color: "#ef4444", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        {cl.unpaidInvoices} {state.locale === "de" ? "offen" : "unpaid"}
                      </Text>
                    )}
                  </View>
                </View>

                <Feather
                  name={expanded === cl.key ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={c.mutedForeground}
                />
              </Pressable>

              {/* Expanded events list */}
              {expanded === cl.key && (
                <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
                  {cl.events
                    .slice()
                    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
                    .map((ev) => (
                      <Pressable
                        key={ev.id}
                        onPress={() => router.push(`/eventdetail?id=${ev.id}` as never)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: c.border,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: STATUS_DOT[ev.status],
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                            {ev.title}
                          </Text>
                          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                            {new Date(ev.eventDate).toLocaleDateString(fmt)} · {ev.guestCount}{" "}
                            {state.locale === "de" ? "Gäste" : "guests"} · {statusLabel[ev.status]}
                          </Text>
                        </View>
                        {ev.invoiceNo ? (
                          <View
                            style={{
                              backgroundColor: ev.invoicePaid ? "#dcfce7" : "#fef9c3",
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                color: ev.invoicePaid ? "#16a34a" : "#92400e",
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 10,
                              }}
                            >
                              {ev.invoicePaid ? (state.locale === "de" ? "Bezahlt" : "Paid") : ev.invoiceNo}
                            </Text>
                          </View>
                        ) : null}
                        <Feather name="chevron-right" size={14} color={c.mutedForeground} />
                      </Pressable>
                    ))}
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

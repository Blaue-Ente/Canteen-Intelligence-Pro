import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface AggregateItem {
  dishId: string;
  name: string;
  qty: number;
}

interface AggregateCustomer {
  customerName: string;
  customerId: string | null;
  items: AggregateItem[];
  total: number;
  orderIds: string[];
}

interface AggregateResponse {
  date: string;
  locationCode: string;
  currency: string;
  totalsByDish: AggregateItem[];
  byCustomer: AggregateCustomer[];
  grandTotal: number;
}

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AggregateScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useApp();

  const initialCode = useMemo(() => {
    const cur = state.currentLocationId
      ? state.locations.find((l) => l.id === state.currentLocationId)
      : state.locations.find((l) => l.isPrimary) ?? state.locations[0];
    return (cur?.code ?? "DEMO").toUpperCase();
  }, [state.locations, state.currentLocationId]);

  const [locationCode, setLocationCode] = useState(initialCode);
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await apiFetch<AggregateResponse>(
        `/api/preorder/staff/orders/aggregate?locationCode=${encodeURIComponent(locationCode.trim().toUpperCase())}&date=${encodeURIComponent(date)}`,
      );
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [locationCode, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        <SectionHeader title={t("dailyAggregate")} />
        <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: -8 }}>
          {t("dailyAggregateDesc")}
        </Text>

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                {t("locationCode")}
              </Text>
              <TextInput
                value={locationCode}
                onChangeText={(v) => setLocationCode(v.toUpperCase())}
                autoCapitalize="characters"
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  color: c.foreground,
                  fontFamily: "Inter_500Medium",
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                {t("date")}
              </Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  color: c.foreground,
                  fontFamily: "Inter_500Medium",
                }}
              />
            </View>
          </View>
        </Card>

        {loading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : error ? (
          <Card>
            <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>{error}</Text>
          </Card>
        ) : !data || data.byCustomer.length === 0 ? (
          <EmptyState icon="inbox" title={t("noOrdersForDay")} />
        ) : (
          <>
            <Card style={{ gap: 8 }}>
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                }}
              >
                {t("totalsByDish")}
              </Text>
              {data.totalsByDish.map((d) => (
                <View
                  key={d.dishId}
                  style={{ flexDirection: "row", justifyContent: "space-between" }}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium" }}>
                    {d.name}
                  </Text>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" }}>
                    {d.qty}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" }}>
                  {t("totals")}
                </Text>
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold" }}>
                  {data.currency} {data.grandTotal.toFixed(2)}
                </Text>
              </View>
            </Card>

            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginTop: 4,
              }}
            >
              {t("byCustomer")}
            </Text>

            {data.byCustomer.map((cu, idx) => (
              <Card key={`${cu.customerId ?? "guest"}-${idx}`} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text
                    style={{
                      color: c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 15,
                    }}
                  >
                    {cu.customerName}
                  </Text>
                  <Badge
                    label={`${data.currency} ${cu.total.toFixed(2)}`}
                    tone="default"
                  />
                </View>
                {cu.items.map((it) => (
                  <View
                    key={it.dishId}
                    style={{ flexDirection: "row", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: c.foreground }}>
                      <Text style={{ fontFamily: "Inter_700Bold" }}>{it.qty}× </Text>
                      {it.name}
                    </Text>
                  </View>
                ))}
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                  {cu.orderIds.length} {cu.orderIds.length === 1 ? t("order") : t("ordersCount")}
                </Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

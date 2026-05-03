import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface FeedbackAggregate {
  count: number;
  avgFoodQuality: number;
  avgService: number;
  avgVariety: number;
  avgValue: number;
  avgCleanliness: number;
  avgAmbience: number;
  avgOverall: number;
}

interface LocationRollup {
  locationCode: string;
  locationName: string;
  currency: string;
  ordersCount: number;
  revenue: number;
  avgTicket: number;
  statusBreakdown: Record<string, number>;
  feedback: FeedbackAggregate;
  publishedAt: string | null;
}

const RANGES: Array<{ days: number; label: string }> = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export default function RollupScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [days, setDays] = useState(7);
  const [data, setData] = useState<LocationRollup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<LocationRollup[]>(`/api/rollup/locations?days=${d}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(days);
  }, [days]);

  const fmtMoney = (n: number, cur = "EUR") =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: cur }).format(n);

  const totalRevenue = (data ?? []).reduce((s, r) => s + r.revenue, 0);
  const totalOrders = (data ?? []).reduce((s, r) => s + r.ordersCount, 0);
  const totalFeedback = (data ?? []).reduce((s, r) => s + r.feedback.count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 14,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 80,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 22,
            }}
          >
            {t("multiLocationRollup")}
          </Text>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
            }}
          >
            {t("multiLocationRollupDesc")}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {RANGES.map((r) => {
            const active = days === r.days;
            return (
              <Pressable
                key={r.days}
                onPress={() => setDays(r.days)}
                style={{
                  flex: 1,
                  backgroundColor: active ? c.primary : c.muted,
                  paddingVertical: 8,
                  borderRadius: c.radius,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? c.primaryForeground : c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Card>
            <Text style={{ color: "#ef4444", fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {error}
            </Text>
          </Card>
        ) : null}

        <Card>
          <SectionHeader title={t("totals")} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Stat label={t("revenue")} value={fmtMoney(totalRevenue)} />
            <Stat label={t("ordersCount")} value={String(totalOrders)} />
            <Stat label={t("ratings")} value={String(totalFeedback)} />
          </View>
        </Card>

        {data == null && loading ? (
          <Card>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {t("loading")}…
            </Text>
          </Card>
        ) : null}

        {data && data.length === 0 ? (
          <Card>
            <EmptyState
              icon="map-pin"
              title={t("noLocationsYet")}
              body={t("multiLocationRollupDesc")}
            />
          </Card>
        ) : null}

        {(data ?? []).map((loc) => (
          <LocationCard key={loc.locationCode} loc={loc} fmtMoney={fmtMoney} t={t} />
        ))}
      </ScrollView>
    </View>
  );
}

function LocationCard({
  loc,
  fmtMoney,
  t,
}: {
  loc: LocationRollup;
  fmtMoney: (n: number, cur?: string) => string;
  t: (k: never) => string;
}) {
  const c = useColors();
  const fb = loc.feedback;
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 17,
            flex: 1,
          }}
        >
          {loc.locationName}
        </Text>
        <Badge label={loc.locationCode} tone="default" />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat label={t("revenue" as never)} value={fmtMoney(loc.revenue, loc.currency)} />
        <Stat label={t("ordersCount" as never)} value={String(loc.ordersCount)} />
        <Stat
          label={t("avgTicket" as never)}
          value={loc.ordersCount > 0 ? fmtMoney(loc.avgTicket, loc.currency) : "–"}
        />
      </View>

      {Object.keys(loc.statusBreakdown).length > 0 ? (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {Object.entries(loc.statusBreakdown).map(([k, v]) => (
            <View
              key={k}
              style={{
                backgroundColor: c.muted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                }}
              >
                {k}: {v}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Feather name="star" size={14} color={c.primary} />
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
          }}
        >
          {t("ratings" as never)} ({fb.count})
        </Text>
        {fb.count > 0 ? (
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              marginLeft: "auto",
            }}
          >
            ⌀ {fb.avgOverall.toFixed(1)} / 5
          </Text>
        ) : null}
      </View>

      {fb.count === 0 ? (
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12,
          }}
        >
          {t("noRatings" as never)}
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          <RatingBar label={t("foodQuality" as never)} value={fb.avgFoodQuality} />
          <RatingBar label={t("service" as never)} value={fb.avgService} />
          <RatingBar label={t("variety" as never)} value={fb.avgVariety} />
          <RatingBar label={t("value" as never)} value={fb.avgValue} />
          <RatingBar label={t("cleanliness" as never)} value={fb.avgCleanliness} />
          <RatingBar label={t("ambience" as never)} value={fb.avgAmbience} />
        </View>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.muted,
        borderRadius: c.radius,
        padding: 10,
      }}
    >
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 16,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value / 5));
  const color = value >= 4 ? "#16a34a" : value >= 3 ? "#eab308" : "#ef4444";
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_500Medium",
            fontSize: 12,
            flex: 1,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 12,
          }}
        >
          {value.toFixed(1)}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: c.muted,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

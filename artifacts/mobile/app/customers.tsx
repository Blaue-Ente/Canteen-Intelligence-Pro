import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

type AccountType = "regular" | "business_pending" | "business_approved" | "rejected";

interface CustomerProfile {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  homeLocationCode: string | null;
  accountType: AccountType;
  ownerOrgId: string | null;
  createdAt: string;
  updatedAt: string;
}

const TABS: { key: "business_pending" | "business_approved" | "rejected"; labelKey: "pendingBusiness" | "approvedBusiness" | "rejected" }[] = [
  { key: "business_pending", labelKey: "pendingBusiness" },
  { key: "business_approved", labelKey: "approvedBusiness" },
  { key: "rejected", labelKey: "rejected" },
];

export default function CustomersScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("business_pending");
  const [rows, setRows] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (status: typeof tab) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<CustomerProfile[]>(
          `/api/preorder/staff/customers?status=${encodeURIComponent(status)}`,
        );
        setRows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const decide = async (row: CustomerProfile, decision: "approve" | "reject") => {
    setBusyId(row.clerkUserId);
    try {
      await apiFetch(`/api/preorder/staff/customers/${encodeURIComponent(row.clerkUserId)}`, {
        method: "PATCH",
        body: { decision },
      });
      await load(tab);
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

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
        <SectionHeader title={t("customers")} />
        <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: -8 }}>
          {t("customersDesc")}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tabDef) => {
            const active = tab === tabDef.key;
            return (
              <Pressable
                key={tabDef.key}
                onPress={() => setTab(tabDef.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? c.primary : c.muted,
                }}
              >
                <Text
                  style={{
                    color: active ? c.primaryForeground : c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {t(tabDef.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : error ? (
          /* Friendly auth-aware error: 401 → sign-in card; everything else → raw msg.
             Avoids dumping "401 Unauthorized" at the user when they're simply signed out. */
          /401|unauthor/i.test(error) ? (
            <Card style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
              <Feather name="lock" size={28} color={c.mutedForeground} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {t("authRequiredTitle")}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
                {t("authRequiredBody")}
              </Text>
            </Card>
          ) : (
            <Card>
              <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>{error}</Text>
            </Card>
          )
        ) : rows.length === 0 ? (
          <EmptyState
            icon="users"
            title={t("noCustomers")}
            body={tab === "business_pending" ? t("noPendingCustomers") : undefined}
          />
        ) : (
          rows.map((row) => (
            <Card key={row.clerkUserId} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                    }}
                  >
                    {row.displayName}
                  </Text>
                  {row.email ? (
                    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{row.email}</Text>
                  ) : null}
                  {row.homeLocationCode ? (
                    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                      <Feather name="map-pin" size={11} /> {row.homeLocationCode}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={row.accountType.replace("_", " ")}
                  tone={
                    row.accountType === "business_approved"
                      ? "success"
                      : row.accountType === "rejected"
                        ? "destructive"
                        : "warning"
                  }
                />
              </View>
              {tab === "business_pending" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    label={t("approve")}
                    onPress={() => decide(row, "approve")}
                    disabled={busyId === row.clerkUserId}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t("reject")}
                    variant="secondary"
                    onPress={() => decide(row, "reject")}
                    disabled={busyId === row.clerkUserId}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface PreorderDish {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  type?: string | null;
  allergens: string[];
  imageUrl?: string | null;
  kcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  dge?: "green" | "amber" | "red" | null;
  co2eG?: number | null;
}

interface PublishedMenu {
  locationCode: string;
  locationName: string;
  currency: string;
  dishes: PreorderDish[];
  publishedAt: string;
}

type GuestStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "cancelled";

interface OrderItem {
  dishId: string;
  name: string;
  qty: number;
  price: number;
}

interface GuestOrder {
  id: string;
  locationCode: string;
  guestName: string;
  guestNote?: string | null;
  items: OrderItem[];
  total: number;
  currency: string;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FLOW: GuestStatus[] = ["new", "accepted", "preparing", "ready", "served"];

export default function PreorderScreen() {
  const { state } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const currentLocation = useMemo(
    () =>
      state.currentLocationId
        ? state.locations.find((l) => l.id === state.currentLocationId)
        : state.locations.find((l) => l.isPrimary) ?? state.locations[0],
    [state.locations, state.currentLocationId],
  );

  const [locationCode, setLocationCode] = useState<string>(
    () => (currentLocation?.code ?? "DEMO").toUpperCase(),
  );
  const [locationName, setLocationName] = useState<string>(
    () => currentLocation?.name ?? "KItchenOS Demo Mensa",
  );
  const [publishedMenu, setPublishedMenu] = useState<PublishedMenu | null>(null);
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [busy, setBusy] = useState<"publish" | "fetch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Build dish payload from today's planned menu (or all recipes as fallback).
  const todaysDishes = useMemo<PreorderDish[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = state.menu.find((m) => m.date === today);
    const recipeIds = todayEntry?.recipeIds?.length
      ? todayEntry.recipeIds
      : state.recipes.slice(0, 6).map((r) => r.id);
    return recipeIds
      .map((rid) => state.recipes.find((r) => r.id === rid))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const kcal = r.kcalPerPortion ?? null;
        // Naive macro split from kcal when not present (40% carbs, 30% protein, 30% fat).
        const proteinG = kcal ? Math.round((kcal * 0.3) / 4) : null;
        const carbsG = kcal ? Math.round((kcal * 0.4) / 4) : null;
        const fatG = kcal ? Math.round((kcal * 0.3) / 9) : null;
        const dge: "green" | "amber" | "red" =
          r.category === "vegan" || r.category === "vegetarian"
            ? "green"
            : r.meat === "beef" || r.meat === "lamb"
              ? "red"
              : "amber";
        return {
          id: r.id,
          name: r.nameDe || r.name,
          description: r.steps[0] ?? r.stepsDe[0] ?? null,
          price: r.sellPrice || r.basePrice * 2.8,
          type: r.type,
          allergens: r.allergens,
          imageUrl: r.imageUrl ?? null,
          kcal,
          proteinG,
          carbsG,
          fatG,
          dge,
          co2eG: null,
        };
      });
  }, [state.menu, state.recipes]);

  const guestUrl = useMemo(() => {
    const domains = (process.env.EXPO_PUBLIC_DOMAIN ?? "").split(",").filter(Boolean);
    const host = domains[0] ?? "preview";
    return `https://${host}/preorder/?loc=${encodeURIComponent(locationCode)}`;
  }, [locationCode]);

  const fetchData = async () => {
    if (!locationCode) return;
    setError(null);
    try {
      const [menu, list] = await Promise.all([
        apiFetch<PublishedMenu>(`/api/preorder/menu/${encodeURIComponent(locationCode)}`).catch(
          () => null,
        ),
        apiFetch<GuestOrder[]>(
          `/api/preorder/staff/orders?locationCode=${encodeURIComponent(locationCode)}`,
        ).catch(() => [] as GuestOrder[]),
      ]);
      setPublishedMenu(menu);
      setOrders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationCode]);

  const handlePublish = async () => {
    if (!locationCode || todaysDishes.length === 0) {
      Alert.alert(
        t("publishMenu"),
        todaysDishes.length === 0 ? t("noGuestOrders") : "Standortcode fehlt",
      );
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      const res = await apiFetch<PublishedMenu>("/api/preorder/menu/publish", {
        method: "POST",
        body: {
          locationCode,
          locationName,
          currency: "EUR",
          dishes: todaysDishes,
        },
      });
      setPublishedMenu(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleSetStatus = async (id: string, status: GuestStatus) => {
    try {
      const updated = await apiFetch<GuestOrder>(`/api/preorder/orders/${id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setOrders((prev) =>
        prev
          .map((o) => (o.id === id ? updated : o))
          .filter((o) => o.status !== "served" && o.status !== "cancelled"),
      );
    } catch (e) {
      Alert.alert("Status", e instanceof Error ? e.message : String(e));
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fmtMoney = (n: number, currency = "EUR") =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(n);

  const statusColor = (s: GuestStatus): string => {
    if (s === "ready") return "#10b981";
    if (s === "preparing") return "#f59e0b";
    if (s === "accepted") return "#3b82f6";
    if (s === "cancelled") return c.mutedForeground;
    return c.primary;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 14,
          paddingTop: Platform.OS === "web" ? 16 : insets.top + 8,
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
            {t("preorderTitle")}
          </Text>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
            }}
          >
            {t("preorderDesc")}
          </Text>
        </View>

        {error ? (
          <Card>
            <Text style={{ color: "#ef4444", fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {error}
            </Text>
          </Card>
        ) : null}

        <Card>
          <SectionHeader title={t("locationCode")} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={t("locationCode")}
                value={locationCode}
                onChangeText={(v) => setLocationCode(v.toUpperCase().replace(/\s/g, ""))}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Field
                label={t("name")}
                value={locationName}
                onChangeText={setLocationName}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              variant="primary"
              onPress={handlePublish}
              disabled={busy === "publish"}
              icon="upload-cloud"
              label={busy === "publish" ? "…" : t("publishMenu")}
            />
            <Button
              variant="secondary"
              onPress={() => void fetchData()}
              icon="refresh-cw"
              label="Refresh"
            />
          </View>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {t("publishDescription")}
          </Text>
          <View style={{ marginTop: 8 }}>
            {publishedMenu ? (
              <Badge
                tone="success"
                label={`${t("publishedAt")} · ${new Date(publishedMenu.publishedAt).toLocaleString("de-DE")} · ${publishedMenu.dishes.length} ${t("recipes")}`}
              />
            ) : (
              <Badge tone="default" label={t("notPublishedYet")} />
            )}
          </View>
        </Card>

        <Card>
          <SectionHeader title={t("qrLink")} />
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <View style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8 }}>
              <QRCode value={guestUrl} size={180} />
            </View>
          </View>
          <Pressable
            onPress={() => void copyLink()}
            style={{
              backgroundColor: c.muted,
              padding: 10,
              borderRadius: c.radius,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
            }}
          >
            <Feather name={copied ? "check" : "link"} size={16} color={c.foreground} />
            <Text
              numberOfLines={1}
              style={{
                color: c.foreground,
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                flex: 1,
              }}
            >
              {guestUrl}
            </Text>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_500Medium",
                fontSize: 11,
              }}
            >
              {copied ? t("copied") : t("copyLink")}
            </Text>
          </Pressable>
        </Card>

        <Card>
          <SectionHeader title={`${t("guestOrders")} (${orders.length})`} />
          {orders.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={t("noGuestOrders")}
              body={t("preorderDesc")}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {orders.map((o) => {
                const nextIdx = STATUS_FLOW.indexOf(o.status) + 1;
                const next = STATUS_FLOW[nextIdx] as GuestStatus | undefined;
                return (
                  <View
                    key={o.id}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_700Bold",
                          fontSize: 15,
                          flex: 1,
                        }}
                      >
                        {o.guestName}
                      </Text>
                      <View
                        style={{
                          backgroundColor: statusColor(o.status),
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 11,
                          }}
                        >
                          {t(("status" + o.status[0]!.toUpperCase() + o.status.slice(1)) as never) ??
                            o.status}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: 2 }}>
                      {o.items.map((it, idx) => (
                        <Text
                          key={idx}
                          style={{
                            color: c.foreground,
                            fontFamily: "Inter_400Regular",
                            fontSize: 13,
                          }}
                        >
                          {it.qty}× {it.name} — {fmtMoney(it.price * it.qty, o.currency)}
                        </Text>
                      ))}
                    </View>
                    {o.guestNote ? (
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        „{o.guestNote}“
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          flex: 1,
                        }}
                      >
                        {fmtMoney(o.total, o.currency)} ·{" "}
                        {new Date(o.createdAt).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      {next ? (
                        <Pressable
                          onPress={() => void handleSetStatus(o.id, next)}
                          style={{
                            backgroundColor: c.primary,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: c.radius,
                          }}
                        >
                          <Text
                            style={{
                              color: c.primaryForeground,
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 12,
                            }}
                          >
                            →{" "}
                            {t(("status" + next[0]!.toUpperCase() + next.slice(1)) as never) ??
                              next}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

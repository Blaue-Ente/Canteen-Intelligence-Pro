import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as Notifications from "expo-notifications";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Badge, Button, Card, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { pushAlertBus } from "@/lib/pushAlertBus";
import { updatePreorderCache } from "@/lib/kios";

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
  wantedFor?: string | null;
  items: OrderItem[];
  total: number;
  currency: string;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FLOW: GuestStatus[] = ["new", "accepted", "preparing", "ready", "served"];

// ─── KW Menu types ────────────────────────────────────────────────────────────

interface WeeklyMenuDishRow {
  id: string;
  name: string;
  description?: string | null;
  dishType: string;
  menuDate: string; // YYYY-MM-DD
  price: number;
  allergens: string[];
  kcal?: number | null;
  dge?: "green" | "amber" | "red" | null;
}

interface WeeklyMenuRecord {
  id: string;
  locationCode: string;
  menuSlot: string;
  kwYear: number;
  kwNumber: number;
  validFrom: string;
  validTo: string;
  currency: string;
  dishes: WeeklyMenuDishRow[];
  createdAt: string;
}

const MENU_SLOTS = ["Menü 1", "Menü 2", "Menü 3", "Menü 4", "Menü 5", "Menü 6"];
const DISH_TYPES_SHORT = ["Hauptgericht 1", "Hauptgericht 2", "Suppe", "Dessert", "Beilage", "Salat"];

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - startOfYear.getTime()) / 86400000) + 1) / 7);
  return { year, week };
}

function getMondayOfKW(kwYear: number, kwNumber: number): Date {
  const jan4 = new Date(Date.UTC(kwYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000 + (kwNumber - 1) * 7 * 86400000);
  return monday;
}

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr"];

// ─── KW Menu sub-component ────────────────────────────────────────────────────

function KWMenuSection({ locationCode, c }: { locationCode: string; c: ReturnType<typeof useColors> }) {
  const router = useRouter();
  const [menus, setMenus] = useState<WeeklyMenuRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const { year: curYear, week: curWeek } = getISOWeek(new Date());
  const [kwYear, setKwYear] = useState(curYear);
  const [kwNumber, setKwNumber] = useState(curWeek);

  const load = useCallback(async () => {
    if (!locationCode) return;
    setLoading(true);
    try {
      const data = await apiFetch<WeeklyMenuRecord[]>(
        `/api/preorder/staff/weekly-menus?locationCode=${encodeURIComponent(locationCode)}&kwYear=${kwYear}&kwNumber=${kwNumber}`,
      );
      setMenus(data);
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [locationCode, kwYear, kwNumber]);

  useEffect(() => { void load(); }, [load]);

  const monday = getMondayOfKW(kwYear, kwNumber);
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return d.toISOString().slice(0, 10);
  });

  const [newDishType, setNewDishType] = useState(DISH_TYPES_SHORT[0]!);
  const [newDishName, setNewDishName] = useState("");
  const [newDishDate, setNewDishDate] = useState(weekDates[0]!);
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newMenuSlot, setNewMenuSlot] = useState(MENU_SLOTS[0]!);
  const [creating, setCreating] = useState(false);

  const createMenu = async () => {
    if (!newDishName.trim()) { Alert.alert("Fehler", "Bitte mindestens einen Gericht-Namen eingeben."); return; }
    const priceNum = parseFloat(newDishPrice.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert("Fehler", "Bitte einen gültigen Preis eingeben."); return; }
    setCreating(true);
    try {
      await apiFetch("/api/preorder/staff/weekly-menus", {
        method: "POST",
        body: {
          locationCode,
          menuSlot: newMenuSlot,
          kwYear,
          kwNumber,
          validFrom: weekDates[0],
          validTo: weekDates[4],
          currency: "EUR",
          dishes: [{
            id: Math.random().toString(36).slice(2),
            name: newDishName.trim(),
            dishType: newDishType,
            menuDate: newDishDate,
            price: priceNum,
            allergens: [],
          }],
        },
      });
      setNewDishName("");
      setNewDishPrice("");
      await load();
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const deleteMenu = (id: string) => {
    Alert.alert("Löschen?", "Dieses Wochemenü endgültig löschen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/preorder/staff/weekly-menus/${encodeURIComponent(id)}`, { method: "DELETE" });
            await load();
          } catch (e) {
            Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const inputStyle = {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    padding: 10, color: c.foreground, backgroundColor: c.card,
    fontFamily: "Inter_400Regular" as const, fontSize: 14,
  };
  const labelStyle = { color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" as const, marginBottom: 4 };

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="Wochenmenu (KW)" />
        <Pressable
          onPress={() => router.push("/delivery-report")}
          style={{
            flexDirection: "row", alignItems: "center", gap: 4,
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.muted,
          }}
        >
          <Feather name="bar-chart-2" size={13} color={c.primary} />
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" as const, fontSize: 12 }}>Lieferbericht</Text>
        </Pressable>
      </View>

      {/* KW navigator */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => {
            if (kwNumber === 1) { setKwYear(kwYear - 1); setKwNumber(52); }
            else setKwNumber(kwNumber - 1);
          }}
          style={{ padding: 8, borderRadius: 8, backgroundColor: c.muted }}
        >
          <Feather name="chevron-left" size={16} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" as const, fontSize: 15 }}>
            KW {kwNumber} / {kwYear}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
            {weekDates[0]?.split("-").reverse().slice(0, 2).join(".")} – {weekDates[4]?.split("-").reverse().slice(0, 2).join(".")}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (kwNumber >= 52) { setKwYear(kwYear + 1); setKwNumber(1); }
            else setKwNumber(kwNumber + 1);
          }}
          style={{ padding: 8, borderRadius: 8, backgroundColor: c.muted }}
        >
          <Feather name="chevron-right" size={16} color={c.foreground} />
        </Pressable>
      </View>

      {/* Existing menus for this KW */}
      {loading ? (
        <ActivityIndicator color={c.primary} />
      ) : menus.length === 0 ? (
        <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: "center" }}>
          Kein Wochenmenu für KW {kwNumber} hinterlegt.
        </Text>
      ) : (
        menus.map((menu) => (
          <View key={menu.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: "hidden" }}>
            <View style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              backgroundColor: c.muted, paddingHorizontal: 12, paddingVertical: 8,
            }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" as const, fontSize: 14 }}>
                {menu.menuSlot}
              </Text>
              <Pressable onPress={() => deleteMenu(menu.id)} hitSlop={10} style={{ padding: 4 }}>
                <Feather name="trash-2" size={15} color={c.destructive} />
              </Pressable>
            </View>
            {menu.dishes.map((dish, i) => {
              const dayIdx = weekDates.indexOf(dish.menuDate);
              return (
                <View key={i} style={{
                  flexDirection: "row", justifyContent: "space-between",
                  paddingHorizontal: 12, paddingVertical: 8,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.border,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                      {dayIdx >= 0 ? WEEKDAYS_DE[dayIdx] : dish.menuDate} · {dish.dishType}
                    </Text>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium" as const, fontSize: 13 }}>{dish.name}</Text>
                  </View>
                  <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" as const, fontSize: 14 }}>
                    {dish.price.toFixed(2).replace(".", ",")} €
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* Add new dish / menu entry */}
      <View style={{ gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" as const, fontSize: 14 }}>
          Gericht hinzufügen
        </Text>

        {/* Menu slot */}
        <View style={{ gap: 4 }}>
          <Text style={labelStyle}>Menü-Slot</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {MENU_SLOTS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setNewMenuSlot(s)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: newMenuSlot === s ? c.primary : c.muted,
                  borderWidth: 1, borderColor: newMenuSlot === s ? c.primary : c.border,
                }}
              >
                <Text style={{ color: newMenuSlot === s ? c.primaryForeground : c.foreground, fontSize: 12, fontFamily: "Inter_500Medium" as const }}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Dish type */}
        <View style={{ gap: 4 }}>
          <Text style={labelStyle}>Kategorie</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {DISH_TYPES_SHORT.map((dt) => (
              <Pressable
                key={dt}
                onPress={() => setNewDishType(dt)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: newDishType === dt ? c.primary : c.muted,
                  borderWidth: 1, borderColor: newDishType === dt ? c.primary : c.border,
                }}
              >
                <Text style={{ color: newDishType === dt ? c.primaryForeground : c.foreground, fontSize: 12, fontFamily: "Inter_500Medium" as const }}>
                  {dt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Weekday picker */}
        <View style={{ gap: 4 }}>
          <Text style={labelStyle}>Liefertag</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {weekDates.map((d, i) => (
              <Pressable
                key={d}
                onPress={() => setNewDishDate(d)}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
                  backgroundColor: newDishDate === d ? c.primary : c.muted,
                  borderWidth: 1, borderColor: newDishDate === d ? c.primary : c.border,
                }}
              >
                <Text style={{ color: newDishDate === d ? c.primaryForeground : c.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" as const }}>
                  {WEEKDAYS_DE[i]}
                </Text>
                <Text style={{ color: newDishDate === d ? c.primaryForeground : c.foreground, fontSize: 11, fontFamily: "Inter_600SemiBold" as const }}>
                  {d.slice(8)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={labelStyle}>Gerichts-Name *</Text>
          <TextInput
            style={inputStyle}
            value={newDishName}
            onChangeText={setNewDishName}
            placeholder="z.B. Hähnchen mit Kartoffeln"
            placeholderTextColor={c.mutedForeground}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text style={labelStyle}>Preis (€) *</Text>
          <TextInput
            style={inputStyle}
            value={newDishPrice}
            onChangeText={setNewDishPrice}
            keyboardType="decimal-pad"
            placeholder="z.B. 8,50"
            placeholderTextColor={c.mutedForeground}
          />
        </View>

        <Button
          label={creating ? "Hinzufügen…" : "Gericht speichern"}
          onPress={createMenu}
          disabled={creating}
        />
      </View>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

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

  // Track which order IDs we've already alerted about (survives re-renders)
  const seenOrderIds = useRef<Set<string>>(new Set());
  const isFirstPoll = useRef(true);

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

      // ── New-order detection ──────────────────────────────────────────────
      // On the first poll we just populate the seen set — no alerts.
      // On subsequent polls, any "new" order whose ID wasn't seen triggers
      // a pushAlertBus emit (web Kios overlay) + native notification.
      const newOrders = list.filter((o) => o.status === "new" && !seenOrderIds.current.has(o.id));

      if (!isFirstPoll.current && newOrders.length > 0) {
        for (const o of newOrders) {
          const totalItems = o.items.reduce((s, i) => s + i.qty, 0);
          const dishNames = o.items.slice(0, 2).map((i) => `${i.qty}× ${i.name}`).join(", ");
          const title = "🛎 Neue Vorbestellung";
          const body = `${o.guestName}: ${dishNames}${o.items.length > 2 ? " …" : ""} (${totalItems} Portionen)`;

          // Web: trigger Kios overlay
          if (Platform.OS === "web") {
            pushAlertBus.emit({ title, body });
          } else {
            // Native: fire an immediate local notification
            try {
              await Notifications.scheduleNotificationAsync({
                content: { title, body, sound: true },
                trigger: null, // immediate
              });
            } catch { /* notifications might not be granted — ignore */ }
          }
        }
      }

      // Mark all current IDs as seen (regardless of status, so re-polls don't
      // re-alert for the same order if it gets updated)
      list.forEach((o) => seenOrderIds.current.add(o.id));
      isFirstPoll.current = false;

      // ── Kios context cache update ────────────────────────────────────────
      // Aggregate dish totals for Kios — "12× Schnitzel (Mo 12.05)"
      const openOrders = list.filter((o) => o.status !== "cancelled" && o.status !== "served");
      const dishTotals = new Map<string, number>();
      for (const o of openOrders) {
        const dayLabel = o.wantedFor
          ? (() => {
              const [, m, d] = (o.wantedFor as string).split("-");
              return `${d}.${m}`;
            })()
          : "?";
        for (const item of o.items) {
          const key = `${item.qty > 0 ? "" : ""}${item.name} (${dayLabel})`;
          dishTotals.set(key, (dishTotals.get(key) ?? 0) + item.qty);
        }
      }
      const summaryLines = [...dishTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, qty]) => `${qty}× ${name}`);

      updatePreorderCache(
        openOrders.length > 0
          ? {
              locationCode,
              totalNew: list.filter((o) => o.status === "new").length,
              totalOpen: openOrders.length,
              summaryLines,
              updatedAt: new Date().toISOString(),
            }
          : { locationCode, totalNew: 0, totalOpen: 0, summaryLines: [], updatedAt: new Date().toISOString() },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Reset seen set when location changes
  useEffect(() => {
    seenOrderIds.current = new Set();
    isFirstPoll.current = true;
    // Also clear Kios cache for old location
    updatePreorderCache(null);
  }, [locationCode]);

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

        {/* KW Wochenmenu management */}
        <KWMenuSection locationCode={locationCode} c={c} />

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

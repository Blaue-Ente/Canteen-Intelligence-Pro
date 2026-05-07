/**
 * KI-Kassenscan (T021)
 *
 * Workflow:
 *   1. Cashier taps "Tablett scannen" → camera / library picker
 *   2. Image sent to POST /api/ai/tray-scan with today's menu as context
 *   3. AI returns recognised items → cashier reviews (edit qty, remove, add)
 *   4. "Bestellung buchen" → if online: record + dispatch addSale
 *                          → if offline: enqueue via Time Machine
 *
 * Time Machine panel shows offline queue + manual sync trigger.
 */

import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { computeTotal, useTimeMachineQueue } from "@/lib/salesQueue";
import type { SaleEntry, TrayItem, TraySession } from "@/types";

const API_BASE =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api";

function confidenceColor(c: number, colors: ReturnType<typeof useColors>): string {
  if (c >= 0.8) return colors.success;
  if (c >= 0.5) return colors.warning;
  return colors.destructive;
}

function confidenceLabel(c: number, isDe: boolean): string {
  if (c >= 0.8) return isDe ? "Sicher" : "High";
  if (c >= 0.5) return isDe ? "Möglich" : "Medium";
  return isDe ? "Unsicher" : "Low";
}

/** Convert a local file URI to base64 (native only). */
async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    // On web ImagePicker returns a blob URL — fetch + convert
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URI prefix
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Native: expo-file-system
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = await (FileSystem.readAsStringAsync as any)(uri, { encoding: "base64" });
  return b64 as string;
}

export default function TrayScanScreen() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDe = state.locale === "de";
  const queue = useTimeMachineQueue();

  // ── Screen state ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<"scanner" | "queue" | "history">("scanner");

  // Scanner flow
  const [scanning, setScanning] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [session, setSession] = useState<TraySession | undefined>();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Today's menu items as AI context ─────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const menuContext = useMemo(() => {
    const todayEntry = state.menu.find((m) => m.date === today);
    if (!todayEntry) return [];
    return todayEntry.recipeIds
      .map((id) => state.recipes.find((r) => r.id === id))
      .filter(Boolean)
      .map((r) => ({ id: r!.id, name: r!.nameDe ?? r!.name, price: r!.sellPrice }));
  }, [state.menu, state.recipes, today]);

  // ── Stats ─────────────────────────────────────────────────────────────
  const totalScans = state.traySessions.length;
  const confirmedToday = useMemo(
    () =>
      state.traySessions.filter(
        (s) =>
          s.status === "confirmed" || s.status === "synced" || s.status === "queued",
      ).filter((s) => s.confirmedAt?.startsWith(today)).length,
    [state.traySessions, today],
  );

  // ── Photo capture ─────────────────────────────────────────────────────
  const pickAndScan = async () => {
    if (Platform.OS === "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!r.canceled && r.assets[0]) await runScan(r.assets[0].uri);
      return;
    }
    Alert.alert(
      isDe ? "Foto aufnehmen" : "Take photo",
      undefined,
      [
        {
          text: isDe ? "Kamera" : "Camera",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert(
                isDe ? "Kamera-Zugriff benötigt" : "Camera permission required",
                isDe
                  ? "Bitte erteile der App Kamera-Zugriff."
                  : "Please allow camera access.",
              );
              return;
            }
            const r = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!r.canceled && r.assets[0]) await runScan(r.assets[0].uri);
          },
        },
        {
          text: isDe ? "Galerie" : "Gallery",
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const r = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!r.canceled && r.assets[0]) await runScan(r.assets[0].uri);
          },
        },
        { text: t("cancel"), style: "cancel" },
      ],
    );
  };

  const runScan = async (uri: string) => {
    setPhotoUri(uri);
    setScanning(true);
    setSession(undefined);
    setEditingIdx(null);

    // Create a pending session immediately so we have an id
    const sessionId = newId();
    const pending: TraySession = {
      id: sessionId,
      capturedAt: new Date().toISOString(),
      items: [],
      status: "scanning",
      locationId: state.currentLocationId,
    };
    dispatch({ type: "addTraySession", session: pending });

    try {
      const base64 = await uriToBase64(uri);

      const res = await fetch(`${API_BASE}/ai/tray-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          menuItems: menuContext,
          locale: state.locale,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${errText}`);
      }

      const json = (await res.json()) as { data?: { items?: unknown[] } };
      const rawItems: unknown[] = json.data?.items ?? [];

      const items: TrayItem[] = rawItems
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => ({
          recipeId: typeof x.recipeId === "string" ? x.recipeId : undefined,
          name:
            typeof x.name === "string"
              ? x.name
              : (isDe ? "Unbekanntes Gericht" : "Unknown dish"),
          qty: typeof x.qty === "number" ? Math.max(1, Math.round(x.qty)) : 1,
          confidence: typeof x.confidence === "number" ? x.confidence : 0.5,
          pricePerUnit:
            typeof x.pricePerUnit === "number"
              ? x.pricePerUnit
              : (menuContext.find((m) => m.id === x.recipeId)?.price ?? 0),
          confirmed: false,
          removed: false,
        }));

      const updated: TraySession = {
        ...pending,
        photoBase64: base64.slice(0, 50_000), // keep compressed thumbnail
        items,
        status: "reviewing",
        error: items.length === 0 ? (isDe ? "Keine Gerichte erkannt" : "No dishes recognised") : undefined,
      };
      dispatch({ type: "updateTraySession", session: updated });
      setSession(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      const errSession: TraySession = {
        ...pending,
        status: "reviewing",
        items: [],
        error: msg,
      };
      dispatch({ type: "updateTraySession", session: errSession });
      setSession(errSession);
    } finally {
      setScanning(false);
    }
  };

  // ── Item edits ────────────────────────────────────────────────────────
  const updateItem = (idx: number, patch: Partial<TrayItem>) => {
    if (!session) return;
    const items = session.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    const updated = { ...session, items };
    setSession(updated);
    dispatch({ type: "updateTraySession", session: updated });
  };

  const addManualItem = () => {
    if (!session || !manualName.trim()) return;
    const item: TrayItem = {
      name: manualName.trim(),
      qty: Math.max(1, parseInt(manualQty, 10) || 1),
      confidence: 1.0,
      pricePerUnit: parseFloat(manualPrice.replace(",", ".")) || 0,
      confirmed: true,
      removed: false,
    };
    const items = [...session.items, item];
    const updated = { ...session, items };
    setSession(updated);
    dispatch({ type: "updateTraySession", session: updated });
    setManualName("");
    setManualPrice("");
    setManualQty("1");
    setEditingIdx(null);
  };

  // ── Confirm / book ────────────────────────────────────────────────────
  const activeItems = session?.items.filter((i) => !i.removed) ?? [];
  const total = computeTotal(activeItems);

  const confirmOrder = async () => {
    if (!session || activeItems.length === 0) return;

    const now = new Date().toISOString();
    const confirmed: TraySession = {
      ...session,
      items: session.items.map((i) => ({ ...i, confirmed: !i.removed })),
      status: queue.isOnline ? "confirmed" : "queued",
      confirmedAt: now,
      totalEur: total,
    };
    dispatch({ type: "updateTraySession", session: confirmed });

    if (!queue.isOnline) {
      // Time Machine: queue for later sync
      queue.enqueueFromSession(session.id, activeItems, total, state.currentLocationId);
      Alert.alert(
        t("timeMachineTitle"),
        isDe
          ? `Keine Verbindung. ${activeItems.length} Positionen (€${total.toFixed(2)}) wurden lokal gespeichert und werden synchronisiert, sobald das Internet zurückkommt.`
          : `No connection. ${activeItems.length} items (€${total.toFixed(2)}) saved locally and will sync when online.`,
        [{ text: "OK" }],
      );
    } else {
      // Online: record as SaleEntry in state
      for (const item of activeItems) {
        if (!item.recipeId) continue;
        const sale: SaleEntry = {
          id: newId(),
          date: today,
          recipeId: item.recipeId,
          cooked: 0,
          sold: item.qty,
          revenue: item.pricePerUnit * item.qty,
          source: "ai",
        };
        dispatch({ type: "addSale", sale });
      }
      Alert.alert(
        isDe ? "Gebucht" : "Booked",
        isDe
          ? `${activeItems.length} Positionen — €${total.toFixed(2)}`
          : `${activeItems.length} items — €${total.toFixed(2)}`,
        [{ text: "OK" }],
      );
    }

    // Reset for next scan
    setSession(undefined);
    setPhotoUri(undefined);
  };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
          {t("trayScanTitle")}
        </Text>
        {/* Offline / Time Machine badge */}
        {!queue.isOnline && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: c.warning + "22",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Feather name="wifi-off" size={12} color={c.warning} />
            <Text style={{ color: c.warning, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
              Offline
            </Text>
          </View>
        )}
        {queue.pendingCount > 0 && (
          <Pressable
            onPress={() => setTab("queue")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: c.primary + "22",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Feather name="clock" size={12} color={c.primary} />
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
              {queue.pendingCount}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Offline banner */}
      {!queue.isOnline && (
        <View
          style={{
            backgroundColor: c.warning + "22",
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Feather name="alert-triangle" size={14} color={c.warning} />
          <Text style={{ color: c.warning, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
            {t("offlineBanner")}
          </Text>
        </View>
      )}

      {/* Tab bar */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingTop: 8,
          gap: 8,
          borderBottomWidth: 1,
          borderColor: c.border,
          paddingBottom: 8,
        }}
      >
        {(["scanner", "queue", "history"] as const).map((tb) => {
          const labels = { scanner: isDe ? "Scanner" : "Scanner", queue: isDe ? "Time Machine" : "Time Machine", history: isDe ? "Verlauf" : "History" };
          const icons = { scanner: "camera", queue: "clock", history: "list" } as const;
          const active = tab === tb;
          const hasBadge = tb === "queue" && queue.pendingCount > 0;
          return (
            <Pressable
              key={tb}
              onPress={() => setTab(tb)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: active ? c.primary + "22" : "transparent",
              }}
            >
              <Feather name={icons[tb]} size={14} color={active ? c.primary : c.mutedForeground} />
              <Text style={{ color: active ? c.primary : c.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13 }}>
                {labels[tb]}
              </Text>
              {hasBadge && (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" }}>{queue.pendingCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 80 }}>

        {/* ──────────── SCANNER TAB ──────────── */}
        {tab === "scanner" && (
          <>
            {/* Stats row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label={t("sessionsCount")} value={String(totalScans)} icon="camera" tone="default" />
              <Stat label={isDe ? "Heute gebucht" : "Booked today"} value={String(confirmedToday)} icon="check-circle" tone="success" />
              <Stat label={t("pendingSync")} value={String(queue.pendingCount)} icon="clock" tone={queue.pendingCount > 0 ? "warning" : "default"} />
            </View>

            {/* Scan button */}
            {!session && !scanning && (
              <Card style={{ alignItems: "center", gap: 16, paddingVertical: 32 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: c.primary + "22",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="camera" size={32} color={c.primary} />
                </View>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" }}>
                  {t("trayScanTitle")}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                  {t("trayScanDesc")}
                </Text>
                {menuContext.length > 0 && (
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center" }}>
                    {isDe ? `${menuContext.length} Gerichte im Tagesmenü` : `${menuContext.length} dishes on today's menu`}
                  </Text>
                )}
                <Button
                  label={t("scanTray")}
                  icon="camera"
                  onPress={pickAndScan}
                  style={{ paddingHorizontal: 24 }}
                />
              </Card>
            )}

            {/* Scanning loader */}
            {scanning && (
              <Card style={{ alignItems: "center", gap: 16, paddingVertical: 32 }}>
                {photoUri && (
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: "100%", height: 180, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                )}
                <ActivityIndicator size="large" color={c.primary} />
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                  {t("recognizing")}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  {isDe ? "GPT-Vision analysiert das Tablett…" : "GPT-Vision is analysing the tray…"}
                </Text>
              </Card>
            )}

            {/* Review session */}
            {session && !scanning && (
              <>
                {/* Photo */}
                {photoUri && (
                  <View style={{ borderRadius: 12, overflow: "hidden" }}>
                    <Image
                      source={{ uri: photoUri }}
                      style={{ width: "100%", height: 180 }}
                      resizeMode="cover"
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        backgroundColor: activeItems.length > 0 ? c.success + "dd" : c.warning + "dd",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>
                        {activeItems.length > 0
                          ? `${activeItems.length} ${isDe ? "Pos." : "items"}`
                          : (isDe ? "Nichts erkannt" : "Nothing found")}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Error */}
                {session.error && (
                  <Card style={{ backgroundColor: c.destructive + "15", gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="alert-circle" size={16} color={c.destructive} />
                      <Text style={{ color: c.destructive, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {t("scanError")}
                      </Text>
                    </View>
                    <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {session.error}
                    </Text>
                  </Card>
                )}

                {/* Recognised items */}
                <Card style={{ gap: 8 }}>
                  <SectionHeader title={t("reviewItems")} />

                  {session.items.length === 0 && !session.error && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingVertical: 8 }}>
                      {t("noItemsFound")}
                    </Text>
                  )}

                  {session.items.map((item, idx) => (
                    <View
                      key={idx}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: item.removed ? c.muted + "66" : c.card,
                        borderWidth: 1,
                        borderColor: item.removed ? c.border + "44" : c.border,
                        gap: 6,
                        opacity: item.removed ? 0.5 : 1,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {/* Confidence dot */}
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: confidenceColor(item.confidence, c),
                          }}
                        />
                        <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                          {item.name}
                        </Text>
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                          {confidenceLabel(item.confidence, isDe)}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        {/* Qty stepper */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => updateItem(idx, { qty: Math.max(1, item.qty - 1) })}
                            style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}
                          >
                            <Feather name="minus" size={12} color={c.foreground} />
                          </Pressable>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16, minWidth: 20, textAlign: "center" }}>
                            {item.qty}
                          </Text>
                          <Pressable
                            onPress={() => updateItem(idx, { qty: item.qty + 1 })}
                            style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}
                          >
                            <Feather name="plus" size={12} color={c.foreground} />
                          </Pressable>
                        </View>

                        <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                          €{item.pricePerUnit.toFixed(2)} {isDe ? "/ Portion" : "/ portion"}
                        </Text>

                        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                          €{(item.pricePerUnit * item.qty).toFixed(2)}
                        </Text>

                        {/* Remove */}
                        <Pressable
                          onPress={() => updateItem(idx, { removed: !item.removed })}
                          style={{ padding: 6 }}
                        >
                          <Feather
                            name={item.removed ? "rotate-ccw" : "x"}
                            size={14}
                            color={item.removed ? c.primary : c.destructive}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  {/* Manual add */}
                  {editingIdx === -1 ? (
                    <View style={{ gap: 8, paddingTop: 4 }}>
                      <Field
                        label={isDe ? "Name" : "Name"}
                        value={manualName}
                        onChangeText={setManualName}
                        placeholder={isDe ? "z.B. Dessert" : "e.g. Dessert"}
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Field
                            label={isDe ? "Preis (€)" : "Price (€)"}
                            value={manualPrice}
                            onChangeText={setManualPrice}
                            keyboardType="numeric"
                            placeholder="3.50"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Field
                            label={t("editQty")}
                            value={manualQty}
                            onChangeText={setManualQty}
                            keyboardType="numeric"
                            placeholder="1"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button label={t("cancel")} variant="ghost" onPress={() => setEditingIdx(null)} style={{ flex: 1 }} />
                        <Button label={t("save")} icon="plus" onPress={addManualItem} style={{ flex: 1 }} />
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setEditingIdx(-1)}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingVertical: 8,
                          justifyContent: "center",
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Feather name="plus-circle" size={14} color={c.primary} />
                      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        {t("addManually")}
                      </Text>
                    </Pressable>
                  )}
                </Card>

                {/* Total + actions */}
                {activeItems.length > 0 && (
                  <Card style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                        {t("totalAmount")}
                      </Text>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                        €{total.toFixed(2)}
                      </Text>
                    </View>
                    {!queue.isOnline && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="wifi-off" size={12} color={c.warning} />
                        <Text style={{ color: c.warning, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                          {isDe ? "Wird in Time Machine gespeichert" : "Will be saved to Time Machine"}
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        label={t("scanAgain")}
                        icon="refresh-cw"
                        variant="ghost"
                        onPress={() => { setSession(undefined); setPhotoUri(undefined); }}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={queue.isOnline ? t("confirmOrder") : t("timeMachineTitle")}
                        icon={queue.isOnline ? "check" : "clock"}
                        onPress={confirmOrder}
                        style={{ flex: 2 }}
                      />
                    </View>
                  </Card>
                )}

                {/* Scan again when empty */}
                {activeItems.length === 0 && (
                  <Button
                    label={t("scanAgain")}
                    icon="camera"
                    onPress={() => { setSession(undefined); setPhotoUri(undefined); }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ──────────── TIME MACHINE TAB ──────────── */}
        {tab === "queue" && (
          <>
            <Card style={{ gap: 8 }}>
              <SectionHeader title={t("timeMachineTitle")} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("timeMachineDesc")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: queue.isOnline ? c.success : c.warning,
                  }}
                />
                <Text style={{ color: queue.isOnline ? c.success : c.warning, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {queue.isOnline
                    ? (isDe ? "Online" : "Online")
                    : (isDe ? "Offline" : "Offline")}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>
                  · {queue.pendingCount} {t("pendingSync")}
                </Text>
                {queue.isSyncing && (
                  <ActivityIndicator size="small" color={c.primary} />
                )}
              </View>
              {queue.pendingCount > 0 && !queue.isSyncing && queue.isOnline && (
                <Button
                  label={t("syncNowBtn")}
                  icon="upload-cloud"
                  onPress={() => void queue.flush()}
                />
              )}
              {queue.lastFlushAt && (
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  {isDe ? "Zuletzt synchronisiert" : "Last synced"}:{" "}
                  {new Date(queue.lastFlushAt).toLocaleString(isDe ? "de-DE" : "en-US")}
                </Text>
              )}
            </Card>

            {state.queuedSales.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                <Feather name="check-circle" size={32} color={c.success} />
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                  {t("noQueuedSales")}
                </Text>
              </Card>
            ) : (
              state.queuedSales.map((sale) => (
                <Card key={sale.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="clock" size={14} color={c.warning} />
                    <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      €{sale.totalEur.toFixed(2)} · {sale.items.filter((i) => !i.removed).length} {t("itemsCount")}
                    </Text>
                    <Pressable onPress={() => dispatch({ type: "removeQueuedSale", id: sale.id })}>
                      <Feather name="trash-2" size={14} color={c.destructive} />
                    </Pressable>
                  </View>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {t("queuedAt")}: {new Date(sale.queuedAt).toLocaleString(isDe ? "de-DE" : "en-US")}
                  </Text>
                  {sale.attempts > 0 && (
                    <Text style={{ color: c.warning, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                      {t("queueAttempts")}: {sale.attempts}{sale.lastError ? ` — ${sale.lastError}` : ""}
                    </Text>
                  )}
                  {sale.items.filter((i) => !i.removed).map((item, ii) => (
                    <Text key={ii} style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      · {item.qty}× {item.name} (€{(item.pricePerUnit * item.qty).toFixed(2)})
                    </Text>
                  ))}
                </Card>
              ))
            )}
          </>
        )}

        {/* ──────────── HISTORY TAB ──────────── */}
        {tab === "history" && (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label={t("sessionsCount")} value={String(totalScans)} icon="camera" tone="default" />
              <Stat label={t("referenceImages")} value={String(state.traySessions.filter((s) => s.photoBase64).length)} icon="image" tone="default" />
            </View>

            {state.traySessions.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                  {isDe ? "Noch keine Scans." : "No scans yet."}
                </Text>
              </Card>
            ) : (
              state.traySessions.slice(0, 50).map((s) => (
                <Card key={s.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Badge
                      label={s.status}
                      tone={
                        s.status === "confirmed" || s.status === "synced"
                          ? "success"
                          : s.status === "queued"
                          ? "warning"
                          : s.status === "reviewing"
                          ? "default"
                          : "default"
                      }
                    />
                    <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                      {new Date(s.capturedAt).toLocaleString(isDe ? "de-DE" : "en-US")}
                    </Text>
                    {s.totalEur !== undefined && (
                      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        €{s.totalEur.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  {s.items.length > 0 && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {s.items.filter((i) => !i.removed).map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </Text>
                  )}
                  {s.error && (
                    <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                      {s.error}
                    </Text>
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

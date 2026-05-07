/**
 * T011 / POS — Full-screen cash register (Voll-Modus only).
 *
 * Layout:
 *   Tablet (≥768 px): two-column — product grid links, cart right.
 *   Phone: product grid full width, cart slides up from bottom.
 *
 * Views:
 *   "pos"      — main tile grid + cart (default)
 *   "receipts" — today's signed receipts list
 *   "closing"  — Z-Bon + DSFinV-K export
 *
 * All TSE signing logic is preserved from T011.
 * Stub-mode banners kept — never silently hide compliance status.
 */

import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FullModeOnly } from "@/components/FullModeOnly";
import { useApp } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { formatEUR, mulMoney, sumMoney } from "@/lib/money";
import { sharePdf } from "@/lib/pdf";
import { buildZBon, exportDsfinvk, signSale } from "@/lib/tse";
import type { DishCategory, Recipe } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type VatPct = 0 | 7 | 19;
type View_ = "pos" | "receipts" | "closing";

interface CartLine {
  recipeId: string;
  qty: number;
  vat: VatPct;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Always-dark POS palette — independent of device theme setting
const P = {
  bg: "#0d0d0f",
  surface: "#18181b",
  surfaceHigh: "#27272a",
  border: "#2d2d30",
  primary: "#f59e0b",
  primaryFg: "#0a0a0b",
  fg: "#fafaf9",
  fgMuted: "#a1a1aa",
  success: "#34d399",
  danger: "#f87171",
  tileColors: {
    all: "#6366f1",
    meat: "#f97316",
    fish: "#38bdf8",
    vegan: "#4ade80",
    vegetarian: "#facc15",
    kids: "#e879f9",
  } as Record<string, string>,
  catEmoji: {
    all: "🍽️",
    meat: "🥩",
    fish: "🐟",
    vegan: "🌿",
    vegetarian: "🧀",
    kids: "⭐",
  } as Record<string, string>,
};

const VAT_OPTIONS: VatPct[] = [7, 19, 0];
const CATEGORIES: Array<DishCategory | "all"> = ["all", "meat", "fish", "vegetarian", "vegan", "kids"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Kasse() {
  return (
    <FullModeOnly silent={false}>
      <KassePos />
    </FullModeOnly>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────

function KassePos() {
  const { state, dispatch, newId } = useApp();
  const author = useAuthor();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDe = state.locale === "de";

  // ─── POS state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeView, setActiveView] = useState<View_>("pos");
  const [activeCat, setActiveCat] = useState<DishCategory | "all">("all");
  const [defaultVat, setDefaultVat] = useState<VatPct>(7);
  const [signing, setSigning] = useState(false);
  const [zDate, setZDate] = useState(todayKey());

  // Cart drawer animation (phone only)
  const cartOpen = useRef(false);
  const cartAnim = useRef(new Animated.Value(0)).current;

  const stubProvider = !state.tseConfig || state.tseConfig.provider === "stub";
  const cfgValid = !!(state.tseConfig?.kassennummer && state.tseConfig?.taxId);

  // ─── Derived
  const todaySales = useMemo(
    () => state.signedSales.filter((s) => s.date === todayKey()),
    [state.signedSales],
  );
  const todayTotal = useMemo(
    () => sumMoney(todaySales.map((s) => s.revenue)),
    [todaySales],
  );
  const filteredRecipes = useMemo(
    () =>
      activeCat === "all"
        ? state.recipes
        : state.recipes.filter((r) => r.category === activeCat),
    [state.recipes, activeCat],
  );
  const cartTotal = useMemo(
    () =>
      sumMoney(
        cart.map((line) => {
          const r = state.recipes.find((x) => x.id === line.recipeId);
          const unit = r?.sellPrice ?? r?.basePrice ?? 0;
          return mulMoney(unit, line.qty);
        }),
      ),
    [cart, state.recipes],
  );
  const cartLineCount = cart.reduce((s, l) => s + l.qty, 0);

  // ─── Cart helpers
  const addToCart = useCallback(
    (recipe: Recipe) => {
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.recipeId === recipe.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx]!, qty: next[idx]!.qty + 1 };
          return next;
        }
        return [...prev, { recipeId: recipe.id, qty: 1, vat: defaultVat }];
      });
      if (!isTablet && !cartOpen.current) {
        cartOpen.current = true;
        Animated.spring(cartAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    },
    [defaultVat, isTablet, cartAnim],
  );

  const updateQty = useCallback((recipeId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.recipeId === recipeId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const updateVat = useCallback((recipeId: string, vat: VatPct) => {
    setCart((prev) => prev.map((l) => (l.recipeId === recipeId ? { ...l, vat } : l)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleCartDrawer = () => {
    const next = !cartOpen.current;
    cartOpen.current = next;
    Animated.spring(cartAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  // ─── Sign all cart lines sequentially
  const pay = async () => {
    if (cart.length === 0) return;
    if (!cfgValid) {
      Alert.alert(
        isDe ? "TSE nicht konfiguriert" : "TSE not configured",
        isDe
          ? "Bitte trage Kassennummer und Steuernummer in den Einstellungen ein."
          : "Configure cash register number and tax ID in Settings.",
      );
      return;
    }
    setSigning(true);
    let lastSerial = state.tseConfig!.serialNumber;
    let lastSignedAt = state.tseConfig!.lastSignedAt;
    const priorSales = [...state.signedSales];

    try {
      for (const line of cart) {
        const recipe = state.recipes.find((r) => r.id === line.recipeId);
        if (!recipe) continue;
        const unit = recipe.sellPrice ?? recipe.basePrice ?? 0;
        const revenue = mulMoney(unit, line.qty);
        const signed = await signSale({
          sale: {
            id: newId(),
            date: todayKey(),
            recipeId: recipe.id,
            cooked: 0,
            sold: line.qty,
            revenue,
            source: "manual",
            ...author,
          },
          vatPct: line.vat,
          config: {
            ...state.tseConfig!,
            serialNumber: lastSerial,
            lastSignedAt,
          },
          prior: priorSales,
        });
        dispatch({ type: "addSignedSale", sale: signed });
        priorSales.push(signed);
        lastSerial = signed.tseSerial;
        lastSignedAt = signed.tseTime;
      }

      dispatch({
        type: "setTseConfig",
        config: {
          ...state.tseConfig!,
          serialNumber: lastSerial ?? state.tseConfig!.serialNumber,
          lastSignedAt: lastSignedAt ?? state.tseConfig!.lastSignedAt,
        },
      });

      const lines = cart.length;
      Alert.alert(
        isDe ? "Zahlung erfasst" : "Payment recorded",
        `${lines} ${isDe ? (lines === 1 ? "Position" : "Positionen") : (lines === 1 ? "item" : "items")}  ·  ${formatEUR(cartTotal)}` +
          (stubProvider
            ? `\n\n${isDe ? "Stub-Modus — keine Rechtsverbindlichkeit." : "Stub mode — not legally binding."}`
            : ""),
      );
      clearCart();
      if (!isTablet) {
        cartOpen.current = false;
        Animated.spring(cartAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    } catch (e) {
      Alert.alert(
        isDe ? "TSE-Fehler" : "TSE error",
        e instanceof Error ? e.message : "unknown",
      );
    } finally {
      setSigning(false);
    }
  };

  // ─── Z-Bon / DSFinV-K
  const printZBon = async () => {
    const z = buildZBon({
      signedSales: state.signedSales,
      date: zDate,
      kassennummer: state.tseConfig?.kassennummer ?? "K-001",
    });
    const lines = z.body.split("\n").map((l) => `<div>${escapeHtml(l)}</div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; max-width: 480px; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
      pre { font-family: ui-monospace, SF Mono, Menlo, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
      .stub { color: #b00; font-size: 11px; margin-top: 16px; padding: 8px; border: 1px dashed #b00; border-radius: 4px; }
    </style></head><body>
      <h1>Z-Bon · Tagesabschluss</h1>
      <div class="meta">${state.companyProfile?.name ?? ""} · ${state.tseConfig?.taxId ?? ""}</div>
      <pre>${lines}</pre>
      ${stubProvider ? `<div class="stub">Stub-Modus — Signaturen nicht rechtsverbindlich.</div>` : ""}
    </body></html>`;
    await sharePdf(html, `z-bon-${zDate}.pdf`);
  };

  const exportDsfinvkJson = async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const data = exportDsfinvk({
      signedSales: state.signedSales,
      kassennummer: state.tseConfig?.kassennummer ?? "K-001",
      fromDate: from.toISOString().slice(0, 10),
      toDate: todayKey(),
    });
    const json = JSON.stringify(data, null, 2);
    const path = `${FileSystem.cacheDirectory}dsfinvk-${todayKey()}.json`;
    await FileSystem.writeAsStringAsync(path, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: "application/json" });
    } else {
      Alert.alert("DSFinV-K", `${data.rows.length} Belege  ·  ${formatEUR(data.totals.gross)}`);
    }
  };

  // ─── Render cart panel (shared between tablet-column and phone drawer)
  const renderCart = () => (
    <View style={{ flex: 1, backgroundColor: P.surface }}>
      {/* Cart header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderColor: P.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
          {isDe ? "Warenkorb" : "Cart"}
          {cart.length > 0 && (
            <Text style={{ color: P.primary }}> ({cartLineCount})</Text>
          )}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {/* Default VAT selector */}
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Text style={{ color: P.fgMuted, fontSize: 11 }}>MwSt:</Text>
            {VAT_OPTIONS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setDefaultVat(p)}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: defaultVat === p ? P.primary : P.surfaceHigh,
                }}
              >
                <Text
                  style={{
                    color: defaultVat === p ? P.primaryFg : P.fgMuted,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                  }}
                >
                  {p}%
                </Text>
              </Pressable>
            ))}
          </View>
          {cart.length > 0 && (
            <Pressable onPress={clearCart} style={{ padding: 4 }}>
              <Feather name="trash-2" size={16} color={P.danger} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Cart items */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {cart.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
            <Feather name="shopping-cart" size={36} color={P.border} />
            <Text style={{ color: P.fgMuted, fontSize: 13, textAlign: "center" }}>
              {isDe ? "Tippe auf ein Produkt\num es hinzuzufügen" : "Tap a product\nto add it"}
            </Text>
          </View>
        ) : (
          cart.map((line) => {
            const r = state.recipes.find((x) => x.id === line.recipeId);
            if (!r) return null;
            const unit = r.sellPrice ?? r.basePrice ?? 0;
            const lineTotal = mulMoney(unit, line.qty);
            return (
              <View
                key={line.recipeId}
                style={{
                  backgroundColor: P.surfaceHigh,
                  borderRadius: 10,
                  padding: 12,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }} numberOfLines={2}>
                      {r.name}
                    </Text>
                    <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 1 }}>
                      {formatEUR(unit)} / {isDe ? "Portion" : "portion"}
                    </Text>
                  </View>
                  <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {formatEUR(lineTotal)}
                  </Text>
                </View>

                {/* Quantity row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 0, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: P.border }}>
                    <Pressable
                      onPress={() => updateQty(line.recipeId, -1)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: P.surface }}
                    >
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 18 }}>−</Text>
                    </Pressable>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: P.bg, minWidth: 36, alignItems: "center" }}>
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 14 }}>{line.qty}</Text>
                    </View>
                    <Pressable
                      onPress={() => updateQty(line.recipeId, 1)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: P.surface }}
                    >
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 18 }}>+</Text>
                    </Pressable>
                  </View>

                  {/* Per-line VAT override */}
                  <View style={{ flexDirection: "row", gap: 4, marginLeft: "auto" }}>
                    {VAT_OPTIONS.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => updateVat(line.recipeId, p)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: line.vat === p ? P.primary + "33" : "transparent",
                          borderWidth: 1,
                          borderColor: line.vat === p ? P.primary : P.border,
                        }}
                      >
                        <Text
                          style={{
                            color: line.vat === p ? P.primary : P.fgMuted,
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 10,
                          }}
                        >
                          {p}%
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Cart footer: total + pay button */}
      <View
        style={{
          padding: 16,
          borderTopWidth: 1,
          borderColor: P.border,
          gap: 10,
          paddingBottom: isTablet ? 16 : insets.bottom + 16,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: P.fgMuted, fontFamily: "Inter_500Medium", fontSize: 13 }}>
            {isDe ? "Gesamt" : "Total"}
          </Text>
          <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 26 }}>
            {formatEUR(cartTotal)}
          </Text>
        </View>

        <Pressable
          onPress={pay}
          disabled={cart.length === 0 || signing}
          style={({ pressed }) => ({
            backgroundColor: cart.length === 0 || signing ? P.surfaceHigh : P.primary,
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {signing ? (
            <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {isDe ? "Signiere…" : "Signing…"}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Feather name="credit-card" size={20} color={cart.length === 0 ? P.fgMuted : P.primaryFg} />
              <Text
                style={{
                  color: cart.length === 0 ? P.fgMuted : P.primaryFg,
                  fontFamily: "Inter_700Bold",
                  fontSize: 17,
                }}
              >
                {isDe ? "Zahlen" : "Pay"}
                {cart.length > 0 && `  ${formatEUR(cartTotal)}`}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );

  // ─── Product tile grid
  const renderProductGrid = () => (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderColor: P.border, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {CATEGORIES.map((cat) => {
          const count = cat === "all"
            ? state.recipes.length
            : state.recipes.filter((r) => r.category === cat).length;
          if (cat !== "all" && count === 0) return null;
          const active = activeCat === cat;
          const accent = P.tileColors[cat] ?? P.primary;
          return (
            <Pressable
              key={cat}
              onPress={() => setActiveCat(cat)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: active ? accent + "22" : P.surface,
                borderWidth: 1.5,
                borderColor: active ? accent : P.border,
              }}
            >
              <Text style={{ fontSize: 14 }}>{P.catEmoji[cat]}</Text>
              <Text
                style={{
                  color: active ? accent : P.fg,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {cat === "all" ? (isDe ? "Alle" : "All") : cat}
              </Text>
              <View
                style={{
                  backgroundColor: active ? accent : P.surfaceHigh,
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: active ? P.bg : P.fgMuted, fontFamily: "Inter_700Bold", fontSize: 10 }}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tiles */}
      <ScrollView
        contentContainerStyle={{
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 12,
          gap: 12,
          paddingBottom: isTablet ? 24 : 140,
        }}
      >
        {filteredRecipes.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: P.fgMuted, fontSize: 14 }}>
              {isDe ? "Keine Gerichte in dieser Kategorie" : "No dishes in this category"}
            </Text>
          </View>
        ) : (
          filteredRecipes.map((recipe) => (
            <ProductTile
              key={recipe.id}
              recipe={recipe}
              cartQty={cart.find((l) => l.recipeId === recipe.id)?.qty ?? 0}
              onPress={() => addToCart(recipe)}
              isTablet={isTablet}
            />
          ))
        )}
      </ScrollView>
    </View>
  );

  // ─── Receipts view
  const renderReceipts = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 60 }}
    >
      {/* Summary */}
      <View
        style={{
          backgroundColor: P.surface,
          borderRadius: 14,
          padding: 16,
          flexDirection: "row",
          gap: 16,
        }}
      >
        <StatBox label={isDe ? "Belege" : "Receipts"} value={String(todaySales.length)} />
        <StatBox label={isDe ? "Gesamt" : "Total"} value={formatEUR(todayTotal)} large />
        <StatBox label="TSE" value={state.tseConfig?.serialNumber?.slice(0, 8) ?? "—"} />
      </View>

      {stubProvider && (
        <View
          style={{
            backgroundColor: "#7c2d12",
            borderRadius: 10,
            padding: 12,
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Feather name="alert-triangle" size={16} color="#fca5a5" />
          <Text style={{ color: "#fca5a5", fontSize: 12, flex: 1, fontFamily: "Inter_500Medium" }}>
            {isDe
              ? "Stub-TSE aktiv — Signaturen nicht KassenSichV-konform. Aktiviere fiskaly Cloud TSE."
              : "Stub TSE active — signatures not KassenSichV-compliant. Activate fiskaly Cloud TSE."}
          </Text>
        </View>
      )}

      {/* Receipt list */}
      {todaySales.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
          <Feather name="file-text" size={40} color={P.border} />
          <Text style={{ color: P.fgMuted, fontSize: 14 }}>
            {isDe ? "Noch keine Belege heute" : "No receipts today yet"}
          </Text>
        </View>
      ) : (
        todaySales.map((s, i) => {
          const r = state.recipes.find((x) => x.id === s.recipeId);
          const catColor = P.tileColors[r?.category ?? "all"] ?? P.primary;
          return (
            <View
              key={s.id}
              style={{
                backgroundColor: P.surface,
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderLeftWidth: 3,
                borderLeftColor: catColor,
              }}
            >
              <Text style={{ color: P.fgMuted, fontFamily: "Inter_700Bold", fontSize: 12, width: 36 }}>
                #{s.tseTxNumber}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }} numberOfLines={1}>
                  {r?.name ?? s.recipeId}
                </Text>
                <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                  {s.sold} × {formatEUR((r?.sellPrice ?? r?.basePrice ?? 0))}  ·  MwSt {s.vatPct ?? 7}%
                </Text>
              </View>
              <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {formatEUR(s.revenue)}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Closing / Z-Bon view
  const renderClosing = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}
    >
      <View style={{ backgroundColor: P.surface, borderRadius: 14, padding: 16, gap: 12 }}>
        <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
          {isDe ? "Datum wählen" : "Select date"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1, 2, 3, 7].map((daysAgo) => {
              const d = new Date();
              d.setDate(d.getDate() - daysAgo);
              const k = d.toISOString().slice(0, 10);
              const active = zDate === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setZDate(k)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: active ? P.primary : P.surfaceHigh,
                    borderWidth: 1,
                    borderColor: active ? P.primary : P.border,
                  }}
                >
                  <Text style={{ color: active ? P.primaryFg : P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {daysAgo === 0 ? (isDe ? "Heute" : "Today") : `−${daysAgo}d`}
                  </Text>
                  <Text style={{ color: active ? P.primaryFg + "bb" : P.fgMuted, fontSize: 10, marginTop: 2 }}>
                    {k}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ActionButton
        icon="printer"
        label={isDe ? "Z-Bon drucken (PDF)" : "Print Z-Bon (PDF)"}
        onPress={printZBon}
      />
      <ActionButton
        icon="download"
        label={isDe ? "DSFinV-K Export (30 Tage)" : "DSFinV-K export (30 days)"}
        onPress={exportDsfinvkJson}
      />

      {stubProvider && (
        <View style={{ backgroundColor: "#7c2d12", borderRadius: 12, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Feather name="alert-triangle" size={16} color="#fca5a5" />
            <Text style={{ color: "#fca5a5", fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {isDe ? "Stub-TSE aktiv" : "Stub TSE active"}
            </Text>
          </View>
          <Text style={{ color: "#fca5a5", fontSize: 12 }}>
            {isDe
              ? "Signaturen werden lokal mit HMAC erzeugt — nicht KassenSichV-konform. Aktiviere fiskaly Cloud TSE in den Einstellungen."
              : "Signatures are locally HMAC-stamped — NOT KassenSichV-compliant. Activate fiskaly Cloud TSE in Settings."}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── Phone cart drawer (slides up over product grid)
  const cartDrawerTranslate = cartAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 0],
  });

  // ─── Main render
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View
        style={{
          flex: 1,
          backgroundColor: P.bg,
          paddingTop: Platform.OS === "android" ? insets.top : 0,
        }}
      >
        {/* Header bar */}
        <View
          style={{
            backgroundColor: P.surface,
            borderBottomWidth: 1,
            borderColor: P.border,
            paddingTop: Platform.OS === "ios" ? insets.top : 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Logo / title */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: P.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16 }}>🍽</Text>
            </View>
            <View>
              <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                KItchenOS {isDe ? "Kasse" : "POS"}
              </Text>
              <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 1 }}>
                {isDe ? "Heute" : "Today"}:  {todaySales.length} {isDe ? "Belege" : "receipts"}  ·  {formatEUR(todayTotal)}
              </Text>
            </View>
          </View>

          {/* View switcher tabs */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: P.bg,
              borderRadius: 10,
              padding: 3,
              gap: 2,
            }}
          >
            {(["pos", "receipts", "closing"] as View_[]).map((v) => {
              const labels: Record<View_, string> = {
                pos: "POS",
                receipts: isDe ? "Belege" : "Receipts",
                closing: isDe ? "Abschluss" : "Closing",
              };
              const icons: Record<View_, string> = {
                pos: "grid",
                receipts: "list",
                closing: "printer",
              };
              const active = activeView === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setActiveView(v)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: active ? P.primary : "transparent",
                  }}
                >
                  <Feather
                    name={icons[v] as any}
                    size={13}
                    color={active ? P.primaryFg : P.fgMuted}
                  />
                  <Text
                    style={{
                      color: active ? P.primaryFg : P.fgMuted,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    {labels[v]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Body */}
        {activeView === "pos" ? (
          isTablet ? (
            // ── Tablet: side-by-side ──────────────────────────────────────
            <View style={{ flex: 1, flexDirection: "row" }}>
              {/* Cart column */}
              <View
                style={{
                  width: 340,
                  borderRightWidth: 1,
                  borderColor: P.border,
                }}
              >
                {renderCart()}
              </View>
              {/* Product grid */}
              <View style={{ flex: 1 }}>
                {renderProductGrid()}
              </View>
            </View>
          ) : (
            // ── Phone: grid + floating cart button + drawer ───────────────
            <View style={{ flex: 1 }}>
              {renderProductGrid()}

              {/* Floating cart button when drawer is closed */}
              {cart.length > 0 && (
                <Pressable
                  onPress={toggleCartDrawer}
                  style={{
                    position: "absolute",
                    bottom: insets.bottom + 16,
                    right: 16,
                    backgroundColor: P.primary,
                    borderRadius: 50,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <Feather name="shopping-cart" size={18} color={P.primaryFg} />
                  <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {formatEUR(cartTotal)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: P.primaryFg,
                      borderRadius: 12,
                      width: 22,
                      height: 22,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                      {cartLineCount}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Cart drawer */}
              <Animated.View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 480,
                  backgroundColor: P.surface,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  transform: [{ translateY: cartDrawerTranslate }],
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 12,
                }}
              >
                {/* Drawer handle */}
                <Pressable
                  onPress={toggleCartDrawer}
                  style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}
                >
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: P.border }} />
                </Pressable>
                {renderCart()}
              </Animated.View>
            </View>
          )
        ) : activeView === "receipts" ? (
          renderReceipts()
        ) : (
          renderClosing()
        )}
      </View>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProductTileProps {
  recipe: Recipe;
  cartQty: number;
  onPress: () => void;
  isTablet: boolean;
}

function ProductTile({ recipe, cartQty, onPress, isTablet }: ProductTileProps) {
  const tileSize = isTablet ? 140 : 100;
  const inCart = cartQty > 0;
  const accent = P.tileColors[recipe.category] ?? P.primary;
  const price = recipe.sellPrice ?? recipe.basePrice ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: tileSize,
        height: tileSize + (isTablet ? 20 : 0),
        backgroundColor: inCart ? P.surface : P.surface,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: inCart ? accent : P.border,
        overflow: "hidden",
        opacity: pressed ? 0.75 : 1,
        alignItems: "center",
        justifyContent: "flex-end",
        padding: 10,
      })}
    >
      {/* Category color bar at top */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: accent,
          opacity: inCart ? 1 : 0.4,
        }}
      />

      {/* Cart badge */}
      {inCart && (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: accent,
            borderRadius: 12,
            minWidth: 22,
            height: 22,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 12 }}>
            {cartQty}
          </Text>
        </View>
      )}

      {/* Emoji / icon */}
      <Text style={{ fontSize: isTablet ? 32 : 24, marginBottom: 4 }}>
        {P.catEmoji[recipe.category] ?? "🍽️"}
      </Text>

      {/* Name */}
      <Text
        numberOfLines={2}
        style={{
          color: P.fg,
          fontFamily: "Inter_600SemiBold",
          fontSize: isTablet ? 12 : 11,
          textAlign: "center",
          lineHeight: isTablet ? 16 : 14,
          marginBottom: 4,
        }}
      >
        {recipe.name}
      </Text>

      {/* Price */}
      <Text
        style={{
          color: inCart ? accent : P.primary,
          fontFamily: "Inter_700Bold",
          fontSize: isTablet ? 14 : 12,
        }}
      >
        {formatEUR(price)}
      </Text>
    </Pressable>
  );
}

function StatBox({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{
          color: large ? P.primary : P.fg,
          fontFamily: "Inter_700Bold",
          fontSize: large ? 20 : 16,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? P.surfaceHigh : P.surface,
        borderRadius: 14,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderWidth: 1,
        borderColor: P.border,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: P.surfaceHigh,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon as any} size={20} color={P.primary} />
      </View>
      <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={P.fgMuted} style={{ marginLeft: "auto" }} />
    </Pressable>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch),
  );
}

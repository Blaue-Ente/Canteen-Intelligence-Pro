/**
 * T011 / POS — Full-screen cash register (Voll-Modus only).
 *
 * FISCAL ISOLATION PER LOCATION
 * ──────────────────────────────
 * KassenSichV §146a AO requires each physical cash register to have:
 *   - Its own TSE module (own serialNumber, own signatureCounter)
 *   - Its own Kassennummer
 *   - A gap-free, per-register Belegnummer series
 *
 * Implementation:
 *   - Active Kasse is always scoped to `activeLocationId`.
 *   - TSE config is read from `state.tseConfigs[activeLocationId]` and
 *     falls back to the legacy `state.tseConfig` only during migration.
 *   - `prior` passed to `signSale()` is pre-filtered to the active location
 *     so `nextTxNumber()` produces a gap-free sequence per register.
 *   - Z-Bon and DSFinV-K exports are also filtered to the active location.
 *   - When a user switches to a different location, they see a completely
 *     separate Kasse with its own config, receipts, and totals.
 *
 * Layout:
 *   Tablet (≥768 px): two-column — cart left, product grid right.
 *   Phone: product grid full-width, cart slides up from bottom.
 *
 * Views:
 *   "pos"      — tile grid + cart (default)
 *   "receipts" — today's signed receipts for active location
 *   "closing"  — Z-Bon + DSFinV-K for active location
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
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FullModeOnly } from "@/components/FullModeOnly";
import { useApp } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { formatEUR, mulMoney, sumMoney } from "@/lib/money";
import { sharePdf } from "@/lib/pdf";
import { buildZBon, exportDsfinvk, signSale } from "@/lib/tse";
import type { DishCategory, Recipe, TseConfig } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type VatPct = 0 | 7 | 19;
type ActiveView = "pos" | "receipts" | "closing";

interface CartLine {
  recipeId: string;
  qty: number;
  vat: VatPct;
}

// ─── Design tokens (always-dark POS palette) ─────────────────────────────────

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
  warning: "#fca5a5",
  warningBg: "#7c2d12",
  catColor: {
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
const CATEGORIES: Array<DishCategory | "all"> = [
  "all", "meat", "fish", "vegetarian", "vegan", "kids",
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the TSE config for a given locationId.
 * Priority: tseConfigs[locationId] → legacy tseConfig (migration) → undefined.
 */
function resolveTseConfig(
  tseConfigs: Record<string, TseConfig> | undefined,
  tseConfig: TseConfig | undefined,
  locationId: string,
): TseConfig | undefined {
  return tseConfigs?.[locationId] ?? (locationId === "primary" ? tseConfig : undefined);
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Kasse() {
  return (
    <FullModeOnly silent={false}>
      <KassePos />
    </FullModeOnly>
  );
}

// ─── Main POS component ───────────────────────────────────────────────────────

function KassePos() {
  const { state, dispatch, newId } = useApp();
  const author = useAuthor();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDe = state.locale === "de";

  // ── Location selection
  // Falls back to "primary" when no locations are configured so the migration
  // path (single tseConfig) still works without requiring the user to add a
  // Location first.
  const hasLocations = state.locations.length > 0;
  const defaultLocationId = state.currentLocationId ?? state.locations[0]?.id ?? "primary";
  const [activeLocationId, setActiveLocationId] = useState<string>(defaultLocationId);

  const activeLocation = useMemo(
    () => state.locations.find((l) => l.id === activeLocationId) ?? null,
    [state.locations, activeLocationId],
  );

  const activeTseConfig = useMemo(
    () => resolveTseConfig(state.tseConfigs, state.tseConfig, activeLocationId),
    [state.tseConfigs, state.tseConfig, activeLocationId],
  );

  // ── Receipts scoped strictly to active location
  const locationSales = useMemo(() => {
    const today = todayKey();
    return state.signedSales.filter((s) => {
      const matchLoc =
        s.locationId === activeLocationId ||
        // Migration: receipts without locationId belong to the first/primary register
        (!s.locationId && (activeLocationId === "primary" || activeLocationId === state.locations[0]?.id));
      return matchLoc && s.date === today;
    });
  }, [state.signedSales, activeLocationId, state.locations]);

  const locationAllSales = useMemo(() => {
    return state.signedSales.filter((s) => {
      return (
        s.locationId === activeLocationId ||
        (!s.locationId && (activeLocationId === "primary" || activeLocationId === state.locations[0]?.id))
      );
    });
  }, [state.signedSales, activeLocationId, state.locations]);

  const todayTotal = useMemo(
    () => sumMoney(locationSales.map((s) => s.revenue)),
    [locationSales],
  );

  // ── POS state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("pos");
  const [activeCat, setActiveCat] = useState<DishCategory | "all">("all");
  const [defaultVat, setDefaultVat] = useState<VatPct>(7);
  const [signing, setSigning] = useState(false);
  const [zDate, setZDate] = useState(todayKey());

  // Phone cart drawer animation
  const cartOpen = useRef(false);
  const cartAnim = useRef(new Animated.Value(0)).current;

  const stubProvider =
    !activeTseConfig || activeTseConfig.provider === "stub";
  const cfgValid = !!(activeTseConfig?.kassennummer && activeTseConfig?.taxId);

  // ── Derived cart values
  const cartTotal = useMemo(
    () =>
      sumMoney(
        cart.map((line) => {
          const r = state.recipes.find((x) => x.id === line.recipeId);
          return mulMoney(r?.sellPrice ?? r?.basePrice ?? 0, line.qty);
        }),
      ),
    [cart, state.recipes],
  );
  const cartLineCount = cart.reduce((s, l) => s + l.qty, 0);

  const filteredRecipes = useMemo(
    () =>
      activeCat === "all"
        ? state.recipes
        : state.recipes.filter((r) => r.category === activeCat),
    [state.recipes, activeCat],
  );

  // ── Cart helpers
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
        Animated.spring(cartAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
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
    setCart((prev) =>
      prev.map((l) => (l.recipeId === recipeId ? { ...l, vat } : l)),
    );
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

  // ── Sign all cart lines sequentially (per-location prior list → gap-free Belegnummern)
  const pay = async () => {
    if (cart.length === 0) return;
    if (!cfgValid) {
      Alert.alert(
        isDe ? "TSE nicht konfiguriert" : "TSE not configured",
        isDe
          ? `Kasse "${activeLocation?.name ?? activeLocationId}" hat noch keine TSE-Konfiguration. Bitte in den Einstellungen einrichten.`
          : `Register "${activeLocation?.name ?? activeLocationId}" has no TSE configuration. Set it up in Settings.`,
      );
      return;
    }

    setSigning(true);
    // Use ONLY this location's prior sales to ensure a gap-free per-register sequence.
    const priorForLocation = [...locationAllSales];
    let lastConfig = { ...activeTseConfig! };

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
            locationId: activeLocationId === "primary" ? undefined : activeLocationId,
            ...author,
          },
          vatPct: line.vat,
          config: lastConfig,
          prior: priorForLocation,
        });

        dispatch({ type: "addSignedSale", sale: signed });
        priorForLocation.push(signed);
        lastConfig = {
          ...lastConfig,
          serialNumber: signed.tseSerial,
          lastSignedAt: signed.tseTime,
        };
      }

      // Persist updated serial/timestamp for this specific location's Kasse
      dispatch({
        type: "setTseConfigForLocation",
        locationId: activeLocationId,
        config: lastConfig,
      });

      const count = cart.length;
      Alert.alert(
        isDe ? "Zahlung erfasst" : "Payment recorded",
        [
          `${count} ${isDe ? (count === 1 ? "Position" : "Positionen") : (count === 1 ? "item" : "items")}`,
          formatEUR(cartTotal),
          activeLocation ? `Kasse: ${activeLocation.name}` : "",
          stubProvider
            ? (isDe ? "\nStub-Modus — keine Rechtsverbindlichkeit." : "\nStub mode — not legally binding.")
            : "",
        ]
          .filter(Boolean)
          .join("  ·  "),
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

  // ── Z-Bon (filtered to active location)
  const printZBon = async () => {
    const z = buildZBon({
      signedSales: locationAllSales,
      date: zDate,
      kassennummer: activeTseConfig?.kassennummer ?? "K-001",
    });
    const lines = z.body.split("\n").map((l) => `<div>${escapeHtml(l)}</div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,system-ui,sans-serif;padding:24px;max-width:480px}
      h1{font-size:16px;margin:0 0 8px}
      .meta{color:#666;font-size:11px;margin-bottom:16px}
      pre{font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap}
      .stub{color:#b00;font-size:11px;margin-top:16px;padding:8px;border:1px dashed #b00;border-radius:4px}
    </style></head><body>
      <h1>Z-Bon · Tagesabschluss</h1>
      <div class="meta">
        ${state.companyProfile?.name ?? ""}
        ${activeLocation ? ` · ${activeLocation.name}` : ""}
        · ${activeTseConfig?.taxId ?? ""}
        · Kasse ${activeTseConfig?.kassennummer ?? "K-001"}
      </div>
      <pre>${lines}</pre>
      ${stubProvider ? `<div class="stub">Stub-Modus — Signaturen nicht rechtsverbindlich.</div>` : ""}
    </body></html>`;
    await sharePdf(html, `z-bon-${zDate}-${activeLocationId}.pdf`);
  };

  // ── DSFinV-K export (filtered to active location)
  const exportDsfinvkJson = async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const data = exportDsfinvk({
      signedSales: locationAllSales,
      kassennummer: activeTseConfig?.kassennummer ?? "K-001",
      fromDate: from.toISOString().slice(0, 10),
      toDate: todayKey(),
    });
    const json = JSON.stringify(data, null, 2);
    const path = `${FileSystem.cacheDirectory}dsfinvk-${todayKey()}-${activeLocationId}.json`;
    await FileSystem.writeAsStringAsync(path, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: "application/json" });
    } else {
      Alert.alert("DSFinV-K", `${data.rows.length} Belege  ·  ${formatEUR(data.totals.gross)}`);
    }
  };

  // ─── Render: cart panel (tablet column or phone drawer) ──────────────────

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
          gap: 8,
        }}
      >
        <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
          {isDe ? "Warenkorb" : "Cart"}
          {cart.length > 0 && (
            <Text style={{ color: P.primary }}> ({cartLineCount})</Text>
          )}
        </Text>

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
          {cart.length > 0 && (
            <Pressable onPress={clearCart} style={{ padding: 4, marginLeft: 4 }}>
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
                    <Text
                      style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                      numberOfLines={2}
                    >
                      {r.name}
                    </Text>
                    <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                      {formatEUR(unit)} / {isDe ? "Portion" : "portion"}
                    </Text>
                  </View>
                  <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {formatEUR(lineTotal)}
                  </Text>
                </View>

                {/* Qty +/- */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      borderRadius: 8,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: P.border,
                    }}
                  >
                    <Pressable
                      onPress={() => updateQty(line.recipeId, -1)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: P.surface }}
                    >
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 18 }}>
                        −
                      </Text>
                    </Pressable>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: P.bg,
                        minWidth: 36,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                        {line.qty}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => updateQty(line.recipeId, 1)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: P.surface }}
                    >
                      <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 18 }}>
                        +
                      </Text>
                    </Pressable>
                  </View>

                  {/* Per-line VAT */}
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

      {/* Total + Pay */}
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
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Feather
              name="credit-card"
              size={20}
              color={cart.length === 0 || signing ? P.fgMuted : P.primaryFg}
            />
            <Text
              style={{
                color: cart.length === 0 || signing ? P.fgMuted : P.primaryFg,
                fontFamily: "Inter_700Bold",
                fontSize: 17,
              }}
            >
              {signing
                ? (isDe ? "Signiere…" : "Signing…")
                : cart.length > 0
                  ? `${isDe ? "Zahlen" : "Pay"}  ${formatEUR(cartTotal)}`
                  : (isDe ? "Zahlen" : "Pay")}
            </Text>
          </View>
        </Pressable>

        {!cfgValid && (
          <Text style={{ color: P.fgMuted, fontSize: 11, textAlign: "center" }}>
            {isDe
              ? "TSE für diesen Standort noch nicht eingerichtet"
              : "TSE not configured for this location"}
          </Text>
        )}
      </View>
    </View>
  );

  // ─── Render: product tile grid ────────────────────────────────────────────

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
          const count =
            cat === "all"
              ? state.recipes.length
              : state.recipes.filter((r) => r.category === cat).length;
          if (cat !== "all" && count === 0) return null;
          const active = activeCat === cat;
          const accent = P.catColor[cat] ?? P.primary;
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
                <Text
                  style={{
                    color: active ? P.bg : P.fgMuted,
                    fontFamily: "Inter_700Bold",
                    fontSize: 10,
                  }}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tile grid */}
      <ScrollView
        contentContainerStyle={{
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 12,
          gap: 12,
          paddingBottom: isTablet ? 24 : 160,
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

  // ─── Render: receipts list ────────────────────────────────────────────────

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
        <StatBox label={isDe ? "Belege" : "Receipts"} value={String(locationSales.length)} />
        <StatBox label={isDe ? "Gesamt" : "Total"} value={formatEUR(todayTotal)} large />
        <StatBox
          label="Kassennr."
          value={activeTseConfig?.kassennummer ?? "—"}
        />
      </View>

      {stubProvider && <StubWarning isDe={isDe} />}

      {locationSales.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
          <Feather name="file-text" size={40} color={P.border} />
          <Text style={{ color: P.fgMuted, fontSize: 14 }}>
            {isDe ? "Noch keine Belege heute" : "No receipts today yet"}
          </Text>
        </View>
      ) : (
        locationSales.map((s) => {
          const r = state.recipes.find((x) => x.id === s.recipeId);
          const accent = P.catColor[r?.category ?? "all"] ?? P.primary;
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
                borderLeftColor: accent,
              }}
            >
              <Text
                style={{
                  color: P.fgMuted,
                  fontFamily: "Inter_700Bold",
                  fontSize: 12,
                  width: 38,
                }}
              >
                #{s.tseTxNumber}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                  numberOfLines={1}
                >
                  {r?.name ?? s.recipeId}
                </Text>
                <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                  {s.sold} × {formatEUR(r?.sellPrice ?? r?.basePrice ?? 0)}  ·  MwSt {s.vatPct ?? 7}%
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

  // ─── Render: closing / Z-Bon ──────────────────────────────────────────────

  const renderClosing = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}
    >
      {/* Date picker */}
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
                  <Text
                    style={{
                      color: active ? P.primaryFg : P.fg,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {daysAgo === 0 ? (isDe ? "Heute" : "Today") : `−${daysAgo}d`}
                  </Text>
                  <Text
                    style={{ color: active ? P.primaryFg + "bb" : P.fgMuted, fontSize: 10, marginTop: 2 }}
                  >
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

      {stubProvider && <StubWarning isDe={isDe} />}
    </ScrollView>
  );

  // ─── Phone cart drawer (animated slide-up) ───────────────────────────────

  const cartDrawerTranslate = cartAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [380, 0],
  });

  // ─── Main render ─────────────────────────────────────────────────────────

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
        {/* ── Top bar ── */}
        <View
          style={{
            backgroundColor: P.surface,
            borderBottomWidth: 1,
            borderColor: P.border,
            paddingTop: Platform.OS === "ios" ? insets.top : 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          {/* Row 1: logo + view switcher */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
            <View style={{ flex: 1 }}>
              <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                KItchenOS {isDe ? "Kasse" : "POS"}
              </Text>
              <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 1 }}>
                {isDe ? "Heute" : "Today"}:{" "}
                {locationSales.length} {isDe ? "Belege" : "receipts"}  ·  {formatEUR(todayTotal)}
              </Text>
            </View>

            {/* View switcher */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: P.bg,
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {(["pos", "receipts", "closing"] as ActiveView[]).map((v) => {
                const label: Record<ActiveView, string> = {
                  pos: "POS",
                  receipts: isDe ? "Belege" : "Receipts",
                  closing: isDe ? "Abschluss" : "Closing",
                };
                const icon: Record<ActiveView, string> = {
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
                      name={icon[v] as any}
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
                      {label[v]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Row 2: location selector (only when > 1 location configured) */}
          {hasLocations && state.locations.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {state.locations.map((loc) => {
                const isActive = activeLocationId === loc.id;
                const locCfg = state.tseConfigs?.[loc.id];
                const configured = !!(locCfg?.kassennummer && locCfg?.taxId);
                return (
                  <Pressable
                    key={loc.id}
                    onPress={() => {
                      setActiveLocationId(loc.id);
                      clearCart();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isActive ? P.primary + "22" : P.surfaceHigh,
                      borderWidth: 1.5,
                      borderColor: isActive ? P.primary : P.border,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: configured ? P.success : P.danger,
                      }}
                    />
                    <Text
                      style={{
                        color: isActive ? P.primary : P.fg,
                        fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                        fontSize: 13,
                      }}
                    >
                      {loc.name}
                    </Text>
                    {locCfg?.kassennummer && (
                      <Text style={{ color: P.fgMuted, fontSize: 11 }}>
                        #{locCfg.kassennummer}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Single location: compact TSE status badge */}
          {(!hasLocations || state.locations.length === 1) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: cfgValid ? P.success : P.danger,
                }}
              />
              <Text style={{ color: P.fgMuted, fontSize: 11 }}>
                {cfgValid
                  ? `TSE ${activeTseConfig?.provider ?? "stub"}  ·  Kasse ${activeTseConfig?.kassennummer}`
                  : (isDe ? "TSE nicht konfiguriert — nur Stub-Modus" : "TSE not configured — stub mode only")}
              </Text>
            </View>
          )}
        </View>

        {/* ── Body ── */}
        {activeView === "pos" ? (
          isTablet ? (
            // Tablet: side-by-side
            <View style={{ flex: 1, flexDirection: "row" }}>
              <View style={{ width: 340, borderRightWidth: 1, borderColor: P.border }}>
                {renderCart()}
              </View>
              <View style={{ flex: 1 }}>{renderProductGrid()}</View>
            </View>
          ) : (
            // Phone: grid + floating button + drawer
            <View style={{ flex: 1 }}>
              {renderProductGrid()}

              {/* Floating cart FAB */}
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

              {/* Slide-up cart drawer */}
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
                <Pressable
                  onPress={toggleCartDrawer}
                  style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}
                >
                  <View
                    style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: P.border }}
                  />
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
  const size = isTablet ? 140 : 100;
  const inCart = cartQty > 0;
  const accent = P.catColor[recipe.category] ?? P.primary;
  const price = recipe.sellPrice ?? recipe.basePrice ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size + (isTablet ? 20 : 0),
        backgroundColor: P.surface,
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
      {/* Category accent bar */}
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

      {/* Cart qty badge */}
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

      <Text style={{ fontSize: isTablet ? 32 : 24, marginBottom: 4 }}>
        {P.catEmoji[recipe.category] ?? "🍽️"}
      </Text>

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
          fontSize: large ? 20 : 15,
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

function StubWarning({ isDe }: { isDe: boolean }) {
  return (
    <View
      style={{
        backgroundColor: P.warningBg,
        borderRadius: 12,
        padding: 14,
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <Feather name="alert-triangle" size={16} color={P.warning} />
      <Text style={{ color: P.warning, fontSize: 12, flex: 1, fontFamily: "Inter_500Medium" }}>
        {isDe
          ? "Stub-TSE aktiv — Signaturen nicht KassenSichV-konform. Aktiviere fiskaly Cloud TSE in den Einstellungen."
          : "Stub TSE active — signatures not KassenSichV-compliant. Activate fiskaly Cloud TSE in Settings."}
      </Text>
    </View>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch),
  );
}

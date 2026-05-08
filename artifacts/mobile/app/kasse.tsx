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
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import type { DishCategory, KasseArtikel, KasseArtikelCategory, Recipe, TseConfig } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type VatPct = 0 | 7 | 19;
type ActiveView = "pos" | "receipts" | "closing" | "reports" | "terminal";
type ReportTab = "day" | "article" | "group" | "search";
type PayMethod = "cash" | "card";

interface CartLine {
  recipeId: string;
  qty: number;
  vat: VatPct;
  /** T024: Quick-add custom item name (not in state.recipes) */
  customName?: string;
  /** T024: Quick-add custom unit price in EUR */
  customPrice?: number;
}

/** Extended category type for the POS grid — includes recipe categories + POS-artikel categories. */
type PosCategory = DishCategory | "all" | KasseArtikelCategory;
/** Unified grid item — either a Recipe or a persistent KasseArtikel. */
type PosItem = { kind: "recipe"; data: Recipe } | { kind: "artikel"; data: KasseArtikel };

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
    // POS-Artikel categories
    hauptgericht: "#f59e0b",
    getraenk: "#22d3ee",
    dessert: "#c084fc",
    sonstiges: "#94a3b8",
  } as Record<string, string>,
  catEmoji: {
    all: "🍽️",
    meat: "🥩",
    fish: "🐟",
    vegan: "🌿",
    vegetarian: "🧀",
    kids: "⭐",
    // POS-Artikel categories
    hauptgericht: "🍲",
    getraenk: "🥤",
    dessert: "🍰",
    sonstiges: "📦",
  } as Record<string, string>,
};

const VAT_OPTIONS: VatPct[] = [7, 19, 0];
const CATEGORIES: PosCategory[] = [
  "all", "meat", "fish", "vegetarian", "vegan", "kids",
  "hauptgericht", "getraenk", "dessert", "sonstiges",
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── T023: Kassenbon HTML builder ────────────────────────────────────────────

interface KassenbonParams {
  company: import("@/types").CompanyProfile | undefined;
  kassennummer: string;
  belegnummer: number;
  cartLines: CartLine[];
  recipes: import("@/types").Recipe[];
  total: number;
  date: Date;
  paymentMethod: PayMethod;
  isStub: boolean;
  isDe: boolean;
}

function buildKassenbonHtml(p: KassenbonParams): string {
  const fmt = (v: number) =>
    v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const dateStr = `${pad(p.date.getDate())}.${pad(p.date.getMonth() + 1)}.${p.date.getFullYear()}`;
  const timeStr = `${pad(p.date.getHours())}:${pad(p.date.getMinutes())} Uhr`;

  // Line items
  const itemRows = p.cartLines
    .map((line) => {
      const r = p.recipes.find((x) => x.id === line.recipeId);
      const name = line.customName ?? r?.name;
      if (!name) return "";
      const unit = line.customPrice ?? r?.sellPrice ?? r?.basePrice ?? 0;
      const lineTotal = unit * line.qty;
      return `
        <tr>
          <td class="name">${escapeHtml(name)}</td>
          <td class="num">${line.qty}&times;</td>
          <td class="num">${fmt(unit)}</td>
          <td class="num bold">${fmt(lineTotal)}</td>
          <td class="vat">${line.vat}%</td>
        </tr>`;
    })
    .join("");

  // VAT breakdown
  const vatMap = new Map<number, { net: number; tax: number; gross: number }>();
  for (const line of p.cartLines) {
    const r = p.recipes.find((x) => x.id === line.recipeId);
    const unit = line.customPrice ?? r?.sellPrice ?? r?.basePrice ?? 0;
    if (unit === 0 && !line.customName && !r) continue;
    const gross = unit * line.qty;
    const net = gross / (1 + line.vat / 100);
    const tax = gross - net;
    const cur = vatMap.get(line.vat) ?? { net: 0, tax: 0, gross: 0 };
    vatMap.set(line.vat, { net: cur.net + net, tax: cur.tax + tax, gross: cur.gross + gross });
  }
  const vatRows = [...vatMap.entries()]
    .map(
      ([pct, v]) =>
        `<tr>
          <td>MwSt ${pct}%</td>
          <td class="num">${fmt(v.net)}</td>
          <td class="num">${fmt(v.tax)}</td>
          <td class="num bold">${fmt(v.gross)}</td>
        </tr>`,
    )
    .join("");

  const payLabel = p.paymentMethod === "card"
    ? (p.isDe ? "EC-/Kreditkarte" : "Card")
    : (p.isDe ? "Bargeld" : "Cash");

  const companyName = p.company?.name ?? "KItchenOS Kasse";
  const companyAddr = p.company?.address ?? "";
  const taxId = p.company?.taxId ? `St.-Nr.: ${p.company.taxId}` : "";

  const stubBanner = p.isStub
    ? `<div class="stub">${p.isDe ? "DEMO – kein steuerlicher Beleg" : "DEMO — not a valid tax receipt"}</div>`
    : "";

  return `<!doctype html>
<html lang="${p.isDe ? "de" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${p.isDe ? "Kassenbeleg" : "Receipt"} #${p.belegnummer}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Courier New",Courier,monospace;font-size:13px;color:#111;
         max-width:320px;margin:0 auto;padding:16px 12px;line-height:1.5}
    h1{font-size:16px;text-align:center;margin-bottom:2px}
    .center{text-align:center}
    .muted{color:#555;font-size:11px}
    .divider{border:none;border-top:1px dashed #555;margin:10px 0}
    table{width:100%;border-collapse:collapse}
    .num{text-align:right}
    .vat{text-align:right;color:#777;font-size:11px}
    .name{max-width:120px;word-break:break-word}
    .bold{font-weight:bold}
    .total-row{font-size:18px;font-weight:bold;margin:8px 0}
    .vat-label{font-size:11px;color:#555;margin-bottom:4px}
    .stub{border:1px dashed #c00;color:#c00;padding:6px 10px;text-align:center;
          font-size:11px;margin-top:12px;border-radius:4px}
    .footer{text-align:center;margin-top:14px;font-size:12px}
    @media print{body{max-width:100%}}
  </style>
</head>
<body>
  <h1>${escapeHtml(companyName)}</h1>
  ${companyAddr ? `<p class="center muted">${escapeHtml(companyAddr)}</p>` : ""}
  ${taxId ? `<p class="center muted">${escapeHtml(taxId)}</p>` : ""}

  <hr class="divider">

  <table>
    <tr><td>${p.isDe ? "Datum" : "Date"}</td><td class="num">${dateStr}</td></tr>
    <tr><td>${p.isDe ? "Uhrzeit" : "Time"}</td><td class="num">${timeStr}</td></tr>
    <tr><td>${p.isDe ? "Kasse" : "Register"}</td><td class="num">${escapeHtml(p.kassennummer)}</td></tr>
    <tr><td>${p.isDe ? "Beleg-Nr." : "Receipt No."}</td><td class="num">${p.belegnummer}</td></tr>
  </table>

  <hr class="divider">

  <table>
    <thead>
      <tr>
        <th class="name" style="text-align:left">${p.isDe ? "Artikel" : "Item"}</th>
        <th class="num">${p.isDe ? "Mge" : "Qty"}</th>
        <th class="num">${p.isDe ? "EP" : "Unit"}</th>
        <th class="num">${p.isDe ? "Gesamt" : "Total"}</th>
        <th class="vat">%</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="divider">

  <table class="total-row">
    <tr>
      <td>${p.isDe ? "GESAMT" : "TOTAL"}</td>
      <td class="num">${fmt(p.total)}</td>
    </tr>
  </table>
  <table>
    <tr>
      <td class="muted">${p.isDe ? "Zahlungsart" : "Payment"}</td>
      <td class="num">${payLabel}</td>
    </tr>
  </table>

  <hr class="divider">

  <p class="vat-label">${p.isDe ? "MwSt-Aufschlüsselung" : "VAT breakdown"}</p>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">MwSt</th>
        <th class="num">${p.isDe ? "Netto" : "Net"}</th>
        <th class="num">${p.isDe ? "Steuer" : "Tax"}</th>
        <th class="num">${p.isDe ? "Brutto" : "Gross"}</th>
      </tr>
    </thead>
    <tbody>${vatRows}</tbody>
  </table>

  ${stubBanner}

  <hr class="divider">
  <p class="footer">${p.isDe ? "Vielen Dank für Ihren Besuch!" : "Thank you for your visit!"}</p>
</body>
</html>`;
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
  const [activeCat, setActiveCat] = useState<PosCategory>("all");
  const [defaultVat, setDefaultVat] = useState<VatPct>(7);
  const [signing, setSigning] = useState(false);
  const [zDate, setZDate] = useState(todayKey());

  // ── T022: search / menu-sync / pagination / edit / reports
  const [searchQuery, setSearchQuery] = useState("");
  const [showTodayMenuOnly, setShowTodayMenuOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [reportTab, setReportTab] = useState<ReportTab>("day");
  const [reportSearch, setReportSearch] = useState("");

  // ── T023: AirPrint + POS Terminal
  const terminalCfg = state.terminalConfig;
  const hasTerminal = !!(terminalCfg?.type && terminalCfg.type !== "none");

  // ── T024: Quick-add + Grid compact mode
  const [gridCompact, setGridCompact] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddVat, setQuickAddVat] = useState<VatPct>(7);
  // ── Kassenartikel management modal
  const [showArtikelVerwaltung, setShowArtikelVerwaltung] = useState(false);
  const [editingArtikel, setEditingArtikel] = useState<KasseArtikel | null>(null);

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
          const price = line.customPrice ?? r?.sellPrice ?? r?.basePrice ?? 0;
          return mulMoney(price, line.qty);
        }),
      ),
    [cart, state.recipes],
  );
  const cartLineCount = cart.reduce((s, l) => s + l.qty, 0);

  // ── T022: today's menu ids for sync toggle
  const todayMenuIds = useMemo(() => {
    const today = todayKey();
    const entry = state.menu.find(
      (m) => m.date === today && (!m.locationId || m.locationId === activeLocationId),
    );
    return entry?.recipeIds ?? [];
  }, [state.menu, activeLocationId]);
  const hasTodayMenu = todayMenuIds.length > 0;

  const ARTIKEL_CATS: KasseArtikelCategory[] = ["hauptgericht", "getraenk", "dessert", "sonstiges"];
  const isArtikelCat = ARTIKEL_CATS.includes(activeCat as KasseArtikelCategory);

  const filteredItems = useMemo((): PosItem[] => {
    const isAC = ARTIKEL_CATS.includes(activeCat as KasseArtikelCategory);
    const q = searchQuery.trim().toLowerCase();

    // Recipes: show when "all" or a DishCategory tab is active
    let recipes: Recipe[] = [];
    if (activeCat === "all" || !isAC) {
      recipes =
        activeCat === "all"
          ? [...state.recipes]
          : state.recipes.filter((r) => r.category === (activeCat as DishCategory));
      if (showTodayMenuOnly && hasTodayMenu) {
        recipes = recipes.filter((r) => todayMenuIds.includes(r.id));
      }
      if (q) {
        recipes = recipes.filter(
          (r) => r.name.toLowerCase().includes(q) || r.nameDe.toLowerCase().includes(q),
        );
      }
    }

    // KasseArtikel: show when "all" or an artikel-category tab is active
    let artikels: KasseArtikel[] = [];
    if (activeCat === "all" || isAC) {
      artikels =
        activeCat === "all"
          ? (state.kasseArtikel ?? [])
          : (state.kasseArtikel ?? []).filter((a) => a.category === activeCat);
      if (q) {
        artikels = artikels.filter((a) => a.name.toLowerCase().includes(q));
      }
    }

    return [
      ...recipes.map((r): PosItem => ({ kind: "recipe", data: r })),
      ...artikels.map((a): PosItem => ({ kind: "artikel", data: a })),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recipes, state.kasseArtikel, activeCat, showTodayMenuOnly, hasTodayMenu, todayMenuIds, searchQuery]);

  // ── T022 / T024: pagination — cols adapt to screen width + compact mode
  const productAreaWidth = isTablet ? width - 340 : width;
  const cols = gridCompact
    ? Math.min(7, Math.max(5, Math.floor((productAreaWidth - 24) / 100)))
    : Math.min(5, Math.max(3, Math.floor((productAreaWidth - 24) / 150)));
  const tileSize = Math.floor((productAreaWidth - 12 * (cols + 1)) / cols);
  const ROWS_PER_PAGE = gridCompact ? 6 : 4;
  const tilesPerPage = cols * ROWS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / tilesPerPage));
  const pagedItems = filteredItems.slice(
    currentPage * tilesPerPage,
    (currentPage + 1) * tilesPerPage,
  );

  // Reset to page 0 whenever filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [activeCat, showTodayMenuOnly, searchQuery]);

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
        const itemVat = (recipe.kasseVat ?? defaultVat) as VatPct;
        return [...prev, { recipeId: recipe.id, qty: 1, vat: itemVat }];
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

  // ── T024: Add a custom (quick-add) item directly to the cart
  const addCustomToCart = useCallback(
    (name: string, price: number, vat: VatPct) => {
      const id = `_q_${newId()}`;
      setCart((prev) => [...prev, { recipeId: id, qty: 1, vat, customName: name, customPrice: price }]);
      if (!isTablet && !cartOpen.current) {
        cartOpen.current = true;
        Animated.spring(cartAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    },
    [isTablet, cartAnim, newId],
  );

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

  // ── T023: AirPrint — print Kassenbon for the given cart snapshot
  const printKassenbon = useCallback(
    async (cartSnapshot: CartLine[], total: number, method: PayMethod, belegnummer: number) => {
      const html = buildKassenbonHtml({
        company: state.companyProfile,
        kassennummer: activeTseConfig?.kassennummer ?? "K-001",
        belegnummer,
        cartLines: cartSnapshot,
        recipes: state.recipes,
        total,
        date: new Date(),
        paymentMethod: method,
        isStub: stubProvider,
        isDe,
      });
      try {
        await Print.printAsync({ html });
      } catch (err) {
        Alert.alert(
          isDe ? "Druckfehler" : "Print error",
          err instanceof Error ? err.message : "unknown",
        );
      }
    },
    [state.companyProfile, state.recipes, activeTseConfig, stubProvider, isDe],
  );

  // ── T024: Storno — void/reverse a signed receipt
  const stornoReceipt = useCallback(
    async (s: import("@/types").SignedSale) => {
      if (!cfgValid) {
        Alert.alert(isDe ? "TSE nicht konfiguriert" : "TSE not configured", "");
        return;
      }
      Alert.alert(
        isDe ? "Storno" : "Void receipt",
        isDe
          ? `Beleg #${s.tseTxNumber} über ${formatEUR(s.revenue)} stornieren?\nDieser Vorgang wird als negativer Beleg gespeichert.`
          : `Void receipt #${s.tseTxNumber} for ${formatEUR(s.revenue)}?\nThis creates a negative reversal entry.`,
        [
          {
            text: isDe ? "Storno durchführen" : "Void receipt",
            style: "destructive",
            onPress: async () => {
              setSigning(true);
              try {
                const prior = [...locationAllSales];
                const signed = await signSale({
                  sale: {
                    id: newId(),
                    date: todayKey(),
                    recipeId: s.recipeId,
                    cooked: 0,
                    sold: -(s.sold ?? 1),
                    revenue: -s.revenue,
                    source: "storno" as any,
                    paymentMethod: s.paymentMethod,
                    locationId: s.locationId,
                    ...author,
                  },
                  vatPct: s.vatPct ?? 7,
                  config: activeTseConfig!,
                  prior,
                });
                dispatch({ type: "addSignedSale", sale: signed });
                Alert.alert(
                  isDe ? "Storno erfasst" : "Receipt voided",
                  `#${signed.tseTxNumber}  −${formatEUR(s.revenue)}`,
                );
              } catch (e) {
                Alert.alert(isDe ? "Fehler" : "Error", e instanceof Error ? e.message : "unknown");
              } finally {
                setSigning(false);
              }
            },
          },
          { text: isDe ? "Abbrechen" : "Cancel", style: "cancel" },
        ],
      );
    },
    [cfgValid, isDe, locationAllSales, activeTseConfig, newId, dispatch, author],
  );

  // ── T023: Print a single already-booked receipt
  const printSingleReceipt = useCallback(
    async (s: import("@/types").SignedSale) => {
      const r = state.recipes.find((x) => x.id === s.recipeId);
      const fakeLine: CartLine = { recipeId: s.recipeId, qty: s.sold ?? 1, vat: (s.vatPct ?? 7) as VatPct };
      const html = buildKassenbonHtml({
        company: state.companyProfile,
        kassennummer: activeTseConfig?.kassennummer ?? "K-001",
        belegnummer: s.tseTxNumber ?? 0,
        cartLines: [fakeLine],
        recipes: r ? [r] : [],
        total: s.revenue,
        date: new Date(s.tseTime ?? s.date),
        paymentMethod: (s.paymentMethod as PayMethod | undefined) ?? "cash",
        isStub: stubProvider,
        isDe,
      });
      try {
        await Print.printAsync({ html });
      } catch (err) {
        Alert.alert(
          isDe ? "Druckfehler" : "Print error",
          err instanceof Error ? err.message : "unknown",
        );
      }
    },
    [state.companyProfile, state.recipes, activeTseConfig, stubProvider, isDe],
  );

  // ── Sign all cart lines sequentially (per-location prior list → gap-free Belegnummern)
  const pay = async (method: PayMethod = "cash") => {
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

    // ── T023: Terminal handling BEFORE signing
    if (method === "card") {
      if (terminalCfg?.type === "sumup") {
        const key = terminalCfg.sumupAffiliateKey ?? "";
        const amountStr = cartTotal.toFixed(2);
        const sumupUrl =
          `sumupmerchant://pay/1.0?affiliate-key=${encodeURIComponent(key)}` +
          `&amount=${amountStr}&currency=EUR&title=KItchenOS`;
        const canOpen = await Linking.canOpenURL(sumupUrl).catch(() => false);
        if (!canOpen) {
          Alert.alert(
            isDe ? "SumUp nicht gefunden" : "SumUp not found",
            isDe
              ? "Bitte die SumUp-App installieren und konfigurieren."
              : "Please install and configure the SumUp app.",
          );
          return;
        }
        await Linking.openURL(sumupUrl);
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            isDe ? "Kartenzahlung abgeschlossen?" : "Card payment complete?",
            isDe
              ? "Hat die Zahlung auf dem SumUp-Terminal funktioniert?"
              : "Did the payment succeed on the SumUp terminal?",
            [
              { text: isDe ? "Ja, buchen" : "Yes, book it", onPress: () => resolve(true) },
              { text: isDe ? "Abbrechen" : "Cancel", style: "cancel", onPress: () => resolve(false) },
            ],
          );
        });
        if (!confirmed) return;
      } else if (terminalCfg?.type === "manual") {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            isDe ? "Terminal-Zahlung" : "Card terminal",
            isDe
              ? `${formatEUR(cartTotal)} — Karte bitte am Terminal einlesen, dann bestätigen.`
              : `${formatEUR(cartTotal)} — Please process the card on the terminal, then confirm.`,
            [
              { text: isDe ? "Zahlung bestätigt" : "Payment confirmed", onPress: () => resolve(true) },
              { text: isDe ? "Abbrechen" : "Cancel", style: "cancel", onPress: () => resolve(false) },
            ],
          );
        });
        if (!confirmed) return;
      }
    }

    setSigning(true);
    // Use ONLY this location's prior sales to ensure a gap-free per-register sequence.
    const priorForLocation = [...locationAllSales];
    let lastConfig = { ...activeTseConfig! };
    // Snapshot cart + total before clearing
    const cartSnapshot = [...cart];
    const totalSnapshot = cartTotal;

    try {
      for (const line of cart) {
        const recipe = state.recipes.find((r) => r.id === line.recipeId);
        // T024: skip lines with no recipe AND no custom data
        if (!recipe && !line.customName) continue;
        const unit = line.customPrice ?? recipe?.sellPrice ?? recipe?.basePrice ?? 0;
        const revenue = mulMoney(unit, line.qty);

        const signed = await signSale({
          sale: {
            id: newId(),
            date: todayKey(),
            recipeId: line.recipeId,
            cooked: 0,
            sold: line.qty,
            revenue,
            source: "manual",
            paymentMethod: method,
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

      const count = cartSnapshot.length;
      const nextBelegnummer = priorForLocation.length;

      clearCart();
      if (!isTablet) {
        cartOpen.current = false;
        Animated.spring(cartAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }

      // ── T023: Offer AirPrint after payment
      Alert.alert(
        isDe ? "Zahlung erfasst" : "Payment recorded",
        [
          `${count} ${isDe ? (count === 1 ? "Position" : "Positionen") : (count === 1 ? "item" : "items")}`,
          formatEUR(totalSnapshot),
          method === "card" ? (isDe ? "💳 Karte" : "💳 Card") : (isDe ? "💵 Bargeld" : "💵 Cash"),
          stubProvider
            ? (isDe ? "Stub-Modus." : "Stub mode.")
            : "",
        ]
          .filter(Boolean)
          .join("  ·  "),
        [
          {
            text: isDe ? "🖨 Beleg drucken" : "🖨 Print receipt",
            onPress: () => printKassenbon(cartSnapshot, totalSnapshot, method, nextBelegnummer),
          },
          { text: isDe ? "Fertig" : "Done", style: "cancel" },
        ],
      );
    } catch (e) {
      Alert.alert(
        isDe ? "TSE-Fehler" : "TSE error",
        e instanceof Error ? e.message : "unknown",
      );
    } finally {
      setSigning(false);
    }
  };

  // ── Z-Bon (filtered to active location) — T024: payment breakdown
  const printZBon = async () => {
    const z = buildZBon({
      signedSales: locationAllSales,
      date: zDate,
      kassennummer: activeTseConfig?.kassennummer ?? "K-001",
    });
    const lines = z.body.split("\n").map((l) => `<div>${escapeHtml(l)}</div>`).join("");
    const fmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,system-ui,sans-serif;padding:24px;max-width:480px}
      h1{font-size:16px;margin:0 0 8px}
      .meta{color:#666;font-size:11px;margin-bottom:16px}
      pre{font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap}
      .pay{margin-top:14px;border-top:1px solid #ddd;padding-top:12px;display:grid;grid-template-columns:1fr auto auto;gap:4px 16px}
      .pay .hd{color:#888;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
      .pay .v{font-size:13px;font-weight:700}
      .pay .sub{color:#888;font-size:11px}
      .pay .total{color:#d97706;font-size:15px;font-weight:800}
      .stub{color:#b00;font-size:11px;margin-top:16px;padding:8px;border:1px dashed #b00;border-radius:4px}
    </style></head><body>
      <h1>Z-Bon · Tagesabschluss</h1>
      <div class="meta">
        ${escapeHtml(state.companyProfile?.name ?? "")}
        ${activeLocation ? ` · ${escapeHtml(activeLocation.name)}` : ""}
        · ${activeTseConfig?.taxId ?? ""}
        · Kasse ${activeTseConfig?.kassennummer ?? "K-001"}
      </div>
      <pre>${lines}</pre>
      <div class="pay">
        <span class="hd">Zahlungsart</span><span class="hd" style="text-align:right">Belege</span><span class="hd" style="text-align:right">Betrag</span>
        <span>💵 Bargeld</span><span class="sub" style="text-align:right">${z.cashCount}</span><span class="v" style="text-align:right">${escapeHtml(fmt(z.cashGross))}</span>
        <span>💳 Karte</span><span class="sub" style="text-align:right">${z.cardCount}</span><span class="v" style="text-align:right">${escapeHtml(fmt(z.cardGross))}</span>
        <span style="font-weight:700">Gesamt</span><span class="sub" style="text-align:right">${z.count}</span><span class="total" style="text-align:right">${escapeHtml(fmt(z.gross))}</span>
      </div>
      ${stubProvider ? `<div class="stub">Stub-Modus — Signaturen nicht rechtsverbindlich.</div>` : ""}
    </body></html>`;
    await sharePdf(html, `z-bon-${zDate}-${activeLocationId}.pdf`);
  };

  // ── T024: Zwischenbericht — intraday running total (no day close)
  const printZwischenbericht = async () => {
    const today = todayKey();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} Uhr`;
    const sales = locationSales;
    const gross = sumMoney(sales.map((s) => s.revenue));
    const cashEntries = sales.filter((s) => (s.paymentMethod ?? "cash") !== "card");
    const cardEntries = sales.filter((s) => s.paymentMethod === "card");
    const cashGross = sumMoney(cashEntries.map((s) => s.revenue));
    const cardGross = sumMoney(cardEntries.map((s) => s.revenue));
    const fmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,system-ui,sans-serif;padding:24px;max-width:480px}
      h1{font-size:16px;margin:0 0 4px}
      .sub{color:#888;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td,th{padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
      th{color:#888;font-size:10px;text-transform:uppercase;font-weight:600}
      .amt{text-align:right;font-weight:700}
      .total td{border-top:2px solid #d97706;border-bottom:none;font-weight:800;color:#d97706}
      .interim{background:#fff8e1;border-radius:4px;padding:8px 12px;font-size:10px;color:#92400e;margin-bottom:12px}
    </style></head><body>
      <h1>Zwischenbericht</h1>
      <div class="sub">${escapeHtml(state.companyProfile?.name ?? "")}${activeLocation ? ` · ${escapeHtml(activeLocation.name)}` : ""}  ·  ${today}  ·  Stand ${timeStr}</div>
      <div class="interim">⚠ Kein Tagesabschluss — nur Zwischenstand. Z-Bon separat drucken.</div>
      <table>
        <tr><th>Zahlungsart</th><th style="text-align:right">Belege</th><th style="text-align:right">Betrag</th></tr>
        <tr><td>💵 Bargeld</td><td class="amt">${cashEntries.length}</td><td class="amt">${escapeHtml(fmt(cashGross))}</td></tr>
        <tr><td>💳 Karte</td><td class="amt">${cardEntries.length}</td><td class="amt">${escapeHtml(fmt(cardGross))}</td></tr>
        <tr class="total"><td>Gesamt</td><td class="amt">${sales.length}</td><td class="amt">${escapeHtml(fmt(gross))}</td></tr>
      </table>
    </body></html>`;
    await sharePdf(html, `zwischenbericht-${today}-${timeStr.replace(":", "")}.pdf`);
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
            if (!r && !line.customName) return null;
            const unit = line.customPrice ?? r?.sellPrice ?? r?.basePrice ?? 0;
            const lineTotal = mulMoney(unit, line.qty);
            const displayName = line.customName ?? r?.name ?? line.recipeId;
            const isCustom = !!line.customName;
            return (
              <View
                key={line.recipeId}
                style={{
                  backgroundColor: P.surfaceHigh,
                  borderRadius: 10,
                  padding: 12,
                  gap: 8,
                  borderLeftWidth: isCustom ? 3 : 0,
                  borderLeftColor: "#6366f1",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                      numberOfLines={2}
                    >
                      {displayName}
                    </Text>
                    <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                      {formatEUR(unit)} / {isDe ? "Portion" : "portion"}
                      {isCustom ? "  ·  ✏️" : ""}
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

        {/* ── T023: Cash + Card payment buttons ── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Bargeld button */}
          <Pressable
            onPress={() => pay("cash")}
            disabled={cart.length === 0 || signing}
            style={({ pressed }) => ({
              flex: hasTerminal ? 1 : undefined,
              flexGrow: hasTerminal ? 1 : undefined,
              width: hasTerminal ? undefined : "100%",
              backgroundColor: cart.length === 0 || signing ? P.surfaceHigh : P.primary,
              borderRadius: 14,
              paddingVertical: 18,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 16 }}>💵</Text>
              <Text
                style={{
                  color: cart.length === 0 || signing ? P.fgMuted : P.primaryFg,
                  fontFamily: "Inter_700Bold",
                  fontSize: hasTerminal ? 15 : 17,
                }}
              >
                {signing
                  ? (isDe ? "Signiere…" : "Signing…")
                  : cart.length > 0
                    ? `${isDe ? "Bar" : "Cash"}  ${formatEUR(cartTotal)}`
                    : (isDe ? "Bargeld" : "Cash")}
              </Text>
            </View>
          </Pressable>

          {/* Karte button — shown only when a terminal is configured */}
          {hasTerminal && (
            <Pressable
              onPress={() => pay("card")}
              disabled={cart.length === 0 || signing}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: cart.length === 0 || signing ? P.surfaceHigh : "#1e40af",
                borderRadius: 14,
                paddingVertical: 18,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Text style={{ fontSize: 16 }}>💳</Text>
                <Text
                  style={{
                    color: cart.length === 0 || signing ? P.fgMuted : "#fff",
                    fontFamily: "Inter_700Bold",
                    fontSize: 15,
                  }}
                >
                  {isDe ? "Karte" : "Card"}
                </Text>
              </View>
            </Pressable>
          )}
        </View>

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

  // ─── Render: product tile grid (T022 — paginated, search, menu-sync) ────────

  const renderProductGrid = () => (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* Search bar + menu-sync toggle */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 6,
          gap: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: P.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: P.border,
            paddingHorizontal: 10,
            gap: 6,
          }}
        >
          <Feather name="search" size={14} color={P.fgMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isDe ? "Artikel suchen…" : "Search items…"}
            placeholderTextColor={P.fgMuted}
            style={{
              flex: 1,
              color: P.fg,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              paddingVertical: 8,
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={14} color={P.fgMuted} />
            </Pressable>
          )}
        </View>

        {hasTodayMenu && (
          <Pressable
            onPress={() => setShowTodayMenuOnly((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: showTodayMenuOnly ? P.primary + "22" : P.surface,
              borderWidth: 1,
              borderColor: showTodayMenuOnly ? P.primary : P.border,
            }}
          >
            <Text style={{ fontSize: 12 }}>📋</Text>
            <Text
              style={{
                color: showTodayMenuOnly ? P.primary : P.fgMuted,
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
              }}
              numberOfLines={1}
            >
              {isDe ? "Tagesmenü" : "Menu"}
            </Text>
          </Pressable>
        )}

        {/* T024: Compact grid toggle */}
        <Pressable
          onPress={() => setGridCompact((v) => !v)}
          style={{
            padding: 9,
            borderRadius: 10,
            backgroundColor: gridCompact ? P.primary + "22" : P.surface,
            borderWidth: 1,
            borderColor: gridCompact ? P.primary : P.border,
          }}
          hitSlop={6}
        >
          <Feather name={gridCompact ? "grid" : "menu"} size={15} color={gridCompact ? P.primary : P.fgMuted} />
        </Pressable>

        {/* PWA install shortcut — web only */}
        {Platform.OS === "web" && (
          <Pressable
            onPress={() => Linking.openURL("/app/kasse-pwa.html")}
            style={{
              padding: 9,
              borderRadius: 10,
              backgroundColor: P.surfaceHigh,
              borderWidth: 1,
              borderColor: P.border,
            }}
            hitSlop={6}
          >
            <Feather name="share" size={15} color={P.fgMuted} />
          </Pressable>
        )}

        {/* Artikel verwalten (+) button — opens persistent article management */}
        <Pressable
          onPress={() => setShowArtikelVerwaltung(true)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
            backgroundColor: P.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          hitSlop={6}
        >
          <Feather name="plus" size={15} color={P.primaryFg} />
        </Pressable>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderColor: P.border, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
        {CATEGORIES.map((cat) => {
          const isAC = ARTIKEL_CATS.includes(cat as KasseArtikelCategory);
          const count =
            cat === "all"
              ? state.recipes.length + (state.kasseArtikel?.length ?? 0)
              : isAC
                ? (state.kasseArtikel ?? []).filter((a) => a.category === cat).length
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
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? accent + "22" : P.surface,
                borderWidth: 1.5,
                borderColor: active ? accent : P.border,
              }}
            >
              <Text style={{ fontSize: 13 }}>{P.catEmoji[cat]}</Text>
              <Text
                style={{
                  color: active ? accent : P.fg,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  textTransform: "capitalize",
                }}
              >
                {cat === "all"
                ? (isDe ? "Alle" : "All")
                : cat === "hauptgericht" ? (isDe ? "Hauptgerichte" : "Mains")
                : cat === "getraenk" ? (isDe ? "Getränke" : "Drinks")
                : cat === "dessert" ? "Desserts"
                : cat === "sonstiges" ? (isDe ? "Sonstiges" : "Other")
                : cat}
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

      {/* Paginated tile grid */}
      <View style={{ flex: 1 }}>
        {filteredItems.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Feather name="search" size={36} color={P.border} />
            <Text style={{ color: P.fgMuted, fontSize: 14 }}>
              {isDe ? "Keine Artikel gefunden" : "No items found"}
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              padding: 12,
              gap: 12,
              alignContent: "flex-start",
            }}
          >
            {pagedItems.map((item) =>
              item.kind === "recipe" ? (
                <ProductTile
                  key={item.data.id}
                  recipe={item.data}
                  cartQty={cart.find((l) => l.recipeId === item.data.id)?.qty ?? 0}
                  tileSize={tileSize}
                  onPress={() => addToCart(item.data)}
                  onLongPress={() => setEditingRecipe(item.data)}
                />
              ) : (
                <ArtikelTile
                  key={item.data.id}
                  artikel={item.data}
                  cartQty={cart.find((l) => l.recipeId === item.data.id)?.qty ?? 0}
                  tileSize={tileSize}
                  onPress={() => {
                    setCart((prev) => {
                      const idx = prev.findIndex((l) => l.recipeId === item.data.id);
                      if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = { ...next[idx]!, qty: next[idx]!.qty + 1 };
                        return next;
                      }
                      return [...prev, { recipeId: item.data.id, qty: 1, vat: item.data.vat as VatPct, customName: item.data.name, customPrice: item.data.price }];
                    });
                    if (!isTablet && !cartOpen.current) {
                      cartOpen.current = true;
                      Animated.spring(cartAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
                    }
                  }}
                  onLongPress={() => { setEditingArtikel(item.data); setShowArtikelVerwaltung(true); }}
                />
              )
            )}
          </View>
        )}
      </View>

      {/* Pagination bar */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderTopWidth: 1,
            borderColor: P.border,
            gap: 8,
            paddingBottom: isTablet ? 10 : insets.bottom + 10,
          }}
        >
          <Pressable
            onPress={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: currentPage === 0 ? P.surface : P.surfaceHigh,
            }}
          >
            <Feather name="chevron-left" size={18} color={currentPage === 0 ? P.border : P.fg} />
          </Pressable>

          {Array.from({ length: totalPages }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setCurrentPage(i)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: currentPage === i ? P.primary : P.surfaceHigh,
              }}
            >
              <Text
                style={{
                  color: currentPage === i ? P.primaryFg : P.fgMuted,
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                }}
              >
                {i + 1}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: currentPage === totalPages - 1 ? P.surface : P.surfaceHigh,
            }}
          >
            <Feather
              name="chevron-right"
              size={18}
              color={currentPage === totalPages - 1 ? P.border : P.fg}
            />
          </Pressable>

          <Text style={{ color: P.fgMuted, fontSize: 11, marginLeft: 4 }}>
            {isDe ? "Seite" : "Page"} {currentPage + 1}/{totalPages}
            {"  ·  "}
            {filteredItems.length} {isDe ? "Artikel" : "items"}
          </Text>
        </View>
      )}
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
          const isCard = s.paymentMethod === "card";
          const isStorno = (s as any).source === "storno" || s.revenue < 0;
          return (
            <Pressable
              key={s.id}
              onLongPress={() => { if (!isStorno) stornoReceipt(s); }}
              delayLongPress={600}
              style={({ pressed }) => ({
                backgroundColor: pressed ? P.surfaceHigh : P.surface,
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderLeftWidth: 3,
                borderLeftColor: isStorno ? P.danger : accent,
                opacity: pressed ? 0.85 : 1,
              })}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={{ color: isStorno ? P.danger : P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {r?.name ?? s.recipeId}
                  </Text>
                  {isStorno && (
                    <View style={{ backgroundColor: P.danger + "33", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: P.danger, fontFamily: "Inter_700Bold", fontSize: 9 }}>STORNO</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                  {Math.abs(s.sold ?? 1)} × {formatEUR(r?.sellPrice ?? r?.basePrice ?? 0)}
                  {"  ·  MwSt "}{s.vatPct ?? 7}%
                  {isCard ? "  ·  💳" : "  ·  💵"}
                  {!isStorno && <Text style={{ color: P.fgMuted }}>{isDe ? "  · gedrückt halten = Storno" : "  · long-press = void"}</Text>}
                </Text>
              </View>
              <Text style={{ color: isStorno ? P.danger : P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {formatEUR(s.revenue)}
              </Text>
              {/* T023: Per-receipt AirPrint button */}
              <Pressable
                onPress={() => printSingleReceipt(s)}
                style={({ pressed }) => ({
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? P.surfaceHigh : "transparent",
                })}
                hitSlop={8}
              >
                <Feather name="printer" size={16} color={P.fgMuted} />
              </Pressable>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Render: terminal config (T023) ──────────────────────────────────────

  const renderTerminal = () => {
    const cfg = state.terminalConfig ?? { type: "none" as const };
    const TYPES = [
      { id: "none" as const, label: isDe ? "Kein Terminal (nur Bar)" : "No terminal (cash only)", icon: "x-circle" },
      { id: "sumup" as const, label: "SumUp (Solo / Air / Air Pro)", icon: "wifi" },
      { id: "manual" as const, label: isDe ? "Manuelles Terminal" : "Manual terminal", icon: "credit-card" },
    ] as const;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: P.bg }}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}
      >
        <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16 }}>
          {isDe ? "POS-Terminal konfigurieren" : "Configure POS Terminal"}
        </Text>
        <Text style={{ color: P.fgMuted, fontSize: 12, marginTop: -8 }}>
          {isDe
            ? "Wähle ein Terminal für Kartenzahlungen. Der 💳-Knopf erscheint im Warenkorb, sobald ein Terminal aktiviert ist."
            : "Choose a terminal for card payments. The 💳 button appears in the cart once a terminal is enabled."}
        </Text>

        {/* Type selector */}
        {TYPES.map((opt) => {
          const active = cfg.type === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() =>
                dispatch({
                  type: "setTerminalConfig",
                  config: { ...cfg, type: opt.id },
                })
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                backgroundColor: active ? P.primary + "22" : P.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1.5,
                borderColor: active ? P.primary : P.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: active ? P.primary : P.surfaceHigh,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name={opt.icon as any} size={18} color={active ? P.primaryFg : P.fgMuted} />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: active ? P.primary : P.fg,
                  fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                {opt.label}
              </Text>
              {active && <Feather name="check-circle" size={18} color={P.primary} />}
            </Pressable>
          );
        })}

        {/* SumUp affiliate key input */}
        {cfg.type === "sumup" && (
          <View style={{ backgroundColor: P.surface, borderRadius: 14, padding: 16, gap: 10 }}>
            <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              SumUp Affiliate-Key
            </Text>
            <Text style={{ color: P.fgMuted, fontSize: 11 }}>
              {isDe
                ? "Aus dem SumUp-Dashboard unter Entwickler → Affiliate-Key."
                : "From the SumUp Dashboard under Developers → Affiliate Key."}
            </Text>
            <TextInput
              value={cfg.sumupAffiliateKey ?? ""}
              onChangeText={(v) =>
                dispatch({
                  type: "setTerminalConfig",
                  config: { ...cfg, sumupAffiliateKey: v },
                })
              }
              placeholder="sup_afk_…"
              placeholderTextColor={P.fgMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: P.surfaceHigh,
                color: P.fg,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: P.border,
              }}
            />
          </View>
        )}

        {/* Optional label for any terminal */}
        {cfg.type !== "none" && (
          <View style={{ backgroundColor: P.surface, borderRadius: 14, padding: 16, gap: 10 }}>
            <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {isDe ? "Bezeichnung (optional)" : "Label (optional)"}
            </Text>
            <TextInput
              value={cfg.label ?? ""}
              onChangeText={(v) =>
                dispatch({
                  type: "setTerminalConfig",
                  config: { ...cfg, label: v },
                })
              }
              placeholder={isDe ? "z. B. Kasse 1 Terminal" : "e.g. Register 1 Terminal"}
              placeholderTextColor={P.fgMuted}
              style={{
                backgroundColor: P.surfaceHigh,
                color: P.fg,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: P.border,
              }}
            />
          </View>
        )}

        {/* AirPrint test button */}
        <ActionButton
          icon="printer"
          label={isDe ? "Testbeleg drucken (AirPrint)" : "Print test receipt (AirPrint)"}
          onPress={() =>
            printKassenbon(
              cart.length > 0 ? cart : [],
              cart.length > 0 ? cartTotal : 0,
              "cash",
              locationSales.length + 1,
            )
          }
        />

        {cfg.type === "sumup" && (
          <View
            style={{
              backgroundColor: P.surface,
              borderRadius: 14,
              padding: 16,
              gap: 8,
            }}
          >
            <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {isDe ? "SumUp-Integration" : "SumUp Integration"}
            </Text>
            <Text style={{ color: P.fgMuted, fontSize: 12, lineHeight: 18 }}>
              {isDe
                ? "Beim Tippen auf 💳 öffnet KItchenOS automatisch die SumUp-App mit dem Rechnungsbetrag. Nach der Zahlung bestätigst du im Dialog, damit der Beleg gebucht wird."
                : "When you tap 💳, KItchenOS opens the SumUp app with the exact amount. After payment, confirm in the dialog to book the receipt."}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

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

      {/* T024: Zwischenbericht */}
      <ActionButton
        icon="activity"
        label={isDe ? `Zwischenbericht (heute · ${locationSales.length} Belege)` : `Intermediate report (today · ${locationSales.length} receipts)`}
        onPress={printZwischenbericht}
      />

      <ActionButton
        icon="printer"
        label={isDe ? "Z-Bon drucken (Tagesabschluss PDF)" : "Print Z-Bon (day close PDF)"}
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

  // ─── Report aggregations (T022) — must be top-level hooks ───────────────────

  const reportByDay = useMemo(() => {
    const map = new Map<string, { count: number; sold: number; revenue: number }>();
    for (const s of locationAllSales) {
      const cur = map.get(s.date) ?? { count: 0, sold: 0, revenue: 0 };
      map.set(s.date, {
        count: cur.count + 1,
        sold: cur.sold + (s.sold ?? 1),
        revenue: cur.revenue + s.revenue,
      });
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [locationAllSales]);

  const reportByArticle = useMemo(() => {
    const map = new Map<string, { name: string; sold: number; revenue: number }>();
    for (const s of locationAllSales) {
      const r = state.recipes.find((x) => x.id === s.recipeId);
      const name = r?.name ?? s.recipeId;
      const cur = map.get(s.recipeId) ?? { name, sold: 0, revenue: 0 };
      map.set(s.recipeId, { name, sold: cur.sold + (s.sold ?? 1), revenue: cur.revenue + s.revenue });
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [locationAllSales, state.recipes]);

  const reportByGroup = useMemo(() => {
    const map = new Map<string, { revenue: number; sold: number }>();
    for (const s of locationAllSales) {
      const r = state.recipes.find((x) => x.id === s.recipeId);
      const cat = r?.category ?? "other";
      const cur = map.get(cat) ?? { revenue: 0, sold: 0 };
      map.set(cat, { revenue: cur.revenue + s.revenue, sold: cur.sold + (s.sold ?? 1) });
    }
    return [...map.entries()].sort(([, a], [, b]) => b.revenue - a.revenue);
  }, [locationAllSales, state.recipes]);

  const reportTotalRevenue = useMemo(
    () => sumMoney(locationAllSales.map((s) => s.revenue)),
    [locationAllSales],
  );

  // ─── Render: reports (T022) ──────────────────────────────────────────────

  const renderReports = () => {
    const sales = locationAllSales;

    const searchResults = reportSearch.trim()
      ? sales.filter((s) => {
          const r = state.recipes.find((x) => x.id === s.recipeId);
          return (r?.name ?? "").toLowerCase().includes(reportSearch.toLowerCase());
        })
      : [];

    const REPORT_TABS: Array<{ id: ReportTab; label: string; icon: string }> = [
      { id: "day",     label: isDe ? "Tage"    : "Days",     icon: "calendar" },
      { id: "article", label: isDe ? "Artikel" : "Articles", icon: "list"     },
      { id: "group",   label: isDe ? "Gruppen" : "Groups",   icon: "grid"     },
      { id: "search",  label: isDe ? "Suche"   : "Search",   icon: "search"   },
    ];

    return (
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        {/* Report sub-tab bar */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: P.surface,
            borderBottomWidth: 1,
            borderColor: P.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 6,
          }}
        >
          {REPORT_TABS.map((tab) => {
            const active = reportTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setReportTab(tab.id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: active ? P.primary : P.surfaceHigh,
                }}
              >
                <Feather name={tab.icon as any} size={13} color={active ? P.primaryFg : P.fgMuted} />
                <Text
                  style={{
                    color: active ? P.primaryFg : P.fgMuted,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: insets.bottom + 40 }}
        >
          {/* ── Summary strip ── */}
          <View
            style={{
              flexDirection: "row",
              gap: 1,
              backgroundColor: P.border,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 4,
            }}
          >
            <View style={{ flex: 1, backgroundColor: P.surface, padding: 14, alignItems: "center" }}>
              <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                {formatEUR(sumMoney(sales.map((s) => s.revenue)))}
              </Text>
              <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                {isDe ? "Gesamtumsatz" : "Total revenue"}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: P.surface, padding: 14, alignItems: "center" }}>
              <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                {sales.reduce((s, x) => s + (x.sold ?? 1), 0)}
              </Text>
              <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                {isDe ? "Verkauft gesamt" : "Total sold"}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: P.surface, padding: 14, alignItems: "center" }}>
              <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                {sales.length}
              </Text>
              <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                {isDe ? "Belege" : "Receipts"}
              </Text>
            </View>
          </View>

          {sales.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Feather name="bar-chart-2" size={40} color={P.border} />
              <Text style={{ color: P.fgMuted, fontSize: 14 }}>
                {isDe ? "Noch keine Buchungen für diesen Standort" : "No sales for this location yet"}
              </Text>
            </View>
          ) : reportTab === "day" ? (
            reportByDay.map(([date, d]) => (
              <View
                key={date}
                style={{
                  backgroundColor: P.surface,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {date}
                  </Text>
                  <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                    {d.count} {isDe ? "Belege" : "receipts"}  ·  {d.sold} {isDe ? "Portionen" : "portions"}
                  </Text>
                </View>
                <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  {formatEUR(d.revenue)}
                </Text>
              </View>
            ))
          ) : reportTab === "article" ? (
            reportByArticle.map((a, i) => (
              <View
                key={a.name + i}
                style={{
                  backgroundColor: P.surface,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: P.primary,
                }}
              >
                <Text style={{ color: P.fgMuted, fontFamily: "Inter_700Bold", fontSize: 12, width: 24 }}>
                  {i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                  <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                    {a.sold} {isDe ? "× verkauft" : "× sold"}
                  </Text>
                </View>
                <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {formatEUR(a.revenue)}
                </Text>
              </View>
            ))
          ) : reportTab === "group" ? (
            reportByGroup.map(([cat, g]) => (
              <View
                key={cat}
                style={{
                  backgroundColor: P.surface,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 22 }}>{P.catEmoji[cat] ?? "🍽️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: P.fg,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                      textTransform: "capitalize",
                    }}
                  >
                    {cat}
                  </Text>
                  <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                    {g.sold} {isDe ? "Portionen" : "portions"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {formatEUR(g.revenue)}
                  </Text>
                  <Text style={{ color: P.fgMuted, fontSize: 10, marginTop: 2 }}>
                    {reportTotalRevenue > 0
                      ? `${((g.revenue / reportTotalRevenue) * 100).toFixed(1)}%`
                      : "0%"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            /* Search tab */
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: P.surface,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: P.border,
                  paddingHorizontal: 12,
                  gap: 8,
                }}
              >
                <Feather name="search" size={16} color={P.fgMuted} />
                <TextInput
                  value={reportSearch}
                  onChangeText={setReportSearch}
                  placeholder={isDe ? "Artikelname suchen…" : "Search by item name…"}
                  placeholderTextColor={P.fgMuted}
                  style={{
                    flex: 1,
                    color: P.fg,
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    paddingVertical: 12,
                  }}
                />
              </View>
              {reportSearch.trim()
                ? searchResults.map((s) => {
                    const r = state.recipes.find((x) => x.id === s.recipeId);
                    return (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: P.surface,
                          borderRadius: 12,
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                            numberOfLines={1}
                          >
                            {r?.name ?? s.recipeId}
                          </Text>
                          <Text style={{ color: P.fgMuted, fontSize: 11, marginTop: 2 }}>
                            {s.date}  ·  {s.sold} × {formatEUR((r?.sellPrice ?? r?.basePrice) ?? 0)}
                          </Text>
                        </View>
                        <Text style={{ color: P.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                          {formatEUR(s.revenue)}
                        </Text>
                      </View>
                    );
                  })
                : (
                  <View style={{ alignItems: "center", paddingTop: 40 }}>
                    <Text style={{ color: P.fgMuted, fontSize: 13 }}>
                      {isDe ? "Artikelnamen eingeben um zu suchen" : "Enter an article name to search"}
                    </Text>
                  </View>
                )}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

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
              {(["pos", "receipts", "closing", "reports", "terminal"] as ActiveView[]).map((v) => {
                const label: Record<ActiveView, string> = {
                  pos: "POS",
                  receipts: isDe ? "Belege" : "Receipts",
                  closing: isDe ? "Abschluss" : "Closing",
                  reports: isDe ? "Berichte" : "Reports",
                  terminal: isDe ? "Terminal" : "Terminal",
                };
                const icon: Record<ActiveView, string> = {
                  pos: "grid",
                  receipts: "list",
                  closing: "printer",
                  reports: "bar-chart-2",
                  terminal: "credit-card",
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
        ) : activeView === "reports" ? (
          renderReports()
        ) : activeView === "terminal" ? (
          renderTerminal()
        ) : (
          renderClosing()
        )}

        {/* ── Edit Item Modal (T022) ── */}
        {editingRecipe && (
          <EditItemModal
            recipe={editingRecipe}
            isDe={isDe}
            onClose={() => setEditingRecipe(null)}
            onSave={(updated) => {
              dispatch({ type: "updateRecipe", recipe: updated });
              setEditingRecipe(null);
            }}
          />
        )}

        {/* ── T024: Quick-add custom Artikel Modal ── */}
        {showQuickAdd && (
          <QuickAddModal
            isDe={isDe}
            defaultVat={quickAddVat}
            onVatChange={setQuickAddVat}
            onConfirm={addCustomToCart}
            onClose={() => setShowQuickAdd(false)}
          />
        )}

        {/* ── Kassenartikel management modal ── */}
        {showArtikelVerwaltung && (
          <ArtikelVerwaltungModal
            isDe={isDe}
            kasseArtikel={state.kasseArtikel ?? []}
            editingArtikel={editingArtikel}
            defaultVat={defaultVat}
            onAdd={(a) => dispatch({ type: "addKasseArtikel", artikel: a })}
            onUpdate={(a) => dispatch({ type: "updateKasseArtikel", artikel: a })}
            onRemove={(id) => dispatch({ type: "removeKasseArtikel", id })}
            onQuickAdd={() => { setQuickAddVat(defaultVat); setShowQuickAdd(true); }}
            onClose={() => { setShowArtikelVerwaltung(false); setEditingArtikel(null); }}
          />
        )}
      </View>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProductTileProps {
  recipe: Recipe;
  cartQty: number;
  tileSize: number;
  onPress: () => void;
  onLongPress: () => void;
}

function ProductTile({ recipe, cartQty, tileSize, onPress, onLongPress }: ProductTileProps) {
  const inCart = cartQty > 0;
  const accent = P.catColor[recipe.category] ?? P.primary;
  const price = recipe.sellPrice ?? recipe.basePrice ?? 0;
  const photoUri = recipe.kasseImageUri ?? recipe.imageUrl;
  // Scale text with tile size
  const nameFontSize = tileSize > 130 ? 13 : 11;
  const priceFontSize = tileSize > 130 ? 15 : 12;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={({ pressed }) => ({
        width: tileSize,
        height: tileSize + 20,
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
      {/* Background photo if available */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.25,
          }}
          resizeMode="cover"
        />
      ) : null}

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

      {/* Edit hint badge (top-left, subtle) */}
      <View
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          opacity: 0.35,
        }}
      >
        <Feather name="edit-2" size={10} color={P.fgMuted} />
      </View>

      {/* Emoji or photo placeholder */}
      {!photoUri && (
        <Text style={{ fontSize: tileSize > 130 ? 32 : 24, marginBottom: 4 }}>
          {P.catEmoji[recipe.category] ?? "🍽️"}
        </Text>
      )}

      <Text
        numberOfLines={2}
        style={{
          color: P.fg,
          fontFamily: "Inter_600SemiBold",
          fontSize: nameFontSize,
          textAlign: "center",
          lineHeight: nameFontSize + 4,
          marginBottom: 4,
        }}
      >
        {recipe.name}
      </Text>

      <Text
        style={{
          color: inCart ? accent : P.primary,
          fontFamily: "Inter_700Bold",
          fontSize: priceFontSize,
        }}
      >
        {formatEUR(price)}
      </Text>
    </Pressable>
  );
}

// ─── EditItemModal (T022) ─────────────────────────────────────────────────────

interface EditItemModalProps {
  recipe: Recipe;
  isDe: boolean;
  onClose: () => void;
  onSave: (updated: Recipe) => void;
}

function EditItemModal({ recipe, isDe, onClose, onSave }: EditItemModalProps) {
  const [name, setName] = useState(recipe.name);
  const [price, setPrice] = useState(String(recipe.sellPrice ?? recipe.basePrice ?? 0));
  const [vat, setVat] = useState<0 | 7 | 19>(recipe.kasseVat ?? 7);
  const [photoUri, setPhotoUri] = useState<string | undefined>(
    recipe.kasseImageUri ?? recipe.imageUrl,
  );

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    const parsed = parseFloat(price.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert(
        isDe ? "Ungültiger Preis" : "Invalid price",
        isDe ? "Bitte einen gültigen Preis eingeben." : "Please enter a valid price.",
      );
      return;
    }
    onSave({
      ...recipe,
      name: name.trim() || recipe.name,
      sellPrice: parsed,
      kasseVat: vat,
      kasseImageUri: photoUri,
    });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: P.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            gap: 16,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {isDe ? "Artikel bearbeiten" : "Edit item"}
            </Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={22} color={P.fgMuted} />
            </Pressable>
          </View>

          {/* Photo picker */}
          <Pressable
            onPress={pickPhoto}
            style={{
              height: 100,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: P.border,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: P.bg,
            }}
          >
            {photoUri ? (
              <>
                <Image
                  source={{ uri: photoUri }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.5)",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                    {isDe ? "Foto ändern" : "Change photo"}
                  </Text>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", gap: 6 }}>
                <Feather name="camera" size={24} color={P.fgMuted} />
                <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                  {isDe ? "Foto hinzufügen" : "Add photo"}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {isDe ? "Name (Kasse)" : "Name (POS)"}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={{
                backgroundColor: P.bg,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: P.border,
                color: P.fg,
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                paddingHorizontal: 12,
                paddingVertical: 11,
              }}
              placeholderTextColor={P.fgMuted}
            />
          </View>

          {/* Price + VAT row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                {isDe ? "Preis (€)" : "Price (€)"}
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: P.bg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: P.border,
                  color: P.fg,
                  fontFamily: "Inter_700Bold",
                  fontSize: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                }}
                placeholderTextColor={P.fgMuted}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                MwSt
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {([7, 19, 0] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setVat(p)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      borderRadius: 10,
                      backgroundColor: vat === p ? P.primary : P.bg,
                      borderWidth: 1,
                      borderColor: vat === p ? P.primary : P.border,
                    }}
                  >
                    <Text
                      style={{
                        color: vat === p ? P.primaryFg : P.fgMuted,
                        fontFamily: "Inter_700Bold",
                        fontSize: 14,
                      }}
                    >
                      {p}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => ({
              backgroundColor: P.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {isDe ? "Speichern" : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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

// ─── T024: QuickAddModal ───────────────────────────────────────────────────────

interface QuickAddModalProps {
  isDe: boolean;
  defaultVat: VatPct;
  onVatChange: (v: VatPct) => void;
  onConfirm: (name: string, price: number, vat: VatPct) => void;
  onClose: () => void;
}

function QuickAddModal({ isDe, defaultVat, onVatChange, onConfirm, onClose }: QuickAddModalProps) {
  const [name, setName] = React.useState("");
  const [priceStr, setPriceStr] = React.useState("");
  const [vat, setVat] = React.useState<VatPct>(defaultVat);
  const [listening, setListening] = React.useState(false);

  const price = parseFloat(priceStr.replace(",", ".")) || 0;
  const valid = name.trim().length > 0 && price > 0;

  // Web Speech API (web only)
  const startVoice = React.useCallback(() => {
    if (Platform.OS !== "web") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert(isDe ? "Sprache nicht verfügbar" : "Speech not available");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = isDe ? "de-DE" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      // parse "Schnitzel 8,50" or "Schnitzel 8.50"
      const match = transcript.match(/^(.+?)\s+(\d+[.,]\d{1,2}|\d+)\s*(?:Euro|€)?$/i);
      if (match) {
        setName(match[1].trim());
        setPriceStr(match[2].replace(",", "."));
      } else {
        setName(transcript.trim());
      }
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }, [isDe]);

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
      }}
    >
      <Pressable style={{ position: "absolute", inset: 0 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: P.surface,
          borderRadius: 20,
          padding: 22,
          width: Math.min(340, 340),
          gap: 14,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: P.fg, fontFamily: "Inter_700Bold", fontSize: 16 }}>
            {isDe ? "Artikel hinzufügen" : "Add custom item"}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={P.fgMuted} />
          </Pressable>
        </View>

        {/* Name row + voice button */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            {isDe ? "Bezeichnung" : "Name"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: P.bg,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: P.fg,
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                borderWidth: 1,
                borderColor: P.border,
              }}
              placeholder={isDe ? "z. B. Schnitzel Wiener Art" : "e.g. Wiener Schnitzel"}
              placeholderTextColor={P.fgMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            {Platform.OS === "web" && (
              <Pressable
                onPress={startVoice}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: listening ? P.primary + "33" : P.bg,
                  borderWidth: 1,
                  borderColor: listening ? P.primary : P.border,
                }}
              >
                <Feather name={listening ? "loader" : "mic"} size={18} color={listening ? P.primary : P.fgMuted} />
              </Pressable>
            )}
          </View>
          {Platform.OS === "web" && (
            <Text style={{ color: P.fgMuted, fontSize: 10 }}>
              {isDe ? '🎤 Tippe Mikrofon oder sprich "Schnitzel 8,50"' : '🎤 Tap mic or say "Schnitzel 8.50"'}
            </Text>
          )}
        </View>

        {/* Price */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            {isDe ? "Verkaufspreis (€)" : "Sell price (€)"}
          </Text>
          <TextInput
            style={{
              backgroundColor: P.bg,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: P.fg,
              fontFamily: "Inter_700Bold",
              fontSize: 16,
              borderWidth: 1,
              borderColor: P.border,
            }}
            placeholder="0,00"
            placeholderTextColor={P.fgMuted}
            value={priceStr}
            onChangeText={setPriceStr}
            keyboardType="decimal-pad"
          />
        </View>

        {/* MwSt */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: P.fgMuted, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            MwSt
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {VAT_OPTIONS.map((p) => (
              <Pressable
                key={p}
                onPress={() => { setVat(p); onVatChange(p); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: vat === p ? P.primary : P.bg,
                  borderWidth: 1,
                  borderColor: vat === p ? P.primary : P.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: vat === p ? P.primaryFg : P.fg,
                    fontFamily: "Inter_700Bold",
                    fontSize: 14,
                  }}
                >
                  {p} %
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <Pressable
            onPress={onClose}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: P.surfaceHigh,
              alignItems: "center",
            }}
          >
            <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {isDe ? "Abbrechen" : "Cancel"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { if (valid) { onConfirm(name.trim(), price, vat); onClose(); } }}
            disabled={!valid}
            style={{
              flex: 2,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: valid ? P.primary : P.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: valid ? P.primaryFg : P.fgMuted, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {isDe ? "Zum Warenkorb" : "Add to cart"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── ArtikelTile ──────────────────────────────────────────────────────────────

interface ArtikelTileProps {
  artikel: KasseArtikel;
  cartQty: number;
  tileSize: number;
  onPress: () => void;
  onLongPress: () => void;
}

function ArtikelTile({ artikel, cartQty, tileSize, onPress, onLongPress }: ArtikelTileProps) {
  const inCart = cartQty > 0;
  const accent = P.catColor[artikel.category] ?? P.primary;
  const nameFontSize = tileSize > 130 ? 13 : 11;
  const priceFontSize = tileSize > 130 ? 15 : 12;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={({ pressed }) => ({
        width: tileSize,
        height: tileSize + 20,
        backgroundColor: P.surface,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: inCart ? accent : P.border,
        overflow: "hidden",
        opacity: pressed ? 0.75 : 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        gap: 4,
      })}
    >
      {/* Category emoji badge */}
      <View
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          backgroundColor: accent + "33",
          borderRadius: 8,
          paddingHorizontal: 5,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 10 }}>{P.catEmoji[artikel.category]}</Text>
      </View>

      {/* Cart qty badge */}
      {inCart && (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            backgroundColor: accent,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 11 }}>
            {cartQty}
          </Text>
        </View>
      )}

      {/* Name */}
      <Text
        numberOfLines={2}
        style={{
          color: P.fg,
          fontFamily: "Inter_600SemiBold",
          fontSize: nameFontSize,
          textAlign: "center",
          marginTop: 18,
        }}
      >
        {artikel.name}
      </Text>

      {/* Price */}
      <Text
        style={{
          color: inCart ? accent : P.primary,
          fontFamily: "Inter_700Bold",
          fontSize: priceFontSize,
        }}
      >
        {artikel.price.toFixed(2).replace(".", ",")} €
      </Text>

      {/* VAT label */}
      <Text style={{ color: P.fgMuted, fontSize: 9 }}>
        {artikel.vat}% MwSt.
      </Text>
    </Pressable>
  );
}

// ─── ArtikelVerwaltungModal ───────────────────────────────────────────────────

const ARTIKEL_CAT_LIST: KasseArtikelCategory[] = ["hauptgericht", "getraenk", "dessert", "sonstiges"];

interface ArtikelVerwaltungModalProps {
  isDe: boolean;
  kasseArtikel: KasseArtikel[];
  editingArtikel: KasseArtikel | null;
  defaultVat: VatPct;
  onAdd: (a: KasseArtikel) => void;
  onUpdate: (a: KasseArtikel) => void;
  onRemove: (id: string) => void;
  onQuickAdd: () => void;
  onClose: () => void;
}

function ArtikelVerwaltungModal({
  isDe,
  kasseArtikel,
  editingArtikel,
  defaultVat,
  onAdd,
  onUpdate,
  onRemove,
  onQuickAdd,
  onClose,
}: ArtikelVerwaltungModalProps) {
  const [filterCat, setFilterCat] = useState<KasseArtikelCategory | "all">("all");
  const [showForm, setShowForm] = useState(editingArtikel !== null);
  const [formId, setFormId] = useState(editingArtikel?.id ?? "");
  const [formName, setFormName] = useState(editingArtikel?.name ?? "");
  const [formPrice, setFormPrice] = useState(editingArtikel ? String(editingArtikel.price.toFixed(2)) : "");
  const [formVat, setFormVat] = useState<VatPct>(editingArtikel?.vat ?? defaultVat);
  const [formCat, setFormCat] = useState<KasseArtikelCategory>(editingArtikel?.category ?? "sonstiges");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isEditing = formId !== "";

  function openNew() {
    setFormId("");
    setFormName("");
    setFormPrice("");
    setFormVat(defaultVat);
    setFormCat("sonstiges");
    setShowForm(true);
  }

  function openEdit(a: KasseArtikel) {
    setFormId(a.id);
    setFormName(a.name);
    setFormPrice(a.price.toFixed(2).replace(",", "."));
    setFormVat(a.vat);
    setFormCat(a.category);
    setShowForm(true);
  }

  function handleSave() {
    const price = parseFloat(formPrice.replace(",", "."));
    if (!formName.trim() || isNaN(price) || price <= 0) return;
    if (isEditing) {
      onUpdate({ id: formId, name: formName.trim(), price, vat: formVat, category: formCat });
    } else {
      onAdd({ id: `_a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: formName.trim(), price, vat: formVat, category: formCat });
    }
    setShowForm(false);
  }

  const priceNum = parseFloat(formPrice.replace(",", "."));
  const formValid = formName.trim().length > 0 && !isNaN(priceNum) && priceNum > 0;

  const visibleArtikel = filterCat === "all"
    ? kasseArtikel
    : kasseArtikel.filter((a) => a.category === filterCat);

  const catLabel = (c: KasseArtikelCategory | "all") => {
    if (c === "all") return isDe ? "Alle" : "All";
    if (c === "hauptgericht") return isDe ? "Hauptgerichte" : "Mains";
    if (c === "getraenk") return isDe ? "Getränke" : "Drinks";
    if (c === "dessert") return "Desserts";
    return isDe ? "Sonstiges" : "Other";
  };

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#000000cc",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 200,
      }}
    >
      <View
        style={{
          width: "92%",
          maxWidth: 520,
          maxHeight: "88%",
          backgroundColor: P.surface,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderColor: P.border,
          }}
        >
          <Text style={{ flex: 1, color: P.fg, fontFamily: "Inter_700Bold", fontSize: 17 }}>
            {isDe ? "Kassenartikel verwalten" : "Manage Articles"}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={P.fgMuted} />
          </Pressable>
        </View>

        {showForm ? (
          /* ── Form: add / edit article ── */
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={{ color: P.fgMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {isEditing ? (isDe ? "Artikel bearbeiten" : "Edit article") : (isDe ? "Neuer Kassenartikel" : "New POS article")}
            </Text>

            {/* Name */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12 }}>{isDe ? "Bezeichnung" : "Name"}</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder={isDe ? "z. B. Schnitzel" : "e.g. Schnitzel"}
                placeholderTextColor={P.fgMuted}
                style={{
                  backgroundColor: P.bg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: P.border,
                  color: P.fg,
                  fontSize: 15,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: "Inter_400Regular",
                }}
                autoFocus
              />
            </View>

            {/* Price */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12 }}>{isDe ? "Preis (€)" : "Price (€)"}</Text>
              <TextInput
                value={formPrice}
                onChangeText={setFormPrice}
                placeholder="0,00"
                placeholderTextColor={P.fgMuted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: P.bg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: P.border,
                  color: P.fg,
                  fontSize: 15,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: "Inter_400Regular",
                }}
              />
            </View>

            {/* VAT */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12 }}>MwSt.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {VAT_OPTIONS.map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setFormVat(v)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: formVat === v ? P.primary : P.bg,
                      borderWidth: 1,
                      borderColor: formVat === v ? P.primary : P.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: formVat === v ? P.primaryFg : P.fg, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {v}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Category */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: P.fgMuted, fontSize: 12 }}>{isDe ? "Kategorie" : "Category"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ARTIKEL_CAT_LIST.map((c) => {
                  const accent = P.catColor[c] ?? P.primary;
                  const active = formCat === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setFormCat(c)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: active ? accent + "22" : P.bg,
                        borderWidth: 1.5,
                        borderColor: active ? accent : P.border,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{P.catEmoji[c]}</Text>
                      <Text style={{ color: active ? accent : P.fgMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        {catLabel(c)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Save / Cancel */}
            <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
              <Pressable
                onPress={() => setShowForm(false)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: P.surfaceHigh,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {isDe ? "Abbrechen" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!formValid}
                style={{
                  flex: 2,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: formValid ? P.primary : P.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: formValid ? P.primaryFg : P.fgMuted, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {isEditing ? (isDe ? "Speichern" : "Save") : (isDe ? "Artikel anlegen" : "Create article")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          /* ── List view ── */
          <>
            {/* Category filter tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, borderBottomWidth: 1, borderColor: P.border }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
            >
              {(["all", ...ARTIKEL_CAT_LIST] as (KasseArtikelCategory | "all")[]).map((c) => {
                const active = filterCat === c;
                const accent = c === "all" ? "#6366f1" : (P.catColor[c] ?? P.primary);
                return (
                  <Pressable
                    key={c}
                    onPress={() => setFilterCat(c)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: active ? accent + "22" : P.bg,
                      borderWidth: 1.5,
                      borderColor: active ? accent : P.border,
                    }}
                  >
                    {c !== "all" && <Text style={{ fontSize: 13 }}>{P.catEmoji[c]}</Text>}
                    <Text style={{ color: active ? accent : P.fgMuted, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      {catLabel(c)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Article list */}
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {visibleArtikel.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Feather name="package" size={32} color={P.border} />
                  <Text style={{ color: P.fgMuted, fontSize: 13 }}>
                    {isDe ? "Keine Artikel in dieser Kategorie" : "No articles in this category"}
                  </Text>
                </View>
              ) : (
                visibleArtikel.map((a) => {
                  const accent = P.catColor[a.category] ?? P.primary;
                  const isDeleting = confirmDeleteId === a.id;
                  return (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: P.bg,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDeleting ? P.danger : P.border,
                        padding: 12,
                        gap: 12,
                      }}
                    >
                      {/* Category dot */}
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: accent + "22",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{P.catEmoji[a.category]}</Text>
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: P.fg, fontFamily: "Inter_600SemiBold", fontSize: 14 }} numberOfLines={1}>
                          {a.name}
                        </Text>
                        <Text style={{ color: P.fgMuted, fontSize: 12 }}>
                          {a.price.toFixed(2).replace(".", ",")} € · {a.vat}% MwSt. · {catLabel(a.category)}
                        </Text>
                      </View>

                      {isDeleting ? (
                        /* Confirm delete */
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable
                            onPress={() => setConfirmDeleteId(null)}
                            style={{ padding: 8, borderRadius: 8, backgroundColor: P.surfaceHigh }}
                          >
                            <Feather name="x" size={16} color={P.fg} />
                          </Pressable>
                          <Pressable
                            onPress={() => { onRemove(a.id); setConfirmDeleteId(null); }}
                            style={{ padding: 8, borderRadius: 8, backgroundColor: P.danger }}
                          >
                            <Feather name="trash-2" size={16} color="#fff" />
                          </Pressable>
                        </View>
                      ) : (
                        /* Edit / delete buttons */
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable
                            onPress={() => openEdit(a)}
                            style={{ padding: 8, borderRadius: 8, backgroundColor: P.surfaceHigh }}
                          >
                            <Feather name="edit-2" size={16} color={P.fg} />
                          </Pressable>
                          <Pressable
                            onPress={() => setConfirmDeleteId(a.id)}
                            style={{ padding: 8, borderRadius: 8, backgroundColor: P.surfaceHigh }}
                          >
                            <Feather name="trash-2" size={16} color={P.danger} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Footer actions */}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                padding: 16,
                borderTopWidth: 1,
                borderColor: P.border,
              }}
            >
              <Pressable
                onPress={() => { onQuickAdd(); onClose(); }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: P.surfaceHigh,
                  borderWidth: 1,
                  borderColor: P.border,
                }}
              >
                <Feather name="zap" size={15} color={P.fgMuted} />
                <Text style={{ color: P.fgMuted, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {isDe ? "Einmalig" : "One-time"}
                </Text>
              </Pressable>
              <Pressable
                onPress={openNew}
                style={{
                  flex: 2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: P.primary,
                }}
              >
                <Feather name="plus" size={15} color={P.primaryFg} />
                <Text style={{ color: P.primaryFg, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {isDe ? "Neuer Artikel" : "New article"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

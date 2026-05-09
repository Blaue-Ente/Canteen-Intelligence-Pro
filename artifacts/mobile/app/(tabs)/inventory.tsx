import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, Field } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { distributeOrder } from "@/lib/ai";
import { ALL_ALLERGENS, missingAllergenWarnings, suggestAllergensFromName } from "@/lib/allergens";
import type { Allergen, InventoryItem, OrderDraft } from "@/types";

const CATS = ["all", "meat", "dairy", "vegetable", "fruit", "dry", "spice", "frozen"] as const;
type SortMode = "name" | "supplier" | "stock" | "category";

// Generate a printable revision table HTML
function revisionHtml(
  items: InventoryItem[],
  supplierMap: Record<string, string>,
  locale: "de" | "en",
): string {
  const date = new Date().toLocaleDateString(locale === "de" ? "de-DE" : "en-GB");
  const rows = items
    .map((i) => {
      const name = locale === "de" ? i.nameDe : i.name;
      const sup = i.supplierId ? (supplierMap[i.supplierId] ?? "—") : "—";
      const low = i.quantity < i.minQuantity;
      return `<tr style="${low ? "background:#fff1f2" : ""}">
        <td>${i.articleNo ?? ""}</td>
        <td>${name}</td>
        <td>${sup}</td>
        <td style="text-align:center">${i.unit}</td>
        <td style="text-align:right;font-weight:700;color:${low ? "#dc2626" : "#111"}">${i.quantity}</td>
        <td style="text-align:right">${i.minQuantity}</td>
        <td style="text-align:right">€${i.pricePerUnit.toFixed(2)}</td>
        <td style="width:80px;border:1px solid #ccc">&nbsp;</td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Inventur ${date}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:16px}
    h2{margin:0 0 4px}p{margin:0 0 12px;color:#666}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e5e7eb;padding:5px 8px;text-align:left;white-space:nowrap}
    th{background:#f3f4f6;font-weight:700}
    @media print{body{margin:0}button{display:none}}
  </style></head><body>
  <h2>Inventur / Revision — ${date}</h2>
  <p>Bitte Ist-Bestand eintragen und Unterschrift leisten.</p>
  <table>
    <thead><tr>
      <th>#Art</th><th>Artikel</th><th>Lieferant</th>
      <th>Einheit</th><th>Soll</th><th>Min</th><th>Preis</th><th>Ist (Handschrift)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:20px">Datum: ________________ &nbsp;&nbsp; Unterschrift: ________________________________</p>
  <button onclick="window.print()" style="margin-top:12px;padding:8px 20px;background:#f59e0b;border:none;border-radius:6px;cursor:pointer;font-size:13px">Drucken / Print</button>
  </body></html>`;
}

export default function Inventory() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const author = useAuthor();

  const locId = state.currentLocationId;
  const currentLoc = state.locations.find((l) => l.id === locId);

  // An item belongs to the active location if its locationId matches,
  // OR it has no locationId at all (shared/unassigned items always show).
  const matchesLoc = (i: InventoryItem) =>
    !locId || !i.locationId || i.locationId === locId;

  const shortages = useMemo(
    () => state.inventory.filter((i) => i.quantity < i.minQuantity && matchesLoc(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventory, locId],
  );

  // LMIV warning: items where heuristic expects an allergen tag but none is set.
  const allergenWarnings = useMemo(
    () => missingAllergenWarnings(state.inventory.filter(matchesLoc)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.inventory, locId],
  );

  const createOrders = async () => {
    if (shortages.length === 0) return;
    if (state.suppliers.length === 0) {
      Alert.alert(
        state.locale === "de" ? "Keine Lieferanten" : "No suppliers",
        state.locale === "de"
          ? "Bitte zuerst mindestens einen Lieferanten anlegen."
          : "Please add at least one supplier first.",
        [{ text: "OK", onPress: () => router.push("/supplier/new") }],
      );
      return;
    }
    setOrderBusy(true);
    try {
      const result = await distributeOrder({
        locale: state.locale,
        suppliers: state.suppliers.map((s) => ({ id: s.id, name: s.name, categories: s.category })),
        shortages: shortages.map((i) => ({
          inventoryId: i.id,
          name: state.locale === "de" ? i.nameDe : i.name,
          needed: Math.max(i.minQuantity - i.quantity, i.minQuantity * 0.5),
          unit: i.unit,
          category: i.category,
          pricePerUnit: i.pricePerUnit,
          preferredSupplierId: i.supplierId,
        })),
      });

      // Group items by resolved supplier id, falling back gracefully so nothing is dropped.
      const byId = new Map<string, OrderDraft>();
      const ensure = (supplier: typeof state.suppliers[number], reason?: string): OrderDraft => {
        let d = byId.get(supplier.id);
        if (!d) {
          d = {
            id: newId(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierEmail: supplier.email,
            items: [],
            total: 0,
            status: "draft",
            createdAt: new Date().toISOString(),
            notes: reason,
            ...author,
          };
          byId.set(supplier.id, d);
        } else if (reason && !d.notes) {
          d.notes = reason;
        }
        return d;
      };

      const resolveSupplier = (
        rawId: string | undefined,
        fallbackInventoryId?: string,
      ): typeof state.suppliers[number] => {
        if (rawId) {
          const direct = state.suppliers.find((s) => s.id === rawId);
          if (direct) return direct;
        }
        if (fallbackInventoryId) {
          const inv = state.inventory.find((i) => i.id === fallbackInventoryId);
          if (inv?.supplierId) {
            const pref = state.suppliers.find((s) => s.id === inv.supplierId);
            if (pref) return pref;
            const cat = state.suppliers.find((s) => s.category.includes(inv.category));
            if (cat) return cat;
          }
        }
        return state.suppliers[0]!;
      };

      result.orders.forEach((o) => {
        const supplier = resolveSupplier(o.supplierId, o.items[0]?.inventoryId);
        const draft = ensure(supplier, o.reason);
        o.items.forEach((it) => {
          draft.items.push({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            inventoryId: it.inventoryId,
            estimatedPrice: it.estimatedPrice,
          });
          draft.total = (draft.total ?? 0) + (it.estimatedPrice ?? 0) * it.quantity;
        });
      });

      const drafts = Array.from(byId.values()).filter((d) => d.items.length > 0);
      if (drafts.length === 0) {
        Alert.alert("KI", state.locale === "de" ? "Keine Bestellungen erzeugt." : "No orders generated.");
        return;
      }
      drafts.forEach((d) => dispatch({ type: "addOrder", order: d }));
      router.push("/orders");
    } catch (e) {
      Alert.alert("KI", e instanceof Error ? e.message : "Fehler");
    } finally {
      setOrderBusy(false);
    }
  };

  const supplierMap = useMemo(
    () => Object.fromEntries(state.suppliers.map((s) => [s.id, s.name])),
    [state.suppliers],
  );

  const items = useMemo(() => {
    const filtered = state.inventory.filter((i) => {
      const name = (state.locale === "de" ? i.nameDe : i.name).toLowerCase();
      const okQ = !q || name.includes(q.toLowerCase())
        || (i.articleNo ?? "").toLowerCase().includes(q.toLowerCase());
      const okC = cat === "all" || i.category === cat;
      const okL = matchesLoc(i);
      return okQ && okC && okL;
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "supplier") {
        const sa = supplierMap[a.supplierId ?? ""] ?? "zzz";
        const sb = supplierMap[b.supplierId ?? ""] ?? "zzz";
        return sa.localeCompare(sb) || (a.nameDe || a.name).localeCompare(b.nameDe || b.name);
      }
      if (sortMode === "stock") {
        const la = a.quantity < a.minQuantity ? 0 : 1;
        const lb = b.quantity < b.minQuantity ? 0 : 1;
        return la - lb || a.quantity - b.quantity;
      }
      if (sortMode === "category") return a.category.localeCompare(b.category);
      return (a.nameDe || a.name).localeCompare(b.nameDe || b.name);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inventory, state.locale, q, cat, locId, sortMode, supplierMap]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <View>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 22,
              }}
            >
              {t("inventory")}
            </Text>
            {currentLoc && (
              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 1 }}>
                {currentLoc.name}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/barcode-scanner")}
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="box" size={18} color={c.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/scan")}
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="camera" size={18} color={c.foreground} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/reste")}
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="refresh-ccw" size={18} color={c.foreground} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/procurement")}
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="truck" size={18} color={c.foreground} />
            </Pressable>
            <Pressable
              onPress={() => {
                setEditItem(null);
                setModalOpen(true);
              }}
              style={({ pressed }) => [
                {
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="plus" size={18} color={c.primaryForeground} />
            </Pressable>
          </View>
        </View>
        {/* Location switcher */}
        {state.locations.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            <Pressable
              onPress={() => dispatch({ type: "setCurrentLocation", id: undefined })}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: !locId ? c.primary : c.muted,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{
                color: !locId ? c.primaryForeground : c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}>
                {state.locale === "de" ? "Alle" : "All"}
              </Text>
            </Pressable>
            {state.locations.map((loc) => (
              <Pressable
                key={loc.id}
                onPress={() => dispatch({ type: "setCurrentLocation", id: loc.id })}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: locId === loc.id ? c.primary : c.muted,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{
                  color: locId === loc.id ? c.primaryForeground : c.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}>
                  {loc.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.muted,
            borderRadius: c.radius,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Feather name="search" size={16} color={c.mutedForeground} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("name")}
            placeholderTextColor={c.mutedForeground}
            style={{
              flex: 1,
              marginLeft: 8,
              color: c.foreground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
            }}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}
        >
          {CATS.map((k) => (
            <Chip key={k} label={k === "all" ? "Alle" : k} active={cat === k} onPress={() => setCat(k)} />
          ))}
        </ScrollView>
        {/* Sort + Revision row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>Sort:</Text>
          {(["name", "supplier", "stock", "category"] as SortMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setSortMode(m)}
              style={{
                paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
                backgroundColor: sortMode === m ? c.primary : c.muted,
              }}
            >
              <Text style={{
                color: sortMode === m ? c.primaryForeground : c.mutedForeground,
                fontSize: 11, fontFamily: "Inter_500Medium",
              }}>
                {m === "name" ? "Name" : m === "supplier" ? "Lieferant" : m === "stock" ? "Bestand" : "Kategorie"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={async () => {
              const html = revisionHtml(items, supplierMap, state.locale);
              if (Platform.OS === "web") {
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
              } else {
                const { sharePdf } = await import("@/lib/pdf");
                try { await sharePdf(html, "inventur"); } catch { /* ignore */ }
              }
            }}
            style={{
              marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: c.muted,
            }}
          >
            <Feather name="printer" size={12} color={c.primary} />
            <Text style={{ color: c.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Inventur</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View>
            {allergenWarnings.length > 0 ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: c.radius,
                  backgroundColor: c.destructive + "12",
                  borderWidth: 1,
                  borderColor: c.destructive + "55",
                  marginBottom: 10,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="alert-triangle" size={16} color={c.destructive} />
                  <Text style={{ color: c.destructive, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    {t("allergensMissing")} · {allergenWarnings.length}
                  </Text>
                </View>
                <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {allergenWarnings
                    .slice(0, 3)
                    .map((w) => state.locale === "de" ? w.item.nameDe : w.item.name)
                    .join(", ")}
                  {allergenWarnings.length > 3 ? " …" : ""}
                </Text>
              </View>
            ) : null}
            {shortages.length > 0 ? (
            <Pressable
              onPress={createOrders}
              disabled={orderBusy}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: c.radius,
                  backgroundColor: c.warning + "1a",
                  borderWidth: 1,
                  borderColor: c.warning + "55",
                  marginBottom: 10,
                  opacity: orderBusy ? 0.6 : 1,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: c.warning,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {orderBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Feather name="truck" size={18} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {t("createOrder")} ({shortages.length})
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  {t("autoDistribute")}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={c.mutedForeground} />
            </Pressable>
            ) : null}
          </View>
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 110,
          gap: 8,
        }}
        renderItem={({ item, index }) => {
          const low = item.quantity < item.minQuantity;
          const expSoon =
            item.expiresAt &&
            new Date(item.expiresAt).getTime() - Date.now() < 4 * 24 * 3600 * 1000;
          const supplierName = item.supplierId ? (supplierMap[item.supplierId] ?? null) : null;
          // Show supplier header when sorting by supplier and it changes
          const prevItem = index > 0 ? items[index - 1] : null;
          const showSupplierHeader = sortMode === "supplier" && (
            !prevItem || prevItem.supplierId !== item.supplierId
          );
          return (
            <>
              {showSupplierHeader && (
                <Text style={{
                  color: c.primary, fontFamily: "Inter_700Bold", fontSize: 11,
                  paddingHorizontal: 4, paddingTop: index === 0 ? 0 : 8, paddingBottom: 2,
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {supplierName ?? "— Kein Lieferant —"}
                </Text>
              )}
              <Pressable
                onPress={() => { setEditItem(item); setModalOpen(true); }}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 8, paddingHorizontal: 10,
                  backgroundColor: pressed ? c.muted : c.card,
                  borderRadius: 10, borderWidth: 1,
                  borderColor: low ? c.destructive + "44" : c.border,
                  gap: 8,
                }]}
              >
                {/* Color dot */}
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: low ? c.destructive : expSoon ? c.warning : c.primary,
                  flexShrink: 0, marginTop: 1,
                }} />
                {/* Middle */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
                    {item.articleNo ? (
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                        #{item.articleNo}
                      </Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, flexShrink: 1 }}
                    >
                      {state.locale === "de" ? item.nameDe : item.name}
                    </Text>
                  </View>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    {[
                      supplierName,
                      `€${item.pricePerUnit.toFixed(2)}/${item.unit}`,
                      !locId && item.locationId
                        ? (state.locations.find((l) => l.id === item.locationId)?.name ?? null)
                        : null,
                    ].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {/* Right: qty + unit + badges */}
                <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
                  <Text style={{ color: low ? c.destructive : c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {item.quantity} <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>{item.unit}</Text>
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
                    {low ? <Badge label="Knapp" tone="destructive" /> : null}
                    {expSoon ? <Badge label="Ablauf" tone="warning" /> : null}
                  </View>
                </View>
              </Pressable>
            </>
          );
        }}
      />

      <ItemModal
        open={modalOpen}
        item={editItem}
        defaultLocationId={locId}
        locations={state.locations}
        onClose={() => setModalOpen(false)}
        onSave={(it) => {
          if (editItem) dispatch({ type: "updateInventory", item: it });
          else dispatch({ type: "addInventory", item: it });
          setModalOpen(false);
        }}
        onDelete={(id) => {
          Alert.alert("Löschen?", "", [
            { text: "Abbrechen" },
            {
              text: "Löschen",
              style: "destructive",
              onPress: () => {
                dispatch({ type: "removeInventory", id });
                setModalOpen(false);
              },
            },
          ]);
        }}
        newId={newId}
      />
    </View>
  );
}

function iconFor(
  cat: InventoryItem["category"],
): React.ComponentProps<typeof Feather>["name"] {
  switch (cat) {
    case "meat":
      return "circle";
    case "dairy":
      return "droplet";
    case "vegetable":
    case "fruit":
      return "feather";
    case "dry":
      return "box";
    case "spice":
      return "star";
    case "frozen":
      return "cloud-snow";
    default:
      return "package";
  }
}

function ItemModal({
  open,
  item,
  defaultLocationId,
  locations,
  onClose,
  onSave,
  onDelete,
  newId,
}: {
  open: boolean;
  item: InventoryItem | null;
  defaultLocationId?: string;
  locations: import("@/types").Location[];
  onClose: () => void;
  onSave: (i: InventoryItem) => void;
  onDelete: (id: string) => void;
  newId: () => string;
}) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.nameDe ?? "");
  const [articleNo, setArticleNo] = useState(item?.articleNo ?? "");
  const [qty, setQty] = useState(String(item?.quantity ?? ""));
  const [min, setMin] = useState(String(item?.minQuantity ?? ""));
  const [price, setPrice] = useState(String(item?.pricePerUnit ?? ""));
  const [unit, setUnit] = useState<InventoryItem["unit"]>(item?.unit ?? "kg");
  const [cat, setCat] = useState<InventoryItem["category"]>(item?.category ?? "vegetable");
  const [itemLocId, setItemLocId] = useState<string | undefined>(
    item?.locationId ?? defaultLocationId,
  );
  const [allergens, setAllergens] = useState<Allergen[]>(item?.allergens ?? []);

  React.useEffect(() => {
    if (open) {
      setName(item?.nameDe ?? "");
      setArticleNo(item?.articleNo ?? "");
      setQty(String(item?.quantity ?? ""));
      setMin(String(item?.minQuantity ?? ""));
      setPrice(String(item?.pricePerUnit ?? ""));
      setUnit(item?.unit ?? "kg");
      setCat(item?.category ?? "vegetable");
      setItemLocId(item?.locationId ?? defaultLocationId);
      setAllergens(item?.allergens ?? []);
    }
  }, [open, item, defaultLocationId]);

  // Live suggestions from name → allergens that the user has not yet ticked.
  const suggested = useMemo(() => {
    const have = new Set(allergens);
    return suggestAllergensFromName(name).filter((a) => !have.has(a));
  }, [name, allergens]);

  const toggleAllergen = (a: Allergen) =>
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderColor: c.border,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>
              Abbrechen
            </Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
            {item ? "Bearbeiten" : "Neu"}
          </Text>
          <View style={{ width: 70 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 80 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Field label="Name" value={name} onChangeText={setName} placeholder="z.B. Kartoffeln" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Art.-Nr." value={articleNo} onChangeText={setArticleNo} placeholder="z.B. 1234" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Menge" value={qty} onChangeText={setQty} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Min. Bestand" value={min} onChangeText={setMin} keyboardType="numeric" />
            </View>
          </View>
          <Field label="Preis pro Einheit (€)" value={price} onChangeText={setPrice} keyboardType="numeric" />
          <View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 }}>
              Einheit
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["kg", "g", "l", "ml", "pcs"] as const).map((u) => (
                <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
          </View>
          <View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 }}>
              Kategorie
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["meat", "dairy", "vegetable", "fruit", "dry", "spice", "frozen", "drink", "other"] as const).map((k) => (
                <Chip key={k} label={k} active={cat === k} onPress={() => setCat(k)} />
              ))}
            </View>
          </View>
          {locations.length > 0 && (
            <View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 }}>
                Kantine / Standort
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip
                  label="Alle Standorte"
                  active={!itemLocId}
                  onPress={() => setItemLocId(undefined)}
                />
                {locations.map((loc) => (
                  <Chip
                    key={loc.id}
                    label={loc.name}
                    active={itemLocId === loc.id}
                    onPress={() => setItemLocId(loc.id)}
                  />
                ))}
              </View>
            </View>
          )}
          {/* LMIV: Allergen tagging — chips + name-based suggestion banner. */}
          <View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 }}>
              Allergene
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {ALL_ALLERGENS.map((a) => (
                <Chip
                  key={a.key}
                  label={t(a.tKey as Parameters<typeof t>[0])}
                  active={allergens.includes(a.key)}
                  onPress={() => toggleAllergen(a.key)}
                />
              ))}
            </View>
            {suggested.length > 0 ? (
              <Pressable
                onPress={() => setAllergens((prev) => Array.from(new Set([...prev, ...suggested])))}
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: c.warning + "1a",
                  borderWidth: 1,
                  borderColor: c.warning + "55",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Feather name="alert-circle" size={14} color={c.warning} />
                <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                  {t("allergenSuggestion")}{" "}
                  {suggested.map((a) => {
                    const meta = ALL_ALLERGENS.find((x) => x.key === a)!;
                    return t(meta.tKey as Parameters<typeof t>[0]);
                  }).join(", ")}
                </Text>
                <Text style={{ color: c.warning, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                  {t("addSuggested")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Button
            label="Speichern"
            icon="check"
            onPress={() => {
              const it: InventoryItem = {
                id: item?.id ?? newId(),
                name: name,
                nameDe: name,
                articleNo: articleNo.trim() || undefined,
                unit,
                quantity: Number(qty) || 0,
                minQuantity: Number(min) || 0,
                pricePerUnit: Number(price) || 0,
                category: cat,
                supplierId: item?.supplierId,
                expiresAt: item?.expiresAt,
                location: item?.location,
                locationId: itemLocId,
                allergens: allergens.length > 0 ? allergens : undefined,
                updatedAt: new Date().toISOString(),
              };
              onSave(it);
            }}
          />
          {item ? (
            <Button label="Löschen" icon="trash-2" variant="destructive" onPress={() => onDelete(item.id)} />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

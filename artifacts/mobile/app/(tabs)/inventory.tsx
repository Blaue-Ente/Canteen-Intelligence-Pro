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
import type { InventoryItem, OrderDraft } from "@/types";

const CATS = ["all", "meat", "dairy", "vegetable", "fruit", "dry", "spice", "frozen"] as const;

export default function Inventory() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const author = useAuthor();

  const shortages = useMemo(
    () => state.inventory.filter((i) => i.quantity < i.minQuantity),
    [state.inventory],
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

  const items = useMemo(() => {
    return state.inventory.filter((i) => {
      const name = (state.locale === "de" ? i.nameDe : i.name).toLowerCase();
      const okQ = !q || name.includes(q.toLowerCase());
      const okC = cat === "all" || i.category === cat;
      return okQ && okC;
    });
  }, [state.inventory, state.locale, q, cat]);

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
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 22,
            }}
          >
            {t("inventory")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
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
          contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 4 }}
        >
          {CATS.map((k) => (
            <Chip key={k} label={k === "all" ? "Alle" : k} active={cat === k} onPress={() => setCat(k)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          shortages.length > 0 ? (
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
          ) : null
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 110,
          gap: 8,
        }}
        renderItem={({ item }) => {
          const low = item.quantity < item.minQuantity;
          const expSoon =
            item.expiresAt &&
            new Date(item.expiresAt).getTime() - Date.now() < 4 * 24 * 3600 * 1000;
          return (
            <Card
              onPress={() => {
                setEditItem(item);
                setModalOpen(true);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name={iconFor(item.category)} size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                  }}
                >
                  {state.locale === "de" ? item.nameDe : item.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {low ? <Badge label={t("lowStock")} tone="destructive" /> : null}
                  {expSoon ? <Badge label={t("expiringSoon")} tone="warning" /> : null}
                  <Badge label={`€${item.pricePerUnit.toFixed(2)}/${item.unit}`} />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: low ? c.destructive : c.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 17,
                  }}
                >
                  {item.quantity}
                </Text>
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                  }}
                >
                  {item.unit}
                </Text>
              </View>
            </Card>
          );
        }}
      />

      <ItemModal
        open={modalOpen}
        item={editItem}
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
  onClose,
  onSave,
  onDelete,
  newId,
}: {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (i: InventoryItem) => void;
  onDelete: (id: string) => void;
  newId: () => string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.nameDe ?? "");
  const [qty, setQty] = useState(String(item?.quantity ?? ""));
  const [min, setMin] = useState(String(item?.minQuantity ?? ""));
  const [price, setPrice] = useState(String(item?.pricePerUnit ?? ""));
  const [unit, setUnit] = useState<InventoryItem["unit"]>(item?.unit ?? "kg");
  const [cat, setCat] = useState<InventoryItem["category"]>(item?.category ?? "vegetable");

  React.useEffect(() => {
    if (open) {
      setName(item?.nameDe ?? "");
      setQty(String(item?.quantity ?? ""));
      setMin(String(item?.minQuantity ?? ""));
      setPrice(String(item?.pricePerUnit ?? ""));
      setUnit(item?.unit ?? "kg");
      setCat(item?.category ?? "vegetable");
    }
  }, [open, item]);

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
          <Field label="Name" value={name} onChangeText={setName} placeholder="z.B. Kartoffeln" />
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
          <Button
            label="Speichern"
            icon="check"
            onPress={() => {
              const it: InventoryItem = {
                id: item?.id ?? newId(),
                name: name,
                nameDe: name,
                unit,
                quantity: Number(qty) || 0,
                minQuantity: Number(min) || 0,
                pricePerUnit: Number(price) || 0,
                category: cat,
                supplierId: item?.supplierId,
                expiresAt: item?.expiresAt,
                location: item?.location,
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

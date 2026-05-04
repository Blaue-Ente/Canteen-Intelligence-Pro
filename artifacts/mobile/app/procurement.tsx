import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { parseSupplierPriceList, type ParsedPriceList } from "@/lib/ai";
import { computeShortages } from "@/lib/computations";
import { diffPriceList, mergePriceList, type PriceChange } from "@/lib/priceIngest";
import type { OrderDraft } from "@/types";

const DAY_OPTIONS = [3, 5, 7, 14] as const;

export default function Procurement() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const author = useAuthor();
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);

  // ── T010: Supplier price-list ingest UI ───────────────────────────────────
  const isDe = state.locale === "de";
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPriceList | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});

  const diff: PriceChange[] = useMemo(() => {
    if (!parsed) return [];
    return diffPriceList({
      parsed: parsed.items,
      inventory: state.inventory,
      priceList: state.priceList,
      priceHistory: state.priceHistory,
    });
  }, [parsed, state.inventory, state.priceList, state.priceHistory]);

  const runParse = async () => {
    if (!pasteText.trim() || parsing) return;
    setParsing(true);
    setParseError(null);
    try {
      const r = await parseSupplierPriceList({ text: pasteText, locale: state.locale });
      setParsed(r);
      // Default-accept everything except >5% increases (the user must opt in to those)
      const init: Record<number, boolean> = {};
      const initialDiff = diffPriceList({
        parsed: r.items, inventory: state.inventory,
        priceList: state.priceList, priceHistory: state.priceHistory,
      });
      initialDiff.forEach((d, idx) => {
        const orig = r.items.indexOf(d.parsed);
        init[orig] = d.kind !== "increase";
      });
      setAccepted(init);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "parse failed");
    } finally {
      setParsing(false);
    }
  };

  const acceptIntoPriceList = () => {
    if (!parsed) return;
    const acceptedItems = parsed.items.filter((_, idx) => accepted[idx]);
    if (acceptedItems.length === 0) {
      Alert.alert(isDe ? "Nichts ausgewählt" : "Nothing selected", "");
      return;
    }
    const next = mergePriceList({
      base: state.priceList,
      accepted: acceptedItems,
      supplier: parsed.supplier,
      validFrom: parsed.validFrom,
      validTo: parsed.validTo,
    });
    dispatch({ type: "setPriceList", entries: next });
    Alert.alert(
      isDe ? "Preisliste aktualisiert" : "Price list updated",
      `${acceptedItems.length} ${isDe ? "Einträge übernommen" : "entries applied"}`,
    );
    setParsed(null);
    setPasteText("");
    setPasteOpen(false);
    setAccepted({});
  };

  const shortages = useMemo(
    () => computeShortages(state, days, 25, state.currentLocationId),
    [state, days],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof shortages>();
    for (const s of shortages) {
      const supId = s.preferredSupplierId ?? state.suppliers.find((sup) => sup.category.includes(s.category))?.id ?? "_unassigned";
      const arr = m.get(supId) ?? [];
      arr.push(s);
      m.set(supId, arr);
    }
    return Array.from(m.entries());
  }, [shortages, state.suppliers]);

  const createOrders = () => {
    let count = 0;
    for (const [supId, items] of grouped) {
      const sup = state.suppliers.find((s) => s.id === supId) ?? state.suppliers[0];
      if (!sup) continue;
      const order: OrderDraft = {
        id: newId(),
        supplierId: sup.id,
        supplierName: sup.name,
        supplierEmail: sup.email,
        items: items.map((it) => ({
          name: it.name,
          quantity: it.needed,
          unit: it.unit,
          inventoryId: it.inventoryId,
          estimatedPrice: it.pricePerUnit,
          reason: state.locale === "de" ? `Bedarf ${days} Tage` : `Need ${days} days`,
        })),
        total: items.reduce((a, x) => a + x.needed * x.pricePerUnit, 0),
        status: "draft",
        createdAt: new Date().toISOString(),
        notes: state.locale === "de" ? `Auto-Bestellung aus Menü-Bedarf (${days} Tage)` : `Auto-order from menu need (${days} days)`,
        ...author,
      };
      dispatch({ type: "addOrder", order });
      // T013c: the auto "delivery" HACCP entry is created when goods are
      // physically received (orders.tsx → "Wareneingang bestätigen"), NOT at
      // draft time. Creating it here would log compliance for goods that may
      // never arrive, which violates LMHV intent.
      count++;
    }
    if (count === 0) {
      Alert.alert(state.locale === "de" ? "Keine Lieferanten" : "No suppliers", "");
      return;
    }
    router.push("/orders");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: pasteOpen ? 12 : 0 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Feather name="mail" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {isDe ? "Preisliste vom Lieferanten" : "Supplier price list"}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {isDe
                  ? "E-Mail / PDF-Text einfügen — KI erkennt Preisänderungen automatisch."
                  : "Paste email or PDF text — AI flags price changes automatically."}
              </Text>
            </View>
            <Button
              label={pasteOpen ? (isDe ? "Schließen" : "Close") : (isDe ? "Öffnen" : "Open")}
              icon={pasteOpen ? "x" : "edit-3"}
              variant="secondary"
              onPress={() => { setPasteOpen((v) => !v); if (pasteOpen) { setParsed(null); setPasteText(""); } }}
            />
          </View>

          {pasteOpen ? (
            <View style={{ gap: 10 }}>
              {!parsed ? (
                <>
                  <Field
                    label={isDe ? "E-Mail / PDF-Text" : "Email / PDF text"}
                    value={pasteText}
                    onChangeText={setPasteText}
                    placeholder={isDe
                      ? "Hallo, anbei unsere Preisliste KW 18\nKartoffel festkochend kg  0,89\nMöhren kg               1,15\n..."
                      : "Hi, please find our price list..."}
                    multiline
                  />
                  {parseError ? (
                    <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                      {parseError}
                    </Text>
                  ) : null}
                  <Button
                    label={parsing
                      ? (isDe ? "KI prüft…" : "AI parsing…")
                      : (isDe ? "Mit KI auswerten" : "Parse with AI")}
                    icon="zap"
                    onPress={runParse}
                  />
                </>
              ) : (
                <>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {parsed.supplier ? parsed.supplier : (isDe ? "Lieferant unbekannt" : "Unknown supplier")}
                    {parsed.validFrom ? `  ·  ${isDe ? "gültig ab" : "from"} ${parsed.validFrom}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <Badge label={`${diff.filter((d) => d.kind === "increase").length} ↑`} tone="destructive" />
                    <Badge label={`${diff.filter((d) => d.kind === "decrease").length} ↓`} tone="success" />
                    <Badge label={`${diff.filter((d) => d.kind === "new").length} ${isDe ? "neu" : "new"}`} tone="warning" />
                    <Badge label={`${diff.filter((d) => d.kind === "unchanged").length} =`} />
                  </View>
                  {diff.map((d) => {
                    const origIdx = parsed.items.indexOf(d.parsed);
                    const tone = d.kind === "increase" ? c.destructive
                              : d.kind === "decrease" ? c.success
                              : d.kind === "new"      ? c.warning
                              :                          c.mutedForeground;
                    const arrow = d.kind === "increase" ? "↑"
                                : d.kind === "decrease" ? "↓"
                                : d.kind === "new"      ? "★"
                                :                         "=";
                    return (
                      <Pressable
                        key={`${origIdx}-${d.parsed.name}`}
                        onPress={() => setAccepted((a) => ({ ...a, [origIdx]: !a[origIdx] }))}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 10,
                          paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border,
                        }}
                      >
                        <View
                          style={{
                            width: 18, height: 18, borderRadius: 4,
                            borderWidth: 1.5, borderColor: accepted[origIdx] ? c.primary : c.border,
                            backgroundColor: accepted[origIdx] ? c.primary : "transparent",
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {accepted[origIdx] ? <Feather name="check" size={12} color={c.primaryForeground} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                            {d.parsed.name}
                            {d.matchedName && d.matchedName !== d.parsed.name ? `  ↔ ${d.matchedName}` : ""}
                          </Text>
                          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                            €{d.parsed.pricePerUnit.toFixed(2)} / {d.parsed.unit}
                            {d.previousPrice !== undefined ? ` · ${isDe ? "vorher" : "prev"} €${d.previousPrice.toFixed(2)}` : ""}
                          </Text>
                        </View>
                        <Text style={{ color: tone, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                          {arrow} {d.previousPrice !== undefined ? `${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(1)}%` : (isDe ? "neu" : "new")}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Button
                    label={isDe ? "Ausgewählte übernehmen" : "Apply selected"}
                    icon="check"
                    onPress={acceptIntoPriceList}
                  />
                  <Button
                    label={isDe ? "Verwerfen" : "Discard"}
                    icon="x"
                    variant="ghost"
                    onPress={() => { setParsed(null); setPasteText(""); setAccepted({}); }}
                  />
                </>
              )}
            </View>
          ) : null}
        </Card>

        <Card>
          <SectionHeader title={t("autoProcurement")} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {state.locale === "de"
              ? "KI prüft dein Menü, errechnet fehlende Zutaten und erzeugt Bestellungen pro Lieferant."
              : "AI checks your menu, computes missing ingredients and generates per-supplier orders."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {DAY_OPTIONS.map((d) => (
              <Chip key={d} label={`${d} ${t("days")}`} active={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        </Card>

        {shortages.length === 0 ? (
          <Card>
            <EmptyState
              icon="check-circle"
              title={state.locale === "de" ? "Alles gedeckt" : "All covered"}
              body={state.locale === "de" ? "Aktueller Bestand reicht für den Zeitraum." : "Current stock is sufficient."}
            />
          </Card>
        ) : (
          <>
            {grouped.map(([supId, items]) => {
              const sup = state.suppliers.find((s) => s.id === supId);
              const subtotal = items.reduce((a, x) => a + x.needed * x.pricePerUnit, 0);
              return (
                <Card key={supId}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Feather name="truck" size={16} color={c.primary} />
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8, flex: 1 }}>
                      {sup?.name ?? (state.locale === "de" ? "Ohne Lieferant" : "Unassigned")}
                    </Text>
                    <Badge label={`€${subtotal.toFixed(0)}`} tone="success" />
                  </View>
                  {items.map((it) => (
                    <View
                      key={it.inventoryId}
                      style={{
                        flexDirection: "row",
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
                        {it.name}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        {it.needed} {it.unit}
                      </Text>
                    </View>
                  ))}
                </Card>
              );
            })}
            <Button label={t("createOrder")} icon="send" onPress={createOrders} />
            <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 12 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
                {t("close")}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

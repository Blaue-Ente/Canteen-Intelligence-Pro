/**
 * T011 — Cash register (Voll-Modus only).
 *
 * Lets the operator ring up a sale tied to a Recipe, signs it through the
 * TSE backend, persists a SignedSale, and exposes:
 *   - Daily Z-Bon (Tagesabschluss) per cash register
 *   - DSFinV-K JSON export for the Steuerberater
 *
 * Stub-mode signatures are clearly marked as "Entwicklung — keine
 * Rechtsverbindlichkeit" so no operator accidentally hands a fake receipt
 * to a customer.
 */

import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { FullModeOnly } from "@/components/FullModeOnly";
import { useApp } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatEUR, mulMoney, sumMoney } from "@/lib/money";
import { sharePdf } from "@/lib/pdf";
import { buildZBon, exportDsfinvk, signSale } from "@/lib/tse";
import type { Recipe } from "@/types";

type VatPct = 0 | 7 | 19;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Kasse() {
  return (
    <FullModeOnly silent={false}>
      <KasseInner />
    </FullModeOnly>
  );
}

function KasseInner() {
  const { state, dispatch, newId } = useApp();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const author = useAuthor();
  const isDe = state.locale === "de";
  const [recipeId, setRecipeId] = useState<string>(state.recipes[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [vat, setVat] = useState<VatPct>(7); // canteen food = 7 % default
  const [signing, setSigning] = useState(false);
  const [zDate, setZDate] = useState(todayKey());

  const recipe: Recipe | undefined = useMemo(
    () => state.recipes.find((r) => r.id === recipeId),
    [state.recipes, recipeId],
  );

  const cfgValid = state.tseConfig?.kassennummer && state.tseConfig?.taxId;
  const unitPrice = recipe?.sellPrice ?? recipe?.basePrice ?? 0;
  const qtyN = Math.max(0, Number(qty.replace(",", ".")) || 0);
  const gross = mulMoney(unitPrice, qtyN);

  const todaySales = useMemo(
    () => state.signedSales.filter((s) => s.date === todayKey()),
    [state.signedSales],
  );
  const todayTotal = useMemo(() => sumMoney(todaySales.map((s) => s.revenue)), [todaySales]);

  const stubProvider = state.tseConfig?.provider === "stub" || !state.tseConfig;

  const ring = async () => {
    if (!recipe) {
      Alert.alert(isDe ? "Kein Rezept" : "No recipe", "");
      return;
    }
    if (!cfgValid) {
      Alert.alert(
        isDe ? "TSE nicht konfiguriert" : "TSE not configured",
        isDe
          ? "Bitte trage Kassennummer und Steuernummer in den Einstellungen ein."
          : "Please enter cash register number and tax id in Settings.",
      );
      return;
    }
    if (qtyN <= 0) {
      Alert.alert(isDe ? "Menge prüfen" : "Check quantity", "");
      return;
    }
    setSigning(true);
    try {
      const signed = await signSale({
        sale: {
          id: newId(),
          date: todayKey(),
          recipeId: recipe.id,
          cooked: 0,
          sold: qtyN,
          revenue: gross,
          source: "manual",
          ...author,
        },
        vatPct: vat,
        config: state.tseConfig!,
        prior: state.signedSales,
      });
      dispatch({ type: "addSignedSale", sale: signed });
      // Update lastSignedAt + cache serial
      dispatch({
        type: "setTseConfig",
        config: {
          ...state.tseConfig!,
          serialNumber: signed.tseSerial,
          lastSignedAt: signed.tseTime,
        },
      });
      Alert.alert(
        isDe ? "Beleg signiert" : "Receipt signed",
        `Beleg-Nr ${signed.tseTxNumber}  ·  ${formatEUR(signed.revenue)}` +
          (signed.provider === "stub"
            ? `\n\n${isDe ? "Stub-Modus — keine Rechtsverbindlichkeit." : "Stub mode — not legally binding."}`
            : ""),
      );
      setQty("1");
    } catch (e) {
      Alert.alert(
        isDe ? "TSE-Fehler" : "TSE error",
        e instanceof Error ? e.message : "unknown",
      );
    } finally {
      setSigning(false);
    }
  };

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
      ${stubProvider ? `<div class="stub">⚠ Stub-Modus — Signaturen nicht rechtsverbindlich. Aktiviere fiskaly Cloud TSE für KassenSichV-Konformität.</div>` : ""}
    </body></html>`;
    await sharePdf(html, `z-bon-${zDate}.pdf`);
  };

  const exportDsfinvkJson = async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);
    const data = exportDsfinvk({
      signedSales: state.signedSales,
      kassennummer: state.tseConfig?.kassennummer ?? "K-001",
      fromDate: fromStr,
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

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        {/* Status banner */}
        {stubProvider ? (
          <Card>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Feather name="alert-triangle" size={18} color={c.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {isDe ? "Stub-TSE aktiv" : "Stub TSE active"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {isDe
                    ? "Signaturen werden lokal mit HMAC erzeugt — nicht KassenSichV-konform. Hinterlege FISKALY_API_KEY für rechtsverbindliche TSE."
                    : "Signatures are locally HMAC-stamped — NOT KassenSichV-compliant. Set FISKALY_API_KEY for legally binding TSE."}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Today summary */}
        <Card>
          <SectionHeader title={isDe ? "Heutige Belege" : "Today's receipts"} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label={isDe ? "Anzahl" : "Count"} value={String(todaySales.length)} />
            <Stat label={isDe ? "Brutto" : "Gross"} value={formatEUR(todayTotal)} />
            <Stat label="TSE" value={state.tseConfig?.serialNumber?.slice(0, 8) ?? "—"} />
          </View>
        </Card>

        {/* Ring up */}
        <Card>
          <SectionHeader title={isDe ? "Beleg erstellen" : "Create receipt"} />
          <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>
            {isDe ? "Rezept wählen" : "Select recipe"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {state.recipes.slice(0, 12).map((r) => (
              <Chip
                key={r.id}
                label={`${r.name}  ${formatEUR(r.sellPrice ?? r.basePrice ?? 0)}`}
                active={recipeId === r.id}
                onPress={() => setRecipeId(r.id)}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={isDe ? "Menge (Portionen)" : "Quantity (portions)"}
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11, marginBottom: 4, fontFamily: "Inter_500Medium" }}>
                MwSt
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {([7, 19, 0] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setVat(p)}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
                      borderWidth: 1.5, borderColor: vat === p ? c.primary : c.border,
                      backgroundColor: vat === p ? c.muted : "transparent",
                    }}
                  >
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                      {p}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22, flex: 1 }}>
              {formatEUR(gross)}
            </Text>
            <Badge label={`${qtyN} × ${formatEUR(unitPrice)}`} />
          </View>
          <Button
            label={signing
              ? (isDe ? "Signiere…" : "Signing…")
              : (isDe ? "Signieren & Beleg" : "Sign & receipt")}
            icon="check-square"
            onPress={ring}
          />
        </Card>

        {/* Today log */}
        <Card>
          <SectionHeader title={isDe ? "Belege heute" : "Receipts today"} />
          {todaySales.length === 0 ? (
            <EmptyState
              icon="file-text"
              title={isDe ? "Noch keine Belege" : "No receipts yet"}
              body={isDe ? "Erster Verkauf erscheint hier." : "First sale will appear here."}
            />
          ) : (
            todaySales.slice(0, 30).map((s) => {
              const r = state.recipes.find((x) => x.id === s.recipeId);
              return (
                <View
                  key={s.id}
                  style={{
                    flexDirection: "row", alignItems: "center", paddingVertical: 8,
                    borderBottomWidth: 1, borderColor: c.border, gap: 8,
                  }}
                >
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, width: 38 }}>
                    #{s.tseTxNumber}
                  </Text>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {r?.name ?? s.recipeId}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                    {s.vatPct}%
                  </Text>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    {formatEUR(s.revenue)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        {/* Z-Bon + DSFinV-K */}
        <Card>
          <SectionHeader title={isDe ? "Tagesabschluss & Export" : "Day close & export"} />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[0, 1, 2, 3, 7].map((daysAgo) => {
              const d = new Date();
              d.setDate(d.getDate() - daysAgo);
              const k = d.toISOString().slice(0, 10);
              return (
                <Chip
                  key={k}
                  label={daysAgo === 0 ? (isDe ? "Heute" : "Today") : `−${daysAgo}`}
                  active={zDate === k}
                  onPress={() => setZDate(k)}
                />
              );
            })}
          </View>
          <Button label={isDe ? "Z-Bon (PDF)" : "Z-Bon (PDF)"} icon="printer" variant="secondary" onPress={printZBon} />
          <Button
            label={isDe ? "DSFinV-K Export (30 Tage)" : "DSFinV-K export (30 days)"}
            icon="download"
            variant="secondary"
            onPress={exportDsfinvkJson}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch] ?? ch));
}

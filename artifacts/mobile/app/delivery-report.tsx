import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface ReportLine {
  clerkUserId: string;
  displayName: string;
  dishType: string;
  totalQty: number;
  totalAmount: number;
  currency: string;
}

interface DeliveryReport {
  locationCode: string;
  dateFrom: string;
  dateTo: string;
  lines: ReportLine[];
  grandTotal: number;
  currency: string;
  generatedAt: string;
}

function formatDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function getWeekRange(weeksBack: number): { from: string; to: string } {
  const now = new Date();
  // Monday of target week
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset - weeksBack * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toISO(monday), to: toISO(friday) };
}

function getMonthRange(monthsBack: number): { from: string; to: string } {
  const now = new Date();
  const y = now.getMonth() < monthsBack
    ? now.getFullYear() - 1
    : now.getFullYear();
  const m = ((now.getMonth() - monthsBack + 12) % 12);
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;
  return { from, to };
}

function buildHTML(report: DeliveryReport): string {
  // Group lines by customer
  const byCustomer = new Map<string, { displayName: string; lines: ReportLine[]; subtotal: number }>();
  for (const line of report.lines) {
    if (!byCustomer.has(line.clerkUserId)) {
      byCustomer.set(line.clerkUserId, { displayName: line.displayName, lines: [], subtotal: 0 });
    }
    const c = byCustomer.get(line.clerkUserId)!;
    c.lines.push(line);
    c.subtotal = Math.round((c.subtotal + line.totalAmount) * 100) / 100;
  }

  const customerRows = [...byCustomer.values()].map(({ displayName, lines, subtotal }) => {
    const lineRows = lines.map(l =>
      `<tr>
        <td style="padding:4px 8px;">${l.dishType}</td>
        <td style="padding:4px 8px;text-align:center;">${l.totalQty}</td>
        <td style="padding:4px 8px;text-align:right;">${l.totalAmount.toFixed(2)} ${l.currency}</td>
      </tr>`
    ).join("");
    return `
      <tr style="background:#f9f6f2;">
        <td colspan="3" style="padding:6px 8px;font-weight:700;border-top:2px solid #e8d5bb;">${displayName}</td>
      </tr>
      ${lineRows}
      <tr style="font-weight:600;">
        <td style="padding:4px 8px;" colspan="2">Zwischensumme</td>
        <td style="padding:4px 8px;text-align:right;">${subtotal.toFixed(2)} ${report.currency}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 32px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #c8a96a; color: #fff; padding: 6px 8px; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    tr:nth-child(even) { background: #faf7f2; }
    .total-row td { font-weight: 700; font-size: 14px; border-top: 2px solid #c8a96a; padding: 8px; }
    .footer { margin-top: 32px; color: #999; font-size: 10px; }
  </style>
</head>
<body>
  <h1>Lieferbericht — ${report.locationCode}</h1>
  <div class="meta">
    Zeitraum: ${formatDE(report.dateFrom)} – ${formatDE(report.dateTo)}<br/>
    Erstellt: ${new Date(report.generatedAt).toLocaleString("de-DE")}
  </div>
  <table>
    <thead>
      <tr>
        <th>Essen / Kategorie</th>
        <th style="text-align:center">Menge</th>
        <th>Betrag</th>
      </tr>
    </thead>
    <tbody>
      ${customerRows}
      <tr class="total-row">
        <td colspan="2">Gesamtbetrag</td>
        <td>${report.grandTotal.toFixed(2)} ${report.currency}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    Dieses Dokument ist eine Proforma-Übersicht und dient der internen Abrechnung.
  </div>
</body>
</html>`;
}

export default function DeliveryReportScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [locationCode, setLocationCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  // Finalize day state
  const [finalizeDate, setFinalizeDate] = useState(new Date().toISOString().slice(0, 10));
  const [finalizing, setFinalizing] = useState(false);

  const applyRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const loadReport = useCallback(async () => {
    if (!locationCode.trim() || !dateFrom || !dateTo) {
      Alert.alert("Fehler", "Bitte Standort-Code, Von und Bis angeben.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await apiFetch<DeliveryReport>(
        `/api/preorder/staff/report?locationCode=${encodeURIComponent(locationCode.toUpperCase().trim())}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [locationCode, dateFrom, dateTo]);

  const printPDF = async () => {
    if (!report) return;
    setPrinting(true);
    try {
      const html = buildHTML(report);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Lieferbericht teilen" });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setPrinting(false);
    }
  };

  const finalizeDay = async () => {
    if (!locationCode.trim()) { Alert.alert("Fehler", "Bitte zuerst den Standort-Code eingeben."); return; }
    Alert.alert(
      "Tagesabschluss bestätigen",
      `Alle offenen Bestellungen für ${formatDE(finalizeDate)} bei ${locationCode.toUpperCase()} werden als geliefert markiert und ins Lieferbuch eingetragen.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abschließen", style: "default",
          onPress: async () => {
            setFinalizing(true);
            try {
              const res = await apiFetch<{ written: number }>("/api/preorder/staff/delivery-ledger/finalize-day", {
                method: "POST",
                body: { locationCode: locationCode.toUpperCase().trim(), deliveryDate: finalizeDate },
              });
              Alert.alert("Abgeschlossen", `${res.written} Bestellung(en) ins Lieferbuch eingetragen.`);
            } catch (e) {
              Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
            } finally {
              setFinalizing(false);
            }
          },
        },
      ],
    );
  };

  // Group report lines by customer for display
  const byCustomer = report
    ? [...new Map(
        report.lines.map(l => [l.clerkUserId, { displayName: l.displayName, clerkUserId: l.clerkUserId }])
      ).values()].map(({ displayName, clerkUserId }) => ({
        displayName,
        clerkUserId,
        lines: report.lines.filter(l => l.clerkUserId === clerkUserId),
        subtotal: report.lines.filter(l => l.clerkUserId === clerkUserId).reduce((s, l) => s + l.totalAmount, 0),
      }))
    : [];

  const inputStyle = {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    padding: 10, color: c.foreground, backgroundColor: c.card,
    fontFamily: "Inter_400Regular", fontSize: 14,
  };
  const labelStyle = { color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 };
  const kwNow = getWeekRange(0);
  const kwPrev = getWeekRange(1);
  const mNow = getMonthRange(0);
  const mPrev = getMonthRange(1);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <SectionHeader title="Lieferbericht" />
        </View>

        {/* Tagesabschluss */}
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            Tagesabschluss
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            Alle offenen Bestellungen für ein Datum werden als geliefert markiert und ins Lieferbuch eingetragen — mit den individuell vereinbarten Preisen.
          </Text>
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Standort-Code *</Text>
            <TextInput
              style={inputStyle}
              value={locationCode}
              onChangeText={(v) => setLocationCode(v.toUpperCase())}
              placeholder="z.B. BERLIN-MITTE"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="characters"
            />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Lieferdatum</Text>
            <TextInput
              style={inputStyle}
              value={finalizeDate}
              onChangeText={setFinalizeDate}
              placeholder="JJJJ-MM-TT"
              placeholderTextColor={c.mutedForeground}
            />
          </View>
          <Button
            label={finalizing ? "Verarbeite…" : "Tagesabschluss durchführen"}
            onPress={finalizeDay}
            disabled={finalizing}
          />
        </Card>

        {/* Report filters */}
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            Zeitraum-Bericht
          </Text>

          {/* Quick range shortcuts */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[
              { label: "Diese Woche", ...kwNow },
              { label: "Letzte Woche", ...kwPrev },
              { label: "Dieser Monat", ...mNow },
              { label: "Letzter Monat", ...mPrev },
            ].map((r) => (
              <Pressable
                key={r.label}
                onPress={() => applyRange(r.from, r.to)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: dateFrom === r.from && dateTo === r.to ? c.primary : c.muted,
                  borderWidth: 1,
                  borderColor: dateFrom === r.from && dateTo === r.to ? c.primary : c.border,
                }}
              >
                <Text style={{
                  color: dateFrom === r.from && dateTo === r.to ? c.primaryForeground : c.foreground,
                  fontSize: 12, fontFamily: "Inter_500Medium",
                }}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={labelStyle}>Von (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="2026-01-06"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={labelStyle}>Bis (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="2026-01-31"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>

          <Button
            label={loading ? "Lade Bericht…" : "Bericht laden"}
            onPress={loadReport}
            disabled={loading}
          />
        </Card>

        {/* Loading / error */}
        {loading && (
          <View style={{ padding: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        )}
        {error && (
          <Card><Text style={{ color: c.destructive }}>{error}</Text></Card>
        )}

        {/* Report results */}
        {report && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  {report.locationCode}
                </Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                  {formatDE(report.dateFrom)} – {formatDE(report.dateTo)}
                </Text>
              </View>
              <Pressable
                onPress={printPDF}
                disabled={printing}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: 999, backgroundColor: c.primary,
                }}
              >
                <Feather name="printer" size={14} color={c.primaryForeground} />
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {printing ? "Drucke…" : "PDF drucken"}
                </Text>
              </Pressable>
            </View>

            {byCustomer.length === 0 ? (
              <EmptyState
                icon="file-text"
                title="Keine Einträge"
                body="Für den gewählten Zeitraum wurden keine Lieferungen gefunden."
              />
            ) : (
              byCustomer.map(({ displayName, clerkUserId: cid, lines, subtotal }) => (
                <Card key={cid} style={{ gap: 8 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {displayName}
                  </Text>
                  {lines.map((line, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row", justifyContent: "space-between",
                        paddingVertical: 4,
                        borderBottomWidth: i < lines.length - 1 ? 1 : 0,
                        borderBottomColor: c.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.foreground, fontSize: 14 }}>{line.dishType}</Text>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{line.totalQty}× Portion</Text>
                      </View>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {line.totalAmount.toFixed(2)} {line.currency}
                      </Text>
                    </View>
                  ))}
                  <View style={{
                    flexDirection: "row", justifyContent: "space-between",
                    paddingTop: 6, borderTopWidth: 2, borderTopColor: c.primary,
                  }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" }}>Zwischensumme</Text>
                    <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {subtotal.toFixed(2)} {report.currency}
                    </Text>
                  </View>
                </Card>
              ))
            )}

            {/* Grand total */}
            {byCustomer.length > 0 && (
              <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
                  Gesamtbetrag
                </Text>
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                  {report.grandTotal.toFixed(2)} {report.currency}
                </Text>
              </Card>
            )}

            <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: "center" }}>
              Proforma-Übersicht · Erstellt {new Date(report.generatedAt).toLocaleString("de-DE")}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

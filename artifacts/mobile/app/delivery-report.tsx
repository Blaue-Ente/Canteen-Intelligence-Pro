import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface PlanDish {
  dishName: string;
  totalQty: number;
  byStatus: Record<string, number>;
}
interface PlanDay {
  date: string;
  dishes: PlanDish[];
  totalPortions: number;
}
interface ProductionPlan {
  locationCode: string;
  dateFrom: string;
  dateTo: string;
  days: PlanDay[];
  grandTotal: number;
  generatedAt: string;
}

interface RecDish {
  dishName: string;
  planned: number;
  delivered: number;
  diff: number;
}
interface RecDay {
  date: string;
  dishes: RecDish[];
  totalPlanned: number;
  totalDelivered: number;
}
interface WeeklyReconciliation {
  locationCode: string;
  kwYear: number;
  kwNumber: number;
  dateFrom: string;
  dateTo: string;
  days: RecDay[];
  generatedAt: string;
}

type Tab = "finalize" | "plan" | "reconcile" | "report";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
  return { year, week };
}

function getWeekRange(weeksBack: number): { from: string; to: string } {
  const now = new Date();
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
  const y = now.getMonth() < monthsBack ? now.getFullYear() - 1 : now.getFullYear();
  const m = ((now.getMonth() - monthsBack + 12) % 12);
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;
  return { from, to };
}

const WEEKDAYS_DE: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 0: "So" };
function dayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${WEEKDAYS_DE[d.getDay()] ?? ""} ${formatDE(iso)}`;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#6b7280",
  accepted: "#3b82f6",
  preparing: "#f59e0b",
  ready: "#10b981",
  served: "#16a34a",
};
const STATUS_DE: Record<string, string> = {
  new: "Neu", accepted: "Bestätigt", preparing: "In Zubereitung", ready: "Bereit", served: "Geliefert",
};

// ─── PDF builders ─────────────────────────────────────────────────────────────

function buildDeliveryHTML(report: DeliveryReport): string {
  const byCustomer = new Map<string, { displayName: string; lines: ReportLine[]; subtotal: number }>();
  for (const line of report.lines) {
    if (!byCustomer.has(line.clerkUserId)) byCustomer.set(line.clerkUserId, { displayName: line.displayName, lines: [], subtotal: 0 });
    const c = byCustomer.get(line.clerkUserId)!;
    c.lines.push(line);
    c.subtotal = Math.round((c.subtotal + line.totalAmount) * 100) / 100;
  }
  const rows = [...byCustomer.values()].map(({ displayName, lines, subtotal }) =>
    `<tr style="background:#f9f6f2;"><td colspan="3" style="padding:6px 8px;font-weight:700;border-top:2px solid #e8d5bb;">${displayName}</td></tr>` +
    lines.map(l => `<tr><td style="padding:4px 8px;">${l.dishType}</td><td style="padding:4px 8px;text-align:center;">${l.totalQty}</td><td style="padding:4px 8px;text-align:right;">${l.totalAmount.toFixed(2)} ${l.currency}</td></tr>`).join("") +
    `<tr style="font-weight:600;"><td style="padding:4px 8px;" colspan="2">Zwischensumme</td><td style="padding:4px 8px;text-align:right;">${subtotal.toFixed(2)} ${report.currency}</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:32px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:11px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#c8a96a;color:#fff;padding:6px 8px;text-align:left}th:last-child,td:last-child{text-align:right}tr:nth-child(even){background:#faf7f2}.total-row td{font-weight:700;font-size:14px;border-top:2px solid #c8a96a;padding:8px}.footer{margin-top:32px;color:#999;font-size:10px}</style></head><body><h1>Lieferbericht — ${report.locationCode}</h1><div class="meta">Zeitraum: ${formatDE(report.dateFrom)} – ${formatDE(report.dateTo)}<br/>Erstellt: ${new Date(report.generatedAt).toLocaleString("de-DE")}</div><table><thead><tr><th>Essen / Kategorie</th><th style="text-align:center">Menge</th><th>Betrag</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="2">Gesamtbetrag</td><td>${report.grandTotal.toFixed(2)} ${report.currency}</td></tr></tbody></table><div class="footer">Proforma-Übersicht · interne Abrechnung</div></body></html>`;
}

function buildPlanHTML(plan: ProductionPlan): string {
  const dayRows = plan.days.map(day => {
    const dishRows = day.dishes.map(d =>
      `<tr><td style="padding:4px 8px;">${d.dishName}</td><td style="padding:4px 8px;text-align:center;font-weight:700;font-size:16px;">${d.totalQty}</td><td style="padding:4px 8px;font-size:11px;color:#666;">${Object.entries(d.byStatus).map(([s, q]) => `${STATUS_DE[s] ?? s}: ${q}`).join(" · ")}</td></tr>`
    ).join("");
    return `<tr style="background:#f0f9f4;"><td colspan="3" style="padding:8px;font-weight:700;border-top:3px solid #c8a96a;">${dayLabel(day.date)} — ${day.totalPortions} Portionen gesamt</td></tr>${dishRows}`;
  }).join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:32px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:11px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#16a34a;color:#fff;padding:6px 8px;text-align:left}tr:nth-child(even){background:#fafafa}.footer{margin-top:32px;color:#999;font-size:10px}</style></head><body><h1>Produktionsplan — ${plan.locationCode}</h1><div class="meta">Zeitraum: ${formatDE(plan.dateFrom)} – ${formatDE(plan.dateTo)}<br/>Gesamt: ${plan.grandTotal} Portionen<br/>Erstellt: ${new Date(plan.generatedAt).toLocaleString("de-DE")}</div><table><thead><tr><th>Gericht</th><th style="text-align:center">Portionen</th><th>Bestellstatus</th></tr></thead><tbody>${dayRows}</tbody></table><div class="footer">Kücheninterner Produktionsplan — bitte nicht an Gäste weitergeben</div></body></html>`;
}

function buildRecHTML(rec: WeeklyReconciliation): string {
  const dayRows = rec.days.map(day => {
    const dishRows = day.dishes.map(d => {
      const diffColor = d.diff < 0 ? "#dc2626" : d.diff > 0 ? "#f59e0b" : "#16a34a";
      return `<tr><td style="padding:4px 8px;">${d.dishName}</td><td style="padding:4px 8px;text-align:center;">${d.planned}</td><td style="padding:4px 8px;text-align:center;">${d.delivered}</td><td style="padding:4px 8px;text-align:center;font-weight:700;color:${diffColor};">${d.diff >= 0 ? "+" : ""}${d.diff}</td></tr>`;
    }).join("");
    return `<tr style="background:#faf7f2;"><td colspan="4" style="padding:8px;font-weight:700;border-top:3px solid #c8a96a;">${dayLabel(day.date)} — Plan: ${day.totalPlanned} · Geliefert: ${day.totalDelivered}</td></tr>${dishRows}`;
  }).join("");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:32px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:11px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#c8a96a;color:#fff;padding:6px 8px;text-align:left}tr:nth-child(even){background:#fafafa}.footer{margin-top:32px;color:#999;font-size:10px}</style></head><body><h1>Wochenabgleich KW ${rec.kwNumber}/${rec.kwYear} — ${rec.locationCode}</h1><div class="meta">${formatDE(rec.dateFrom)} – ${formatDE(rec.dateTo)}<br/>Erstellt: ${new Date(rec.generatedAt).toLocaleString("de-DE")}</div><table><thead><tr><th>Gericht</th><th style="text-align:center">Geplant</th><th style="text-align:center">Geliefert</th><th style="text-align:center">Differenz</th></tr></thead><tbody>${dayRows}</tbody></table><div class="footer">Wochenabgleich — Plan vs. tatsächliche Lieferung</div></body></html>`;
}

async function printHTML(html: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: title });
  } else {
    await Print.printAsync({ uri });
  }
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ label, icon, active, onPress, c }: {
  label: string; icon: string; active: boolean;
  onPress: () => void; c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 4,
        borderRadius: 12, gap: 3,
        backgroundColor: active ? c.primary : c.muted,
      }}
    >
      <Feather name={icon as never} size={16} color={active ? c.primaryForeground : c.mutedForeground} />
      <Text style={{
        color: active ? c.primaryForeground : c.mutedForeground,
        fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center",
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Shared input styles factory ──────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useColors>) {
  return {
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 8,
      padding: 10, color: c.foreground, backgroundColor: c.card,
      fontFamily: "Inter_400Regular" as const, fontSize: 14,
    },
    label: {
      color: c.mutedForeground, fontSize: 12,
      fontFamily: "Inter_500Medium" as const, marginBottom: 4,
    },
  };
}

// ─── Section: Tagesabschluss ──────────────────────────────────────────────────

function FinalizeSection({ locationCode, c }: { locationCode: string; c: ReturnType<typeof useColors> }) {
  const { input, label } = makeStyles(c);
  const [finalizeDate, setFinalizeDate] = useState(new Date().toISOString().slice(0, 10));
  const [finalizing, setFinalizing] = useState(false);

  const finalizeDay = async () => {
    if (!locationCode.trim()) { Alert.alert("Fehler", "Standort-Code fehlt oben."); return; }
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
            } catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
            finally { setFinalizing(false); }
          },
        },
      ],
    );
  };

  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Tagesabschluss</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
        Alle angenommenen/zubereiteten Bestellungen für ein Datum werden abgeschlossen und mit den vereinbarten Kundenpreisen ins Lieferbuch übertragen.
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={label}>Lieferdatum</Text>
        <TextInput style={input} value={finalizeDate} onChangeText={setFinalizeDate} placeholder="JJJJ-MM-TT" placeholderTextColor={c.mutedForeground} />
      </View>
      <Button label={finalizing ? "Verarbeite…" : "Tagesabschluss durchführen"} onPress={finalizeDay} disabled={finalizing} />
    </Card>
  );
}

// ─── Section: Produktionsplan ─────────────────────────────────────────────────

function ProductionPlanSection({ locationCode, c }: { locationCode: string; c: ReturnType<typeof useColors> }) {
  const { input, label } = makeStyles(c);
  const kwNow = getWeekRange(0);
  const kwNext = getWeekRange(-1);

  const [dateFrom, setDateFrom] = useState(kwNow.from);
  const [dateTo, setDateTo] = useState(kwNow.to);
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!locationCode.trim() || !dateFrom || !dateTo) {
      Alert.alert("Fehler", "Standort-Code und Zeitraum angeben."); return;
    }
    setLoading(true); setPlan(null);
    try {
      const data = await apiFetch<ProductionPlan>(
        `/api/preorder/staff/production-plan?locationCode=${encodeURIComponent(locationCode.toUpperCase().trim())}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setPlan(data);
    } catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [locationCode, dateFrom, dateTo]);

  const doPrint = async () => {
    if (!plan) return;
    setPrinting(true);
    try { await printHTML(buildPlanHTML(plan), "Produktionsplan drucken"); }
    catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setPrinting(false); }
  };

  const Chip = ({ label: lbl, from, to }: { label: string; from: string; to: string }) => (
    <Pressable
      onPress={() => { setDateFrom(from); setDateTo(to); }}
      style={{
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: dateFrom === from && dateTo === to ? c.primary : c.muted,
        borderWidth: 1, borderColor: dateFrom === from && dateTo === to ? c.primary : c.border,
      }}
    >
      <Text style={{
        color: dateFrom === from && dateTo === to ? c.primaryForeground : c.foreground,
        fontSize: 12, fontFamily: "Inter_500Medium",
      }}>{lbl}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Produktionsplan</Text>
          {plan && (
            <Pressable
              onPress={doPrint} disabled={printing}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#16a34a" }}
            >
              <Feather name="printer" size={13} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{printing ? "Drucke…" : "PDF"}</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          Zeigt wie viele Portionen jedes Gerichts für die Außenstellen zubereitet werden müssen — auf Basis der aktuell offenen Bestellungen.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Chip label="Diese Woche" from={kwNow.from} to={kwNow.to} />
          <Chip label="Nächste Woche" from={kwNext.from} to={kwNext.to} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>Von</Text>
            <TextInput style={input} value={dateFrom} onChangeText={setDateFrom} placeholder="JJJJ-MM-TT" placeholderTextColor={c.mutedForeground} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>Bis</Text>
            <TextInput style={input} value={dateTo} onChangeText={setDateTo} placeholder="JJJJ-MM-TT" placeholderTextColor={c.mutedForeground} />
          </View>
        </View>
        <Button label={loading ? "Lade Plan…" : "Produktionsplan laden"} onPress={load} disabled={loading} />
      </Card>

      {loading && <View style={{ padding: 24, alignItems: "center" }}><ActivityIndicator color={c.primary} /></View>}

      {plan && (
        <>
          {/* Grand total banner */}
          <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>Gesamtportionen</Text>
              <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {formatDE(plan.dateFrom)} – {formatDE(plan.dateTo)}
              </Text>
            </View>
            <Text style={{ color: "#16a34a", fontFamily: "Inter_700Bold", fontSize: 32 }}>{plan.grandTotal}</Text>
          </Card>

          {plan.days.length === 0 ? (
            <EmptyState icon="coffee" title="Keine Bestellungen" body="Für diesen Zeitraum liegen keine offenen Bestellungen vor." />
          ) : (
            plan.days.map((day) => (
              <Card key={day.date} style={{ gap: 0, padding: 0, overflow: "hidden" }}>
                {/* Day header */}
                <View style={{ backgroundColor: "#16a34a" + "22", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{dayLabel(day.date)}</Text>
                  <View style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>{day.totalPortions} Portionen</Text>
                  </View>
                </View>
                {/* Dishes */}
                {day.dishes.map((dish, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
                      borderTopWidth: 1, borderTopColor: c.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{dish.dishName}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        {Object.entries(dish.byStatus).map(([s, q]) => (
                          <Text key={s} style={{ color: STATUS_COLORS[s] ?? c.mutedForeground }}>
                            {STATUS_DE[s] ?? s}: {q}{"  "}
                          </Text>
                        ))}
                      </Text>
                    </View>
                    <Text style={{ color: "#16a34a", fontFamily: "Inter_700Bold", fontSize: 24, minWidth: 48, textAlign: "right" }}>
                      {dish.totalQty}
                    </Text>
                  </View>
                ))}
              </Card>
            ))
          )}
          <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: "center" }}>
            Stand: {new Date(plan.generatedAt).toLocaleString("de-DE")}
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Section: Wochenabgleich ──────────────────────────────────────────────────

function ReconcileSection({ locationCode, c }: { locationCode: string; c: ReturnType<typeof useColors> }) {
  const { input, label } = makeStyles(c);
  const { year: curYear, week: curWeek } = getISOWeek(new Date());

  const [kwYear, setKwYear] = useState(String(curYear));
  const [kwNumber, setKwNumber] = useState(String(curWeek));
  const [rec, setRec] = useState<WeeklyReconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!locationCode.trim()) { Alert.alert("Fehler", "Standort-Code fehlt."); return; }
    setLoading(true); setRec(null);
    try {
      const data = await apiFetch<WeeklyReconciliation>(
        `/api/preorder/staff/weekly-reconciliation?locationCode=${encodeURIComponent(locationCode.toUpperCase().trim())}&kwYear=${kwYear}&kwNumber=${kwNumber}`,
      );
      setRec(data);
    } catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [locationCode, kwYear, kwNumber]);

  const doPrint = async () => {
    if (!rec) return;
    setPrinting(true);
    try { await printHTML(buildRecHTML(rec), "Wochenabgleich drucken"); }
    catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setPrinting(false); }
  };

  const totalPlanned = rec?.days.reduce((s, d) => s + d.totalPlanned, 0) ?? 0;
  const totalDelivered = rec?.days.reduce((s, d) => s + d.totalDelivered, 0) ?? 0;
  const totalDiff = totalDelivered - totalPlanned;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Wochenabgleich</Text>
          {rec && (
            <Pressable
              onPress={doPrint} disabled={printing}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primary }}
            >
              <Feather name="printer" size={13} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{printing ? "Drucke…" : "PDF"}</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          Vergleich: geplante Bestellungen vs. tatsächlich ins Lieferbuch eingetragene Portionen für eine Kalenderwoche.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>KW-Nummer</Text>
            <TextInput style={input} value={kwNumber} onChangeText={setKwNumber} keyboardType="number-pad" placeholder="z.B. 20" placeholderTextColor={c.mutedForeground} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>Jahr</Text>
            <TextInput style={input} value={kwYear} onChangeText={setKwYear} keyboardType="number-pad" placeholder="z.B. 2026" placeholderTextColor={c.mutedForeground} />
          </View>
        </View>
        {/* KW navigator shortcuts */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[{ label: "Letzte KW", delta: -1 }, { label: "Diese KW", delta: 0 }, { label: "Nächste KW", delta: 1 }].map(({ label: lbl, delta }) => {
            const { year: y, week: w } = (() => {
              const d = new Date(); d.setDate(d.getDate() + delta * 7);
              return getISOWeek(d);
            })();
            const isActive = kwYear === String(y) && kwNumber === String(w);
            return (
              <Pressable
                key={lbl}
                onPress={() => { setKwYear(String(y)); setKwNumber(String(w)); }}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8,
                  backgroundColor: isActive ? c.primary : c.muted,
                  borderWidth: 1, borderColor: isActive ? c.primary : c.border,
                }}
              >
                <Text style={{ color: isActive ? c.primaryForeground : c.foreground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{lbl}</Text>
                <Text style={{ color: isActive ? c.primaryForeground : c.mutedForeground, fontSize: 10 }}>KW {w}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={loading ? "Lade Abgleich…" : "Wochenabgleich laden"} onPress={load} disabled={loading} />
      </Card>

      {loading && <View style={{ padding: 24, alignItems: "center" }}><ActivityIndicator color={c.primary} /></View>}

      {rec && (
        <>
          {/* Summary banner */}
          <Card style={{ flexDirection: "row", gap: 0 }}>
            {[
              { lbl: "Geplant", val: totalPlanned, color: c.foreground },
              { lbl: "Geliefert", val: totalDelivered, color: "#16a34a" },
              { lbl: "Differenz", val: totalDiff, color: totalDiff < 0 ? "#dc2626" : totalDiff > 0 ? "#f59e0b" : "#16a34a" },
            ].map(({ lbl, val, color }, i) => (
              <View key={lbl} style={{ flex: 1, alignItems: "center", paddingVertical: 4, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: c.border }}>
                <Text style={{ color: c.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>{lbl}</Text>
                <Text style={{ color, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                  {val >= 0 && i === 2 ? "+" : ""}{val}
                </Text>
              </View>
            ))}
          </Card>

          {rec.days.length === 0 ? (
            <EmptyState icon="check-circle" title="Keine Daten" body="Für diese KW wurden keine Bestellungen oder Lieferungen gefunden." />
          ) : (
            rec.days.map((day) => (
              <Card key={day.date} style={{ gap: 0, padding: 0, overflow: "hidden" }}>
                {/* Day header */}
                <View style={{ backgroundColor: c.muted, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>{dayLabel(day.date)}</Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                    Plan: {day.totalPlanned} · Geliefert: {day.totalDelivered}
                  </Text>
                </View>
                {/* Column headers */}
                <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <Text style={{ flex: 1, color: c.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>GERICHT</Text>
                  <Text style={{ width: 54, color: c.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>PLAN</Text>
                  <Text style={{ width: 54, color: c.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>LIEF.</Text>
                  <Text style={{ width: 46, color: c.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>DIFF</Text>
                </View>
                {day.dishes.map((dish, i) => {
                  const diffColor = dish.diff < 0 ? "#dc2626" : dish.diff > 0 ? "#f59e0b" : "#16a34a";
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        paddingHorizontal: 14, paddingVertical: 9,
                        borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.border,
                        backgroundColor: dish.diff !== 0 ? (dish.diff < 0 ? "#dc262608" : "#f59e0b08") : "transparent",
                      }}
                    >
                      <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{dish.dishName}</Text>
                      <Text style={{ width: 54, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>{dish.planned}</Text>
                      <Text style={{ width: 54, color: "#16a34a", fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>{dish.delivered}</Text>
                      <Text style={{ width: 46, color: diffColor, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "center" }}>
                        {dish.diff >= 0 ? "+" : ""}{dish.diff}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            ))
          )}

          {totalDiff !== 0 && (
            <Card style={{ gap: 4, backgroundColor: totalDiff < 0 ? "#dc262610" : "#f59e0b10", borderWidth: 1, borderColor: totalDiff < 0 ? "#dc262630" : "#f59e0b30" }}>
              <Text style={{ color: totalDiff < 0 ? "#dc2626" : "#f59e0b", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {totalDiff < 0 ? "⚠ Unterlieferung" : "⚠ Überlieferung"}: {Math.abs(totalDiff)} Portionen
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                {totalDiff < 0
                  ? "Mehr Bestellungen als Lieferungen erfasst. Bitte Tagesabschlüsse prüfen."
                  : "Mehr Lieferungen als Bestellungen. Könnte auf manuelle Korrekturen hinweisen."}
              </Text>
            </Card>
          )}

          <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: "center" }}>
            KW {rec.kwNumber}/{rec.kwYear} · {formatDE(rec.dateFrom)} – {formatDE(rec.dateTo)}
            {" · "}Stand: {new Date(rec.generatedAt).toLocaleString("de-DE")}
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Section: Zeitraum-Bericht ────────────────────────────────────────────────

function PeriodReportSection({ locationCode, c }: { locationCode: string; c: ReturnType<typeof useColors> }) {
  const { input, label } = makeStyles(c);
  const kwNow = getWeekRange(0);
  const kwPrev = getWeekRange(1);
  const mNow = getMonthRange(0);
  const mPrev = getMonthRange(1);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!locationCode.trim() || !dateFrom || !dateTo) {
      Alert.alert("Fehler", "Standort-Code und Zeitraum angeben."); return;
    }
    setLoading(true); setReport(null);
    try {
      const data = await apiFetch<DeliveryReport>(
        `/api/preorder/staff/report?locationCode=${encodeURIComponent(locationCode.toUpperCase().trim())}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setReport(data);
    } catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [locationCode, dateFrom, dateTo]);

  const doPrint = async () => {
    if (!report) return;
    setPrinting(true);
    try { await printHTML(buildDeliveryHTML(report), "Lieferbericht drucken"); }
    catch (e) { Alert.alert("Fehler", e instanceof Error ? e.message : String(e)); }
    finally { setPrinting(false); }
  };

  const Chip = ({ lbl, from, to }: { lbl: string; from: string; to: string }) => (
    <Pressable
      onPress={() => { setDateFrom(from); setDateTo(to); }}
      style={{
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: dateFrom === from && dateTo === to ? c.primary : c.muted,
        borderWidth: 1, borderColor: dateFrom === from && dateTo === to ? c.primary : c.border,
      }}
    >
      <Text style={{ color: dateFrom === from && dateTo === to ? c.primaryForeground : c.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{lbl}</Text>
    </Pressable>
  );

  const byCustomer = report
    ? [...new Map(report.lines.map(l => [l.clerkUserId, { displayName: l.displayName, clerkUserId: l.clerkUserId }])).values()].map(({ displayName, clerkUserId }) => ({
        displayName, clerkUserId,
        lines: report.lines.filter(l => l.clerkUserId === clerkUserId),
        subtotal: report.lines.filter(l => l.clerkUserId === clerkUserId).reduce((s, l) => s + l.totalAmount, 0),
      }))
    : [];

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Zeitraum-Bericht</Text>
          {report && (
            <Pressable
              onPress={doPrint} disabled={printing}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primary }}
            >
              <Feather name="printer" size={13} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{printing ? "Drucke…" : "PDF"}</Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Chip lbl="Diese Woche" from={kwNow.from} to={kwNow.to} />
          <Chip lbl="Letzte Woche" from={kwPrev.from} to={kwPrev.to} />
          <Chip lbl="Dieser Monat" from={mNow.from} to={mNow.to} />
          <Chip lbl="Letzter Monat" from={mPrev.from} to={mPrev.to} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>Von</Text>
            <TextInput style={input} value={dateFrom} onChangeText={setDateFrom} placeholder="JJJJ-MM-TT" placeholderTextColor={c.mutedForeground} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={label}>Bis</Text>
            <TextInput style={input} value={dateTo} onChangeText={setDateTo} placeholder="JJJJ-MM-TT" placeholderTextColor={c.mutedForeground} />
          </View>
        </View>
        <Button label={loading ? "Lade Bericht…" : "Bericht laden"} onPress={load} disabled={loading} />
      </Card>

      {loading && <View style={{ padding: 24, alignItems: "center" }}><ActivityIndicator color={c.primary} /></View>}

      {report && (
        <>
          {byCustomer.length === 0 ? (
            <EmptyState icon="file-text" title="Keine Einträge" body="Keine Lieferungen im gewählten Zeitraum." />
          ) : (
            byCustomer.map(({ displayName, clerkUserId: cid, lines, subtotal }) => (
              <Card key={cid} style={{ gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{displayName}</Text>
                {lines.map((line, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: i < lines.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontSize: 14 }}>{line.dishType}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{line.totalQty}× Portion</Text>
                    </View>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{line.totalAmount.toFixed(2)} {line.currency}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 6, borderTopWidth: 2, borderTopColor: c.primary }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold" }}>Zwischensumme</Text>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{subtotal.toFixed(2)} {report.currency}</Text>
                </View>
              </Card>
            ))
          )}
          {byCustomer.length > 0 && (
            <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>Gesamtbetrag</Text>
              <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 22 }}>{report.grandTotal.toFixed(2)} {report.currency}</Text>
            </Card>
          )}
          <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: "center" }}>
            Proforma · Stand: {new Date(report.generatedAt).toLocaleString("de-DE")}
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryReportScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("plan");
  const [locationCode, setLocationCode] = useState("");
  const { input, label } = makeStyles(c);

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
          <SectionHeader title="Küchen-Berichte" />
        </View>

        {/* Shared location code input */}
        <Card style={{ gap: 8 }}>
          <Text style={label}>Standort-Code (für alle Berichte)</Text>
          <TextInput
            style={input}
            value={locationCode}
            onChangeText={(v) => setLocationCode(v.toUpperCase())}
            placeholder="z.B. BERLIN-MITTE"
            placeholderTextColor={c.mutedForeground}
            autoCapitalize="characters"
          />
        </Card>

        {/* Tab bar */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TabBtn label={"Produktions-\nplan"} icon="list" active={tab === "plan"} onPress={() => setTab("plan")} c={c} />
          <TabBtn label={"Wochen-\nabgleich"} icon="check-square" active={tab === "reconcile"} onPress={() => setTab("reconcile")} c={c} />
          <TabBtn label={"Zeitraum-\nBericht"} icon="bar-chart-2" active={tab === "report"} onPress={() => setTab("report")} c={c} />
          <TabBtn label={"Tages-\nabschluss"} icon="check-circle" active={tab === "finalize"} onPress={() => setTab("finalize")} c={c} />
        </View>

        {/* Tab content */}
        {tab === "plan" && <ProductionPlanSection locationCode={locationCode} c={c} />}
        {tab === "reconcile" && <ReconcileSection locationCode={locationCode} c={c} />}
        {tab === "report" && <PeriodReportSection locationCode={locationCode} c={c} />}
        {tab === "finalize" && <FinalizeSection locationCode={locationCode} c={c} />}
      </ScrollView>
    </View>
  );
}

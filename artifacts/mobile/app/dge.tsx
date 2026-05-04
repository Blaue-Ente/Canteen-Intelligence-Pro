/**
 * T014 — DGE-Qualitätsstandard compliance dashboard.
 *
 * Public-sector USP: tenders for school/daycare/hospital/senior canteens
 * commonly require DGE certification. We score the upcoming 7-day menu
 * plan against the chosen standard, surface unmet criteria, and suggest
 * the smallest concrete change that would satisfy each one.
 */

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  DGE_RULES,
  dgeStandardLabel,
  next7DayWindow,
  scoreMenu,
} from "@/lib/dge";
import { dgeCertificateHtml } from "@/lib/dgePdf";
import { sharePdf } from "@/lib/pdf";
import type { DgeStandard } from "@/types";

const STANDARDS: DgeStandard[] = ["schule", "kita", "krankenhaus", "senioren"];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDateRange(from: string, to: string, isDe: boolean): string {
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString(isDe ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
    });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function DgeScreen() {
  const { state, dispatch } = useApp();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDe = state.locale === "de";

  // If the user has not picked a standard yet, default the picker to "schule"
  // for the live preview but do NOT persist until they tap Speichern.
  const [activeStandard, setActiveStandard] = useState<DgeStandard>(
    state.dgeStandard ?? "schule",
  );

  // Window: 0 = current 7 days, 1 = next 7 days.
  const [windowOffset, setWindowOffset] = useState(0);
  const window = useMemo(() => {
    const base = next7DayWindow();
    if (windowOffset === 0) return base;
    return {
      fromDate: addDays(base.fromDate, 7),
      toDate: addDays(base.toDate, 7),
    };
  }, [windowOffset]);

  const score = useMemo(
    () =>
      scoreMenu({
        menu: state.menu,
        recipes: state.recipes,
        inventory: state.inventory,
        fromDate: window.fromDate,
        toDate: window.toDate,
        standard: activeStandard,
        isDe,
        locationId: state.currentLocationId,
      }),
    [state.menu, state.recipes, state.inventory, window, activeStandard, isDe, state.currentLocationId],
  );

  const tone =
    score.overall >= 80
      ? c.success
      : score.overall >= 60
        ? c.warning
        : c.destructive;

  const standardLabel = (s: DgeStandard) => dgeStandardLabel(s, isDe);

  const persistStandard = () => {
    dispatch({ type: "setDgeStandard", standard: activeStandard });
  };

  const exportCertificate = async () => {
    const currentLoc = state.locations.find((l) => l.id === state.currentLocationId);
    const html = dgeCertificateHtml({
      score,
      recipes: state.recipes,
      menu: state.menu,
      company: state.companyProfile,
      locationLabel: currentLoc?.name,
      locale: state.locale,
    });
    await sharePdf(html, `dge-${activeStandard}-${window.fromDate}.pdf`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: Platform.OS === "web" ? 16 : insets.top + 16,
          paddingBottom: insets.bottom + 60,
          gap: 14,
        }}
      >
        <View>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            DGE-Qualitätsstandard
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 }}>
            {isDe
              ? "Automatische Bewertung des Speiseplans nach den Qualitätsstandards der Deutschen Gesellschaft für Ernährung. Pflicht für viele öffentliche Ausschreibungen."
              : "Automated menu scoring against the German Nutrition Society quality standards. Required for many public-sector tenders."}
          </Text>
        </View>

        {/* Standard picker */}
        <Card>
          <SectionHeader title={isDe ? "Standard" : "Standard"} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {STANDARDS.map((s) => (
              <Chip
                key={s}
                label={standardLabel(s)}
                active={activeStandard === s}
                onPress={() => setActiveStandard(s)}
              />
            ))}
          </View>
          {state.dgeStandard !== activeStandard ? (
            <View style={{ marginTop: 12 }}>
              <Button
                label={
                  isDe
                    ? `${standardLabel(activeStandard)} als Standard speichern`
                    : `Save ${standardLabel(activeStandard)} as default`
                }
                icon="check"
                onPress={persistStandard}
              />
            </View>
          ) : null}
        </Card>

        {/* Window picker */}
        <Card>
          <SectionHeader title={isDe ? "Zeitraum" : "Window"} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label={isDe ? "Diese 7 Tage" : "This 7 days"}
              active={windowOffset === 0}
              onPress={() => setWindowOffset(0)}
            />
            <Chip
              label={isDe ? "Nächste 7 Tage" : "Next 7 days"}
              active={windowOffset === 1}
              onPress={() => setWindowOffset(1)}
            />
          </View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8 }}>
            {fmtDateRange(window.fromDate, window.toDate, isDe)}
            {"  ·  "}
            {isDe
              ? `${score.daysWithMenu}/${score.daysCount} Tage geplant`
              : `${score.daysWithMenu}/${score.daysCount} days planned`}
          </Text>
        </Card>

        {/* Score gauge */}
        <Card>
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {isDe ? "Gesamtbewertung" : "Overall score"}
            </Text>
            <Text style={{ color: tone, fontFamily: "Inter_700Bold", fontSize: 64, marginTop: 6 }}>
              {score.overall}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -4 }}>
              {isDe ? "von 100 Punkten" : "out of 100"}
            </Text>
            {/* Linear gauge bar */}
            <View
              style={{
                marginTop: 14,
                height: 10,
                width: "100%",
                backgroundColor: c.muted,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${score.overall}%`,
                  height: "100%",
                  backgroundColor: tone,
                }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 6 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>0</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>60</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>80</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>100</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
              <Badge label={`${score.criteria.filter((cr) => cr.met).length}/${score.criteria.length} ${isDe ? "Kriterien erfüllt" : "criteria met"}`} tone="default" />
            </View>
          </View>
        </Card>

        {/* Empty state if no menu planned */}
        {score.daysWithMenu === 0 ? (
          <Card>
            <EmptyState
              icon="calendar"
              title={isDe ? "Kein Speiseplan im Zeitraum" : "No menu planned"}
              body={isDe
                ? "Plane Gerichte im Wochenmenü, um deine DGE-Bewertung zu sehen."
                : "Plan recipes in the weekly menu to see your DGE score."}
            />
            <View style={{ marginTop: 12 }}>
              <Button
                label={isDe ? "Zum Wochenmenü" : "Open weekly menu"}
                icon="calendar"
                variant="secondary"
                onPress={() => router.push("/(tabs)/menu" as never)}
              />
            </View>
          </Card>
        ) : null}

        {/* Criteria breakdown */}
        <Card>
          <SectionHeader title={isDe ? "Kriterien" : "Criteria"} />
          <View style={{ gap: 10 }}>
            {score.criteria.map((cr) => {
              const limit = cr.kind === "min" ? `≥ ${cr.threshold}` : `≤ ${cr.threshold}`;
              const counter = cr.kind === "min"
                ? `${cr.current}/${cr.threshold}`
                : `${cr.current} (max ${cr.threshold})`;
              return (
                <View
                  key={cr.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: cr.met ? c.success + "22" : c.destructive + "22",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={cr.met ? "check" : "x"}
                      size={16}
                      color={cr.met ? c.success : c.destructive}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                      {cr.label}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                      {isDe ? "Schwelle" : "Threshold"} {limit}  ·  {isDe ? "aktuell" : "current"} {counter}
                    </Text>
                  </View>
                  <Badge
                    label={cr.met ? (isDe ? "Erfüllt" : "Met") : (isDe ? "Offen" : "Open")}
                    tone={cr.met ? "success" : "destructive"}
                  />
                </View>
              );
            })}
          </View>
        </Card>

        {/* Recommendations */}
        {score.recommendations.length > 0 ? (
          <Card>
            <SectionHeader title={isDe ? "Empfehlungen" : "Recommendations"} />
            <View style={{ gap: 8 }}>
              {score.recommendations.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Feather name="arrow-right" size={14} color={c.primary} style={{ marginTop: 3 }} />
                  <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>
                    {r}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Button
                label={isDe ? "Wochenmenü anpassen" : "Edit weekly menu"}
                icon="edit-3"
                variant="secondary"
                onPress={() => router.push("/(tabs)/menu" as never)}
              />
            </View>
          </Card>
        ) : score.daysWithMenu > 0 ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="award" size={20} color={c.success} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }}>
                {isDe
                  ? "Alle Kriterien erfüllt — DGE-konform!"
                  : "All criteria met — DGE-compliant!"}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Certificate export — only meaningful once a menu is planned. */}
        {score.daysWithMenu > 0 ? (
          <Card>
            <SectionHeader title={isDe ? "Bescheinigung" : "Certificate"} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 10 }}>
              {isDe
                ? "PDF-Bescheinigung mit Bewertung, Kriterien-Tabelle und Wochenplan — ideal für Ausschreibungs-Dokumentation."
                : "PDF certificate with score, criteria table and weekly plan — ideal for tender documentation."}
            </Text>
            <Button
              label={isDe ? "Zertifikat erstellen (PDF)" : "Generate certificate (PDF)"}
              icon="download"
              onPress={exportCertificate}
            />
          </Card>
        ) : null}

        {/* Rule book reference */}
        <Card>
          <SectionHeader title={isDe ? "Regelwerk" : "Rule book"} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
            {isDe
              ? `Bewertet nach DGE-Qualitätsstandard für ${standardLabel(activeStandard)}. ${DGE_RULES[activeStandard].length} Kriterien werden geprüft. Quelle: Deutsche Gesellschaft für Ernährung e.V.`
              : `Scored against the DGE quality standard for ${standardLabel(activeStandard)}. ${DGE_RULES[activeStandard].length} criteria are checked. Source: Deutsche Gesellschaft für Ernährung e.V.`}
          </Text>
        </Card>
      </ScrollView>

      {/* Floating "Set as default" prompt for first-time users */}
      {!state.dgeStandard ? (
        <Pressable
          onPress={persistStandard}
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
            backgroundColor: c.primary,
            borderRadius: 14,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Feather name="bookmark" size={18} color={c.primaryForeground} />
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }}>
            {isDe
              ? `${standardLabel(activeStandard)} als Standard aktivieren`
              : `Activate ${standardLabel(activeStandard)} as default`}
          </Text>
          <Feather name="arrow-right" size={18} color={c.primaryForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

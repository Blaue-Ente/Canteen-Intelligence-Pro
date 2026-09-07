import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Row } from "@/components/ui";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// ─────────────────────────────────────────────────────────────────────────────
// More-Menu IA (Mai 2026 Reorganisation)
//
// Vorher: 8 Sektionen, davon "Operations" mit 19 vermischten Einträgen, plus
// 3 Single-Item-Sektionen (Filialen / Öko / Settings) und uneinheitliche
// Sprache ("Operations" / "KI" hartcodiert vs. t()-Schlüssel anderswo).
// Außerdem fehlten T013-Bildschirme (Produktion, Reinigung, Kasse) komplett.
//
// Jetzt: 8 mental-model-konforme Sektionen entlang der Denkweise eines
// Kantinenleiters (Tagesgeschäft → Küche → Einkauf → Gäste → Compliance →
// Insights → Verwaltung), alle Section-Titel über i18n, T013/T014-Einträge
// vollständig integriert, neuer Hilfe-Eintrag.
// ─────────────────────────────────────────────────────────────────────────────

export default function More() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const sections: {
    title: string;
    items: {
      icon: React.ComponentProps<typeof Feather>["name"];
      label: string;
      to: string;
      tint?: string;
    }[];
  }[] = [
    // 1. KI-Assistent — immer ganz oben, das ist der USP für Voice-First-iPad
    {
      title: t("secKiAssistent"),
      items: [
        { icon: "message-circle", label: t("chat"), to: "/chat" },
        { icon: "camera",         label: t("scan"), to: "/scan" },
      ],
    },
    // 2. Tagesgeschäft — was der Cook täglich anfasst (Service / Schicht / Kasse)
    {
      title: t("secDailyOps"),
      items: [
        { icon: "check-square",   label: t("dailyClose"),         to: "/sales" },
        { icon: "credit-card",    label: t("posRegister"),         to: "/kasse" },
        { icon: "camera",         label: t("trayScanTitle"),       to: "/tray-scan", tint: "#f59e0b" },
        { icon: "credit-card",    label: t("zettle"),              to: "/zettle" },
        { icon: "message-square", label: t("handover"),            to: "/handover" },
        { icon: "calendar",       label: t("dienstplan"),          to: "/dienstplan" },
      ],
    },
    // 3. Küche & Produktion — Mise-en-Place, Chargen, Rezepte, Rest-Verwertung
    {
      title: t("secKitchenProd"),
      items: [
        { icon: "clipboard",      label: t("productionSamples"), to: "/production" },
        { icon: "refresh-ccw",    label: t("resteRezepte"),    to: "/reste" },
        { icon: "dollar-sign",    label: t("calculator"),      to: "/calculator" },
      ],
    },
    // 4. Einkauf & Lager — alles was reinkommt
    {
      title: t("secPurchaseStock"),
      items: [
        { icon: "package",        label: t("autoProcurement"), to: "/procurement" },
        { icon: "truck",          label: t("orders"),          to: "/orders" },
        { icon: "clipboard",      label: t("inventur"),        to: "/inventur" },
        { icon: "users",          label: t("suppliers"),       to: "/suppliers" },
        { icon: "sunrise",        label: t("producersTitle"),  to: "/producers", tint: "#059669" },
      ],
    },
    // 5. Gäste & Verkauf — alles Kundenseitige (B2C-App + B2B-Konten + Events)
    {
      title: t("secGuestsSales"),
      items: [
        { icon: "smartphone",     label: t("preorder"),        to: "/preorder" },
        { icon: "user-check",     label: t("customers"),       to: "/customers" },
        { icon: "book-open",      label: t("crm"),             to: "/crm",       tint: "#6366f1" },
        { icon: "mail",           label: t("catering"),        to: "/catering" },
        { icon: "calendar",       label: t("events"),          to: "/events" },
      ],
    },
    // 6. Qualität & Recht — Compliance Pillar (HACCP / DGE / Reinigung / Waste)
    {
      title: t("secComplianceQuality"),
      items: [
        { icon: "shield",         label: "HACCP & " + t("legalDocs"), to: "/haccp" },
        { icon: "award",          label: t("dgeQualityStandard"),     to: "/dge",      tint: "#059669" },
        { icon: "droplet",        label: t("cleaningPlan"),           to: "/cleaning" },
        { icon: "trash-2",        label: t("waste"),                  to: "/waste" },
        { icon: "camera",         label: t("trayPhotoAnalysis"),      to: "/wastecam" },
      ],
    },
    // 7. Insights & Berichte — KI-Vorhersagen + Reports + Multi-Standort
    {
      title: t("secInsightsReports"),
      items: [
        { icon: "cpu",            label: t("forecast"),                  to: "/forecast" },
        { icon: "trending-up",    label: t("marginAlerts"),              to: "/margin" },
        { icon: "award",          label: t("leaderboard"),               to: "/leaderboard" },
        { icon: "pie-chart",      label: t("reportsTitle"),              to: "/reports",      tint: "#6366f1" },
        { icon: "bar-chart",      label: t("dishAnalysisTitle"),         to: "/dishanalysis", tint: "#6366f1" },
        { icon: "zap",            label: t("okoWizardTitle"),            to: "/okowizard",    tint: "#059669" },
        { icon: "layers",         label: t("dailyAggregate"),            to: "/aggregate" },
        { icon: "bar-chart-2",    label: t("multiLocationRollup"),       to: "/rollup" },
        { icon: "tag",            label: t("priceServer"),               to: "/priceserver" },
      ],
    },
    // 8. Administration — Team, Filialen, Ausdrucke, Hilfe, Einstellungen
    {
      title: t("secAdmin"),
      items: [
        { icon: "users",          label: t("team"),       to: "/team" },
        { icon: "map-pin",        label: t("locations"),  to: "/locations" },
        // LMIV-Aushang ist dish-specific (app/aushang/[id].tsx) — Einstieg über
        // Karte → Rezept → Aushang. Kein Top-Level-Eintrag, kein generelles /aushang.
        { icon: "help-circle",    label: t("help"),       to: "/help",     tint: "#0ea5e9" },
        { icon: "settings",       label: t("settings"),   to: "/settings" },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 110,
          gap: 18,
        }}
      >
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
          {t("more")}
        </Text>

        {sections.map((sec, idx) => (
          <View key={idx} style={{ gap: 6 }}>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginLeft: 4,
              }}
            >
              {sec.title}
            </Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {sec.items.map((it, i) => (
                <Row
                  key={i}
                  icon={it.icon}
                  iconColor={it.tint}
                  left={
                    <Text
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_500Medium",
                        fontSize: 15,
                      }}
                    >
                      {it.label}
                    </Text>
                  }
                  onPress={() => router.push(it.to as never)}
                />
              ))}
            </Card>
          </View>
        ))}

        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          KItchenOS · v0.1 · DE/EN
        </Text>
      </ScrollView>
    </View>
  );
}

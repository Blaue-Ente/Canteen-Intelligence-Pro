import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Row } from "@/components/ui";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

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
    {
      title: t("chat"),
      items: [
        { icon: "message-circle", label: t("chat"), to: "/chat" },
        { icon: "camera", label: t("scan"), to: "/scan" },
      ],
    },
    {
      title: "Operations",
      items: [
        { icon: "check-square", label: "Tagesabschluss", to: "/sales" },
        { icon: "credit-card", label: t("zettle"), to: "/zettle" },
        { icon: "truck", label: t("orders"), to: "/orders" },
        { icon: "package", label: t("autoProcurement"), to: "/procurement" },
        { icon: "clipboard", label: t("inventur"), to: "/inventur" },
        { icon: "calendar", label: t("dienstplan"), to: "/dienstplan" },
        { icon: "users", label: t("suppliers"), to: "/suppliers" },
        { icon: "mail", label: t("catering"), to: "/catering" },
        { icon: "dollar-sign", label: t("calculator"), to: "/calculator" },
        { icon: "trash-2", label: t("waste"), to: "/waste" },
        { icon: "refresh-ccw", label: t("resteRezepte"), to: "/reste" },
      ],
    },
    {
      title: "KI",
      items: [
        { icon: "cpu", label: t("forecast"), to: "/forecast" },
        { icon: "message-square", label: t("handover"), to: "/handover" },
        { icon: "trending-up", label: t("marginAlerts"), to: "/margin" },
        { icon: "award", label: t("leaderboard"), to: "/leaderboard" },
      ],
    },
    {
      title: t("locations"),
      items: [{ icon: "map-pin", label: t("locations"), to: "/locations" }],
    },
    {
      title: t("legalDocs"),
      items: [{ icon: "shield", label: "HACCP & " + t("legalDocs"), to: "/haccp" }],
    },
    {
      title: t("settings"),
      items: [{ icon: "settings", label: t("settings"), to: "/settings" }],
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
          KitchenOS · v0.1 · DE/EN
        </Text>
      </ScrollView>
    </View>
  );
}

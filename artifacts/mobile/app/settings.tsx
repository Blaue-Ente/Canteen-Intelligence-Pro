import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Button, Card, Chip, Row, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { resetState } from "@/lib/storage";

export default function Settings() {
  const { state, dispatch } = useApp();
  const t = useT();
  const c = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <SectionHeader title={t("language")} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Deutsch" active={state.locale === "de"} onPress={() => dispatch({ type: "setLocale", locale: "de" })} />
            <Chip label="English" active={state.locale === "en"} onPress={() => dispatch({ type: "setLocale", locale: "en" })} />
          </View>
        </Card>

        <Card style={{ padding: 0 }}>
          <Row icon="moon" left={<Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Erscheinung</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>System</Text>} />
          <Row icon="bell" left={<Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Benachrichtigungen</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Bald</Text>} />
          <Row icon="link" left={<Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Zettle Integration</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Bald</Text>} />
          <Row icon="map-pin" left={<Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Standort</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>1 Standort</Text>} />
        </Card>

        <Button
          label="Daten zurücksetzen"
          icon="trash-2"
          variant="destructive"
          onPress={() => {
            Alert.alert("Alle Daten löschen?", "Inventar, Karte, Verkäufe – alles wird zurückgesetzt.", [
              { text: t("cancel") },
              {
                text: t("delete"),
                style: "destructive",
                onPress: async () => {
                  await resetState();
                  Alert.alert("Bitte App neu starten");
                },
              },
            ]);
          }}
        />

        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 16 }}>
          KitchenOS · Made for German kitchens.
        </Text>
      </ScrollView>
    </View>
  );
}

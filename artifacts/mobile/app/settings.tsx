import React, { useState } from "react";
import { Alert, Platform, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

import { Button, Card, Chip, Row, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ensurePermissions, rescheduleAll } from "@/lib/notifications";
import { resetState } from "@/lib/storage";

export default function Settings() {
  const { state, dispatch } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const { currentMembership } = useAuthCtx();
  const { signOut } = useAuth();
  const prefs = state.notificationPrefs;
  const [busy, setBusy] = useState(false);

  const update = async (next: typeof prefs) => {
    dispatch({ type: "setNotificationPrefs", prefs: next });
    if (Platform.OS === "web") return;
    if (next.enabled) {
      setBusy(true);
      try {
        const granted = await ensurePermissions();
        if (!granted) {
          dispatch({ type: "setNotificationPrefs", prefs: { ...next, enabled: false } });
          Alert.alert(
            state.locale === "de" ? "Berechtigung fehlt" : "Permission missing",
            state.locale === "de"
              ? "Bitte Benachrichtigungen in den iOS/Android-Einstellungen erlauben."
              : "Please allow notifications in iOS/Android settings.",
          );
          return;
        }
        await rescheduleAll(next, state);
      } finally {
        setBusy(false);
      }
    } else {
      await rescheduleAll(next, state);
    }
  };

  const labelStyle = { color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 };
  const subStyle = { color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 };
  const timeInput = (val: string, onChange: (s: string) => void) => (
    <TextInput
      value={val}
      onChangeText={onChange}
      placeholder="08:30"
      placeholderTextColor={c.mutedForeground}
      style={{
        width: 76,
        backgroundColor: c.background,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        color: c.foreground,
        fontFamily: "Inter_500Medium",
        textAlign: "center",
      }}
    />
  );

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

        <Card>
          <SectionHeader title={t("notifications")} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("enableNotifications")}</Text>
              <Text style={subStyle}>
                {Platform.OS === "web"
                  ? state.locale === "de" ? "Nur in der Mobile-App verfügbar." : "Mobile app only."
                  : state.locale === "de" ? "Tägliche Erinnerungen aktivieren." : "Schedule daily reminders."}
              </Text>
            </View>
            <Switch
              value={prefs.enabled}
              disabled={busy || Platform.OS === "web"}
              onValueChange={(v) => update({ ...prefs, enabled: v })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("notifTagesabschluss")}</Text>
            </View>
            {timeInput(prefs.tagesabschlussTime, (v) => update({ ...prefs, tagesabschlussTime: v }))}
            <Switch
              value={prefs.tagesabschluss}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, tagesabschluss: v })}
              trackColor={{ true: c.primary, false: c.border }}
              style={{ marginLeft: 12 }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("notifHaccp")}</Text>
            </View>
            {timeInput(prefs.haccpTime, (v) => update({ ...prefs, haccpTime: v }))}
            <Switch
              value={prefs.haccpReminder}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, haccpReminder: v })}
              trackColor={{ true: c.primary, false: c.border }}
              style={{ marginLeft: 12 }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("notifLowStock")}</Text>
              <Text style={subStyle}>09:00</Text>
            </View>
            <Switch
              value={prefs.lowStock}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, lowStock: v })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("notifExpiring")}</Text>
              <Text style={subStyle}>09:30</Text>
            </View>
            <Switch
              value={prefs.expiring}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, expiring: v })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>
        </Card>

        <Card style={{ padding: 0 }}>
          <Row
            icon="users"
            onPress={() => router.push("/team")}
            left={
              <View>
                <Text style={labelStyle}>Team & Mitarbeiter</Text>
                {currentMembership && (
                  <Text style={subStyle}>{currentMembership.orgName} · {currentMembership.role}</Text>
                )}
              </View>
            }
            right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>›</Text>}
          />
          <Row icon="moon" left={<Text style={labelStyle}>Erscheinung</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>System</Text>} />
          <Row icon="link" left={<Text style={labelStyle}>Zettle Integration</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>Bald</Text>} />
          <Row icon="map-pin" left={<Text style={labelStyle}>Standort</Text>} right={<Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>1 Standort</Text>} />
        </Card>

        <Button label="Abmelden" icon="log-out" variant="ghost" onPress={() => signOut()} />

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
          KItchenOS · Made for German kitchens.
        </Text>
      </ScrollView>
    </View>
  );
}

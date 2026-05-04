import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, Switch, Text, TextInput, View, Pressable } from "react-native";

import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

import { Button, Card, Chip, Row, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ensurePermissions, rescheduleAll } from "@/lib/notifications";
import { resetState } from "@/lib/storage";
import { speakHQ, prewarmTtsCache } from "@/lib/voice";
import type { KiosVoice } from "@/types";

const KIOS_VOICES: { id: KiosVoice; labelDe: string; labelEn: string; descDe: string; descEn: string }[] = [
  { id: "sarah",     labelDe: "Sarah",     labelEn: "Sarah",     descDe: "Warm, weiblich (Standard)", descEn: "Warm, female (default)" },
  { id: "charlotte", labelDe: "Charlotte", labelEn: "Charlotte", descDe: "Sanft, weiblich",           descEn: "Soft, female" },
  { id: "antoni",    labelDe: "Antoni",    labelEn: "Antoni",    descDe: "Ruhig, männlich",           descEn: "Calm, male" },
];

export default function Settings() {
  const { state, dispatch } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const { currentMembership } = useAuthCtx();
  const { signOut } = useAuth();
  const prefs = state.notificationPrefs;
  const [busy, setBusy] = useState(false);

  const cp = state.companyProfile;
  const [cpName, setCpName] = useState(cp?.name ?? "");
  const [cpAddress, setCpAddress] = useState(cp?.address ?? "");
  const [cpIban, setCpIban] = useState(cp?.iban ?? "");
  const [cpTaxId, setCpTaxId] = useState(cp?.taxId ?? "");
  const [cpEmail, setCpEmail] = useState(cp?.email ?? "");
  const [cpPhone, setCpPhone] = useState(cp?.phone ?? "");

  function saveCompanyProfile() {
    dispatch({
      type: "setCompanyProfile",
      profile: {
        name: cpName.trim(),
        address: cpAddress.trim(),
        iban: cpIban.trim(),
        taxId: cpTaxId.trim() || undefined,
        email: cpEmail.trim() || undefined,
        phone: cpPhone.trim() || undefined,
      },
    });
    Alert.alert(t("companyProfile"), state.locale === "de" ? "Gespeichert." : "Saved.");
  }

  function loadDemoData() {
    Alert.alert(
      t("loadDemoData"),
      t("demoDataConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: state.locale === "de" ? "Laden" : "Load",
          onPress: () => {
            const { seedState } = require("@/constants/seedData") as { seedState: import("@/types").AppState };
            dispatch({
              type: "loadDemoData",
              events: seedState.events,
              company: seedState.companyProfile ?? {
                name: "KüchenMeister GmbH",
                address: "Musterstraße 42, 10115 Berlin",
                iban: "DE89 3704 0044 0532 0130 00",
              },
            });
            if (seedState.companyProfile) {
              setCpName(seedState.companyProfile.name);
              setCpAddress(seedState.companyProfile.address);
              setCpIban(seedState.companyProfile.iban);
              setCpTaxId(seedState.companyProfile.taxId ?? "");
              setCpEmail(seedState.companyProfile.email ?? "");
              setCpPhone(seedState.companyProfile.phone ?? "");
            }
            Alert.alert("✓", t("demoDataLoaded"));
          },
        },
      ],
    );
  }

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

        {/* Operating mode (Voll-Modus vs Light-Modus). Light = assistant only;
            Full = cash register + TSE/KassenSichV (legally binding). */}
        <Card>
          <SectionHeader title={t("appMode")} />
          <View style={{ gap: 8 }}>
            {(["lite", "full"] as const).map((m) => {
              const active = state.appMode === m;
              const title = m === "lite" ? t("appModeLite") : t("appModeFull");
              const desc  = m === "lite" ? t("appModeLiteDesc") : t("appModeFullDesc");
              return (
                <Pressable
                  key={m}
                  onPress={() => dispatch({ type: "setAppMode", mode: m })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.muted : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                      borderColor: active ? c.primary : c.border,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {active && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{title}</Text>
                    <Text style={subStyle}>{desc}</Text>
                  </View>
                  {m === "full" && (
                    <Feather name="shield" size={16} color={active ? c.primary : c.mutedForeground} />
                  )}
                </Pressable>
              );
            })}
            <Text style={[subStyle, { marginTop: 4, fontSize: 11 }]}>
              {t("appModeHint")}
            </Text>
          </View>
        </Card>

        {/* Kios voice picker (web only — Kios is web-only) */}
        {Platform.OS === "web" && (
          <Card>
            <SectionHeader title={state.locale === "de" ? "Kios-Stimme" : "Kios voice"} />
            <Text style={[subStyle, { marginBottom: 10 }]}>
              {state.locale === "de"
                ? "Wähle die Stimme, mit der dir Kios antwortet. Bei Wechsel werden die Sätze einmalig neu generiert."
                : "Pick the voice Kios uses to reply. Switching re-generates the phrase cache once."}
            </Text>
            <View style={{ gap: 8 }}>
              {KIOS_VOICES.map((v) => {
                const active = state.kiosVoice === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      dispatch({ type: "setKiosVoice", voice: v.id });
                      // Re-warm cache for the new voice in the background
                      void prewarmTtsCache({ preset: "kios-de", voice: v.id });
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: active ? c.primary : c.border,
                      backgroundColor: active ? c.muted : "transparent",
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: active ? c.primary : c.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={labelStyle}>
                        {state.locale === "de" ? v.labelDe : v.labelEn}
                      </Text>
                      <Text style={subStyle}>
                        {state.locale === "de" ? v.descDe : v.descEn}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        speakHQ(
                          state.locale === "de"
                            ? "Hallo, ich bin Kios, dein Küchenassistent."
                            : "Hello, I'm Kios, your kitchen assistant.",
                          state.locale,
                          undefined,
                          v.id,
                        );
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: c.background,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <Feather name="volume-2" size={13} color={c.foreground} />
                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        {state.locale === "de" ? "Hören" : "Play"}
                      </Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

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

        {/* Sales entry window */}
        <Card>
          <SectionHeader title={t("salesWindowTitle")} />
          <Text style={[subStyle, { marginBottom: 8 }]}>{t("salesWindowDesc")}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("salesWindowEnable")}</Text>
            </View>
            <Switch
              value={prefs.salesWindowEnabled}
              onValueChange={(v) => dispatch({ type: "setNotificationPrefs", prefs: { ...prefs, salesWindowEnabled: v } })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.salesWindowEnabled ? 1 : 0.4 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("salesWindowFrom")}</Text>
              <Text style={subStyle}>{t("salesWindowFromDesc")}</Text>
            </View>
            {timeInput(prefs.salesWindowStart, (v) =>
              dispatch({ type: "setNotificationPrefs", prefs: { ...prefs, salesWindowStart: v } })
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.salesWindowEnabled ? 1 : 0.4 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("salesWindowTo")}</Text>
              <Text style={subStyle}>{t("salesWindowToDesc")}</Text>
            </View>
            {timeInput(prefs.salesWindowEnd, (v) =>
              dispatch({ type: "setNotificationPrefs", prefs: { ...prefs, salesWindowEnd: v } })
            )}
          </View>

          {prefs.salesWindowEnabled && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                padding: 10,
                borderRadius: 10,
                backgroundColor: "#fef9c3",
              }}
            >
              <Feather name="info" size={13} color="#a16207" />
              <Text style={{ color: "#92400e", fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>
                {state.locale === "de"
                  ? `Zwischen ${prefs.salesWindowStart} und ${prefs.salesWindowEnd} können Belegzahlen nur erhöht, nicht verringert werden.`
                  : `Between ${prefs.salesWindowStart} and ${prefs.salesWindowEnd}, counts can only be increased, not reduced.`}
              </Text>
            </View>
          )}
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

        {/* Öko Wizard toggle */}
        <Card>
          <SectionHeader title={t("okoWizardTitle")} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("okoWizardEnable")}</Text>
              <Text style={subStyle}>{t("okoWizardEnableDesc")}</Text>
            </View>
            <Switch
              value={state.okoEnabled}
              onValueChange={(v) => dispatch({ type: "setOkoEnabled", enabled: v })}
              trackColor={{ true: "#059669", false: c.border }}
            />
          </View>
          {state.okoEnabled && (
            <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={subStyle}>
                  {state.locale === "de"
                    ? `Score: ${state.okoProgress.score} Öko-Punkte · ${state.okoProgress.completions.length} Aufgaben`
                    : `Score: ${state.okoProgress.score} eco points · ${state.okoProgress.completions.length} completed`}
                </Text>
              </View>
              <Button
                label={state.locale === "de" ? "Öffnen" : "Open"}
                icon="zap"
                variant="ghost"
                onPress={() => router.push("/okowizard")}
              />
            </View>
          )}
        </Card>

        {/* Company Profile */}
        <Card>
          <SectionHeader title={t("companyProfile")} />
          {(
            [
              { label: t("companyName"), val: cpName, set: setCpName, placeholder: "KüchenMeister GmbH" },
              { label: t("companyAddress"), val: cpAddress, set: setCpAddress, placeholder: "Musterstr. 1, 10115 Berlin" },
              { label: t("companyIban"), val: cpIban, set: setCpIban, placeholder: "DE89 3704 0044 0532 0130 00" },
              { label: t("companyTaxId"), val: cpTaxId, set: setCpTaxId, placeholder: "27/445/05200" },
              { label: t("companyEmail"), val: cpEmail, set: setCpEmail, placeholder: "office@firma.de" },
            ] as { label: string; val: string; set: (v: string) => void; placeholder: string }[]
          ).map(({ label, val, set, placeholder }) => (
            <View key={label} style={{ paddingVertical: 6 }}>
              <Text style={[labelStyle, { fontSize: 12, color: c.mutedForeground, marginBottom: 3 }]}>{label}</Text>
              <TextInput
                value={val}
                onChangeText={set}
                placeholder={placeholder}
                placeholderTextColor={c.mutedForeground}
                style={{
                  backgroundColor: c.muted,
                  color: c.foreground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            </View>
          ))}
          <Pressable
            onPress={saveCompanyProfile}
            style={{
              marginTop: 8,
              backgroundColor: c.accent,
              borderRadius: 10,
              padding: 11,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {t("saveCompanyProfile")}
            </Text>
          </Pressable>
        </Card>

        {/* Demo Data */}
        <Card style={{ padding: 14, gap: 8 }}>
          <SectionHeader title="Demo" />
          <Text style={[subStyle, { marginBottom: 4 }]}>
            {state.locale === "de"
              ? "Lädt 5 realistische Musterveranstaltungen und ein Demo-Firmenprofil. Nur zum Testen."
              : "Loads 5 realistic sample events and a demo company profile. For testing only."}
          </Text>
          <Pressable
            onPress={loadDemoData}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderColor: "#6366f1",
              borderWidth: 1.5,
              borderRadius: 10,
              padding: 11,
            }}
          >
            <Text style={{ color: "#6366f1", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {t("loadDemoData")}
            </Text>
          </Pressable>
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

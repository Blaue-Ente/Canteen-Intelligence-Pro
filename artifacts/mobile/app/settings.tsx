import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

import { Button, Card, Chip, Row, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { useSubscription } from "@/hooks/useSubscription";
import { dgeStandardLabel } from "@/lib/dge";
import { ensurePermissions, rescheduleAll } from "@/lib/notifications";
import {
  webPushSupported,
  requestWebPushPermission,
  subscribeWebPush,
  unsubscribeWebPush,
  updateWebPushPrefs,
  getExistingSubscription,
  sendTestWebPush,
} from "@/lib/webPush";
import { resetState } from "@/lib/storage";
import { speakHQ, prewarmTtsCache, primeAudio } from "@/lib/voice";
import type { DgeStandard, KiosVoice, SubscriptionAddons, SubscriptionTier } from "@/types";

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

  // ---- Preorder Branding state ----
  const branding = state.preorderBranding ?? {};
  const [pbName, setPbName] = useState(branding.restaurantName ?? "");
  const [pbColor, setPbColor] = useState(branding.primaryColor ?? "#f59e0b");
  const [pbLogo, setPbLogo] = useState(branding.logoUri ?? "");
  const [pbWelcome, setPbWelcome] = useState(branding.welcomeMessage ?? "");

  async function pickBrandingLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].base64
        ? `data:image/jpeg;base64,${result.assets[0].base64}`
        : result.assets[0].uri;
      setPbLogo(uri);
    }
  }

  async function saveBranding() {
    const branding = {
      restaurantName: pbName.trim() || undefined,
      primaryColor: pbColor.trim() || undefined,
      logoUri: pbLogo || undefined,
      welcomeMessage: pbWelcome.trim() || undefined,
    };
    dispatch({ type: "setPreorderBranding", branding });
    // Sync to API server so the preorder web can read it
    try {
      await apiFetch("/api/preorder/branding", { method: "PUT", body: branding });
    } catch {
      // Non-critical — local state already saved
    }
    Alert.alert("✓", state.locale === "de" ? "Branding gespeichert." : "Branding saved.");
  }

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

    if (Platform.OS === "web") {
      if (!webPushSupported()) return;
      setBusy(true);
      try {
        if (next.enabled) {
          // Check if there's already a subscription; if not, request permission first
          const existing = await getExistingSubscription();
          if (!existing) {
            const granted = await requestWebPushPermission();
            if (!granted) {
              dispatch({ type: "setNotificationPrefs", prefs: { ...next, enabled: false } });
              Alert.alert(
                state.locale === "de" ? "Berechtigung fehlt" : "Permission missing",
                state.locale === "de"
                  ? "Bitte Benachrichtigungen im Browser erlauben und erneut versuchen."
                  : "Please allow notifications in your browser and try again.",
              );
              return;
            }
            await subscribeWebPush(next, state.locale);
            // Send a test notification to confirm it works
            await sendTestWebPush(state.locale).catch(() => {});
          } else {
            await updateWebPushPrefs(next, state.locale);
          }
        } else {
          await unsubscribeWebPush();
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // Native: iOS / Android
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

        {/* T014: DGE-Qualitätsstandard picker (school / daycare / hospital / senior) */}
        <DgeStandardCard />

        {/* T013a: Subscription tier + paid add-ons */}
        <SubscriptionCard />

        {/* T011: TSE / KassenSichV — per-location cash register configuration */}
        {state.appMode === "full" && <TseKassenSection />}

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
                      // Safari: unlock the shared AudioContext on this gesture
                      // so the subsequent "Hören" test button (and any later
                      // speakHQ from async callbacks) can play.
                      primeAudio();
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
                        // Safari: prime audio in this gesture before any async
                        // TTS fetch consumes the user-activation window.
                        primeAudio();
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
                  ? state.locale === "de"
                    ? "Push-Benachrichtigungen im Browser (PWA)."
                    : "Push notifications in browser (PWA)."
                  : state.locale === "de"
                    ? "Tägliche Erinnerungen aktivieren."
                    : "Schedule daily reminders."}
              </Text>
            </View>
            <Switch
              value={prefs.enabled}
              disabled={busy}
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

          {/* T010: New notification types */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{state.locale === "de" ? "🌿 Öko-Erinnerung" : "🌿 Eco reminder"}</Text>
              <Text style={subStyle}>
                {state.locale === "de" ? "Tägl. Erinnerung für Öko-Challenge" : "Daily eco challenge reminder"}
              </Text>
            </View>
            {timeInput(prefs.ekoReminderTime ?? "10:00", (v) => update({ ...prefs, ekoReminderTime: v }))}
            <Switch
              value={!!prefs.ekoReminder}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, ekoReminder: v })}
              trackColor={{ true: "#059669", false: c.border }}
              style={{ marginLeft: 12 }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{state.locale === "de" ? "🛒 Neue Vorbestellung" : "🛒 New preorder"}</Text>
              <Text style={subStyle}>
                {state.locale === "de" ? "Echtzeit-Alert bei Gäste-Vorbestellung" : "Real-time alert for guest preorders"}
              </Text>
            </View>
            <Switch
              value={!!prefs.preorderAlert}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, preorderAlert: v })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{state.locale === "de" ? "🏖 Abwesenheits-Meldung" : "🏖 Time-off request"}</Text>
              <Text style={subStyle}>
                {state.locale === "de" ? "Alert wenn Mitarbeiter Urlaub/Krank meldet" : "Alert when staff submits absence"}
              </Text>
            </View>
            <Switch
              value={!!prefs.timeOffAlert}
              disabled={!prefs.enabled}
              onValueChange={(v) => update({ ...prefs, timeOffAlert: v })}
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
          {/* Active locations row — shows real count from state, not a placeholder. */}
          <Row
            icon="map-pin"
            left={<Text style={labelStyle}>{state.locale === "de" ? "Standorte" : "Locations"}</Text>}
            right={
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
                {state.locations.length}
              </Text>
            }
          />
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

        {/* T005: Preorder Branding — logo + colors + welcome message */}
        <Card>
          <SectionHeader title={state.locale === "de" ? "Vorbestellung-Branding" : "Preorder Branding"} />
          <Text style={[subStyle, { marginBottom: 10 }]}>
            {state.locale === "de"
              ? "Logo, Farbe und Willkommenstext der Gäste-Vorbestellungsseite anpassen."
              : "Customize the logo, color, and welcome text on the guest preorder page."}
          </Text>
          {/* Logo picker */}
          <Text style={[labelStyle, { fontSize: 12, color: c.mutedForeground, marginBottom: 6 }]}>
            {state.locale === "de" ? "Logo" : "Logo"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {pbLogo ? (
              <Image
                source={{ uri: pbLogo }}
                style={{ width: 64, height: 64, borderRadius: 10, resizeMode: "contain", backgroundColor: c.muted }}
              />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
                <Feather name="image" size={22} color={c.mutedForeground} />
              </View>
            )}
            <View style={{ gap: 6 }}>
              <Button
                label={state.locale === "de" ? "Logo wählen" : "Choose logo"}
                icon="upload"
                variant="ghost"
                onPress={pickBrandingLogo}
              />
              {pbLogo ? (
                <Button
                  label={state.locale === "de" ? "Logo entfernen" : "Remove logo"}
                  icon="x"
                  variant="ghost"
                  onPress={() => setPbLogo("")}
                />
              ) : null}
            </View>
          </View>
          {/* Restaurant name */}
          <View style={{ paddingVertical: 6 }}>
            <Text style={[labelStyle, { fontSize: 12, color: c.mutedForeground, marginBottom: 3 }]}>
              {state.locale === "de" ? "Name (Überschrift)" : "Restaurant name"}
            </Text>
            <TextInput
              value={pbName}
              onChangeText={setPbName}
              placeholder={state.companyProfile?.name ?? "KüchenMeister"}
              placeholderTextColor={c.mutedForeground}
              style={{ backgroundColor: c.muted, color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            />
          </View>
          {/* Primary color */}
          <View style={{ paddingVertical: 6 }}>
            <Text style={[labelStyle, { fontSize: 12, color: c.mutedForeground, marginBottom: 3 }]}>
              {state.locale === "de" ? "Akzentfarbe (CSS-Hex)" : "Accent color (CSS hex)"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: pbColor.match(/^#[0-9a-fA-F]{6}$/) ? pbColor : "#f59e0b" }} />
              <TextInput
                value={pbColor}
                onChangeText={setPbColor}
                placeholder="#f59e0b"
                placeholderTextColor={c.mutedForeground}
                style={{ flex: 1, backgroundColor: c.muted, color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              />
            </View>
          </View>
          {/* Welcome message */}
          <View style={{ paddingVertical: 6 }}>
            <Text style={[labelStyle, { fontSize: 12, color: c.mutedForeground, marginBottom: 3 }]}>
              {state.locale === "de" ? "Willkommenstext" : "Welcome message"}
            </Text>
            <TextInput
              value={pbWelcome}
              onChangeText={setPbWelcome}
              placeholder={state.locale === "de" ? "Herzlich willkommen!" : "Welcome!"}
              placeholderTextColor={c.mutedForeground}
              multiline
              style={{ backgroundColor: c.muted, color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 56 }}
            />
          </View>
          <Pressable
            onPress={saveBranding}
            style={{ marginTop: 4, backgroundColor: c.accent, borderRadius: 10, padding: 11, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {state.locale === "de" ? "Branding speichern" : "Save branding"}
            </Text>
          </Pressable>
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

// ── T011: TSE / KassenSichV editor (Voll-Modus) ─────────────────────────────
// ─── T013a: Subscription card ───────────────────────────────────────────────

const TIERS: { id: SubscriptionTier; price: string; label: string; perks: string }[] = [
  { id: "starter",      price: "€49/Monat",  label: "Starter",      perks: "1 Standort, Basis-HACCP, Menüplanung" },
  { id: "professional", price: "€129/Monat", label: "Professional", perks: "+ Auto-HACCP, Rückstellproben, PDF-Export" },
  { id: "enterprise",   price: "€349/Monat", label: "Enterprise",   perks: "+ Mehrfachstandort, API, Priority-Support" },
];

const ADDONS: { id: keyof SubscriptionAddons; label: string; price: string; description: string }[] = [
  { id: "bleThermometers", label: "Bluetooth-Thermometer", price: "+€19/Monat",
    description: "Live-Streaming von Inkbird/Thermapen direkt in HACCP." },
  { id: "multiSite",       label: "Mehrfachstandort-Reports", price: "+€29/Monat",
    description: "Konsolidierte Auswertungen über alle Filialen." },
  { id: "advancedAi",      label: "Erweiterte KI",  price: "+€39/Monat",
    description: "Plate-Photo-Vision + automatische Preislisten-Erkennung." },
];

function SubscriptionCard() {
  const c = useColors();
  const { state } = useApp();
  const { tier, addons, hasAddon, toggleAddon, setTier } = useSubscription();
  const isDe = state.locale === "de";
  return (
    <Card>
      <SectionHeader title={isDe ? "Abonnement & Add-ons" : "Subscription & add-ons"} />
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 12 }}>
        {isDe
          ? "Wähle deinen Plan und schalte zusätzliche Module einzeln frei."
          : "Pick your plan and enable extra modules à la carte."}
      </Text>

      {/* Tier picker */}
      <View style={{ gap: 8, marginBottom: 14 }}>
        {TIERS.map((t) => {
          const active = tier === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTier(t.id)}
              style={{
                borderWidth: 1,
                borderColor: active ? c.primary : c.border,
                backgroundColor: active ? c.accent : c.card,
                borderRadius: c.radius,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  borderWidth: 2, borderColor: active ? c.primary : c.border,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{t.label}</Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{t.price}</Text>
                </View>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  {t.perks}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Addons */}
      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 8 }}>
        {isDe ? "Zusatzmodule" : "Add-on modules"}
      </Text>
      {ADDONS.map((a) => {
        const on = hasAddon(a.id);
        return (
          <View
            key={a.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderColor: c.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{a.label}</Text>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: on ? c.success + "22" : c.muted }}>
                  <Text style={{ color: on ? c.success : c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                    {a.price}
                  </Text>
                </View>
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                {a.description}
              </Text>
            </View>
            <Switch value={on} onValueChange={(v) => toggleAddon(a.id, v)} />
          </View>
        );
      })}
      {/* Quick reference reflecting persisted state */}
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 10 }}>
        {isDe ? "Aktiv: " : "Active: "}
        {Object.entries(addons).filter(([, v]) => v).map(([k]) => k).join(", ") || (isDe ? "keine" : "none")}
      </Text>
    </Card>
  );
}

// ─── T011 (updated): Per-location TSE / KassenSichV configuration ────────────
//
// KassenSichV §146a AO: each physical cash register must have its own TSE
// module, its own Kassennummer, and an independent gap-free Belegnummer series.
// This section renders one collapsible editor per Location. When no Locations
// are configured it falls back to a "Primär-Kasse" editor (legacy migration).

type TseProvider = import("@/types").TseProvider;

const PROVIDER_OPTIONS: { id: TseProvider; label: string; desc: string }[] = [
  { id: "stub",            label: "Stub (Entwicklung)",    desc: "Lokale HMAC-Signatur — NICHT KassenSichV-konform. Nur zum Testen." },
  { id: "fiskaly_sandbox", label: "fiskaly Sandbox",       desc: "fiskaly-Testumgebung — Belege sind nicht rechtsverbindlich." },
  { id: "fiskaly_prod",    label: "fiskaly Produktion",    desc: "Rechtsverbindliche TSE nach KassenSichV §146a AO." },
];

function TseKassenSection() {
  const { state } = useApp();
  const c = useColors();
  const isDe = state.locale === "de";

  // Determine the list of Kassen to show.
  // If Locations are configured → one Kasse per Location.
  // Otherwise → single "Primär-Kasse" (legacy path, key = "primary").
  const kassenList =
    state.locations.length > 0
      ? state.locations.map((l) => ({ id: l.id, name: l.name, address: l.address }))
      : [{ id: "primary", name: isDe ? "Primär-Kasse" : "Primary register", address: undefined }];

  return (
    <Card>
      <SectionHeader title="TSE / KassenSichV" />

      {/* Intro */}
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 14,
          padding: 12,
          borderRadius: 10,
          backgroundColor: c.accent,
        }}
      >
        <Feather name="shield" size={16} color={c.accentForeground} style={{ marginTop: 1 }} />
        <Text style={{ color: c.accentForeground, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 }}>
          {isDe
            ? "Jede Kasse benötigt eine eigene Kassennummer und TSE-Konfiguration (§146a AO). Belegnummern werden pro Kasse lückenlos gezählt."
            : "Each register needs its own cash register number and TSE configuration (§146a AO). Receipt numbers are counted gap-free per register."}
        </Text>
      </View>

      {/* One card per Kasse */}
      <View style={{ gap: 12 }}>
        {kassenList.map((kasse, idx) => (
          <TseLocationEditor
            key={kasse.id}
            locationId={kasse.id}
            locationName={kasse.name}
            locationAddress={kasse.address}
            index={idx + 1}
          />
        ))}
      </View>

      {/* Hint about adding more locations */}
      {state.locations.length === 0 && (
        <Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 12 }}>
          {isDe
            ? "Weitere Standorte anlegen → automatisch eigene Kasse pro Standort."
            : "Add more locations → each gets its own cash register automatically."}
        </Text>
      )}
    </Card>
  );
}

interface TseLocationEditorProps {
  locationId: string;
  locationName: string;
  locationAddress?: string;
  index: number;
}

function TseLocationEditor({ locationId, locationName, locationAddress, index }: TseLocationEditorProps) {
  const { state, dispatch } = useApp();
  const c = useColors();
  const isDe = state.locale === "de";

  // Read config: prefer tseConfigs[locationId], fall back to legacy tseConfig for "primary"
  const existingCfg =
    state.tseConfigs?.[locationId] ??
    (locationId === "primary" ? state.tseConfig : undefined);

  const [expanded, setExpanded] = useState(!(existingCfg?.kassennummer));
  const [kassennummer, setKassennummer] = useState(existingCfg?.kassennummer ?? `K-00${index}`);
  const [taxId, setTaxId] = useState(existingCfg?.taxId ?? state.companyProfile?.taxId ?? "");
  const [provider, setProvider] = useState<TseProvider>(existingCfg?.provider ?? "stub");
  const [fiskalyClientId, setFiskalyClientId] = useState(existingCfg?.fiskalyClientId ?? "");
  const [fiskalyTssId, setFiskalyTssId] = useState(existingCfg?.fiskalyTssId ?? "");

  const isConfigured = !!(existingCfg?.kassennummer && existingCfg?.taxId);
  const isLive = existingCfg?.provider === "fiskaly_prod";

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: c.foreground,
    fontFamily: "Inter_400Regular" as const,
    fontSize: 14,
    backgroundColor: c.background,
  };

  const labelMuted = {
    color: c.mutedForeground,
    fontSize: 11,
    marginBottom: 4,
    fontFamily: "Inter_500Medium" as const,
  };

  const save = () => {
    const trimmed = kassennummer.trim();
    const trimmedTax = taxId.trim();
    if (!trimmed) {
      Alert.alert(isDe ? "Kassennummer fehlt" : "Missing register number", "");
      return;
    }
    if (!trimmedTax) {
      Alert.alert(isDe ? "Steuernummer fehlt" : "Missing tax ID", "");
      return;
    }
    const cfg: import("@/types").TseConfig = {
      kassennummer: trimmed,
      taxId: trimmedTax,
      provider,
      serialNumber: existingCfg?.serialNumber,
      lastSignedAt: existingCfg?.lastSignedAt,
      fiskalyClientId: fiskalyClientId.trim() || undefined,
      fiskalyTssId: fiskalyTssId.trim() || undefined,
    };

    // Always save to per-location map
    dispatch({ type: "setTseConfigForLocation", locationId, config: cfg });

    // Also update legacy tseConfig when editing the primary register so
    // old code paths that still read state.tseConfig keep working.
    if (locationId === "primary") {
      dispatch({ type: "setTseConfig", config: cfg });
    }

    Alert.alert(
      "TSE",
      isDe
        ? `Kasse "${locationName}" gespeichert.`
        : `Register "${locationName}" saved.`,
    );
    setExpanded(false);
  };

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: isConfigured ? (isLive ? c.success : c.border) : c.destructive + "66",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header row — tap to expand/collapse */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          backgroundColor: c.card,
        }}
      >
        {/* Status dot */}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: isConfigured
              ? isLive ? c.success : c.warning
              : c.destructive,
          }}
        />

        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
            {locationName}
          </Text>
          {locationAddress ? (
            <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 1 }}>
              {locationAddress}
            </Text>
          ) : null}
          <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 2 }}>
            {isConfigured
              ? `${isDe ? "Kasse" : "Register"} ${existingCfg!.kassennummer}  ·  ${existingCfg!.provider}${existingCfg!.serialNumber ? `  ·  TSE ${existingCfg!.serialNumber.slice(0, 8)}…` : ""}`
              : (isDe ? "Noch nicht konfiguriert" : "Not yet configured")}
          </Text>
        </View>

        {/* Compliance badge */}
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: isLive
              ? c.success + "22"
              : isConfigured
                ? c.warning + "22"
                : c.destructive + "22",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Inter_600SemiBold",
              color: isLive ? c.success : isConfigured ? c.warning : c.destructive,
            }}
          >
            {isLive
              ? (isDe ? "KassenSichV-konform" : "Compliant")
              : isConfigured
                ? "Stub"
                : (isDe ? "Nicht konfiguriert" : "Not configured")}
          </Text>
        </View>

        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={c.mutedForeground}
        />
      </Pressable>

      {/* Expanded editor */}
      {expanded && (
        <View style={{ padding: 14, gap: 12, backgroundColor: c.background, borderTopWidth: 1, borderColor: c.border }}>

          {/* Kassennummer + Steuernummer */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelMuted}>Kassennummer</Text>
              <TextInput
                value={kassennummer}
                onChangeText={setKassennummer}
                placeholder={`K-00${index}`}
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="characters"
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelMuted}>{isDe ? "Steuernummer / USt-IdNr." : "Tax ID"}</Text>
              <TextInput
                value={taxId}
                onChangeText={setTaxId}
                placeholder="27/445/05200"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="none"
                style={inputStyle}
              />
            </View>
          </View>

          {/* TSE Provider picker */}
          <View>
            <Text style={labelMuted}>TSE Provider</Text>
            <View style={{ gap: 6 }}>
              {PROVIDER_OPTIONS.map((opt) => {
                const active = provider === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setProvider(opt.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: active ? c.primary : c.border,
                      backgroundColor: active ? c.accent : "transparent",
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: active ? c.primary : c.border,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      {active && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        {opt.label}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    {opt.id === "fiskaly_prod" && (
                      <Feather name="shield" size={14} color={active ? c.primary : c.mutedForeground} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Fiskaly credentials (only when a fiskaly provider is selected) */}
          {(provider === "fiskaly_sandbox" || provider === "fiskaly_prod") && (
            <View style={{ gap: 8 }}>
              <Text style={[labelMuted, { marginBottom: 0 }]}>
                {isDe ? "fiskaly-Zugangsdaten" : "fiskaly credentials"}
              </Text>
              <View>
                <Text style={labelMuted}>Client ID</Text>
                <TextInput
                  value={fiskalyClientId}
                  onChangeText={setFiskalyClientId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />
              </View>
              <View>
                <Text style={labelMuted}>TSS ID</Text>
                <TextInput
                  value={fiskalyTssId}
                  onChangeText={setFiskalyTssId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: c.accent,
                }}
              >
                <Feather name="info" size={13} color={c.accentForeground} style={{ marginTop: 1 }} />
                <Text style={{ color: c.accentForeground, fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 }}>
                  {isDe
                    ? "Client ID und TSS ID aus dem fiskaly Dashboard kopieren. Der API-Key wird als Server-Secret FISKALY_API_KEY hinterlegt — nie im App-Code speichern."
                    : "Copy Client ID and TSS ID from the fiskaly dashboard. The API key is stored as the server secret FISKALY_API_KEY — never in app code."}
                </Text>
              </View>
            </View>
          )}

          {/* TSE status info (read-only) */}
          {existingCfg?.serialNumber && (
            <View
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: c.muted,
                gap: 3,
              }}
            >
              <Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                {isDe ? "TSE-Status (schreibgeschützt)" : "TSE status (read-only)"}
              </Text>
              <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                Serial: {existingCfg.serialNumber}
              </Text>
              {existingCfg.lastSignedAt && (
                <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {isDe ? "Letzte Signatur" : "Last signed"}: {existingCfg.lastSignedAt}
                </Text>
              )}
            </View>
          )}

          {/* Save button */}
          <Pressable
            onPress={save}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.primary + "cc" : c.primary,
              borderRadius: 10,
              padding: 13,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            })}
          >
            <Feather name="save" size={16} color={c.primaryForeground} />
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
              {isDe ? "Kasse speichern" : "Save register"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── T014: DGE-Qualitätsstandard picker card ────────────────────────────────
//
// Public-sector USP. School/daycare/hospital/senior canteens often must
// score against the DGE-Qualitätsstandard. Picking a standard here switches
// the rule set used by /dge and surfaces a live badge on the weekly menu.
function DgeStandardCard() {
  const { state, dispatch } = useApp();
  const c = useColors();
  const router = useRouter();
  const isDe = state.locale === "de";
  const STANDARDS: DgeStandard[] = ["schule", "kita", "krankenhaus", "senioren"];
  const active = state.dgeStandard;
  return (
    <Card>
      <SectionHeader
        title="DGE-Qualitätsstandard"
        action={isDe ? "Öffnen" : "Open"}
        onAction={() => router.push("/dge")}
      />
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 10 }}>
        {isDe
          ? "Automatische Bewertung des Speiseplans nach den Qualitätsstandards der Deutschen Gesellschaft für Ernährung — relevant für viele öffentliche Ausschreibungen."
          : "Automated menu scoring against the German Nutrition Society quality standards — required for many public-sector tenders."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip
          label={isDe ? "Aus" : "Off"}
          active={!active}
          onPress={() => dispatch({ type: "setDgeStandard", standard: undefined })}
        />
        {STANDARDS.map((s) => (
          <Chip
            key={s}
            label={dgeStandardLabel(s, isDe)}
            active={active === s}
            onPress={() => dispatch({ type: "setDgeStandard", standard: s })}
          />
        ))}
      </View>
    </Card>
  );
}

import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
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

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

const PREORDER_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}/preorder`;

function openPortalPreview(locationCode: string) {
  const url = `${PREORDER_BASE}/menu/${encodeURIComponent(locationCode)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert("Fehler", `Konnte ${url} nicht öffnen.`),
  );
}

type AccountType = "regular" | "business_pending" | "business_approved" | "rejected";

interface CustomerProfile {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  homeLocationCode: string | null;
  accountType: AccountType;
  ownerOrgId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RefCode {
  code: string;
  orgId: string;
  locationCode: string;
  label: string | null;
  createdBy: string;
  maxUses: number;
  usesCount: number;
  createdAt: string;
}

interface Announcement {
  id: string;
  orgId: string;
  locationCode: string;
  title: string;
  body: string | null;
  fileName: string | null;
  mimeType: string | null;
  hasFile: boolean;
  publishedAt: string;
}

type MainTab = "customers" | "refcodes" | "announcements";

const CUSTOMER_TABS: { key: "business_pending" | "business_approved" | "rejected"; labelKey: "pendingBusiness" | "approvedBusiness" | "rejected" }[] = [
  { key: "business_pending", labelKey: "pendingBusiness" },
  { key: "business_approved", labelKey: "approvedBusiness" },
  { key: "rejected", labelKey: "rejected" },
];

export default function CustomersScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mainTab, setMainTab] = useState<MainTab>("customers");

  // ── Customer management ──────────────────────────────────────────────────
  const [customerTab, setCustomerTab] = useState<(typeof CUSTOMER_TABS)[number]["key"]>("business_pending");
  const [rows, setRows] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async (status: typeof customerTab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CustomerProfile[]>(
        `/api/preorder/staff/customers?status=${encodeURIComponent(status)}`,
      );
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "customers") void loadCustomers(customerTab);
  }, [customerTab, loadCustomers, mainTab]);

  const decide = async (row: CustomerProfile, decision: "approve" | "reject") => {
    setBusyId(row.clerkUserId);
    try {
      await apiFetch(`/api/preorder/staff/customers/${encodeURIComponent(row.clerkUserId)}`, {
        method: "PATCH",
        body: { decision },
      });
      await loadCustomers(customerTab);
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  // ── Reference codes ──────────────────────────────────────────────────────
  const [codes, setCodes] = useState<RefCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [newCodeLocation, setNewCodeLocation] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeMaxUses, setNewCodeMaxUses] = useState("1");
  const [creatingCode, setCreatingCode] = useState(false);

  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    setCodesError(null);
    try {
      const data = await apiFetch<RefCode[]>("/api/preorder/staff/ref-codes");
      setCodes(data);
    } catch (e) {
      setCodesError(e instanceof Error ? e.message : String(e));
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "refcodes") void loadCodes();
  }, [mainTab, loadCodes]);

  const createCode = async () => {
    if (!newCodeLocation.trim()) {
      Alert.alert("Fehler", "Bitte einen Standort-Code eingeben.");
      return;
    }
    setCreatingCode(true);
    try {
      await apiFetch<RefCode>("/api/preorder/staff/ref-codes", {
        method: "POST",
        body: {
          locationCode: newCodeLocation.trim().toUpperCase(),
          label: newCodeLabel.trim() || null,
          maxUses: parseInt(newCodeMaxUses, 10) || 1,
        },
      });
      setNewCodeLocation("");
      setNewCodeLabel("");
      setNewCodeMaxUses("1");
      await loadCodes();
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingCode(false);
    }
  };

  const deleteCode = async (code: string) => {
    Alert.alert(
      "Code löschen",
      `Code ${code} unwiderruflich löschen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/preorder/staff/ref-codes/${encodeURIComponent(code)}`, {
                method: "DELETE",
              });
              await loadCodes();
            } catch (e) {
              Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  // ── Announcements ─────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annLocation, setAnnLocation] = useState("");
  const [annCreating, setAnnCreating] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setAnnLoading(true);
    setAnnError(null);
    try {
      const data = await apiFetch<Announcement[]>("/api/preorder/staff/announcements");
      setAnnouncements(data);
    } catch (e) {
      setAnnError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnnLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "announcements") void loadAnnouncements();
  }, [mainTab, loadAnnouncements]);

  const createAnnouncement = async () => {
    if (!annTitle.trim()) {
      Alert.alert("Fehler", "Bitte einen Titel eingeben.");
      return;
    }
    if (!annLocation.trim()) {
      Alert.alert("Fehler", "Bitte einen Standort-Code eingeben.");
      return;
    }
    setAnnCreating(true);
    try {
      await apiFetch("/api/preorder/staff/announcements", {
        method: "POST",
        body: {
          locationCode: annLocation.trim().toUpperCase(),
          title: annTitle.trim(),
          body: annBody.trim() || null,
        },
      });
      setAnnTitle("");
      setAnnBody("");
      await loadAnnouncements();
    } catch (e) {
      Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
    } finally {
      setAnnCreating(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    Alert.alert(
      "Ankündigung löschen",
      "Diese Ankündigung löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/preorder/staff/announcements/${encodeURIComponent(id)}`, {
                method: "DELETE",
              });
              await loadAnnouncements();
            } catch (e) {
              Alert.alert("Fehler", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 10,
    color: c.foreground,
    backgroundColor: c.card,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  };

  const labelStyle = {
    color: c.mutedForeground,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  };

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
        <SectionHeader title={t("customers")} />

        {/* Main tab switcher */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              { key: "customers" as MainTab, label: "Kunden" },
              { key: "refcodes" as MainTab, label: "Ref.-Codes" },
              { key: "announcements" as MainTab, label: "Ankündigungen" },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setMainTab(tab.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: mainTab === tab.key ? c.primary : c.muted,
              }}
            >
              <Text
                style={{
                  color: mainTab === tab.key ? c.primaryForeground : c.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Customers ─────────────────────────────────────────────────── */}
        {mainTab === "customers" && (
          <>
            <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: -8 }}>
              {t("customersDesc")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {CUSTOMER_TABS.map((tabDef) => {
                const active = customerTab === tabDef.key;
                return (
                  <Pressable
                    key={tabDef.key}
                    onPress={() => setCustomerTab(tabDef.key)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? c.primary : c.muted,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? c.primaryForeground : c.foreground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                      }}
                    >
                      {t(tabDef.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {loading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : error ? (
              /401|unauthor/i.test(error) ? (
                <Card style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
                  <Feather name="lock" size={28} color={c.mutedForeground} />
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {t("authRequiredTitle")}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
                    {t("authRequiredBody")}
                  </Text>
                </Card>
              ) : (
                <Card>
                  <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>{error}</Text>
                </Card>
              )
            ) : rows.length === 0 ? (
              <EmptyState
                icon="users"
                title={t("noCustomers")}
                body={customerTab === "business_pending" ? t("noPendingCustomers") : undefined}
              />
            ) : (
              rows.map((row) => (
                <Card key={row.clerkUserId} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                        {row.displayName}
                      </Text>
                      {row.email ? (
                        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{row.email}</Text>
                      ) : null}
                      {row.homeLocationCode ? (
                        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                          <Feather name="map-pin" size={11} /> {row.homeLocationCode}
                        </Text>
                      ) : null}
                    </View>
                    <Badge
                      label={row.accountType.replace("_", " ")}
                      tone={
                        row.accountType === "business_approved"
                          ? "success"
                          : row.accountType === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    />
                  </View>
                  {customerTab === "business_pending" && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        label={t("approve")}
                        onPress={() => decide(row, "approve")}
                        disabled={busyId === row.clerkUserId}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={t("reject")}
                        variant="secondary"
                        onPress={() => decide(row, "reject")}
                        disabled={busyId === row.clerkUserId}
                        style={{ flex: 1 }}
                      />
                    </View>
                  )}
                  {/* Price-list shortcut — always visible for approved customers */}
                  {row.accountType === "business_approved" && (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/price-list",
                          params: {
                            clerkUserId: row.clerkUserId,
                            displayName: row.displayName,
                            locationCode: row.homeLocationCode ?? "",
                          },
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: c.muted,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Feather name="tag" size={13} color={c.primary} />
                      <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                        Preisvereinbarungen
                      </Text>
                    </Pressable>
                  )}
                </Card>
              ))
            )}
          </>
        )}

        {/* ── Reference Codes ───────────────────────────────────────────── */}
        {mainTab === "refcodes" && (
          <>
            <Card style={{ gap: 12 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Neuer Referenzcode
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                Gib diesen Code an Geschäftskunden weiter. Nach Einlösung im Portal erhalten sie sofort Business-Zugang — ohne manuelle Freigabe.
              </Text>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Standort-Code *</Text>
                <TextInput
                  style={inputStyle}
                  value={newCodeLocation}
                  onChangeText={(v) => setNewCodeLocation(v.toUpperCase())}
                  placeholder="z.B. BERLIN-MITTE"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Bezeichnung (optional)</Text>
                <TextInput
                  style={inputStyle}
                  value={newCodeLabel}
                  onChangeText={setNewCodeLabel}
                  placeholder="z.B. Firma Müller GmbH"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Max. Einlösungen</Text>
                <TextInput
                  style={inputStyle}
                  value={newCodeMaxUses}
                  onChangeText={setNewCodeMaxUses}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <Button
                label={creatingCode ? "Erstelle..." : "Code generieren"}
                onPress={createCode}
                disabled={creatingCode}
              />
            </Card>

            {codesLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : codesError ? (
              <Card>
                <Text style={{ color: c.destructive }}>{codesError}</Text>
              </Card>
            ) : codes.length === 0 ? (
              <EmptyState
                icon="key"
                title="Keine Codes"
                body="Erstelle deinen ersten Referenzcode für Geschäftskunden."
              />
            ) : (
              codes.map((code) => (
                <Card key={code.code} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          style={{
                            color: c.primary,
                            fontFamily: "Inter_700Bold",
                            fontSize: 20,
                            letterSpacing: 2,
                          }}
                        >
                          {code.code}
                        </Text>
                        <Badge
                          label={`${code.usesCount}/${code.maxUses}`}
                          tone={code.usesCount >= code.maxUses ? "destructive" : "success"}
                        />
                      </View>
                      {code.label ? (
                        <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{code.label}</Text>
                      ) : null}
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                        <Feather name="map-pin" size={10} /> {code.locationCode}
                        {"  ·  "}
                        {new Date(code.createdAt).toLocaleDateString("de")}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Pressable
                        onPress={() => openPortalPreview(code.locationCode)}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: c.muted,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                        hitSlop={6}
                      >
                        <Feather name="eye" size={13} color={c.primary} />
                        <Text style={{ color: c.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                          Vorschau
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteCode(code.code)}
                        style={{ padding: 8 }}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={16} color={c.destructive} />
                      </Pressable>
                    </View>
                  </View>
                  {code.usesCount >= code.maxUses && (
                    <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                      ⚠ Vollständig eingelöst
                    </Text>
                  )}
                </Card>
              ))
            )}
          </>
        )}

        {/* ── Announcements ─────────────────────────────────────────────── */}
        {mainTab === "announcements" && (
          <>
            <Card style={{ gap: 12 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Neue Ankündigung
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                Veröffentliche Textnachrichten, Speisepläne oder andere wichtige Informationen für Gäste im Bestellportal.
              </Text>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Standort-Code *</Text>
                <TextInput
                  style={inputStyle}
                  value={annLocation}
                  onChangeText={(v) => setAnnLocation(v.toUpperCase())}
                  placeholder="z.B. BERLIN-MITTE"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Titel *</Text>
                <TextInput
                  style={inputStyle}
                  value={annTitle}
                  onChangeText={setAnnTitle}
                  placeholder="z.B. Speiseplan KW 24"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={labelStyle}>Nachricht (optional)</Text>
                <TextInput
                  style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
                  value={annBody}
                  onChangeText={setAnnBody}
                  placeholder="Zusätzliche Informationen für Gäste..."
                  placeholderTextColor={c.mutedForeground}
                  multiline
                />
              </View>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                💡 PDF-Dateien können im Web-Browser über das Bestellportal hochgeladen werden.
              </Text>
              <Button
                label={annCreating ? "Veröffentliche..." : "Veröffentlichen"}
                onPress={createAnnouncement}
                disabled={annCreating}
              />
            </Card>

            {annLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : annError ? (
              <Card>
                <Text style={{ color: c.destructive }}>{annError}</Text>
              </Card>
            ) : announcements.length === 0 ? (
              <EmptyState
                icon="bell"
                title="Keine Ankündigungen"
                body="Erstelle deine erste Ankündigung für Gäste."
              />
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                        {ann.title}
                      </Text>
                      {ann.body ? (
                        <Text style={{ color: c.mutedForeground, fontSize: 13 }} numberOfLines={2}>
                          {ann.body}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                          <Feather name="map-pin" size={10} /> {ann.locationCode}
                        </Text>
                        {ann.hasFile && (
                          <Text style={{ color: c.primary, fontSize: 11 }}>
                            <Feather name="paperclip" size={10} /> {ann.fileName ?? "Datei"}
                          </Text>
                        )}
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                          {new Date(ann.publishedAt).toLocaleDateString("de")}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Pressable
                        onPress={() => openPortalPreview(ann.locationCode)}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: c.muted,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                        hitSlop={6}
                      >
                        <Feather name="eye" size={13} color={c.primary} />
                        <Text style={{ color: c.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                          Vorschau
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteAnnouncement(ann.id)}
                        style={{ padding: 8 }}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={16} color={c.destructive} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

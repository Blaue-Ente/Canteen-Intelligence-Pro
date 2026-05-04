import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { Card } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { syncPriceList } from "@/lib/priceServer";
import type { PriceServerAuthType } from "@/types";

const AUTH_TYPES: PriceServerAuthType[] = ["none", "basic", "bearer", "apiKey"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE");
}

export default function PriceServerScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();

  const cfg = state.priceServerConfig;

  const [url, setUrl] = useState(cfg?.url ?? "");
  const [authType, setAuthType] = useState<PriceServerAuthType>(cfg?.authType ?? "none");
  const [username, setUsername] = useState(cfg?.username ?? "");
  const [password, setPassword] = useState(cfg?.password ?? "");
  const [token, setToken] = useState(cfg?.token ?? "");
  const [apiKey, setApiKey] = useState(cfg?.apiKey ?? "");
  const [apiKeyHeader, setApiKeyHeader] = useState(cfg?.apiKeyHeader ?? "X-Api-Key");

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const authLabels: Record<PriceServerAuthType, string> = {
    none: t("authNone"),
    basic: t("authBasic"),
    bearer: t("authBearer"),
    apiKey: t("authApiKey"),
  };

  function currentConfig() {
    return { url, authType, username, password, token, apiKey, apiKeyHeader };
  }

  function saveConfig(extra?: Partial<NonNullable<typeof cfg>>) {
    dispatch({
      type: "setPriceServerConfig",
      config: { ...currentConfig(), ...extra },
    });
  }

  async function handleTest() {
    saveConfig();
    setTesting(true);
    try {
      const result = await syncPriceList(currentConfig());
      Alert.alert(
        t("testConnection"),
        `${t("syncSuccess")}: ${result.count} ${t("syncedEntries")}`,
      );
    } catch (e) {
      Alert.alert(t("syncError"), String(e));
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    saveConfig();
    setSyncing(true);
    try {
      const result = await syncPriceList(currentConfig());
      saveConfig({ lastSyncAt: result.syncedAt, lastSyncStatus: "ok", lastSyncError: undefined });
      dispatch({ type: "setPriceList", entries: result.entries });
      Alert.alert(t("syncSuccess"), `${result.count} ${t("syncedEntries")}`);
    } catch (e) {
      saveConfig({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "error",
        lastSyncError: String(e),
      });
      Alert.alert(t("syncError"), String(e));
    } finally {
      setSyncing(false);
    }
  }

  const inputStyle = {
    backgroundColor: c.muted,
    color: c.foreground,
    fontFamily: "Inter_400Regular" as const,
    fontSize: 14,
    borderRadius: 8,
    padding: 10,
  };

  const labelStyle = {
    color: c.mutedForeground,
    fontFamily: "Inter_500Medium" as const,
    fontSize: 12,
    marginBottom: 4,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
            {t("priceServer")}
          </Text>
          <Text
            style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}
          >
            {t("priceServerDesc")}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        <Card style={{ padding: 14, gap: 10 }}>
          <View>
            <Text style={labelStyle}>{t("priceServerUrl")}</Text>
            <TextInput
              style={inputStyle}
              value={url}
              onChangeText={setUrl}
              placeholder="https://erp.example.de/api/prices"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View>
            <Text style={labelStyle}>{t("authType")}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {AUTH_TYPES.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setAuthType(a)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: authType === a ? c.accent : c.muted,
                  }}
                >
                  <Text
                    style={{
                      color: authType === a ? "#fff" : c.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    {authLabels[a]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {authType === "basic" && (
            <View style={{ gap: 8 }}>
              <View>
                <Text style={labelStyle}>Benutzername</Text>
                <TextInput
                  style={inputStyle}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="admin"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View>
                <Text style={labelStyle}>Passwort</Text>
                <TextInput
                  style={inputStyle}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
            </View>
          )}

          {authType === "bearer" && (
            <View>
              <Text style={labelStyle}>Token</Text>
              <TextInput
                style={inputStyle}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                placeholder="eyJhbGci…"
                placeholderTextColor={c.mutedForeground}
                secureTextEntry
              />
            </View>
          )}

          {authType === "apiKey" && (
            <View style={{ gap: 8 }}>
              <View>
                <Text style={labelStyle}>{t("apiKeyHeader")}</Text>
                <TextInput
                  style={inputStyle}
                  value={apiKeyHeader}
                  onChangeText={setApiKeyHeader}
                  autoCapitalize="none"
                  placeholder="X-Api-Key"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
              <View>
                <Text style={labelStyle}>API Key</Text>
                <TextInput
                  style={inputStyle}
                  value={apiKey}
                  onChangeText={setApiKey}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={c.mutedForeground}
                />
              </View>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Pressable
              onPress={handleTest}
              disabled={testing || !url}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderColor: c.accent,
                borderWidth: 1.5,
                borderRadius: 10,
                padding: 10,
                opacity: testing || !url ? 0.5 : 1,
              }}
            >
              {testing ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Feather name="wifi" size={15} color={c.accent} />
              )}
              <Text style={{ color: c.accent, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {t("testConnection")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSync}
              disabled={syncing || !url}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: c.accent,
                borderRadius: 10,
                padding: 10,
                opacity: syncing || !url ? 0.5 : 1,
              }}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="refresh-cw" size={15} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {t("syncNow")}
              </Text>
            </Pressable>
          </View>
        </Card>

        {cfg?.lastSyncAt && (
          <Card style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather
                name={cfg.lastSyncStatus === "ok" ? "check-circle" : "alert-circle"}
                size={18}
                color={cfg.lastSyncStatus === "ok" ? "#22c55e" : "#ef4444"}
              />
              <Text
                style={{
                  color: cfg.lastSyncStatus === "ok" ? "#22c55e" : "#ef4444",
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                }}
              >
                {cfg.lastSyncStatus === "ok" ? t("syncSuccess") : t("syncError")}
              </Text>
            </View>
            <Text
              style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}
            >
              {t("lastSync")}: {fmtDate(cfg.lastSyncAt)}
            </Text>
            {cfg.lastSyncError ? (
              <Text
                style={{ color: "#ef4444", fontFamily: "Inter_400Regular", fontSize: 12 }}
              >
                {cfg.lastSyncError}
              </Text>
            ) : null}
          </Card>
        )}

        <Card style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
            {t("syncedEntries")} ({state.priceList.length})
          </Text>
          {state.priceList.length === 0 ? (
            <Text
              style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}
            >
              {t("noPriceList")}
            </Text>
          ) : (
            <>
              {state.priceList.slice(0, 8).map((entry, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 5,
                    borderBottomWidth: i < Math.min(state.priceList.length, 8) - 1 ? 1 : 0,
                    borderBottomColor: c.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                      }}
                      numberOfLines={1}
                    >
                      {entry.name}
                    </Text>
                    {entry.supplier ? (
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                        }}
                      >
                        {entry.supplier}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{ color: c.accent, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
                  >
                    €{entry.pricePerUnit.toFixed(2)}/{entry.unit}
                  </Text>
                </View>
              ))}
              {state.priceList.length > 8 ? (
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  +{state.priceList.length - 8} weitere …
                </Text>
              ) : null}
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

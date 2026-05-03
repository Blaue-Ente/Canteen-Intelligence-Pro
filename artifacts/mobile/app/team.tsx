import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Share, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@clerk/expo";
import { Button, Card, Chip, Row, SectionHeader } from "@/components/ui";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch, type InviteRow, type MemberRow } from "@/lib/api";

const ROLE_OPTIONS: ("staff" | "manager")[] = ["staff", "manager"];

export default function TeamScreen() {
  const c = useColors();
  const { currentMembership, me: authMe, refresh } = useAuthCtx();
  const { signOut } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("Koch");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [creating, setCreating] = useState(false);

  const isAdmin = currentMembership?.role === "owner" || currentMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!currentMembership) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ members: MemberRow[]; invites: InviteRow[] }>(
        `/api/orgs/${currentMembership.orgId}/members`,
      );
      setMembers(data.members);
      setInvites(data.invites);
    } catch (err) {
      Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [currentMembership]);

  useEffect(() => {
    void load();
  }, [load]);

  const inputStyle = {
    backgroundColor: c.muted,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.foreground,
    fontFamily: "Inter_500Medium" as const,
    fontSize: 15,
  };

  const createInvite = async () => {
    if (!email.trim() || !currentMembership) return;
    setCreating(true);
    try {
      const res = await apiFetch<{ code: string }>(
        `/api/orgs/${currentMembership.orgId}/invites`,
        {
          method: "POST",
          body: {
            email: email.trim(),
            displayName: displayName.trim() || undefined,
            employeeRole: employeeRole.trim() || undefined,
            role,
          },
        },
      );
      setEmail("");
      setDisplayName("");
      await load();
      Alert.alert(
        "Einladung erstellt",
        `Code: ${res.code}\n\nTeile diesen Code mit deinem Mitarbeiter — er kann ihn beim Registrieren eingeben.`,
        [
          { text: "OK" },
          {
            text: "Code teilen",
            onPress: () => {
              if (Platform.OS === "web") void Clipboard.setStringAsync(res.code);
              else void Share.share({ message: `Tritt unserem Team auf KItchenOS bei. Einladungscode: ${res.code}` });
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const removeInvite = async (code: string) => {
    if (!currentMembership) return;
    try {
      await apiFetch(`/api/orgs/${currentMembership.orgId}/invites/${code}`, { method: "DELETE" });
      await load();
    } catch (err) {
      Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
    }
  };

  const removeMember = async (userId: string) => {
    if (!currentMembership) return;
    Alert.alert("Mitarbeiter entfernen?", "Dieser Schritt kann nicht rückgängig gemacht werden.", [
      { text: "Abbrechen" },
      {
        text: "Entfernen",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/orgs/${currentMembership.orgId}/members/${userId}`, { method: "DELETE" });
            await load();
          } catch (err) {
            Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  };

  if (!currentMembership) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium" }}>Kein Restaurant verknüpft.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <SectionHeader title={currentMembership.orgName} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
            Du bist {currentMembership.role === "owner" ? "Inhaber" : currentMembership.role === "manager" ? "Manager" : "Mitarbeiter"}.
          </Text>
        </Card>

        <Card>
          <SectionHeader title={`Mitglieder (${members.length})`} />
          {loading && <ActivityIndicator color={c.primary} />}
          {members.map((m) => (
            <Row
              key={m.userId}
              icon={m.role === "owner" ? "shield" : "user"}
              left={
                <View>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>{m.displayName}</Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {m.role}
                    {m.employeeRole ? ` · ${m.employeeRole}` : ""}
                    {m.email ? ` · ${m.email}` : ""}
                  </Text>
                </View>
              }
              right={
                isAdmin && m.role !== "owner" && m.userId !== authMe?.userId ? (
                  <Text onPress={() => removeMember(m.userId)} style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>
                    Entfernen
                  </Text>
                ) : null
              }
            />
          ))}
        </Card>

        {isAdmin && (
          <Card>
            <SectionHeader title="Mitarbeiter einladen" />
            <View style={{ gap: 10 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="E-Mail"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Anzeigename (optional)"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={employeeRole}
                onChangeText={setEmployeeRole}
                placeholder="Position (z.B. Koch, Service)"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ROLE_OPTIONS.map((r) => (
                  <Chip key={r} label={r === "staff" ? "Mitarbeiter" : "Manager"} active={role === r} onPress={() => setRole(r)} />
                ))}
              </View>
              <Button label={creating ? "Einladung…" : "Einladungscode erstellen"} onPress={createInvite} disabled={creating} />
            </View>
          </Card>
        )}

        {invites.length > 0 && (
          <Card>
            <SectionHeader title={`Offene Einladungen (${invites.length})`} />
            {invites.map((i) => (
              <Row
                key={i.code}
                icon="mail"
                left={
                  <View>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>{i.email}</Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      Code: {i.code}
                      {i.employeeRole ? ` · ${i.employeeRole}` : ""}
                    </Text>
                  </View>
                }
                right={
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Text
                      onPress={() => {
                        void Clipboard.setStringAsync(i.code);
                        Alert.alert("Kopiert", `Code ${i.code} in die Zwischenablage kopiert.`);
                      }}
                      style={{ color: c.primary, fontFamily: "Inter_500Medium" }}
                    >
                      Kopieren
                    </Text>
                    {isAdmin && (
                      <Text onPress={() => removeInvite(i.code)} style={{ color: c.destructive, fontFamily: "Inter_500Medium" }}>
                        Löschen
                      </Text>
                    )}
                  </View>
                }
              />
            ))}
          </Card>
        )}

        <Button label="Abmelden" onPress={() => signOut()} variant="ghost" />
      </ScrollView>
    </View>
  );
}

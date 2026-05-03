import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { AuthGate } from "@/components/AuthGate";
import { Button, Card, SectionHeader } from "@/components/ui";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

export default function Onboarding() {
  return (
    <>
      <AuthGate />
      <OnboardingInner />
    </>
  );
}

function OnboardingInner() {
  const c = useColors();
  const router = useRouter();
  const { signOut } = useAuth();
  const { refresh, me } = useAuthCtx();
  const [restaurantName, setRestaurantName] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState(
    [me?.user.firstName, me?.user.lastName].filter(Boolean).join(" ") || "",
  );
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: c.muted,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: c.foreground,
    fontFamily: "Inter_500Medium" as const,
    fontSize: 15,
  };

  const createOrg = async () => {
    if (!restaurantName.trim()) {
      Alert.alert("Bitte Name eingeben");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/orgs", {
        method: "POST",
        body: { name: restaurantName.trim(), displayName: displayName.trim() || undefined },
      });
      await refresh();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!code.trim()) {
      Alert.alert("Bitte Code eingeben");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/invites/accept", {
        method: "POST",
        body: { code: code.trim(), displayName: displayName.trim() || undefined },
      });
      await refresh();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Fehler", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingTop: 60 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 26 }}>
          Willkommen bei KitchenOS
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Erstelle dein Restaurant oder tritt mit einem Einladungscode bei.
        </Text>

        <Card>
          <SectionHeader title="Anzeigename" />
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Dein Name (z.B. Marco)"
            placeholderTextColor={c.mutedForeground}
            style={inputStyle}
          />
        </Card>

        <Card>
          <SectionHeader title="Neues Restaurant" />
          <View style={{ gap: 12 }}>
            <TextInput
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="Restaurant-Name"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle}
            />
            <Button label={busy ? "Erstellen…" : "Restaurant erstellen"} onPress={createOrg} disabled={busy} />
          </View>
        </Card>

        <Card>
          <SectionHeader title="Einladung annehmen" />
          <View style={{ gap: 12 }}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="Einladungscode (z.B. AB1XY9)"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle}
            />
            <Button label={busy ? "Beitreten…" : "Beitreten"} onPress={acceptInvite} disabled={busy} variant="secondary" />
          </View>
        </Card>

        <Button label="Abmelden" onPress={() => signOut()} variant="ghost" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

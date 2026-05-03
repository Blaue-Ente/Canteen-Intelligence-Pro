import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/expo/legacy";
import { Button, Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const c = useColors();
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const submit = async () => {
    if (!isLoaded) return;
    setBusy(true);
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Anmeldung", `Status: ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Anmeldung fehlgeschlagen", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 28, marginBottom: 4 }}>
          KitchenOS
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 24 }}>
          Willkommen zurück. Bitte anmelden.
        </Text>
        <Card>
          <View style={{ gap: 12 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="E-Mail"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Passwort"
              placeholderTextColor={c.mutedForeground}
              style={inputStyle}
            />
            <Button label={busy ? "Anmelden…" : "Anmelden"} onPress={submit} disabled={busy} />
          </View>
        </Card>
        <View style={{ marginTop: 18, alignItems: "center" }}>
          <Link href="/(auth)/sign-up" style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>
            Noch kein Konto? Registrieren
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

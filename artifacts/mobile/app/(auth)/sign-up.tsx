import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignUp } from "@clerk/expo/legacy";
import { Button, Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";

export default function SignUpScreen() {
  const c = useColors();
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { clearPendingDemoSeed } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
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
    // Defensive: drop any pending demo seed before any non-demo auth flow.
    // If the user opened the demo modal, dismissed it, then signed up
    // normally as a real account, an in-flight queued seed (30s TTL) would
    // otherwise leak realistic-looking demo data into their fresh workspace.
    clearPendingDemoSeed();
    setBusy(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPending(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Registrierung fehlgeschlagen", msg);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    // Belt-and-suspenders: also clear right before the session is activated.
    // The submit-time clear above handles the common case, but a queued seed
    // could theoretically be re-added between submit() and verify() if the
    // user re-opens the demo flow on another tab — extremely unlikely but
    // free to guard against here.
    clearPendingDemoSeed();
    setBusy(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/onboarding");
      } else {
        Alert.alert("Verifizierung", `Status: ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Code ungültig", msg);
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
          Konto erstellen
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 24 }}>
          Inhaber registrieren oder Einladung annehmen.
        </Text>
        {!pending ? (
          <Card>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Vorname"
                  placeholderTextColor={c.mutedForeground}
                  style={[inputStyle, { flex: 1 }]}
                />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Nachname"
                  placeholderTextColor={c.mutedForeground}
                  style={[inputStyle, { flex: 1 }]}
                />
              </View>
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
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Passwort (min. 8 Zeichen)"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle}
              />
              <Button label={busy ? "Senden…" : "Konto erstellen"} onPress={submit} disabled={busy} />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", marginBottom: 8 }}>
              Wir haben einen Bestätigungscode an {email} gesendet.
            </Text>
            <View style={{ gap: 12 }}>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="Code"
                placeholderTextColor={c.mutedForeground}
                style={inputStyle}
              />
              <Button label={busy ? "Prüfen…" : "Bestätigen"} onPress={verify} disabled={busy} />
            </View>
          </Card>
        )}
        <View style={{ marginTop: 18, alignItems: "center" }}>
          <Link href="/(auth)/sign-in" style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>
            Schon registriert? Anmelden
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

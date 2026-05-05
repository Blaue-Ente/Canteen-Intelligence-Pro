import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/expo/legacy";
import { Button, Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import {
  DEMO_USERS,
  DEMO_VARIANTS,
  type DemoVariant,
} from "@/lib/demoConfig";
import { buildDemoSeed } from "@/constants/demoSeeds";

export default function SignInScreen() {
  const c = useColors();
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { applyDemoSeed, clearPendingDemoSeed } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<DemoVariant | null>(null);
  const [showVariants, setShowVariants] = useState(false);
  // Guards against re-running auto-demo if React strict-mode re-mounts the
  // screen, or if the user manually reloads after we've already started.
  const autoDemoLaunched = useRef(false);

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

  /**
   * Drives the demo flow: ask the api-server to mint a one-shot Clerk
   * sign-in token for the demo user, then exchange it via the ticket
   * strategy. Bypasses Clerk's reverification policy (which forces an
   * email-code second factor for new clients) — that policy makes a
   * normal password flow unusable for shared public demo accounts.
   *
   * After successful sign-in, atomically swap AppContext state to the
   * variant's seed so the dashboard isn't empty on first paint.
   */
  const startDemo = async (variant: DemoVariant): Promise<void> => {
    if (!isLoaded || demoBusy) return;
    setDemoBusy(variant);
    setShowVariants(false);
    try {
      const tokenRes = await fetch("/api/auth/demo-sign-in-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        throw new Error(
          `Demo-Token konnte nicht erstellt werden (${tokenRes.status}): ${body.slice(0, 200)}`,
        );
      }
      const { ticket } = (await tokenRes.json()) as { ticket?: string };
      if (!ticket) throw new Error("Kein Demo-Ticket vom Server erhalten");

      const res = await signIn.create({ strategy: "ticket", ticket });
      if (res.status === "complete") {
        // Queue the seed BEFORE setActive completes. AppProvider consumes
        // pending seeds at the next hydrate-for-real-user, guaranteeing the
        // seed lands under the demo user's storage key — never the anonymous
        // or previous-user key.
        applyDemoSeed(buildDemoSeed(variant));
        await setActive({ session: res.createdSessionId });
        // Do not router.replace here — useProtectedRoute() in _layout.tsx
        // redirects to /(tabs) automatically once auth + org membership are
        // loaded. Manually navigating now races with the hydrate flow.
      } else {
        Alert.alert(
          "Demo nicht verfügbar",
          `Demo-Anmeldung Status: ${res.status}. Bitte später erneut versuchen oder den Support kontaktieren.`,
        );
      }
    } catch (err) {
      // The seed was queued before setActive — clear it so it can't leak
      // into a subsequent unrelated sign-in within the 30s expiry window.
      clearPendingDemoSeed();
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        "Demo nicht verfügbar",
        `${msg}\n\nDie Demo-Konten sind möglicherweise noch nicht eingerichtet.`,
      );
    } finally {
      setDemoBusy(null);
    }
  };

  // Marketing site can deep-link with `?demo=kantine|schule|catering` to
  // auto-start a demo session. Web-only — native opens via the picker UI.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (autoDemoLaunched.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("demo");
    if (!raw) return;
    if (!isLoaded) return;
    const variant = (DEMO_VARIANTS as readonly string[]).includes(raw)
      ? (raw as DemoVariant)
      : null;
    if (!variant) return;
    autoDemoLaunched.current = true;
    // Strip the ?demo param immediately so reloads don't loop, even if the
    // sign-in fails.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("demo");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore — replaceState may fail in restrictive iframe contexts
    }
    void startDemo(variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const submit = async () => {
    if (!isLoaded) return;
    // Defensive: drop any pending demo seed before a non-demo sign-in. If
    // the user opened the demo modal, dismissed it, then signed in
    // normally as a real account, an in-flight queued seed would otherwise
    // leak realistic-looking demo data into their real workspace.
    clearPendingDemoSeed();
    setBusy(true);
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        // Routing is owned by useProtectedRoute() in app/_layout.tsx.
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
          KItchenOS
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
            <Button label={busy ? "Anmelden…" : "Anmelden"} onPress={submit} disabled={busy || demoBusy !== null} />
          </View>
        </Card>

        {/* Demo entry — separate visual block so it reads as a different
            affordance from the regular sign-in form. */}
        <View style={{ marginTop: 16 }}>
          <Card>
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Kein Konto? Demo testen
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                Sofort eintauchen — drei realistische Beispielbetriebe stehen bereit.
              </Text>
              <Button
                label={demoBusy ? "Demo wird gestartet…" : "Demo testen"}
                variant="secondary"
                onPress={() => setShowVariants(true)}
                disabled={demoBusy !== null || busy}
              />
            </View>
          </Card>
        </View>

        <View style={{ marginTop: 18, alignItems: "center" }}>
          <Link href="/(auth)/sign-up" style={{ color: c.primary, fontFamily: "Inter_500Medium" }}>
            Noch kein Konto? Registrieren
          </Link>
        </View>
      </ScrollView>

      {/* Variant picker — modal sheet with three cards. */}
      <Modal
        animationType="fade"
        transparent
        visible={showVariants}
        onRequestClose={() => setShowVariants(false)}
      >
        <Pressable
          onPress={() => setShowVariants(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card>
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 18,
                  }}
                >
                  Welcher Betrieb soll es sein?
                </Text>
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  Wähle ein Demo-Profil. Du kannst dich jederzeit abmelden und ein anderes ausprobieren.
                </Text>
                {DEMO_VARIANTS.map((v) => {
                  const meta = DEMO_USERS[v];
                  const loading = demoBusy === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => void startDemo(v)}
                      disabled={demoBusy !== null}
                      style={({ pressed }) => ({
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 12,
                        padding: 14,
                        backgroundColor: pressed ? c.muted : c.background,
                        opacity: demoBusy !== null && !loading ? 0.5 : 1,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                            {meta.label}
                          </Text>
                          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                            {meta.subtitle}
                          </Text>
                        </View>
                        {loading ? (
                          <ActivityIndicator color={c.primary} />
                        ) : (
                          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>›</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                <Button
                  label="Abbrechen"
                  variant="ghost"
                  onPress={() => setShowVariants(false)}
                  disabled={demoBusy !== null}
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

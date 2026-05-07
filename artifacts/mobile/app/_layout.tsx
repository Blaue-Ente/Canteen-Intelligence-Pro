import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/expo";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { AuthProvider, useAuthCtx } from "@/contexts/AuthContext";
import { tokenCache } from "@/lib/clerkTokenCache";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

/**
 * Route ALL Clerk frontend-API requests through our own api-server's
 * `/api/__clerk` proxy on web. The proxy middleware sets Clerk-Proxy-Url
 * to the canonical Clerk domain (app.kitchenos.de) via CLERK_PROXY_HOST_OVERRIDE,
 * so Clerk's FAPI accepts the request regardless of which host the browser
 * is actually on (kitchenos.de, *.replit.app, *.replit.dev, etc.).
 *
 * Without this, browsers on kitchenos.de or canteen-intelligence-pro.replit.app
 * would either call Clerk directly (and be rejected for unknown domain) or
 * proxy with the wrong host header (and get 401 proxy_request_invalid_secret_key).
 *
 * Native (iOS / Android) is not affected by browser CORS / origin checks
 * and uses the Clerk SDK's native transport, so we leave proxyUrl unset
 * there to keep the proven native code path.
 */
const clerkProxyProps = (() => {
  if (Platform.OS !== "web" || typeof window === "undefined") return {};
  return { proxyUrl: `${window.location.origin}/api/__clerk` };
})();

/**
 * Auth-aware redirect hook. Runs alongside the Stack navigator: when auth
 * state changes (sign-in, sign-out, membership loaded), it pushes the user
 * to the right screen group instead of letting them stay on a screen they
 * shouldn't see.
 *
 * Three zones:
 *   - (auth)/*    → unauthenticated only
 *   - onboarding  → authed but no org membership yet
 *   - (tabs)/*    → authed + member
 *
 * We deliberately do NOT use the `<AuthGate />` Slot wrapper here because the
 * root layout owns a Stack navigator (not a Slot), and AuthGate's redirects
 * would fight the Stack's screen stack. Effect-based redirects play nicely
 * with Stack and avoid double-navigation flashes.
 */
function useProtectedRoute(): { ready: boolean } {
  const { ready: authReady, isSignedIn, currentMembership } = useAuthCtx();
  const { ready: appReady } = useApp();
  const segments = useSegments();
  const router = useRouter();

  // Gate on BOTH auth and app hydration. Auth alone is not enough: when a
  // user signs in (or swaps demo variant), AppContext re-runs its hydrate
  // effect to load that user's storage key. During the gap between
  // `authReady=true` and `appReady=true`, in-memory state still belongs to
  // the previous user (or the seed default), so rendering protected screens
  // would briefly flash stale data — including potentially showing a
  // previous demo's recipes/sales to a freshly-signed-in real account.
  const ready = authReady && appReady;

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "(auth)";
    const onOnboarding = segments[0] === "onboarding";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && !currentMembership && !onOnboarding) {
      router.replace("/onboarding");
    } else if (isSignedIn && currentMembership && (inAuthGroup || onOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [ready, isSignedIn, currentMembership, segments, router]);

  return { ready };
}

function RootLayoutNav() {
  const { ready } = useProtectedRoute();
  const c = useColors();

  if (!ready) {
    // Don't flash the Stack while Clerk is still resolving the session —
    // it would briefly render whichever screen the URL points at, even if
    // the user has no business being there.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ presentation: "modal", title: "KI" }} />
      <Stack.Screen name="scan" options={{ presentation: "modal", title: "Scannen" }} />
      <Stack.Screen name="calculator" options={{ title: "Preiskalkulation" }} />
      <Stack.Screen name="haccp" options={{ title: "HACCP" }} />
      <Stack.Screen name="suppliers" options={{ title: "Lieferanten" }} />
      <Stack.Screen name="catering" options={{ title: "Catering" }} />
      <Stack.Screen name="waste" options={{ title: "Verschwendung" }} />
      <Stack.Screen name="settings" options={{ title: "Einstellungen" }} />
      <Stack.Screen name="team" options={{ title: "Team" }} />
      <Stack.Screen name="sales" options={{ title: "Tagesabschluss" }} />
      <Stack.Screen name="zettle" options={{ title: "Zettle" }} />
      <Stack.Screen name="orders" options={{ title: "Bestellungen" }} />
      <Stack.Screen name="customers" options={{ title: "Kunden" }} />
      <Stack.Screen name="aggregate" options={{ title: "Tagesübersicht" }} />
      <Stack.Screen name="inventur" options={{ title: "Inventur" }} />
      <Stack.Screen name="dienstplan" options={{ title: "Dienstplan" }} />
      <Stack.Screen name="recipe/[id]" options={{ title: "Rezept" }} />
      <Stack.Screen name="supplier/[id]" options={{ title: "Lieferant" }} />
      <Stack.Screen name="suppliers/discover" options={{ title: "Lieferanten finden" }} />
      <Stack.Screen name="locations" options={{ title: "Filialen" }} />
      <Stack.Screen name="forecast" options={{ title: "KI-Prognose" }} />
      <Stack.Screen name="procurement" options={{ title: "Auto-Bestellung" }} />
      <Stack.Screen name="handover" options={{ title: "Schichtübergabe" }} />
      <Stack.Screen name="reste" options={{ title: "Reste-Rezepte" }} />
      <Stack.Screen name="leaderboard" options={{ title: "Bestenliste" }} />
      <Stack.Screen name="margin" options={{ title: "Margen" }} />
      <Stack.Screen name="aushang/[id]" options={{ title: "LMIV-Aushang" }} />
      <Stack.Screen name="kasse" options={{ title: "Kasse" }} />
      <Stack.Screen name="dge" options={{ title: "DGE-Standard" }} />
      <Stack.Screen name="help" options={{ title: "Gebrauchsanleitung" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} {...clerkProxyProps}>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthProvider>
                  <AppProvider>
                    <StatusBar style="auto" />
                    <RootLayoutNav />
                  </AppProvider>
                </AuthProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

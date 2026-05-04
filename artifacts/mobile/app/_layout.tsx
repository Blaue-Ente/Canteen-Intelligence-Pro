import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/expo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { tokenCache } from "@/lib/clerkTokenCache";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function RootLayoutNav() {
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
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
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

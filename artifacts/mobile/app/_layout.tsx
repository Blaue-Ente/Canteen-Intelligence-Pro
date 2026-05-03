import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ presentation: "modal", title: "KI" }} />
      <Stack.Screen name="scan" options={{ presentation: "modal", title: "Scannen" }} />
      <Stack.Screen name="calculator" options={{ title: "Preiskalkulation" }} />
      <Stack.Screen name="haccp" options={{ title: "HACCP" }} />
      <Stack.Screen name="suppliers" options={{ title: "Lieferanten" }} />
      <Stack.Screen name="catering" options={{ title: "Catering" }} />
      <Stack.Screen name="waste" options={{ title: "Verschwendung" }} />
      <Stack.Screen name="settings" options={{ title: "Einstellungen" }} />
      <Stack.Screen name="sales" options={{ title: "Tagesabschluss" }} />
      <Stack.Screen name="zettle" options={{ title: "Zettle" }} />
      <Stack.Screen name="orders" options={{ title: "Bestellungen" }} />
      <Stack.Screen name="recipe/[id]" options={{ title: "Rezept" }} />
      <Stack.Screen name="supplier/[id]" options={{ title: "Lieferant" }} />
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
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <StatusBar style="auto" />
                <RootLayoutNav />
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

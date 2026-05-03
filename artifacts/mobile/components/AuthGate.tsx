import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Slot, useSegments } from "expo-router";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export function AuthGate() {
  const { ready, isSignedIn, currentMembership } = useAuthCtx();
  const c = useColors();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";
  const onOnboarding = segments[0] === "onboarding";

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    if (inAuthGroup) return <Slot />;
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!currentMembership) {
    if (onOnboarding) return <Slot />;
    return <Redirect href="/onboarding" />;
  }

  if (inAuthGroup || onOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <Slot />;
}

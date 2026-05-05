import { Stack } from "expo-router";
import React from "react";

// Auth-state redirects are owned by the root `_layout.tsx` (`useProtectedRoute`).
// We deliberately do NOT mount <AuthGate /> here — its <Slot /> would create a
// second navigator inside this Stack and crash the app on web with
// "Another navigator is already registered for this container."
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}

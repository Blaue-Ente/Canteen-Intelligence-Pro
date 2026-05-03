import { Stack } from "expo-router";
import React from "react";
import { AuthGate } from "@/components/AuthGate";

export default function AuthLayout() {
  return (
    <>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack>
    </>
  );
}

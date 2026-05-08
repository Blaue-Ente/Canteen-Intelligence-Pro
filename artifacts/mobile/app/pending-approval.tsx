import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useAuthCtx } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";

export default function PendingApproval() {
  const c = useColors();
  const { signOut } = useAuth();
  const { refresh, me } = useAuthCtx();
  const { state } = useApp();
  const isDe = state.locale === "de";
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 20 s — as soon as the owner approves, /me will return
  // approved=true and useProtectedRoute will redirect to (tabs).
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void refresh();
    }, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const org = me?.memberships[0];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      {/* Amber glow orb */}
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: c.primary + "22",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.primary + "33",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="clock" size={30} color={c.primary} />
        </View>
      </View>

      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 22,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {isDe ? "Zugang wird geprüft" : "Access pending approval"}
      </Text>

      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          textAlign: "center",
          lineHeight: 22,
          maxWidth: 320,
          marginBottom: 8,
        }}
      >
        {isDe
          ? "Dein Konto wartet auf die Freigabe durch den Administrator."
          : "Your account is waiting for admin approval."}
      </Text>

      {org && (
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          {isDe ? "Organisation:" : "Organisation:"} {org.orgName}
        </Text>
      )}

      {/* Pulsing indicator */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 48 }}>
        <ActivityIndicator size="small" color={c.primary} />
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
          {isDe ? "Wird automatisch aktualisiert…" : "Checking automatically…"}
        </Text>
      </View>

      {/* Info box */}
      <View
        style={{
          backgroundColor: c.muted,
          borderRadius: 14,
          padding: 16,
          maxWidth: 340,
          marginBottom: 32,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Feather name="info" size={16} color={c.primary} style={{ marginTop: 1 }} />
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 20,
              flex: 1,
            }}
          >
            {isDe
              ? "Der Inhaber oder Manager muss dein Konto in den Einstellungen freigeben. Sobald die Freigabe erfolgt ist, wirst du automatisch weitergeleitet."
              : "The owner or manager must approve your account in Settings. You will be redirected automatically once approved."}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        })}
      >
        <Feather name="log-out" size={14} color={c.mutedForeground} />
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 14,
          }}
        >
          {isDe ? "Abmelden" : "Sign out"}
        </Text>
      </Pressable>
    </View>
  );
}

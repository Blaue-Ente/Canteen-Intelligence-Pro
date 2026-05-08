import type { ReactNode } from "react";
import { Alert, Pressable, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

/**
 * Wrapper that only renders children when the app is in "full" (Voll-Modus).
 * Used to gate cash register, TSE signing, DSFinV-K export, and any
 * legally binding fiscal feature.
 *
 * - `silent` (default): renders nothing in lite mode (clean hide).
 * - `silent={false}`: renders an explanatory hint card with action buttons
 *   so the user can activate Voll-Modus or navigate to Settings even in
 *   standalone PWA windows where no tab bar / back button is available.
 */
export function FullModeOnly({
  children,
  silent = true,
  hintTitle,
  hintBody,
}: {
  children: ReactNode;
  silent?: boolean;
  hintTitle?: string;
  hintBody?: string;
}) {
  const { state, dispatch } = useApp();
  const c = useColors();
  const router = useRouter();

  if (state.appMode === "full") return <>{children}</>;
  if (silent) return null;

  const isDe = state.locale === "de";

  const activateFull = () => {
    Alert.alert(
      isDe ? "Voll-Modus aktivieren?" : "Activate Full mode?",
      isDe
        ? "Der Voll-Modus schaltet Kasse, TSE-Signierung und Fiskal-Funktionen frei. Du kannst ihn jederzeit in den Einstellungen wieder deaktivieren."
        : "Full mode enables the cash register, TSE signing and fiscal features. You can deactivate it again at any time in Settings.",
      [
        { text: isDe ? "Abbrechen" : "Cancel", style: "cancel" },
        {
          text: isDe ? "Aktivieren" : "Activate",
          onPress: () => dispatch({ type: "setAppMode", mode: "full" }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      {/* Lock card */}
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 14,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: c.border,
          backgroundColor: c.muted,
          padding: 20,
          gap: 14,
        }}
      >
        {/* Icon + text row */}
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: c.card,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Feather name="lock" size={20} color={c.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              {hintTitle ?? (isDe ? "Nur im Voll-Modus" : "Full mode only")}
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {hintBody ??
                (isDe
                  ? "Die Kasse gehört zur Kassen- & Fiskal-Schicht und ist nur im Voll-Modus verfügbar."
                  : "The cash register belongs to the fiscal layer and is only available in Full mode.")}
            </Text>
          </View>
        </View>

        {/* Primary action: activate directly */}
        <Pressable
          onPress={activateFull}
          style={({ pressed }) => ({
            backgroundColor: pressed ? c.primary + "cc" : c.primary,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          })}
        >
          <Feather name="unlock" size={16} color={c.primaryForeground} />
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
            {isDe ? "Voll-Modus jetzt aktivieren" : "Activate Full mode now"}
          </Text>
        </Pressable>

        {/* Secondary action: go to Settings */}
        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            backgroundColor: pressed ? c.muted : c.card,
          })}
        >
          <Feather name="settings" size={14} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {isDe ? "Zu den Einstellungen" : "Go to Settings"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

/**
 * Wrapper that only renders children when the app is in "full" (Voll-Modus).
 * Used to gate cash register, TSE signing, DSFinV-K export, and any
 * legally binding fiscal feature.
 *
 * - `silent` (default): renders nothing in lite mode (clean hide).
 * - `silent={false}`: renders a small explanatory hint card in lite mode,
 *   useful for menus/lists where the user benefits from knowing the feature
 *   exists but is currently locked.
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
  const { state } = useApp();
  const c = useColors();
  if (state.appMode === "full") return <>{children}</>;
  if (silent) return null;
  const isDe = state.locale === "de";
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.border,
        backgroundColor: c.muted,
        flexDirection: "row",
        gap: 10,
      }}
    >
      <Feather name="lock" size={18} color={c.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
          {hintTitle ?? (isDe ? "Nur im Voll-Modus" : "Full mode only")}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 2 }}>
          {hintBody ??
            (isDe
              ? "Diese Funktion ist Teil der Kassen- & Fiskal-Schicht. Aktiviere den Voll-Modus in den Einstellungen."
              : "This is part of the cash register & fiscal layer. Enable Full mode in Settings.")}
        </Text>
      </View>
    </View>
  );
}

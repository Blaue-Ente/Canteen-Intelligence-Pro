import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { OkoChallengeId } from "@/types";

// ── Challenge hint definitions (mirrors okowizard.tsx CHALLENGES) ─────────────

const HINT_DEFS: Record<
  OkoChallengeId,
  { icon: string; de: string; en: string; points: number }
> = {
  meatFreeDay:        { icon: "🌿", de: "Fleischfreier Tag",    en: "Meat-free day",        points: 20 },
  useReste:           { icon: "♻️", de: "Resteverwertung",       en: "Use leftovers",        points: 15 },
  regionalOrder:      { icon: "🚜", de: "Regional bestellen",   en: "Regional order",       points: 25 },
  haccpToday:         { icon: "🌡️", de: "Kühlkette prüfen",     en: "Check cold chain",     points: 10 },
  wasteUnder10:       { icon: "📉", de: "Portionsgenauigkeit",  en: "Precise portioning",   points: 30 },
  seasonalIngredient: { icon: "🌱", de: "Saisonale Zutaten",    en: "Seasonal ingredients", points: 20 },
  buyBio:             { icon: "🌾", de: "Bio einkaufen",        en: "Buy organic",          points: 20 },
  reducePlastic:      { icon: "🧴", de: "Plastik reduzieren",   en: "Reduce plastic",       points: 15 },
  co2Labeling:        { icon: "🏷️", de: "CO₂ auszeichnen",      en: "CO₂ labeling",         points: 25 },
  donateReste:        { icon: "🤝", de: "Reste spenden",        en: "Donate leftovers",     points: 30 },
};

interface EcoHintProps {
  /** Which challenge to highlight on this screen. */
  challengeId: OkoChallengeId;
  /** Optional one-liner explaining why this hint is relevant here. */
  contextDe?: string;
  contextEn?: string;
}

/**
 * EcoHint — compact contextual banner nudging users towards an Öko-Aufgabe.
 * Renders nothing if:
 *  - okoEnabled is false in settings
 *  - the challenge was already completed today
 *  - the user dismisses it for this session
 */
export function EcoHint({ challengeId, contextDe, contextEn }: EcoHintProps) {
  const { state } = useApp();
  const c = useColors();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const isDe = state.locale === "de";
  const def = HINT_DEFS[challengeId];

  const todayKey = new Date().toISOString().slice(0, 10);
  const doneToday = state.okoProgress.completions.some(
    (comp) => comp.challengeId === challengeId && comp.completedAt.startsWith(todayKey),
  );

  if (!state.okoEnabled || dismissed || doneToday || !def) return null;

  return (
    <Pressable
      onPress={() => router.push("/okowizard")}
      style={({ pressed }) => ({
        backgroundColor: "#f0fdf4",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#bbf7d0",
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Icon */}
      <Text style={{ fontSize: 24, lineHeight: 28 }}>{def.icon}</Text>

      {/* Text block */}
      <View style={{ flex: 1, gap: 2 }}>
        {(contextDe || contextEn) && (
          <Text style={{ color: "#15803d", fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isDe ? contextDe : contextEn}
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: "#166534", fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isDe ? def.de : def.en}
          </Text>
          <View
            style={{
              backgroundColor: "#dcfce7",
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#166534", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
              +{def.points} Öko-Pkt.
            </Text>
          </View>
        </View>
        <Text style={{ color: "#4ade80", fontFamily: "Inter_400Regular", fontSize: 11 }}>
          {isDe ? "Jetzt mitmachen →" : "Join challenge →"}
        </Text>
      </View>

      {/* Dismiss */}
      <Pressable
        hitSlop={12}
        onPress={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        style={{ padding: 4 }}
      >
        <Feather name="x" size={14} color="#86efac" />
      </Pressable>
    </Pressable>
  );
}

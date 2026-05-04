import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { uid } from "@/lib/storage";
import type { OkoChallengeId } from "@/types";

// ─── Challenge definitions ────────────────────────────────────────────────────

interface ChallengeDef {
  id: OkoChallengeId;
  icon: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  points: number;
  co2SavedKg?: number;
  difficulty: "easy" | "medium" | "hard";
}

const CHALLENGES: ChallengeDef[] = [
  {
    id: "meatFreeDay",
    icon: "🌿",
    titleDe: "Fleischfreier Tag",
    titleEn: "Meat-free day",
    descDe: "Plane heute ein Menü ohne Fleisch oder Fisch.",
    descEn: "Plan today's menu without meat or fish.",
    points: 20,
    co2SavedKg: 4.2,
    difficulty: "medium",
  },
  {
    id: "useReste",
    icon: "♻️",
    titleDe: "Resteverwertung",
    titleEn: "Use leftovers",
    descDe: "Verwende Reste oder erstelle ein Reste-Rezept.",
    descEn: "Use leftover ingredients or create a leftover recipe.",
    points: 15,
    co2SavedKg: 1.5,
    difficulty: "easy",
  },
  {
    id: "regionalOrder",
    icon: "🚜",
    titleDe: "Regional bestellen",
    titleEn: "Regional order",
    descDe: "Stelle eine Bestellung bei einem regionalen Erzeuger auf.",
    descEn: "Place an order with a local or regional producer.",
    points: 25,
    co2SavedKg: 2.0,
    difficulty: "medium",
  },
  {
    id: "haccpToday",
    icon: "🌡️",
    titleDe: "Kühlkette prüfen",
    titleEn: "Check cold chain",
    descDe: "Führe heute alle HACCP-Temperaturkontrollen durch.",
    descEn: "Complete all HACCP temperature checks today.",
    points: 10,
    difficulty: "easy",
  },
  {
    id: "wasteUnder10",
    icon: "📉",
    titleDe: "Portionsgenauigkeit",
    titleEn: "Precise portioning",
    descDe: "Koche so genau, dass die Verlustquote unter 10 % bleibt.",
    descEn: "Cook precisely so that waste stays below 10%.",
    points: 30,
    co2SavedKg: 2.8,
    difficulty: "hard",
  },
  {
    id: "seasonalIngredient",
    icon: "🌱",
    titleDe: "Saisonale Zutaten",
    titleEn: "Seasonal ingredients",
    descDe: "Verwende heute mindestens 3 saisonale oder Bio-Zutaten.",
    descEn: "Use at least 3 seasonal or organic ingredients today.",
    points: 20,
    co2SavedKg: 1.2,
    difficulty: "medium",
  },
  {
    id: "buyBio",
    icon: "🌾",
    titleDe: "Bio einkaufen",
    titleEn: "Buy organic",
    descDe: "Kaufe eine Bio-zertifizierte Zutat beim nächsten Einkauf.",
    descEn: "Buy at least one organic-certified ingredient next order.",
    points: 20,
    co2SavedKg: 0.9,
    difficulty: "easy",
  },
  {
    id: "reducePlastic",
    icon: "🧴",
    titleDe: "Plastik reduzieren",
    titleEn: "Reduce plastic",
    descDe: "Ersetze eine Einwegverpackung durch eine Mehrweglösung.",
    descEn: "Replace one single-use packaging with a reusable option.",
    points: 15,
    difficulty: "easy",
  },
  {
    id: "co2Labeling",
    icon: "🏷️",
    titleDe: "CO₂ auszeichnen",
    titleEn: "CO₂ labeling",
    descDe: "Kennzeichne 3 Gerichte mit ihrer ungefähren CO₂-Bilanz.",
    descEn: "Label 3 dishes with their approximate CO₂ footprint.",
    points: 25,
    difficulty: "medium",
  },
  {
    id: "donateReste",
    icon: "🤝",
    titleDe: "Reste spenden",
    titleEn: "Donate leftovers",
    descDe: "Gib übrig gebliebenes Essen an eine Tafel oder Hilfsorganisation.",
    descEn: "Donate leftover food to a food bank or charity.",
    points: 30,
    co2SavedKg: 3.5,
    difficulty: "hard",
  },
];

// ─── Medal tiers ──────────────────────────────────────────────────────────────

interface MedalTier {
  min: number;
  icon: string;
  nameDe: string;
  nameEn: string;
  color: string;
  bg: string;
}

const MEDALS: MedalTier[] = [
  { min: 0,    icon: "🌱", nameDe: "Grüner Einsteiger",      nameEn: "Green Starter",       color: "#16a34a", bg: "#dcfce7" },
  { min: 100,  icon: "🥉", nameDe: "Nachhaltigkeits-Lehrling", nameEn: "Sustainability Apprentice", color: "#92400e", bg: "#fef3c7" },
  { min: 300,  icon: "🥈", nameDe: "Öko-Praktiker",          nameEn: "Eco Practitioner",    color: "#374151", bg: "#f3f4f6" },
  { min: 600,  icon: "🥇", nameDe: "Klimaschützer",          nameEn: "Climate Guardian",    color: "#b45309", bg: "#fffbeb" },
  { min: 1000, icon: "💎", nameDe: "Umwelt-Champion",        nameEn: "Environment Champion", color: "#6d28d9", bg: "#ede9fe" },
];

function getMedal(score: number): MedalTier {
  let tier = MEDALS[0]!;
  for (const m of MEDALS) {
    if (score >= m.min) tier = m;
  }
  return tier;
}

function getNextMedal(score: number): MedalTier | null {
  for (const m of MEDALS) {
    if (score < m.min) return m;
  }
  return null;
}

// ─── Difficulty colors ────────────────────────────────────────────────────────

const DIFF_COLORS = {
  easy:   { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  hard:   { bg: "#fee2e2", text: "#991b1b" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OkoWizard() {
  const { state, dispatch, newId: _newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"challenges" | "history">("challenges");

  const { score, completions } = state.okoProgress;
  const medal = getMedal(score);
  const nextMedal = getNextMedal(score);
  const progressToNext = nextMedal ? Math.min(1, score / nextMedal.min) : 1;

  // Challenges done today
  const todayKey = new Date().toISOString().slice(0, 10);
  const doneToday = useMemo(
    () => new Set(completions.filter((c) => c.completedAt.startsWith(todayKey)).map((c) => c.challengeId)),
    [completions, todayKey],
  );

  const totalCo2Saved = useMemo(
    () =>
      completions.reduce((sum, comp) => {
        const def = CHALLENGES.find((d) => d.id === comp.challengeId);
        return sum + (def?.co2SavedKg ?? 0);
      }, 0),
    [completions],
  );

  function complete(challenge: ChallengeDef) {
    if (doneToday.has(challenge.id)) {
      Alert.alert(
        state.locale === "de" ? "Bereits erledigt" : "Already done",
        state.locale === "de"
          ? "Du hast diese Aufgabe heute schon abgeschlossen."
          : "You already completed this challenge today.",
      );
      return;
    }
    const note = noteTexts[challenge.id]?.trim() ?? "";
    const completion = {
      id: uid(),
      challengeId: challenge.id,
      completedAt: new Date().toISOString(),
      note: note || undefined,
    };
    dispatch({ type: "completeOkoChallenge", completion });
    setNoteTexts((prev) => ({ ...prev, [challenge.id]: "" }));

    const pts = challenge.points;
    const newScore = score + pts;
    const newMedal = getMedal(newScore);
    const levelUp = newMedal.nameDe !== medal.nameDe;

    Alert.alert(
      levelUp
        ? `${newMedal.icon} ${state.locale === "de" ? "Neues Niveau!" : "Level up!"}`
        : `+${pts} Öko-Punkte`,
      levelUp
        ? `${state.locale === "de" ? "Herzlichen Glückwunsch – du hast" : "Congratulations – you reached"} „${state.locale === "de" ? newMedal.nameDe : newMedal.nameEn}" ${state.locale === "de" ? "erreicht!" : "!"}`
        : `${state.locale === "de" ? "Gut gemacht! Gesamt" : "Well done! Total"}: ${newScore} Öko-Punkte`,
    );
  }

  const DIFF_LABEL: Record<string, { de: string; en: string }> = {
    easy:   { de: "Einfach", en: "Easy" },
    medium: { de: "Mittel", en: "Medium" },
    hard:   { de: "Schwer", en: "Hard" },
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 110,
          gap: 14,
        }}
      >
        {/* ── Hero card ── */}
        <Card style={{ backgroundColor: medal.bg, borderColor: "transparent", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 44 }}>{medal.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: medal.color, fontFamily: "Inter_700Bold", fontSize: 20 }}>
                {state.locale === "de" ? medal.nameDe : medal.nameEn}
              </Text>
              <Text style={{ color: medal.color, fontFamily: "Inter_600SemiBold", fontSize: 15, marginTop: 2 }}>
                {score} Öko-Punkte
              </Text>
              {totalCo2Saved > 0 && (
                <Text style={{ color: medal.color, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  ≈ {totalCo2Saved.toFixed(1)} kg CO₂ {state.locale === "de" ? "gespart" : "saved"}
                </Text>
              )}
            </View>
          </View>

          {/* Progress to next medal */}
          {nextMedal && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: medal.color, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                {state.locale === "de" ? "Nächste Stufe" : "Next level"}: {nextMedal.icon}{" "}
                {state.locale === "de" ? nextMedal.nameDe : nextMedal.nameEn} ({nextMedal.min - score}{" "}
                {state.locale === "de" ? "Punkte fehlen" : "points to go"})
              </Text>
              <View style={{ height: 6, backgroundColor: `${medal.color}30`, borderRadius: 999, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${progressToNext * 100}%`,
                    backgroundColor: medal.color,
                    borderRadius: 999,
                  }}
                />
              </View>
            </View>
          )}

          {!nextMedal && (
            <Text style={{ color: medal.color, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {state.locale === "de" ? "Maximales Niveau erreicht! 🎉" : "Maximum level reached! 🎉"}
            </Text>
          )}
        </Card>

        {/* ── Stats row ── */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            {
              label: state.locale === "de" ? "Heute erledigt" : "Done today",
              value: String(doneToday.size),
              icon: "check-circle" as const,
              color: "#059669",
            },
            {
              label: state.locale === "de" ? "Gesamt" : "Total",
              value: String(completions.length),
              icon: "award" as const,
              color: "#6366f1",
            },
            {
              label: "CO₂",
              value: `${totalCo2Saved.toFixed(1)} kg`,
              icon: "wind" as const,
              color: "#0ea5e9",
            },
          ].map((st) => (
            <Card key={st.label} style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 12 }}>
              <Feather name={st.icon} size={18} color={st.color} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>{st.value}</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "center" }}>
                {st.label}
              </Text>
            </Card>
          ))}
        </View>

        {/* ── Tab switcher ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.muted,
            borderRadius: 10,
            padding: 3,
          }}
        >
          {([
            { key: "challenges", de: "Aufgaben", en: "Challenges" },
            { key: "history",    de: "Verlauf",  en: "History" },
          ] as { key: "challenges" | "history"; de: string; en: string }[]).map((tb) => (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: "center",
                backgroundColor: tab === tb.key ? c.card : "transparent",
              }}
            >
              <Text
                style={{
                  color: tab === tb.key ? c.foreground : c.mutedForeground,
                  fontFamily: tab === tb.key ? "Inter_600SemiBold" : "Inter_400Regular",
                  fontSize: 14,
                }}
              >
                {state.locale === "de" ? tb.de : tb.en}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Challenges tab ── */}
        {tab === "challenges" && (
          <>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, paddingHorizontal: 2 }}>
              {state.locale === "de"
                ? 'Tippe auf "Erledigt", um Punkte zu sammeln. Jede Aufgabe ist einmal pro Tag abschlie\u00DFbar.'
                : 'Tap "Done" to collect points. Each challenge can be completed once per day.'}
            </Text>

            {CHALLENGES.map((ch) => {
              const done = doneToday.has(ch.id);
              const diff = DIFF_COLORS[ch.difficulty];
              return (
                <Card
                  key={ch.id}
                  style={{
                    gap: 10,
                    opacity: done ? 0.7 : 1,
                    borderLeftWidth: 4,
                    borderLeftColor: done ? "#059669" : c.border,
                  }}
                >
                  {/* Title row */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 26 }}>{ch.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                          {state.locale === "de" ? ch.titleDe : ch.titleEn}
                        </Text>
                        {done && (
                          <View
                            style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#dcfce7", borderRadius: 999 }}
                          >
                            <Text style={{ color: "#166534", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                              {state.locale === "de" ? "Heute erledigt ✓" : "Done today ✓"}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}
                      >
                        {state.locale === "de" ? ch.descDe : ch.descEn}
                      </Text>
                    </View>
                  </View>

                  {/* Meta row */}
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <View
                      style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: diff.bg, borderRadius: 999 }}
                    >
                      <Text style={{ color: diff.text, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                        {state.locale === "de"
                          ? DIFF_LABEL[ch.difficulty]?.de
                          : DIFF_LABEL[ch.difficulty]?.en}
                      </Text>
                    </View>
                    <View
                      style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ede9fe", borderRadius: 999 }}
                    >
                      <Text style={{ color: "#6d28d9", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                        +{ch.points} Pkt.
                      </Text>
                    </View>
                    {ch.co2SavedKg != null && (
                      <View
                        style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#e0f2fe", borderRadius: 999 }}
                      >
                        <Text style={{ color: "#0369a1", fontFamily: "Inter_500Medium", fontSize: 11 }}>
                          ≈ −{ch.co2SavedKg} kg CO₂
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Note input + button */}
                  {!done && (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        value={noteTexts[ch.id] ?? ""}
                        onChangeText={(v) => setNoteTexts((prev) => ({ ...prev, [ch.id]: v }))}
                        placeholder={
                          state.locale === "de"
                            ? "Notiz (optional, z. B. was du getan hast)…"
                            : "Note (optional, e.g. what you did)…"
                        }
                        placeholderTextColor={c.mutedForeground}
                        style={{
                          backgroundColor: c.muted,
                          borderColor: c.border,
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          color: c.foreground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 13,
                        }}
                      />
                      <Pressable
                        onPress={() => complete(ch)}
                        style={{
                          backgroundColor: "#059669",
                          borderRadius: 10,
                          paddingVertical: 10,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Feather name="check" size={15} color="#fff" />
                        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                          {state.locale === "de" ? "Erledigt" : "Done"} (+{ch.points})
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {/* ── History tab ── */}
        {tab === "history" && (
          <>
            {completions.length === 0 ? (
              <Card>
                <Text
                  style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}
                >
                  {state.locale === "de"
                    ? "Noch keine Aufgaben abgeschlossen."
                    : "No challenges completed yet."}
                </Text>
              </Card>
            ) : (
              completions.map((comp) => {
                const def = CHALLENGES.find((d) => d.id === comp.challengeId);
                if (!def) return null;
                const dateStr = new Date(comp.completedAt).toLocaleDateString(
                  state.locale === "de" ? "de-DE" : "en-GB",
                  { day: "2-digit", month: "short", year: "numeric" },
                );
                return (
                  <Card key={comp.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <Text style={{ fontSize: 22, marginTop: 2 }}>{def.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {state.locale === "de" ? def.titleDe : def.titleEn}
                      </Text>
                      {comp.note ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                          {comp.note}
                        </Text>
                      ) : null}
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 }}>
                        {dateStr}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <View
                        style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "#ede9fe", borderRadius: 999 }}
                      >
                        <Text style={{ color: "#6d28d9", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                          +{def.points}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            state.locale === "de" ? "Eintrag löschen?" : "Delete entry?",
                            "",
                            [
                              { text: state.locale === "de" ? "Abbrechen" : "Cancel", style: "cancel" },
                              {
                                text: state.locale === "de" ? "Löschen" : "Delete",
                                style: "destructive",
                                onPress: () => dispatch({ type: "removeOkoCompletion", id: comp.id }),
                              },
                            ],
                          );
                        }}
                      >
                        <Feather name="trash-2" size={14} color={c.mutedForeground} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ── Medal overview ── */}
        <Card style={{ gap: 10 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
            {state.locale === "de" ? "Medaillen & Stufen" : "Medals & Levels"}
          </Text>
          {MEDALS.map((m) => {
            const achieved = score >= m.min;
            return (
              <View
                key={m.nameDe}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: achieved ? 1 : 0.4,
                }}
              >
                <Text style={{ fontSize: 22, width: 30, textAlign: "center" }}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: achieved ? c.foreground : c.mutedForeground,
                      fontFamily: achieved ? "Inter_600SemiBold" : "Inter_400Regular",
                      fontSize: 14,
                    }}
                  >
                    {state.locale === "de" ? m.nameDe : m.nameEn}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    {m.min === 0
                      ? state.locale === "de" ? "Startpunkt" : "Starting point"
                      : `ab ${m.min} Punkte`}
                  </Text>
                </View>
                {achieved && <Feather name="check-circle" size={16} color="#059669" />}
              </View>
            );
          })}
        </Card>

        <Button
          label={state.locale === "de" ? "Einstellungen" : "Settings"}
          icon="settings"
          variant="ghost"
          onPress={() => router.push("/settings")}
        />
      </ScrollView>
    </View>
  );
}

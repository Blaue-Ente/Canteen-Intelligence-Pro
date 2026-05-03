import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { aiHandover } from "@/lib/ai";
import { isVoiceSupported, startVoice, type VoiceSession } from "@/lib/voice";

export default function Handover() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const author = useAuthor();
  const [shift, setShift] = useState<"morning" | "evening" | "night">("evening");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);

  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
    };
  }, []);

  const startRec = () => {
    if (!isVoiceSupported()) {
      Alert.alert(
        state.locale === "de" ? "Nicht verfügbar" : "Not available",
        state.locale === "de"
          ? "Sprach-Eingabe ist nur im Browser verfügbar. Tippe stattdessen direkt."
          : "Voice input is only available in the browser. Type instead.",
      );
      return;
    }
    sessionRef.current = startVoice({
      locale: state.locale,
      onPartial: (txt) => setTranscript(txt),
      onFinal: (txt) => setTranscript(txt),
      onEnd: () => setRecording(false),
      onError: (err) => {
        setRecording(false);
        Alert.alert("Voice", err);
      },
    });
    if (sessionRef.current) setRecording(true);
  };

  const stopRec = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecording(false);
  };

  const summarize = async () => {
    if (!transcript.trim()) return;
    setBusy(true);
    try {
      const result = await aiHandover({ transcript: transcript.trim(), locale: state.locale });
      dispatch({
        type: "addHandover",
        note: {
          id: newId(),
          date: new Date().toISOString(),
          shift,
          transcript: transcript.trim(),
          summary: result.summary,
          actions: result.actions,
          ...author,
        },
      });
      setTranscript("");
    } catch (e) {
      Alert.alert("KI", e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 60 }}>
        <Card>
          <SectionHeader title={t("handover")} />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {(["morning", "evening", "night"] as const).map((s) => (
              <Chip
                key={s}
                label={s === "morning" ? "Früh" : s === "evening" ? "Spät" : "Nacht"}
                active={shift === s}
                onPress={() => setShift(s)}
              />
            ))}
          </View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 }}>
            {t("transcript")}
          </Text>
          <TextInput
            value={transcript}
            onChangeText={setTranscript}
            multiline
            textAlignVertical="top"
            placeholder={state.locale === "de" ? "Was war heute wichtig?" : "What happened today?"}
            placeholderTextColor={c.mutedForeground}
            style={{
              minHeight: 140,
              backgroundColor: c.muted,
              color: c.foreground,
              borderRadius: c.radius,
              padding: 14,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              fontSize: 13,
              lineHeight: 18,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Button
              label={recording ? t("stop") : t("record")}
              icon={recording ? "square" : "mic"}
              variant={recording ? "destructive" : "secondary"}
              onPress={recording ? stopRec : startRec}
              style={{ flex: 1 }}
            />
            <Button
              label={busy ? t("thinking") : t("analyze")}
              icon="cpu"
              loading={busy}
              onPress={summarize}
              disabled={!transcript.trim()}
              style={{ flex: 1 }}
            />
          </View>
          {!isVoiceSupported() ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 8 }}>
              {state.locale === "de"
                ? "Hinweis: Sprache aktuell nur im Web. Du kannst Text direkt tippen."
                : "Note: voice currently web-only; you can also type."}
            </Text>
          ) : null}
        </Card>

        <SectionHeader title={state.locale === "de" ? "Vergangene Übergaben" : "Past handovers"} />
        {state.handovers.length === 0 ? (
          <Card>
            <EmptyState icon="message-square" title={t("empty")} />
          </Card>
        ) : (
          state.handovers.slice(0, 20).map((h) => (
            <Card key={h.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge
                  label={h.shift === "morning" ? "Früh" : h.shift === "evening" ? "Spät" : "Nacht"}
                  tone="accent"
                />
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                  {new Date(h.date).toLocaleString(state.locale === "de" ? "de-DE" : "en-GB")}
                </Text>
                {h.createdByName ? (
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    · {h.createdByName}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  marginTop: 10,
                  lineHeight: 19,
                }}
              >
                {h.summary}
              </Text>
              {h.actions.length > 0 ? (
                <View style={{ marginTop: 10, gap: 4 }}>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase" }}>
                    {t("actions")}
                  </Text>
                  {h.actions.map((a, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                      <Feather name="check-square" size={14} color={c.primary} style={{ marginTop: 3 }} />
                      <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>
                        {a}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ))
        )}

        {busy ? (
          <View style={{ alignItems: "center", padding: 12 }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

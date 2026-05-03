import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { streamChat, type AiChatMessage } from "@/lib/ai";
import {
  isTtsSupported,
  isVoiceSupported,
  speak,
  startVoice,
  stopSpeaking,
  type VoiceSession,
} from "@/lib/voice";
import type { ChatMessage } from "@/types";

function buildSystemPrompt(state: ReturnType<typeof useApp>["state"]): string {
  const lowStock = state.inventory
    .filter((i) => i.quantity < i.minQuantity)
    .map((i) => `${i.nameDe} (${i.quantity}${i.unit})`)
    .join(", ");
  const recipes = state.recipes.map((r) => r.nameDe).join(", ");
  const lang = state.locale === "de" ? "Deutsch" : "English";
  return [
    `You are KItchenOS, the proactive AI head chef and operations assistant for a German restaurant. Always answer in ${lang}.`,
    "Be concise, professional, action-oriented. Use bullet lists when helpful.",
    "Knowledge: German food law (LMIV allergens, §4 LMHV HACCP, EU 852/2004 hygiene), receipt/delivery-note OCR, menu rotation, supplier complaints, pricing, waste reduction.",
    `Current low-stock items: ${lowStock || "none"}.`,
    `Available recipes: ${recipes}.`,
    "When you suggest an order, list quantities & supplier. When asked about HACCP, cite the relevant German rule.",
  ].join(" ");
}

export default function Chat() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const listRef = useRef<FlatList>(null);
  const lastSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      voiceRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: text.trim(),
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "addChat", message: userMsg });
      dispatch({ type: "addChat", message: assistantMsg });
      setInput("");
      setBusy(true);
      let final = "";
      try {
        const sys: AiChatMessage = { role: "system", content: buildSystemPrompt(state) };
        const history: AiChatMessage[] = state.chat.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        final = await streamChat(
          [sys, ...history, { role: "user", content: text.trim() }],
          (delta) => dispatch({ type: "updateLastChat", content: delta }),
        );
      } catch (e) {
        const err = "\n⚠️ " + (e instanceof Error ? e.message : "Verbindungsfehler") + ".";
        dispatch({ type: "updateLastChat", content: err });
      } finally {
        setBusy(false);
        if (autoSpeak && final && lastSpokenRef.current !== final) {
          lastSpokenRef.current = final;
          speak(final, state.locale);
        }
      }
    },
    [autoSpeak, busy, dispatch, newId, state],
  );

  const toggleVoice = () => {
    if (listening) {
      voiceRef.current?.stop();
      voiceRef.current = null;
      setListening(false);
      return;
    }
    if (!isVoiceSupported()) {
      Alert.alert(
        "Sprache",
        Platform.OS === "web"
          ? "Browser unterstützt keine Spracheingabe (Chrome/Edge empfohlen)."
          : "Spracheingabe ist im Web verfügbar – mobile Unterstützung kommt bald.",
      );
      return;
    }
    let lastTranscript = "";
    const session = startVoice({
      locale: state.locale,
      onPartial: (txt) => {
        lastTranscript = txt;
        setInput(txt);
      },
      onFinal: (txt) => {
        lastTranscript = txt;
        setInput(txt);
      },
      onEnd: () => {
        setListening(false);
        voiceRef.current = null;
        if (lastTranscript.trim()) {
          // Auto-send after speech finishes.
          setTimeout(() => {
            void send(lastTranscript.trim());
          }, 50);
        }
      },
      onError: (err) => {
        setListening(false);
        voiceRef.current = null;
        if (err !== "no-speech" && err !== "aborted") {
          Alert.alert("Sprache", err);
        }
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
    }
  };

  const toggleAutoSpeak = () => {
    if (!isTtsSupported()) {
      Alert.alert(
        "Vorlesen",
        Platform.OS === "web"
          ? "Browser unterstützt keine Sprachausgabe."
          : "Sprachausgabe ist im Web verfügbar – mobile Unterstützung kommt bald.",
      );
      return;
    }
    setAutoSpeak((v) => {
      if (v) stopSpeaking();
      return !v;
    });
  };

  const suggestions =
    state.locale === "de"
      ? [
          "Was sollte ich heute bestellen?",
          "Wochenkarte vorschlagen",
          "Allergene für Schnitzel",
          "HACCP Kontrolle Kühlung",
        ]
      : [
          "What should I order today?",
          "Suggest a weekly menu",
          "Allergens in schnitzel",
          "HACCP fridge check",
        ];

  const messages = state.chat;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1, backgroundColor: c.background }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderColor: c.border,
          backgroundColor: c.background,
        }}
      >
        <Pressable
          onPress={toggleAutoSpeak}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: autoSpeak ? c.accent : c.muted,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather
            name={autoSpeak ? "volume-2" : "volume-x"}
            size={12}
            color={autoSpeak ? c.primary : c.mutedForeground}
          />
          <Text
            style={{
              color: autoSpeak ? c.primary : c.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 11,
            }}
          >
            Vorlesen
          </Text>
        </Pressable>
        {messages.length > 0 ? (
          <Pressable
            onPress={() => {
              stopSpeaking();
              dispatch({ type: "clearChat" });
            }}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.muted,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="trash-2" size={12} color={c.mutedForeground} />
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
              Verlauf löschen
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={[...messages].reverse()}
        inverted={messages.length > 0}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          flexGrow: 1,
          ...(messages.length === 0 ? { justifyContent: "center" } : {}),
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="cpu" size={28} color={c.primary} />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
              KItchenOS · KI
            </Text>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              {state.locale === "de"
                ? "Frag mich nach Bestellungen, Menüs, Allergenen oder HACCP."
                : "Ask me about orders, menus, allergens or HACCP."}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingHorizontal: 16 }}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: c.card,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <Bubble msg={item} />}
        ListHeaderComponent={
          busy ? (
            <View style={{ paddingHorizontal: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {t("thinking")}
              </Text>
            </View>
          ) : null
        }
      />

      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <Pressable
          onPress={toggleVoice}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: listening ? c.destructive : c.muted,
              alignItems: "center",
              justifyContent: "center",
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name={listening ? "square" : "mic"} size={18} color={listening ? "#fff" : c.foreground} />
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={listening ? t("listening") : t("askAi")}
          placeholderTextColor={c.mutedForeground}
          multiline
          style={{
            flex: 1,
            backgroundColor: c.muted,
            color: c.foreground,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxHeight: 120,
            fontFamily: "Inter_400Regular",
            fontSize: 15,
          }}
        />
        <Button icon="send" onPress={() => send(input)} loading={busy} disabled={!input.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const c = useColors();
  const { state } = useApp();
  const isUser = msg.role === "user";
  return (
    <View style={{ flexDirection: "row", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "85%",
          backgroundColor: isUser ? c.primary : c.card,
          borderRadius: 16,
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius: isUser ? 16 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: isUser ? 0 : 1,
          borderColor: c.border,
        }}
      >
        <Text
          style={{
            color: isUser ? c.primaryForeground : c.foreground,
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            lineHeight: 21,
          }}
        >
          {msg.content || "…"}
        </Text>
        {!isUser && msg.content && isTtsSupported() ? (
          <Pressable
            onPress={() => speak(msg.content, state.locale)}
            style={({ pressed }) => [
              { alignSelf: "flex-end", marginTop: 6, padding: 4 },
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={6}
          >
            <Feather name="volume-2" size={12} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

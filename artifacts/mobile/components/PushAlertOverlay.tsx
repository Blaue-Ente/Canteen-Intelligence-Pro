/**
 * PushAlertOverlay — Kios voice bridge for incoming Web Push notifications.
 *
 * When a push arrives while the app is open, the service worker posts a
 * KIOS_PUSH_ALERT message. This overlay slides in from the top, Kios reads
 * the notification aloud and asks for confirmation, then the user taps
 * "Bestätigt ✓" (or "Confirmed ✓") to dismiss.
 *
 * Only rendered on web (PWA). Native push is handled by the OS.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { pushAlertBus, type PushAlertPayload } from "@/lib/pushAlertBus";
import { speakHQ, stopSpeaking } from "@/lib/voice";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// Confirmation phrase Kios appends after reading the alert
const CONFIRM_PHRASE_DE = "Bitte bestätige, dass du die Meldung gesehen hast.";
const CONFIRM_PHRASE_EN = "Please confirm that you have seen this alert.";
const DISMISS_DE = "Verstanden. Danke.";
const DISMISS_EN = "Got it. Thank you.";

export function PushAlertOverlay() {
  if (Platform.OS !== "web") return null;
  return <PushAlertOverlayInner />;
}

function PushAlertOverlayInner() {
  const { state } = useApp();
  const c = useColors();
  const locale = (state.locale ?? "de") as "de" | "en";

  const [alert, setAlert] = useState<PushAlertPayload | null>(null);
  const [phase, setPhase] = useState<"idle" | "speaking" | "waiting">("idle");
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Subscribe to push alerts from the service worker
  useEffect(() => {
    return pushAlertBus.subscribe((incoming) => {
      setAlert(incoming);
      setPhase("speaking");
    });
  }, []);

  // Slide in / out animation
  useEffect(() => {
    if (alert) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [alert, slideAnim]);

  // Kios pulse animation while speaking
  useEffect(() => {
    if (phase === "speaking") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [phase, pulseAnim]);

  // When phase becomes "speaking", trigger Kios TTS
  useEffect(() => {
    if (phase !== "speaking" || !alert) return;
    const confirmPhrase = locale === "de" ? CONFIRM_PHRASE_DE : CONFIRM_PHRASE_EN;
    const fullText = `${alert.title}. ${alert.body}. ${confirmPhrase}`;
    speakHQ(fullText, locale, () => setPhase("waiting"));
  }, [phase, alert, locale]);

  const handleConfirm = useCallback(() => {
    stopSpeaking();
    const phrase = locale === "de" ? DISMISS_DE : DISMISS_EN;
    speakHQ(phrase, locale, () => {
      setAlert(null);
      setPhase("idle");
    });
  }, [locale]);

  if (!alert) return null;

  const isSpeaking = phase === "speaking";

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transform: [{ translateY: slideAnim }],
        // Safe-area friendly top padding
        paddingTop: 48,
        paddingHorizontal: 16,
        paddingBottom: 0,
        pointerEvents: "box-none",
      }}
    >
      <View
        style={{
          backgroundColor: c.card,
          borderColor: "#f59e0b",
          borderWidth: 2,
          borderRadius: 16,
          padding: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 12,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        {/* Kios avatar — pulses while speaking */}
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            backgroundColor: "#f59e0b",
            borderRadius: 24,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Feather
            name={isSpeaking ? "volume-2" : "bell"}
            size={22}
            color="#0a0a0b"
          />
        </Animated.View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Header row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 11,
                color: "#f59e0b",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginRight: 6,
              }}
            >
              KIOS
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: c.mutedForeground,
              }}
            >
              {isSpeaking
                ? locale === "de" ? "spricht…" : "speaking…"
                : locale === "de" ? "wartet auf Bestätigung" : "awaiting confirmation"}
            </Text>
          </View>

          {/* Notification title */}
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              color: c.foreground,
              marginBottom: 3,
            }}
          >
            {alert.title}
          </Text>

          {/* Notification body */}
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: c.mutedForeground,
              marginBottom: 12,
              lineHeight: 18,
            }}
          >
            {alert.body}
          </Text>

          {/* Confirm button — enabled after Kios finishes speaking */}
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              backgroundColor: isSpeaking ? c.border : "#f59e0b",
              opacity: pressed ? 0.8 : 1,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            })}
          >
            <Feather
              name="check-circle"
              size={14}
              color={isSpeaking ? c.mutedForeground : "#0a0a0b"}
            />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                color: isSpeaking ? c.mutedForeground : "#0a0a0b",
              }}
            >
              {locale === "de" ? "Bestätigt ✓" : "Confirmed ✓"}
            </Text>
          </Pressable>
        </View>

        {/* Dismiss without confirmation */}
        <Pressable
          onPress={() => {
            stopSpeaking();
            setAlert(null);
            setPhase("idle");
          }}
          style={{ padding: 4, marginTop: -2 }}
          hitSlop={12}
        >
          <Feather name="x" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

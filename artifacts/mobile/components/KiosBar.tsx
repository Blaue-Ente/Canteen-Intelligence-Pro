import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { KiosStatus } from "@/hooks/useKios";

interface Props {
  status: KiosStatus;
  isSupported: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

const STATUS_META: Record<
  KiosStatus,
  { icon: string; labelDe: string; pulse: boolean; bright: boolean }
> = {
  off:      { icon: "mic-off",    labelDe: "Kios",          pulse: false, bright: false },
  idle:     { icon: "mic",        labelDe: "Kios hört…",    pulse: true,  bright: false },
  awake:    { icon: "mic",        labelDe: "Ich höre…",     pulse: false, bright: true  },
  thinking: { icon: "cpu",        labelDe: "Denke nach…",   pulse: false, bright: true  },
  speaking: { icon: "volume-2",   labelDe: "Kios spricht…", pulse: false, bright: true  },
};

export function KiosBar({ status, isSupported, onEnable, onDisable }: Props) {
  const c = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;

  // Pulse animation for "idle" state
  useEffect(() => {
    const meta = STATUS_META[status];
    if (meta.pulse) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  // Spin animation for "thinking"
  useEffect(() => {
    if (status === "thinking") {
      const loop = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
      return () => { loop.stop(); spinAnim.setValue(0); };
    } else {
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  if (!isSupported && Platform.OS === "web") return null;
  if (Platform.OS !== "web") return null; // Web Speech API only

  const meta = STATUS_META[status];
  const isOff = status === "off";
  const isActive = !isOff;

  const pillBg = isOff
    ? c.card
    : meta.bright
    ? c.primary
    : c.card;

  const textColor = isOff
    ? c.mutedForeground
    : meta.bright
    ? c.primaryForeground
    : c.primary;

  const iconColor = textColor;
  const borderColor = isOff ? c.border : meta.bright ? c.primary : c.primary;

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 96,
        right: 14,
        zIndex: 200,
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {/* Main pill */}
      <Pressable
        onPress={isOff ? onEnable : onDisable}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 50,
          backgroundColor: pillBg,
          borderWidth: 1.5,
          borderColor,
          shadowColor: isActive ? c.primary : "#000",
          shadowOpacity: isActive ? 0.22 : 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {/* Idle pulse dot */}
        {status === "idle" && (
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.primary,
              opacity: pulseAnim,
            }}
          />
        )}

        {/* Thinking spin */}
        {status === "thinking" ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Feather name="cpu" size={15} color={iconColor} />
          </Animated.View>
        ) : (
          <Feather name={meta.icon as "mic"} size={15} color={iconColor} />
        )}

        <Text
          style={{
            color: textColor,
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
            letterSpacing: 0.2,
          }}
        >
          {meta.labelDe}
        </Text>

        {/* Close button when active */}
        {isActive && (
          <Feather name="x" size={13} color={textColor} style={{ marginLeft: 2, opacity: 0.7 }} />
        )}
      </Pressable>

      {/* Awake / speaking glow ring */}
      {(status === "awake" || status === "speaking") && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 54,
            borderWidth: 2,
            borderColor: c.primary,
            opacity: 0.3,
          }}
        />
      )}
    </View>
  );
}

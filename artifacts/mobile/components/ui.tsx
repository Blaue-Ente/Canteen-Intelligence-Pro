import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: c.radius,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.7 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  label?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg =
    variant === "primary"
      ? c.primary
      : variant === "secondary"
        ? c.secondary
        : variant === "destructive"
          ? c.destructive
          : "transparent";
  const fg =
    variant === "primary"
      ? c.primaryForeground
      : variant === "destructive"
        ? c.destructiveForeground
        : c.foreground;
  const border = variant === "ghost" ? c.border : "transparent";
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: c.radius,
          paddingHorizontal: 18,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: border,
          opacity: disabled ? 0.4 : 1,
        },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={fg} /> : null}
          {label ? (
            <Text
              style={{
                color: fg,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
              }}
            >
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  const c = useColors();
  const toneColor =
    tone === "success"
      ? c.success
      : tone === "warning"
        ? c.warning
        : tone === "destructive"
          ? c.destructive
          : c.primary;
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Feather name={icon} size={14} color={toneColor} /> : null}
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 12,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 24,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            marginTop: 2,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

export function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "destructive" | "accent";
}) {
  const c = useColors();
  const map: Record<string, { bg: string; fg: string }> = {
    default: { bg: c.muted, fg: c.mutedForeground },
    success: { bg: c.success + "22", fg: c.success },
    warning: { bg: c.warning + "22", fg: c.warning },
    destructive: { bg: c.destructive + "22", fg: c.destructive },
    accent: { bg: c.accent, fg: c.accentForeground },
  };
  const m = map[tone] ?? map.default!;
  return (
    <View
      style={{
        backgroundColor: m.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: m.fg,
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address";
  multiline?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_500Medium",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 10,
          color: c.foreground,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          minHeight: multiline ? 90 : undefined,
          textAlignVertical: multiline ? "top" : "auto",
        }}
      />
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text
            style={{
              color: c.primary,
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
}: {
  icon?: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body?: string;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={28} color={c.mutedForeground} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 15,
          marginTop: 12,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}

export function Row({
  left,
  right,
  onPress,
  icon,
  iconColor,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderColor: c.border,
        },
        pressed && onPress ? { opacity: 0.6 } : null,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: c.muted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name={icon} size={16} color={iconColor ?? c.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{left}</View>
      {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
      {onPress ? (
        <Feather
          name="chevron-right"
          size={18}
          color={c.mutedForeground}
          style={{ marginLeft: 6 }}
        />
      ) : null}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: active ? c.primary : c.muted,
          borderWidth: 1,
          borderColor: active ? c.primary : c.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={{
          color: active ? c.primaryForeground : c.foreground,
          fontFamily: "Inter_500Medium",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const labelStyle: TextStyle = {
  fontSize: 13,
};

export function ListLabel({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text
      style={[
        labelStyle,
        {
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
        },
      ]}
    >
      {children}
    </Text>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text
      style={{
        color: c.mutedForeground,
        fontFamily: "Inter_400Regular",
        fontSize: 12,
        marginTop: 2,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
});

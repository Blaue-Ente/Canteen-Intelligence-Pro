import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme, useWindowDimensions } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: isTablet ? 12 : 10,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS && !isTablet ? "transparent" : colors.background,
          borderTopWidth: isTablet ? 0.5 : isWeb ? 1 : 0.5,
          borderTopColor: colors.border,
          elevation: 0,
          height: isTablet ? 68 : isWeb ? 84 : undefined,
        },
        tabBarIconStyle: isTablet ? { marginBottom: 0 } : undefined,
        tabBarBackground: () =>
          isIOS && !isTablet ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={isTablet ? 24 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Lager",
          tabBarIcon: ({ color }) => <Feather name="package" size={isTablet ? 24 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Karte",
          tabBarIcon: ({ color }) => <Feather name="book-open" size={isTablet ? 24 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Statistik",
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={isTablet ? 24 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Mehr",
          tabBarIcon: ({ color }) => <Feather name="grid" size={isTablet ? 24 : 20} color={color} />,
        }}
      />
    </Tabs>
  );
}

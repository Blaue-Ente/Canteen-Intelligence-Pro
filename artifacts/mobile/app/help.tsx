import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState } from "@/components/ui";
import { HELP_SECTIONS, HELP_TOPICS, type HelpTopic } from "@/constants/helpTopics";
import { useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

// ─────────────────────────────────────────────────────────────────────────────
// Gebrauchsanleitung — strukturiertes In-App-Manual
//
// Aufbau:
//   • Volltextsuche (DE/EN, Titel + Keywords + What + Tips)
//   • Sektions-Filter-Chips (= dieselben 8 Sektionen wie das Mehr-Menü)
//   • Akkordeon-Karten pro Topic mit:
//     – Was es tut (1-Sätzer)
//     – Wann nutzen
//     – So gehts (Imperativ-Schritte)
//     – Tipps (gelb hinterlegt)
//     – „Öffnen"-Shortcut zum jeweiligen Bildschirm
//     – Verwandte Topics (zum Hineinspringen)
//
// Designziele: schnell durchsuchbar (alle Inhalte client-side), kein Network,
// barrierefrei (Suchfeld bekommt Fokus, Akkordeon mit accessibilityRole),
// druckfreundlich (alle expanded → ScrollView).
// ─────────────────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Filterung — kombiniert Sektion + Volltextsuche ──
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_TOPICS.filter((topic) => {
      if (activeSection !== "all" && topic.section !== activeSection) return false;
      if (!q) return true;
      const haystack = [
        topic.title,
        topic.what,
        topic.when,
        topic.tips.join(" "),
        topic.howTo.join(" "),
        topic.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, activeSection]);

  // ── Gruppiert nach Sektion für Header-Rendering ──
  const grouped = useMemo(() => {
    const map = new Map<string, HelpTopic[]>();
    visible.forEach((topic) => {
      const list = map.get(topic.section) ?? [];
      list.push(topic);
      map.set(topic.section, list);
    });
    return HELP_SECTIONS.filter((s) => map.has(s.id)).map((s) => ({
      section: s,
      topics: map.get(s.id)!,
    }));
  }, [visible]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 26,
              letterSpacing: -0.5,
            }}
          >
            {t("helpTitle")}
          </Text>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
            }}
          >
            {t("helpSubtitle")} · {HELP_TOPICS.length} {t("more").toLowerCase()}
          </Text>
        </View>

        {/* ── Suche ── */}
        <Card style={{ padding: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              gap: 10,
            }}
          >
            <Feather name="search" size={18} color={c.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("helpSearch")}
              placeholderTextColor={c.mutedForeground}
              style={{
                flex: 1,
                paddingVertical: 14,
                color: c.foreground,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
              }}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS !== "ios" && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={8}
                accessibilityLabel={t("helpClearSearch")}
              >
                <Feather name="x-circle" size={18} color={c.mutedForeground} />
              </Pressable>
            )}
          </View>
        </Card>

        {/* ── Sektions-Filter ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <FilterChip
            label={t("helpAll")}
            count={HELP_TOPICS.length}
            active={activeSection === "all"}
            onPress={() => setActiveSection("all")}
          />
          {HELP_SECTIONS.map((s) => {
            const count = HELP_TOPICS.filter((x) => x.section === s.id).length;
            return (
              <FilterChip
                key={s.id}
                label={t(s.titleKey as never)}
                count={count}
                active={activeSection === s.id}
                onPress={() => setActiveSection(s.id)}
              />
            );
          })}
        </ScrollView>

        {/* ── Topics ── */}
        {grouped.length === 0 ? (
          <EmptyState icon="search" title={t("helpEmpty")} />
        ) : (
          grouped.map(({ section, topics }) => (
            <View key={section.id} style={{ gap: 8 }}>
              <Text
                style={{
                  color: c.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginLeft: 4,
                  marginTop: 4,
                }}
              >
                {t(section.titleKey as never)}
              </Text>
              {topics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  expanded={expanded.has(topic.id)}
                  onToggle={() => toggle(topic.id)}
                  onOpenScreen={(to) => router.push(to as never)}
                  onJumpRelated={(id) => {
                    setExpanded((prev) => new Set(prev).add(id));
                    setQuery("");
                    setActiveSection("all");
                  }}
                />
              ))}
            </View>
          ))
        )}

        {/* ── Footer-Tipp ── */}
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#0ea5e915",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="mic" size={16} color="#0ea5e9" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                }}
              >
                {t("helpFooterTitle")}
              </Text>
              <Text
                style={{
                  color: c.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                {t("helpFooterBody")}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? c.primary : c.card,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={{
          color: active ? c.primaryForeground : c.foreground,
          fontFamily: "Inter_500Medium",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: active ? c.primaryForeground + "cc" : c.mutedForeground,
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function TopicCard({
  topic,
  expanded,
  onToggle,
  onOpenScreen,
  onJumpRelated,
}: {
  topic: HelpTopic;
  expanded: boolean;
  onToggle: () => void;
  onOpenScreen: (to: string) => void;
  onJumpRelated: (id: string) => void;
}) {
  const t = useT();
  const c = useColors();

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {/* Header — immer sichtbar, klickbar */}
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          gap: 12,
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: c.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={topic.icon} size={18} color={c.foreground} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
            }}
          >
            {topic.title}
          </Text>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 18,
            }}
            numberOfLines={expanded ? undefined : 2}
          >
            {topic.what}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={c.mutedForeground}
        />
      </Pressable>

      {expanded && (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            gap: 14,
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingTop: 14,
          }}
        >
          {/* When */}
          <Block label={t("helpUseCaseLabel")} icon="clock" iconColor={c.mutedForeground}>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {topic.when}
            </Text>
          </Block>

          {/* How */}
          <Block label={t("helpHowToLabel")} icon="list" iconColor={c.mutedForeground}>
            <View style={{ gap: 6 }}>
              {topic.howTo.map((step, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
                >
                  <Text
                    style={{
                      width: 22,
                      color: c.primary,
                      fontFamily: "Inter_700Bold",
                      fontSize: 13,
                      lineHeight: 20,
                    }}
                  >
                    {i + 1}.
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: c.foreground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </Block>

          {/* Tips — gelbe Akzentfarbe */}
          {topic.tips.length > 0 && (
            <View
              style={{
                backgroundColor: "#fef3c7",
                borderRadius: 10,
                padding: 12,
                gap: 8,
                borderWidth: 1,
                borderColor: "#fde68a",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="zap" size={14} color="#b45309" />
                <Text
                  style={{
                    color: "#92400e",
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t("helpTipLabel")}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                {topic.tips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                    <Text
                      style={{
                        color: "#92400e",
                        fontFamily: "Inter_700Bold",
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      ·
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: "#78350f",
                        fontFamily: "Inter_400Regular",
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Related */}
          {topic.related && topic.related.length > 0 && (
            <Block
              label={t("helpRelatedLabel")}
              icon="link"
              iconColor={c.mutedForeground}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {topic.related.map((relId) => {
                  const rel = HELP_TOPICS.find((x) => x.id === relId);
                  if (!rel) return null;
                  return (
                    <Pressable
                      key={relId}
                      onPress={() => onJumpRelated(relId)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: c.muted,
                      }}
                    >
                      <Feather name={rel.icon} size={12} color={c.mutedForeground} />
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                        }}
                      >
                        {rel.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Block>
          )}

          {/* Open shortcut */}
          {topic.screen && (
            <Button
              onPress={() => onOpenScreen(topic.screen!)}
              variant="ghost"
              icon="external-link"
              label={t("helpOpenScreen")}
            />
          )}
        </View>
      )}
    </Card>
  );
}

function Block({
  label,
  icon,
  iconColor,
  children,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name={icon} size={13} color={iconColor} />
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

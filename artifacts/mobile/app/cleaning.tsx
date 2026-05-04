import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { CleaningArea, CleaningCompletion, CleaningFrequency, CleaningTask } from "@/types";

const FREQ_ORDER: readonly CleaningFrequency[] = ["daily", "weekly", "monthly", "quarterly"];
const AREAS: readonly CleaningArea[] = [
  "kueche",
  "lager",
  "kuehlung",
  "geschirr",
  "boden",
  "abluft",
  "sanitaer",
];

function freqLabel(f: CleaningFrequency, locale: "de" | "en"): string {
  if (locale === "de") {
    return { daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich", quarterly: "Quartalsweise" }[f];
  }
  return { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly" }[f];
}

function areaLabel(a: CleaningArea, locale: "de" | "en"): string {
  const de: Record<CleaningArea, string> = {
    kueche: "Küche", lager: "Lager", kuehlung: "Kühlung", geschirr: "Spülküche",
    boden: "Boden / Abfluss", abluft: "Abluft / Fettabscheider", sanitaer: "Sanitär",
  };
  const en: Record<CleaningArea, string> = {
    kueche: "Kitchen", lager: "Storage", kuehlung: "Cooling", geschirr: "Dishwash",
    boden: "Floor / drains", abluft: "Hood / grease trap", sanitaer: "Sanitary",
  };
  return (locale === "de" ? de : en)[a];
}

/**
 * Compute the next-due ISO timestamp for a task given its frequency
 * and the most recent completion (if any).
 */
function nextDue(freq: CleaningFrequency, lastCompletedAt: string | undefined): Date {
  if (!lastCompletedAt) return new Date(); // never done → due now
  const last = new Date(lastCompletedAt);
  const d = new Date(last);
  const days = { daily: 1, weekly: 7, monthly: 30, quarterly: 91 }[freq];
  d.setDate(d.getDate() + days);
  return d;
}

interface RowState {
  task: CleaningTask;
  lastCompletedAt?: string;
  due: Date;
  overdue: boolean;
}

export default function CleaningScreen() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<CleaningFrequency | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState<CleaningArea>("kueche");
  const [newFreq, setNewFreq] = useState<CleaningFrequency>("daily");
  const [completing, setCompleting] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completionPhoto, setCompletionPhoto] = useState<string | undefined>();

  /** Index latest completion per task. */
  const lastByTask = useMemo(() => {
    const map: Record<string, CleaningCompletion> = {};
    for (const c2 of state.cleaningLog) {
      const prev = map[c2.taskId];
      if (!prev || c2.completedAt > prev.completedAt) map[c2.taskId] = c2;
    }
    return map;
  }, [state.cleaningLog]);

  const rows: RowState[] = useMemo(() => {
    const now = new Date();
    return state.cleaningTasks
      .filter((task) => task.active)
      .filter((task) => filter === "all" || task.frequency === filter)
      .map((task) => {
        const last = lastByTask[task.id];
        const due = nextDue(task.frequency, last?.completedAt);
        return { task, lastCompletedAt: last?.completedAt, due, overdue: due.getTime() <= now.getTime() };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [state.cleaningTasks, lastByTask, filter]);

  const dueToday = rows.filter((r) => r.overdue).length;
  const totalActive = state.cleaningTasks.filter((t) => t.active).length;
  const completionsLast7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return state.cleaningLog.filter((c) => new Date(c.completedAt).getTime() >= cutoff).length;
  }, [state.cleaningLog]);

  const grouped = useMemo(() => {
    const out: Record<CleaningFrequency, RowState[]> = { daily: [], weekly: [], monthly: [], quarterly: [] };
    for (const r of rows) out[r.task.frequency].push(r);
    return out;
  }, [rows]);

  const pickPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("photo"), state.locale === "de" ? "Foto-Upload nur in der App." : "Photo upload only in the app.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    if (!r.canceled && r.assets[0]) setCompletionPhoto(r.assets[0].uri);
  };

  const startComplete = (taskId: string) => {
    setCompleting(taskId);
    setCompletionNote("");
    setCompletionPhoto(undefined);
  };

  const confirmComplete = () => {
    if (!completing) return;
    const completion: CleaningCompletion = {
      id: newId(),
      taskId: completing,
      completedAt: new Date().toISOString(),
      by: state.companyProfile?.name ?? (state.locale === "de" ? "Personal" : "Staff"),
      note: completionNote.trim() || undefined,
      photoUri: completionPhoto,
    };
    dispatch({ type: "addCleaningCompletion", completion });
    setCompleting(null);
    setCompletionNote("");
    setCompletionPhoto(undefined);
  };

  const addTask = () => {
    if (!newName.trim()) return;
    dispatch({
      type: "addCleaningTask",
      task: {
        id: newId(),
        name: newName.trim(),
        area: newArea,
        frequency: newFreq,
        active: true,
        createdAt: new Date().toISOString(),
      },
    });
    setNewName("");
    setShowAdd(false);
  };

  const toggleActive = (task: CleaningTask) => {
    dispatch({ type: "updateCleaningTask", task: { ...task, active: !task.active } });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={c.foreground} />
        </Pressable>
        <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>
          {t("cleaningTitle")}
        </Text>
        <Pressable
          onPress={() => setShowAdd((v) => !v)}
          style={({ pressed }) => [
            {
              backgroundColor: c.muted,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name={showAdd ? "x" : "plus"} size={14} color={c.foreground} />
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {showAdd ? t("close") : t("addTask")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 80 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("dueToday")} value={String(dueToday)} icon="alert-triangle" tone={dueToday > 0 ? "warning" : "success"} />
          <Stat label={t("activeTasks")} value={String(totalActive)} icon="list" tone="default" />
          <Stat label={t("done7d")} value={String(completionsLast7)} icon="check-square" tone="default" />
        </View>

        {showAdd ? (
          <Card style={{ gap: 10 }}>
            <SectionHeader title={t("newTask")} />
            <Field label={t("name")} value={newName} onChangeText={setNewName} placeholder="z.B. Gefrierschrank Tür reinigen" />
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t("area")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {AREAS.map((a) => (
                <Chip key={a} label={areaLabel(a, state.locale)} active={newArea === a} onPress={() => setNewArea(a)} />
              ))}
            </View>
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t("frequency")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {FREQ_ORDER.map((f) => (
                <Chip key={f} label={freqLabel(f, state.locale)} active={newFreq === f} onPress={() => setNewFreq(f)} />
              ))}
            </View>
            <Button label={t("save")} icon="check" onPress={addTask} />
          </Card>
        ) : null}

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Chip label={t("all")} active={filter === "all"} onPress={() => setFilter("all")} />
            {FREQ_ORDER.map((f) => (
              <Chip key={f} label={freqLabel(f, state.locale)} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
        </Card>

        {rows.length === 0 ? (
          <EmptyState icon="droplet" title={t("noTasks")} body={t("addTaskHint")} />
        ) : (
          (filter === "all" ? FREQ_ORDER : [filter]).map((freq) => {
            const list = grouped[freq];
            if (!list || list.length === 0) return null;
            const sectionLabel =
              state.locale === "de"
                ? { daily: "Tagesreinigung", weekly: "Wochenreinigung", monthly: "Monatsreinigung", quarterly: "Grundreinigung" }[freq]
                : { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Deep clean" }[freq];

            return (
              <Card key={freq} style={{ gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{sectionLabel}</Text>
                {list.map((row) => {
                  const isCompleting = completing === row.task.id;
                  const dueLabel = row.lastCompletedAt
                    ? new Date(row.lastCompletedAt).toLocaleDateString(state.locale === "de" ? "de-DE" : "en-US")
                    : (state.locale === "de" ? "Noch nie" : "Never");
                  return (
                    <View
                      key={row.task.id}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: row.overdue ? c.warning + "1a" : c.muted,
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                            {state.locale === "en" && row.task.nameEn ? row.task.nameEn : row.task.name}
                          </Text>
                          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                            {areaLabel(row.task.area, state.locale)} · {t("lastDone")}: {dueLabel}
                          </Text>
                        </View>
                        <Badge
                          label={row.overdue ? t("due") : t("ok")}
                          tone={row.overdue ? "warning" : "success"}
                        />
                      </View>
                      {row.task.instructions ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                          {row.task.instructions}
                        </Text>
                      ) : null}
                      {row.task.chemical ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                          {state.locale === "de" ? "Reinigungsmittel" : "Detergent"}: {row.task.chemical}
                        </Text>
                      ) : null}

                      {isCompleting ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <Field
                            label={t("note")}
                            value={completionNote}
                            onChangeText={setCompletionNote}
                            placeholder={state.locale === "de" ? "z.B. Filter ausgetauscht" : "e.g. filter replaced"}
                            multiline
                          />
                          {completionPhoto ? (
                            <Image source={{ uri: completionPhoto }} style={{ width: "100%", height: 140, borderRadius: 8 }} resizeMode="cover" />
                          ) : null}
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Button label={t("photo")} icon="camera" variant="ghost" onPress={pickPhoto} style={{ flex: 1 }} />
                            <Button label={t("cancel")} variant="ghost" onPress={() => setCompleting(null)} style={{ flex: 1 }} />
                            <Button label={t("done")} icon="check" onPress={confirmComplete} style={{ flex: 1 }} />
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Button label={t("markDone")} icon="check" onPress={() => startComplete(row.task.id)} style={{ flex: 1 }} />
                          <Pressable
                            onPress={() => toggleActive(row.task)}
                            style={({ pressed }) => [
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: c.background,
                                borderWidth: 1,
                                borderColor: c.border,
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Feather name="eye-off" size={14} color={c.mutedForeground} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

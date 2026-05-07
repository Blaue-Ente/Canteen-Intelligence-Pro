/**
 * Cleaning schedule screen — HACCP §4 LMHV
 *
 * Enforces per-day completion quotas (timesPerDay), shows scheduled time
 * hints, blocks over-marking, and supports post-hoc correction of entries.
 * Camera integration offers both direct capture and library picker.
 */

import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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

/** ISO date string YYYY-MM-DD for a Date (local calendar day). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Next-due timestamp for a task given its frequency and last completion.
 */
function nextDue(freq: CleaningFrequency, lastCompletedAt: string | undefined): Date {
  if (!lastCompletedAt) return new Date();
  const last = new Date(lastCompletedAt);
  const d = new Date(last);
  const days = { daily: 1, weekly: 7, monthly: 30, quarterly: 91 }[freq];
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * How many completions are required in the current period.
 * For daily tasks this is `timesPerDay ?? 1`.
 * For all other frequencies it's always 1.
 */
function requiredCount(task: CleaningTask): number {
  if (task.frequency === "daily") return task.timesPerDay ?? 1;
  return 1;
}

interface RowState {
  task: CleaningTask;
  lastCompletedAt?: string;
  due: Date;
  overdue: boolean;
  /** Completions within the current period (today for daily; this week/month/quarter otherwise). */
  doneInPeriod: number;
  /** How many more completions are needed right now. */
  slotsLeft: number;
}

export default function CleaningScreen() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isDe = state.locale === "de";
  const today = toLocalDateStr(new Date());

  // ─── List filters ────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<CleaningFrequency | "all">("all");

  // ─── Add-task form ───────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState<CleaningArea>("kueche");
  const [newFreq, setNewFreq] = useState<CleaningFrequency>("daily");
  const [newTimesPerDay, setNewTimesPerDay] = useState("1");
  const [newScheduledTimes, setNewScheduledTimes] = useState("");

  // ─── Completion flow ─────────────────────────────────────────────────────
  const [completing, setCompleting] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completionPhoto, setCompletionPhoto] = useState<string | undefined>();

  // ─── History / correction panel ──────────────────────────────────────────
  /** Which task's history is expanded. */
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  /** Which completion entry is being corrected. Key = completion.id */
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionPhoto, setCorrectionPhoto] = useState<string | undefined>();

  // ─── Index: latest completion per task ───────────────────────────────────
  const lastByTask = useMemo(() => {
    const map: Record<string, CleaningCompletion> = {};
    for (const c2 of state.cleaningLog) {
      const prev = map[c2.taskId];
      if (!prev || c2.completedAt > prev.completedAt) map[c2.taskId] = c2;
    }
    return map;
  }, [state.cleaningLog]);

  /** Count completions for a task within the current period window. */
  const countInPeriod = useMemo(() => {
    const result: Record<string, number> = {};
    for (const entry of state.cleaningLog) {
      const task = state.cleaningTasks.find((tk) => tk.id === entry.taskId);
      if (!task) continue;

      let inPeriod = false;
      if (task.frequency === "daily") {
        // Same calendar day
        inPeriod = toLocalDateStr(new Date(entry.completedAt)) === today;
      } else {
        // Within last N days of the period
        const days = { weekly: 7, monthly: 30, quarterly: 91 }[task.frequency] ?? 1;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        inPeriod = new Date(entry.completedAt).getTime() >= cutoff;
      }
      if (inPeriod) result[task.id] = (result[task.id] ?? 0) + 1;
    }
    return result;
  }, [state.cleaningLog, state.cleaningTasks, today]);

  const rows: RowState[] = useMemo(() => {
    const now = new Date();
    return state.cleaningTasks
      .filter((task) => task.active)
      .filter((task) => filter === "all" || task.frequency === filter)
      .map((task) => {
        const last = lastByTask[task.id];
        const due = nextDue(task.frequency, last?.completedAt);
        const overdue = due.getTime() <= now.getTime();
        const doneInPeriod = countInPeriod[task.id] ?? 0;
        const required = requiredCount(task);
        const slotsLeft = Math.max(0, required - doneInPeriod);
        return { task, lastCompletedAt: last?.completedAt, due, overdue, doneInPeriod, slotsLeft };
      })
      .sort((a, b) => {
        // Sort: slots remaining first, then by due date
        if (a.slotsLeft > 0 && b.slotsLeft === 0) return -1;
        if (a.slotsLeft === 0 && b.slotsLeft > 0) return 1;
        return a.due.getTime() - b.due.getTime();
      });
  }, [state.cleaningTasks, lastByTask, countInPeriod, filter]);

  const dueToday = rows.filter((r) => r.slotsLeft > 0).length;
  const totalActive = state.cleaningTasks.filter((tk) => tk.active).length;
  const completionsLast7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return state.cleaningLog.filter((c2) => new Date(c2.completedAt).getTime() >= cutoff).length;
  }, [state.cleaningLog]);

  const grouped = useMemo(() => {
    const out: Record<CleaningFrequency, RowState[]> = { daily: [], weekly: [], monthly: [], quarterly: [] };
    for (const r of rows) out[r.task.frequency].push(r);
    return out;
  }, [rows]);

  // ─── History: completions per task (last 20) ─────────────────────────────
  const completionsByTask = useMemo(() => {
    const map: Record<string, CleaningCompletion[]> = {};
    for (const entry of state.cleaningLog) {
      if (!map[entry.taskId]) map[entry.taskId] = [];
      map[entry.taskId].push(entry);
    }
    // Sort newest first, limit to 20 per task
    for (const id of Object.keys(map)) {
      map[id] = map[id].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 20);
    }
    return map;
  }, [state.cleaningLog]);

  // ─── Photo picker ─────────────────────────────────────────────────────────
  /**
   * Offer camera vs library on native; on web just use the library (camera not
   * available via ImagePicker on web).
   */
  const pickPhoto = async (onDone: (uri: string) => void) => {
    if (Platform.OS === "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!r.canceled && r.assets[0]) onDone(r.assets[0].uri);
      return;
    }
    // Native: offer both options
    Alert.alert(
      isDe ? "Foto hinzufügen" : "Add photo",
      undefined,
      [
        {
          text: t("takePhoto"),
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert(
                isDe ? "Kamera-Zugriff benötigt" : "Camera permission required",
                isDe ? "Bitte erteile der App Kamera-Zugriff in den Systemeinstellungen." : "Please allow camera access in device settings.",
              );
              return;
            }
            const r = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]) onDone(r.assets[0].uri);
          },
        },
        {
          text: t("fromLibrary"),
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const r = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]) onDone(r.assets[0].uri);
          },
        },
        { text: t("cancel"), style: "cancel" },
      ],
    );
  };

  // ─── Completion actions ───────────────────────────────────────────────────
  const startComplete = (taskId: string) => {
    setCompleting(taskId);
    setCompletionNote("");
    setCompletionPhoto(undefined);
    setExpandedHistory(null);
  };

  const confirmComplete = () => {
    if (!completing) return;
    const task = state.cleaningTasks.find((tk) => tk.id === completing);
    const completion: CleaningCompletion = {
      id: newId(),
      taskId: completing,
      completedAt: new Date().toISOString(),
      by: state.companyProfile?.name ?? (isDe ? "Personal" : "Staff"),
      note: completionNote.trim() || undefined,
      photoUri: completionPhoto,
    };
    dispatch({ type: "addCleaningCompletion", completion });
    // If timesPerDay > 1, show how many slots remain
    const required = requiredCount(task ?? { frequency: "daily" } as CleaningTask);
    const newDoneInPeriod = (countInPeriod[completing] ?? 0) + 1;
    const remaining = required - newDoneInPeriod;
    if (remaining > 0) {
      Alert.alert(
        isDe ? "Erledigt" : "Done",
        isDe ? `Noch ${remaining} Mal heute fällig.` : `${remaining} more time(s) due today.`,
        [{ text: "OK" }],
      );
    }
    setCompleting(null);
    setCompletionNote("");
    setCompletionPhoto(undefined);
  };

  // ─── Correction actions ───────────────────────────────────────────────────
  const startCorrection = (entry: CleaningCompletion) => {
    setCorrecting(entry.id);
    setCorrectionNote(entry.note ?? "");
    setCorrectionPhoto(entry.photoUri);
  };

  const confirmCorrection = (entry: CleaningCompletion) => {
    const updated: CleaningCompletion = {
      ...entry,
      note: correctionNote.trim() || undefined,
      photoUri: correctionPhoto,
      correctionNote: correctionNote.trim() || undefined,
      correctedAt: new Date().toISOString(),
      correctedBy: state.companyProfile?.name ?? (isDe ? "Personal" : "Staff"),
    };
    dispatch({ type: "updateCleaningCompletion", completion: updated });
    setCorrecting(null);
    setCorrectionNote("");
    setCorrectionPhoto(undefined);
  };

  // ─── Add task ─────────────────────────────────────────────────────────────
  const addTask = () => {
    if (!newName.trim()) return;
    const times = newScheduledTimes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    dispatch({
      type: "addCleaningTask",
      task: {
        id: newId(),
        name: newName.trim(),
        area: newArea,
        frequency: newFreq,
        timesPerDay: newFreq === "daily" ? Math.max(1, parseInt(newTimesPerDay, 10) || 1) : undefined,
        scheduledTimes: times.length > 0 ? times : undefined,
        active: true,
        createdAt: new Date().toISOString(),
      },
    });
    setNewName("");
    setNewTimesPerDay("1");
    setNewScheduledTimes("");
    setShowAdd(false);
  };

  const toggleActive = (task: CleaningTask) => {
    dispatch({ type: "updateCleaningTask", task: { ...task, active: !task.active } });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
          onPress={() => { setShowAdd((v) => !v); setExpandedHistory(null); setCompleting(null); }}
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

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label={t("dueToday")} value={String(dueToday)} icon="alert-triangle" tone={dueToday > 0 ? "warning" : "success"} />
          <Stat label={t("activeTasks")} value={String(totalActive)} icon="list" tone="default" />
          <Stat label={t("done7d")} value={String(completionsLast7)} icon="check-square" tone="default" />
        </View>

        {/* Add task form */}
        {showAdd ? (
          <Card style={{ gap: 10 }}>
            <SectionHeader title={t("newTask")} />
            <Field
              label={t("name")}
              value={newName}
              onChangeText={setNewName}
              placeholder={isDe ? "z.B. Abluftfilter reinigen" : "e.g. Clean air filter"}
            />

            {/* Area chips */}
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t("area")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {AREAS.map((a) => (
                <Chip key={a} label={areaLabel(a, state.locale)} active={newArea === a} onPress={() => setNewArea(a)} />
              ))}
            </View>

            {/* Frequency chips */}
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t("frequency")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {FREQ_ORDER.map((f) => (
                <Chip key={f} label={freqLabel(f, state.locale)} active={newFreq === f} onPress={() => setNewFreq(f)} />
              ))}
            </View>

            {/* Daily-only: timesPerDay + scheduled times */}
            {newFreq === "daily" ? (
              <>
                <Field
                  label={t("timesPerDay")}
                  value={newTimesPerDay}
                  onChangeText={setNewTimesPerDay}
                  keyboardType="numeric"
                  placeholder="1"
                />
                <Field
                  label={t("scheduledTimesLabel")}
                  value={newScheduledTimes}
                  onChangeText={setNewScheduledTimes}
                  placeholder={isDe ? "z.B. 08:00, 14:00, 20:00" : "e.g. 08:00, 14:00, 20:00"}
                />
                <Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                  {t("scheduledTimesHint")}
                </Text>
              </>
            ) : null}

            <Button label={t("save")} icon="check" onPress={addTask} />
          </Card>
        ) : null}

        {/* Frequency filter chips */}
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Chip label={t("all")} active={filter === "all"} onPress={() => setFilter("all")} />
            {FREQ_ORDER.map((f) => (
              <Chip key={f} label={freqLabel(f, state.locale)} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
        </Card>

        {/* Task groups */}
        {rows.length === 0 ? (
          <EmptyState icon="droplet" title={t("noTasks")} body={t("addTaskHint")} />
        ) : (
          (filter === "all" ? FREQ_ORDER : [filter]).map((freq) => {
            const list = grouped[freq];
            if (!list || list.length === 0) return null;
            const sectionLabel =
              isDe
                ? { daily: "Tagesreinigung", weekly: "Wochenreinigung", monthly: "Monatsreinigung", quarterly: "Grundreinigung" }[freq]
                : { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Deep clean" }[freq];

            return (
              <Card key={freq} style={{ gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{sectionLabel}</Text>

                {list.map((row) => {
                  const isCompleting = completing === row.task.id;
                  const showHistory = expandedHistory === row.task.id;
                  const allDone = row.slotsLeft === 0;
                  const required = requiredCount(row.task);
                  const doneLabel = row.lastCompletedAt
                    ? new Date(row.lastCompletedAt).toLocaleDateString(isDe ? "de-DE" : "en-US")
                    : (isDe ? "Noch nie" : "Never");

                  const taskEntries = completionsByTask[row.task.id] ?? [];
                  const correctingEntry = taskEntries.find((e) => e.id === correcting);

                  return (
                    <View
                      key={row.task.id}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: allDone
                          ? c.success + "15"
                          : row.slotsLeft > 0 && row.overdue
                          ? c.warning + "1a"
                          : c.muted,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: allDone ? c.success + "33" : "transparent",
                      }}
                    >
                      {/* Task header row */}
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                            {state.locale === "en" && row.task.nameEn ? row.task.nameEn : row.task.name}
                          </Text>
                          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                            {areaLabel(row.task.area, state.locale)} · {t("lastDone")}: {doneLabel}
                          </Text>

                          {/* Scheduled times hint */}
                          {row.task.scheduledTimes && row.task.scheduledTimes.length > 0 ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Feather name="clock" size={11} color={c.primary} />
                              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                                {row.task.scheduledTimes.join("  ·  ")}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Progress / status badge */}
                        {required > 1 ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              backgroundColor: allDone ? c.success + "22" : c.primary + "22",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: allDone ? c.success : c.primary,
                                fontFamily: "Inter_700Bold",
                                fontSize: 14,
                              }}
                            >
                              {row.doneInPeriod}/{required}
                            </Text>
                            <Text style={{ color: allDone ? c.success : c.primary, fontFamily: "Inter_400Regular", fontSize: 10 }}>
                              {t("todayProgress")}
                            </Text>
                          </View>
                        ) : (
                          <Badge
                            label={allDone ? t("ok") : t("due")}
                            tone={allDone ? "success" : "warning"}
                          />
                        )}
                      </View>

                      {/* Instructions */}
                      {row.task.instructions ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                          {row.task.instructions}
                        </Text>
                      ) : null}

                      {/* Chemical */}
                      {row.task.chemical ? (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                          {isDe ? "Reinigungsmittel" : "Detergent"}: {row.task.chemical}
                        </Text>
                      ) : null}

                      {/* ── Completion form ── */}
                      {isCompleting ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <Field
                            label={t("note")}
                            value={completionNote}
                            onChangeText={setCompletionNote}
                            placeholder={isDe ? "z.B. Filter ausgetauscht" : "e.g. filter replaced"}
                            multiline
                          />
                          {completionPhoto ? (
                            <View>
                              <Image
                                source={{ uri: completionPhoto }}
                                style={{ width: "100%", height: 140, borderRadius: 8 }}
                                resizeMode="cover"
                              />
                              <Pressable
                                onPress={() => setCompletionPhoto(undefined)}
                                style={{ position: "absolute", top: 6, right: 6, backgroundColor: c.destructive + "cc", borderRadius: 12, padding: 4 }}
                              >
                                <Feather name="x" size={12} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Button
                              label={t("photo")}
                              icon="camera"
                              variant="ghost"
                              onPress={() => pickPhoto((uri) => setCompletionPhoto(uri))}
                              style={{ flex: 1 }}
                            />
                            <Button
                              label={t("cancel")}
                              variant="ghost"
                              onPress={() => setCompleting(null)}
                              style={{ flex: 1 }}
                            />
                            <Button
                              label={t("done")}
                              icon="check"
                              onPress={confirmComplete}
                              style={{ flex: 1 }}
                            />
                          </View>
                        </View>

                      ) : (
                        /* ── Action buttons ── */
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                          {allDone ? (
                            /* All slots done — show summary */
                            <View
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: c.success + "22",
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <Feather name="check-circle" size={14} color={c.success} />
                              <Text style={{ color: c.success, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                                {t("allDoneToday")}
                              </Text>
                            </View>
                          ) : (
                            <Button
                              label={
                                required > 1
                                  ? `${t("markDone")} (${row.doneInPeriod + 1}/${required})`
                                  : t("markDone")
                              }
                              icon="check"
                              onPress={() => startComplete(row.task.id)}
                              style={{ flex: 1 }}
                            />
                          )}

                          {/* History toggle */}
                          <Pressable
                            onPress={() => {
                              setExpandedHistory(showHistory ? null : row.task.id);
                              setCompleting(null);
                              setCorrecting(null);
                            }}
                            style={({ pressed }) => [
                              {
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: showHistory ? c.primary + "22" : c.background,
                                borderWidth: 1,
                                borderColor: showHistory ? c.primary : c.border,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Feather name="list" size={13} color={showHistory ? c.primary : c.mutedForeground} />
                            {taskEntries.length > 0 ? (
                              <Text style={{ color: showHistory ? c.primary : c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                                {taskEntries.length}
                              </Text>
                            ) : null}
                          </Pressable>

                          {/* Deactivate */}
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

                      {/* ── Completion history + correction ── */}
                      {showHistory ? (
                        <View
                          style={{
                            marginTop: 4,
                            borderTopWidth: 1,
                            borderColor: c.border,
                            paddingTop: 8,
                            gap: 8,
                          }}
                        >
                          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                            {t("taskHistory")}
                          </Text>

                          {taskEntries.length === 0 ? (
                            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                              {t("noCompletions")}
                            </Text>
                          ) : (
                            taskEntries.map((entry) => {
                              const isCorrecting = correcting === entry.id;
                              const entryDate = new Date(entry.completedAt);
                              return (
                                <View
                                  key={entry.id}
                                  style={{
                                    padding: 10,
                                    borderRadius: 8,
                                    backgroundColor: c.card,
                                    borderWidth: 1,
                                    borderColor: entry.correctedAt ? c.primary + "44" : c.border,
                                    gap: 6,
                                  }}
                                >
                                  {/* Entry header */}
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Feather name="check-circle" size={14} color={c.success} />
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                                        {entryDate.toLocaleString(isDe ? "de-DE" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                                        {" · "}{entry.by}
                                      </Text>
                                      {entry.note ? (
                                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                                          {entry.note}
                                        </Text>
                                      ) : null}
                                    </View>
                                    {entry.correctedAt ? (
                                      <Badge label={t("correctedMark")} tone="default" />
                                    ) : null}
                                    {/* Edit button */}
                                    {!isCorrecting ? (
                                      <Pressable
                                        onPress={() => startCorrection(entry)}
                                        style={({ pressed }) => [
                                          { padding: 6, borderRadius: 6, backgroundColor: c.muted },
                                          pressed && { opacity: 0.7 },
                                        ]}
                                      >
                                        <Feather name="edit-2" size={13} color={c.mutedForeground} />
                                      </Pressable>
                                    ) : null}
                                  </View>

                                  {/* Photo thumbnail */}
                                  {entry.photoUri && !isCorrecting ? (
                                    <Image
                                      source={{ uri: entry.photoUri }}
                                      style={{ width: "100%", height: 100, borderRadius: 6 }}
                                      resizeMode="cover"
                                    />
                                  ) : null}

                                  {/* Previous correction note */}
                                  {entry.correctionNote && !isCorrecting ? (
                                    <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                                      {isDe ? "Korrektur" : "Correction"}: {entry.correctionNote}
                                    </Text>
                                  ) : null}

                                  {/* ── Correction form ── */}
                                  {isCorrecting ? (
                                    <View style={{ gap: 8, marginTop: 4 }}>
                                      <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                                        {t("editEntry")}
                                      </Text>
                                      <Field
                                        label={t("note")}
                                        value={correctionNote}
                                        onChangeText={setCorrectionNote}
                                        placeholder={isDe ? "Korrigierte Notiz" : "Corrected note"}
                                        multiline
                                      />
                                      {correctionPhoto ? (
                                        <View>
                                          <Image
                                            source={{ uri: correctionPhoto }}
                                            style={{ width: "100%", height: 100, borderRadius: 6 }}
                                            resizeMode="cover"
                                          />
                                          <Pressable
                                            onPress={() => setCorrectionPhoto(undefined)}
                                            style={{ position: "absolute", top: 4, right: 4, backgroundColor: c.destructive + "cc", borderRadius: 10, padding: 3 }}
                                          >
                                            <Feather name="x" size={11} color="#fff" />
                                          </Pressable>
                                        </View>
                                      ) : null}
                                      <View style={{ flexDirection: "row", gap: 8 }}>
                                        <Button
                                          label={t("photo")}
                                          icon="camera"
                                          variant="ghost"
                                          onPress={() => pickPhoto((uri) => setCorrectionPhoto(uri))}
                                          style={{ flex: 1 }}
                                        />
                                        <Button
                                          label={t("cancel")}
                                          variant="ghost"
                                          onPress={() => setCorrecting(null)}
                                          style={{ flex: 1 }}
                                        />
                                        <Button
                                          label={t("save")}
                                          icon="check"
                                          onPress={() => correctingEntry && confirmCorrection(correctingEntry)}
                                          style={{ flex: 1 }}
                                        />
                                      </View>
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })
                          )}
                        </View>
                      ) : null}
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

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { RequiresAddon } from "@/components/RequiresAddon";
import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useBleThermometer } from "@/hooks/useBleThermometer";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/hooks/useSubscription";
import { buildHaccpSuggestions } from "@/lib/haccpAutosuggest";
import { pendingToday } from "@/lib/foodSamples";
import { inspectionPdfHtml } from "@/lib/inspectionPdf";
import { sharePdf } from "@/lib/pdf";
import type { FoodSample, HaccpLog, HaccpSuggestion, StorageLocation, StorageLocationCategory } from "@/types";

type SourceFilter = "all" | "auto" | "manual";

/** Human label + tone for the provenance badge. */
function sourceMeta(s: HaccpLog["source"]): { label: string; tone: "default" | "success" | "warning" | "destructive" } {
  switch (s) {
    case "auto-suggest":    return { label: "Auto-Vorschlag", tone: "success" };
    case "auto-production": return { label: "Aus Produktion",  tone: "success" };
    case "auto-delivery":   return { label: "Aus Bestellung",  tone: "success" };
    case "ble":             return { label: "Bluetooth",       tone: "warning" };
    case "manual":
    default:                return { label: "Manuell",         tone: "default" };
  }
}

const TYPES: HaccpLog["type"][] = ["fridge", "freezer", "delivery", "cleaning", "cooking"];

const CATEGORY_TO_TYPE: Record<StorageLocationCategory, HaccpLog["type"]> = {
  fridge: "fridge",
  freezer: "freezer",
  room: "cleaning",
  kitchen: "cooking",
  delivery: "delivery",
};

const TYPE_TO_CATEGORY: Record<HaccpLog["type"], StorageLocationCategory> = {
  fridge: "fridge",
  freezer: "freezer",
  delivery: "delivery",
  cleaning: "room",
  cooking: "kitchen",
};

const LEGAL_DOCS = [
  {
    id: "lmiv",
    title: "LMIV (EU 1169/2011)",
    body:
      "Lebensmittel-Informationsverordnung. Pflichtangaben: 14 Hauptallergene müssen für jedes Gericht ausgewiesen werden (z.B. Gluten, Milch, Ei, Soja, Nüsse, Fisch). Auf Speisekarte oder mündlich auf Anfrage.",
  },
  {
    id: "lmhv",
    title: "§4 LMHV – HACCP",
    body:
      "Lebensmittelhygiene-Verordnung. Verpflichtung zur Erstellung und Pflege eines HACCP-Konzepts: Gefahrenanalyse, kritische Lenkungspunkte (CCPs), Überwachungs- und Korrekturverfahren, Dokumentation.",
  },
  {
    id: "eu852",
    title: "EU 852/2004",
    body:
      "Verordnung über Lebensmittelhygiene. Allgemeine und besondere Hygienevorschriften für Räume, Personal, Schulungen, Schädlingsbekämpfung und Rückverfolgbarkeit.",
  },
  {
    id: "kuehl",
    title: "Kühlkette",
    body:
      "Kühlware: ≤ 7°C (Fleisch ≤ 4°C, Fisch ≤ 2°C, Geflügel ≤ 4°C). Tiefkühlware: ≤ -18°C. Heißhaltung: ≥ 65°C. Bei Wareneingang prüfen und dokumentieren.",
  },
];

export default function Haccp() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [type, setType] = useState<HaccpLog["type"]>("fridge");
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [customLoc, setCustomLoc] = useState("");
  const [temp, setTemp] = useState("");
  const [note, setNote] = useState("");
  const author = useAuthor();

  // T013b — auto-suggestions, recomputed every render from history + storage targets.
  const suggestions = useMemo(
    () => buildHaccpSuggestions({ storageLocations: state.storageLocations, haccp: state.haccp }),
    [state.storageLocations, state.haccp],
  );
  // Per-suggestion local edit state: { [suggestionId]: { mode, value, comment } }
  const [editing, setEditing] = useState<Record<string, { mode: "deviation" | "corrective"; value: string; comment: string }>>({});

  // T013d — pending Rückstellproben for today.
  const samplesPending = useMemo(() => pendingToday(state.foodSamples), [state.foodSamples]);
  const samplesAll = useMemo(
    () => state.foodSamples.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 24),
    [state.foodSamples],
  );

  // T013e — BLE thermometer (paid add-on; gated below by RequiresAddon).
  const { hasAddon } = useSubscription();
  const [bleSelectedId, setBleSelectedId] = useState<string | undefined>(undefined);
  const ble = useBleThermometer({ deviceId: bleSelectedId, enabled: hasAddon("bleThermometers") });

  // T013c — history filter by source.
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const filteredHistory = useMemo(() => {
    if (sourceFilter === "all") return state.haccp;
    if (sourceFilter === "manual") return state.haccp.filter((h) => !h.source || h.source === "manual");
    return state.haccp.filter((h) => h.source && h.source !== "manual");
  }, [state.haccp, sourceFilter]);

  // Add-storage modal state
  const [showAddStorage, setShowAddStorage] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<StorageLocationCategory>("fridge");
  const [newTemp, setNewTemp] = useState("");

  // Inspection-mode period selector state
  const isDe = state.locale === "de";
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [showInspection, setShowInspection] = useState(false);
  const [fromDate, setFromDate] = useState(monthAgoIso);
  const [toDate, setToDate] = useState(todayIso);
  const [generating, setGenerating] = useState(false);

  const generateInspectionPdf = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const html = inspectionPdfHtml({ state, fromDate, toDate });
      await sharePdf(html, `lebensmittelkontrolle_${fromDate}_${toDate}.pdf`);
      setShowInspection(false);
    } catch (e) {
      Alert.alert(
        isDe ? "Fehler" : "Error",
        isDe ? "PDF konnte nicht erstellt werden." : "Could not generate PDF.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const setPreset = (days: number) => {
    setFromDate(new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10));
    setToDate(todayIso);
  };

  const filteredStorage = useMemo(() => {
    const cat = TYPE_TO_CATEGORY[type];
    return state.storageLocations.filter((s) => s.category === cat);
  }, [state.storageLocations, type]);

  const catLabel = (cat: StorageLocationCategory): string => {
    if (cat === "fridge") return t("catFridge");
    if (cat === "freezer") return t("catFreezer");
    if (cat === "room") return t("catRoom");
    if (cat === "kitchen") return t("catKitchen");
    return t("catDelivery");
  };

  const addLog = () => {
    const storage = filteredStorage.find((s) => s.id === selectedStorageId);
    const locName = storage?.name || customLoc || type;
    const ok = (() => {
      const n = Number(temp);
      if (Number.isNaN(n)) return true;
      if (storage?.targetTemp !== undefined) {
        // hot keep ≥ target, cold keep ≤ target
        return storage.category === "kitchen" ? n >= storage.targetTemp : n <= storage.targetTemp;
      }
      if (type === "fridge") return n <= 7;
      if (type === "freezer") return n <= -18;
      if (type === "cooking") return n >= 65;
      if (type === "delivery") return n <= 7;
      return true;
    })();
    dispatch({
      type: "addHaccp",
      log: {
        id: newId(),
        date: new Date().toISOString(),
        type,
        location: locName,
        temperature: temp ? Number(temp) : undefined,
        note: note || undefined,
        ok,
        ...author,
      },
    });
    if (!ok) Alert.alert("⚠️ Grenzwert überschritten", "Sofortmaßnahme erforderlich.");
    setCustomLoc("");
    setTemp("");
    setNote("");
  };

  const saveStorage = () => {
    if (!newName.trim()) return;
    const loc: StorageLocation = {
      id: newId(),
      name: newName.trim(),
      category: newCat,
      targetTemp: newTemp ? Number(newTemp) : undefined,
    };
    dispatch({ type: "addStorageLocation", loc });
    setShowAddStorage(false);
    setNewName("");
    setNewTemp("");
  };

  /**
   * T013b — confirm a suggestion as-is. Creates an HaccpLog with
   * source="auto-suggest" + the predicted temperature.
   */
  const confirmSuggestion = (s: HaccpSuggestion) => {
    const ok = (() => {
      if (s.legalMax !== undefined && s.suggestedTemp > s.legalMax) return false;
      if (s.legalMin !== undefined && s.suggestedTemp < s.legalMin) return false;
      return true;
    })();
    dispatch({
      type: "addHaccp",
      log: {
        id: newId(),
        date: new Date().toISOString(),
        type: s.type,
        location: s.locationName,
        temperature: s.suggestedTemp,
        ok,
        source: "auto-suggest",
        suggestionId: s.id,
        ...author,
      },
    });
  };

  /**
   * T013b — confirm a suggestion with a deviating temperature value.
   * Optionally a corrective-action note.
   */
  const confirmDeviation = (s: HaccpSuggestion) => {
    const e = editing[s.id];
    if (!e) return;
    const n = Number(e.value.replace(",", "."));
    if (Number.isNaN(n)) {
      Alert.alert("Ungültiger Wert", "Bitte gib eine Zahl ein.");
      return;
    }
    const ok = (() => {
      if (s.legalMax !== undefined && n > s.legalMax) return false;
      if (s.legalMin !== undefined && n < s.legalMin) return false;
      return true;
    })();
    dispatch({
      type: "addHaccp",
      log: {
        id: newId(),
        date: new Date().toISOString(),
        type: s.type,
        location: s.locationName,
        temperature: n,
        note: e.comment || undefined,
        correctiveAction: !ok && e.comment ? e.comment : undefined,
        ok,
        source: "auto-suggest",
        suggestionId: s.id,
        ...author,
      },
    });
    setEditing((p) => {
      const next = { ...p };
      delete next[s.id];
      return next;
    });
  };

  /** T013d — mark a Rückstellprobe as physically taken. */
  const markSampleTaken = (sample: FoodSample) => {
    dispatch({
      type: "updateFoodSample",
      sample: {
        ...sample,
        taken: true,
        takenAt: new Date().toISOString(),
        takenBy: author.createdBy,
      },
    });
  };

  /**
   * T013e — when BLE is reading and a value is stable inside the legal range,
   * staff can promote it directly into a real HaccpLog with source="ble".
   */
  const captureBleReading = () => {
    if (!ble.reading) return;
    const dev = ble.devices.find((d) => d.id === ble.reading?.deviceId);
    const looksHot = ble.reading.temperature >= 50;
    const okType: HaccpLog["type"] = looksHot ? "cooking" : "fridge";
    const ok = looksHot ? ble.reading.temperature >= 65 : ble.reading.temperature <= 7;
    dispatch({
      type: "addHaccp",
      log: {
        id: newId(),
        date: new Date().toISOString(),
        type: okType,
        location: dev?.name ?? "Bluetooth-Sonde",
        temperature: ble.reading.temperature,
        note: `Live-Messung: ${dev?.name ?? "BLE"}`,
        ok,
        source: "ble",
        ...author,
      },
    });
  };

  const removeStorage = (id: string) => {
    const loc = state.storageLocations.find((s) => s.id === id);
    Alert.alert(
      loc?.name ?? "?",
      state.locale === "de" ? "Lagerort löschen?" : "Delete storage location?",
      [
        { text: state.locale === "de" ? "Abbrechen" : "Cancel", style: "cancel" },
        {
          text: state.locale === "de" ? "Löschen" : "Delete",
          style: "destructive",
          onPress: () => dispatch({ type: "removeStorageLocation", id }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {/* PWA install shortcut — web only */}
        {Platform.OS === "web" && (
          <Pressable
            onPress={() => Linking.openURL("/app/haccp-pwa.html")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: c.radius,
              padding: 12,
            }}
          >
            <Feather name="share" size={16} color={c.mutedForeground} />
            <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              {isDe ? "Als App zum Startbildschirm hinzufügen" : "Add as app to home screen"}
            </Text>
            <Feather name="chevron-right" size={14} color={c.mutedForeground} />
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push("/cleaning")}
          style={({ pressed }) => [
            {
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: c.radius,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
            }}
          >
            <Feather name="droplet" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {t("cleaningTitle")}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              {t("addTaskHint")}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={c.mutedForeground} />
        </Pressable>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: showInspection ? 12 : 0 }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
              }}
            >
              <Feather name="shield" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {isDe ? "Lebensmittelkontrolle Mode" : "Food-safety inspection mode"}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {isDe
                  ? "Ein PDF mit HACCP, Reinigung, Allergenen & Lager-Sollwerten."
                  : "One PDF with HACCP, cleaning, allergens & storage targets."}
              </Text>
            </View>
            <Button
              label={showInspection ? (isDe ? "Schließen" : "Close") : (isDe ? "Öffnen" : "Open")}
              icon={showInspection ? "x" : "file-text"}
              variant="secondary"
              onPress={() => setShowInspection((v) => !v)}
            />
          </View>

          {showInspection ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip label={isDe ? "7 Tage" : "7 days"}  active={fromDate === new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)} onPress={() => setPreset(7)} />
                <Chip label={isDe ? "30 Tage" : "30 days"} active={fromDate === monthAgoIso && toDate === todayIso} onPress={() => setPreset(30)} />
                <Chip label={isDe ? "90 Tage" : "90 days"} active={fromDate === new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)} onPress={() => setPreset(90)} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label={isDe ? "Von (YYYY-MM-DD)" : "From (YYYY-MM-DD)"} value={fromDate} onChangeText={setFromDate} placeholder="2026-04-01" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={isDe ? "Bis (YYYY-MM-DD)" : "To (YYYY-MM-DD)"} value={toDate} onChangeText={setToDate} placeholder={todayIso} />
                </View>
              </View>
              <Button
                label={generating
                  ? (isDe ? "Erstelle…" : "Generating…")
                  : (isDe ? "PDF erstellen & teilen" : "Generate & share PDF")}
                icon="download"
                onPress={generateInspectionPdf}
              />
            </View>
          ) : null}
        </Card>

        {/* ─── T013b: Auto-suggestions — "Heute zu bestätigen" ─── */}
        {suggestions.length > 0 ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: c.primary, alignItems: "center", justifyContent: "center",
                }}
              >
                <Feather name="zap" size={16} color={c.primaryForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {isDe ? "Heute zu bestätigen" : "To confirm today"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {isDe
                    ? `${suggestions.length} automatische Vorschläge — ein Tap zum Bestätigen.`
                    : `${suggestions.length} automatic suggestions — one tap to confirm.`}
                </Text>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {suggestions.map((s) => {
                const e = editing[s.id];
                return (
                  <View
                    key={s.id}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      padding: 12,
                      gap: 8,
                      backgroundColor: c.muted,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                          {s.locationName}
                        </Text>
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                          {s.slot} · {s.reason}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
                        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                          {s.suggestedTemp}°C
                        </Text>
                      </View>
                    </View>
                    {e ? (
                      <View style={{ gap: 8 }}>
                        <Field
                          label={isDe ? "Tatsächlicher Wert (°C)" : "Actual value (°C)"}
                          value={e.value}
                          onChangeText={(v) => setEditing((p) => ({ ...p, [s.id]: { ...e, value: v } }))}
                          keyboardType="numeric"
                          placeholder={String(s.suggestedTemp)}
                        />
                        <Field
                          label={isDe ? "Maßnahme / Notiz" : "Action / note"}
                          value={e.comment}
                          onChangeText={(v) => setEditing((p) => ({ ...p, [s.id]: { ...e, comment: v } }))}
                          placeholder={isDe ? "z.B. Tür war offen, sofort geschlossen" : "e.g. door was open, closed immediately"}
                          multiline
                        />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Button
                            label={isDe ? "Abbrechen" : "Cancel"}
                            variant="ghost"
                            onPress={() => setEditing((p) => { const n = { ...p }; delete n[s.id]; return n; })}
                            style={{ flex: 1 }}
                          />
                          <Button label={isDe ? "Speichern" : "Save"} icon="check" onPress={() => confirmDeviation(s)} style={{ flex: 1 }} />
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          label={isDe ? "Bestätigen" : "Confirm"}
                          icon="check"
                          onPress={() => confirmSuggestion(s)}
                          style={{ flexGrow: 1, flexBasis: 100 }}
                        />
                        <Button
                          label={isDe ? "Abweichend" : "Deviating"}
                          icon="edit-3"
                          variant="secondary"
                          onPress={() => setEditing((p) => ({ ...p, [s.id]: { mode: "deviation", value: String(s.suggestedTemp), comment: "" } }))}
                          style={{ flexGrow: 1, flexBasis: 100 }}
                        />
                        <Button
                          label={isDe ? "Maßnahme" : "Action"}
                          icon="alert-triangle"
                          variant="secondary"
                          onPress={() => setEditing((p) => ({ ...p, [s.id]: { mode: "corrective", value: String(s.suggestedTemp), comment: "" } }))}
                          style={{ flexGrow: 1, flexBasis: 100 }}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* ─── T013d: Rückstellproben (food retention samples) ─── */}
        {(samplesPending.length > 0 || samplesAll.length > 0) ? (
          <Card style={{ padding: 0 }}>
            <View style={{ padding: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
                <Feather name="archive" size={16} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {isDe ? "Rückstellproben" : "Retention samples"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {isDe
                    ? `${samplesPending.length} heute zu nehmen · LMHV §11 (7 Tage)`
                    : `${samplesPending.length} to take today · LMHV §11 (7 days)`}
                </Text>
              </View>
              {state.foodSamples.length > 0 ? (
                <Pressable onPress={() => dispatch({ type: "purgeExpiredFoodSamples" })}>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {isDe ? "Aufräumen" : "Cleanup"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {samplesAll.length === 0 ? (
              <EmptyState icon="archive" title={isDe ? "Noch keine Proben" : "No samples yet"} />
            ) : (
              samplesAll.map((s, i, arr) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(s.retentionUntil).getTime() - Date.now()) / 86_400_000));
                return (
                  <View
                    key={s.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderColor: c.border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      ...(i === arr.length - 1 ? { borderBottomLeftRadius: c.radius, borderBottomRightRadius: c.radius } : {}),
                    }}
                  >
                    <View
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: s.taken ? c.success + "22" : c.muted,
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Feather name={s.taken ? "check" : "clock"} size={16} color={s.taken ? c.success : c.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {s.recipeName} · {s.amountGrams}g
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                        {s.storageLocationName ?? "—"} · {isDe ? `Aufbewahrung bis ${s.retentionUntil}` : `Keep until ${s.retentionUntil}`}
                      </Text>
                    </View>
                    {s.taken ? (
                      <Badge label={`${daysLeft} ${isDe ? "Tage" : "d"}`} tone={daysLeft > 0 ? "success" : "destructive"} />
                    ) : (
                      <Button
                        label={isDe ? "Genommen" : "Taken"}
                        icon="check"
                        onPress={() => markSampleTaken(s)}
                      />
                    )}
                  </View>
                );
              })
            )}
          </Card>
        ) : null}

        {/* ─── T013e: BLE thermometer (paid add-on) ─── */}
        <RequiresAddon
          name="bleThermometers"
          title={isDe ? "Bluetooth-Thermometer" : "Bluetooth thermometer"}
          description={
            isDe
              ? "Live-Temperaturen von Inkbird/Thermapen direkt in HACCP — keine Tipparbeit mehr."
              : "Live temperatures from Inkbird/Thermapen directly in HACCP — zero typing."
          }
          priceLabel="+€19/Monat"
        >
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
                <Feather name="bluetooth" size={16} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                  {isDe ? "Live-Thermometer" : "Live thermometer"}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {ble.isMock
                    ? (isDe ? "Demo-Modus — echte BLE-Geräte nach Custom Build verfügbar" : "Demo mode — real BLE devices after custom build")
                    : (isDe ? "Echtgerät verbunden" : "Real device connected")}
                </Text>
              </View>
              <Button
                label={ble.scanning ? (isDe ? "Suche…" : "Scanning…") : (isDe ? "Geräte suchen" : "Scan")}
                icon="refresh-cw"
                variant="secondary"
                onPress={() => void ble.scan()}
              />
            </View>
            {ble.devices.length > 0 ? (
              <View style={{ gap: 6, marginBottom: 10 }}>
                {ble.devices.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setBleSelectedId(d.id === bleSelectedId ? undefined : d.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: d.id === bleSelectedId ? c.primary : c.border,
                      backgroundColor: d.id === bleSelectedId ? c.accent : c.card,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Feather name="thermometer" size={16} color={c.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{d.name}</Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                        {d.kind === "dual" ? "2-Kanal" : "1-Kanal"}{d.battery !== undefined ? ` · ${d.battery}%` : ""}
                      </Text>
                    </View>
                    {d.id === bleSelectedId ? (
                      <Badge label={isDe ? "Verbunden" : "Connected"} tone="success" />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {bleSelectedId && ble.reading ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: c.radius,
                  backgroundColor: c.muted,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                    {isDe ? "Aktuelle Messung" : "Current reading"}
                  </Text>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 4 }}>
                    {ble.reading.temperature}°C
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                    {new Date(ble.reading.at).toLocaleTimeString()}
                  </Text>
                </View>
                <Button label={isDe ? "Erfassen" : "Capture"} icon="save" onPress={captureBleReading} />
              </View>
            ) : null}
          </Card>
        </RequiresAddon>

        <Card>
          <SectionHeader title={t("addLog")} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {TYPES.map((tp) => (
              <Chip
                key={tp}
                label={catLabel(TYPE_TO_CATEGORY[tp])}
                active={type === tp}
                onPress={() => {
                  setType(tp);
                  setSelectedStorageId(null);
                }}
              />
            ))}
          </View>

          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 }}>
            {t("storageLocations")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {filteredStorage.length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("none")}
              </Text>
            ) : (
              filteredStorage.map((s) => (
                <Pressable
                  key={s.id}
                  onLongPress={() => removeStorage(s.id)}
                  onPress={() => setSelectedStorageId(s.id === selectedStorageId ? null : s.id)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: s.id === selectedStorageId ? c.primary : c.muted,
                    }}
                  >
                    <Text
                      style={{
                        color: s.id === selectedStorageId ? c.primaryForeground : c.foreground,
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                      }}
                    >
                      {s.name}
                      {s.targetTemp !== undefined ? ` · ${s.targetTemp}°C` : ""}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setShowAddStorage(true)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: c.border,
                }}
              >
                <Feather name="plus" size={14} color={c.mutedForeground} />
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {t("addStorage")}
                </Text>
              </View>
            </Pressable>
          </View>

          {showAddStorage ? (
            <View style={{ padding: 12, borderRadius: c.radius, backgroundColor: c.muted, marginBottom: 12, gap: 10 }}>
              <Field label={t("name")} value={newName} onChangeText={setNewName} placeholder="Kühlung 3" />
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {(["fridge", "freezer", "room", "kitchen", "delivery"] as StorageLocationCategory[]).map((ct) => (
                  <Chip key={ct} label={catLabel(ct)} active={newCat === ct} onPress={() => setNewCat(ct)} />
                ))}
              </View>
              <Field
                label={`${t("targetTemp")} (°C)`}
                value={newTemp}
                onChangeText={setNewTemp}
                keyboardType="numeric"
                placeholder="4"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label={t("cancel")} variant="ghost" onPress={() => setShowAddStorage(false)} style={{ flex: 1 }} />
                <Button label={t("save")} icon="check" onPress={saveStorage} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}

          <Field
            label="Standort (frei)"
            value={customLoc}
            onChangeText={setCustomLoc}
            placeholder={selectedStorageId ? "" : "Kühlung 1"}
          />
          <View style={{ height: 10 }} />
          <Field label={t("temp") + " (°C)"} value={temp} onChangeText={setTemp} keyboardType="numeric" />
          <View style={{ height: 10 }} />
          <Field label="Notiz" value={note} onChangeText={setNote} multiline />
          <View style={{ height: 12 }} />
          <Button label={t("save")} icon="check" onPress={addLog} />
        </Card>

        <Card style={{ padding: 0 }}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <SectionHeader title={t("history")} />
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              <Chip label={isDe ? "Alle" : "All"}              active={sourceFilter === "all"}    onPress={() => setSourceFilter("all")} />
              <Chip label={isDe ? "Nur automatisch" : "Auto only"} active={sourceFilter === "auto"}   onPress={() => setSourceFilter("auto")} />
              <Chip label={isDe ? "Nur manuell" : "Manual only"}   active={sourceFilter === "manual"} onPress={() => setSourceFilter("manual")} />
            </View>
          </View>
          {filteredHistory.length === 0 ? (
            <EmptyState icon="thermometer" title={t("empty")} />
          ) : (
            filteredHistory.slice(0, 12).map((log, i, arr) => {
              const meta = sourceMeta(log.source);
              return (
                <View
                  key={log.id}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderColor: c.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: log.ok ? c.success + "22" : c.destructive + "22",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={log.ok ? "check" : "alert-triangle"}
                      size={16}
                      color={log.ok ? c.success : c.destructive}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {log.location} · {catLabel(TYPE_TO_CATEGORY[log.type])}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                        {new Date(log.date).toLocaleString()}
                      </Text>
                      <Badge label={meta.label} tone={meta.tone} />
                    </View>
                    {log.correctiveAction ? (
                      <Text style={{ color: c.destructive, fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 4 }}>
                        ⚠ {log.correctiveAction}
                      </Text>
                    ) : null}
                  </View>
                  {log.temperature !== undefined ? (
                    <Badge label={`${log.temperature}°C`} tone={log.ok ? "success" : "destructive"} />
                  ) : null}
                </View>
              );
            })
          )}
        </Card>

        <SectionHeader title={t("legalDocs")} />
        {LEGAL_DOCS.map((d) => (
          <Card key={d.id}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 6 }}>
              {d.title}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }}>
              {d.body}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

// Suppress unused-imports lint for CATEGORY_TO_TYPE (kept for future server sync)
void CATEGORY_TO_TYPE;

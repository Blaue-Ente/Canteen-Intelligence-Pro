import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { HaccpLog, StorageLocation, StorageLocationCategory } from "@/types";

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
  const [type, setType] = useState<HaccpLog["type"]>("fridge");
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [customLoc, setCustomLoc] = useState("");
  const [temp, setTemp] = useState("");
  const [note, setNote] = useState("");
  const author = useAuthor();

  // Add-storage modal state
  const [showAddStorage, setShowAddStorage] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<StorageLocationCategory>("fridge");
  const [newTemp, setNewTemp] = useState("");

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
          </View>
          {state.haccp.length === 0 ? (
            <EmptyState icon="thermometer" title={t("empty")} />
          ) : (
            state.haccp.slice(0, 12).map((log, i, arr) => (
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
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {new Date(log.date).toLocaleString()}
                  </Text>
                </View>
                {log.temperature !== undefined ? (
                  <Badge label={`${log.temperature}°C`} tone={log.ok ? "success" : "destructive"} />
                ) : null}
              </View>
            ))
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

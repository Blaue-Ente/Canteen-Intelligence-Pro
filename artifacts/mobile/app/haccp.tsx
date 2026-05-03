import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { HaccpLog } from "@/types";

const TYPES: HaccpLog["type"][] = ["fridge", "freezer", "delivery", "cleaning", "cooking"];

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
  const [loc, setLoc] = useState("");
  const [temp, setTemp] = useState("");
  const [note, setNote] = useState("");
  const author = useAuthor();

  const addLog = () => {
    const ok = (() => {
      const n = Number(temp);
      if (Number.isNaN(n)) return true;
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
        location: loc || type,
        temperature: temp ? Number(temp) : undefined,
        note: note || undefined,
        ok,
        ...author,
      },
    });
    if (!ok) Alert.alert("⚠️ Grenzwert überschritten", "Sofortmaßnahme erforderlich.");
    setLoc("");
    setTemp("");
    setNote("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <SectionHeader title={t("addLog")} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {TYPES.map((tp) => (
              <Chip key={tp} label={tp} active={type === tp} onPress={() => setType(tp)} />
            ))}
          </View>
          <Field label="Standort" value={loc} onChangeText={setLoc} placeholder="Kühlung 1" />
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
                    {log.location} · {log.type}
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

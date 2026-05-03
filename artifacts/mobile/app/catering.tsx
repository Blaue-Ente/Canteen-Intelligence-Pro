import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { parseCateringEmail, type ParsedCatering } from "@/lib/ai";
import { cateringOfferHtml, sharePdf } from "@/lib/pdf";
import type { CateringRequest } from "@/types";

const SAMPLE_DE = `Von: schmidt@firma-acme.de
Betreff: Catering 25 Personen 14.11.

Sehr geehrte Damen und Herren,

wir benötigen am 14. November um 12:30 Uhr Catering für 25 Personen.
Davon 8 Vegetarier, 2 Veganer, keine Allergien bekannt.
Bevorzugt regionale Küche. Bitte Angebot senden.

Mit freundlichen Grüßen
Sabine Schmidt
ACME GmbH`;

export default function Catering() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParsedCatering | null>(null);

  const reset = () => {
    setOpen(false);
    setBody("");
    setPreview(null);
  };

  const analyze = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await parseCateringEmail({
        body: body.trim(),
        locale: state.locale,
        recipes: state.recipes.map((rec) => ({
          id: rec.id,
          name: state.locale === "de" ? rec.nameDe : rec.name,
          category: rec.category,
        })),
      });
      setPreview(r);
    } catch (e) {
      Alert.alert("KI", e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!preview) return;
    const req: CateringRequest = {
      id: newId(),
      receivedAt: new Date().toISOString(),
      fromEmail: preview.fromEmail ?? preview.customer ?? "kunde@unbekannt.de",
      subject: preview.subject ?? `Catering ${preview.guests} Pers.`,
      body: body.trim(),
      guests: preview.guests || 0,
      date: preview.date ?? new Date().toISOString().slice(0, 10),
      dietary: preview.dietary,
      parsed: preview.blocks ?? [],
      status: "new",
    };
    dispatch({ type: "addCatering", request: req });
    reset();
  };

  const setStatus = (req: CateringRequest, s: CateringRequest["status"]) =>
    dispatch({ type: "updateCatering", request: { ...req, status: s } });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 30 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="mail" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {t("emailParser")}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                {state.locale === "de"
                  ? "Anfrage einfügen → KI extrahiert Datum, Gäste, Kostform & passende Menüblöcke."
                  : "Paste an enquiry → AI extracts date, guests, diet & matching menu blocks."}
              </Text>
            </View>
          </View>
          <Button label={t("newRequest")} icon="plus" onPress={() => setOpen(true)} style={{ marginTop: 12 }} />
        </Card>

        {state.catering.length === 0 ? (
          <Card>
            <EmptyState icon="mail" title={t("empty")} />
          </Card>
        ) : (
          state.catering.map((req) => (
            <Card key={req.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 }}>
                  {req.subject}
                </Text>
                <Badge
                  label={req.status}
                  tone={
                    req.status === "new"
                      ? "warning"
                      : req.status === "confirmed"
                        ? "success"
                        : req.status === "rejected"
                          ? "destructive"
                          : "default"
                  }
                />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }}>
                {req.fromEmail} · {req.guests} {t("guests")} · {req.date}
              </Text>
              {req.dietary ? (
                <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6 }}>
                  🥗 {req.dietary}
                </Text>
              ) : null}
              <Text
                numberOfLines={3}
                style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, lineHeight: 19 }}
              >
                {req.body}
              </Text>

              {req.parsed.length > 0 ? (
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderColor: c.border,
                    gap: 10,
                  }}
                >
                  <SectionHeader title="KI-Vorschlag" />
                  {req.parsed.map((p, i) => (
                    <View key={i} style={{ gap: 6 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        {state.locale === "de" ? "Block" : "Block"} {i + 1} · {p.notes}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {p.recipeIds
                          .map((id) => state.recipes.find((r) => r.id === id))
                          .filter(Boolean)
                          .map((r) => (
                            <Badge key={r!.id} label={state.locale === "de" ? r!.nameDe : r!.name} tone="accent" />
                          ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <View
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderColor: c.border,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                {req.status !== "confirmed" ? (
                  <Button
                    label="Bestätigen"
                    icon="check"
                    onPress={() => setStatus(req, "confirmed")}
                    style={{ flex: 1 }}
                  />
                ) : null}
                {req.status !== "rejected" ? (
                  <Button
                    label="Ablehnen"
                    icon="x"
                    variant="ghost"
                    onPress={() => setStatus(req, "rejected")}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
              <Button
                label={t("cateringOffer") + " · PDF"}
                icon="share-2"
                variant="secondary"
                style={{ marginTop: 8 }}
                onPress={async () => {
                  try {
                    await sharePdf(
                      cateringOfferHtml(req, state.recipes, state.locale),
                      `catering-${req.id.slice(0, 8)}`,
                    );
                  } catch (e) {
                    Alert.alert("PDF", e instanceof Error ? e.message : "");
                  }
                }}
              />
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderColor: c.border,
            }}
          >
            <Pressable onPress={reset}>
              <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>{t("cancel")}</Text>
            </Pressable>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {t("newRequest")}
            </Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 60 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {t("paste")}
              </Text>
              <Pressable onPress={() => setBody(SAMPLE_DE)}>
                <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                  Beispiel
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Sehr geehrte Damen und Herren..."
              placeholderTextColor={c.mutedForeground}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 220,
                backgroundColor: c.muted,
                color: c.foreground,
                borderRadius: c.radius,
                padding: 14,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                fontSize: 13,
                lineHeight: 18,
              }}
            />
            <Button
              label={busy ? t("thinking") : t("analyze")}
              icon="cpu"
              onPress={analyze}
              loading={busy}
              disabled={!body.trim()}
            />
            {busy ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : null}
            {preview ? (
              <Card>
                <SectionHeader title="Erkennung" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {preview.customer ? <Badge label={preview.customer} tone="accent" /> : null}
                  <Badge label={`${preview.guests || 0} ${t("guests")}`} tone="success" />
                  {preview.date ? <Badge label={preview.date} /> : null}
                  {preview.dietary ? <Badge label={preview.dietary} tone="warning" /> : null}
                </View>
                {(preview.blocks ?? []).map((b, i) => (
                  <View key={i} style={{ marginTop: 10 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {b.notes}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {b.recipeIds
                        .map((id) => state.recipes.find((r) => r.id === id))
                        .filter(Boolean)
                        .map((r) => (
                          <Badge key={r!.id} label={state.locale === "de" ? r!.nameDe : r!.name} tone="accent" />
                        ))}
                    </View>
                  </View>
                ))}
                <Button label={t("save")} icon="check" onPress={accept} style={{ marginTop: 12 }} />
              </Card>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

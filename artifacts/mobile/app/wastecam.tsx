/**
 * T007 — Plate-photo AI waste detection.
 *
 * Workflow:
 *  1. Cook snaps a returned tray (or two photos: before+after).
 *  2. GPT-4 Vision (`aiTrayReturn`) estimates leftover %, grams and a guess at
 *     the dish.
 *  3. We auto-match the dish to a recipe (best-effort substring match), let
 *     the cook confirm, then save a `WasteEntry` with reason="plate".
 *
 * Money: cost = recipe.basePrice × (leftoverPct/100). Uses the centralised
 * money library so totals never drift (T001).
 */

import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { aiTrayReturn, type TrayReturnAnalysis } from "@/lib/ai";
import { mulMoney, roundMoney } from "@/lib/money";
import type { Recipe, WasteEntry } from "@/types";

interface Photo { uri: string; b64: string; }

export default function WasteCam() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const author = useAuthor();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TrayReturnAnalysis | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [gramsOverride, setGramsOverride] = useState<string>("");

  const isDe = state.locale === "de";

  // ── Recipe matching (best-effort substring) ───────────────────────────
  const matchedRecipe = useMemo<Recipe | null>(() => {
    if (recipeId) return state.recipes.find((r) => r.id === recipeId) ?? null;
    if (!analysis?.dishGuess) return null;
    const guess = analysis.dishGuess.toLowerCase();
    return (
      state.recipes.find((r) =>
        guess.includes((r.nameDe || r.name).toLowerCase()) ||
        (r.nameDe || r.name).toLowerCase().includes(guess),
      ) ?? null
    );
  }, [recipeId, analysis, state.recipes]);

  const finalGrams = useMemo(() => {
    const override = Number(gramsOverride);
    if (override > 0) return Math.round(override);
    return analysis?.estimatedGrams ?? 0;
  }, [gramsOverride, analysis]);

  // Cost = recipe.basePrice × (grams / portionGrams). Falls back to
  // leftoverPct × basePrice when portion size is unknown.
  const estimatedCost = useMemo(() => {
    if (!matchedRecipe) return 0;
    const basePrice = matchedRecipe.basePrice ?? 0;
    if (basePrice <= 0) return 0;
    if (matchedRecipe.portionGrams > 0 && finalGrams > 0) {
      return roundMoney(mulMoney(basePrice, finalGrams / matchedRecipe.portionGrams));
    }
    if (analysis?.leftoverPct) {
      return roundMoney(mulMoney(basePrice, analysis.leftoverPct / 100));
    }
    return 0;
  }, [matchedRecipe, finalGrams, analysis]);

  // ── Actions ───────────────────────────────────────────────────────────
  async function takePhoto(source: "camera" | "library") {
    setError(null);
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError(isDe ? "Kamerazugriff verweigert" : "Camera access denied");
          return;
        }
        const r = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        });
        if (!r.canceled && r.assets[0]?.base64) {
          setPhoto({ uri: r.assets[0].uri, b64: r.assets[0].base64 });
          setAnalysis(null);
          setRecipeId(null);
          setGramsOverride("");
        }
      } else {
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        });
        if (!r.canceled && r.assets[0]?.base64) {
          setPhoto({ uri: r.assets[0].uri, b64: r.assets[0].base64 });
          setAnalysis(null);
          setRecipeId(null);
          setGramsOverride("");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function analyse() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiTrayReturn({ base64: photo.b64, locale: state.locale });
      setAnalysis(result);
      // Pre-seed grams override blank so the AI value is shown by default.
      setGramsOverride("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!analysis) return;
    const entry: WasteEntry = {
      id: newId(),
      date: new Date().toISOString(),
      recipeId: matchedRecipe?.id,
      grams: finalGrams,
      reason: "plate",
      cost: estimatedCost,
      ...author,
    };
    dispatch({ type: "addWaste", entry });
    router.push("/waste");
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>

        <Card>
          <SectionHeader title={isDe ? "Tablett-Foto-Analyse" : "Plate photo analysis"} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 4 }}>
            {isDe
              ? "Foto vom zurückgebrachten Teller — KI schätzt Reste und Kosten."
              : "Snap a returned plate — AI estimates leftover and cost."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button
              label={isDe ? "Foto aufnehmen" : "Take photo"}
              icon="camera"
              onPress={() => takePhoto("camera")}
              style={{ flex: 1 }}
            />
            <Button
              label={isDe ? "Galerie" : "Library"}
              icon="image"
              variant="secondary"
              onPress={() => takePhoto("library")}
              style={{ flex: 1 }}
            />
          </View>
          {error ? (
            <Text style={{ color: c.destructive, marginTop: 12, fontFamily: "Inter_500Medium" }}>{error}</Text>
          ) : null}
        </Card>

        {photo ? (
          <Card>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: "100%", height: 240, borderRadius: 12, backgroundColor: c.muted }}
              resizeMode="cover"
            />
            <View style={{ height: 12 }} />
            <Button
              label={busy
                ? (isDe ? "Analysiere…" : "Analysing…")
                : (isDe ? "KI-Analyse starten" : "Run AI analysis")}
              icon="cpu"
              onPress={analyse}
              disabled={busy}
            />
            {busy ? (
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : null}
          </Card>
        ) : null}

        {analysis ? (
          <Card>
            <SectionHeader title={isDe ? "Ergebnis" : "Result"} />

            <Row label={isDe ? "Erkanntes Gericht" : "Detected dish"} value={analysis.dishGuess} c={c} />
            <Row label={isDe ? "Reste" : "Leftover"} value={`${analysis.leftoverPct}%`} c={c} />
            <Row label={isDe ? "Geschätzte Gramm" : "Estimated grams"} value={`${analysis.estimatedGrams} g`} c={c} />
            {analysis.reasonHypothesis ? (
              <Row label={isDe ? "Vermutung" : "Hypothesis"} value={analysis.reasonHypothesis} c={c} />
            ) : null}

            <View style={{ height: 16 }} />
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 8 }}>
              {isDe ? "Gericht zuordnen" : "Assign recipe"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {state.recipes.slice(0, 30).map((r) => (
                <Chip
                  key={r.id}
                  label={isDe ? r.nameDe || r.name : r.name || r.nameDe}
                  active={(matchedRecipe?.id ?? null) === r.id}
                  onPress={() => setRecipeId(r.id)}
                />
              ))}
            </View>

            <View style={{ height: 16 }} />
            <Field
              label={isDe ? "Gramm (manuell überschreiben)" : "Grams (manual override)"}
              value={gramsOverride}
              onChangeText={setGramsOverride}
              placeholder={`${analysis.estimatedGrams}`}
              keyboardType="numeric"
            />

            <View style={{ height: 12 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
                {isDe ? "Geschätzte Kosten" : "Estimated cost"}
              </Text>
              <Badge label={`€${estimatedCost.toFixed(2)}`} tone="destructive" />
            </View>

            <View style={{ height: 16 }} />
            <Button
              label={t("save")}
              icon="check"
              onPress={save}
              disabled={!matchedRecipe}
            />
            {!matchedRecipe ? (
              <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                {isDe
                  ? "Bitte ein Gericht auswählen, damit Kosten berechnet werden."
                  : "Pick a recipe so cost can be computed."}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {!photo ? (
          <EmptyState
            icon="camera"
            title={isDe ? "Noch kein Foto" : "No photo yet"}
            body={isDe
              ? "Mache ein Foto vom zurückgebrachten Tablett oder wähle eines aus der Galerie."
              : "Take a photo of the returned tray or pick one from your library."}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, c }: { label: string; value: string; c: { foreground: string; mutedForeground: string } }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", flex: 1 }}>{label}</Text>
      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

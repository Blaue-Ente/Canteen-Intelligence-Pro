import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, Field, SectionHeader, Stat } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supplierScore } from "@/lib/computations";
import type { Supplier } from "@/types";

export default function SupplierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();

  const isNew = id === "new";
  const existing = !isNew ? state.suppliers.find((s) => s.id === id) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [contact, setContact] = useState(existing?.contact ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [addr, setAddr] = useState(existing?.address ?? "");
  const [showComplaint, setShowComplaint] = useState(false);
  const [reason, setReason] = useState("");
  const author = useAuthor();
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const save = () => {
    const sup: Supplier = {
      id: existing?.id ?? newId(),
      name,
      contact,
      phone,
      email,
      address: addr,
      category: existing?.category ?? ["other"],
      rating: existing?.rating ?? 4,
      lat: existing?.lat,
      lng: existing?.lng,
    };
    if (existing) dispatch({ type: "updateSupplier", supplier: sup });
    else dispatch({ type: "addSupplier", supplier: sup });
    router.back();
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  };

  const sendComplaint = () => {
    const subject = `Reklamation – Rechnung ${invoice}`;
    const body = `Sehr geehrte Damen und Herren,\n\nbezugnehmend auf Rechnung Nr. ${invoice} müssen wir folgende Reklamation einreichen:\n\nGrund: ${reason}\nBetrag: € ${amount}\n\nMit freundlichen Grüßen,\nKitchenOS`;
    dispatch({
      type: "addComplaint",
      complaint: {
        id: newId(),
        supplierId: existing?.id ?? "",
        date: new Date().toISOString(),
        reason,
        amount,
        invoiceNo: invoice,
        photoUri: photoUri ?? undefined,
        status: "sent",
        ...author,
      },
    });
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Mail", "E-Mail-Client nicht verfügbar. Entwurf gespeichert."),
    );
    setShowComplaint(false);
    setReason("");
    setAmount("");
    setInvoice("");
    setPhotoUri(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: existing?.name ?? "Neuer Lieferant" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <Card>
          <Field label="Firma" value={name} onChangeText={setName} />
          <View style={{ height: 12 }} />
          <Field label="Ansprechpartner" value={contact} onChangeText={setContact} />
          <View style={{ height: 12 }} />
          <Field label="Telefon" value={phone} onChangeText={setPhone} />
          <View style={{ height: 12 }} />
          <Field label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <View style={{ height: 12 }} />
          <Field label="Adresse" value={addr} onChangeText={setAddr} multiline />
        </Card>

        {existing ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label="Anrufen"
              icon="phone"
              variant="secondary"
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={{ flex: 1 }}
            />
            <Button
              label="E-Mail"
              icon="mail"
              variant="secondary"
              onPress={() => Linking.openURL(`mailto:${email}`)}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        <Button label={t("save")} icon="check" onPress={save} />

        {existing ? (() => {
          const cmpCount = state.complaints.filter((cp) => cp.supplierId === existing.id).length;
          const score = supplierScore(existing.id, state.deliveries, cmpCount);
          const tone = score.score >= 80 ? "success" : score.score >= 60 ? "warning" : "destructive";
          return (
            <Card>
              <SectionHeader title={t("supplierScore")} />
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 36 }}>
                  {score.score}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  / 100
                </Text>
                <View style={{ flex: 1 }} />
                <Badge label={tone === "success" ? "A" : tone === "warning" ? "B" : "C"} tone={tone} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Stat label={t("onTime")} value={`${score.onTimePct.toFixed(0)}%`} icon="clock" />
                <Stat label={t("accuracy")} value={`${score.accuracyPct.toFixed(0)}%`} icon="target" />
                <Stat label={t("complaints")} value={String(score.complaints)} icon="alert-triangle" tone={score.complaints > 0 ? "warning" : "default"} />
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 8 }}>
                {score.deliveries} {t("deliveries")}
              </Text>
            </Card>
          );
        })() : null}

        {existing ? (
          <Card>
            <SectionHeader title={t("complaintDraft")} />
            {showComplaint ? (
              <View style={{ gap: 10 }}>
                <Field label={t("invoiceNo")} value={invoice} onChangeText={setInvoice} />
                <Field label={t("reason")} value={reason} onChangeText={setReason} multiline />
                <Field label={t("amount") + " (€)"} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={{ width: "100%", height: 160, borderRadius: c.radius }} />
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button label="Foto" icon="camera" variant="secondary" onPress={takePhoto} style={{ flex: 1 }} />
                  <Button label={t("sendComplaint")} icon="send" onPress={sendComplaint} style={{ flex: 2 }} />
                </View>
              </View>
            ) : (
              <Button
                label={t("proforma")}
                icon="file-text"
                variant="ghost"
                onPress={() => setShowComplaint(true)}
              />
            )}
          </Card>
        ) : null}

        {existing ? (
          <Card>
            <SectionHeader title={t("history")} />
            {state.complaints
              .filter((cp) => cp.supplierId === existing.id)
              .slice(0, 5)
              .map((cp) => (
                <View
                  key={cp.id}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    {cp.invoiceNo} · €{cp.amount}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {new Date(cp.date).toLocaleDateString()} · {cp.reason}
                  </Text>
                </View>
              ))}
            {state.complaints.filter((cp) => cp.supplierId === existing.id).length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                Keine Reklamationen
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

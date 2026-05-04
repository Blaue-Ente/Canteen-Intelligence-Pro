import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { generateEventOffer } from "@/lib/ai";
import { addMoney, mulMoney, pctOfMoney, roundMoney, sumMoney } from "@/lib/money";
import { eventInvoiceHtml, eventTransportChecklistHtml, sharePdf } from "@/lib/pdf";
import type { CateringEvent, EventMenuItem, EventStatus, Recipe } from "@/types";

const STATUS_ORDER: EventStatus[] = [
  "anfrage",
  "angebot",
  "bestaetigt",
  "produktion",
  "abgeschlossen",
  "abgesagt",
];

const STATUS_COLORS: Record<EventStatus, string> = {
  anfrage: "#3b82f6",
  angebot: "#f59e0b",
  bestaetigt: "#22c55e",
  produktion: "#a855f7",
  abgeschlossen: "#6b7280",
  abgesagt: "#ef4444",
};

function calcTotals(
  items: EventMenuItem[],
  staffCost: number,
  equipmentCost: number,
  transportCost: number,
  overheadPct: number,
  vatPct: number,
  guestCount: number,
) {
  // All money arithmetic goes through lib/money.ts to avoid float drift
  // (e.g. 0.1+0.2). This guarantees line totals match grand totals exactly,
  // which is required for tax-compliant invoices.
  const foodCost = sumMoney(items.map((i) => mulMoney(i.pricePerPortion, i.portions)));
  const sub = sumMoney([foodCost, staffCost, equipmentCost, transportCost]);
  const overhead = pctOfMoney(sub, overheadPct);
  const withOverhead = addMoney(sub, overhead);
  const vatAmount = pctOfMoney(withOverhead, vatPct);
  const grandTotal = addMoney(withOverhead, vatAmount);
  const perPerson = guestCount > 0 ? roundMoney(grandTotal / guestCount) : 0;
  return {
    foodCost,
    staffCost: roundMoney(staffCost),
    equipmentCost: roundMoney(equipmentCost),
    transportCost: roundMoney(transportCost),
    overhead,
    vatAmount,
    grandTotal,
    perPerson,
  };
}

export default function EventDetailScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const existing = useMemo(
    () => state.events.find((e) => e.id === id),
    [state.events, id],
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [clientName, setClientName] = useState(existing?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.clientEmail ?? "");
  const [clientPhone, setClientPhone] = useState(existing?.clientPhone ?? "");
  const [eventDate, setEventDate] = useState(existing?.eventDate ?? "");
  const [eventTime, setEventTime] = useState(existing?.eventTime ?? "");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [guestCountStr, setGuestCountStr] = useState(String(existing?.guestCount ?? 50));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<EventStatus>(existing?.status ?? "anfrage");
  const [menuItems, setMenuItems] = useState<EventMenuItem[]>(existing?.menuItems ?? []);
  const [staffCost, setStaffCost] = useState(String(existing?.staffCost ?? 0));
  const [equipmentCost, setEquipmentCost] = useState(String(existing?.equipmentCost ?? 0));
  const [transportCost, setTransportCost] = useState(String(existing?.transportCost ?? 0));
  const [overheadPct, setOverheadPct] = useState(String(existing?.overheadPct ?? 15));
  const [vatPct, setVatPct] = useState(String(existing?.vatPct ?? 19));
  const [offerText, setOfferText] = useState(existing?.offerText ?? "");
  const [invoiceNo, setInvoiceNo] = useState(existing?.invoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    existing?.invoiceDate ?? new Date().toISOString().slice(0, 10),
  );
  const [paymentDueDays, setPaymentDueDays] = useState(String(existing?.paymentDueDays ?? 14));
  const [invoicePaid, setInvoicePaid] = useState(existing?.invoicePaid ?? false);
  const [recipePicker, setRecipePicker] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);

  const guests = parseInt(guestCountStr) || 0;

  const totals = useMemo(
    () =>
      calcTotals(
        menuItems,
        parseFloat(staffCost) || 0,
        parseFloat(equipmentCost) || 0,
        parseFloat(transportCost) || 0,
        parseFloat(overheadPct) || 15,
        parseFloat(vatPct) || 19,
        guests,
      ),
    [menuItems, staffCost, equipmentCost, transportCost, overheadPct, vatPct, guests],
  );

  const statusLabel: Record<EventStatus, string> = {
    anfrage: t("statusAnfrage"),
    angebot: t("statusAngebot"),
    bestaetigt: t("statusBestaetigt"),
    produktion: t("statusProduktion"),
    abgeschlossen: t("statusAbgeschlossen"),
    abgesagt: t("statusAbgesagt"),
  };

  const buildEvent = useCallback((): CateringEvent => {
    const now = new Date().toISOString();
    return {
      id: existing?.id ?? `ev-${Date.now()}`,
      title: title.trim() || t("newEvent"),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      eventDate,
      eventTime: eventTime || undefined,
      venue: venue.trim() || undefined,
      guestCount: guests,
      status,
      menuItems,
      staffCost: parseFloat(staffCost) || 0,
      equipmentCost: parseFloat(equipmentCost) || 0,
      transportCost: parseFloat(transportCost) || 0,
      overheadPct: parseFloat(overheadPct) || 15,
      vatPct: parseFloat(vatPct) || 19,
      notes: notes.trim() || undefined,
      offerText: offerText || undefined,
      invoiceNo: invoiceNo.trim() || undefined,
      invoiceDate: invoiceDate || undefined,
      paymentDueDays: parseInt(paymentDueDays) || 14,
      invoicePaid: invoicePaid || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }, [
    existing,
    title, clientName, clientEmail, clientPhone, eventDate, eventTime,
    venue, guests, status, menuItems, staffCost, equipmentCost, transportCost,
    overheadPct, vatPct, notes, offerText,
    invoiceNo, invoiceDate, paymentDueDays, invoicePaid,
    t,
  ]);

  function handleSave() {
    const ev = buildEvent();
    if (isNew) {
      dispatch({ type: "addEvent", event: ev });
    } else {
      dispatch({ type: "updateEvent", event: ev });
    }
    router.back();
  }

  function handleDelete() {
    Alert.alert(t("deleteEvent"), t("deleteEventConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          dispatch({ type: "removeEvent", id: existing!.id });
          router.back();
        },
      },
    ]);
  }

  async function handleGenerateOffer() {
    setGeneratingOffer(true);
    try {
      const text = await generateEventOffer({
        title: title || t("newEvent"),
        clientName,
        eventDate,
        eventTime: eventTime || undefined,
        venue: venue || undefined,
        guestCount: guests,
        notes: notes || undefined,
        menuItems: menuItems.map((m) => ({
          name: m.recipeName,
          portions: m.portions,
          pricePerPortion: m.pricePerPortion,
        })),
        totals,
        locale: state.locale,
      });
      setOfferText(text);
    } catch (e) {
      Alert.alert(t("syncError"), String(e));
    } finally {
      setGeneratingOffer(false);
    }
  }

  async function handleShareOffer() {
    if (!offerText) return;
    await Share.share({ message: offerText, title });
  }

  async function handleShareInvoice() {
    const ev = buildEvent();
    try {
      const html = eventInvoiceHtml(
        ev,
        totals,
        parseFloat(vatPct) || 19,
        state.companyProfile,
        state.locale,
      );
      await sharePdf(html, `Rechnung-${invoiceNo || ev.id.slice(0, 8)}`);
    } catch (e) {
      Alert.alert(t("syncError"), String(e));
    }
  }

  async function handleShareTransport() {
    const ev = buildEvent();
    if (ev.menuItems.length === 0) {
      Alert.alert(
        t("transportChecklist"),
        state.locale === "de" ? "Keine Menüpositionen vorhanden." : "No menu items yet.",
      );
      return;
    }
    try {
      const html = eventTransportChecklistHtml(ev, state.locale);
      await sharePdf(html, `Transport-${(title || ev.id).slice(0, 20)}`);
    } catch (e) {
      Alert.alert(t("syncError"), String(e));
    }
  }

  function addRecipe(recipe: Recipe) {
    const already = menuItems.find((m) => m.recipeId === recipe.id);
    if (already) {
      setMenuItems((prev) =>
        prev.map((m) =>
          m.recipeId === recipe.id ? { ...m, portions: m.portions + Math.max(guests, 1) } : m,
        ),
      );
    } else {
      const plEntry = state.priceList.find(
        (p) =>
          p.name.toLowerCase().includes(recipe.name.toLowerCase()) ||
          p.name.toLowerCase().includes((recipe.nameDe ?? "").toLowerCase()),
      );
      const recipeName =
        state.locale === "de" ? recipe.nameDe || recipe.name : recipe.name;
      setMenuItems((prev) => [
        ...prev,
        {
          recipeId: recipe.id,
          recipeName,
          portions: Math.max(guests, 1),
          pricePerPortion: plEntry?.pricePerUnit ?? recipe.sellPrice,
        },
      ]);
    }
    setRecipePicker(false);
  }

  function removeMenuItem(recipeId: string) {
    setMenuItems((prev) => prev.filter((m) => m.recipeId !== recipeId));
  }

  function updateMenuItemField(
    recipeId: string,
    field: "portions" | "pricePerPortion",
    value: string,
  ) {
    setMenuItems((prev) =>
      prev.map((m) =>
        m.recipeId === recipeId ? { ...m, [field]: parseFloat(value) || 0 } : m,
      ),
    );
  }

  const inputStyle = {
    backgroundColor: c.muted,
    color: c.foreground,
    fontFamily: "Inter_400Regular" as const,
    fontSize: 14,
    borderRadius: 8,
    padding: 10,
  };

  const labelStyle = {
    color: c.mutedForeground,
    fontFamily: "Inter_500Medium" as const,
    fontSize: 12,
    marginBottom: 3,
  };

  const sectionTitle = (label: string) => (
    <Text
      style={{
        color: c.foreground,
        fontFamily: "Inter_700Bold",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
  );

  const costFields: { label: string; value: string; setter: (v: string) => void }[] = [
    { label: t("staffCostLabel"), value: staffCost, setter: setStaffCost },
    { label: t("equipmentCostLabel"), value: equipmentCost, setter: setEquipmentCost },
    { label: t("transportCostLabel"), value: transportCost, setter: setTransportCost },
    { label: t("overheadPctLabel"), value: overheadPct, setter: setOverheadPct },
    { label: t("vatPctLabel"), value: vatPct, setter: setVatPct },
  ];

  const totalRows: [string, number][] = [
    [t("foodCost"), totals.foodCost],
    [t("staffCostLabel"), totals.staffCost],
    [t("equipmentCostLabel"), totals.equipmentCost],
    [t("transportCostLabel"), totals.transportCost],
    [t("overhead"), totals.overhead],
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: c.background,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Text
          style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18, flex: 1, textAlign: "center" }}
          numberOfLines={1}
        >
          {isNew ? t("newEvent") : title || t("events")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!isNew && (
            <Pressable onPress={handleDelete} style={{ padding: 4 }}>
              <Feather name="trash-2" size={20} color="#ef4444" />
            </Pressable>
          )}
          <Pressable onPress={handleSave} style={{ padding: 4 }}>
            <Feather name="save" size={22} color={c.accent} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status stepper */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {STATUS_ORDER.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: status === s ? STATUS_COLORS[s] : STATUS_COLORS[s] + "22",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: status === s ? "#fff" : STATUS_COLORS[s],
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  textAlign: "center",
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {statusLabel[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Basic info */}
        <Card style={{ padding: 14, gap: 10 }}>
          {sectionTitle(t("basicInfo"))}

          <View>
            <Text style={labelStyle}>{t("eventTitleLabel")}</Text>
            <TextInput
              style={inputStyle}
              value={title}
              onChangeText={setTitle}
              placeholder="Sommerfest Mustermann GmbH"
              placeholderTextColor={c.mutedForeground}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("clientName")}</Text>
              <TextInput
                style={inputStyle}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Max Mustermann GmbH"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("clientEmail")}</Text>
              <TextInput
                style={inputStyle}
                value={clientEmail}
                onChangeText={setClientEmail}
                placeholder="email@example.de"
                placeholderTextColor={c.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("clientPhone")}</Text>
              <TextInput
                style={inputStyle}
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="+49 …"
                placeholderTextColor={c.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 2 }}>
              <Text style={labelStyle}>{t("eventDate")}</Text>
              <TextInput
                style={inputStyle}
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="2025-06-15"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("eventTime")}</Text>
              <TextInput
                style={inputStyle}
                value={eventTime}
                onChangeText={setEventTime}
                placeholder="18:00"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>{t("guestCount")}</Text>
              <TextInput
                style={inputStyle}
                value={guestCountStr}
                onChangeText={setGuestCountStr}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>

          <View>
            <Text style={labelStyle}>{t("venue")}</Text>
            <TextInput
              style={inputStyle}
              value={venue}
              onChangeText={setVenue}
              placeholder="Festsaal, Rathausplatz 1, Berlin"
              placeholderTextColor={c.mutedForeground}
            />
          </View>

          <View>
            <Text style={labelStyle}>{t("eventNotes")}</Text>
            <TextInput
              style={[inputStyle, { height: 72, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Allergien, Sonderwünsche …"
              placeholderTextColor={c.mutedForeground}
            />
          </View>
        </Card>

        {/* Menu items */}
        <Card style={{ padding: 14, gap: 8 }}>
          {sectionTitle(t("menuItems"))}

          {menuItems.map((item) => (
            <View
              key={item.recipeId}
              style={{
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 8,
                padding: 10,
                gap: 6,
              }}
            >
              <View
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <Text
                  style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }}
                  numberOfLines={1}
                >
                  {item.recipeName}
                </Text>
                <Pressable onPress={() => removeMenuItem(item.recipeId)} style={{ padding: 4 }}>
                  <Feather name="x" size={16} color="#ef4444" />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>{t("portions")}</Text>
                  <TextInput
                    style={[inputStyle, { fontSize: 13 }]}
                    value={String(item.portions)}
                    onChangeText={(v) => updateMenuItemField(item.recipeId, "portions", v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>{t("pricePerPortion")} (€)</Text>
                  <TextInput
                    style={[inputStyle, { fontSize: 13 }]}
                    value={String(item.pricePerPortion)}
                    onChangeText={(v) =>
                      updateMenuItemField(item.recipeId, "pricePerPortion", v)
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, paddingBottom: 2 }}>
                  <Text style={[labelStyle, { textAlign: "right" }]}>= €</Text>
                  <Text
                    style={{
                      color: c.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 15,
                      textAlign: "right",
                    }}
                  >
                    {mulMoney(item.pricePerPortion, item.portions).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => setRecipePicker(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
          >
            <Feather name="plus-circle" size={18} color={c.accent} />
            <Text style={{ color: c.accent, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {t("addDish")}
            </Text>
          </Pressable>
        </Card>

        {/* Cost inputs */}
        <Card style={{ padding: 14, gap: 8 }}>
          {sectionTitle(t("costBreakdown"))}
          {costFields.map(({ label, value, setter }) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[labelStyle, { flex: 1, marginBottom: 0 }]}>{label}</Text>
              <TextInput
                style={[inputStyle, { width: 100, textAlign: "right" }]}
                value={value}
                onChangeText={setter}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </Card>

        {/* Totals */}
        <Card style={{ padding: 14, gap: 6 }}>
          {sectionTitle(t("grandTotal"))}

          {totalRows
            .filter(([, v]) => v > 0)
            .map(([label, value]) => (
              <View
                key={label}
                style={{ flexDirection: "row", justifyContent: "space-between" }}
              >
                <Text
                  style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}
                >
                  {label}
                </Text>
                <Text
                  style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}
                >
                  €{value.toFixed(2)}
                </Text>
              </View>
            ))}

          {totalRows.filter(([, v]) => v > 0).length > 0 && (
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
          )}

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text
              style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}
            >
              {t("vatAmount")} ({vatPct}%)
            </Text>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              €{totals.vatAmount.toFixed(2)}
            </Text>
          </View>

          <View
            style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}
          >
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
              {t("grandTotal")}
            </Text>
            <Text style={{ color: c.accent, fontFamily: "Inter_700Bold", fontSize: 18 }}>
              €{totals.grandTotal.toFixed(2)}
            </Text>
          </View>

          {guests > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text
                style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}
              >
                {t("perPerson")}
              </Text>
              <Text
                style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}
              >
                €{totals.perPerson.toFixed(2)}
              </Text>
            </View>
          )}
        </Card>

        {/* AI Offer */}
        <Card style={{ padding: 14, gap: 10 }}>
          {sectionTitle(t("generateOffer"))}

          <Pressable
            onPress={handleGenerateOffer}
            disabled={generatingOffer}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: c.accent,
              borderRadius: 10,
              padding: 12,
              opacity: generatingOffer ? 0.6 : 1,
            }}
          >
            {generatingOffer ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="cpu" size={16} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {generatingOffer ? t("thinking") : t("generateOffer")}
            </Text>
          </Pressable>

          {offerText ? (
            <>
              <TextInput
                style={[inputStyle, { height: 240, textAlignVertical: "top", fontSize: 13, lineHeight: 20 }]}
                value={offerText}
                onChangeText={setOfferText}
                multiline
              />
              <Pressable
                onPress={handleShareOffer}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderColor: c.accent,
                  borderWidth: 1.5,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <Feather name="share-2" size={16} color={c.accent} />
                <Text style={{ color: c.accent, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {t("shareOffer")}
                </Text>
              </Pressable>
            </>
          ) : null}
        </Card>

        {/* Transport Checklist */}
        <Card style={{ padding: 14, gap: 10 }}>
          {sectionTitle(t("transportChecklist"))}
          <Pressable
            onPress={handleShareTransport}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderColor: "#0ea5e9",
              borderWidth: 1.5,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Feather name="truck" size={16} color="#0ea5e9" />
            <Text style={{ color: "#0ea5e9", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {t("shareChecklist")}
            </Text>
          </Pressable>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
            {state.locale === "de"
              ? "GN-Behälter, Temperaturen, HACCP-Unterschriftsfeld"
              : "GN containers, temperatures, HACCP signature field"}
          </Text>
        </Card>

        {/* Invoice (Rechnung) */}
        <Card style={{ padding: 14, gap: 10 }}>
          {sectionTitle(t("invoiceSection"))}

          {/* Invoice Number */}
          <View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4 }}>
              {t("invoiceNo")}
            </Text>
            <TextInput
              style={inputStyle}
              value={invoiceNo}
              onChangeText={setInvoiceNo}
              placeholder="RE-2025-0001"
              placeholderTextColor={c.mutedForeground}
            />
          </View>

          {/* Invoice Date + Payment Days */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4 }}>
                {t("invoiceDate")}
              </Text>
              <TextInput
                style={inputStyle}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4 }}>
                {t("paymentDueDays")}
              </Text>
              <TextInput
                style={inputStyle}
                value={paymentDueDays}
                onChangeText={setPaymentDueDays}
                keyboardType="numeric"
                placeholder="14"
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>

          {/* Paid toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
              {t("invoicePaid")}
            </Text>
            <Switch
              value={invoicePaid}
              onValueChange={setInvoicePaid}
              trackColor={{ true: "#16a34a", false: c.border }}
            />
          </View>

          {/* Share Invoice PDF */}
          <Pressable
            onPress={handleShareInvoice}
            disabled={!invoiceNo.trim()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: invoiceNo.trim() ? c.accent : c.muted,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Feather name="file-text" size={16} color={invoiceNo.trim() ? "#fff" : c.mutedForeground} />
            <Text
              style={{
                color: invoiceNo.trim() ? "#fff" : c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
              }}
            >
              {t("shareInvoice")}
            </Text>
          </Pressable>
          {!invoiceNo.trim() && (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
              {state.locale === "de" ? "Rechnungsnummer eingeben um Rechnung zu erstellen." : "Enter invoice number to generate PDF."}
            </Text>
          )}
        </Card>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={{ backgroundColor: c.accent, borderRadius: 12, padding: 14, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
            {t("save")}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Recipe picker modal */}
      {recipePicker && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: c.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "70%",
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <Text
                style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}
              >
                {t("addDish")}
              </Text>
              <Pressable onPress={() => setRecipePicker(false)} style={{ padding: 4 }}>
                <Feather name="x" size={22} color={c.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
              {state.recipes.length === 0 ? (
                <Text
                  style={{
                    color: c.mutedForeground,
                    textAlign: "center",
                    padding: 24,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {t("empty")}
                </Text>
              ) : (
                state.recipes.map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    onPress={() => addRecipe(recipe)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 12,
                      backgroundColor: c.muted,
                      borderRadius: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                        }}
                        numberOfLines={1}
                      >
                        {state.locale === "de"
                          ? recipe.nameDe || recipe.name
                          : recipe.name}
                      </Text>
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                        }}
                      >
                        €{recipe.sellPrice.toFixed(2)} / {t("perPerson")}
                      </Text>
                    </View>
                    <Feather name="plus" size={18} color={c.accent} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

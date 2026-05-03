import { Feather } from "@expo/vector-icons";
import React from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { orderHtml, sharePdf } from "@/lib/pdf";
import type { Locale, OrderDraft } from "@/types";

function buildEmail(order: OrderDraft, locale: "de" | "en"): { subject: string; body: string } {
  if (locale === "de") {
    const lines = order.items.map(
      (it) => `– ${it.quantity} ${it.unit} ${it.name}${it.estimatedPrice ? ` (≈ €${it.estimatedPrice.toFixed(2)})` : ""}`,
    );
    return {
      subject: `Bestellung KItchenOS – ${new Date(order.createdAt).toLocaleDateString("de-DE")}`,
      body: [
        "Sehr geehrte Damen und Herren,",
        "",
        "bitte folgende Positionen für unsere Küche liefern:",
        "",
        ...lines,
        "",
        order.total ? `Gesamt geschätzt: €${order.total.toFixed(2)}` : "",
        "",
        "Mit freundlichen Grüßen,",
        "KItchenOS",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  const lines = order.items.map(
    (it) => `- ${it.quantity} ${it.unit} ${it.name}${it.estimatedPrice ? ` (≈ €${it.estimatedPrice.toFixed(2)})` : ""}`,
  );
  return {
    subject: `Order from KItchenOS – ${new Date(order.createdAt).toLocaleDateString("en-GB")}`,
    body: [
      "Dear Sir/Madam,",
      "",
      "Please supply the following items for our kitchen:",
      "",
      ...lines,
      "",
      order.total ? `Estimated total: €${order.total.toFixed(2)}` : "",
      "",
      "Kind regards,",
      "KItchenOS",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export default function Orders() {
  const { state, dispatch } = useApp();
  const t = useT();
  const c = useColors();

  const send = async (order: OrderDraft) => {
    const supplier = state.suppliers.find((s) => s.id === order.supplierId);
    const to = order.supplierEmail ?? supplier?.email ?? "";
    if (!to.trim() || !to.includes("@")) {
      Alert.alert(
        state.locale === "de" ? "Keine E-Mail" : "No email",
        state.locale === "de"
          ? "Für diesen Lieferanten ist keine E-Mail-Adresse hinterlegt."
          : "This supplier has no email address on file.",
      );
      return;
    }
    const { subject, body } = buildEmail(order, state.locale);
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("mailto not supported");
      await Linking.openURL(url);
      dispatch({ type: "updateOrder", order: { ...order, status: "sent" } });
    } catch (e) {
      Alert.alert(
        state.locale === "de" ? "E-Mail nicht möglich" : "Mail not available",
        e instanceof Error ? e.message : "",
      );
    }
  };

  const remove = (id: string) =>
    Alert.alert(t("delete"), "", [
      { text: t("cancel") },
      { text: t("delete"), style: "destructive", onPress: () => dispatch({ type: "removeOrder", id }) },
    ]);

  const drafts = state.orders.filter((o) => o.status === "draft");
  const sent = state.orders.filter((o) => o.status !== "draft");

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {state.orders.length === 0 ? (
          <Card>
            <EmptyState
              icon="truck"
              title={t("empty")}
              body={
                state.locale === "de"
                  ? "Tippe Bestellung erstellen im Lager – die KI verteilt Knapp-Bestand automatisch auf deine Lieferanten."
                  : "Tap Create order in Stock – the AI distributes shortages across your suppliers."
              }
            />
          </Card>
        ) : null}

        {drafts.length > 0 ? (
          <>
            <SectionHeader title={t("draft") + " (" + drafts.length + ")"} />
            {drafts.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                locale={state.locale}
                onSend={() => send(o)}
                onDelete={() => remove(o.id)}
              />
            ))}
          </>
        ) : null}

        {sent.length > 0 ? (
          <>
            <SectionHeader title={t("history")} />
            {sent.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                locale={state.locale}
                onSend={() => send(o)}
                onDelete={() => remove(o.id)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function OrderCard({
  order,
  locale,
  onSend,
  onDelete,
}: {
  order: OrderDraft;
  locale: Locale;
  onSend: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const t = useT();
  const exportPdf = async () => {
    try {
      await sharePdf(orderHtml(order, locale), `bestellung-${order.id.slice(0, 8)}`);
    } catch (e) {
      Alert.alert("PDF", e instanceof Error ? e.message : "");
    }
  };
  const total =
    order.total ??
    order.items.reduce((s, x) => s + (x.estimatedPrice ?? 0), 0);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="truck" size={18} color={c.primary} />
        <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
          {order.supplierName}
        </Text>
        <Badge
          label={order.status}
          tone={order.status === "draft" ? "warning" : order.status === "sent" ? "success" : "default"}
        />
      </View>
      {order.notes ? (
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6 }}>
          {order.notes}
        </Text>
      ) : null}
      <View style={{ marginTop: 10, gap: 6 }}>
        {order.items.map((it, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 6,
              borderBottomWidth: i === order.items.length - 1 ? 0 : 1,
              borderColor: c.border,
            }}
          >
            <Feather name="package" size={13} color={c.mutedForeground} />
            <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {it.name}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              {it.quantity} {it.unit}
            </Text>
            {it.estimatedPrice ? (
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12, width: 60, textAlign: "right" }}>
                €{it.estimatedPrice.toFixed(2)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderColor: c.border,
        }}
      >
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
          {t("total")}
        </Text>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
          €{total.toFixed(2)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {order.status === "draft" ? (
          <Button label={t("sendEmail")} icon="mail" onPress={onSend} style={{ flex: 1 }} />
        ) : (
          <Button label={t("sendEmail")} icon="mail" variant="secondary" onPress={onSend} style={{ flex: 1 }} />
        )}
        <Button label={t("pdfExport")} icon="share-2" variant="ghost" onPress={exportPdf} />
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            { width: 44, height: 44, borderRadius: 12, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="trash-2" size={16} color={c.mutedForeground} />
        </Pressable>
      </View>
    </Card>
  );
}

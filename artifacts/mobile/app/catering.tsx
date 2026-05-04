import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useAuthor } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { parseCateringEmail, type ParsedCatering } from "@/lib/ai";
import { fetchInbox, fetchMessage, markAsRead, type MailMessage } from "@/lib/mail";
import { cateringOfferHtml, sharePdf } from "@/lib/pdf";
import type { CateringEvent, CateringRequest } from "@/types";

const SAMPLE_DE = `Von: schmidt@firma-acme.de
Betreff: Catering 25 Personen 14.11.

Sehr geehrte Damen und Herren,

wir benötigen am 14. November um 12:30 Uhr Catering für 25 Personen.
Davon 8 Vegetarier, 2 Veganer, keine Allergien bekannt.
Bevorzugt regionale Küche. Bitte Angebot senden.

Mit freundlichen Grüßen
Sabine Schmidt
ACME GmbH`;

type Tab = "inbox" | "requests";

export default function Catering() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const author = useAuthor();

  const [tab, setTab] = useState<Tab>("inbox");

  // ── Inbox state ───────────────────────────────────────────────
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [filterCatering, setFilterCatering] = useState(false);

  // ── Compose / analyze modal ───────────────────────────────────
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParsedCatering | null>(null);

  const reset = () => {
    setOpen(false);
    setBody("");
    setPreview(null);
    setSelectedMsg(null);
  };

  // ── Load inbox ────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const msgs = await fetchInbox({
        top: 30,
        filter: filterCatering ? "catering" : undefined,
      });
      setMessages(msgs);
    } catch (e) {
      setInboxError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setInboxLoading(false);
    }
  }, [filterCatering]);

  // Load on tab switch to inbox
  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "inbox" && messages.length === 0) loadInbox();
  };

  // ── Open a message (fetch full body) ─────────────────────────
  const openMessage = async (msg: MailMessage) => {
    setMsgLoading(true);
    setSelectedMsg(msg);
    try {
      const full = await fetchMessage(msg.id);
      setSelectedMsg(full);
      if (!msg.isRead) {
        await markAsRead(msg.id).catch(() => null);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)),
        );
      }
    } catch {
      // keep bodyPreview as fallback
    } finally {
      setMsgLoading(false);
    }
  };

  // Strip basic HTML tags for plain-text display
  const stripHtml = (html: string) =>
    html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

  const bodyText = (msg: MailMessage) =>
    msg.body
      ? msg.body.contentType === "html"
        ? stripHtml(msg.body.content)
        : msg.body.content
      : msg.bodyPreview;

  // ── Import selected email into AI parser ──────────────────────
  const importToAnalyzer = (msg: MailMessage) => {
    const from = msg.from.emailAddress.address;
    const name = msg.from.emailAddress.name;
    const text = [
      `Von: ${name} <${from}>`,
      `Betreff: ${msg.subject}`,
      "",
      bodyText(msg),
    ].join("\n");
    setBody(text);
    setSelectedMsg(null);
    setOpen(true);
  };

  // ── AI analyze ────────────────────────────────────────────────
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
      ...author,
    };
    dispatch({ type: "addCatering", request: req });
    reset();
  };

  const setStatus = (req: CateringRequest, s: CateringRequest["status"]) =>
    dispatch({ type: "updateCatering", request: { ...req, status: s } });

  const createEventFromRequest = (req: CateringRequest) => {
    const now = new Date().toISOString();
    const event: CateringEvent = {
      id: newId(),
      title: req.subject || `Catering ${req.guests} Pers.`,
      clientName: req.fromEmail.split("@")[0] ?? req.fromEmail,
      clientEmail: req.fromEmail,
      eventDate: req.date,
      guestCount: req.guests || 0,
      status: "anfrage",
      menuItems: req.parsed.flatMap((block) =>
        block.recipeIds.map((rid) => {
          const recipe = state.recipes.find((r) => r.id === rid);
          return {
            recipeId: rid,
            recipeName: recipe
              ? (state.locale === "de" ? recipe.nameDe : recipe.name)
              : rid,
            portions: req.guests || 1,
            pricePerPortion: recipe?.sellPrice ?? 0,
            note: block.notes,
          };
        }),
      ),
      notes: req.dietary ?? undefined,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: "addEvent", event });
    router.push(`/eventdetail?id=${event.id}`);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: topPad + 8,
          paddingHorizontal: 16,
          paddingBottom: 0,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>
            Catering
          </Text>
          <Pressable
            onPress={() => { setBody(""); setPreview(null); setOpen(true); }}
            style={({ pressed }) => [
              { width: 38, height: 38, borderRadius: 12, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="plus" size={18} color={c.primaryForeground} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: "row", gap: 0 }}>
          {(["inbox", "requests"] as Tab[]).map((k) => {
            const label = k === "inbox"
              ? (state.locale === "de" ? "Exchange Inbox" : "Exchange Inbox")
              : (state.locale === "de" ? "Anfragen" : "Requests");
            const active = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => switchTab(k)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: active ? c.primary : "transparent",
                }}
              >
                <Text style={{
                  color: active ? c.primary : c.mutedForeground,
                  fontFamily: active ? "Inter_700Bold" : "Inter_400Regular",
                  fontSize: 14,
                }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Inbox tab ── */}
      {tab === "inbox" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 30 }}
          refreshControl={
            <RefreshControl
              refreshing={inboxLoading}
              onRefresh={loadInbox}
              tintColor={c.primary}
            />
          }
        >
          {/* Filter + refresh row */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={() => {
                setFilterCatering((v) => !v);
                setTimeout(loadInbox, 50);
              }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: filterCatering ? c.primary + "22" : c.muted,
                  borderWidth: 1,
                  borderColor: filterCatering ? c.primary : "transparent",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="filter" size={14} color={filterCatering ? c.primary : c.mutedForeground} />
              <Text style={{
                color: filterCatering ? c.primary : c.mutedForeground,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
              }}>
                {state.locale === "de" ? "Nur Catering" : "Catering only"}
              </Text>
            </Pressable>
            <Pressable
              onPress={loadInbox}
              style={({ pressed }) => [
                { width: 38, height: 38, borderRadius: 12, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="refresh-cw" size={16} color={c.foreground} />
            </Pressable>
          </View>

          {inboxLoading && messages.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator color={c.primary} size="large" />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }}>
                {state.locale === "de" ? "Exchange wird geladen…" : "Loading Exchange…"}
              </Text>
            </View>
          )}

          {inboxError && (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name="alert-circle" size={18} color={c.destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.destructive, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {state.locale === "de" ? "Verbindungsfehler" : "Connection error"}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {inboxError}
                  </Text>
                </View>
              </View>
              <Button label={state.locale === "de" ? "Erneut versuchen" : "Retry"} icon="refresh-cw" onPress={loadInbox} style={{ marginTop: 10 }} />
            </Card>
          )}

          {!inboxLoading && !inboxError && messages.length === 0 && (
            <Card>
              <EmptyState
                icon="inbox"
                title={state.locale === "de" ? "Keine E-Mails" : "No emails"}
              />
              <Button
                label={state.locale === "de" ? "Postfach laden" : "Load inbox"}
                icon="download"
                onPress={loadInbox}
                style={{ marginTop: 10 }}
              />
            </Card>
          )}

          {messages.map((msg) => (
            <Pressable
              key={msg.id}
              onPress={() => openMessage(msg)}
              style={({ pressed }) => [
                {
                  backgroundColor: c.card,
                  borderRadius: c.radius,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: msg.isRead ? c.border : c.primary + "55",
                  gap: 4,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {!msg.isRead && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                )}
                <Text
                  style={{
                    flex: 1,
                    color: c.foreground,
                    fontFamily: msg.isRead ? "Inter_500Medium" : "Inter_700Bold",
                    fontSize: 14,
                  }}
                  numberOfLines={1}
                >
                  {msg.subject || "(kein Betreff)"}
                </Text>
                {msg.hasAttachments && (
                  <Feather name="paperclip" size={13} color={c.mutedForeground} />
                )}
              </View>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                {msg.from.emailAddress.name || msg.from.emailAddress.address}
                {" · "}
                {new Date(msg.receivedDateTime).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }} numberOfLines={2}>
                {msg.bodyPreview}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Requests tab ── */}
      {tab === "requests" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 30 }}>
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
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.border, gap: 10 }}>
                    <SectionHeader title="KI-Vorschlag" />
                    {req.parsed.map((p, i) => (
                      <View key={i} style={{ gap: 6 }}>
                        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                          Block {i + 1} · {p.notes}
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

                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: c.border, flexDirection: "row", gap: 8 }}>
                  {req.status !== "confirmed" ? (
                    <Button label="Bestätigen" icon="check" onPress={() => setStatus(req, "confirmed")} style={{ flex: 1 }} />
                  ) : null}
                  {req.status !== "rejected" ? (
                    <Button label="Ablehnen" icon="x" variant="ghost" onPress={() => setStatus(req, "rejected")} style={{ flex: 1 }} />
                  ) : null}
                </View>
                {(() => {
                  const perPersonCents = req.parsed.reduce((sum, b) => {
                    return sum + b.recipeIds.reduce((s, rid) => {
                      const r = state.recipes.find((x) => x.id === rid);
                      return s + (r ? Math.round(r.sellPrice * 100) : 0);
                    }, 0);
                  }, 0);
                  const total = (perPersonCents * (req.guests || 1)) / 100;
                  return (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: c.muted, borderRadius: c.radius }}>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                        {t("perPerson")}
                      </Text>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 }}>
                        €{(perPersonCents / 100).toFixed(2)}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4 }}>
                        = €{total.toFixed(2)} ({req.guests} Pers.)
                      </Text>
                    </View>
                  );
                })()}
                <Button
                  label={t("generateOffer") + " · PDF"}
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
                <Button
                  label={t("saveAsEvent")}
                  icon="calendar"
                  variant="ghost"
                  style={{ marginTop: 6 }}
                  onPress={() => createEventFromRequest(req)}
                />
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Message detail modal ── */}
      <Modal
        visible={!!selectedMsg}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMsg(null)}
      >
        {selectedMsg && (
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
              <Pressable onPress={() => setSelectedMsg(null)}>
                <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                  {state.locale === "de" ? "Zurück" : "Back"}
                </Text>
              </Pressable>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "center" }} numberOfLines={1}>
                {selectedMsg.subject}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 80 }}>
              {/* Sender + date */}
              <View style={{ gap: 2 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {selectedMsg.from.emailAddress.name}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {selectedMsg.from.emailAddress.address}
                </Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {new Date(selectedMsg.receivedDateTime).toLocaleString("de-DE")}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: c.border }} />

              {/* Body */}
              {msgLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 30 }}>
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : (
                <Text style={{
                  color: c.foreground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  lineHeight: 22,
                }}>
                  {bodyText(selectedMsg)}
                </Text>
              )}
            </ScrollView>

            {/* Import button */}
            <View
              style={{
                position: "absolute",
                bottom: insets.bottom + 16,
                left: 16,
                right: 16,
              }}
            >
              <Button
                label={state.locale === "de" ? "Als Catering-Anfrage analysieren" : "Analyse as catering request"}
                icon="cpu"
                onPress={() => importToAnalyzer(selectedMsg)}
              />
            </View>
          </View>
        )}
      </Modal>

      {/* ── Compose / analyze modal ── */}
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

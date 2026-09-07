/**
 * /demo — Demo launcher page.
 *
 * Two sections:
 *   1. Instant live demo — three variant cards, each deep-links to
 *      /app/?demo=<variant> which auto-signs the visitor into the demo app.
 *   2. Guided demo request — contact form for prospects who want a personal
 *      walkthrough with the sales team.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Play,
  Building2,
  GraduationCap,
  PartyPopper,
  ArrowRight,
  Clock,
  Users,
  Zap,
} from "lucide-react";

type DemoVariant = "kantine" | "schule" | "catering";

interface VariantCard {
  variant: DemoVariant;
  Icon: typeof Building2;
  accent: string;
  highlights: [string, string, string];
}

export default function Demo() {
  const { t, lang } = useI18n();
  const [sent, setSent] = useState(false);
  const [size, setSize] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isDe = lang === "de";

  const variants: VariantCard[] = [
    {
      variant: "kantine",
      Icon: Building2,
      accent: "#f59e0b",
      highlights: isDe
        ? ["Tagesabschluss & TSE-Kasse", "KI-Forecast aus Anwesenheit", "ESG-Kennzahlen"]
        : ["Daily close & fiscal POS", "AI forecast from attendance", "ESG metrics"],
    },
    {
      variant: "schule",
      Icon: GraduationCap,
      accent: "#10b981",
      highlights: isDe
        ? ["DGE-Score live (Standard Schule)", "Eltern-Vorbestellung mit QR", "Öko-Wizard aktiv"]
        : ["Live DGE score (school standard)", "Parent pre-order with QR code", "Eco wizard active"],
    },
    {
      variant: "catering",
      Icon: PartyPopper,
      accent: "#6366f1",
      highlights: isDe
        ? ["4 aktive Events mit Pack-Plan", "6 Mitarbeiter im Dienstplan", "Outlook-Lead-Capture"]
        : ["4 active events with pack plan", "6 staff in the roster", "Outlook lead capture"],
    },
  ];

  const perks = isDe
    ? [
        { Icon: Clock, text: "Sofort — keine Registrierung nötig" },
        { Icon: Zap, text: "Echte App, echter Datensatz" },
        { Icon: Users, text: "Jederzeit abmelden und wechseln" },
      ]
    : [
        { Icon: Clock, text: "Instant — no registration required" },
        { Icon: Zap, text: "Real app, real dataset" },
        { Icon: Users, text: "Sign out and switch any time" },
      ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">
            {t("demoPageTitle")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            {t("demoPageSub")}
          </p>
        </div>
      </section>

      {/* Section 1 — Instant live demo */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-4">
            <Play className="w-3 h-3" />
            {isDe ? "Live-Demo — sofort starten" : "Live demo — start now"}
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            {t("demoInstantTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            {t("demoInstantSub")}
          </p>
          {/* Perks row */}
          <div className="mt-6 flex flex-wrap justify-center gap-6">
            {perks.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Variant cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          {variants.map(({ variant, Icon, accent, highlights }) => {
            const title = t(`demo${variant.charAt(0).toUpperCase() + variant.slice(1)}Title` as never);
            const desc  = t(`demo${variant.charAt(0).toUpperCase() + variant.slice(1)}Desc` as never);

            return (
              <a
                key={variant}
                href={`/app/?demo=${variant}`}
                className="group block rounded-2xl border border-border/60 bg-card hover:border-primary/60 hover:shadow-md transition-all duration-200 overflow-hidden no-underline"
              >
                {/* Top accent strip */}
                <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

                <div className="p-6">
                  {/* Icon + title */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: accent + "22" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                  </div>

                  <h3 className="font-bold text-lg leading-tight">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>

                  {/* Highlights */}
                  <ul className="mt-4 space-y-2">
                    {highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: accent }}
                        />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                    style={{ color: accent }}
                  >
                    {isDe ? "Demo öffnen" : "Open demo"}
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Password note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {isDe
            ? "Die Demo-Konten sind öffentlich — Passwort: "
            : "Demo accounts are public — password: "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">KitchenOS-Demo-2025!</code>
          {isDe
            ? " Alternativ: einfach auf eine Karte klicken — Anmeldung erfolgt automatisch."
            : " Or simply click a card — sign-in is automatic."}
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative flex items-center gap-4">
          <div className="flex-1 border-t border-border/60" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest shrink-0">
            {isDe ? "oder persönliche Demo anfragen" : "or request a personal demo"}
          </span>
          <div className="flex-1 border-t border-border/60" />
        </div>
      </div>

      {/* Section 2 — Guided demo request form */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            {t("demoTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("demoSub")}</p>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
                <p className="text-xl font-medium">{t("demoThanks")}</p>
              </div>
            ) : (
              <form
                className="grid gap-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFormError(null);
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  setSubmitting(true);
                  try {
                    const res = await fetch("/api/leads", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: String(fd.get("name") ?? ""),
                        company: String(fd.get("company") ?? ""),
                        email: String(fd.get("email") ?? ""),
                        size,
                        message: String(fd.get("message") ?? ""),
                      }),
                    });
                    if (!res.ok) {
                      throw new Error("lead_failed");
                    }
                    setSent(true);
                  } catch {
                    setFormError(t("demoError"));
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("demoNameLabel")}</Label>
                  <Input id="name" name="name" placeholder={t("demoNamePh")} required autoComplete="name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">{t("demoCompanyLabel")}</Label>
                  <Input id="company" name="company" placeholder={t("demoCompanyPh")} required autoComplete="organization" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("demoEmailLabel")}</Label>
                  <Input id="email" name="email" type="email" placeholder={t("demoEmailPh")} required autoComplete="email" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("demoSizeLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[t("demoSizeOpt1"), t("demoSizeOpt2"), t("demoSizeOpt3")].map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setSize(opt)}
                        className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                          size === opt
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="msg">{t("demoMsgLabel")}</Label>
                  <Textarea id="msg" name="message" placeholder={t("demoMsgPh")} rows={4} />
                </div>
                {formError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                ) : null}
                <Button size="lg" type="submit" disabled={submitting}>
                  {submitting ? t("demoSending") : t("demoSubmit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

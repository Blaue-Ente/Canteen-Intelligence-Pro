import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Clock, Users, BookOpen, Camera, ShieldCheck, Smartphone, Building2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

export default function Features() {
  const { t, lang } = useI18n();

  const items = [
    {
      Icon: QrCode,
      title: t("f1Title"),
      body: t("f1Body"),
      img: null,
    },
    {
      Icon: Clock,
      title: t("f2Title"),
      body: t("f2Body"),
      img: `${BASE}screenshots/screen-home.png`,
      imgAlt: "Dashboard mit Tagesaggregat",
    },
    {
      Icon: Users,
      title: t("f3Title"),
      body: t("f3Body"),
      img: null,
    },
    {
      Icon: BookOpen,
      title: t("f4Title"),
      body: t("f4Body"),
      img: `${BASE}screenshots/screen-karte.png`,
      imgAlt: "Wochenkarte",
    },
    {
      Icon: Camera,
      title: t("f5Title"),
      body: t("f5Body"),
      img: null,
    },
    {
      Icon: ShieldCheck,
      title: t("f6Title"),
      body: t("f6Body"),
      img: null,
    },
    {
      Icon: Smartphone,
      title: t("f7Title"),
      body: t("f7Body"),
      img: `${BASE}screenshots/screen-mehr.png`,
      imgAlt: "Alle Funktionen",
    },
    {
      Icon: Building2,
      title: t("f8Title"),
      body: t("f8Body"),
      img: null,
    },
  ];

  const spotlights: Array<{
    img: string;
    side: "left" | "right";
    titleDe: string;
    titleEn: string;
    bodyDe: string;
    bodyEn: string;
  }> = [
    {
      img: `${BASE}screenshots/screen-lager.png`,
      side: "left",
      titleDe: "Lager & Bestand auf einen Blick",
      titleEn: "Inventory at a glance",
      bodyDe: "Sehen Sie sofort, welche Zutaten knapp oder bald abgelaufen sind. Die KI erstellt automatisch Bestellvorschläge auf Basis Ihres Menüs.",
      bodyEn: "See immediately which ingredients are running low or expiring soon. AI automatically generates order suggestions based on your menu.",
    },
    {
      img: `${BASE}screenshots/screen-statistik.png`,
      side: "right",
      titleDe: "Statistiken, die wirklich helfen",
      titleEn: "Statistics that actually help",
      bodyDe: "Gekocht vs. Verkauft pro Tag, Verlust pro Gericht, Wochenumsatz — alle Zahlen, die eine Küchenleitung braucht. In Echtzeit, auf dem Telefon.",
      bodyEn: "Cooked vs. sold per day, loss per dish, weekly revenue — all the numbers a kitchen manager needs. In real time, on your phone.",
    },
    {
      img: `${BASE}screenshots/screen-bestellungen.png`,
      side: "left",
      titleDe: "Bestellungen direkt an Lieferanten",
      titleEn: "Orders directly to suppliers",
      bodyDe: "Entwürfe per E-Mail senden oder als PDF teilen — mit einem Tipp. Kein Fax, kein Telefon, kein Vergessen.",
      bodyEn: "Send drafts by email or share as PDF — with one tap. No fax, no phone, no forgetting.",
    },
    {
      img: `${BASE}screenshots/screen-preiskalkulation.png`,
      side: "right",
      titleDe: "Preiskalkulation mit echten Zahlen",
      titleEn: "Pricing with real numbers",
      bodyDe: "Geben Sie Portion, Marge und Gemeinkosten ein — KitchenOS berechnet Ihnen Netto-VK und Brutto-VK inkl. MwSt. automatisch.",
      bodyEn: "Enter portion, margin and overheads — KitchenOS calculates your net and gross selling price including VAT automatically.",
    },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("featuresTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("featuresSub")}</p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {items.map(({ Icon, title, body }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-6 flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Spotlight rows with real screenshots */}
      <section className="border-t border-border/60 bg-muted/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-20">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-center">
            {lang === "de" ? "Echte Screens — echte Küchen" : "Real screens — real kitchens"}
          </h2>
          {spotlights.map((s) => (
            <div
              key={s.titleDe}
              className={`flex flex-col gap-10 items-center ${
                s.side === "right" ? "lg:flex-row-reverse" : "lg:flex-row"
              }`}
            >
              <div className="flex justify-center shrink-0">
                <div className="rounded-[1.75rem] overflow-hidden shadow-2xl border border-border/40">
                  <img
                    src={s.img}
                    alt={s.titleDe}
                    className="w-[220px] sm:w-[250px] block"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="flex-1 max-w-lg">
                <h3 className="text-2xl font-serif font-bold tracking-tight mb-4">
                  {lang === "de" ? s.titleDe : s.titleEn}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {lang === "de" ? s.bodyDe : s.bodyEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/demo"><Button size="lg">{t("ctaDemo")}</Button></Link>
            <Link href="/pricing"><Button size="lg" variant="outline">{t("navPricing")}</Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}

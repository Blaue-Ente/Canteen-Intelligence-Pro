import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Clock, Leaf, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const screenshots = [
  {
    src: `${BASE}screenshots/screen-home.png`,
    labelDe: "Dashboard",
    labelEn: "Dashboard",
  },
  {
    src: `${BASE}screenshots/screen-karte.png`,
    labelDe: "Wochenkarte",
    labelEn: "Weekly menu",
  },
  {
    src: `${BASE}screenshots/screen-lager.png`,
    labelDe: "Lager",
    labelEn: "Inventory",
  },
  {
    src: `${BASE}screenshots/screen-statistik.png`,
    labelDe: "Statistik",
    labelEn: "Statistics",
  },
  {
    src: `${BASE}screenshots/screen-bestellungen.png`,
    labelDe: "Bestellungen",
    labelEn: "Orders",
  },
  {
    src: `${BASE}screenshots/screen-preiskalkulation.png`,
    labelDe: "Preiskalkulation",
    labelEn: "Pricing",
  },
  {
    src: `${BASE}screenshots/screen-mehr.png`,
    labelDe: "Alle Funktionen",
    labelEn: "All features",
  },
];

export default function Home() {
  const { t, lang } = useI18n();
  const why = [
    { Icon: Leaf, title: t("why1Title"), body: t("why1Body") },
    { Icon: Clock, title: t("why2Title"), body: t("why2Body") },
    { Icon: ShieldCheck, title: t("why3Title"), body: t("why3Body") },
    { Icon: Sparkles, title: t("why4Title"), body: t("why4Body") },
  ];
  const points = [t("heroPoint1"), t("heroPoint2"), t("heroPoint3")];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Sparkles className="w-3 h-3" /> {t("tagline")}
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.05]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">{t("heroSub")}</p>
            <ul className="mt-6 space-y-2">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" /> {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo">
                <Button size="lg" className="gap-2">
                  {t("ctaDemo")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline">{t("navFeatures")}</Button>
              </Link>
            </div>
          </div>

          {/* Real app screenshot */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] -z-10" />
              <img
                src={`${BASE}screenshots/screen-home.png`}
                alt="KitchenOS Dashboard"
                className="w-[260px] sm:w-[300px] rounded-[2rem] shadow-2xl border border-border/40"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-12 border-y border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
            {t("socialProofTitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
            {["Werkskantine GmbH", "Stadtschule Mitte", "PflegeHaus Sonne", "EventCater AG", "Bauer Catering", "Klinik Nord"].map((n) => (
              <div key={n} className="text-sm font-medium tracking-wide">{n}</div>
            ))}
          </div>
        </div>
      </section>

      {/* App gallery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
            {lang === "de" ? "Die App — live und echt" : "The app — live and real"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {lang === "de"
              ? "Keine Marketing-Mockups. Das sind echte Screenshots aus dem laufenden Betrieb."
              : "No marketing mockups. These are real screenshots from a live canteen operation."}
          </p>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {screenshots.map((s) => (
            <div key={s.src} className="shrink-0 snap-start flex flex-col items-center gap-3">
              <div className="rounded-[1.75rem] overflow-hidden shadow-xl border border-border/40 bg-background">
                <img
                  src={s.src}
                  alt={lang === "de" ? s.labelDe : s.labelEn}
                  className="w-[180px] sm:w-[210px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {lang === "de" ? s.labelDe : s.labelEn}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Why section */}
      <section className="bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">{t("whyTitle")}</h2>
            <p className="mt-3 text-muted-foreground">{t("whySub")}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {why.map(({ Icon, title, body }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-2xl sm:text-3xl font-serif italic leading-relaxed">
          "{t("testimonialBody")}"
        </p>
        <p className="mt-6 text-sm text-muted-foreground">— {t("testimonialAuthor")}</p>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">{t("finalCtaTitle")}</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{t("finalCtaSub")}</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/demo">
              <Button size="lg" className="gap-2">
                {t("ctaDemo")} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">{t("ctaTalk")}</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

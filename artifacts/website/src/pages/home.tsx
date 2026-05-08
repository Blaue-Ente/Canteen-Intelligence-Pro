import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Sparkles,
  ArrowRight,
  Mic,
  Receipt,
  Play,
  ChevronDown,
  Building2,
  GraduationCap,
  PartyPopper,
  Award,
  Scale,
  Cpu,
  HardDrive,
  CreditCard,
  Users,
  Info,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

export default function Home() {
  const { t, lang } = useI18n();
  const de = lang === "de";

  const points = [t("heroPoint1"), t("heroPoint2"), t("heroPoint3"), t("heroPoint4")];
  const stats = [
    { value: t("stat1"), label: t("stat1Label") },
    { value: t("stat2"), label: t("stat2Label") },
    { value: t("stat3"), label: t("stat3Label") },
    { value: t("stat4"), label: t("stat4Label") },
  ];

  const navCards = [
    {
      href: "/features",
      Icon: Cpu,
      titleDe: "Funktionen",
      titleEn: "Features",
      descDe: "Alle Module — Kios, Kasse, HACCP, DGE, Lager, Forecasting und mehr.",
      descEn: "All modules — Kios, POS, HACCP, DGE, inventory, forecasting and more.",
    },
    {
      href: "/for-operators",
      Icon: Users,
      titleDe: "Für Betreiber",
      titleEn: "For Operators",
      descDe: "Welche Lösung passt zu Ihrer Küche? Kantine, Schule, Catering.",
      descEn: "Which solution fits your kitchen? Canteen, school, catering.",
    },
    {
      href: "/standards",
      Icon: Award,
      titleDe: "Standards & Compliance",
      titleEn: "Standards & Compliance",
      descDe: "DGE, HACCP, LMIV, KassenSichV — alles automatisch geprüft.",
      descEn: "DGE, HACCP, LMIV, KassenSichV — all automatically verified.",
    },
    {
      href: "/compare",
      Icon: Scale,
      titleDe: "Vergleich",
      titleEn: "Compare",
      descDe: "KItchenOS vs. andere Lösungen — transparent nebeneinandergestellt.",
      descEn: "KItchenOS vs. other solutions — transparent side-by-side.",
    },
    {
      href: "/hardware",
      Icon: HardDrive,
      titleDe: "Hardware",
      titleEn: "Hardware",
      descDe: "Empfohlene Geräte, Bondrucker, Bluetooth-Sensoren und TSE-Hardware.",
      descEn: "Recommended devices, receipt printers, Bluetooth sensors and TSE hardware.",
    },
    {
      href: "/pricing",
      Icon: CreditCard,
      titleDe: "Preise",
      titleEn: "Pricing",
      descDe: "Transparente Preismodelle — Light-Modus und Voll-Modus.",
      descEn: "Transparent pricing — Lite mode and Full mode.",
    },
    {
      href: "/about",
      Icon: Info,
      titleDe: "Über uns",
      titleEn: "About us",
      descDe: "Wer steckt hinter KItchenOS und warum wurde es gebaut.",
      descEn: "Who is behind KItchenOS and why it was built.",
    },
  ];

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/8 via-background to-background" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium whitespace-nowrap">
              <Sparkles className="w-3 h-3" /> {t("heroBadge")}
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.05]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">{t("heroSub")}</p>
            <ul className="mt-6 space-y-2">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" className="gap-2">
                    <Play className="w-4 h-4" /> {t("ctaDemoStart")}
                    <ChevronDown className="w-4 h-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuItem asChild>
                    <a href="/app/?demo=kantine" className="flex items-start gap-3 cursor-pointer">
                      <Building2 className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{t("demoKantineTitle")}</div>
                        <div className="text-xs text-muted-foreground">{t("demoKantineDesc")}</div>
                      </div>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/app/?demo=schule" className="flex items-start gap-3 cursor-pointer">
                      <GraduationCap className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{t("demoSchuleTitle")}</div>
                        <div className="text-xs text-muted-foreground">{t("demoSchuleDesc")}</div>
                      </div>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/app/?demo=catering" className="flex items-start gap-3 cursor-pointer">
                      <PartyPopper className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{t("demoCateringTitle")}</div>
                        <div className="text-xs text-muted-foreground">{t("demoCateringDesc")}</div>
                      </div>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="gap-2">
                  {t("ctaDemo")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero screenshot */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] -z-10" />
              <div className="absolute -top-3 -right-3 z-10 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-semibold shadow-lg flex items-center gap-1">
                <Mic className="w-3 h-3" />
                {de ? "Kios spricht" : "Kios speaking"}
              </div>
              <img
                src={`${BASE}screenshots/screen-dashboard.png`}
                alt={de ? "KItchenOS Dashboard — Kios Morgenbrief" : "KItchenOS Dashboard — Kios morning briefing"}
                className="w-[260px] sm:w-[310px] rounded-[2rem] shadow-2xl border border-border/40"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-8">
            {t("statsTitle")}
          </p>
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-serif font-bold text-primary">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Navigation cards ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
            {de ? "Alles auf einen Blick" : "Everything at a glance"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {de
              ? "Wählen Sie ein Thema — jede Seite geht in die Tiefe."
              : "Choose a topic — each page goes into detail."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navCards.map(({ href, Icon, titleDe, titleEn, descDe, descEn }) => (
            <Link key={href} href={href}>
              <div className="group h-full flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-5 transition-all hover:border-primary/40 hover:bg-primary/3 hover:shadow-md cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                    {de ? titleDe : titleEn}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {de ? descDe : descEn}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {de ? "Mehr erfahren" : "Learn more"} <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-2xl sm:text-3xl font-serif italic leading-relaxed">
            "{t("testimonialBody")}"
          </p>
          <p className="mt-6 text-sm text-muted-foreground">— {t("testimonialAuthor")}</p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">{t("finalCtaTitle")}</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{t("finalCtaSub")}</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" className="gap-2">
                <Play className="w-4 h-4" /> {t("ctaDemoStart")}
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72">
              <DropdownMenuItem asChild>
                <a href="/app/?demo=kantine" className="flex items-start gap-3 cursor-pointer">
                  <Building2 className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">{t("demoKantineTitle")}</div>
                    <div className="text-xs text-muted-foreground">{t("demoKantineDesc")}</div>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/app/?demo=schule" className="flex items-start gap-3 cursor-pointer">
                  <GraduationCap className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">{t("demoSchuleTitle")}</div>
                    <div className="text-xs text-muted-foreground">{t("demoSchuleDesc")}</div>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/app/?demo=catering" className="flex items-start gap-3 cursor-pointer">
                  <PartyPopper className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">{t("demoCateringTitle")}</div>
                    <div className="text-xs text-muted-foreground">{t("demoCateringDesc")}</div>
                  </div>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/demo">
            <Button size="lg" variant="outline" className="gap-2">
              {t("ctaDemo")} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="outline">{t("ctaTalk")}</Button>
          </Link>
        </div>
      </section>
    </>
  );
}

import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Award,
  Mic,
  Receipt,
  Database,
  Play,
  ChevronDown,
  Building2,
  GraduationCap,
  PartyPopper,
  Zap,
  Clock,
  Bell,
  Volume2,
  ShoppingCart,
  FileText,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Leaf,
  TrendingUp,
  Camera,
  Users,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const galleryScreenshots = [
  { src: `${BASE}screenshots/screen-dashboard.png`,       labelDe: "Dashboard & Kios-Morgenbrief",     labelEn: "Dashboard & Kios briefing" },
  { src: `${BASE}screenshots/screen-wochenkarte.png`,     labelDe: "Wochenkarte",                      labelEn: "Weekly menu" },
  { src: `${BASE}screenshots/screen-lager2.png`,          labelDe: "Lager (multi-Standort)",            labelEn: "Inventory (multi-location)" },
  { src: `${BASE}screenshots/screen-statistik2.png`,      labelDe: "Statistik",                        labelEn: "Statistics" },
  { src: `${BASE}screenshots/screen-kasse-pos.png`,       labelDe: "Kasse — normales Raster",          labelEn: "POS — normal grid" },
  { src: `${BASE}screenshots/screen-kasse-pos-compact.png`, labelDe: "Kasse — kompaktes Raster",       labelEn: "POS — compact grid" },
  { src: `${BASE}screenshots/screen-kasse-abschluss.png`, labelDe: "Kasse — Abschluss & Z-Bon",        labelEn: "POS — close & Z-report" },
  { src: `${BASE}screenshots/screen-haccp.png`,           labelDe: "HACCP-Temperaturlogs",             labelEn: "HACCP temperature logs" },
  { src: `${BASE}screenshots/screen-dge.png`,             labelDe: "DGE-Qualitätsstandard",            labelEn: "DGE quality standard" },
  { src: `${BASE}screenshots/screen-reinigung.png`,       labelDe: "Reinigungsplan",                   labelEn: "Cleaning schedule" },
  { src: `${BASE}screenshots/screen-gerichtanalyse.png`,  labelDe: "Gericht-Analyse",                  labelEn: "Dish analysis" },
  { src: `${BASE}screenshots/screen-margen.png`,          labelDe: "Margen-Warnungen",                 labelEn: "Margin alerts" },
  { src: `${BASE}screenshots/screen-auto-bestellung.png`, labelDe: "Auto-Bestellung",                  labelEn: "Auto procurement" },
  { src: `${BASE}screenshots/screen-lieferanten.png`,     labelDe: "Lieferanten & KI-E-Mail",          labelEn: "Suppliers & AI email" },
  { src: `${BASE}screenshots/screen-erzeuger.png`,        labelDe: "Regionale Erzeuger",               labelEn: "Local producers" },
  { src: `${BASE}screenshots/screen-verschwendung.png`,   labelDe: "Verschwendung & KI-Tablett",       labelEn: "Waste & AI tray analysis" },
  { src: `${BASE}screenshots/screen-okowizard.png`,       labelDe: "Öko-Wizard",                      labelEn: "Eco wizard" },
  { src: `${BASE}screenshots/screen-events.png`,          labelDe: "Veranstaltungen",                  labelEn: "Events" },
  { src: `${BASE}screenshots/screen-schichtuebergabe.png`,labelDe: "Schichtübergabe",                  labelEn: "Shift handover" },
  { src: `${BASE}screenshots/screen-scannen.png`,         labelDe: "Scannen",                          labelEn: "Scanning" },
  { src: `${BASE}screenshots/screen-vorbestellung.png`,   labelDe: "Gäste-Vorbestellung",              labelEn: "Guest pre-order" },
  { src: `${BASE}screenshots/screen-preiskalkulation2.png`, labelDe: "Preiskalkulation",               labelEn: "Price calculation" },
];

const kiosCommands = [
  "Kios, Tagesabschluss starten",
  "Kios, wie ist mein DGE-Score?",
  "Kios, HACCP-Log für Kühlung 1 bestätigen",
  "Kios, Bestellung für Rindergulasch anlegen",
  "Kios, Timer 20 Minuten",
  "Kios, Rezept Schnitzel — nächster Schritt",
  "Kios, Lagerbestand Kartoffeln?",
  "Kios, KI-Prognose für morgen",
  "Kios, Schichtübergabe öffnen",
  "Kios, Reste-Rezept aus Hähnchenbrust",
];

const kasseFeatures = [
  { Icon: ShieldCheck, text: "Fiskaly-TSE-Signatur auf jedem Bon" },
  { Icon: FileText,    text: "DSFinV-K-Export für die Betriebsprüfung" },
  { Icon: Receipt,     text: "KassenSichV-konforme Z-Bons & Zwischenbericht" },
  { Icon: CreditCard,  text: "Bar / EC-Karte — getrennte Zähler pro Schicht" },
  { Icon: Zap,         text: "Storno via Langdruck — TSE-signiert mit STORNO-Badge" },
  { Icon: BarChart3,   text: "Kompakt- & Normal-Raster per Icon umschalten" },
];

const complianceItems = [
  { label: "Schulverpflegung", icon: "🏫" },
  { label: "Kita-Verpflegung", icon: "🧒" },
  { label: "Krankenhausverpflegung", icon: "🏥" },
  { label: "Seniorenverpflegung", icon: "🏡" },
];

export default function Home() {
  const { t, lang } = useI18n();

  const why = [
    { Icon: Award,    title: t("why1Title"), body: t("why1Body") },
    { Icon: Mic,      title: t("why2Title"), body: t("why2Body") },
    { Icon: Receipt,  title: t("why3Title"), body: t("why3Body") },
    { Icon: Database, title: t("why4Title"), body: t("why4Body") },
  ];

  const points = [t("heroPoint1"), t("heroPoint2"), t("heroPoint3"), t("heroPoint4")];
  const stats = [
    { value: t("stat1"), label: t("stat1Label") },
    { value: t("stat2"), label: t("stat2Label") },
    { value: t("stat3"), label: t("stat3Label") },
    { value: t("stat4"), label: t("stat4Label") },
  ];

  const de = lang === "de";

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/8 via-background to-background" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
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

          {/* Hero screenshot — Dashboard with Kios morning greeting */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] -z-10" />
              {/* Kios badge */}
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

      {/* ── App gallery ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
            {de ? "Die App — live und echt" : "The app — live and real"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {de
              ? "Keine Marketing-Mockups. Echte Screenshots aus dem laufenden Betrieb."
              : "No marketing mockups. Real screenshots from a live operation."}
          </p>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {galleryScreenshots.map((s) => (
            <div key={s.src} className="shrink-0 snap-start flex flex-col items-center gap-3">
              <div className="rounded-[1.75rem] overflow-hidden shadow-xl border border-border/40 bg-background">
                <img
                  src={s.src}
                  alt={de ? s.labelDe : s.labelEn}
                  className="w-[175px] sm:w-[205px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground text-center max-w-[175px]">
                {de ? s.labelDe : s.labelEn}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kios Spotlight ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#1a0f00] via-[#0d0700] to-[#1a0f00]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid gap-14 lg:grid-cols-2 lg:items-center">

          {/* Left: text */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-medium mb-5">
              <Mic className="w-3 h-3" /> {de ? "KI-Sprachassistent" : "AI Voice Assistant"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white leading-tight">
              {de ? (
                <>Kios — Ihre Küche<br />hört auf Sie</>
              ) : (
                <>Kios — your kitchen<br />listens to you</>
              )}
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed max-w-lg">
              {de
                ? "Always-on Hotword-Detection. Freihändig am Herd bedienen, während Sie kochen. Kios führt Dialoge, bestätigt HACCP-Logs, legt Bestellungen an — auf Deutsch und Englisch."
                : "Always-on hotword detection. Hands-free operation while cooking. Kios holds conversations, confirms HACCP logs, creates orders — in German and English."}
            </p>

            {/* Voice commands demo */}
            <div className="mt-8 space-y-2">
              {kiosCommands.map((cmd) => (
                <div key={cmd} className="flex items-start gap-2.5">
                  <div className="mt-1 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Mic className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm text-white/80 font-mono">"{cmd}"</span>
                </div>
              ))}
            </div>

            {/* Kios feature pills */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { Icon: Volume2, label: de ? "ElevenLabs Stimmen" : "ElevenLabs voices" },
                { Icon: Bell,    label: de ? "Push-Bestätigung" : "Push confirmation" },
                { Icon: Clock,   label: de ? "Morgenbrief 07:30" : "Morning briefing 07:30" },
                { Icon: Zap,     label: de ? "Ambient-Modus" : "Ambient mode" },
              ].map(({ Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white/80 px-3 py-1.5 text-xs font-medium">
                  <Icon className="w-3 h-3 text-primary" /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Kios screenshot */}
          <div className="flex justify-center lg:justify-end gap-5">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={`${BASE}screenshots/screen-settings.png`}
                  alt={de ? "Kios Stimme & Benachrichtigungen" : "Kios voice & notifications"}
                  className="w-[200px] sm:w-[230px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-white/50">{de ? "Kios-Einstellungen" : "Kios settings"}</span>
            </div>
            <div className="flex flex-col items-center gap-3 mt-8">
              <div className="rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={`${BASE}screenshots/screen-dashboard.png`}
                  alt={de ? "Dashboard — Kios Morgenbrief" : "Dashboard — Kios morning brief"}
                  className="w-[200px] sm:w-[230px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-white/50">{de ? "Morgenbrief live" : "Live morning brief"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Kasse / POS Showcase ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a0a0b] via-[#111114] to-[#0a0a0b]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid gap-14 lg:grid-cols-2 lg:items-center">

          {/* Left: POS screenshots */}
          <div className="flex justify-center lg:justify-start gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={`${BASE}screenshots/screen-kasse-pos.png`}
                  alt={de ? "Kasse — normales Raster" : "POS — normal grid"}
                  className="w-[190px] sm:w-[215px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-white/40">{de ? "Normal-Raster" : "Normal grid"}</span>
            </div>
            <div className="flex flex-col items-center gap-3 mt-10">
              <div className="rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={`${BASE}screenshots/screen-kasse-pos-compact.png`}
                  alt={de ? "Kasse — kompaktes Raster" : "POS — compact grid"}
                  className="w-[190px] sm:w-[215px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-white/40">{de ? "Kompakt-Raster" : "Compact grid"}</span>
            </div>
          </div>

          {/* Right: text */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-medium mb-5">
              <Receipt className="w-3 h-3" /> {de ? "TSE-Kasse" : "TSE-compliant POS"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white leading-tight">
              {de ? (
                <>Kasse direkt in<br />KItchenOS — fertig</>
              ) : (
                <>POS built directly<br />into KItchenOS</>
              )}
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed max-w-lg">
              {de
                ? "Keine Drittanbieter, keine Schnittstellen-Pannen. Fiskaly-TSE direkt integriert — jeder Bon ist signiert, jeder Abschluss DSFinV-K-konform."
                : "No third parties, no interface issues. Fiskaly TSE directly integrated — every receipt is signed, every close DSFinV-K compliant."}
            </p>

            <div className="mt-8 space-y-3.5">
              {kasseFeatures.map(({ Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-white/80 leading-relaxed pt-1">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="rounded-[1.25rem] overflow-hidden border border-white/10 shadow-xl inline-block">
                <img
                  src={`${BASE}screenshots/screen-kasse-abschluss.png`}
                  alt={de ? "Kasse Abschluss & Z-Bon" : "POS close & Z-report"}
                  className="w-[200px] sm:w-[230px] block"
                  loading="lazy"
                />
              </div>
              <p className="mt-2 text-xs text-white/40">{de ? "Abschluss & Z-Bon-Ansicht" : "Close & Z-report view"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DGE & HACCP Compliance ── */}
      <section className="bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid gap-14 lg:grid-cols-2 lg:items-center">

          {/* Left: text */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-5">
              <Award className="w-3 h-3" /> {de ? "DGE & HACCP" : "DGE & HACCP compliance"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight leading-tight">
              {de ? (
                <>Compliance auf<br />Knopfdruck</>
              ) : (
                <>Compliance<br />at the push of a button</>
              )}
            </h2>
            <p className="mt-4 text-muted-foreground text-base leading-relaxed max-w-lg">
              {de
                ? "KItchenOS prüft Ihren Speiseplan automatisch gegen den DGE-Qualitätsstandard und protokolliert alle HACCP-Temperaturen digital — kein Klemmbrett mehr."
                : "KItchenOS automatically checks your menu against DGE quality standards and logs all HACCP temperatures digitally — no more clipboards."}
            </p>

            {/* DGE categories */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {complianceItems.map(({ label, icon }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background px-4 py-3">
                  <span className="text-xl">{icon}</span>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              {[
                de ? "Live-Score 0–100 mit Kriterien-Ampel" : "Live score 0–100 with criteria traffic lights",
                de ? "PDF-Zertifikat für Träger & Ausschreibungen" : "PDF certificate for authorities & tenders",
                de ? "HACCP: 8 Auto-Vorschläge täglich — 1 Tap bestätigen" : "HACCP: 8 auto-suggestions daily — confirm in 1 tap",
                de ? "Rückstellproben-Etiketten mit 7-Tages-Erinnerung" : "Retained samples labels with 7-day reminder",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: screenshots */}
          <div className="flex justify-center lg:justify-end gap-5">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-[1.75rem] overflow-hidden shadow-xl border border-border/40">
                <img
                  src={`${BASE}screenshots/screen-dge.png`}
                  alt={de ? "DGE-Qualitätsstandard Score" : "DGE quality standard score"}
                  className="w-[190px] sm:w-[210px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-muted-foreground">{de ? "DGE-Score live" : "DGE score live"}</span>
            </div>
            <div className="flex flex-col items-center gap-3 mt-10">
              <div className="rounded-[1.75rem] overflow-hidden shadow-xl border border-border/40">
                <img
                  src={`${BASE}screenshots/screen-haccp.png`}
                  alt={de ? "HACCP Temperaturlogs" : "HACCP temperature logs"}
                  className="w-[190px] sm:w-[210px] block"
                  loading="lazy"
                />
              </div>
              <span className="text-xs text-muted-foreground">{de ? "HACCP digital" : "HACCP digital"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── More impressive features ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
            {de ? "Noch mehr, was KItchenOS kann" : "Even more what KItchenOS can do"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {de
              ? "Jede Funktion ist für den Küchen-Alltag gebaut — nicht als Kompromiss."
              : "Every feature is built for kitchen reality — not as a compromise."}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {([
            {
              Icon: TrendingUp,
              img: `${BASE}screenshots/screen-gerichtanalyse.png`,
              titleDe: "Gericht-Analyse",
              titleEn: "Dish analysis",
              bodyDe: "Score je Gericht aus Absatz, Marge, Verlustquote und Umsatz. Top-Performer auf einen Blick — welches Gericht wirklich Geld bringt.",
              bodyEn: "Score per dish from sales, margin, loss rate and revenue. Top performers at a glance — which dish truly makes money.",
            },
            {
              Icon: ShoppingCart,
              img: `${BASE}screenshots/screen-auto-bestellung.png`,
              titleDe: "Auto-Bestellung",
              titleEn: "Auto procurement",
              bodyDe: "KI verteilt Bestellmengen automatisch auf Ihre Lieferanten. E-Mail-Entwurf in einem Klick — kein manuelles Übertragen.",
              bodyEn: "AI automatically distributes order quantities to your suppliers. Email draft in one click — no manual transcription.",
            },
            {
              Icon: Users,
              img: `${BASE}screenshots/screen-schichtuebergabe.png`,
              titleDe: "Schichtübergabe",
              titleEn: "Shift handover",
              bodyDe: "Strukturierte Übergabe-Notizen zwischen Schichten. Dienstplan, Krankmeldungen und Tausch-Anfragen direkt am Gerät.",
              bodyEn: "Structured handover notes between shifts. Rosters, sick leave and swap requests directly on the device.",
            },
            {
              Icon: Camera,
              img: `${BASE}screenshots/screen-scannen.png`,
              titleDe: "KI-Scanner",
              titleEn: "AI scanner",
              bodyDe: "Foto vom Produkt → KI erkennt Artikel, Hersteller, Allergene sofort. Lieferung scannen statt manuell erfassen.",
              bodyEn: "Photo of product → AI instantly recognises item, manufacturer, allergens. Scan delivery instead of manual entry.",
            },
            {
              Icon: Leaf,
              img: `${BASE}screenshots/screen-okowizard.png`,
              titleDe: "Öko-Wizard",
              titleEn: "Eco wizard",
              bodyDe: "Öko-Punkte für fleischfreie Tage, Resteverwertung, regionale Bestellungen. CO₂-Ersparnis live. Bronze/Silber/Gold für Träger-Reports.",
              bodyEn: "Eco points for meat-free days, leftover use, regional orders. CO₂ savings live. Bronze/Silver/Gold for authority reports.",
            },
            {
              Icon: BarChart3,
              img: `${BASE}screenshots/screen-margen.png`,
              titleDe: "Margen-Warnungen",
              titleEn: "Margin alerts",
              bodyDe: "Sortiert nach Marge — Sie sehen sofort, wo Geld verloren geht. Kosten, Preis und Foodcost-Prozent auf einen Blick.",
              bodyEn: "Sorted by margin — you instantly see where money is lost. Costs, price and food cost percentage at a glance.",
            },
          ] as Array<{ Icon: React.ComponentType<{ className?: string }>; img: string; titleDe: string; titleEn: string; bodyDe: string; bodyEn: string }>).map(({ Icon, img, titleDe, titleEn, bodyDe, bodyEn }) => (
            <Card key={titleDe} className="border-border/60 overflow-hidden">
              <div className="overflow-hidden bg-muted/30">
                <img
                  src={img}
                  alt={de ? titleDe : titleEn}
                  className="w-full h-48 object-cover object-top"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-base">{de ? titleDe : titleEn}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {de ? bodyDe : bodyEn}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/features">
            <Button variant="outline" size="lg" className="gap-2">
              {de ? "Alle Funktionen ansehen" : "View all features"} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Why section ── */}
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

      {/* ── Testimonial ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-2xl sm:text-3xl font-serif italic leading-relaxed">
          "{t("testimonialBody")}"
        </p>
        <p className="mt-6 text-sm text-muted-foreground">— {t("testimonialAuthor")}</p>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
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
        </div>
      </section>
    </>
  );
}

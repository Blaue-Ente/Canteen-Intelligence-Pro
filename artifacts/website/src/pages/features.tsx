import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Award, FileText, ShieldCheck, Leaf,
  Mic, CreditCard, Smartphone, Users, ListChecks,
  ChefHat, Camera, Sparkles, ClipboardList,
  Boxes, ShoppingCart, TrendingUp, Calculator,
  QrCode, Mail, PartyPopper, GraduationCap,
  BarChart3, FileSpreadsheet, Building2, ImageDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature { Icon: LucideIcon; title: string; body: string; }
interface Group  { title: string; items: Feature[]; }

export default function Features() {
  const { t } = useI18n();

  const groups: Group[] = [
    {
      title: t("fGroup1Title"),
      items: [
        { Icon: Award,        title: t("fDgeTitle"),    body: t("fDgeBody") },
        { Icon: FileText,     title: t("fLmivTitle"),   body: t("fLmivBody") },
        { Icon: ShieldCheck,  title: t("fHaccpTitle"),  body: t("fHaccpBody") },
        { Icon: Leaf,         title: t("fOkoTitle"),    body: t("fOkoBody") },
      ],
    },
    {
      title: t("fGroup2Title"),
      items: [
        { Icon: Mic,          title: t("fKiosTitle"),    body: t("fKiosBody") },
        { Icon: CreditCard,   title: t("fKasseTitle"),   body: t("fKasseBody") },
        { Icon: Smartphone,   title: t("fZettleTitle"),  body: t("fZettleBody") },
        { Icon: Users,        title: t("fSchichtTitle"), body: t("fSchichtBody") },
        { Icon: ListChecks,   title: t("fTagesTitle"),   body: t("fTagesBody") },
      ],
    },
    {
      title: t("fGroup3Title"),
      items: [
        { Icon: ChefHat,       title: t("fProdTitle"),      body: t("fProdBody") },
        { Icon: Sparkles,      title: t("fRezepteTitle"),   body: t("fRezepteBody") },
        { Icon: Camera,        title: t("fScanTitle"),      body: t("fScanBody") },
        { Icon: ClipboardList, title: t("fReinigungTitle"), body: t("fReinigungBody") },
      ],
    },
    {
      title: t("fGroup4Title"),
      items: [
        { Icon: Boxes,        title: t("fLagerTitle"),    body: t("fLagerBody") },
        { Icon: ShoppingCart, title: t("fBestellTitle"),  body: t("fBestellBody") },
        { Icon: TrendingUp,   title: t("fForecastTitle"), body: t("fForecastBody") },
        { Icon: Calculator,   title: t("fPriceTitle"),    body: t("fPriceBody") },
      ],
    },
    {
      title: t("fGroup5Title"),
      items: [
        { Icon: QrCode,         title: t("fVorbestTitle"),    body: t("fVorbestBody") },
        { Icon: Mail,           title: t("fCrmTitle"),        body: t("fCrmBody") },
        { Icon: PartyPopper,    title: t("fCateringTitle"),   body: t("fCateringBody") },
        { Icon: GraduationCap,  title: t("fSchulkontoTitle"), body: t("fSchulkontoBody") },
      ],
    },
    {
      title: t("fGroup6Title"),
      items: [
        { Icon: BarChart3,       title: t("fStatsTitle"),     body: t("fStatsBody") },
        { Icon: FileSpreadsheet, title: t("fReportsTitle"),   body: t("fReportsBody") },
        { Icon: Building2,       title: t("fLocationsTitle"), body: t("fLocationsBody") },
        { Icon: ImageDown,       title: t("fTabletTitle"),    body: t("fTabletBody") },
      ],
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

      {groups.map((g) => (
        <section
          key={g.title}
          className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-b border-border/40 last:border-0"
        >
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-8 flex items-center gap-3">
            <span className="inline-block w-1.5 h-6 rounded bg-primary" />
            {g.title}
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {g.items.map(({ Icon, title, body }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <section className="bg-muted/20 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Button size="lg" asChild><Link href="/demo">{t("ctaDemo")}</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/compare">{t("navCompare")}</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/standards">{t("navStandards")}</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}

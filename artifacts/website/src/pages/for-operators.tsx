import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2, GraduationCap, Stethoscope,
  HeartPulse, PartyPopper, Hotel,
} from "lucide-react";

export default function ForOperators() {
  const { t } = useI18n();
  const segments = [
    { Icon: Building2,    title: t("opCanteenTitle"),  body: t("opCanteenBody") },
    { Icon: GraduationCap, title: t("opSchoolTitle"),  body: t("opSchoolBody") },
    { Icon: Stethoscope,  title: t("opCareTitle"),     body: t("opCareBody") },
    { Icon: HeartPulse,   title: t("opSeniorTitle"),   body: t("opSeniorBody") },
    { Icon: PartyPopper,  title: t("opCateringTitle"), body: t("opCateringBody") },
    { Icon: Hotel,        title: t("opHotelTitle"),    body: t("opHotelBody") },
  ];
  const stats = [
    { value: t("opStat1"), label: t("opStat1Label") },
    { value: t("opStat2"), label: t("opStat2Label") },
    { value: t("opStat3"), label: t("opStat3Label") },
    { value: t("opStat4"), label: t("opStat4Label") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("opTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("opSub")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {segments.map(({ Icon, title, body }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-serif font-bold tracking-tight text-center">{t("opStatTitle")}</h2>
          <div className="mt-10 grid gap-6 grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-6 rounded-xl bg-background border border-border/60">
                <div className="text-2xl sm:text-3xl font-serif font-bold text-primary">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" asChild><Link href="/demo">{t("ctaDemo")}</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/contact">{t("ctaTalk")}</Link></Button>
        </div>
      </section>
    </>
  );
}

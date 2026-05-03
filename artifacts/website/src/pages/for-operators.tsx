import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, GraduationCap, Heart, PartyPopper } from "lucide-react";

export default function ForOperators() {
  const { t } = useI18n();
  const segments = [
    { Icon: Building2, title: t("opCanteenTitle"), body: t("opCanteenBody") },
    { Icon: GraduationCap, title: t("opSchoolTitle"), body: t("opSchoolBody") },
    { Icon: Heart, title: t("opCareTitle"), body: t("opCareBody") },
    { Icon: PartyPopper, title: t("opCateringTitle"), body: t("opCateringBody") },
  ];
  const stats = [t("opStat1"), t("opStat2"), t("opStat3"), t("opStat4")];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("opTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("opSub")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
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
              <div key={s} className="text-center p-6 rounded-xl bg-background border border-border/60">
                <div className="text-2xl sm:text-3xl font-serif font-bold text-primary">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/demo"><Button size="lg">{t("ctaDemo")}</Button></Link>
          <Link href="/contact"><Button size="lg" variant="outline">{t("ctaTalk")}</Button></Link>
        </div>
      </section>
    </>
  );
}

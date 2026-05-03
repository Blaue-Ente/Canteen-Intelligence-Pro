import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Clock, Users, BookOpen, Camera, ShieldCheck, Smartphone, Building2 } from "lucide-react";

export default function Features() {
  const { t } = useI18n();
  const items = [
    { Icon: QrCode, title: t("f1Title"), body: t("f1Body") },
    { Icon: Clock, title: t("f2Title"), body: t("f2Body") },
    { Icon: Users, title: t("f3Title"), body: t("f3Body") },
    { Icon: BookOpen, title: t("f4Title"), body: t("f4Body") },
    { Icon: Camera, title: t("f5Title"), body: t("f5Body") },
    { Icon: ShieldCheck, title: t("f6Title"), body: t("f6Body") },
    { Icon: Smartphone, title: t("f7Title"), body: t("f7Body") },
    { Icon: Building2, title: t("f8Title"), body: t("f8Body") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("featuresTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("featuresSub")}</p>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
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

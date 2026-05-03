import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Wrench, Zap } from "lucide-react";

export default function About() {
  const { t } = useI18n();
  const values = [
    { Icon: Heart, title: t("v1Title"), body: t("v1Body") },
    { Icon: Wrench, title: t("v2Title"), body: t("v2Body") },
    { Icon: Zap, title: t("v3Title"), body: t("v3Body") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("aboutTitle")}</h1>
          <p className="mt-5 text-xl text-muted-foreground italic">{t("aboutLead")}</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 prose prose-neutral dark:prose-invert">
        <p className="text-lg leading-relaxed text-foreground/90">{t("aboutP1")}</p>
        <p className="text-lg leading-relaxed text-foreground/90 mt-6">{t("aboutP2")}</p>
        <p className="text-lg leading-relaxed text-foreground/90 mt-6">{t("aboutP3")}</p>
      </section>

      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-serif font-bold tracking-tight text-center">{t("valuesTitle")}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {values.map(({ Icon, title, body }) => (
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
    </>
  );
}

import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Award, FileText, ShieldCheck, Receipt,
  Leaf, Lock, GraduationCap, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Std {
  Icon: LucideIcon;
  tag: string;
  title: string;
  body: string;
}

export default function Standards() {
  const { t } = useI18n();
  const stds: Std[] = [
    { Icon: Award,         tag: t("std1Tag"), title: t("std1Title"), body: t("std1Body") },
    { Icon: FileText,      tag: t("std2Tag"), title: t("std2Title"), body: t("std2Body") },
    { Icon: ShieldCheck,   tag: t("std3Tag"), title: t("std3Title"), body: t("std3Body") },
    { Icon: Receipt,       tag: t("std4Tag"), title: t("std4Title"), body: t("std4Body") },
    { Icon: Leaf,          tag: t("std5Tag"), title: t("std5Title"), body: t("std5Body") },
    { Icon: Lock,          tag: t("std6Tag"), title: t("std6Title"), body: t("std6Body") },
    { Icon: GraduationCap, tag: t("std7Tag"), title: t("std7Title"), body: t("std7Body") },
    { Icon: BarChart3,     tag: t("std8Tag"), title: t("std8Title"), body: t("std8Body") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("standardsTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("standardsSub")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {stds.map(({ Icon, tag, title, body }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-6 flex gap-5">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                  <h3 className="font-semibold text-lg mt-2 mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/20 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Button size="lg" asChild><Link href="/demo">{t("ctaDemo")}</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/compare">{t("navCompare")}</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}

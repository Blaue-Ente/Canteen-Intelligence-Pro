import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Users, Download } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

export default function Downloads() {
  const { t } = useI18n();
  const items = [
    {
      Icon: Mail,
      title: t("dl1Title"),
      body: t("dl1Body"),
      href: `${BASE}downloads/sales-emails.pdf`,
      cta: t("dl1Cta"),
      file: "sales-emails.pdf",
    },
    {
      Icon: Users,
      title: t("dl2Title"),
      body: t("dl2Body"),
      href: `${BASE}downloads/lead-list.pdf`,
      cta: t("dl2Cta"),
      file: "lead-list.pdf",
    },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("downloadsTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("downloadsSub")}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((it) => (
            <Card key={it.file} className="border-border/60">
              <CardContent className="p-7 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <it.Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-xl">{it.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{it.body}</p>
                <Button className="w-full gap-2" size="lg" asChild>
                  <a
                    href={it.href}
                    download={it.file}
                    aria-label={`${it.cta} — ${it.file}`}
                  >
                    <Download className="w-4 h-4" />
                    {it.cta}
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground text-center">{it.file} · PDF · A4</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
          {t("dlFootnote")}
        </p>
      </section>
    </>
  );
}

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function Contact() {
  const { t } = useI18n();
  const items = [
    { Icon: Mail, label: t("contactEmail"), value: "hello@kitchenos.de" },
    { Icon: Phone, label: t("contactPhone"), value: "+49 30 1234567" },
    { Icon: MapPin, label: t("contactAddress"), value: "Beispielstraße 1, 10115 Berlin" },
    { Icon: Clock, label: t("contactHours"), value: t("contactHoursVal") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("contactTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("contactSub")}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(({ Icon, label, value }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="font-medium mt-0.5">{value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-serif font-bold tracking-tight">{t("imprintTitle")}</h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{t("imprintBody")}</p>
        </div>
      </section>
    </>
  );
}

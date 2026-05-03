import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

export default function Pricing() {
  const { t } = useI18n();
  const featsBase = [t("feat1"), t("feat2"), t("feat3"), t("feat4")];
  const featsPro = [...featsBase, t("feat5")];
  const featsEnt = [...featsPro, t("feat6"), t("feat7"), t("feat8")];
  const tiers = [
    { name: t("planStarter"), price: t("planStarterPrice"), desc: t("planStarterDesc"), feats: featsBase, highlight: false },
    { name: t("planPro"), price: t("planProPrice"), desc: t("planProDesc"), feats: featsPro, highlight: true },
    { name: t("planEnterprise"), price: t("planEnterprisePrice"), desc: t("planEnterpriseDesc"), feats: featsEnt, highlight: false },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("pricingTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("pricingSub")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card key={tier.name} className={`border-border/60 relative ${tier.highlight ? "border-primary shadow-lg shadow-primary/10 lg:scale-[1.02]" : ""}`}>
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  ★
                </div>
              )}
              <CardContent className="p-6 sm:p-8">
                <h3 className="font-semibold text-xl">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-serif font-bold">{tier.price}</span>
                  {tier.price.startsWith("€") && <span className="text-muted-foreground text-sm">{t("planMonth")}</span>}
                </div>
                <Link href="/demo">
                  <Button className="mt-6 w-full" variant={tier.highlight ? "default" : "outline"}>
                    {t("pickPlan")}
                  </Button>
                </Link>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {tier.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

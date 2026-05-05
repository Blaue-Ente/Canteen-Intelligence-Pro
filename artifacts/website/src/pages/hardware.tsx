import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Minus, Tablet, Shield, Cloud, Briefcase, Droplets, Coins, BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";

type Score = "best" | "good" | "ok";

interface Row {
  feature: string;
  detail: string;
  ipad: { score: Score; note: string };
  android: { score: Score; note: string };
}

function ScoreCell({ score, note, label }: { score: Score; note: string; label: { best: string; good: string; ok: string } }) {
  const cls =
    score === "best" ? "bg-primary/10 text-primary"
      : score === "good" ? "bg-muted text-foreground"
      : "bg-muted/50 text-muted-foreground";
  const Icon = score === "best" ? Check : score === "good" ? Check : Minus;
  const ariaLabel = score === "best" ? label.best : score === "good" ? label.good : label.ok;
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${cls}`}
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
      <span className="text-sm text-muted-foreground">{note}</span>
    </div>
  );
}

export default function Hardware() {
  const { t } = useI18n();
  const scoreLabels = { best: t("hwScoreBest"), good: t("hwScoreGood"), ok: t("hwScoreOk") };

  // Each row: feature label + which device wins. "best" = clear winner,
  // "good" = solid, "ok" = workable but not ideal. We are deliberately
  // honest about trade-offs — an unbalanced comparison loses customer trust.
  const rows: Row[] = [
    {
      feature: t("hwRowDurability"),
      detail: t("hwRowDurabilityDetail"),
      ipad: { score: "ok", note: t("hwIpadDurability") },
      android: { score: "best", note: t("hwAndroidDurability") },
    },
    {
      feature: t("hwRowPrice"),
      detail: t("hwRowPriceDetail"),
      ipad: { score: "ok", note: t("hwIpadPrice") },
      android: { score: "best", note: t("hwAndroidPrice") },
    },
    {
      feature: t("hwRowMdm"),
      detail: t("hwRowMdmDetail"),
      ipad: { score: "best", note: t("hwIpadMdm") },
      android: { score: "good", note: t("hwAndroidMdm") },
    },
    {
      feature: t("hwRowPwa"),
      detail: t("hwRowPwaDetail"),
      ipad: { score: "good", note: t("hwIpadPwa") },
      android: { score: "best", note: t("hwAndroidPwa") },
    },
    {
      feature: t("hwRowVoice"),
      detail: t("hwRowVoiceDetail"),
      ipad: { score: "good", note: t("hwIpadVoice") },
      android: { score: "best", note: t("hwAndroidVoice") },
    },
    {
      feature: t("hwRowDisplay"),
      detail: t("hwRowDisplayDetail"),
      ipad: { score: "best", note: t("hwIpadDisplay") },
      android: { score: "good", note: t("hwAndroidDisplay") },
    },
    {
      feature: t("hwRowBattery"),
      detail: t("hwRowBatteryDetail"),
      ipad: { score: "good", note: t("hwIpadBattery") },
      android: { score: "best", note: t("hwAndroidBattery") },
    },
    {
      feature: t("hwRowService"),
      detail: t("hwRowServiceDetail"),
      ipad: { score: "best", note: t("hwIpadService") },
      android: { score: "good", note: t("hwAndroidService") },
    },
    {
      feature: t("hwRowImage"),
      detail: t("hwRowImageDetail"),
      ipad: { score: "best", note: t("hwIpadImage") },
      android: { score: "ok", note: t("hwAndroidImage") },
    },
    {
      feature: t("hwRowProcurement"),
      detail: t("hwRowProcurementDetail"),
      ipad: { score: "good", note: t("hwIpadProcurement") },
      android: { score: "best", note: t("hwAndroidProcurement") },
    },
  ];

  // Recommendation cards — bias customers toward the right choice for their
  // segment. Honest "if X then Y" guidance is more trustworthy than a hard sell.
  const recs: Array<{ Icon: typeof Briefcase; title: string; body: string; pick: string }> = [
    { Icon: Droplets,   title: t("hwRec1Title"), body: t("hwRec1Body"), pick: t("hwPickAndroid") },
    { Icon: Coins,      title: t("hwRec2Title"), body: t("hwRec2Body"), pick: t("hwPickAndroid") },
    { Icon: Briefcase,  title: t("hwRec3Title"), body: t("hwRec3Body"), pick: t("hwPickIpad") },
    { Icon: BadgeCheck, title: t("hwRec4Title"), body: t("hwRec4Body"), pick: t("hwPickIpad") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("hwTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("hwSub")}</p>
          <p className="mt-3 text-sm text-muted-foreground italic max-w-2xl mx-auto">{t("hwTagline")}</p>
        </div>
      </section>

      {/* Cloud-first guarantee — the most important architectural promise.
          Customers must understand that the device is interchangeable
          because all data lives in the EU cloud, not on the tablet. */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 mb-12">
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-6 sm:p-8 grid gap-6 sm:grid-cols-[auto_1fr] items-start">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Cloud className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{t("hwCloudTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("hwCloudBody")}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t("hwCloudPoint1")}</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t("hwCloudPoint2")}</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t("hwCloudPoint3")}</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t("hwCloudPoint4")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Two-column device summary cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-12">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-foreground/5 text-foreground">
                  <Tablet className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-lg">{t("hwIpadHead")}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("hwIpadIntro")}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelDevice")}</div>
                  <div className="font-medium mt-1">{t("hwIpadDevice")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelMdm")}</div>
                  <div className="font-medium mt-1">{t("hwIpadMdmName")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelHwCost")}</div>
                  <div className="font-medium mt-1">{t("hwIpadCost")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelMonthly")}</div>
                  <div className="font-medium mt-1">{t("hwIpadMonthly")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/40 bg-primary/[0.02]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <Shield className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-lg">{t("hwAndroidHead")}</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{t("hwRecBadge")}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("hwAndroidIntro")}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelDevice")}</div>
                  <div className="font-medium mt-1">{t("hwAndroidDevice")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelMdm")}</div>
                  <div className="font-medium mt-1">{t("hwAndroidMdmName")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelHwCost")}</div>
                  <div className="font-medium mt-1">{t("hwAndroidCost")}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-muted-foreground">{t("hwLabelMonthly")}</div>
                  <div className="font-medium mt-1">{t("hwAndroidMonthly")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Detailed feature comparison table */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-16">
        <h2 className="text-2xl font-semibold mb-6">{t("hwTableTitle")}</h2>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-4 font-semibold w-1/4">{t("hwColCriterion")}</th>
                <th className="p-4 font-semibold w-[37.5%]">{t("hwColIpad")}</th>
                <th className="p-4 font-semibold w-[37.5%] bg-primary/[0.04]">{t("hwColAndroid")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="p-4 align-top">
                    <div className="font-medium">{row.feature}</div>
                    <div className="text-xs text-muted-foreground mt-1">{row.detail}</div>
                  </td>
                  <td className="p-4 align-top"><ScoreCell score={row.ipad.score} note={row.ipad.note} label={scoreLabels} /></td>
                  <td className="p-4 align-top bg-primary/[0.02]"><ScoreCell score={row.android.score} note={row.android.note} label={scoreLabels} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("hwTableLegend")}</p>
      </section>

      {/* Recommendation cards: when to pick which */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-16">
        <h2 className="text-2xl font-semibold mb-6">{t("hwRecTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {recs.map(({ Icon, title, body, pick }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary">
                      <Check className="w-3.5 h-3.5" />
                      {pick}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("hwCtaTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("hwCtaBody")}</p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button size="lg" asChild>
              <Link href="/demo">{t("ctaDemo")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">{t("ctaTalk")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

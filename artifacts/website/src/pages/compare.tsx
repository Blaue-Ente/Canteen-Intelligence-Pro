import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Minus, X } from "lucide-react";
import type { ReactNode } from "react";

type Mark = "yes" | "no" | "limited";

interface Row {
  feature: string;
  cells: [Mark, Mark, Mark, Mark, Mark]; // KItchenOS, Apicbase, Foodics, MarketMan, Choco
}

function MarkCell({ mark, label }: { mark: Mark; label: string }) {
  let content: ReactNode;
  let cls: string;
  if (mark === "yes") {
    content = <Check className="w-4 h-4" aria-hidden="true" />;
    cls = "bg-primary/10 text-primary";
  } else if (mark === "limited") {
    content = <Minus className="w-4 h-4" aria-hidden="true" />;
    cls = "bg-muted text-muted-foreground";
  } else {
    content = <X className="w-4 h-4" aria-hidden="true" />;
    cls = "bg-destructive/10 text-destructive";
  }
  return (
    <div className="flex justify-center">
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${cls}`}
        aria-label={label}
        title={label}
      >
        {content}
      </span>
    </div>
  );
}

export default function Compare() {
  const { t } = useI18n();
  const rowCells: Array<Row["cells"]> = [
    ["yes", "no",      "no",      "no",      "no"],       // 1 DGE-Score
    ["yes", "limited", "no",      "no",      "no"],       // 2 LMIV
    ["yes", "limited", "no",      "no",      "no"],       // 3 HACCP
    ["yes", "no",      "no",      "no",      "no"],       // 4 TSE
    ["yes", "no",      "no",      "no",      "no"],       // 5 DSFinV-K
    ["yes", "no",      "no",      "no",      "no"],       // 6 Voice
    ["yes", "limited", "no",      "no",      "no"],       // 7 BIO
    ["yes", "no",      "no",      "no",      "no"],       // 8 Diät
    ["yes", "no",      "no",      "no",      "no"],       // 9 Tablett-Foto
    ["yes", "no",      "no",      "no",      "no"],       // 10 BuT
    ["yes", "no",      "limited", "no",      "no"],       // 11 Vorbestellung
    ["yes", "yes",     "yes",     "yes",     "yes"],      // 12 Lieferanten
    ["yes", "limited", "no",      "limited", "no"],       // 13 Forecast
    ["yes", "yes",     "limited", "no",      "no"],       // 14 Rezeptbuch
    ["yes", "no",      "no",      "no",      "no"],       // 15 Catering-CRM
    ["yes", "yes",     "yes",     "yes",     "limited"],  // 16 Multi-Standort
    ["yes", "yes",     "no",      "no",      "yes"],      // 17 DSGVO
  ];
  const rows: Row[] = rowCells.map((cells, i) => ({
    feature: t(`compareRow${i + 1}` as Parameters<typeof t>[0]),
    cells,
  }));

  const summaries = [
    { title: t("compareSummary1Title"), body: t("compareSummary1Body") },
    { title: t("compareSummary2Title"), body: t("compareSummary2Body") },
    { title: t("compareSummary3Title"), body: t("compareSummary3Body") },
    { title: t("compareSummary4Title"), body: t("compareSummary4Body") },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("compareTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("compareSub")}</p>
          <p className="mt-3 text-sm text-muted-foreground italic max-w-2xl mx-auto">{t("compareWhy")}</p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th scope="col" className="py-4 pl-5 pr-3 font-semibold w-[40%]">
                  {t("compareCol1")}
                </th>
                <th scope="col" className="py-4 px-3 text-center text-primary font-semibold whitespace-nowrap">
                  {t("compareCol2")}
                </th>
                <th scope="col" className="py-4 px-3 text-center font-medium whitespace-nowrap">{t("compareCol3")}</th>
                <th scope="col" className="py-4 px-3 text-center font-medium whitespace-nowrap">{t("compareCol4")}</th>
                <th scope="col" className="py-4 px-3 text-center font-medium whitespace-nowrap">{t("compareCol5")}</th>
                <th scope="col" className="py-4 pl-3 pr-5 text-center font-medium whitespace-nowrap">{t("compareCol6")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t border-border/40">
                  <th scope="row" className="py-3 pl-5 pr-3 text-left font-medium align-middle">
                    {r.feature}
                  </th>
                  {r.cells.map((m, i) => (
                    <td
                      key={i}
                      className={`py-3 px-3 align-middle ${
                        i === 0 ? "bg-primary/[0.04]" : ""
                      }`}
                    >
                      <MarkCell
                        mark={m}
                        label={
                          m === "yes" ? t("compareYes") :
                          m === "limited" ? t("compareLimited") :
                          t("compareNo")
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-center">
          {t("compareLegend")} {t("compareLegendNote")}
        </p>
      </section>

      {/* Summary cards */}
      <section className="bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-center mb-10">
            {t("compareSummaryTitle")}
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {summaries.map((s, i) => (
              <Card
                key={s.title}
                className={`border-border/60 ${i === 0 ? "border-primary/60 shadow-md shadow-primary/5" : ""}`}
              >
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold">{t("finalCtaTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("finalCtaSub")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/demo">{t("ctaDemo")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/contact">{t("ctaTalk")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

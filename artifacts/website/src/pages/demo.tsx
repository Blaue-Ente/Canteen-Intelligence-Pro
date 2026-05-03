import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

export default function Demo() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [size, setSize] = useState<string>("");

  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{t("demoTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("demoSub")}</p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <Card className="border-border/60">
          <CardContent className="p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
                <p className="text-xl font-medium">{t("demoThanks")}</p>
              </div>
            ) : (
              <form
                className="grid gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("demoNameLabel")}</Label>
                  <Input id="name" placeholder={t("demoNamePh")} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">{t("demoCompanyLabel")}</Label>
                  <Input id="company" placeholder={t("demoCompanyPh")} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("demoEmailLabel")}</Label>
                  <Input id="email" type="email" placeholder={t("demoEmailPh")} required />
                </div>
                <div className="grid gap-2">
                  <Label>{t("demoSizeLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[t("demoSizeOpt1"), t("demoSizeOpt2"), t("demoSizeOpt3")].map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setSize(opt)}
                        className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                          size === opt
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="msg">{t("demoMsgLabel")}</Label>
                  <Textarea id="msg" placeholder={t("demoMsgPh")} rows={4} />
                </div>
                <Button size="lg" type="submit">{t("demoSubmit")}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

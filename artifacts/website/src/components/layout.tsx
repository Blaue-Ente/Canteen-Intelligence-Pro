import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChefHat, Menu as MenuIcon, X } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);

  const nav: Array<[string, string]> = [
    ["/features", t("navFeatures")],
    ["/for-operators", t("navOperators")],
    ["/compare", t("navCompare")],
    ["/standards", t("navStandards")],
    ["/pricing", t("navPricing")],
    ["/about", t("navAbout")],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="w-4 h-4" />
            </span>
            <span>{t("brand")}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map(([href, label]) => {
              const active = href === "/" ? loc === "/" : loc.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "de" ? "en" : "de")}
              aria-label="Switch language"
              className="font-mono text-xs"
            >
              {t("langSwitch")}
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/demo">{t("ctaDemo")}</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border/60 bg-background">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {nav.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm rounded-md hover:bg-muted"
                >
                  {label}
                </Link>
              ))}
              <Button size="sm" className="w-full mt-2" asChild>
                <Link href="/demo" onClick={() => setOpen(false)}>{t("ctaDemo")}</Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground">
                <ChefHat className="w-3.5 h-3.5" />
              </span>
              {t("brand")}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("tagline")}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("navFeatures")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground">{t("navFeatures")}</Link></li>
              <li><Link href="/compare" className="hover:text-foreground">{t("navCompare")}</Link></li>
              <li><Link href="/standards" className="hover:text-foreground">{t("navStandards")}</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">{t("navPricing")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("brand")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/for-operators" className="hover:text-foreground">{t("navOperators")}</Link></li>
              <li><Link href="/about" className="hover:text-foreground">{t("navAbout")}</Link></li>
              <li><Link href="/downloads" className="hover:text-foreground">{t("navDownloads")}</Link></li>
              <li><Link href="/demo" className="hover:text-foreground">{t("navDemo")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("contactTitleFooter")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>hello@kitchenos.de</li>
              <li>+49 30 1234567</li>
              <li><Link href="/contact#imprint" className="hover:text-foreground">{t("footerImprint")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
          {t("footerRights")}
        </div>
      </footer>
    </div>
  );
}

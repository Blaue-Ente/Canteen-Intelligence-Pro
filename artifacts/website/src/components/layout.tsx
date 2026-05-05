import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChefHat, Menu as MenuIcon, X, ChevronDown, ExternalLink, ShoppingBag, Smartphone } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);

  const nav: Array<[string, string]> = [
    ["/features", t("navFeatures")],
    ["/for-operators", t("navOperators")],
    ["/compare", t("navCompare")],
    ["/standards", t("navStandards")],
    ["/hardware", t("navHardware")],
    ["/pricing", t("navPricing")],
    ["/about", t("navAbout")],
  ];

  // External app entry-points. Both live on the same Replit deployment but
  // open in a new window so the marketing context isn't lost. Once each
  // artifact is published to its own custom domain, swap these for absolute
  // URLs (e.g. https://app.kitchenos.de) — the rest of the layout stays.
  const appLinks: Array<{ href: string; label: string; desc: string; Icon: typeof ShoppingBag }> = [
    { href: "/preorder/", label: t("navAppPreorder"), desc: t("navAppPreorderDesc"), Icon: ShoppingBag },
    { href: "/", label: t("navAppDemo"), desc: t("navAppDemoDesc"), Icon: Smartphone },
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
            {/* "App / Portal" dropdown — lives at the end of the nav so it's
                visually separated from the marketing pages. Each item opens
                its target artifact in a new browser tab. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {t("navApp")}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {t("navAppNote")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {appLinks.map(({ href, label, desc, Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          {label}
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {desc}
                        </span>
                      </span>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
              {/* Mobile equivalent of the App dropdown — same target=_blank
                  behaviour so guests can switch into the app without losing
                  the marketing site in their tab history. */}
              <div className="mt-2 pt-2 border-t border-border/60">
                <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {t("navApp")} · {t("navAppNote")}
                </div>
                {appLinks.map(({ href, label, desc, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted"
                  >
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        {label}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {desc}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
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
              <li>
                <a
                  href="/preorder/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {t("navAppPreorder")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {t("navAppDemo")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>hello@kitchenos.de</li>
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

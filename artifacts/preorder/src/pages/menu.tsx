import { useState, useMemo } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import {
  useGetPublishedMenu,
  useGetCustomerProfile,
  useListAnnouncements,
  useListPublicWeeklyMenus,
  WeeklyMenu,
  WeeklyMenuDish,
} from "@workspace/api-client-react";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  Plus, Minus, ChevronRight, AlertCircle, Star, Leaf, Flame,
  LogIn, Lock, Clock4, Bell, Paperclip, CalendarDays, ChevronLeft,
} from "lucide-react";
import { AuthNav } from "@/components/auth-nav";

// ─── KW helpers ───────────────────────────────────────────────────────────────

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - startOfYear.getTime()) / 86400000) + 1) / 7);
  return { year, week };
}

function isoDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateDE(iso: string): string {
  const [y, m, day] = iso.split("-");
  return `${day}.${m}.${y}`;
}

function getDayName(iso: string): string {
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const d = new Date(iso + "T12:00:00");
  return days[d.getDay()] ?? "";
}

// Build list of available delivery dates: Mon–Fri of coming N weeks (from tomorrow)
function buildDeliveryDates(leadDays: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  const start = addDays(today, 1); // earliest: tomorrow
  const end = addDays(today, leadDays + 7); // up to leadDays + 1 week buffer
  let cur = new Date(start);
  while (cur <= end && dates.length < leadDays * 2) {
    const day = cur.getDay();
    if (day >= 1 && day <= 5) dates.push(isoDateStr(cur)); // Mon-Fri only
    cur = addDays(cur, 1);
  }
  return dates.slice(0, Math.max(leadDays, 5));
}

// Find dishes from weekly menus that match a given date
function getDishesForDate(menus: WeeklyMenu[], date: string): Array<WeeklyMenuDish & { menuSlot: string; currency: string }> {
  const result: Array<WeeklyMenuDish & { menuSlot: string; currency: string }> = [];
  for (const menu of menus) {
    for (const dish of menu.dishes) {
      if (dish.menuDate === date) {
        result.push({ ...dish, menuSlot: menu.menuSlot, currency: menu.currency });
      }
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Menu() {
  const [, params] = useRoute("/menu/:locationCode");
  const locationCode = params?.locationCode || "";
  const [, setLocation] = useLocation();

  // Legacy daily menu (fallback)
  const { data: legacyMenu, isLoading: legacyLoading } = useGetPublishedMenu(locationCode, {
    query: { enabled: !!locationCode, queryKey: [`/api/preorder/menu/${locationCode}`] },
  });

  // Weekly KW menus — origin-relative /api (never prefix with Vite BASE_PATH).
  const { data: weeklyMenus, isLoading: weeklyLoading } = useListPublicWeeklyMenus(locationCode, {
    query: { enabled: !!locationCode },
  });

  const { items, addItem, removeItem, total, count, clearCart } = useCart();
  const { isSignedIn } = useAuth();
  const { data: profile } = useGetCustomerProfile({
    query: { enabled: !!isSignedIn, queryKey: ["/api/preorder/customer/me"] },
  });
  const { data: announcements } = useListAnnouncements(locationCode, {
    query: { enabled: !!locationCode, queryKey: [`/api/preorder/announcements/${locationCode}`] },
  });

  const canOrder = profile?.accountType === "business_approved";
  const isPending = profile?.accountType === "business_pending";

  // Date selection — default to first available day
  const deliveryDates = useMemo(() => buildDeliveryDates(14), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => deliveryDates[0] ?? "");
  const [draftByDate, setDraftByDate] = useState<Record<string, Array<WeeklyMenuDish & { menuSlot: string; currency: string }>>>({});

  // Determine mode: weekly or legacy
  const hasWeeklyMenus = weeklyMenus && weeklyMenus.length > 0;
  const isLoading = weeklyLoading || (legacyLoading && !hasWeeklyMenus);

  // Dishes for selected date (weekly) or all dishes (legacy)
  const dishesForSelectedDate = useMemo(() => {
    if (!hasWeeklyMenus) return [];
    return draftByDate[selectedDate] ?? getDishesForDate(weeklyMenus, selectedDate);
  }, [draftByDate, weeklyMenus, selectedDate, hasWeeklyMenus]);
  const legacyDishes = legacyMenu?.dishes ?? [];
  const displayDishes = hasWeeklyMenus ? dishesForSelectedDate : legacyDishes;
  const locationName = legacyMenu?.locationName ?? locationCode;
  const currency = legacyMenu?.currency ?? weeklyMenus?.[0]?.currency ?? "EUR";

  // Group weekly dates by KW — must run before any early return (Rules of Hooks).
  const datesByWeek = useMemo(() => {
    const weeks: { kw: number; year: number; dates: string[] }[] = [];
    for (const d of deliveryDates) {
      const { year, week } = getISOWeek(new Date(d + "T12:00:00"));
      let bucket = weeks.find(w => w.kw === week && w.year === year);
      if (!bucket) { bucket = { kw: week, year, dates: [] }; weeks.push(bucket); }
      bucket.dates.push(d);
    }
    return weeks;
  }, [deliveryDates]);

  const [visibleWeekIdx, setVisibleWeekIdx] = useState(0);
  const visibleWeek = datesByWeek[visibleWeekIdx];

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Lade Speisekarte…</p>
        </div>
      </div>
    );
  }

  if (!legacyMenu && !hasWeeklyMenus) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl mb-2">Menü nicht gefunden</h2>
        <p className="text-muted-foreground mb-6">Kein Menü für: {locationCode}</p>
        <Button onClick={() => setLocation("/")}>Zurück</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-32 bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 pt-8">
        <div className="max-w-xl mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{locationCode}</p>
            <h1 className="text-2xl">{locationName}</h1>
            <p className="text-sm text-muted-foreground font-serif italic mt-1">Speisekarte / Menu</p>
          </div>
          <AuthNav />
        </div>

        {/* Business account status */}
        <SignedIn>
          {!canOrder && (
            <div className="max-w-xl mx-auto mt-3">
              {isPending ? (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <Clock4 className="w-4 h-4" />
                  <span>Geschäftskonto wird geprüft — Bestellungen sind bald freigeschaltet.</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-secondary">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Bestellungen erfordern ein Geschäftskonto.
                  </span>
                  <Link href="/profile">
                    <Button size="sm" variant="outline" className="h-7">Antrag stellen</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </SignedIn>
        <SignedOut>
          <div className="max-w-xl mx-auto mt-3 flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-secondary">
            <span className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Zum Bestellen anmelden — Bewerten geht auch ohne Konto.
            </span>
            <Link href="/sign-in">
              <Button size="sm" variant="outline" className="h-7">Anmelden</Button>
            </Link>
          </div>
        </SignedOut>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-6">

        {/* Date picker — only for weekly menus */}
        {hasWeeklyMenus && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="w-4 h-4 text-primary" />
                Liefertag wählen
                <span className="text-muted-foreground font-normal text-xs">/ Select delivery date</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVisibleWeekIdx(Math.max(0, visibleWeekIdx - 1))}
                  disabled={visibleWeekIdx === 0}
                  className="p-1 rounded-full hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground font-medium min-w-[60px] text-center">
                  KW {visibleWeek?.kw}
                </span>
                <button
                  onClick={() => setVisibleWeekIdx(Math.min(datesByWeek.length - 1, visibleWeekIdx + 1))}
                  disabled={visibleWeekIdx >= datesByWeek.length - 1}
                  className="p-1 rounded-full hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {visibleWeek?.dates.map((d) => {
                const active = d === selectedDate;
                const hasDishes = getDishesForDate(weeklyMenus, d).length > 0;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setDraftByDate((prev) => ({
                        ...prev,
                        [selectedDate]: dishesForSelectedDate,
                      }));
                      setSelectedDate(d);
                      clearCart();
                    }}
                    className={[
                      "flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow"
                        : hasDishes
                          ? "bg-card border-border hover:border-primary/50"
                          : "bg-muted border-border opacity-40 cursor-not-allowed",
                    ].join(" ")}
                    disabled={!hasDishes}
                  >
                    <span className="text-[10px] uppercase tracking-wide opacity-70">{getDayName(d)}</span>
                    <span>{formatDateDE(d)}</span>
                    {!hasDishes && <span className="text-[9px] opacity-50">—</span>}
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <p className="text-xs text-muted-foreground">
                Bestellschluss: <span className="font-medium">08:00 Uhr</span> am {formatDateDE(selectedDate)}
                {" · "}Korrekturen bis dahin möglich.
              </p>
            )}
          </div>
        )}

        {/* Dishes */}
        {displayDishes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {hasWeeklyMenus ? (
              <>
                <p>Kein Menü für diesen Tag.</p>
                <p className="text-sm mt-1">No dishes available for this date.</p>
              </>
            ) : (
              <>
                <p>Heute keine Gerichte verfügbar.</p>
                <p className="text-sm mt-1">No dishes available today.</p>
              </>
            )}
          </div>
        ) : (
          displayDishes.map((dish) => {
            const cartItem = items.find((i) => i.dishId === dish.id);
            const qty = cartItem?.qty || 0;

            return (
              <div key={dish.id} className="flex gap-4 p-4 bg-card rounded-2xl border border-border shadow-sm">
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      {"dishType" in dish && (
                        <p className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold mb-0.5">
                          {(dish as WeeklyMenuDish & { menuSlot: string }).menuSlot} · {dish.dishType}
                        </p>
                      )}
                      <h3 className="font-medium text-lg leading-tight">{dish.name}</h3>
                    </div>
                    <span className="font-medium text-primary shrink-0">{formatCurrency(dish.price, currency)}</span>
                  </div>

                  {"description" in dish && dish.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{dish.description}</p>
                  )}

                  {"allergens" in dish && dish.allergens && dish.allergens.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-2 truncate">
                      Allergene: {dish.allergens.join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {"kcal" in dish && dish.kcal != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        <Flame className="w-3 h-3" />{Math.round(dish.kcal as number)} kcal
                      </span>
                    )}
                    {"dge" in dish && dish.dge && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: dish.dge === "green" ? "#16a34a" : dish.dge === "amber" ? "#eab308" : "#dc2626" }}
                      >
                        <Leaf className="w-3 h-3" />DGE {dish.dge}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 flex items-center justify-end">
                    {canOrder ? (
                      qty > 0 ? (
                        <div className="flex items-center gap-3 bg-secondary rounded-full p-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => removeItem(dish.id)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-6 text-center font-medium">{qty}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => addItem(dish as Parameters<typeof addItem>[0], locationCode)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" className="rounded-full px-4 font-medium" onClick={() => addItem(dish as Parameters<typeof addItem>[0], locationCode)}>
                          Hinzufügen <span className="opacity-50 font-normal ml-1 text-xs">/ Add</span>
                        </Button>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="w-3 h-3" /> nur für Geschäftskunden
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Announcements */}
        {announcements && announcements.length > 0 && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="w-4 h-4 text-primary" />
              Ankündigungen <span className="opacity-50 font-normal text-xs">/ Announcements</span>
            </div>
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 bg-primary/5 border border-primary/15 rounded-2xl space-y-1.5">
                <p className="font-medium text-sm leading-snug">{ann.title}</p>
                {ann.body && <p className="text-xs text-muted-foreground leading-relaxed">{ann.body}</p>}
                {ann.hasFile && ann.fileName && (
                  <a
                    href={`/api/preorder/announcements/${locationCode}/${ann.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    <Paperclip className="w-3 h-3" />{ann.fileName}
                  </a>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(ann.publishedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl"
            onClick={() => setLocation(`/feedback/${locationCode}`)}
            data-testid="button-feedback"
          >
            <Star className="w-4 h-4 mr-2" />
            Bewertung abgeben <span className="opacity-50 font-normal ml-1 text-xs">/ Leave a review</span>
          </Button>
        </div>
      </main>

      {/* Cart bar */}
      {count > 0 && canOrder && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-20">
          <div className="max-w-xl mx-auto">
            <Button
              size="lg"
              className="w-full h-14 text-lg justify-between px-6 rounded-2xl shadow-lg"
              onClick={() => setLocation(`/checkout/${locationCode}${hasWeeklyMenus && selectedDate ? `?date=${selectedDate}` : ""}`)}
            >
              <div className="flex items-center gap-2">
                <span className="bg-primary-foreground/20 text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                  {count}
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span>Warenkorb</span>
                  {hasWeeklyMenus && selectedDate && (
                    <span className="text-[10px] font-normal opacity-80">{getDayName(selectedDate)} {formatDateDE(selectedDate)}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>{formatCurrency(total, currency)}</span>
                <ChevronRight className="w-5 h-5 opacity-70" />
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

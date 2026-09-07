import { useState, useMemo, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";
import {
  useGetPublishedMenu,
  useCreateGuestOrder,
  useGetCustomerProfile,
} from "@workspace/api-client-react";
import { useCart } from "@/hooks/use-cart";
import { useActiveOrder } from "@/hooks/use-active-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { ChevronLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

function defaultWantedFor(): string {
  // Today (Europe/Berlin) if before 08:00, otherwise tomorrow.
  const tz = "Europe/Berlin";
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
  );
  if (hour < 8) return fmt.format(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return fmt.format(tomorrow);
}

function CheckoutInner() {
  const [, params] = useRoute("/checkout/:locationCode");
  const locationCode = params?.locationCode || "";
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { data: menu } = useGetPublishedMenu(locationCode, { query: { enabled: !!locationCode, queryKey: [`/api/preorder/menu/${locationCode}`] } });
  const { data: profile, isLoading: profileLoading } = useGetCustomerProfile();

  const { items, total, clearCart } = useCart();
  const [, setActiveOrder] = useActiveOrder();

  const initialName = useMemo(
    () => [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
    [user],
  );
  const [guestName, setGuestName] = useState(initialName);
  const [guestNote, setGuestNote] = useState("");
  const dateFromQuery = new URLSearchParams(window.location.search).get("date");
  const [wantedFor, setWantedFor] = useState<string>(() => {
    if (dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) return dateFromQuery;
    return defaultWantedFor();
  });

  const createOrder = useCreateGuestOrder();

  useEffect(() => {
    if (items.length === 0 && !createOrder.isPending && !createOrder.isSuccess) {
      setLocation(`/menu/${locationCode}`);
    }
  }, [items.length, locationCode, setLocation, createOrder.isPending, createOrder.isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("Bitte geben Sie Ihren Namen ein / Please enter your name");
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        data: {
          locationCode,
          guestName: guestName.trim(),
          guestNote: guestNote.trim() || null,
          wantedFor,
          items: items.map(i => ({ dishId: i.dishId, name: i.name, qty: i.qty, price: i.price }))
        }
      });

      if (order.accessToken) {
        setActiveOrder({
          id: order.id,
          token: order.accessToken,
          locationCode
        });
        clearCart();
        setLocation(`/order/${order.id}?token=${order.accessToken}`);
      } else {
        toast.error("Kein Access Token erhalten / No access token received");
      }
    } catch (error) {
      const msg = (error as { info?: { error?: string } })?.info?.error;
      toast.error(msg || "Fehler bei der Bestellung / Error placing order");
      console.error(error);
    }
  };

  if (profileLoading || items.length === 0) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profile && profile.accountType !== "business_approved") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <Lock className="w-14 h-14 text-amber-500 mb-4" />
        <h2 className="text-2xl mb-2">Geschäftskonto erforderlich</h2>
        <p className="text-muted-foreground mb-1 max-w-sm">
          Vorbestellungen sind nur für freigeschaltete Geschäftskunden möglich.
        </p>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Pre-orders are limited to approved business accounts.
        </p>
        <div className="flex gap-3">
          <Link href="/profile">
            <Button>Status / Antrag</Button>
          </Link>
          <Button variant="outline" onClick={() => setLocation(`/menu/${locationCode}`)}>
            Zurück zur Karte
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col pb-safe">
      <header className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/menu/${locationCode}`)}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-xl">Bestellung prüfen</h1>
          <p className="text-xs text-muted-foreground font-serif italic">Review order</p>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-8">
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-medium text-lg">Ihre Auswahl <span className="text-sm font-normal text-muted-foreground ml-2">/ Your selection</span></h2>
          </div>
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.dishId} className="p-4 flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{item.qty}x</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                </div>
                <div className="font-medium text-right shrink-0">
                  {formatCurrency(item.price * item.qty, menu?.currency)}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-muted/10 flex justify-between items-center text-lg font-bold">
            <span>Gesamt <span className="text-sm font-normal text-muted-foreground ml-2">/ Total</span></span>
            <span className="text-primary">{formatCurrency(total, menu?.currency)}</span>
          </div>
        </section>

        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 bg-card p-6 rounded-2xl border border-border">
            <div className="space-y-2">
              <Label htmlFor="guestName" className="text-base">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Für den Aufruf / For calling out"
                required
                className="text-lg py-6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wantedFor" className="text-base">
                Für welchen Tag? <span className="text-sm font-normal text-muted-foreground">/ For which day?</span>
              </Label>
              <Input
                id="wantedFor"
                type="date"
                value={wantedFor}
                onChange={(e) => setWantedFor(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="text-lg py-6"
              />
              <p className="text-xs text-muted-foreground">
                Änderungen sind nur bis 08:00 (Europe/Berlin) am gewählten Tag möglich.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestNote" className="text-base flex justify-between">
                <span>Anmerkung <span className="text-sm font-normal text-muted-foreground ml-1">/ Note</span></span>
                <span className="text-sm text-muted-foreground font-normal">Optional</span>
              </Label>
              <Textarea 
                id="guestNote"
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
                placeholder="z.B. ohne Zwiebeln / e.g. no onions"
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
        </form>
      </main>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-20">
        <div className="max-w-xl mx-auto">
          <Button 
            type="submit"
            form="checkout-form"
            size="lg" 
            className="w-full h-14 text-lg rounded-2xl shadow-lg"
            disabled={createOrder.isPending || !guestName.trim()}
          >
            {createOrder.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <div className="flex items-center justify-between w-full px-2">
                <span className="flex flex-col items-start leading-tight">
                  <span>Kostenpflichtig bestellen</span>
                  <span className="text-[10px] font-normal opacity-80 uppercase tracking-widest">Place order</span>
                </span>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(total, menu?.currency)}</span>
                  <ArrowRight className="w-5 h-5 opacity-70" />
                </div>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <CheckoutInner />
      </SignedIn>
    </>
  );
}

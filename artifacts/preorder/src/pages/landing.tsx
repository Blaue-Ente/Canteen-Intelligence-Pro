import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useGetCustomerProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrder } from "@/hooks/use-active-order";
import { AuthNav } from "@/components/auth-nav";
import { ListOrdered, ArrowRight, Loader2 } from "lucide-react";

function SmartRedirect({ locationCode, setLocation }: { locationCode: string; setLocation: (p: string) => void }) {
  const { data: profile, isLoading } = useGetCustomerProfile();

  useEffect(() => {
    if (!isLoading && profile?.homeLocationCode && !locationCode) {
      setLocation(`/menu/${profile.homeLocationCode}`);
    }
  }, [isLoading, profile, locationCode, setLocation]);

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Profil wird geladen…</span>
      </div>
    );
  }

  if (profile && profile.accountType === "business_approved" && profile.homeLocationCode) {
    return (
      <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
        <p className="text-xs text-muted-foreground mb-1">Ihre Stamm-Kantine / Your canteen</p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-foreground">{profile.homeLocationCode}</p>
          <Button
            size="sm"
            onClick={() => setLocation(`/menu/${profile.homeLocationCode}`)}
            className="gap-1"
          >
            Zur Karte <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (profile && profile.accountType !== "business_approved") {
    const statusLabel =
      profile.accountType === "business_pending"
        ? "Antrag in Prüfung — warten auf Freigabe"
        : profile.accountType === "regular"
          ? "Standardkonto — Geschäftskonto beantragen für Vorbestellungen"
          : "Antrag abgelehnt — bitte Kantinenteam kontaktieren";
    return (
      <div className="mb-6 p-4 bg-muted border border-border rounded-xl">
        <p className="text-xs text-muted-foreground">{statusLabel}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => setLocation("/profile")}
        >
          Zum Profil
        </Button>
      </div>
    );
  }

  return null;
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [activeOrder] = useActiveOrder();
  const [locationCode, setLocationCode] = useState("");
  const { isLoaded } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loc = params.get("loc");
    if (loc) {
      setLocation(`/menu/${loc}`);
    }
  }, [setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationCode.trim()) {
      setLocation(`/menu/${locationCode.trim()}`);
    }
  };

  const handleResumeOrder = () => {
    if (activeOrder) {
      setLocation(`/order/${activeOrder.id}?token=${activeOrder.token}`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden">
            <img src="/hero-canteen.png" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-sm text-foreground">KitchenOS</span>
        </div>
        {isLoaded && <AuthNav />}
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-10">
        <div className="mb-8 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full mx-auto flex items-center justify-center mb-5">
            <img
              src="/hero-canteen.png"
              alt="Fresh Canteen Food"
              className="w-full h-full object-cover rounded-full shadow-md border-4 border-white"
            />
          </div>
          <h1 className="text-3xl mb-2 text-foreground">
            Willkommen
            <br />
            <span className="text-xl text-muted-foreground font-sans font-normal">Welcome</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Scannen Sie den QR-Code in Ihrer Kantine oder geben Sie den Code hier ein.
            <br />
            <span className="text-xs opacity-70">
              Scan the QR code at your canteen or enter the code here.
            </span>
          </p>
        </div>

        {activeOrder && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
            <p className="font-medium text-primary mb-1">Sie haben eine aktive Bestellung</p>
            <p className="text-sm text-primary/80 mb-3">You have an active order</p>
            <Button onClick={handleResumeOrder} className="w-full" variant="default">
              Bestellung ansehen / View Order
            </Button>
          </div>
        )}

        <SignedIn>
          <SmartRedirect locationCode={locationCode} setLocation={setLocation} />
          <div className="mb-4">
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => setLocation("/my-orders")}
            >
              <ListOrdered className="w-4 h-4 text-primary" />
              <span>Meine Bestellungen</span>
              <span className="text-xs text-muted-foreground ml-auto">/ My orders</span>
            </Button>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="mb-6 p-4 bg-muted/50 border border-border rounded-xl text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Mit einem Konto können Sie Vorbestellungen aufgeben und Ihre Bestellhistorie einsehen.
            </p>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setLocation("/sign-in")}
              >
                Anmelden
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLocation("/sign-up")}
              >
                Registrieren
              </Button>
            </div>
          </div>
        </SignedOut>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="locationCode" className="text-base">
              Kantinencode / Canteen Code
            </Label>
            <Input
              id="locationCode"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
              placeholder="z.B. BER-1"
              className="text-lg py-6"
            />
          </div>
          <Button
            type="submit"
            className="w-full text-lg py-6"
            disabled={!locationCode.trim()}
          >
            Speisekarte ansehen
            <span className="ml-2 opacity-70 text-sm font-normal">/ View Menu</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

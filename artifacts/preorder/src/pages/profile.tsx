import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import {
  useGetCustomerProfile,
  useUpsertCustomerProfile,
  useRedeemRefCode,
  type CustomerProfile,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, ShieldCheck, Clock4, ShieldX, Key } from "lucide-react";
import { toast } from "sonner";
import { AuthNav } from "@/components/auth-nav";

function StatusBadge({ accountType }: { accountType: CustomerProfile["accountType"] }) {
  switch (accountType) {
    case "business_approved":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
          <ShieldCheck className="w-3 h-3" /> Business — freigeschaltet
        </span>
      );
    case "business_pending":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <Clock4 className="w-3 h-3" /> Antrag in Prüfung
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="w-3 h-3" /> Abgelehnt
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
          Standard-Konto
        </span>
      );
  }
}

function ProfileForm() {
  const { data: profile, isLoading, refetch } = useGetCustomerProfile();
  const upsert = useUpsertCustomerProfile();
  const redeemMutation = useRedeemRefCode();
  const [displayName, setDisplayName] = useState("");
  const [homeLocationCode, setHomeLocationCode] = useState("");
  const [refCode, setRefCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setHomeLocationCode(profile.homeLocationCode ?? "");
    }
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = async (requestBusiness: boolean) => {
    try {
      await upsert.mutateAsync({
        data: {
          displayName: displayName.trim() || profile.displayName,
          homeLocationCode: homeLocationCode.trim() || null,
          email: profile.email,
          requestBusiness,
        },
      });
      toast.success(
        requestBusiness ? "Antrag gestellt — wartet auf Freigabe." : "Profil gespeichert.",
      );
      await refetch();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern.");
    }
  };

  const handleRedeemCode = async () => {
    if (!refCode.trim()) {
      toast.error("Bitte einen Referenzcode eingeben.");
      return;
    }
    try {
      await redeemMutation.mutateAsync({ data: { code: refCode.trim().toUpperCase() } });
      toast.success("Referenzcode eingelöst — Business-Zugang freigeschaltet!");
      setRefCode("");
      setShowCodeInput(false);
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Einlösen.";
      toast.error(msg.includes("eingelöst") ? msg : "Ungültiger oder bereits genutzter Code.");
    }
  };

  const canRequest = profile.accountType === "regular" || profile.accountType === "rejected";
  const isBusiness = profile.accountType === "business_approved";

  return (
    <section className="bg-card rounded-2xl border border-border p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Mein Profil</h2>
          <p className="text-xs text-muted-foreground font-serif italic">My profile</p>
        </div>
        <StatusBadge accountType={profile.accountType} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Anzeigename / Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Max Mustermann"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="homeLocationCode">Stamm-Kantine / Home canteen code</Label>
        <Input
          id="homeLocationCode"
          value={homeLocationCode}
          onChange={(e) => setHomeLocationCode(e.target.value.toUpperCase())}
          placeholder="DEMO"
        />
        <p className="text-xs text-muted-foreground">
          Optional — zur schnelleren Anzeige Ihrer Standard-Kantine.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={() => handleSave(false)}
          disabled={upsert.isPending}
          className="flex-1"
        >
          {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern / Save"}
        </Button>
        {canRequest && (
          <Button
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={upsert.isPending}
            className="flex-1"
          >
            Geschäftskonto beantragen
          </Button>
        )}
      </div>

      {/* Reference code redemption — show for non-approved accounts */}
      {!isBusiness && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Referenzcode einlösen</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sie haben einen Referenzcode von Ihrer Kantine erhalten? Hier einlösen und sofort Business-Zugang erhalten — ohne Wartezeit.
            <br />
            <span className="opacity-70 italic">Have a reference code from your canteen? Redeem it here for instant business access.</span>
          </p>
          {showCodeInput ? (
            <div className="space-y-2">
              <Input
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                placeholder="z.B. AB12CD34"
                maxLength={12}
                className="font-mono tracking-widest text-center text-lg"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleRedeemCode}
                  disabled={redeemMutation.isPending || !refCode.trim()}
                  className="flex-1"
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Code einlösen / Redeem"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowCodeInput(false); setRefCode(""); }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCodeInput(true)}
              className="gap-2"
            >
              <Key className="w-3 h-3" />
              Code eingeben / Enter code
            </Button>
          )}
        </div>
      )}

      {profile.accountType === "regular" && (
        <p className="text-xs text-muted-foreground">
          Mit einem Geschäftskonto können Sie Vorbestellungen aufgeben. Entweder einen Referenzcode
          von Ihrem Kantinen-Team eingeben, oder einen Antrag stellen — ein Mitarbeiter prüft Ihren Antrag.
        </p>
      )}
      {profile.accountType === "business_pending" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Wir prüfen Ihren Antrag. Oder geben Sie einen Referenzcode ein, um sofort freigeschaltet zu werden.
        </p>
      )}
      {profile.accountType === "rejected" && (
        <p className="text-xs text-destructive">
          Ihr Antrag wurde abgelehnt. Sie können einen Referenzcode eingeben oder einen neuen Antrag stellen.
        </p>
      )}
    </section>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="min-h-[100dvh] bg-background flex flex-col">
          <header className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl">Profil</h1>
            </div>
            <AuthNav />
          </header>
          <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-6">
            <ProfileForm />
            <Link href="/my-orders">
              <Button variant="outline" className="w-full">
                Meine Bestellungen / My orders
              </Button>
            </Link>
          </main>
        </div>
      </SignedIn>
    </>
  );
}

import { useLocation } from "wouter";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import {
  useListCustomerOrders,
  useCancelOwnOrder,
  getListCustomerOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { AuthNav } from "@/components/auth-nav";

function OrdersList() {
  const { data, isLoading } = useListCustomerOrders();
  const cancel = useCancelOwnOrder();
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <p>Noch keine Bestellungen.</p>
        <p className="text-sm">No orders yet.</p>
      </div>
    );
  }

  const handleCancel = async (id: string) => {
    try {
      await cancel.mutateAsync({ id });
      toast.success("Bestellung storniert.");
      await qc.invalidateQueries({ queryKey: getListCustomerOrdersQueryKey() });
    } catch (e) {
      console.error(e);
      toast.error("Stornierung fehlgeschlagen — Frist abgelaufen?");
    }
  };

  return (
    <div className="space-y-4">
      {data.map((o) => (
        <div key={o.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {o.locationCode} · #{o.id.slice(-5)}
              </p>
              <p className="text-xs text-muted-foreground">
                Für {o.wantedFor ?? new Date(o.createdAt).toISOString().slice(0, 10)} ·{" "}
                {o.status}
              </p>
            </div>
            <span className="font-medium text-primary">
              {formatCurrency(o.total, o.currency)}
            </span>
          </div>
          <ul className="text-sm space-y-1">
            {o.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  <span className="font-medium">{it.qty}x</span> {it.name}
                </span>
                <span className="text-muted-foreground">
                  {formatCurrency(it.price * it.qty, o.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2 pt-1">
            {o.editable ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancel(o.id)}
                disabled={cancel.isPending}
                className="gap-1"
              >
                <XCircle className="w-4 h-4" /> Stornieren
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> nicht mehr änderbar (08:00-Frist)
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyOrders() {
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
              <Button variant="ghost" size="icon" onClick={() => setLocation("/profile")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl">Meine Bestellungen</h1>
            </div>
            <AuthNav />
          </header>
          <main className="flex-1 max-w-xl w-full mx-auto p-4">
            <OrdersList />
          </main>
        </div>
      </SignedIn>
    </>
  );
}

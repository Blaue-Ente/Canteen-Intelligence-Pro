import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPublishedMenu, useCreateGuestOrder } from "@workspace/api-client-react";
import { useCart } from "@/hooks/use-cart";
import { useActiveOrder } from "@/hooks/use-active-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { ChevronLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Checkout() {
  const [, params] = useRoute("/checkout/:locationCode");
  const locationCode = params?.locationCode || "";
  const [, setLocation] = useLocation();
  const { data: menu } = useGetPublishedMenu(locationCode, { query: { enabled: !!locationCode, queryKey: [`/api/preorder/menu/${locationCode}`] } });
  
  const { items, total, clearCart } = useCart();
  const [, setActiveOrder] = useActiveOrder();
  
  const [guestName, setGuestName] = useState("");
  const [guestNote, setGuestNote] = useState("");

  const createOrder = useCreateGuestOrder();

  // Redirect if cart is empty
  if (items.length === 0) {
    setLocation(`/menu/${locationCode}`);
    return null;
  }

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
      toast.error("Fehler bei der Bestellung / Error placing order");
      console.error(error);
    }
  };

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

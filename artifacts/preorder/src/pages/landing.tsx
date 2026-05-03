import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrder } from "@/hooks/use-active-order";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [activeOrder] = useActiveOrder();
  const [locationCode, setLocationCode] = useState("");

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
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-12">
        <div className="mb-10 text-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full mx-auto flex items-center justify-center mb-6">
            <img 
              src="/hero-canteen.png" 
              alt="Fresh Canteen Food" 
              className="w-full h-full object-cover rounded-full shadow-lg border-4 border-white"
            />
          </div>
          <h1 className="text-3xl mb-2 text-foreground">Willkommen<br/><span className="text-xl text-muted-foreground font-sans font-normal">Welcome</span></h1>
          <p className="text-muted-foreground">Scannen Sie den QR-Code in Ihrer Kantine oder geben Sie den Code hier ein.<br/><span className="text-sm">Scan the QR code at your canteen or enter the code here.</span></p>
        </div>

        {activeOrder && (
          <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
            <p className="font-medium text-primary mb-1">Sie haben eine aktive Bestellung</p>
            <p className="text-sm text-primary/80 mb-3">You have an active order</p>
            <Button onClick={handleResumeOrder} className="w-full" variant="default">
              Bestellung ansehen / View Order
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="locationCode" className="text-base">Kantinencode / Canteen Code</Label>
            <Input 
              id="locationCode"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              placeholder="z.B. BER-1"
              className="text-lg py-6"
            />
          </div>
          <Button type="submit" className="w-full text-lg py-6" disabled={!locationCode.trim()}>
            Speisekarte ansehen
            <span className="ml-2 opacity-70 text-sm font-normal">/ View Menu</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

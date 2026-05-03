import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetGuestOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Loader2, CheckCircle2, ChefHat, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveOrder } from "@/hooks/use-active-order";

const STATUS_CONFIG = {
  new: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", label: "Eingegangen", sub: "Received" },
  accepted: { icon: CheckCircle2, color: "text-amber-500", bg: "bg-amber-500/10", label: "Angenommen", sub: "Accepted" },
  preparing: { icon: ChefHat, color: "text-orange-500", bg: "bg-orange-500/10", label: "In Zubereitung", sub: "Preparing" },
  ready: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Abholbereit", sub: "Ready for pickup" },
  served: { icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-muted", label: "Serviert", sub: "Served" },
  cancelled: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Storniert", sub: "Cancelled" },
};

export default function OrderStatus() {
  const [, params] = useRoute("/order/:id");
  const [, setLocation] = useLocation();
  const [activeOrder, setActiveOrder] = useActiveOrder();
  
  const id = params?.id || "";
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const { data: order, isLoading, error } = useGetGuestOrder(id, { token }, {
    query: {
      enabled: !!id && !!token,
      queryKey: [`/api/preorder/orders/${id}`, { token }],
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "served" || status === "cancelled" ? false : 5000;
      }
    }
  });

  // Clear active order if served or cancelled
  useEffect(() => {
    if (order?.status === "served" || order?.status === "cancelled") {
      setActiveOrder(null);
    }
  }, [order?.status, setActiveOrder]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl mb-2">Bestellung nicht gefunden</h2>
        <p className="text-muted-foreground mb-6">Order not found or unauthorized.</p>
        <Button onClick={() => setLocation("/")}>Zurück / Go back</Button>
      </div>
    );
  }

  const isReady = order.status === "ready";
  const config = STATUS_CONFIG[order.status];
  const Icon = config.icon;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/menu/${order.locationCode}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-medium">{order.locationCode}</h1>
            <p className="text-xs text-muted-foreground">Order #{order.id.slice(-5)}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-6 pt-12">
        <AnimatePresence mode="wait">
          <motion.div 
            key={order.status}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex flex-col items-center text-center mb-12"
          >
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 relative ${config.bg} ${config.color}`}>
              {isReady && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-4 border-green-500/30"
                />
              )}
              <Icon className="w-16 h-16" />
            </div>
            
            <h2 className={`text-4xl font-serif font-bold mb-2 ${config.color}`}>{config.label}</h2>
            <p className="text-xl text-muted-foreground">{config.sub}</p>

            {isReady && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 p-4 bg-green-500/10 rounded-2xl border border-green-500/20"
              >
                <p className="font-medium text-green-700 dark:text-green-400">
                  Ihr Essen liegt an der Ausgabe bereit!
                </p>
                <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                  Your food is ready at the counter!
                </p>
                <p className="mt-4 text-sm font-medium">
                  Aufruf: <strong className="text-lg">{order.guestName}</strong>
                </p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Ihre Bestellung / Your Order</h3>
          </div>
          <div className="divide-y divide-border">
            {order.items.map((item, idx) => (
              <div key={idx} className="p-4 flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {item.qty}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="font-medium text-right shrink-0">
                  {formatCurrency(item.price * item.qty, order.currency)}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-muted/20 flex justify-between items-center font-bold border-t border-border">
            <span>Gesamt / Total</span>
            <span className="text-primary">{formatCurrency(order.total, order.currency)}</span>
          </div>
          {order.guestNote && (
            <div className="p-4 bg-amber-500/5 border-t border-amber-500/10 text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-500">Notiz: </span>
              <span className="text-amber-900/80 dark:text-amber-400/80">{order.guestNote}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

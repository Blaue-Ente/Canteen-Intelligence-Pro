import { useRoute, useLocation } from "wouter";
import { useGetPublishedMenu, PreorderDish } from "@workspace/api-client-react";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Plus, Minus, ChevronRight, AlertCircle, Star, Leaf, Flame } from "lucide-react";

export default function Menu() {
  const [, params] = useRoute("/menu/:locationCode");
  const locationCode = params?.locationCode || "";
  const [, setLocation] = useLocation();
  const { data: menu, isLoading, error } = useGetPublishedMenu(locationCode, { query: { enabled: !!locationCode, queryKey: [`/api/preorder/menu/${locationCode}`] } });
  
  const { items, addItem, removeItem, total, count } = useCart();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-muted-foreground font-medium">Lade Speisekarte... <span className="opacity-70 font-normal">/ Loading menu...</span></p>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl mb-2">Menü nicht gefunden</h2>
        <p className="text-muted-foreground mb-6">Menu not found for location: {locationCode}</p>
        <Button onClick={() => setLocation("/")}>Zurück / Go back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-32 bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 pt-8">
        <div className="max-w-xl mx-auto">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{locationCode}</p>
          <h1 className="text-2xl">{menu.locationName}</h1>
          <p className="text-sm text-muted-foreground font-serif italic mt-1">Speisekarte / Menu</p>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-6">
        {menu.dishes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Heute keine Gerichte verfügbar.</p>
            <p className="text-sm mt-1">No dishes available today.</p>
          </div>
        ) : (
          menu.dishes.map((dish) => {
            const cartItem = items.find((i) => i.dishId === dish.id);
            const qty = cartItem?.qty || 0;

            return (
              <div key={dish.id} className="flex gap-4 p-4 bg-card rounded-2xl border border-border shadow-sm">
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt={dish.name} className="w-24 h-24 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-24 h-24 bg-secondary rounded-xl shrink-0 flex items-center justify-center text-muted-foreground/30">
                    <span className="font-serif text-3xl italic">K</span>
                  </div>
                )}
                
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-medium text-lg leading-tight truncate">{dish.name}</h3>
                    <span className="font-medium text-primary shrink-0">{formatCurrency(dish.price, menu.currency)}</span>
                  </div>
                  
                  {dish.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{dish.description}</p>
                  )}
                  
                  {dish.allergens && dish.allergens.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-2 truncate">Allergene: {dish.allergens.join(", ")}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {dish.kcal != null ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        <Flame className="w-3 h-3" />
                        {Math.round(dish.kcal)} kcal
                      </span>
                    ) : null}
                    {dish.proteinG != null ? (
                      <span className="text-[10px] font-medium uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {Math.round(dish.proteinG)} P
                      </span>
                    ) : null}
                    {dish.carbsG != null ? (
                      <span className="text-[10px] font-medium uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {Math.round(dish.carbsG)} KH
                      </span>
                    ) : null}
                    {dish.fatG != null ? (
                      <span className="text-[10px] font-medium uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {Math.round(dish.fatG)} F
                      </span>
                    ) : null}
                    {dish.dge ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                        style={{
                          backgroundColor:
                            dish.dge === "green"
                              ? "#16a34a"
                              : dish.dge === "amber"
                                ? "#eab308"
                                : "#dc2626",
                        }}
                      >
                        <Leaf className="w-3 h-3" />
                        DGE {dish.dge}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-3 flex items-center justify-end">
                    {qty > 0 ? (
                      <div className="flex items-center gap-3 bg-secondary rounded-full p-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full hover:bg-background hover:text-foreground"
                          onClick={() => removeItem(dish.id)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-6 text-center font-medium">{qty}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full hover:bg-background hover:text-foreground"
                          onClick={() => addItem(dish)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="rounded-full px-4 font-medium"
                        onClick={() => addItem(dish)}
                      >
                        Hinzufügen <span className="opacity-50 font-normal ml-1 text-xs">/ Add</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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

      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-20">
          <div className="max-w-xl mx-auto">
            <Button 
              size="lg" 
              className="w-full h-14 text-lg justify-between px-6 rounded-2xl shadow-lg hover-elevate"
              onClick={() => setLocation(`/checkout/${locationCode}`)}
            >
              <div className="flex items-center gap-2">
                <span className="bg-primary-foreground/20 text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                  {count}
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span>Warenkorb</span>
                  <span className="text-[10px] font-normal opacity-80 uppercase tracking-widest">Cart</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>{formatCurrency(total, menu.currency)}</span>
                <ChevronRight className="w-5 h-5 opacity-70" />
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

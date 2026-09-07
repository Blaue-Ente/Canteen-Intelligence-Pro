import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { OrderItem, PreorderDish } from "@workspace/api-client-react";

const STORAGE_KEY = "kitchenos.preorder.cart.v1";

interface CartSnapshot {
  locationCode: string;
  items: OrderItem[];
}

interface CartContextValue {
  locationCode: string;
  items: OrderItem[];
  addItem: (dish: PreorderDish, locationCode?: string) => void;
  removeItem: (dishId: string) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartSnapshot {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { locationCode: "", items: [] };
    const parsed = JSON.parse(raw) as CartSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) return { locationCode: "", items: [] };
    return {
      locationCode: typeof parsed.locationCode === "string" ? parsed.locationCode : "",
      items: parsed.items.filter(
        (i) => i && typeof i.dishId === "string" && typeof i.name === "string",
      ),
    };
  } catch {
    return { locationCode: "", items: [] };
  }
}

function persistCart(snapshot: CartSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / quota — cart still works in-memory for this tab.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CartSnapshot>(loadCart);

  const replace = useCallback((next: CartSnapshot) => {
    setSnapshot(next);
    persistCart(next);
  }, []);

  const addItem = useCallback((dish: PreorderDish, locationCode?: string) => {
    setSnapshot((current) => {
      const loc = locationCode ?? current.locationCode;
      const sameLocation = !current.locationCode || !loc || current.locationCode === loc;
      const baseItems = sameLocation ? current.items : [];
      const existing = baseItems.find((item) => item.dishId === dish.id);
      const items = existing
        ? baseItems.map((item) =>
            item.dishId === dish.id ? { ...item, qty: item.qty + 1 } : item,
          )
        : [...baseItems, { dishId: dish.id, name: dish.name, qty: 1, price: dish.price }];
      const next = { locationCode: loc, items };
      persistCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((dishId: string) => {
    setSnapshot((current) => {
      const existing = current.items.find((item) => item.dishId === dishId);
      const items =
        existing && existing.qty > 1
          ? current.items.map((item) =>
              item.dishId === dishId ? { ...item, qty: item.qty - 1 } : item,
            )
          : current.items.filter((item) => item.dishId !== dishId);
      const next = { ...current, items };
      persistCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    replace({ locationCode: "", items: [] });
  }, [replace]);

  const total = useMemo(
    () => snapshot.items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [snapshot.items],
  );

  const count = useMemo(
    () => snapshot.items.reduce((sum, item) => sum + item.qty, 0),
    [snapshot.items],
  );

  const value = useMemo(
    () => ({
      locationCode: snapshot.locationCode,
      items: snapshot.items,
      addItem,
      removeItem,
      clearCart,
      total,
      count,
    }),
    [snapshot.locationCode, snapshot.items, addItem, removeItem, clearCart, total, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

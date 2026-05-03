import { useState, useCallback, useMemo } from "react";
import { OrderItem, PreorderDish } from "@workspace/api-client-react";

export function useCart() {
  const [items, setItems] = useState<OrderItem[]>([]);

  const addItem = useCallback((dish: PreorderDish) => {
    setItems((current) => {
      const existing = current.find((item) => item.dishId === dish.id);
      if (existing) {
        return current.map((item) =>
          item.dishId === dish.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...current, { dishId: dish.id, name: dish.name, qty: 1, price: dish.price }];
    });
  }, []);

  const removeItem = useCallback((dishId: string) => {
    setItems((current) => {
      const existing = current.find((item) => item.dishId === dishId);
      if (existing && existing.qty > 1) {
        return current.map((item) =>
          item.dishId === dishId
            ? { ...item, qty: item.qty - 1 }
            : item
        );
      }
      return current.filter((item) => item.dishId !== dishId);
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items]
  );
  
  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  );

  return { items, addItem, removeItem, clearCart, total, count };
}

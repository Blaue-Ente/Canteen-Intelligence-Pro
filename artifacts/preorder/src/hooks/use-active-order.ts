import { useState, useEffect } from "react";

interface ActiveOrder {
  id: string;
  token: string;
  locationCode: string;
}

const STORAGE_KEY = "kitchenos_active_order";

export function useActiveOrder() {
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setOrder = (order: ActiveOrder | null) => {
    setActiveOrder(order);
    if (order) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return [activeOrder, setOrder] as const;
}

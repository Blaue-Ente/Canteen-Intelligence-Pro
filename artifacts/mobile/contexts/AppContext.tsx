import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import type {
  AppState,
  CateringRequest,
  ChatMessage,
  ComplaintDraft,
  HaccpLog,
  InventoryItem,
  Locale,
  MenuDayEntry,
  OrderDraft,
  Recipe,
  SaleEntry,
  Supplier,
  WasteEntry,
} from "@/types";
import { seedState } from "@/constants/seedData";
import { loadState, saveState, uid } from "@/lib/storage";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "setLocale"; locale: Locale }
  | { type: "addInventory"; item: InventoryItem }
  | { type: "updateInventory"; item: InventoryItem }
  | { type: "removeInventory"; id: string }
  | { type: "addRecipe"; recipe: Recipe }
  | { type: "updateRecipe"; recipe: Recipe }
  | { type: "removeRecipe"; id: string }
  | { type: "setMenu"; entry: MenuDayEntry }
  | { type: "rotateMenu" }
  | { type: "addSale"; sale: SaleEntry }
  | { type: "addSupplier"; supplier: Supplier }
  | { type: "updateSupplier"; supplier: Supplier }
  | { type: "addComplaint"; complaint: ComplaintDraft }
  | { type: "addHaccp"; log: HaccpLog }
  | { type: "addWaste"; entry: WasteEntry }
  | { type: "addCatering"; request: CateringRequest }
  | { type: "updateCatering"; request: CateringRequest }
  | { type: "addOrder"; order: OrderDraft }
  | { type: "updateOrder"; order: OrderDraft }
  | { type: "removeOrder"; id: string }
  | { type: "addChat"; message: ChatMessage }
  | { type: "updateLastChat"; content: string }
  | { type: "clearChat" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "setLocale":
      return { ...state, locale: action.locale };
    case "addInventory":
      return { ...state, inventory: [action.item, ...state.inventory] };
    case "updateInventory":
      return {
        ...state,
        inventory: state.inventory.map((x) =>
          x.id === action.item.id ? action.item : x,
        ),
      };
    case "removeInventory":
      return { ...state, inventory: state.inventory.filter((x) => x.id !== action.id) };
    case "addRecipe":
      return { ...state, recipes: [action.recipe, ...state.recipes] };
    case "updateRecipe":
      return { ...state, recipes: state.recipes.map((r) => (r.id === action.recipe.id ? action.recipe : r)) };
    case "removeRecipe":
      return { ...state, recipes: state.recipes.filter((r) => r.id !== action.id) };
    case "setMenu": {
      const others = state.menu.filter((m) => m.date !== action.entry.date);
      return { ...state, menu: [...others, action.entry].sort((a, b) => a.date.localeCompare(b.date)) };
    }
    case "rotateMenu": {
      const sorted = [...state.menu].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 2) return state;
      const dates = sorted.map((m) => m.date);
      const recipeSets = sorted.map((m) => m.recipeIds);
      const rotated = [recipeSets[recipeSets.length - 1]!, ...recipeSets.slice(0, -1)];
      return { ...state, menu: dates.map((d, i) => ({ date: d, recipeIds: rotated[i] ?? [] })) };
    }
    case "addSale":
      return { ...state, sales: [action.sale, ...state.sales] };
    case "addSupplier":
      return { ...state, suppliers: [action.supplier, ...state.suppliers] };
    case "updateSupplier":
      return { ...state, suppliers: state.suppliers.map((s) => (s.id === action.supplier.id ? action.supplier : s)) };
    case "addComplaint":
      return { ...state, complaints: [action.complaint, ...state.complaints] };
    case "addHaccp":
      return { ...state, haccp: [action.log, ...state.haccp] };
    case "addWaste":
      return { ...state, waste: [action.entry, ...state.waste] };
    case "addCatering":
      return { ...state, catering: [action.request, ...state.catering] };
    case "updateCatering":
      return {
        ...state,
        catering: state.catering.map((c) => (c.id === action.request.id ? action.request : c)),
      };
    case "addOrder":
      return { ...state, orders: [action.order, ...state.orders] };
    case "updateOrder":
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.order.id ? action.order : o)),
      };
    case "removeOrder":
      return { ...state, orders: state.orders.filter((o) => o.id !== action.id) };
    case "addChat":
      return { ...state, chat: [...state.chat, action.message] };
    case "updateLastChat": {
      if (state.chat.length === 0) return state;
      const last = state.chat[state.chat.length - 1];
      if (!last || last.role !== "assistant") return state;
      const updated: ChatMessage = { ...last, content: last.content + action.content };
      return { ...state, chat: [...state.chat.slice(0, -1), updated] };
    }
    case "clearChat":
      return { ...state, chat: [] };
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  newId: () => string;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, seedState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const loaded = await loadState();
      if (mounted && loaded) {
        const pick = <K extends keyof AppState>(k: K): AppState[K] =>
          (loaded[k] !== undefined ? loaded[k] : seedState[k]) as AppState[K];
        const merged: AppState = {
          locale: pick("locale"),
          inventory: pick("inventory"),
          recipes: pick("recipes"),
          menu: pick("menu"),
          sales: pick("sales"),
          suppliers: pick("suppliers"),
          complaints: pick("complaints"),
          haccp: pick("haccp"),
          waste: pick("waste"),
          catering: pick("catering"),
          orders: pick("orders"),
          chat: pick("chat"),
        };
        dispatch({ type: "hydrate", state: merged });
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [state, ready]);

  const value = useMemo<Ctx>(
    () => ({ state, ready, dispatch, newId: uid }),
    [state, ready],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export function useT(): (
  key: import("@/constants/i18n").DictKey,
) => string {
  const { state } = useApp();
  return useCallback(
    (key) => {
      const m = require("@/constants/i18n").default as Record<
        Locale,
        Record<string, string>
      >;
      return m[state.locale]?.[key] ?? m.de[key] ?? String(key);
    },
    [state.locale],
  );
}

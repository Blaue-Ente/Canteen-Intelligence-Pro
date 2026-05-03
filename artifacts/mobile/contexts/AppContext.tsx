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
  Employee,
  ForecastDay,
  HaccpLog,
  HandoverNote,
  IngredientPriceHistory,
  InventoryItem,
  InventurSession,
  Locale,
  Location,
  MenuDayEntry,
  NotificationPrefs,
  OrderDraft,
  Recipe,
  SaleEntry,
  ShiftEntry,
  StorageLocation,
  Supplier,
  SupplierDelivery,
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
  | { type: "clearChat" }
  | { type: "addInventur"; session: InventurSession }
  | { type: "updateInventur"; session: InventurSession }
  | { type: "removeInventur"; id: string }
  | { type: "addEmployee"; employee: Employee }
  | { type: "updateEmployee"; employee: Employee }
  | { type: "removeEmployee"; id: string }
  | { type: "addShift"; shift: ShiftEntry }
  | { type: "updateShift"; shift: ShiftEntry }
  | { type: "removeShift"; id: string }
  | { type: "setNotificationPrefs"; prefs: NotificationPrefs }
  // ---- Phase 6A ----
  | { type: "addLocation"; location: Location }
  | { type: "updateLocation"; location: Location }
  | { type: "removeLocation"; id: string }
  | { type: "setCurrentLocation"; id: string | undefined }
  | { type: "addHandover"; note: HandoverNote }
  | { type: "addDelivery"; delivery: SupplierDelivery }
  | { type: "updateDelivery"; delivery: SupplierDelivery }
  | { type: "addPriceHistory"; entry: IngredientPriceHistory }
  | { type: "upsertForecast"; forecast: ForecastDay }
  // ---- Phase 6B ----
  | { type: "addStorageLocation"; loc: StorageLocation }
  | { type: "updateStorageLocation"; loc: StorageLocation }
  | { type: "removeStorageLocation"; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "setLocale":
      return { ...state, locale: action.locale };
    case "addInventory":
      return { ...state, inventory: [action.item, ...state.inventory] };
    case "updateInventory": {
      const prev = state.inventory.find((x) => x.id === action.item.id);
      const newPriceHistory: IngredientPriceHistory[] =
        prev && prev.pricePerUnit !== action.item.pricePerUnit
          ? [
              {
                id: uid(),
                inventoryId: action.item.id,
                supplierId: action.item.supplierId,
                price: action.item.pricePerUnit,
                date: new Date().toISOString(),
              },
              ...state.priceHistory,
            ].slice(0, 500)
          : state.priceHistory;
      return {
        ...state,
        inventory: state.inventory.map((x) =>
          x.id === action.item.id ? action.item : x,
        ),
        priceHistory: newPriceHistory,
      };
    }
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
    case "addInventur":
      return { ...state, inventurs: [action.session, ...state.inventurs] };
    case "updateInventur":
      return {
        ...state,
        inventurs: state.inventurs.map((s) => (s.id === action.session.id ? action.session : s)),
      };
    case "removeInventur":
      return { ...state, inventurs: state.inventurs.filter((s) => s.id !== action.id) };
    case "addEmployee":
      return { ...state, employees: [...state.employees, action.employee] };
    case "updateEmployee":
      return {
        ...state,
        employees: state.employees.map((e) => (e.id === action.employee.id ? action.employee : e)),
      };
    case "removeEmployee":
      return {
        ...state,
        employees: state.employees.filter((e) => e.id !== action.id),
        shifts: state.shifts.filter((sh) => sh.employeeId !== action.id),
      };
    case "addShift":
      return { ...state, shifts: [...state.shifts, action.shift] };
    case "updateShift":
      return {
        ...state,
        shifts: state.shifts.map((sh) => (sh.id === action.shift.id ? action.shift : sh)),
      };
    case "removeShift":
      return { ...state, shifts: state.shifts.filter((sh) => sh.id !== action.id) };
    case "setNotificationPrefs":
      return { ...state, notificationPrefs: action.prefs };
    case "addLocation":
      return { ...state, locations: [...state.locations, action.location] };
    case "updateLocation":
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.location.id ? action.location : l,
        ),
      };
    case "removeLocation":
      return {
        ...state,
        locations: state.locations.filter((l) => l.id !== action.id),
        currentLocationId:
          state.currentLocationId === action.id ? undefined : state.currentLocationId,
      };
    case "setCurrentLocation":
      return { ...state, currentLocationId: action.id };
    case "addHandover":
      return { ...state, handovers: [action.note, ...state.handovers].slice(0, 200) };
    case "addDelivery":
      return { ...state, deliveries: [action.delivery, ...state.deliveries] };
    case "updateDelivery":
      return {
        ...state,
        deliveries: state.deliveries.map((d) =>
          d.id === action.delivery.id ? action.delivery : d,
        ),
      };
    case "addPriceHistory":
      return {
        ...state,
        priceHistory: [action.entry, ...state.priceHistory].slice(0, 500),
      };
    case "upsertForecast": {
      const key = (f: ForecastDay) => `${f.locationId ?? ""}:${f.date}`;
      const k = key(action.forecast);
      const others = state.forecasts.filter((f) => key(f) !== k);
      return { ...state, forecasts: [action.forecast, ...others].slice(0, 60) };
    }
    case "addStorageLocation":
      return { ...state, storageLocations: [...state.storageLocations, action.loc] };
    case "updateStorageLocation":
      return {
        ...state,
        storageLocations: state.storageLocations.map((s) =>
          s.id === action.loc.id ? action.loc : s,
        ),
      };
    case "removeStorageLocation":
      return {
        ...state,
        storageLocations: state.storageLocations.filter((s) => s.id !== action.id),
      };
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  newId: () => string;
  /** Current active location object (or null when "All filiale"). */
  currentLocation: import("@/types").Location | null;
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
          inventurs: pick("inventurs"),
          employees: pick("employees"),
          shifts: pick("shifts"),
          notificationPrefs: pick("notificationPrefs"),
          locations: pick("locations"),
          currentLocationId: pick("currentLocationId"),
          handovers: pick("handovers"),
          deliveries: pick("deliveries"),
          priceHistory: pick("priceHistory"),
          forecasts: pick("forecasts"),
          storageLocations: pick("storageLocations"),
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

  const currentLocation = useMemo(
    () =>
      state.currentLocationId
        ? state.locations.find((l) => l.id === state.currentLocationId) ?? null
        : null,
    [state.locations, state.currentLocationId],
  );

  const value = useMemo<Ctx>(
    () => ({ state, ready, dispatch, newId: uid, currentLocation }),
    [state, ready, currentLocation],
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

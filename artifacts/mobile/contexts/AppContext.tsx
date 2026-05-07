import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type {
  AppMode,
  AppState,
  CateringEvent,
  CateringRequest,
  ChatMessage,
  CleaningCompletion,
  CleaningTask,
  ComplaintDraft,
  CompanyProfile,
  Employee,
  ForecastDay,
  HaccpLog,
  HandoverNote,
  IngredientPriceHistory,
  InventoryItem,
  InventurSession,
  KiosVoice,
  Locale,
  Location,
  MenuDayEntry,
  NotificationPrefs,
  OkoChallengeId,
  OkoCompletion,
  OrderDraft,
  PriceListEntry,
  PriceServerConfig,
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
import { useAuthCtx } from "@/contexts/AuthContext";

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
  | { type: "addCleaningTask"; task: CleaningTask }
  | { type: "updateCleaningTask"; task: CleaningTask }
  | { type: "removeCleaningTask"; id: string }
  | { type: "addCleaningCompletion"; completion: CleaningCompletion }
  | { type: "updateCleaningCompletion"; completion: CleaningCompletion }
  | { type: "removeCleaningCompletion"; id: string }
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
  | { type: "removeStorageLocation"; id: string }
  // ---- Events + PriceServer ----
  | { type: "addEvent"; event: CateringEvent }
  | { type: "updateEvent"; event: CateringEvent }
  | { type: "removeEvent"; id: string }
  | { type: "setPriceList"; entries: PriceListEntry[] }
  | { type: "setPriceServerConfig"; config: PriceServerConfig }
  // ---- TSE / KassenSichV (T011) ----
  | { type: "setTseConfig"; config: import("@/types").TseConfig }
  /**
   * Per-location TSE config update. Use this instead of setTseConfig whenever
   * a locationId is known — ensures each Kasse keeps an isolated config and
   * gap-free Belegnummer series per KassenSichV §146a AO.
   */
  | { type: "setTseConfigForLocation"; locationId: string; config: import("@/types").TseConfig }
  | { type: "addSignedSale"; sale: import("@/types").SignedSale }
  // ---- T013: HACCP automation + Rückstellproben + Subscription ----
  | { type: "setSubscription"; subscription: import("@/types").Subscription }
  | { type: "setSampleStorage"; storageLocationId: string | undefined }
  | { type: "addFoodSample"; sample: import("@/types").FoodSample }
  | { type: "addFoodSamples"; samples: import("@/types").FoodSample[] }
  | { type: "updateFoodSample"; sample: import("@/types").FoodSample }
  | { type: "removeFoodSample"; id: string }
  | { type: "purgeExpiredFoodSamples" }
  // ---- Company + CRM + Demo ----
  | { type: "setCompanyProfile"; profile: CompanyProfile }
  | { type: "loadDemoData"; events: CateringEvent[]; company: CompanyProfile }
  | { type: "setDemoSeed"; seed: AppState }
  // ---- Öko Wizard ----
  | { type: "setOkoEnabled"; enabled: boolean }
  | { type: "setKiosVoice"; voice: KiosVoice }
  | { type: "setAppMode"; mode: AppMode }
  | { type: "completeOkoChallenge"; completion: OkoCompletion }
  | { type: "removeOkoCompletion"; id: string }
  // ---- T014: DGE-Qualitätsstandard ----
  | { type: "setDgeStandard"; standard: import("@/types").DgeStandard | undefined };

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
    case "addSale": {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoff = oneYearAgo.toISOString().slice(0, 10);
      return { ...state, sales: [action.sale, ...state.sales].filter((s) => s.date >= cutoff) };
    }
    case "addSupplier":
      return { ...state, suppliers: [action.supplier, ...state.suppliers] };
    case "updateSupplier":
      return { ...state, suppliers: state.suppliers.map((s) => (s.id === action.supplier.id ? action.supplier : s)) };
    case "addComplaint":
      return { ...state, complaints: [action.complaint, ...state.complaints] };
    case "addHaccp":
      return { ...state, haccp: [action.log, ...state.haccp] };
    case "addCleaningTask":
      return { ...state, cleaningTasks: [action.task, ...state.cleaningTasks] };
    case "updateCleaningTask":
      return {
        ...state,
        cleaningTasks: state.cleaningTasks.map((t) =>
          t.id === action.task.id ? action.task : t,
        ),
      };
    case "removeCleaningTask":
      return {
        ...state,
        cleaningTasks: state.cleaningTasks.filter((t) => t.id !== action.id),
      };
    case "addCleaningCompletion":
      return {
        ...state,
        cleaningLog: [action.completion, ...state.cleaningLog].slice(0, 2000),
      };
    case "updateCleaningCompletion":
      return {
        ...state,
        cleaningLog: state.cleaningLog.map((c) =>
          c.id === action.completion.id ? action.completion : c,
        ),
      };
    case "removeCleaningCompletion":
      return {
        ...state,
        cleaningLog: state.cleaningLog.filter((c) => c.id !== action.id),
      };
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
    case "addEvent":
      return { ...state, events: [action.event, ...state.events] };
    case "updateEvent":
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.event.id ? action.event : e)),
      };
    case "removeEvent":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    case "setPriceList":
      return { ...state, priceList: action.entries };
    case "setPriceServerConfig":
      return { ...state, priceServerConfig: action.config };
    case "setTseConfig":
      return { ...state, tseConfig: action.config };
    case "setTseConfigForLocation":
      return {
        ...state,
        tseConfigs: {
          ...(state.tseConfigs ?? {}),
          [action.locationId]: action.config,
        },
      };
    case "addSignedSale": {
      // Mirror addSale's 1-year retention — also push the SaleEntry slice.
      // The mirrored row carries `tseTxNumber` so reports that aggregate the
      // legacy `sales` table can still join back to the signed entry and avoid
      // double-counting (audit-side reconciliation).
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoff = oneYearAgo.toISOString().slice(0, 10);
      const { tseSerial, tseSignatureCounter, tseSignature, tseTime, processType, processData, provider, vatPct, ...saleBase } = action.sale;
      void tseSerial; void tseSignatureCounter; void tseSignature; void tseTime;
      void processType; void processData; void provider; void vatPct;
      const saleSlice = { ...saleBase, tseTxNumber: action.sale.tseTxNumber };
      return {
        ...state,
        signedSales: [action.sale, ...state.signedSales].filter((s) => s.date >= cutoff),
        sales: [saleSlice, ...state.sales].filter((s) => s.date >= cutoff),
      };
    }
    case "setSubscription":
      return { ...state, subscription: action.subscription };
    case "setSampleStorage":
      return { ...state, sampleStorageLocationId: action.storageLocationId };
    case "addFoodSample":
      return { ...state, foodSamples: [action.sample, ...state.foodSamples] };
    case "addFoodSamples":
      return { ...state, foodSamples: [...action.samples, ...state.foodSamples] };
    case "updateFoodSample":
      return {
        ...state,
        foodSamples: state.foodSamples.map((s) => (s.id === action.sample.id ? action.sample : s)),
      };
    case "removeFoodSample":
      return { ...state, foodSamples: state.foodSamples.filter((s) => s.id !== action.id) };
    case "purgeExpiredFoodSamples": {
      // Drop samples whose retention is more than 1 day past — frees storage but
      // keeps recently-expired ones around so staff can audit "did we discard them on time?"
      const cutoff = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      return { ...state, foodSamples: state.foodSamples.filter((s) => s.retentionUntil >= cutoff) };
    }
    case "setCompanyProfile":
      return { ...state, companyProfile: action.profile };
    case "loadDemoData":
      return { ...state, events: action.events, companyProfile: action.company };
    case "setDemoSeed":
      // Atomic full-state replacement used when a demo user signs in. We keep
      // the user's locale preference if they had set one before signing in.
      return { ...action.seed, locale: state.locale ?? action.seed.locale };
    case "setOkoEnabled":
      return { ...state, okoEnabled: action.enabled };
    case "setKiosVoice":
      return { ...state, kiosVoice: action.voice };
    case "setAppMode":
      return { ...state, appMode: action.mode };
    case "completeOkoChallenge": {
      const POINTS: Record<OkoChallengeId, number> = {
        meatFreeDay: 20, useReste: 15, regionalOrder: 25, haccpToday: 10,
        wasteUnder10: 30, seasonalIngredient: 20, buyBio: 20,
        reducePlastic: 15, co2Labeling: 25, donateReste: 30,
      };
      const pts = POINTS[action.completion.challengeId] ?? 15;
      return {
        ...state,
        okoProgress: {
          score: state.okoProgress.score + pts,
          completions: [action.completion, ...state.okoProgress.completions].slice(0, 500),
        },
      };
    }
    case "removeOkoCompletion":
      return {
        ...state,
        okoProgress: {
          ...state.okoProgress,
          completions: state.okoProgress.completions.filter((c) => c.id !== action.id),
        },
      };
    case "setDgeStandard":
      return { ...state, dgeStandard: action.standard };
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
  /**
   * Apply a demo seed. Safe to call from `sign-in.tsx` immediately after
   * `signIn.create` succeeds (even before `setActive` resolves): the seed
   * is queued and applied at the next hydrate-completion for a non-null
   * userId. This guarantees the seed lands under the demo user's storage
   * key — never the anonymous or previous-user key — eliminating cross-
   * account data leaks.
   */
  applyDemoSeed: (seed: AppState) => void;
  /**
   * Drop any queued demo seed. Call this when a demo sign-in flow fails
   * (e.g. setActive throws) so the seed cannot leak into a subsequent
   * unrelated sign-in within the 30s expiry window.
   */
  clearPendingDemoSeed: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthCtx();
  const userId = auth.me?.userId ?? null;
  const [state, dispatch] = useReducer(reducer, seedState);
  const [ready, setReady] = useState(false);
  // Track which userId we last hydrated for, so we re-hydrate on sign-in /
  // sign-out / demo-variant swap. `undefined` = never loaded yet.
  const lastLoadedFor = useRef<string | null | undefined>(undefined);
  // Pending demo seed queued by sign-in.tsx. Consumed by the hydrate effect
  // below at the next completed hydrate for a non-null userId — i.e. once
  // Clerk has propagated the demo session and AppProvider has loaded that
  // user's storage key. A 30s expiry guards against stale seeds (e.g. the
  // user backs out of the demo flow before sign-in completes).
  const pendingDemoSeed = useRef<{ seed: AppState; queuedAt: number } | null>(null);

  useEffect(() => {
    if (!auth.ready) return;
    if (lastLoadedFor.current === userId) return;
    let mounted = true;
    setReady(false);
    void (async () => {
      const loaded = await loadState(userId);
      if (!mounted) return;
      if (loaded) {
        const pick = <K extends keyof AppState>(k: K): AppState[K] =>
          (loaded[k] !== undefined ? loaded[k] : seedState[k]) as AppState[K];
        const salesCutoff = (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d.toISOString().slice(0, 10);
        })();
        const merged: AppState = {
          locale: pick("locale"),
          inventory: pick("inventory"),
          recipes: pick("recipes"),
          menu: pick("menu"),
          sales: (pick("sales") as import("@/types").SaleEntry[]).filter((s) => s.date >= salesCutoff),
          suppliers: pick("suppliers"),
          complaints: pick("complaints"),
          haccp: pick("haccp"),
          cleaningTasks: pick("cleaningTasks"),
          cleaningLog: pick("cleaningLog"),
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
          events: pick("events"),
          priceList: pick("priceList"),
          priceServerConfig: pick("priceServerConfig"),
          companyProfile: pick("companyProfile"),
          okoEnabled: pick("okoEnabled"),
          okoProgress: pick("okoProgress"),
          kiosVoice: pick("kiosVoice"),
          appMode: pick("appMode"),
          tseConfig: pick("tseConfig"),
          tseConfigs: pick("tseConfigs"),
          signedSales: pick("signedSales"),
          // ---- T013 ----
          foodSamples: pick("foodSamples"),
          subscription: pick("subscription"),
          sampleStorageLocationId: pick("sampleStorageLocationId"),
          // ---- T014 ----
          dgeStandard: pick("dgeStandard"),
        };
        dispatch({ type: "hydrate", state: merged });
      } else {
        // No prior state for this user → reset to seedState so a previous
        // user's in-memory state doesn't leak across.
        dispatch({ type: "hydrate", state: seedState });
      }
      lastLoadedFor.current = userId;
      // If a demo seed was queued during the auth handoff and we now have a
      // real userId, consume it before flipping `ready` so the very first
      // save under this user's key is the seed itself. The hard timer above
      // already guarantees expiry, so we only need to consume here — never
      // age out manually.
      const pending = pendingDemoSeed.current;
      if (pending && userId !== null) {
        dispatch({ type: "setDemoSeed", seed: pending.seed });
        pendingDemoSeed.current = null;
        if (pendingDemoSeedTimer.current) {
          clearTimeout(pendingDemoSeedTimer.current);
          pendingDemoSeedTimer.current = null;
        }
      }
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [auth.ready, userId]);

  useEffect(() => {
    // Strict guard: only save when the in-memory state truly belongs to the
    // current `userId`. Otherwise a userId change can cause the previous
    // user's state to be flushed to the new user's storage key on the next
    // render before re-hydration completes.
    if (!ready) return;
    if (lastLoadedFor.current !== userId) return;
    void saveState(state, userId);
  }, [state, ready, userId]);

  // Hard timer that drops the pending seed exactly 30s after queueing,
  // regardless of any subsequent hydrate / userId activity. This is the
  // belt to the suspenders inside the hydrate effect: it ensures a queued
  // seed cannot survive past 30s even if no further auth transition ever
  // triggers a hydrate (e.g. setActive succeeded but `/api/me` failed and
  // `auth.me` stays null indefinitely).
  const pendingDemoSeedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingDemoSeed = useCallback(() => {
    pendingDemoSeed.current = null;
    if (pendingDemoSeedTimer.current) {
      clearTimeout(pendingDemoSeedTimer.current);
      pendingDemoSeedTimer.current = null;
    }
  }, []);

  const applyDemoSeed = useCallback(
    (seed: AppState) => {
      // If we're already hydrated for a real user (e.g. the user signs in
      // again as a different demo variant after already being signed in as
      // a demo user), apply immediately. Otherwise queue for the next
      // hydrate completion.
      if (ready && userId !== null && lastLoadedFor.current === userId) {
        dispatch({ type: "setDemoSeed", seed });
        return;
      }
      pendingDemoSeed.current = { seed, queuedAt: Date.now() };
      if (pendingDemoSeedTimer.current) clearTimeout(pendingDemoSeedTimer.current);
      pendingDemoSeedTimer.current = setTimeout(() => {
        pendingDemoSeed.current = null;
        pendingDemoSeedTimer.current = null;
      }, 30_000);
    },
    [ready, userId],
  );

  // Drop any queued seed when Clerk reports the user is no longer signed
  // in. We key on `auth.isSignedIn` (Clerk-backed) rather than
  // `userId === null` because the latter can also be null when the user IS
  // signed in but `/api/me` failed to load — in which case clearing would
  // be both wrong (the demo flow is still in progress) AND fail to fire on
  // a real sign-out that came AFTER `/api/me` had already gone null.
  // `isSignedIn` is the only authoritative signed-out signal.
  useEffect(() => {
    if (auth.ready && !auth.isSignedIn) {
      clearPendingDemoSeed();
    }
  }, [auth.ready, auth.isSignedIn, clearPendingDemoSeed]);

  // On unmount, make sure the timer doesn't leak.
  useEffect(() => {
    return () => {
      if (pendingDemoSeedTimer.current) {
        clearTimeout(pendingDemoSeedTimer.current);
      }
    };
  }, []);

  const currentLocation = useMemo(
    () =>
      state.currentLocationId
        ? state.locations.find((l) => l.id === state.currentLocationId) ?? null
        : null,
    [state.locations, state.currentLocationId],
  );

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      dispatch,
      newId: uid,
      currentLocation,
      applyDemoSeed,
      clearPendingDemoSeed,
    }),
    [state, ready, currentLocation, applyDemoSeed, clearPendingDemoSeed],
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

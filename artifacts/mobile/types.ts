export type Locale = "de" | "en";

export type DishType = "soup" | "main" | "salad" | "dessert" | "side" | "drink";
export type DishCategory = "vegan" | "vegetarian" | "meat" | "fish" | "kids";
export type MeatType = "beef" | "pork" | "chicken" | "lamb" | "turkey" | "none";
export type Allergen =
  | "gluten"
  | "milk"
  | "egg"
  | "nuts"
  | "soy"
  | "fish"
  | "shellfish"
  | "celery"
  | "mustard"
  | "sesame"
  | "sulphite"
  | "lupin"
  | "mollusc"
  | "peanut";

export interface InventoryItem {
  id: string;
  name: string;
  nameDe: string;
  unit: "kg" | "g" | "l" | "ml" | "pcs";
  quantity: number;
  minQuantity: number;
  pricePerUnit: number;
  supplierId?: string;
  category: "meat" | "dairy" | "vegetable" | "fruit" | "dry" | "spice" | "drink" | "frozen" | "other";
  expiresAt?: string;
  location?: string;
  locationId?: string;
  updatedAt: string;
  // --- Phase 6A: nutrition + sustainability ---
  allergens?: Allergen[];
  kcalPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  /** kg CO₂-eq per kg of ingredient (cradle-to-gate). */
  co2PerKg?: number;
  /** "DGE-bewertet" category for nutrition compliance. */
  dgeCategory?: "green" | "yellow" | "red";
  bio?: boolean;
  regional?: boolean;
}

export interface Ingredient {
  inventoryId: string;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  nameDe: string;
  type: DishType;
  category: DishCategory;
  meat: MeatType;
  portionGrams: number;
  ingredients: Ingredient[];
  allergens: Allergen[];
  steps: string[];
  stepsDe: string[];
  basePrice: number;
  sellPrice: number;
  imageUrl?: string;
  source?: "internal" | "ai";
  cookTimeMin: number;
  kcalPerPortion?: number;
}

export interface MenuDayEntry {
  date: string;
  recipeIds: string[];
  locationId?: string;
  /** Per-recipe portion override (grams) for this day. */
  portionOverrides?: Record<string, number>;
  /** Per-recipe planned cooked count for forecast/procurement. */
  plannedCount?: Record<string, number>;
}

export interface AuditFields {
  createdBy?: string;
  createdByName?: string;
  locationId?: string;
}

export interface SaleEntry extends AuditFields {
  id: string;
  date: string;
  recipeId: string;
  cooked: number;
  sold: number;
  revenue: number;
  /** Actual portion size served (grams). Defaults to recipe.portionGrams when absent. */
  portionGrams?: number;
  source?: "manual" | "zettle" | "ai";
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  lat?: number;
  lng?: number;
  category: string[];
  rating: number;
  notes?: string;
}

export interface ComplaintDraft extends AuditFields {
  id: string;
  supplierId: string;
  date: string;
  reason: string;
  amount: string;
  invoiceNo: string;
  photoUri?: string;
  status: "draft" | "sent";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface HaccpLog extends AuditFields {
  id: string;
  date: string;
  type: "fridge" | "freezer" | "delivery" | "cleaning" | "cooking";
  location: string;
  temperature?: number;
  note?: string;
  ok: boolean;
}

export interface WasteEntry extends AuditFields {
  id: string;
  date: string;
  recipeId?: string;
  inventoryId?: string;
  grams: number;
  reason: "spoilage" | "overproduction" | "preparation" | "plate";
  cost: number;
}

export interface CateringRequest extends AuditFields {
  id: string;
  receivedAt: string;
  fromEmail: string;
  subject: string;
  body: string;
  guests: number;
  date: string;
  dietary?: string;
  parsed: { recipeIds: string[]; notes: string }[];
  status: "new" | "draft" | "confirmed" | "rejected";
  /** AI-generated quote in cents per person (after Phase 6A "Angebot generieren"). */
  perPersonCents?: number;
}

export interface OrderDraftItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  inventoryId?: string;
  reason?: string;
}

export interface OrderDraft extends AuditFields {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierEmail?: string;
  items: OrderDraftItem[];
  total?: number;
  status: "draft" | "sent" | "received";
  createdAt: string;
  notes?: string;
}

export interface InventurCount {
  inventoryId: string;
  expectedQty: number;
  actualQty?: number;
  unit: string;
  pricePerUnit: number;
}

export interface InventurSession extends AuditFields {
  id: string;
  startedAt: string;
  closedAt?: string;
  note?: string;
  counts: InventurCount[];
  /** Sum of (expected - actual) * pricePerUnit at close (positive = loss). */
  varianceValue?: number;
  status: "open" | "closed";
}

export interface Employee {
  id: string;
  name: string;
  role: "chef" | "cook" | "service" | "kitchen_help" | "manager";
  color?: string;
  weeklyHours?: number;
  phone?: string;
}

export interface ShiftEntry extends AuditFields {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  role?: string;
  note?: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  lowStock: boolean;
  expiring: boolean;
  tagesabschluss: boolean;
  tagesabschlussTime: string; // HH:mm
  haccpReminder: boolean;
  haccpTime: string; // HH:mm
  /** Lock-window: booleans/counts may only be increased during this period */
  salesWindowEnabled: boolean;
  salesWindowStart: string; // HH:mm
  salesWindowEnd: string;   // HH:mm
}

// ---------- Phase 6A entities ----------

export interface Location {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  /** Free-form internal code (e.g. "MTE", "SPN"). */
  code?: string;
  /** Geo coords for forecast weather. */
  lat?: number;
  lng?: number;
  /** Average daily guest count, used as forecast baseline. */
  avgGuestsPerDay?: number;
  isPrimary?: boolean;
  createdAt: string;
}

export interface HandoverNote extends AuditFields {
  id: string;
  date: string; // ISO
  shift: "morning" | "evening" | "night";
  transcript: string;
  summary: string;
  actions: string[];
}

export interface SupplierDelivery extends AuditFields {
  id: string;
  supplierId: string;
  expectedDate: string; // YYYY-MM-DD
  actualDate?: string;
  expectedQty?: number;
  actualQty?: number;
  unit?: string;
  hadIssue: boolean;
  issueNote?: string;
}

export interface IngredientPriceHistory {
  id: string;
  inventoryId: string;
  supplierId?: string;
  price: number;
  date: string; // ISO
}

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  locationId?: string;
  weather?: { tempC: number; rainMm: number; condition: string };
  expectedGuests: number;
  /** recipeId -> recommended portions */
  recommendations: Record<string, number>;
  rationale?: string;
  generatedAt: string;
}

export type StorageLocationCategory = "fridge" | "freezer" | "room" | "kitchen" | "delivery";

export interface StorageLocation {
  id: string;
  name: string;
  category: StorageLocationCategory;
  /** Target temp in °C (max for cold, min for hot). Optional. */
  targetTemp?: number;
  /** Optional KItchenOS location/filiale this storage belongs to. */
  locationId?: string;
  note?: string;
}

// ---- Event Management ----

export type EventStatus =
  | "anfrage"
  | "angebot"
  | "bestaetigt"
  | "produktion"
  | "abgeschlossen"
  | "abgesagt";

export interface EventMenuItem {
  recipeId: string;
  recipeName: string;
  portions: number;
  pricePerPortion: number;
  note?: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  iban: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface CateringEvent {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  eventDate: string; // YYYY-MM-DD
  eventTime?: string; // HH:mm
  venue?: string;
  guestCount: number;
  status: EventStatus;
  menuItems: EventMenuItem[];
  staffCost?: number;
  equipmentCost?: number;
  transportCost?: number;
  overheadPct?: number; // default 15
  vatPct?: number; // default 19
  notes?: string;
  offerText?: string;
  // ---- Invoice ----
  invoiceNo?: string;
  invoiceDate?: string;   // YYYY-MM-DD
  paymentDueDays?: number; // default 14
  invoicePaid?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Price List / External Server ----

export interface PriceListEntry {
  code?: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  supplier?: string;
  category?: string;
  validFrom?: string;
  validTo?: string;
}

export type PriceServerAuthType = "none" | "basic" | "bearer" | "apiKey";

export interface PriceServerConfig {
  url: string;
  authType: PriceServerAuthType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  lastSyncAt?: string;
  lastSyncStatus?: "ok" | "error";
  lastSyncError?: string;
}

export interface AppState {
  locale: Locale;
  inventory: InventoryItem[];
  recipes: Recipe[];
  menu: MenuDayEntry[];
  sales: SaleEntry[];
  suppliers: Supplier[];
  complaints: ComplaintDraft[];
  haccp: HaccpLog[];
  waste: WasteEntry[];
  catering: CateringRequest[];
  orders: OrderDraft[];
  chat: ChatMessage[];
  inventurs: InventurSession[];
  employees: Employee[];
  shifts: ShiftEntry[];
  notificationPrefs: NotificationPrefs;
  // ---- Phase 6A ----
  locations: Location[];
  currentLocationId?: string;
  handovers: HandoverNote[];
  deliveries: SupplierDelivery[];
  priceHistory: IngredientPriceHistory[];
  forecasts: ForecastDay[];
  // ---- Phase 6B ----
  storageLocations: StorageLocation[];
  // ---- Event Management + Price Server ----
  events: CateringEvent[];
  priceList: PriceListEntry[];
  priceServerConfig?: PriceServerConfig;
  // ---- Company + CRM ----
  companyProfile?: CompanyProfile;
  // ---- Öko Wizard ----
  okoEnabled: boolean;
  okoProgress: OkoProgress;
  // ---- Kios voice ----
  kiosVoice: KiosVoice;
  // ---- Operating mode ----
  /**
   * Application operating mode:
   * - "lite": Staff/operations assistant only — NO legally binding fiscal data.
   *   For kitchens with a separate POS. Hides cash register, TSE signing, DSFinV-K export.
   * - "full": Full cash register + tax-compliant mode (TSE/KassenSichV/DSFinV-K).
   *   Sales become legally binding receipts; requires fiskaly TSE setup.
   */
  appMode: AppMode;
}

/** Voice options for the Kios assistant. Mapped to ElevenLabs voice IDs server-side. */
export type KiosVoice = "sarah" | "charlotte" | "antoni";

/** Operating mode — gates fiscal/cash-register features. See AppState.appMode. */
export type AppMode = "lite" | "full";

// ─── Öko Wizard ─────────────────────────────────────────────────────────────

export type OkoChallengeId =
  | "meatFreeDay"
  | "useReste"
  | "regionalOrder"
  | "haccpToday"
  | "wasteUnder10"
  | "seasonalIngredient"
  | "buyBio"
  | "reducePlastic"
  | "co2Labeling"
  | "donateReste";

export interface OkoCompletion {
  id: string;
  challengeId: OkoChallengeId;
  completedAt: string; // ISO
  note?: string;
}

export interface OkoProgress {
  score: number;
  completions: OkoCompletion[];
}

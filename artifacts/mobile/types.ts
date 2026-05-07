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
  /** When mirrored from a SignedSale: the TSE Belegnummer, for audit reconciliation. */
  tseTxNumber?: number;
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
  /**
   * T013 — provenance: how this entry was created.
   * - "manual"           → user typed temp/notes in haccp.tsx
   * - "auto-suggest"     → confirmed from a HaccpSuggestion (predicted from history)
   * - "auto-production"  → automatically created when a production batch was saved
   * - "auto-delivery"    → automatically created when a supplier order was marked received
   * - "ble"              → captured from a paired Bluetooth thermometer (paid addon)
   */
  source?: "manual" | "auto-suggest" | "auto-production" | "auto-delivery" | "ble";
  /** When the entry is "abweichend" (out of range), document what was done. */
  correctiveAction?: string;
  /** Cross-reference back to the HaccpSuggestion that created this entry. */
  suggestionId?: string;
}

/**
 * T013 — Predicted HACCP entry shown to staff for one-tap confirmation.
 *
 * Generated client-side every render from `storageLocations` + last 7-day
 * history. Not persisted: ephemeral UX only. When confirmed, becomes a real
 * HaccpLog with source="auto-suggest".
 */
export interface HaccpSuggestion {
  /** Stable id derived from locationId + slot (so the UI can dedupe across renders). */
  id: string;
  storageLocationId: string;
  locationName: string;
  type: HaccpLog["type"];
  /** Predicted temperature based on target +/- realistic jitter. */
  suggestedTemp: number;
  /** Bottom of the legal range — used to pre-mark "ok". */
  legalMin?: number;
  /** Top of the legal range — used to pre-mark "ok". */
  legalMax?: number;
  /** Time slot label, e.g. "Morgen 09:00" or "Nachmittag 17:00". */
  slot: string;
  /** ISO timestamp when this slot is due. */
  dueAt: string;
  /** Human-readable reason ("Median der letzten 7 Tage"). */
  reason: string;
}

/**
 * T013 — Rückstellprobe (food retention sample) per LMHV §11 Abs. 3
 * (mandatory for canteens & catering >150 portions/day in Germany).
 *
 * 100 g of every served dish must be retained at ≤ 4 °C for 7 days so a
 * laboratory can analyse them in case of suspected food-poisoning.
 */
export interface FoodSample extends AuditFields {
  id: string;
  /** ISO date the sample was *taken* (= production date). */
  date: string;
  recipeId: string;
  recipeName: string;
  /** Optional cross-reference to the production batch this came from. */
  batchId?: string;
  amountGrams: number;
  /** Storage unit where the sample sits (typ. "Probenkühlschrank"). */
  storageLocationId?: string;
  storageLocationName?: string;
  /** ISO date when this sample may legally be discarded (date + 7 d). */
  retentionUntil: string;
  /** Confirmation: physically taken & labelled. False = still pending. */
  taken: boolean;
  /** ISO timestamp of physical taking. */
  takenAt?: string;
  takenBy?: string;
  photoUri?: string;
  note?: string;
  /** Provenance — auto-created from production / event / manual. */
  source?: "auto-production" | "auto-event" | "manual";
}

/**
 * Master cleaning schedule (HACCP §4 LMHV).
 *
 * A `CleaningTask` is a recurring template ("clean grease trap weekly").
 * Each completion is logged in `cleaningLog` with optional photo proof.
 * Used to generate the inspection-mode PDF (T008) for Lebensmittelkontrolle.
 */
export type CleaningFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type CleaningArea =
  | "kueche"        // Küche / kitchen surfaces
  | "lager"         // Storage rooms
  | "kuehlung"      // Fridges / freezers
  | "geschirr"      // Dish area / pass
  | "boden"         // Floors / drains
  | "abluft"        // Hood / extractor / grease trap
  | "sanitaer";     // Toilets / hand-wash

export interface CleaningTask {
  id: string;
  /** Display name (DE primary; localized at render time). */
  name: string;
  nameEn?: string;
  area: CleaningArea;
  frequency: CleaningFrequency;
  /**
   * For daily tasks: how many completions are required per calendar day.
   * Defaults to 1 when absent.
   */
  timesPerDay?: number;
  /**
   * Optional time-of-day slots, e.g. ["08:00", "14:00", "20:00"].
   * Purely informational — shown as a reminder; does not enforce execution time.
   */
  scheduledTimes?: string[];
  /** Optional explicit storage / room target (cross-reference to StorageLocation.id). */
  storageLocationId?: string;
  /** Step-by-step instructions shown when staff opens the task. */
  instructions?: string;
  /** Optional cleaning chemical / detergent label. */
  chemical?: string;
  /** Active flag — false hides the task from "due today". */
  active: boolean;
  createdAt: string;
}

export interface CleaningCompletion {
  id: string;
  taskId: string;
  /** ISO timestamp of completion. */
  completedAt: string;
  /** Employee id (or free text initials for paper-mode). */
  by: string;
  note?: string;
  /** base64 / file URI of optional photo proof. */
  photoUri?: string;
  /** If this entry was corrected after the fact, the reason for the change. */
  correctionNote?: string;
  /** ISO timestamp of the correction. */
  correctedAt?: string;
  /** Who made the correction. */
  correctedBy?: string;
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
  // ---- Master cleaning schedule (HACCP) ----
  cleaningTasks: CleaningTask[];
  cleaningLog: CleaningCompletion[];
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
  // ---- TSE / cash register (T011, Voll-Modus only) ----
  /**
   * Legacy single-register config. Kept for migration — new code should
   * use `tseConfigs[locationId]` instead.
   */
  tseConfig?: TseConfig;
  /**
   * Per-location TSE configurations. Key = Location.id (or "primary" when
   * no locations are configured). Each physical Kasse must have its own entry —
   * KassenSichV §146a AO requires a separate TSE and gap-free Belegnummer
   * series per cash register.
   */
  tseConfigs?: Record<string, TseConfig>;
  signedSales: SignedSale[];
  // ---- Operating mode ----
  /**
   * Application operating mode:
   * - "lite": Staff/operations assistant only — NO legally binding fiscal data.
   *   For kitchens with a separate POS. Hides cash register, TSE signing, DSFinV-K export.
   * - "full": Full cash register + tax-compliant mode (TSE/KassenSichV/DSFinV-K).
   *   Sales become legally binding receipts; requires fiskaly TSE setup.
   */
  appMode: AppMode;
  // ---- T013: HACCP automation + Rückstellproben + Subscription ----
  /** Rückstellproben — auto-captured from production, 7-day retention. */
  foodSamples: FoodSample[];
  /** Subscription tier + paid add-ons (e.g. BLE thermometers). */
  subscription: Subscription;
  /**
   * Optional default storage location used for auto-created Rückstellproben.
   * If not set, the first "fridge" StorageLocation is used.
   */
  sampleStorageLocationId?: string;
  // ---- T014: DGE-Qualitätsstandard ----
  /**
   * Active DGE-Qualitätsstandard for menu compliance scoring.
   * undefined → feature off; user must opt in via Settings.
   * Each value maps to a different rule set (Schule has lots of variety
   * requirements; Senioren focuses on hydration + protein adequacy; etc.).
   */
  dgeStandard?: DgeStandard;
}

// ─── T014: DGE-Qualitätsstandard ────────────────────────────────────────────
//
// Deutsche Gesellschaft für Ernährung publishes binding quality standards
// for community catering (school, daycare, hospital, senior). Public
// procurement tenders increasingly require DGE certification — and yet no
// kitchen SaaS competitor ships automated scoring. KitchenOS does.

/**
 * Which DGE quality standard a customer is operating against.
 * Each maps to a different rule set in `lib/dge.ts`.
 */
export type DgeStandard = "schule" | "kita" | "krankenhaus" | "senioren";

/**
 * One scoring criterion against a single DGE rule (e.g. "≥1 sea fish/week").
 * `current` and `required` are counted across the scoring window (typically
 * a 7-day plan). `met` is `current >= required` for "≥" rules and
 * `current <= maxAllowed` for "≤" rules.
 */
export interface DgeCriterionResult {
  /** Stable rule id (used for i18n + recommendations). */
  id: string;
  /** German label as shipped (UI also has English fallback in lib/dge.ts). */
  label: string;
  /** "min" → at-least, "max" → at-most. */
  kind: "min" | "max";
  /** Threshold count over the window. */
  threshold: number;
  /** What we measured in the actual menu. */
  current: number;
  /** Whether the rule is satisfied. */
  met: boolean;
  /** Importance weight (0..1) for overall score weighting. */
  weight: number;
}

/**
 * The full result of scoring a menu plan against a DGE standard.
 * Cheap to recompute (pure function) — we do NOT persist this.
 */
export interface DgeScore {
  standard: DgeStandard;
  /** ISO date (inclusive) — first day of the window. */
  fromDate: string;
  /** ISO date (inclusive) — last day of the window. */
  toDate: string;
  /** Number of menu days covered (typically 7). */
  daysCount: number;
  /** Number of days in the window that actually had any planned recipes. */
  daysWithMenu: number;
  /** 0..100. Weighted average across criteria, met=1.0 / unmet=0.0. */
  overall: number;
  criteria: DgeCriterionResult[];
  /** Auto-generated, German-localised next-action suggestions. */
  recommendations: string[];
}

// ─── T013a: Subscription tiers ──────────────────────────────────────────────

export type SubscriptionTier = "starter" | "professional" | "enterprise";

/** Paid add-ons billed on top of the base tier. */
export interface SubscriptionAddons {
  /** Live Bluetooth thermometer integration (Inkbird, Thermapen). +€19/Monat. */
  bleThermometers: boolean;
  /** Multi-site / multi-location consolidation reports. +€29/Monat. */
  multiSite: boolean;
  /** Advanced AI: plate-photo waste vision + email price ingest. +€39/Monat. */
  advancedAi: boolean;
}

export interface Subscription {
  tier: SubscriptionTier;
  addons: SubscriptionAddons;
  /** ISO date of next renewal (for UI display only — billing handled externally). */
  renewsAt?: string;
}

/** Voice options for the Kios assistant. Mapped to ElevenLabs voice IDs server-side. */
export type KiosVoice = "sarah" | "charlotte" | "antoni";

/** Operating mode — gates fiscal/cash-register features. See AppState.appMode. */
export type AppMode = "lite" | "full";

// ─── TSE / KassenSichV (T011) ───────────────────────────────────────────────

/** Provider used to back the TSE signing endpoint. */
export type TseProvider = "stub" | "fiskaly_sandbox" | "fiskaly_prod";

/** Cash-register / TSE configuration. Required when appMode === "full". */
export interface TseConfig {
  /** Permanent Kassen-Identifikationsnummer (assigned per BMF Mitteilungspflicht §146a AO). */
  kassennummer: string;
  /** Steuernummer or USt-IdNr. of the operator. */
  taxId: string;
  /** Active provider. "stub" = local HMAC dev signing. */
  provider: TseProvider;
  /** Cached TSE serial returned by the provider (immutable per TSE module). */
  serialNumber?: string;
  /** Last successful sign timestamp. */
  lastSignedAt?: string;
  /** Fiskaly client/TSS id when using a real cloud provider. */
  fiskalyClientId?: string;
  fiskalyTssId?: string;
}

/** A SaleEntry with its TSE signature attached. KassenSichV §6 mandatory fields. */
export interface SignedSale extends SaleEntry {
  /** Sequential transaction number (Belegnummer) per cash register, gap-free. */
  tseTxNumber: number;
  /** TSE serial number that produced the signature (Seriennummer der TSE). */
  tseSerial: string;
  /** Per-TSE monotonically increasing signature counter. */
  tseSignatureCounter: number;
  /** base64 signature (KassenSichV §2). */
  tseSignature: string;
  /** ISO timestamp of signing — must match what the TSE recorded. */
  tseTime: string;
  /** Belegtyp per BMF, default "Kassenbeleg-V1". */
  processType: string;
  /** Process-data string fed into the TSE (Beleginhalt). */
  processData: string;
  /** Provider used when this signature was created. */
  provider: TseProvider;
  /** VAT rate applied to the sale (7 / 19 / 0). */
  vatPct: number;
}

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

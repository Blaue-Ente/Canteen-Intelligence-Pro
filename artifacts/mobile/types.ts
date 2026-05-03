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
  updatedAt: string;
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
  /** Per-recipe portion override (grams) for this day. */
  portionOverrides?: Record<string, number>;
}

export interface AuditFields {
  createdBy?: string;
  createdByName?: string;
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
}

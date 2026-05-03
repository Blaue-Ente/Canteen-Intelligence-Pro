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
}

export interface SaleEntry {
  id: string;
  date: string;
  recipeId: string;
  cooked: number;
  sold: number;
  revenue: number;
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

export interface ComplaintDraft {
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

export interface HaccpLog {
  id: string;
  date: string;
  type: "fridge" | "freezer" | "delivery" | "cleaning" | "cooking";
  location: string;
  temperature?: number;
  note?: string;
  ok: boolean;
}

export interface WasteEntry {
  id: string;
  date: string;
  recipeId?: string;
  inventoryId?: string;
  grams: number;
  reason: "spoilage" | "overproduction" | "preparation" | "plate";
  cost: number;
}

export interface CateringRequest {
  id: string;
  receivedAt: string;
  fromEmail: string;
  subject: string;
  body: string;
  guests: number;
  date: string;
  parsed: { recipeIds: string[]; notes: string }[];
  status: "new" | "draft" | "confirmed" | "rejected";
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
  chat: ChatMessage[];
}

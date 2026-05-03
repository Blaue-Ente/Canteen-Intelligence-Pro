import type {
  AppState,
  InventoryItem,
  Location,
  Recipe,
  SaleEntry,
  Supplier,
  HaccpLog,
  WasteEntry,
  CateringRequest,
  MenuDayEntry,
  Employee,
  NotificationPrefs,
} from "@/types";

const today = new Date();
const iso = (d: Date) => d.toISOString();
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

const inventory: InventoryItem[] = [
  { id: "i1", name: "Beef chuck", nameDe: "Rindergulasch", unit: "kg", quantity: 4.2, minQuantity: 5, pricePerUnit: 14.5, category: "meat", supplierId: "s1", expiresAt: iso(addDays(today, 3)), location: "Kühlung 1", updatedAt: iso(today), kcalPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 16, co2PerKg: 27, dgeCategory: "red" },
  { id: "i2", name: "Pork loin", nameDe: "Schweinelende", unit: "kg", quantity: 8.1, minQuantity: 4, pricePerUnit: 9.2, category: "meat", supplierId: "s1", expiresAt: iso(addDays(today, 4)), location: "Kühlung 1", updatedAt: iso(today), kcalPer100g: 240, proteinPer100g: 27, carbsPer100g: 0, fatPer100g: 14, co2PerKg: 7.2, dgeCategory: "yellow" },
  { id: "i3", name: "Chicken breast", nameDe: "Hähnchenbrust", unit: "kg", quantity: 6.0, minQuantity: 5, pricePerUnit: 8.9, category: "meat", supplierId: "s1", expiresAt: iso(addDays(today, 2)), location: "Kühlung 1", updatedAt: iso(today), kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, co2PerKg: 6.1, dgeCategory: "yellow" },
  { id: "i4", name: "Potatoes", nameDe: "Kartoffeln", unit: "kg", quantity: 12, minQuantity: 20, pricePerUnit: 1.4, category: "vegetable", supplierId: "s2", location: "Trocken", updatedAt: iso(today), kcalPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1, co2PerKg: 0.3, dgeCategory: "green", regional: true },
  { id: "i5", name: "Onions", nameDe: "Zwiebeln", unit: "kg", quantity: 9, minQuantity: 5, pricePerUnit: 1.1, category: "vegetable", supplierId: "s2", location: "Trocken", updatedAt: iso(today), kcalPer100g: 40, proteinPer100g: 1.1, carbsPer100g: 9.3, fatPer100g: 0.1, co2PerKg: 0.5, dgeCategory: "green", regional: true },
  { id: "i6", name: "Carrots", nameDe: "Karotten", unit: "kg", quantity: 7, minQuantity: 3, pricePerUnit: 1.3, category: "vegetable", supplierId: "s2", updatedAt: iso(today), kcalPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, co2PerKg: 0.4, dgeCategory: "green", regional: true },
  { id: "i7", name: "Tomatoes", nameDe: "Tomaten", unit: "kg", quantity: 4.5, minQuantity: 4, pricePerUnit: 2.6, category: "vegetable", supplierId: "s2", expiresAt: iso(addDays(today, 5)), updatedAt: iso(today), kcalPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, co2PerKg: 1.1, dgeCategory: "green" },
  { id: "i8", name: "Cream", nameDe: "Sahne", unit: "l", quantity: 3, minQuantity: 2, pricePerUnit: 2.1, category: "dairy", supplierId: "s3", expiresAt: iso(addDays(today, 7)), updatedAt: iso(today), kcalPer100g: 340, proteinPer100g: 2, carbsPer100g: 3, fatPer100g: 36, co2PerKg: 3.0, dgeCategory: "yellow", allergens: ["milk"] },
  { id: "i9", name: "Butter", nameDe: "Butter", unit: "kg", quantity: 2.4, minQuantity: 1, pricePerUnit: 7.8, category: "dairy", supplierId: "s3", updatedAt: iso(today), kcalPer100g: 717, proteinPer100g: 0.9, carbsPer100g: 0.1, fatPer100g: 81, co2PerKg: 12.0, dgeCategory: "red", allergens: ["milk"] },
  { id: "i10", name: "Flour", nameDe: "Mehl", unit: "kg", quantity: 18, minQuantity: 8, pricePerUnit: 0.9, category: "dry", supplierId: "s4", updatedAt: iso(today), kcalPer100g: 364, proteinPer100g: 10, carbsPer100g: 76, fatPer100g: 1, co2PerKg: 0.7, dgeCategory: "green", allergens: ["gluten"] },
  { id: "i11", name: "Lentils", nameDe: "Linsen", unit: "kg", quantity: 5.5, minQuantity: 3, pricePerUnit: 2.4, category: "dry", supplierId: "s4", updatedAt: iso(today), kcalPer100g: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4, co2PerKg: 0.9, dgeCategory: "green" },
  { id: "i12", name: "Salmon fillet", nameDe: "Lachsfilet", unit: "kg", quantity: 2.8, minQuantity: 2, pricePerUnit: 22, category: "frozen", supplierId: "s5", updatedAt: iso(today), kcalPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, co2PerKg: 5.1, dgeCategory: "yellow", allergens: ["fish"] },
  { id: "i13", name: "Olive oil", nameDe: "Olivenöl", unit: "l", quantity: 6, minQuantity: 3, pricePerUnit: 8.5, category: "dry", supplierId: "s4", updatedAt: iso(today), kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, co2PerKg: 6.0, dgeCategory: "yellow" },
  { id: "i14", name: "Salt", nameDe: "Salz", unit: "kg", quantity: 4, minQuantity: 1, pricePerUnit: 0.5, category: "spice", updatedAt: iso(today), co2PerKg: 0.2, dgeCategory: "green" },
  { id: "i15", name: "Pepper", nameDe: "Pfeffer", unit: "kg", quantity: 0.4, minQuantity: 0.2, pricePerUnit: 22, category: "spice", updatedAt: iso(today), co2PerKg: 1.2, dgeCategory: "green" },
];

const recipes: Recipe[] = [
  { id: "r1", name: "Schnitzel with potatoes", nameDe: "Schnitzel mit Kartoffeln", type: "main", category: "meat", meat: "pork", portionGrams: 420, ingredients: [{ inventoryId: "i2", grams: 200 }, { inventoryId: "i4", grams: 200 }, { inventoryId: "i10", grams: 30 }, { inventoryId: "i9", grams: 20 }], allergens: ["gluten", "egg"], steps: ["Pound pork", "Bread", "Fry", "Boil potatoes", "Plate"], stepsDe: ["Schweinelende klopfen", "Panieren", "In Butter braten", "Kartoffeln kochen", "Anrichten"], basePrice: 3.8, sellPrice: 13.9, cookTimeMin: 25, kcalPerPortion: 720, source: "internal" },
  { id: "r2", name: "Lentil soup", nameDe: "Linsensuppe", type: "soup", category: "vegan", meat: "none", portionGrams: 350, ingredients: [{ inventoryId: "i11", grams: 80 }, { inventoryId: "i5", grams: 40 }, { inventoryId: "i6", grams: 50 }], allergens: ["celery"], steps: ["Sauté onions", "Add lentils", "Simmer 30 min"], stepsDe: ["Zwiebeln anbraten", "Linsen dazugeben", "30 min köcheln"], basePrice: 1.1, sellPrice: 5.9, cookTimeMin: 45, kcalPerPortion: 320, source: "internal" },
  { id: "r3", name: "Goulash", nameDe: "Rindergulasch", type: "main", category: "meat", meat: "beef", portionGrams: 450, ingredients: [{ inventoryId: "i1", grams: 220 }, { inventoryId: "i5", grams: 60 }, { inventoryId: "i7", grams: 80 }], allergens: [], steps: ["Brown beef", "Add onions, paprika", "Simmer 90 min"], stepsDe: ["Rindfleisch anbraten", "Zwiebeln, Paprika dazu", "90 min schmoren"], basePrice: 4.5, sellPrice: 15.9, cookTimeMin: 110, kcalPerPortion: 680, source: "internal" },
  { id: "r4", name: "Grilled salmon", nameDe: "Gegrillter Lachs", type: "main", category: "fish", meat: "none", portionGrams: 380, ingredients: [{ inventoryId: "i12", grams: 180 }, { inventoryId: "i13", grams: 10 }], allergens: ["fish"], steps: ["Season salmon", "Grill 4 min/side", "Serve with veg"], stepsDe: ["Lachs würzen", "4 min/Seite grillen", "Mit Gemüse servieren"], basePrice: 5.2, sellPrice: 18.5, cookTimeMin: 15, kcalPerPortion: 540, source: "internal" },
  { id: "r5", name: "Caesar salad", nameDe: "Caesar Salat", type: "salad", category: "vegetarian", meat: "none", portionGrams: 280, ingredients: [{ inventoryId: "i7", grams: 60 }, { inventoryId: "i9", grams: 10 }], allergens: ["gluten", "egg", "milk"], steps: ["Wash lettuce", "Dress", "Top croutons"], stepsDe: ["Salat waschen", "Dressing", "Croutons"], basePrice: 1.8, sellPrice: 8.9, cookTimeMin: 10, kcalPerPortion: 410, source: "internal" },
  { id: "r6", name: "Chicken curry", nameDe: "Hähnchen-Curry", type: "main", category: "meat", meat: "chicken", portionGrams: 410, ingredients: [{ inventoryId: "i3", grams: 180 }, { inventoryId: "i8", grams: 80 }, { inventoryId: "i5", grams: 40 }], allergens: ["milk"], steps: ["Sear chicken", "Curry paste", "Cream", "Simmer"], stepsDe: ["Hähnchen anbraten", "Currypaste", "Sahne", "Köcheln"], basePrice: 3.4, sellPrice: 12.9, cookTimeMin: 30, kcalPerPortion: 620, source: "internal" },
  { id: "r7", name: "Apple strudel", nameDe: "Apfelstrudel", type: "dessert", category: "vegetarian", meat: "none", portionGrams: 180, ingredients: [{ inventoryId: "i10", grams: 50 }, { inventoryId: "i9", grams: 20 }], allergens: ["gluten", "milk", "egg"], steps: ["Roll dough", "Fill apples", "Bake 30 min"], stepsDe: ["Teig ausrollen", "Äpfel füllen", "30 min backen"], basePrice: 0.9, sellPrice: 4.9, cookTimeMin: 45, kcalPerPortion: 380, source: "internal" },
  { id: "r8", name: "Roasted vegetables", nameDe: "Ofengemüse", type: "main", category: "vegan", meat: "none", portionGrams: 350, ingredients: [{ inventoryId: "i4", grams: 150 }, { inventoryId: "i6", grams: 100 }, { inventoryId: "i13", grams: 15 }], allergens: [], steps: ["Cut veg", "Oil & season", "Roast 35 min"], stepsDe: ["Gemüse schneiden", "Öl & würzen", "35 min rösten"], basePrice: 1.2, sellPrice: 7.9, cookTimeMin: 45, kcalPerPortion: 350, source: "internal" },
];

const suppliers: Supplier[] = [
  { id: "s1", name: "Müller Fleisch GmbH", contact: "Hans Müller", phone: "+49 30 1234567", email: "info@mueller-fleisch.de", address: "Hauptstr. 12, 10115 Berlin", lat: 52.532, lng: 13.385, category: ["meat"], rating: 4.7 },
  { id: "s2", name: "Berliner Gemüse", contact: "Anna Berg", phone: "+49 30 7654321", email: "kontakt@b-gemuese.de", address: "Marktplatz 4, 10117 Berlin", lat: 52.520, lng: 13.405, category: ["vegetable", "fruit"], rating: 4.5 },
  { id: "s3", name: "MilchHof Brandenburg", contact: "Peter Schmidt", phone: "+49 33 4445566", email: "service@milchhof.de", address: "Dorfstr. 7, 14467 Potsdam", lat: 52.395, lng: 13.058, category: ["dairy"], rating: 4.8 },
  { id: "s4", name: "Großhandel Hansa", contact: "Klaus Werner", phone: "+49 30 9988776", email: "order@hansa-gh.de", address: "Industriestr. 22, 12099 Berlin", lat: 52.450, lng: 13.380, category: ["dry", "spice"], rating: 4.3 },
  { id: "s5", name: "Nordsee Fisch", contact: "Maja Holm", phone: "+49 40 2233445", email: "berlin@nordseefisch.de", address: "Fischmarkt 1, 10245 Berlin", lat: 52.510, lng: 13.448, category: ["fish", "frozen"], rating: 4.6 },
];

const menu: MenuDayEntry[] = Array.from({ length: 7 }).map((_, i) => {
  const d = dateKey(addDays(today, i));
  const sets = [
    ["r2", "r1", "r5"],
    ["r3", "r8", "r7"],
    ["r6", "r5", "r2"],
    ["r4", "r8", "r7"],
    ["r1", "r2", "r5"],
    ["r3", "r6", "r7"],
    ["r4", "r8", "r5"],
  ];
  return { date: d, recipeIds: sets[i] ?? [] };
});

const sales: SaleEntry[] = [];
for (let i = 0; i < 28; i++) {
  const d = dateKey(addDays(today, -i));
  recipes.forEach((r) => {
    const cooked = 8 + Math.floor(Math.random() * 18);
    const sold = Math.max(0, cooked - Math.floor(Math.random() * 4));
    sales.push({
      id: `sale_${d}_${r.id}`,
      date: d,
      recipeId: r.id,
      cooked,
      sold,
      revenue: sold * r.sellPrice,
    });
  });
}

const haccp: HaccpLog[] = [
  { id: "h1", date: iso(today), type: "fridge", location: "Kühlung 1", temperature: 4, ok: true },
  { id: "h2", date: iso(today), type: "freezer", location: "Tiefkühler", temperature: -19, ok: true },
  { id: "h3", date: iso(addDays(today, -1)), type: "delivery", location: "Wareneingang", temperature: 6, note: "Müller Fleisch", ok: true },
];

const waste: WasteEntry[] = [
  { id: "w1", date: iso(addDays(today, -1)), recipeId: "r2", grams: 1200, reason: "overproduction", cost: 4.2 },
  { id: "w2", date: iso(addDays(today, -2)), inventoryId: "i7", grams: 800, reason: "spoilage", cost: 2.1 },
];

const catering: CateringRequest[] = [
  {
    id: "c1",
    receivedAt: iso(today),
    fromEmail: "office@firma-acme.de",
    subject: "Catering Anfrage 35 Personen",
    body: "Sehr geehrte Damen und Herren, wir benötigen am Freitag Catering für 35 Personen, vegetarisch und Fleisch gemischt.",
    guests: 35,
    date: dateKey(addDays(today, 5)),
    parsed: [
      { recipeIds: ["r1", "r6", "r5"], notes: "Mischung Fleisch + Vegetarisch" },
      { recipeIds: ["r8", "r7"], notes: "Vegan + Dessert" },
    ],
    status: "new",
  },
];

const employees: Employee[] = [
  { id: "e1", name: "Markus Weber", role: "chef", color: "#f59e0b", weeklyHours: 40, phone: "+49 170 1112233" },
  { id: "e2", name: "Lena Krüger", role: "cook", color: "#10b981", weeklyHours: 35, phone: "+49 170 4445566" },
  { id: "e3", name: "Tobias Klein", role: "kitchen_help", color: "#6366f1", weeklyHours: 25 },
  { id: "e4", name: "Sara Hoffmann", role: "service", color: "#ec4899", weeklyHours: 30 },
];

const notificationPrefs: NotificationPrefs = {
  enabled: false,
  lowStock: true,
  expiring: true,
  tagesabschluss: true,
  tagesabschlussTime: "21:30",
  haccpReminder: true,
  haccpTime: "08:30",
};

const locations: Location[] = [
  { id: "loc1", name: "Mitte", code: "MTE", address: "Friedrichstr. 100, 10117 Berlin", lat: 52.52, lng: 13.39, avgGuestsPerDay: 180, isPrimary: true, createdAt: iso(today) },
  { id: "loc2", name: "Kreuzberg", code: "KRZ", address: "Bergmannstr. 22, 10961 Berlin", lat: 52.49, lng: 13.40, avgGuestsPerDay: 140, createdAt: iso(today) },
  { id: "loc3", name: "Spandau", code: "SPN", address: "Carl-Schurz-Str. 5, 13597 Berlin", lat: 52.54, lng: 13.20, avgGuestsPerDay: 95, createdAt: iso(today) },
];

export const seedState: AppState = {
  locale: "de",
  inventory,
  recipes,
  menu,
  sales,
  suppliers,
  complaints: [],
  haccp,
  waste,
  catering,
  orders: [],
  chat: [],
  inventurs: [],
  employees,
  shifts: [],
  notificationPrefs,
  locations,
  currentLocationId: undefined,
  handovers: [],
  deliveries: [],
  priceHistory: [],
  forecasts: [],
};

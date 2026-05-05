/**
 * Three pre-built demo states used when a demo user signs in. Each variant
 * paints a different operating profile so the same app feels coherent
 * regardless of which demo a visitor lands in.
 *
 * All three derive from the canonical `seedState` and override only the
 * fields that distinguish them — keeps the bundles small and ensures any
 * new field added to AppState automatically gets a sensible default.
 */
import type {
  AppState,
  CateringEvent,
  CompanyProfile,
  DgeStandard,
  Employee,
  InventoryItem,
  MenuDayEntry,
  Recipe,
  SaleEntry,
  WasteEntry,
} from "@/types";
import { seedState } from "./seedData";

import type { DemoVariant } from "@/lib/demoConfig";

const today = new Date();
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dateKey = (d: Date): string => d.toISOString().slice(0, 10);
const iso = (d: Date): string => d.toISOString();

// ─── Kantine München ────────────────────────────────────────────────────────
// Daily mid-size canteen, ~200 portions/day, mixed menu, full feature set
// active. Closest to the canonical seed — minimal overrides.

const kantineCompany: CompanyProfile = {
  name: "Kantine am Marienplatz GmbH",
  address: "Sendlinger Str. 12, 80331 München",
  iban: "DE12 7019 0000 0000 1234 56",
  taxId: "143/234/01234",
  email: "leitung@kantine-marienplatz.de",
  phone: "+49 89 123 456 78",
};

function buildKantine(): AppState {
  return {
    ...seedState,
    companyProfile: kantineCompany,
    appMode: "lite",
  };
}

// ─── Bio-Schulmensa ─────────────────────────────────────────────────────────
// Vegan/vegetarian-leaning, kid-friendly portions, DGE strict.

const schuleCompany: CompanyProfile = {
  name: "Bio-Schulmensa Schwabing e.V.",
  address: "Schellingstr. 75, 80799 München",
  iban: "DE34 7019 0024 1100 4400 22",
  taxId: "143/567/02345",
  email: "kueche@bio-schule-schwabing.de",
  phone: "+49 89 555 22 11",
};

const schuleRecipes: Recipe[] = [
  { id: "r-s-1", name: "Lentil bolognese with whole-grain pasta", nameDe: "Linsen-Bolognese mit Vollkornpasta", type: "main", category: "vegan", meat: "none", portionGrams: 320, ingredients: [{ inventoryId: "i11", grams: 70 }, { inventoryId: "i7", grams: 100 }, { inventoryId: "i10", grams: 80 }], allergens: ["gluten", "celery"], steps: ["Soak lentils", "Sauté onions", "Simmer", "Cook pasta", "Combine"], stepsDe: ["Linsen einweichen", "Zwiebeln anbraten", "Köcheln", "Pasta kochen", "Mischen"], basePrice: 1.4, sellPrice: 4.2, cookTimeMin: 35, kcalPerPortion: 410, source: "internal" },
  { id: "r-s-2", name: "Vegetable curry with brown rice", nameDe: "Gemüsecurry mit Naturreis", type: "main", category: "vegan", meat: "none", portionGrams: 340, ingredients: [{ inventoryId: "i6", grams: 80 }, { inventoryId: "i4", grams: 80 }, { inventoryId: "i13", grams: 12 }], allergens: [], steps: ["Cut veg", "Toast spices", "Simmer", "Serve over rice"], stepsDe: ["Gemüse schneiden", "Gewürze anrösten", "Köcheln", "Mit Reis servieren"], basePrice: 1.2, sellPrice: 3.9, cookTimeMin: 30, kcalPerPortion: 380, source: "internal" },
  { id: "r-s-3", name: "Spelt pancakes with apple compote", nameDe: "Dinkelpfannkuchen mit Apfelmus", type: "main", category: "vegetarian", meat: "none", portionGrams: 280, ingredients: [{ inventoryId: "i10", grams: 70 }, { inventoryId: "i8", grams: 50 }, { inventoryId: "i9", grams: 15 }], allergens: ["gluten", "milk", "egg"], steps: ["Mix batter", "Fry pancakes", "Stew apples", "Serve"], stepsDe: ["Teig rühren", "Pfannkuchen backen", "Äpfel dünsten", "Servieren"], basePrice: 0.9, sellPrice: 3.5, cookTimeMin: 25, kcalPerPortion: 420, source: "internal" },
  { id: "r-s-4", name: "Carrot-ginger soup", nameDe: "Möhren-Ingwer-Suppe", type: "soup", category: "vegan", meat: "none", portionGrams: 280, ingredients: [{ inventoryId: "i6", grams: 150 }, { inventoryId: "i5", grams: 30 }], allergens: [], steps: ["Boil carrots & onion", "Add ginger", "Blend"], stepsDe: ["Möhren & Zwiebel kochen", "Ingwer dazu", "Pürieren"], basePrice: 0.6, sellPrice: 2.8, cookTimeMin: 25, kcalPerPortion: 180, source: "internal" },
  { id: "r-s-5", name: "Couscous salad with chickpeas", nameDe: "Couscous-Salat mit Kichererbsen", type: "salad", category: "vegan", meat: "none", portionGrams: 250, ingredients: [{ inventoryId: "i7", grams: 60 }, { inventoryId: "i13", grams: 8 }], allergens: ["gluten"], steps: ["Cook couscous", "Toss with veg & chickpeas", "Dress"], stepsDe: ["Couscous kochen", "Mit Gemüse & Kichererbsen mischen", "Anmachen"], basePrice: 0.8, sellPrice: 3.4, cookTimeMin: 15, kcalPerPortion: 320, source: "internal" },
  { id: "r-s-6", name: "Banana-oat porridge", nameDe: "Bananen-Hafer-Brei", type: "dessert", category: "vegetarian", meat: "none", portionGrams: 220, ingredients: [{ inventoryId: "i8", grams: 100 }], allergens: ["milk", "gluten"], steps: ["Cook oats in milk", "Slice banana", "Top"], stepsDe: ["Hafer in Milch kochen", "Banane schneiden", "Garnieren"], basePrice: 0.5, sellPrice: 2.2, cookTimeMin: 12, kcalPerPortion: 260, source: "internal" },
  { id: "r-s-7", name: "Roasted root vegetables", nameDe: "Geröstetes Wurzelgemüse", type: "main", category: "vegan", meat: "none", portionGrams: 300, ingredients: [{ inventoryId: "i6", grams: 120 }, { inventoryId: "i4", grams: 120 }, { inventoryId: "i13", grams: 10 }], allergens: [], steps: ["Cube veg", "Oil", "Roast 35 min"], stepsDe: ["Gemüse würfeln", "Ölen", "35 min rösten"], basePrice: 0.9, sellPrice: 3.6, cookTimeMin: 45, kcalPerPortion: 290, source: "internal" },
  { id: "r-s-8", name: "Apple-cinnamon strudel", nameDe: "Apfel-Zimt-Strudel", type: "dessert", category: "vegetarian", meat: "none", portionGrams: 160, ingredients: [{ inventoryId: "i10", grams: 50 }, { inventoryId: "i9", grams: 18 }], allergens: ["gluten", "milk", "egg"], steps: ["Roll dough", "Fill apples", "Bake"], stepsDe: ["Teig ausrollen", "Äpfel füllen", "Backen"], basePrice: 0.7, sellPrice: 2.4, cookTimeMin: 35, kcalPerPortion: 320, source: "internal" },
];

const schuleInventory: InventoryItem[] = seedState.inventory
  .filter((i) => i.category !== "meat" && i.category !== "frozen")
  .map((i) => ({ ...i }));

const schuleEmployees: Employee[] = [
  { id: "e-s-1", name: "Anja Vogel", role: "chef", color: "#10b981", weeklyHours: 35, phone: "+49 170 1112233" },
  { id: "e-s-2", name: "Bernd Klotz", role: "cook", color: "#f59e0b", weeklyHours: 30 },
  { id: "e-s-3", name: "Clara Sommer", role: "kitchen_help", color: "#6366f1", weeklyHours: 20 },
];

const schuleMenu: MenuDayEntry[] = Array.from({ length: 14 }).map((_, i) => {
  const d = dateKey(addDays(today, i - 7));
  const sets = [
    ["r-s-1", "r-s-4", "r-s-6"],
    ["r-s-2", "r-s-5", "r-s-8"],
    ["r-s-3", "r-s-4", "r-s-6"],
    ["r-s-7", "r-s-5", "r-s-8"],
    ["r-s-1", "r-s-4", "r-s-6"],
  ];
  return { date: d, recipeIds: sets[i % sets.length] ?? [] };
});

const schuleSales: SaleEntry[] = (() => {
  const out: SaleEntry[] = [];
  for (let day = 0; day < 21; day++) {
    const d = dateKey(addDays(today, -day));
    // School: ~120 portions/day, weekday-only
    const isWeekend = [0, 6].includes(addDays(today, -day).getDay());
    if (isWeekend) continue;
    const recipes = ["r-s-1", "r-s-2", "r-s-3", "r-s-7"];
    recipes.forEach((rid, idx) => {
      const portions = 25 + Math.floor(Math.random() * 15);
      out.push({
        id: `sale-s-${day}-${idx}`,
        date: d,
        recipeId: rid,
        cooked: portions + 4,
        sold: portions,
        revenue: portions * 3.8,
      });
    });
  }
  return out;
})();

const schuleEvents: CateringEvent[] = [
  {
    id: "ev-s-1",
    title: "Sommerfest Klasse 4b",
    clientName: "Elternbeirat Klasse 4b",
    clientEmail: "klasse-4b@bio-schule-schwabing.de",
    eventDate: dateKey(addDays(today, 18)),
    eventTime: "16:00",
    venue: "Schulhof",
    guestCount: 90,
    status: "bestaetigt",
    menuItems: [
      { recipeId: "r-s-3", recipeName: "Dinkelpfannkuchen", portions: 90, pricePerPortion: 3.5 },
      { recipeId: "r-s-5", recipeName: "Couscous-Salat", portions: 90, pricePerPortion: 3.4 },
      { recipeId: "r-s-6", recipeName: "Bananen-Hafer-Brei", portions: 90, pricePerPortion: 2.2 },
    ],
    staffCost: 180,
    equipmentCost: 60,
    transportCost: 0,
    overheadPct: 10,
    vatPct: 7,
    notes: "Allergiker-Liste vorhanden. Keine Nüsse. Vegan-Option für 12 Kinder.",
    createdAt: iso(addDays(today, -10)),
    updatedAt: iso(addDays(today, -2)),
  },
];

function buildSchule(): AppState {
  return {
    ...seedState,
    companyProfile: schuleCompany,
    recipes: schuleRecipes,
    inventory: schuleInventory,
    menu: schuleMenu,
    sales: schuleSales,
    events: schuleEvents,
    catering: [],
    employees: schuleEmployees,
    appMode: "lite",
    dgeStandard: "schule" as DgeStandard,
    okoEnabled: true,
  };
}

// ─── Event-Catering ─────────────────────────────────────────────────────────
// Events drive the business — many upcoming events, low daily walk-in sales.

const cateringCompany: CompanyProfile = {
  name: "Eventküche Berlin GmbH",
  address: "Linienstraße 88, 10119 Berlin",
  iban: "DE56 1009 0000 5500 7700 11",
  taxId: "27/445/05500",
  email: "events@eventkueche-berlin.de",
  phone: "+49 30 8888 99 00",
};

const cateringEmployees: Employee[] = [
  { id: "e-c-1", name: "Markus Weber", role: "chef", color: "#f59e0b", weeklyHours: 40, phone: "+49 170 1112233" },
  { id: "e-c-2", name: "Lena Krüger", role: "cook", color: "#10b981", weeklyHours: 35 },
  { id: "e-c-3", name: "Tobias Klein", role: "cook", color: "#6366f1", weeklyHours: 35 },
  { id: "e-c-4", name: "Sara Hoffmann", role: "service", color: "#ec4899", weeklyHours: 30 },
  { id: "e-c-5", name: "Jan Bauer", role: "service", color: "#8b5cf6", weeklyHours: 25 },
  { id: "e-c-6", name: "Maja Holm", role: "service", color: "#06b6d4", weeklyHours: 20 },
];

const cateringEvents: CateringEvent[] = [
  // Reuse seed events as a base — they're already realistic — and add more
  // upcoming ones to drive forecast/production planning UIs.
  ...seedState.events,
  {
    id: "ev-c-extra-1",
    title: "Produktlaunch Software AG",
    clientName: "Software AG Deutschland",
    clientEmail: "events@software-ag.de",
    eventDate: dateKey(addDays(today, 10)),
    eventTime: "18:00",
    venue: "Spreepalais am Dom, Anna-Louisa-Karsch-Str. 2, 10178 Berlin",
    guestCount: 220,
    status: "produktion",
    menuItems: [
      { recipeId: "r3", recipeName: "Rindergulasch", portions: 120, pricePerPortion: 16.5 },
      { recipeId: "r8", recipeName: "Ofengemüse", portions: 100, pricePerPortion: 9.8 },
      { recipeId: "r5", recipeName: "Caesar Salat", portions: 220, pricePerPortion: 6.5 },
      { recipeId: "r7", recipeName: "Apfelstrudel", portions: 220, pricePerPortion: 5.5 },
    ],
    staffCost: 1850,
    equipmentCost: 620,
    transportCost: 380,
    overheadPct: 18,
    vatPct: 19,
    notes: "Stehempfang. 4 Bedienstationen. Allergikerliste folgt am Vortag.",
    createdAt: iso(addDays(today, -25)),
    updatedAt: iso(addDays(today, -3)),
  },
  {
    id: "ev-c-extra-2",
    title: "Sommerfest Versicherungsverbund",
    clientName: "Versicherungsverbund Nord eG",
    clientEmail: "office@vv-nord.de",
    eventDate: dateKey(addDays(today, 28)),
    eventTime: "13:00",
    venue: "Tempelhofer Feld, 12101 Berlin",
    guestCount: 480,
    status: "bestaetigt",
    menuItems: [
      { recipeId: "r6", recipeName: "Hähnchen-Curry", portions: 200, pricePerPortion: 12.9 },
      { recipeId: "r8", recipeName: "Ofengemüse", portions: 280, pricePerPortion: 8.9 },
      { recipeId: "r5", recipeName: "Caesar Salat", portions: 480, pricePerPortion: 5.9 },
      { recipeId: "r2", recipeName: "Linsensuppe", portions: 240, pricePerPortion: 4.5 },
    ],
    staffCost: 4200,
    equipmentCost: 1850,
    transportCost: 720,
    overheadPct: 15,
    vatPct: 19,
    notes: "Open-air. Wetterklausel im Vertrag. 2 Foodtrucks + Zentralküche.",
    createdAt: iso(addDays(today, -45)),
    updatedAt: iso(addDays(today, -7)),
  },
  {
    id: "ev-c-extra-3",
    title: "Galadinner Stiftung Kunst",
    clientName: "Stiftung Kunst & Kultur Berlin",
    clientEmail: "kontakt@stiftung-kunst-berlin.de",
    eventDate: dateKey(addDays(today, 55)),
    eventTime: "19:30",
    venue: "Bode-Museum, Am Kupfergraben, 10117 Berlin",
    guestCount: 140,
    status: "angebot",
    menuItems: [
      { recipeId: "r4", recipeName: "Gegrillter Lachs", portions: 100, pricePerPortion: 28.0 },
      { recipeId: "r6", recipeName: "Hähnchen-Curry", portions: 40, pricePerPortion: 18.5 },
      { recipeId: "r5", recipeName: "Caesar Salat", portions: 140, pricePerPortion: 9.5 },
      { recipeId: "r7", recipeName: "Apfelstrudel", portions: 140, pricePerPortion: 8.5 },
    ],
    staffCost: 2100,
    equipmentCost: 480,
    transportCost: 320,
    overheadPct: 20,
    vatPct: 19,
    notes: "Sitzendes Dinner mit Service. Weinbegleitung durch externes Weingut.",
    createdAt: iso(addDays(today, -3)),
    updatedAt: iso(addDays(today, -3)),
  },
  {
    id: "ev-c-extra-4",
    title: "Networking Brunch Tech-Startups",
    clientName: "Berlin Tech Network e.V.",
    clientEmail: "events@berlintech.network",
    eventDate: dateKey(addDays(today, 7)),
    eventTime: "10:00",
    venue: "Factory Berlin, Rheinsberger Str. 76, 10115 Berlin",
    guestCount: 75,
    status: "produktion",
    menuItems: [
      { recipeId: "r5", recipeName: "Caesar Salat", portions: 75, pricePerPortion: 6.9 },
      { recipeId: "r6", recipeName: "Hähnchen-Curry", portions: 50, pricePerPortion: 11.5 },
      { recipeId: "r8", recipeName: "Ofengemüse", portions: 25, pricePerPortion: 8.9 },
      { recipeId: "r7", recipeName: "Apfelstrudel", portions: 75, pricePerPortion: 5.5 },
    ],
    staffCost: 380,
    equipmentCost: 120,
    transportCost: 95,
    overheadPct: 15,
    vatPct: 19,
    notes: "Buffetstil. Vegane Optionen für 30%.",
    createdAt: iso(addDays(today, -18)),
    updatedAt: iso(addDays(today, -2)),
  },
];

const cateringSales: SaleEntry[] = (() => {
  const out: SaleEntry[] = [];
  for (let day = 0; day < 14; day++) {
    const d = dateKey(addDays(today, -day));
    // Catering: lower daily walk-in (~30 portions), revenue concentrated in events
    const portions = 25 + Math.floor(Math.random() * 15);
    out.push({
      id: `sale-c-${day}`,
      date: d,
      recipeId: ["r3", "r6", "r5"][day % 3]!,
      cooked: portions + 6,
      sold: portions,
      revenue: portions * 12.5,
    });
  }
  return out;
})();

const cateringWaste: WasteEntry[] = [];

function buildCatering(): AppState {
  return {
    ...seedState,
    companyProfile: cateringCompany,
    employees: cateringEmployees,
    events: cateringEvents,
    sales: cateringSales,
    waste: cateringWaste,
    appMode: "full",
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function buildDemoSeed(variant: DemoVariant): AppState {
  switch (variant) {
    case "kantine":
      return buildKantine();
    case "schule":
      return buildSchule();
    case "catering":
      return buildCatering();
  }
}

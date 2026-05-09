/**
 * Seed specialized institutional recipes into recipe_library.
 *
 * Covers all four DGE-Qualitätsstandard target groups:
 *   - Schulverpflegung   (tag: schule)
 *   - Kita-Verpflegung   (tag: kita)
 *   - Senioreneinrichtung (tag: senioren)
 *   - Krankenhausverpflegung (tag: krankenhaus)
 *
 * All recipes comply with the respective DGE standard (portion sizes,
 * texture requirements, allergen tagging, nutrient targets).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed:institutional
 */

import { randomUUID } from "crypto";
import { db, recipeLibrary } from "@workspace/db";
import { sql } from "drizzle-orm";

type RecipeInput = typeof recipeLibrary.$inferInsert;

const RECIPES: Omit<RecipeInput, "id" | "basePrice" | "sellPrice">[] = [
  // ────────────────────────────────────────────────────────────────
  // SCHULVERPFLEGUNG (DGE 7. Aufl. 2022)
  // Zielgruppe: Grundschule (6–10 J.) 550–700 kcal, SEK I 700–800 kcal
  // ────────────────────────────────────────────────────────────────
  {
    nameDe: "Vollkornnudeln mit Tomaten-Gemüse-Sauce",
    name: "Whole-grain pasta with tomato vegetable sauce",
    type: "main",
    category: "vegan",
    meat: "none",
    portionGrams: 400,
    cookTimeMin: 25,
    kcalPerPortion: 560,
    protein: 18,
    fat: 8,
    carbs: 95,
    allergens: ["gluten"],
    stepsDe: [
      "Vollkornnudeln nach Packungsanweisung in gesalzenem Wasser al dente kochen.",
      "Zwiebeln und Knoblauch in Olivenöl anschwitzen. Paprika und Zucchini würfeln und 5 Min. mitgaren.",
      "Passierte Tomaten, Tomatenmark, Salz, Pfeffer, Oregano und Basilikum zugeben. 15 Min. köcheln lassen.",
      "Nudeln abgießen, mit der Sauce vermengen. Mit Jodsalz abschmecken.",
    ],
    steps: [
      "Cook whole-grain pasta al dente in salted water.",
      "Sweat onions and garlic in olive oil. Dice peppers and zucchini, cook 5 min.",
      "Add crushed tomatoes, tomato paste, salt, pepper, oregano, basil. Simmer 15 min.",
      "Drain pasta, toss with sauce. Season with iodised salt.",
    ],
    tags: ["schule", "vollkorn", "vegan", "vegetarisch", "kantine", "schnell", "günstig"],
  },
  {
    nameDe: "Seelachsfilet mit Petersilienkartoffeln und Brokkoli",
    name: "Pollock fillet with parsley potatoes and broccoli",
    type: "main",
    category: "fish",
    meat: "none",
    portionGrams: 430,
    cookTimeMin: 30,
    kcalPerPortion: 580,
    protein: 35,
    fat: 12,
    carbs: 65,
    allergens: ["fish"],
    stepsDe: [
      "Kartoffeln schälen, in Salzwasser ca. 20 Min. kochen. Abgießen, mit Butter und gehackter Petersilie schwenken.",
      "Brokkoli in Röschen teilen, in kochendem Salzwasser 5 Min. bissfest garen, abschrecken.",
      "Seelachsfilets mit Zitronensaft, Salz und Pfeffer würzen. In der Pfanne mit wenig Öl je 3–4 Min. pro Seite braten.",
      "Alles auf Tabletts anrichten. Ausgabetemperatur prüfen: ≥ 65 °C.",
    ],
    steps: [
      "Peel potatoes, boil in salted water ~20 min. Drain, toss with butter and chopped parsley.",
      "Cut broccoli into florets, blanch in boiling salted water 5 min, refresh.",
      "Season pollock fillets with lemon juice, salt and pepper. Pan-fry with a little oil 3–4 min per side.",
      "Plate everything. Check serving temperature: ≥ 65 °C.",
    ],
    tags: ["schule", "seefisch", "gesund", "kantine", "dge-schulverpflegung"],
  },
  {
    nameDe: "Linsensuppe mit Vollkornbrot",
    name: "Lentil soup with whole-grain bread",
    type: "soup",
    category: "vegan",
    meat: "none",
    portionGrams: 350,
    cookTimeMin: 40,
    kcalPerPortion: 420,
    protein: 20,
    fat: 6,
    carbs: 68,
    allergens: ["gluten", "celery"],
    stepsDe: [
      "Rote Linsen waschen. Zwiebeln, Karotten und Sellerie würfeln, in Olivenöl anschwitzen.",
      "Linsen zugeben, mit Gemüsebrühe aufgießen (1:3). Kreuzkümmel, Kurkuma, Salz zugeben.",
      "40 Min. köcheln, mit Stabmixer teilweise pürieren (cremige Konsistenz mit Stücken).",
      "Mit Zitronensaft abschmecken. Je 2 Scheiben Vollkornbrot dazu reichen.",
    ],
    steps: [
      "Rinse red lentils. Dice onions, carrots and celery; sweat in olive oil.",
      "Add lentils, pour over vegetable stock (1:3). Add cumin, turmeric, salt.",
      "Simmer 40 min, partially blend (creamy with chunks).",
      "Season with lemon juice. Serve with 2 slices of whole-grain bread.",
    ],
    tags: ["schule", "hülsenfrüchte", "vollkorn", "vegan", "gesund", "dge-schulverpflegung"],
  },
  {
    nameDe: "Hähnchenpfanne mit Naturreis und Zucchini",
    name: "Chicken stir-fry with brown rice and zucchini",
    type: "main",
    category: "meat",
    meat: "chicken",
    portionGrams: 430,
    cookTimeMin: 35,
    kcalPerPortion: 620,
    protein: 38,
    fat: 14,
    carbs: 72,
    allergens: [],
    stepsDe: [
      "Naturreis nach Packungsanweisung kochen (ca. 30 Min.).",
      "Hähnchenbrustfilet in Streifen schneiden. In heißem Öl 6–8 Min. durchgaren (Kerntemperatur ≥ 75 °C).",
      "Zucchini und Paprika in Streifen schneiden, zum Hähnchen geben und 5 Min. mitbraten.",
      "Mit Sojasauce (Jodsalz), Knoblauch und Ingwer abschmecken. Auf Naturreis anrichten.",
    ],
    steps: [
      "Cook brown rice per instructions (~30 min).",
      "Cut chicken breast into strips. Stir-fry in hot oil 6–8 min until cooked through (core temp ≥ 75 °C).",
      "Cut zucchini and peppers into strips, add to chicken and cook 5 min.",
      "Season with soy sauce, garlic and ginger. Serve on brown rice.",
    ],
    tags: ["schule", "vollkorn", "gesund", "geflügel", "dge-schulverpflegung"],
  },
  {
    nameDe: "Gemüsecurry mit Kichererbsen und Basmatireis",
    name: "Vegetable curry with chickpeas and basmati rice",
    type: "main",
    category: "vegan",
    meat: "none",
    portionGrams: 420,
    cookTimeMin: 30,
    kcalPerPortion: 550,
    protein: 16,
    fat: 10,
    carbs: 88,
    allergens: [],
    stepsDe: [
      "Zwiebeln und Knoblauch andünsten. Currypulver, Kurkuma und Kreuzkümmel kurz mitrösten.",
      "Kichererbsen (Dose, abgespült), Karotten und Spinat zugeben.",
      "Kokosmilch (light) und Gemüsebrühe angießen, 20 Min. köcheln.",
      "Mit Salz, Limettensaft abschmecken. Auf Basmatireis servieren.",
    ],
    steps: [
      "Sweat onions and garlic. Briefly toast curry powder, turmeric and cumin.",
      "Add chickpeas (canned, rinsed), carrots and spinach.",
      "Pour in light coconut milk and vegetable stock, simmer 20 min.",
      "Season with salt and lime juice. Serve on basmati rice.",
    ],
    tags: ["schule", "hülsenfrüchte", "vegan", "gesund", "kantine", "dge-schulverpflegung"],
  },

  // ────────────────────────────────────────────────────────────────
  // KITA-VERPFLEGUNG (DGE 7. Aufl. 2022)
  // Zielgruppe: Ü3 (3–6 J.) 350–450 kcal Mittag, weiche Konsistenz
  // ────────────────────────────────────────────────────────────────
  {
    nameDe: "Buntes Gemüse-Nudel-Gratin (Kita)",
    name: "Colourful vegetable pasta gratin (nursery)",
    type: "main",
    category: "vegetarian",
    meat: "none",
    portionGrams: 220,
    cookTimeMin: 35,
    kcalPerPortion: 380,
    protein: 14,
    fat: 12,
    carbs: 52,
    allergens: ["gluten", "milk", "egg"],
    stepsDe: [
      "Nudeln sehr weich kochen (2 Min. über Packungsangabe). Abgießen.",
      "Karotten und Zucchini fein würfeln (< 1 cm), in Butter 8 Min. weich dünsten.",
      "Bechamelsauce kochen: Butter schmelzen, Mehl einrühren, Milch langsam zugeben, abschmecken.",
      "Nudeln, Gemüse und Sauce in Auflaufform schichten. Mit Reibekäse bedecken. 20 Min. bei 180 °C backen.",
      "Abkühlen lassen bis handwarm (< 60 °C) bevor serviert wird. In Kinderportionen à 220 g aufteilen.",
    ],
    steps: [
      "Cook pasta very soft (2 min over pack instructions). Drain.",
      "Finely dice carrots and zucchini (< 1 cm), sweat soft in butter 8 min.",
      "Make béchamel: melt butter, stir in flour, slowly add milk, season.",
      "Layer pasta, vegetables and sauce in baking dish. Cover with grated cheese. Bake 20 min at 180 °C.",
      "Cool to lukewarm (< 60 °C) before serving. Portion into 220 g children's servings.",
    ],
    tags: ["kita", "kindergarten", "weich", "vegetarisch", "kinder", "fingerfood", "dge-kita"],
  },
  {
    nameDe: "Hühnchen-Gemüse-Eintopf mit Vollkornnudeln (Kita)",
    name: "Chicken and vegetable stew with whole-grain pasta (nursery)",
    type: "soup",
    category: "meat",
    meat: "chicken",
    portionGrams: 250,
    cookTimeMin: 35,
    kcalPerPortion: 360,
    protein: 22,
    fat: 9,
    carbs: 42,
    allergens: ["gluten", "celery"],
    stepsDe: [
      "Hähnchenbrustfilet in kleine Würfel schneiden (1 cm), in Hühnerbrühe 15 Min. gar ziehen lassen.",
      "Karotten, Pastinake und Lauch in kleine Ringe schneiden, zugeben und 10 Min. weich kochen.",
      "Vollkornnudeln (kurz: Dinkeli, Hörnchen) sehr weich mitkochen.",
      "Mit Jodsalz und frischer Petersilie abschmecken. Auf Kindertemperatur (40–45 °C) abkühlen lassen.",
    ],
    steps: [
      "Cut chicken breast into small cubes (1 cm), poach in chicken stock 15 min.",
      "Slice carrots, parsnip and leek into small rounds, add and cook 10 min until soft.",
      "Add short whole-grain pasta, cook until very soft.",
      "Season with iodised salt and fresh parsley. Cool to child-safe temperature (40–45 °C).",
    ],
    tags: ["kita", "kindergarten", "weich", "vollkorn", "gesund", "kinder", "dge-kita"],
  },
  {
    nameDe: "Fischfrikadellen mit Kartoffelpüree und Erbsen (Kita)",
    name: "Fish cakes with mashed potatoes and peas (nursery)",
    type: "main",
    category: "fish",
    meat: "none",
    portionGrams: 250,
    cookTimeMin: 30,
    kcalPerPortion: 390,
    protein: 24,
    fat: 11,
    carbs: 46,
    allergens: ["fish", "gluten", "egg"],
    stepsDe: [
      "Seelachsfilet (ohne Haut, ohne Gräten!) sehr fein hacken. Mit Ei, Semmelbröseln, Salz und Dill vermengen.",
      "Kleine Frikadellen (à 50 g) formen — kindergerechte Größe.",
      "In Rapsöl bei mittlerer Hitze je 4 Min. pro Seite goldbraun braten (Kerntemperatur ≥ 72 °C).",
      "Kartoffelstampf kochen: weich, mit Milch und Butter — keine Klumpen!",
      "Tiefgefrorene Erbsen 3 Min. in Salzwasser kochen. Alles auf Kindertellern anrichten.",
    ],
    steps: [
      "Very finely chop pollock fillet (skin-off, bone-free!). Mix with egg, breadcrumbs, salt and dill.",
      "Shape small fish cakes (50 g each) — child-friendly size.",
      "Pan-fry in rapeseed oil over medium heat 4 min per side until golden (core temp ≥ 72 °C).",
      "Cook smooth mashed potatoes with milk and butter — lump-free!",
      "Cook frozen peas 3 min in salted water. Plate on children's dishes.",
    ],
    tags: ["kita", "seefisch", "weich", "kinder", "fingerfood", "dge-kita"],
  },
  {
    nameDe: "Milchreis mit Erdbeersauce (Kita)",
    name: "Rice pudding with strawberry sauce (nursery)",
    type: "dessert",
    category: "vegetarian",
    meat: "none",
    portionGrams: 180,
    cookTimeMin: 30,
    kcalPerPortion: 280,
    protein: 8,
    fat: 5,
    carbs: 50,
    allergens: ["milk"],
    stepsDe: [
      "Milchreis: Rundkornreis mit Vollmilch und einer Prise Salz bei niedriger Hitze 25 Min. ausquellen lassen, gelegentlich rühren.",
      "Am Ende Vanillezucker und eine kleine Menge Honig einrühren (kein Honig für Kinder < 1 Jahr!).",
      "Erdbeeren pürieren, leicht mit Vanillezucker süßen — keine künstlichen Aromen.",
      "Milchreis in Kinderschalen füllen, Sauce darüber träufeln.",
    ],
    steps: [
      "Rice pudding: cook round-grain rice in whole milk with a pinch of salt on low heat 25 min, stir occasionally.",
      "Stir in vanilla sugar and a little honey (no honey for children under 1 year!).",
      "Blend strawberries, lightly sweeten with vanilla sugar — no artificial flavours.",
      "Spoon rice pudding into children's bowls, drizzle with sauce.",
    ],
    tags: ["kita", "dessert", "milch", "kinder", "süß", "dge-kita"],
  },

  // ────────────────────────────────────────────────────────────────
  // SENIORENEINRICHTUNG (DGE 4. Aufl. 2019)
  // Zielgruppe: ≥ 65 J., weiches Essen, hoher Proteinbedarf, IDDSI Level 6–7
  // ────────────────────────────────────────────────────────────────
  {
    nameDe: "Zanderfilet auf Gemüsebett mit Wildreis (IDDSI 7)",
    name: "Pike-perch fillet on vegetable bed with wild rice (IDDSI 7)",
    type: "main",
    category: "fish",
    meat: "none",
    portionGrams: 380,
    cookTimeMin: 35,
    kcalPerPortion: 480,
    protein: 38,
    fat: 14,
    carbs: 42,
    allergens: ["fish"],
    stepsDe: [
      "Wildreis nach Packungsanweisung kochen (ca. 35 Min.).",
      "Zucchini, Karotten und Fenchel in 2 cm Würfel schneiden. In Olivenöl 12 Min. weich dünsten — sehr weich für Senioren.",
      "Zanderfilet mit Zitronensaft, Salz und Dill würzen. Im Backofen bei 180 °C 15 Min. garen (saftig, nicht trocken).",
      "IDDSI Level 7 (normal): Alles anrichten. Fisch in mundgerechte Stücke schneiden (< 2 cm).",
      "Protein-Check: 38 g Protein / Portion — ideal für Sarkopenie-Prävention.",
    ],
    steps: [
      "Cook wild rice per pack instructions (~35 min).",
      "Cut zucchini, carrots and fennel into 2 cm cubes. Sweat in olive oil 12 min until very soft.",
      "Season pike-perch with lemon juice, salt and dill. Bake at 180 °C for 15 min (moist, not dry).",
      "IDDSI Level 7 (normal): plate everything. Cut fish into bite-size pieces (< 2 cm).",
      "Protein check: 38 g protein/portion — ideal for sarcopaenia prevention.",
    ],
    tags: ["senioren", "seefisch", "iddsi-7", "proteinreich", "gesund", "dge-senioren"],
  },
  {
    nameDe: "Hähnchenschenkel geschmort mit Kartoffelpüree und Bohnen (IDDSI 6)",
    name: "Braised chicken leg with mashed potatoes and beans (IDDSI 6)",
    type: "main",
    category: "meat",
    meat: "chicken",
    portionGrams: 400,
    cookTimeMin: 60,
    kcalPerPortion: 540,
    protein: 42,
    fat: 18,
    carbs: 44,
    allergens: ["celery"],
    stepsDe: [
      "Hähnchenschenkel (ohne Haut) in Gemüsebrühe 45 Min. weich schmoren. Fleisch vom Knochen lösen.",
      "Kartoffeln sehr weich kochen, mit warmer Milch und Butter zu cremigem Püree stampfen (keine Klumpen!).",
      "Grüne Bohnen (Dose) in Butter 5 Min. erwärmen, weich.",
      "IDDSI Level 6: Hähnchen in kleine Stücke (1 cm) zupfen. Alles auf warmem Teller anrichten.",
      "Calcium-Tipp: Milch im Püree liefert Calcium — gut für Osteoporose-Prävention.",
    ],
    steps: [
      "Braise chicken legs (skin-off) in vegetable stock for 45 min until tender. Remove meat from bone.",
      "Cook potatoes very soft, mash with warm milk and butter into smooth purée (no lumps!).",
      "Warm green beans (canned) in butter for 5 min until soft.",
      "IDDSI Level 6: shred chicken into small pieces (1 cm). Plate on a warm dish.",
      "Calcium tip: milk in mash provides calcium — good for osteoporosis prevention.",
    ],
    tags: ["senioren", "iddsi-6", "weich", "proteinreich", "calcium", "dge-senioren"],
  },
  {
    nameDe: "Linseneintopf mit Gemüse und Vollkornbrot (Senioren)",
    name: "Lentil vegetable stew with whole-grain bread (seniors)",
    type: "soup",
    category: "vegan",
    meat: "none",
    portionGrams: 350,
    cookTimeMin: 45,
    kcalPerPortion: 410,
    protein: 22,
    fat: 8,
    carbs: 62,
    allergens: ["gluten", "celery"],
    stepsDe: [
      "Rote und grüne Linsen waschen. Zwiebeln, Karotten, Sellerie und Lauch würfeln.",
      "Gemüse in Olivenöl 5 Min. anschwitzen. Linsen und Gemüsebrühe zugeben (2,5-fache Menge).",
      "45 Min. köcheln bis Linsen sehr weich sind — für Senioren ohne al dente.",
      "Mit Jodsalz, Essig und Majoran abschmecken. Konsistenz: breiig-stückig (IDDSI 5–6).",
      "Vollkornbrot in Würfel geschnitten oder als Finger food anbieten.",
    ],
    steps: [
      "Rinse red and green lentils. Dice onions, carrots, celery and leek.",
      "Sweat vegetables in olive oil 5 min. Add lentils and vegetable stock (2.5× volume).",
      "Simmer 45 min until lentils are very soft — no al dente for seniors.",
      "Season with iodised salt, vinegar and marjoram. Consistency: thick and chunky (IDDSI 5–6).",
      "Serve with diced whole-grain bread or as finger food.",
    ],
    tags: ["senioren", "hülsenfrüchte", "vollkorn", "iddsi-5", "proteinreich", "dge-senioren"],
  },
  {
    nameDe: "Joghurt-Obst-Creme mit Müsliriegeln (Senioren-Snack)",
    name: "Yoghurt fruit cream with muesli bars (seniors snack)",
    type: "dessert",
    category: "vegetarian",
    meat: "none",
    portionGrams: 180,
    cookTimeMin: 10,
    kcalPerPortion: 220,
    protein: 8,
    fat: 5,
    carbs: 38,
    allergens: ["milk", "gluten", "nuts"],
    stepsDe: [
      "Naturjoghurt (3,5 % Fett) mit Vanillezucker und Honig abschmecken.",
      "Reife Banane zerdrücken und einrühren (weiches Obst bevorzugen, keine harten Stücke).",
      "Beeren (frisch oder TK aufgetaut) unterheben.",
      "In Desserttassen füllen. Kleinen Müsliriegel (ohne Nüsse für Dysphagie-Risiko) als Finger food dazu.",
      "Calcium-Gehalt: 200 mg — wichtiger Beitrag zur Tages-Calcium-Zufuhr (Ziel: 1000 mg/Tag).",
    ],
    steps: [
      "Season natural yoghurt (3.5 % fat) with vanilla sugar and honey.",
      "Mash a ripe banana and stir in (prefer soft fruit, no hard pieces).",
      "Fold in berries (fresh or frozen-thawed).",
      "Fill into dessert cups. Serve a small muesli bar (nut-free for dysphagia risk) as finger food.",
      "Calcium content: 200 mg — valuable contribution to daily target (1000 mg/day).",
    ],
    tags: ["senioren", "snack", "zwischenmahlzeit", "calcium", "milch", "dge-senioren"],
  },
  {
    nameDe: "Rührei mit weichem Gemüse und Vollkorntoast (Senioren-Frühstück)",
    name: "Scrambled eggs with soft vegetables and whole-grain toast (seniors breakfast)",
    type: "side",
    category: "vegetarian",
    meat: "none",
    portionGrams: 250,
    cookTimeMin: 15,
    kcalPerPortion: 310,
    protein: 18,
    fat: 16,
    carbs: 22,
    allergens: ["egg", "milk", "gluten"],
    stepsDe: [
      "Spinat und Tomaten (Würfel) in Butter 3 Min. weich dünsten.",
      "Eier mit Milch, Salz und Schnittlauch verquirlen. Zur Pfanne geben, bei niedriger Hitze cremig stocken lassen.",
      "Vollkorntoast toasten — knusprig aber nicht zu hart (bei Zahnproblemen evtl. ungetoastet).",
      "Rührei auf Toast anrichten. Angepasst für IDDSI 6: Toast würfeln für Bewohner mit Schluckproblemen.",
    ],
    steps: [
      "Sweat spinach and diced tomatoes in butter for 3 min until soft.",
      "Whisk eggs with milk, salt and chives. Add to pan, cook on low heat until creamy.",
      "Toast whole-grain bread — crispy but not too hard (untoasted for dental issues).",
      "Plate scrambled eggs on toast. For IDDSI 6: dice toast for residents with swallowing difficulties.",
    ],
    tags: ["senioren", "frühstück", "ei", "vollkorn", "iddsi-6", "proteinreich", "dge-senioren"],
  },

  // ────────────────────────────────────────────────────────────────
  // KRANKENHAUSVERPFLEGUNG (DGE 2020)
  // Kostformen: Vollkost (VK), Leichte Vollkost (LVK), Diabeteskost (DK)
  // ────────────────────────────────────────────────────────────────
  {
    nameDe: "Gedämpftes Lachsfilet mit Salzkartoffeln und Fenchel (VK / LVK)",
    name: "Steamed salmon fillet with boiled potatoes and fennel (FC / LCD)",
    type: "main",
    category: "fish",
    meat: "none",
    portionGrams: 380,
    cookTimeMin: 25,
    kcalPerPortion: 490,
    protein: 36,
    fat: 16,
    carbs: 42,
    allergens: ["fish"],
    stepsDe: [
      "Kartoffeln schälen, in Salzwasser 20 Min. kochen — weich, nicht zerkocht.",
      "Fenchel in dünne Streifen schneiden, in Gemüsebrühe 10 Min. weich dünsten.",
      "Lachsfilet im Dampfgarer bei 80 °C 12 Min. garen (sanft, saftig — keine Kruste!). LVK-konform: kein Braten.",
      "Zitronensaft und Dill über den Lachs geben. Kein Pfeffer für empfindliche Patienten.",
      "Kostform: VK und LVK geeignet. Nährwerte: Omega-3-Fettsäuren, hochwertiges Protein.",
    ],
    steps: [
      "Peel potatoes, boil in salted water 20 min — soft, not mushy.",
      "Slice fennel thin, braise in vegetable stock 10 min until soft.",
      "Steam salmon fillet at 80 °C for 12 min (gentle, moist — no crust!). LCD-compliant: no frying.",
      "Add lemon juice and dill. No pepper for sensitive patients.",
      "Kostform: suitable for FC and LCD. Nutrients: omega-3 fatty acids, high-quality protein.",
    ],
    tags: ["krankenhaus", "seefisch", "vollkost", "leichte-vollkost", "gedämpft", "dge-krankenhaus"],
  },
  {
    nameDe: "Hühnerbrühe mit Einlage und Toastbrot (LVK / Genesungskost)",
    name: "Chicken broth with garnish and toast (LCD / recovery diet)",
    type: "soup",
    category: "meat",
    meat: "chicken",
    portionGrams: 300,
    cookTimeMin: 40,
    kcalPerPortion: 210,
    protein: 16,
    fat: 5,
    carbs: 24,
    allergens: ["gluten", "celery"],
    stepsDe: [
      "Hühnerbrühe (selbst gekocht oder Bio-Fertigbrühe) auf Kcal-arme Basis kochen.",
      "Einlage: Suppennudeln sehr weich kochen, Hähnchenbruststreifen in der Brühe gar ziehen.",
      "Karotten in dünne Scheiben schneiden, 10 Min. mitkochen.",
      "LVK: keine Zwiebeln, keinen Knoblauch, kein Fett, keine Hülsenfrüchte.",
      "Toastbrot (weiß, leicht getoastet) als Beilage. Allergene dokumentieren: Gluten, Sellerie.",
    ],
    steps: [
      "Prepare chicken broth (homemade or organic ready-made) as a low-calorie base.",
      "Garnish: cook soup noodles until very soft; poach chicken breast strips in broth.",
      "Slice carrots thin, cook in broth 10 min.",
      "LCD: no onions, no garlic, no fat, no legumes.",
      "Serve with white toast (lightly toasted). Document allergens: gluten, celery.",
    ],
    tags: ["krankenhaus", "leichte-vollkost", "genesungskost", "schonkost", "dge-krankenhaus"],
  },
  {
    nameDe: "Lauwarmer Gemüseeintopf mit magerem Rindfleisch (Vollkost)",
    name: "Lukewarm vegetable stew with lean beef (full diet)",
    type: "main",
    category: "meat",
    meat: "beef",
    portionGrams: 400,
    cookTimeMin: 60,
    kcalPerPortion: 510,
    protein: 34,
    fat: 14,
    carbs: 52,
    allergens: ["celery"],
    stepsDe: [
      "Mageres Rindfleisch (Tafelspitz) in Brühe 50 Min. weich schmoren. In Würfel schneiden.",
      "Kartoffeln, Karotten, Sellerie und Bohnen würfeln. In Rindsbrühe 20 Min. gar kochen.",
      "Alles zusammenführen. Mit Jodsalz, Lorbeer und wenig Pfeffer abschmecken.",
      "Vollkost-Kostform: für alle Patienten ohne spezielle Einschränkungen geeignet.",
      "Ausgabetemperatur: ≥ 65 °C dokumentieren (HACCP-Checkliste).",
    ],
    steps: [
      "Braise lean beef (boiled beef / Tafelspitz) in stock for 50 min until tender. Dice.",
      "Dice potatoes, carrots, celery and beans. Cook in beef broth 20 min.",
      "Combine everything. Season with iodised salt, bay leaf and a little pepper.",
      "Kostform: full diet — suitable for patients without specific restrictions.",
      "Serving temperature: ≥ 65 °C — document on HACCP checklist.",
    ],
    tags: ["krankenhaus", "vollkost", "fleisch", "kräftig", "dge-krankenhaus"],
  },
  {
    nameDe: "Diabetiker-Vollkornmenü: Putenbrust mit Gemüse und Naturreis (DK)",
    name: "Diabetic whole-grain menu: turkey breast with vegetables and brown rice (DK)",
    type: "main",
    category: "meat",
    meat: "turkey",
    portionGrams: 410,
    cookTimeMin: 40,
    kcalPerPortion: 490,
    protein: 40,
    fat: 10,
    carbs: 55,
    allergens: [],
    stepsDe: [
      "Naturreis kochen (niedriger glykämischer Index, GI 55 vs. Weißreis GI 72).",
      "Putenbrustfilet in Streifen schneiden. In Olivenöl 6 Min. braten (Kerntemperatur ≥ 73 °C).",
      "Paprika, Brokkoli und Zucchini in Streifen dünsten (5 Min. im Dampf — wenig Fett).",
      "Diabeteskost: kein Zucker, keine Weißmehlprodukte, kein Alkohol.",
      "BE-Berechnung: 55 g KH = 4,6 BE (1 BE = 12 g KH). Auf Patientenblatt dokumentieren.",
    ],
    steps: [
      "Cook brown rice (low GI of 55 vs. white rice GI 72).",
      "Cut turkey breast into strips. Pan-fry in olive oil 6 min (core temp ≥ 73 °C).",
      "Steam peppers, broccoli and zucchini (5 min — minimal fat).",
      "Diabetic diet: no sugar, no white flour, no alcohol.",
      "BE calculation: 55 g CHO = 4.6 BE (1 BE = 12 g CHO). Document on patient record.",
    ],
    tags: ["krankenhaus", "diabeteskost", "vollkorn", "kohlenhydratkontrolliert", "dge-krankenhaus"],
  },
  {
    nameDe: "Püriertes Gemüse-Kartoffel-Süppchen mit Sahne (IDDSI Level 4 — Krankenhaus)",
    name: "Puréed vegetable potato cream soup (IDDSI Level 4 — hospital)",
    type: "soup",
    category: "vegetarian",
    meat: "none",
    portionGrams: 300,
    cookTimeMin: 30,
    kcalPerPortion: 280,
    protein: 8,
    fat: 14,
    carbs: 32,
    allergens: ["milk", "celery"],
    stepsDe: [
      "Kartoffeln, Karotten und Sellerie würfeln. In Gemüsebrühe 20 Min. sehr weich kochen.",
      "Vollständig pürieren — glatt, klumpenfrei (Stabmixer + Sieb durchstreichen).",
      "Sahne und Butter einrühren für Energiedichte (wichtig für Mangelernährungs-Prävention).",
      "IDDSI Level 4 (püriert): Konsistenz prüfen — löffelbar, hält Form, kein Absetzen.",
      "Ausgabetemperatur: ≥ 65 °C. Allergene: Milch, Sellerie — in Patientenakte dokumentieren.",
    ],
    steps: [
      "Dice potatoes, carrots and celery. Cook very soft in vegetable stock for 20 min.",
      "Fully purée until smooth and lump-free (stick blender + sieve).",
      "Stir in cream and butter for energy density (important for malnutrition prevention).",
      "IDDSI Level 4 (puréed): check consistency — spoonable, holds shape, no separation.",
      "Serving temp: ≥ 65 °C. Allergens: milk, celery — document in patient record.",
    ],
    tags: ["krankenhaus", "iddsi-4", "püriert", "dysphagie", "schonkost", "dge-krankenhaus"],
  },
];

async function main() {
  console.log(`\n🏥 Institutionelle Rezepte werden eingetragen…`);
  console.log(`   Rezepte in diesem Batch: ${RECIPES.length}\n`);

  let inserted = 0;
  let updated = 0;

  for (const r of RECIPES) {
    try {
      const result = await db
        .insert(recipeLibrary)
        .values({ id: randomUUID(), basePrice: 2.8, sellPrice: 0, ...r })
        .onConflictDoUpdate({
          target: recipeLibrary.nameDe,
          set: {
            name:           sql`excluded.name`,
            type:           sql`excluded.type`,
            category:       sql`excluded.category`,
            meat:           sql`excluded.meat`,
            portionGrams:   sql`excluded.portion_grams`,
            cookTimeMin:    sql`excluded.cook_time_min`,
            kcalPerPortion: sql`excluded.kcal_per_portion`,
            protein:        sql`excluded.protein`,
            fat:            sql`excluded.fat`,
            carbs:          sql`excluded.carbs`,
            allergens:      sql`excluded.allergens`,
            stepsDe:        sql`excluded.steps_de`,
            steps:          sql`excluded.steps`,
            tags:           sql`excluded.tags`,
          },
        })
        .returning({ id: recipeLibrary.id });

      if (result.length > 0) {
        inserted++;
        console.log(`  ✅ ${r.nameDe.slice(0, 60)}`);
      }
    } catch (err) {
      console.error(`  ✗ ${r.nameDe.slice(0, 50)}: ${(err as Error).message?.slice(0, 80)}`);
    }
  }

  // Summary by institution tag
  const tags = ["schule", "kita", "senioren", "krankenhaus"];
  console.log(`\n📊 Zusammenfassung:`);
  for (const tag of tags) {
    const count = RECIPES.filter((r) => r.tags?.includes(tag)).length;
    console.log(`   ${tag.padEnd(12)} ${count} Rezepte`);
  }
  console.log(`\n🎉 Fertig: ${inserted} Rezepte eingefügt / aktualisiert.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

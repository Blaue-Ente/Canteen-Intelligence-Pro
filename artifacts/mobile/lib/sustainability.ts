/**
 * T009 — Energy + CO₂ per dish (ESG differentiator).
 *
 * Apicbase only tracks ingredient-level CO₂. KitchenOS adds the *cooking*
 * footprint — kWh per portion based on dish type + cook time + station —
 * and reports a fully-loaded CO₂e per portion that includes both the
 * cradle-to-gate ingredient emissions AND the in-kitchen energy.
 *
 * Numbers are deliberately conservative German averages so that operators
 * can quote them with a straight face. They are NOT lab-grade LCA values,
 * but they are good enough to surface trends ("rinderbraten = 8x mehr als
 * gemüsesuppe").
 */

import type { InventoryItem, Recipe } from "@/types";
import { recipeCo2Kg } from "@/lib/computations";

/**
 * German grid CO₂e intensity, kg/kWh (BNetzA "Strommix" 2024 ≈ 0.38).
 * Configurable later if we add per-location green-electricity contracts.
 */
const GRID_CO2_PER_KWH = 0.38;

/**
 * Cooking-method energy intensity per minute of active cooking (kW).
 * Derived from typical commercial-kitchen appliance ratings:
 *  - induction hob          ~ 3.5 kW
 *  - convection oven        ~ 6.0 kW
 *  - combi steamer          ~ 8.0 kW
 *  - blast freezer / fridge ~ 0.5 kW (just keep-cold draw)
 *  - cold prep / no-heat    ~ 0.05 kW (lighting + small tools)
 *  - bakery deck oven       ~ 7.5 kW
 *
 * Heuristic mapping by `Recipe.type`. Can later be overridden per-recipe.
 */
type Appliance = "induction" | "oven" | "combi" | "bakery" | "cold" | "none";

function applianceForType(type: Recipe["type"]): Appliance {
  switch (type) {
    case "soup":    return "induction";
    case "main":    return "combi";
    case "side":    return "induction";
    case "salad":   return "cold";
    case "drink":   return "cold";
    case "dessert": return "bakery";
    default:        return "none";
  }
}

const APPLIANCE_KW: Record<Appliance, number> = {
  induction: 3.5,
  oven:      6.0,
  combi:     8.0,
  bakery:    7.5,
  cold:      0.05,
  none:      0,
};

/**
 * Approximate "active cook time" share — a 60-min braised dish does NOT pull
 * 8 kW for 60 min. Combi steamer averages ~ 35 % duty cycle thanks to the
 * thermostat; induction averages ~ 60 %; cold prep is 100 %.
 */
const APPLIANCE_DUTY: Record<Appliance, number> = {
  induction: 0.60,
  oven:      0.45,
  combi:     0.35,
  bakery:    0.50,
  cold:      1.0,
  none:      0,
};

/**
 * Typical batch size assumed for the published `cookTimeMin`. We amortise
 * energy across the batch so a 30-min braise that yields 40 portions does
 * not get charged 30 minutes per portion.
 */
const ASSUMED_BATCH_PORTIONS = 20;

export interface EnergyEstimate {
  appliance: Appliance;
  /** kWh consumed per single portion (incl. duty cycle, batch amortised). */
  kwhPerPortion: number;
  /** kg CO₂e from grid electricity per portion. */
  energyCo2Kg: number;
}

export function recipeEnergy(recipe: Recipe): EnergyEstimate {
  const appliance = applianceForType(recipe.type);
  const kw = APPLIANCE_KW[appliance];
  const duty = APPLIANCE_DUTY[appliance];
  const minutes = Math.max(0, recipe.cookTimeMin || 0);
  // kWh = kW × hours × duty / batch
  const kwhBatch = kw * (minutes / 60) * duty;
  const kwhPerPortion = kwhBatch / ASSUMED_BATCH_PORTIONS;
  return {
    appliance,
    kwhPerPortion,
    energyCo2Kg: kwhPerPortion * GRID_CO2_PER_KWH,
  };
}

export interface FullCo2Estimate {
  /** kg CO₂e from ingredients (cradle-to-gate). */
  ingredientsCo2Kg: number;
  /** kg CO₂e from cooking energy. */
  energyCo2Kg: number;
  /** kWh per portion (duty + batch corrected). */
  kwhPerPortion: number;
  /** Sum of ingredient + energy CO₂. */
  totalCo2Kg: number;
}

export function recipeFullCo2(recipe: Recipe, inventory: InventoryItem[]): FullCo2Estimate {
  const ingredientsCo2Kg = recipeCo2Kg(recipe, inventory);
  const energy = recipeEnergy(recipe);
  return {
    ingredientsCo2Kg,
    energyCo2Kg: energy.energyCo2Kg,
    kwhPerPortion: energy.kwhPerPortion,
    totalCo2Kg: ingredientsCo2Kg + energy.energyCo2Kg,
  };
}

export function recipeApplianceLabel(recipe: Recipe, isDe: boolean): string {
  return applianceLabel(applianceForType(recipe.type), isDe);
}

export function applianceLabel(a: Appliance, isDe: boolean): string {
  if (isDe) {
    switch (a) {
      case "induction": return "Induktion";
      case "oven":      return "Ofen";
      case "combi":     return "Kombi-Dämpfer";
      case "bakery":    return "Bäckerei-Ofen";
      case "cold":      return "Kalte Küche";
      case "none":      return "Keine";
    }
  } else {
    switch (a) {
      case "induction": return "Induction";
      case "oven":      return "Oven";
      case "combi":     return "Combi steamer";
      case "bakery":    return "Bakery deck oven";
      case "cold":      return "Cold prep";
      case "none":      return "None";
    }
  }
}

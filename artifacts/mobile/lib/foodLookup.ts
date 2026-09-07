import { fetch as expoFetch } from "expo/fetch";
import { authHeaders } from "@/lib/api";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface FoodProduct {
  barcode: string;
  name: string;
  nameDe?: string;
  brand?: string;
  nutriScore?: "a" | "b" | "c" | "d" | "e";
  kcalPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  saltPer100g?: number;
  allergens: string[];
  imageUrl?: string;
  quantity?: string;
  categories: string[];
  countries: string[];
}

export async function lookupBarcode(barcode: string): Promise<FoodProduct> {
  const res = await expoFetch(`${API_BASE}/api/food-lookup/${encodeURIComponent(barcode)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Fehler ${res.status}`);
  }
  return res.json() as Promise<FoodProduct>;
}

/** Nutri-Score → Farbe */
export const NUTRI_COLOR: Record<string, string> = {
  a: "#038141",
  b: "#85BB2F",
  c: "#FECB02",
  d: "#EE8100",
  e: "#E63312",
};

/** Nutri-Score → Label */
export const NUTRI_LABEL: Record<string, string> = {
  a: "A – Sehr gut",
  b: "B – Gut",
  c: "C – Mittelmäßig",
  d: "D – Schlecht",
  e: "E – Sehr schlecht",
};

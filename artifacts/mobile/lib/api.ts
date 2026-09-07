import { fetch as expoFetch } from "expo/fetch";

export const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setApiTokenGetter(g: TokenGetter | null): void {
  tokenGetter = g;
}

export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await expoFetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) detail += `: ${j.error}`;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface MeMembership {
  orgId: string;
  orgName: string;
  role: "owner" | "manager" | "staff";
  displayName: string;
  employeeRole?: string | null;
  approved: boolean;
}

export interface MeResponse {
  userId: string;
  user: { email?: string; firstName?: string | null; lastName?: string | null };
  memberships: MeMembership[];
}

export interface MemberRow {
  userId: string;
  role: "owner" | "manager" | "staff";
  displayName: string;
  email?: string | null;
  employeeRole?: string | null;
  approved: boolean;
}

export interface InviteRow {
  code: string;
  email: string;
  displayName?: string | null;
  employeeRole?: string | null;
  role: "owner" | "manager" | "staff";
}

export interface DiscoverSupplier {
  id: string;
  source: "osm" | "google" | "manual";
  name: string;
  category: string;
  productGroups: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  distanceKm?: number | null;
}

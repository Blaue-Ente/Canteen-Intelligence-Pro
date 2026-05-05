import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState } from "@/types";

// State is keyed per Clerk user so multiple demo accounts on the same device
// don't pollute each other. Anonymous (pre-auth) state — used only briefly
// during the splash before AuthGate redirects — uses the legacy bare key.
const BASE_KEY = "kitchenos.state.v1";

function storageKey(userId?: string | null): string {
  return userId ? `${BASE_KEY}.${userId}` : BASE_KEY;
}

export async function loadState(userId?: string | null): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export async function saveState(state: AppState, userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function resetState(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

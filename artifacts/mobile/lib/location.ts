import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";

export interface LocatedPoint {
  lat: number;
  lng: number;
  city: string | null;
  source: "gps" | "ip" | "browser";
  accuracyM?: number;
}

export class LocationDeniedError extends Error {
  constructor(message = "Location permission denied") {
    super(message);
    this.name = "LocationDeniedError";
  }
}

export class LocationUnavailableError extends Error {
  constructor(message = "Location not available") {
    super(message);
    this.name = "LocationUnavailableError";
  }
}

// ─── Reverse geocode lat/lng → city via API server ──────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await apiFetch<{ city: string | null }>(
      `/api/suppliers/reverse-geocode?lat=${lat}&lng=${lng}`,
    );
    return r.city ?? null;
  } catch {
    return null;
  }
}

// ─── Web: navigator.geolocation ─────────────────────────────────────────────
async function getWebLocation(timeoutMs: number): Promise<LocatedPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new LocationUnavailableError("Browser geolocation not supported");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new LocationDeniedError(err.message));
        } else {
          reject(new LocationUnavailableError(err.message));
        }
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const city = await reverseGeocode(lat, lng);
  return { lat, lng, city, source: "browser", accuracyM: pos.coords.accuracy };
}

// ─── Native: expo-location (lazy import to avoid web bundle weight) ─────────
async function getNativeLocation(timeoutMs: number): Promise<LocatedPoint> {
  const Location = await import("expo-location");
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new LocationDeniedError("Standort-Berechtigung abgelehnt");
  }
  const result = await Promise.race<Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>>([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new LocationUnavailableError("Timeout")), timeoutMs),
    ) as Promise<never>,
  ]);
  const lat = result.coords.latitude;
  const lng = result.coords.longitude;
  const city = await reverseGeocode(lat, lng);
  return { lat, lng, city, source: "gps", accuracyM: result.coords.accuracy ?? undefined };
}

/**
 * Resolve the user's current geographic position with a friendly city label.
 *
 * - Web: uses the W3C Geolocation API (browser permission prompt).
 * - Native (iOS/Android): uses expo-location with foreground permission.
 *
 * Throws `LocationDeniedError` if the user blocked the permission, or
 * `LocationUnavailableError` for any other failure (timeout, no provider, etc).
 */
export async function getCurrentLocation(
  timeoutMs = 10_000,
): Promise<LocatedPoint> {
  if (Platform.OS === "web") {
    return getWebLocation(timeoutMs);
  }
  return getNativeLocation(timeoutMs);
}

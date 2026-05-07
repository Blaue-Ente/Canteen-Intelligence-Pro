/**
 * Web Push subscription helpers (browser only).
 * Uses the Web Push API + our /api/push/* endpoints.
 * Works on: Android Chrome, iOS 16.4+ Safari (when added to Home Screen).
 */
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import type { NotificationPrefs } from "@/types";

// Public VAPID key — safe to expose in client code
const VAPID_PUBLIC_KEY =
  "BDJeuv1MThPZN5-wjsrixUV7Re_icAouVM2ot82hqZ91o4oHruhY0LdtsEW6yFOGjJ7EpmoIezLUoeEmL6ANduU";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function webPushSupported(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!webPushSupported()) return null;
  try {
    const base = window.location.pathname.startsWith("/app/") ? "/app/" : "/";
    return await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  } catch {
    return null;
  }
}

export async function getWebPushPermission(): Promise<NotificationPermission> {
  if (!webPushSupported()) return "denied";
  return Notification.permission;
}

export async function requestWebPushPermission(): Promise<boolean> {
  if (!webPushSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!webPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export async function subscribeWebPush(
  prefs: NotificationPrefs,
  locale: string,
): Promise<boolean> {
  if (!webPushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer as ArrayBuffer,
    });
    const json = sub.toJSON();
    await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: { endpoint: sub.endpoint, keys: json.keys, prefs, locale },
    });
    return true;
  } catch {
    return false;
  }
}

export async function updateWebPushPrefs(
  prefs: NotificationPrefs,
  locale: string,
): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  try {
    await apiFetch("/api/push/prefs", {
      method: "PUT",
      body: { endpoint: sub.endpoint, prefs, locale },
    });
  } catch { /* ignore */ }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!webPushSupported()) return;
  try {
    const sub = await getExistingSubscription();
    if (!sub) return;
    await apiFetch("/api/push/subscribe", {
      method: "DELETE",
      body: { endpoint: sub.endpoint },
    });
    await sub.unsubscribe();
  } catch { /* ignore */ }
}

export async function sendTestWebPush(locale: string): Promise<void> {
  await apiFetch("/api/push/test", { method: "POST", body: { locale } });
}

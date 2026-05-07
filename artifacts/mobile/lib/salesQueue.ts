/**
 * Time Machine — Offline Sale Queue
 *
 * Detects network connectivity and automatically flushes locally queued
 * sales when the connection is restored. Also exposes a manual flush trigger.
 *
 * Architecture:
 *   - QueuedSale entries are stored in AppState (persisted to AsyncStorage).
 *   - When online, `flush()` iterates pending sales and attempts to record
 *     each one by calling the tray-scan confirm endpoint (or direct sale
 *     dispatch as fallback for lite-mode operations).
 *   - Failed attempts increment `attempts` and update `lastError`.
 *   - Successfully synced entries are removed from state.
 *
 * This module is connectivity-only — it does NOT perform fiscal signing.
 * TSE signing happens in `lib/tse.ts`; the queue is upstream of that step.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState, Platform } from "react-native";

import { useApp } from "@/contexts/AppContext";
import type { QueuedSale, TrayItem } from "@/types";

export interface QueueStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastFlushAt?: string;
  lastError?: string;
}

const BASE_URL =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api";

/** Compute total EUR for a list of tray items. */
export function computeTotal(items: TrayItem[]): number {
  return items
    .filter((i) => !i.removed)
    .reduce((sum, i) => sum + i.pricePerUnit * i.qty, 0);
}

/** Attempt to record a queued sale on the server. Returns true on success. */
async function postSaleToServer(sale: QueuedSale): Promise<void> {
  const body = {
    sessionId: sale.sessionId,
    items: sale.items.filter((i) => !i.removed),
    totalEur: sale.totalEur,
    queuedAt: sale.queuedAt,
    locationId: sale.locationId,
  };
  const res = await fetch(`${BASE_URL}/tray-scan/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Server ${res.status}: ${err}`);
  }
}

/**
 * Lightweight online probe. Tries a HEAD request to the health endpoint.
 * Falls back to `navigator.onLine` on web.
 */
async function checkOnline(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true;
  }
  try {
    const r = await fetch(`${BASE_URL}/health`, {
      method: "HEAD",
      signal: AbortSignal.timeout(4_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function useTimeMachineQueue(): QueueStatus & {
  flush: () => Promise<void>;
  enqueueFromSession: (sessionId: string, items: TrayItem[], totalEur: number, locationId?: string) => QueuedSale;
} {
  const { state, dispatch, newId } = useApp();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastFlushAt, setLastFlushAt] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();
  const flushingRef = useRef(false);

  // ── Connectivity polling (every 10 s on native, event-driven on web) ──

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const online = await checkOnline();
      setIsOnline(online);
    };

    void poll();
    const interval = setInterval(poll, 10_000);

    // Web: also listen to native browser events
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        cancelled = true;
        clearInterval(interval);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    // Native: also check when app comes to foreground
    const sub = RNAppState.addEventListener("change", (s) => {
      if (s === "active") void poll();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  // ── Auto-flush when coming back online ───────────────────────────────

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (state.queuedSales.length === 0) return;

    flushingRef.current = true;
    setIsSyncing(true);
    setLastError(undefined);
    let anyError = false;

    for (const sale of [...state.queuedSales]) {
      try {
        await postSaleToServer(sale);
        dispatch({ type: "removeQueuedSale", id: sale.id });
      } catch (err) {
        anyError = true;
        const msg = err instanceof Error ? err.message : "unknown";
        dispatch({
          type: "updateQueuedSale",
          sale: {
            ...sale,
            attempts: sale.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: msg,
          },
        });
        setLastError(msg);
      }
    }

    setIsSyncing(false);
    flushingRef.current = false;
    if (!anyError) {
      setLastFlushAt(new Date().toISOString());
    }
  }, [state.queuedSales, dispatch]);

  useEffect(() => {
    if (isOnline && state.queuedSales.length > 0) {
      void flush();
    }
  }, [isOnline]); // intentionally only re-run on connectivity change

  // ── Enqueue helper ────────────────────────────────────────────────────

  const enqueueFromSession = useCallback(
    (sessionId: string, items: TrayItem[], totalEur: number, locationId?: string): QueuedSale => {
      const sale: QueuedSale = {
        id: newId(),
        queuedAt: new Date().toISOString(),
        reason: "offline",
        sessionId,
        items,
        totalEur,
        locationId,
        attempts: 0,
      };
      dispatch({ type: "addQueuedSale", sale });
      return sale;
    },
    [dispatch, newId],
  );

  return {
    isOnline,
    isSyncing,
    pendingCount: state.queuedSales.length,
    lastFlushAt,
    lastError,
    flush,
    enqueueFromSession,
  };
}

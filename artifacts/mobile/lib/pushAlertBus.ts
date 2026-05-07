/**
 * Simple event bus that carries incoming Web Push alerts to any
 * React component that wants to react to them (e.g. PushAlertOverlay).
 *
 * Decoupled from React so it can be called from plain useEffect listeners
 * in _layout.tsx without needing a shared context.
 */
export interface PushAlertPayload {
  title: string;
  body: string;
}

type Listener = (alert: PushAlertPayload) => void;

const listeners = new Set<Listener>();

export const pushAlertBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(alert: PushAlertPayload): void {
    listeners.forEach((fn) => fn(alert));
  },
};

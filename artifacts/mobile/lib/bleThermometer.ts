/**
 * T013e — Bluetooth thermometer integration (paid add-on).
 *
 * Real BLE on iOS/Android requires `react-native-ble-plx`, which in turn
 * needs a custom Expo dev-build (it's a native module, won't work in Expo Go
 * or in the web preview). To keep the app shippable today, this module ships
 * a deterministic MOCK provider that:
 *
 *  - "discovers" two fake devices (Inkbird IBT-2X, Thermapen ONE)
 *  - streams a temperature reading every 5 s drifting around a target value
 *  - lets the UI demo the workflow end-to-end
 *
 * When `react-native-ble-plx` is added, swap out `mockProvider` for a
 * `bleProvider` with the same interface — the consumer (`useBleThermometer`)
 * doesn't need to change.
 *
 * Subscription gating happens at the React layer (`<RequiresAddon>`), not
 * here, so this module stays trivially testable.
 */

export interface BleDevice {
  id: string;
  name: string;
  /** Manufacturer-reported sensor type ("probe" = single, "dual" = 2 channels). */
  kind: "probe" | "dual";
  /** Last known battery 0..100, optional. */
  battery?: number;
}

export interface BleReading {
  deviceId: string;
  /** °C. */
  temperature: number;
  /** ISO timestamp from the device (or local clock). */
  at: string;
  /** Channel index (0..n) for multi-probe devices. */
  channel?: number;
}

export interface BleProvider {
  listDevices(): Promise<BleDevice[]>;
  /** Begin streaming. Returns an unsubscribe fn. */
  subscribe(deviceId: string, onReading: (r: BleReading) => void): () => void;
  /** Whether this is a mock implementation (UI shows a "Demo-Modus" badge). */
  isMock: boolean;
}

// ─── Mock provider ──────────────────────────────────────────────────────────

const MOCK_DEVICES: BleDevice[] = [
  { id: "mock-inkbird-001",   name: "Inkbird IBT-2X",  kind: "dual",  battery: 84 },
  { id: "mock-thermapen-001", name: "Thermapen ONE",   kind: "probe", battery: 67 },
];

/** Per-device "true" temp the mock drifts around. */
const MOCK_TARGET: Record<string, number> = {
  "mock-inkbird-001":   4.5, // typical fridge probe
  "mock-thermapen-001": 72.0, // hot-keep / cooking probe
};

export const mockProvider: BleProvider = {
  isMock: true,

  async listDevices(): Promise<BleDevice[]> {
    // Simulate a 600 ms scan latency so the UI can show a spinner.
    await new Promise<void>((r) => setTimeout(r, 600));
    return MOCK_DEVICES;
  },

  subscribe(deviceId, onReading) {
    const target = MOCK_TARGET[deviceId] ?? 4.0;
    let cancelled = false;
    let lastTemp = target;

    const tick = (): void => {
      if (cancelled) return;
      // Random walk: ±0.15 °C drift, gently pulled back to target (Ornstein-Uhlenbeck-ish).
      const drift = (Math.random() - 0.5) * 0.3;
      const pull = (target - lastTemp) * 0.15;
      lastTemp = lastTemp + drift + pull;
      onReading({
        deviceId,
        temperature: Math.round(lastTemp * 10) / 10,
        at: new Date().toISOString(),
      });
    };

    // Fire one reading immediately + every 5 s.
    tick();
    const handle = setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  },
};

/**
 * Resolve which provider to use. Today: always mock. When the native module
 * is added, gate on `Platform.OS !== "web"` and module availability.
 */
export function getBleProvider(): BleProvider {
  return mockProvider;
}

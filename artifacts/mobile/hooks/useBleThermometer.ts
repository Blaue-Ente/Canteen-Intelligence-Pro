/**
 * T013e — React wrapper around the BLE provider.
 *
 * `useBleThermometer({ deviceId })` returns the latest reading + a
 * stable subscribe/unsubscribe lifecycle. The component is responsible for
 * pairing (calling `listDevices()`) before subscribing.
 */

import { useEffect, useState } from "react";

import { getBleProvider, type BleDevice, type BleReading } from "@/lib/bleThermometer";

interface Args {
  deviceId?: string;
  enabled: boolean;
}

interface Result {
  isMock: boolean;
  devices: BleDevice[];
  scanning: boolean;
  scan: () => Promise<void>;
  reading?: BleReading;
}

export function useBleThermometer({ deviceId, enabled }: Args): Result {
  const provider = getBleProvider();
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [reading, setReading] = useState<BleReading | undefined>();

  const scan = async (): Promise<void> => {
    setScanning(true);
    try {
      const list = await provider.listDevices();
      setDevices(list);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!enabled || !deviceId) return;
    const unsub = provider.subscribe(deviceId, (r) => setReading(r));
    return () => {
      unsub();
    };
  }, [provider, enabled, deviceId]);

  return { isMock: provider.isMock, devices, scanning, scan, reading };
}

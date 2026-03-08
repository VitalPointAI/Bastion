/**
 * Client-Side Discovery Bridge Hook
 *
 * Phase 32 Plan 11: Uses Web Bluetooth and Web Serial browser APIs to discover
 * nearby devices from the user's machine, then relays discoveries to the Bastion
 * backend for onboarding through the standard pipeline (origin='client').
 */

import { useState, useCallback, useRef } from 'react';
import { discoveryService } from '../lib/discovery-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientDiscoveredDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'serial';
  rawIdentifier: string;
  relayStatus: 'pending' | 'sent' | 'failed';
  discoveredAt: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Browser API availability checks
// ---------------------------------------------------------------------------

function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

function isSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClientDiscovery() {
  const [discoveries, setDiscoveries] = useState<ClientDiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const nextId = useRef(0);

  const addDiscovery = useCallback((device: Omit<ClientDiscoveredDevice, 'id'>) => {
    const id = `client-${nextId.current++}`;
    const entry: ClientDiscoveredDevice = { ...device, id };
    setDiscoveries((prev) => [...prev, entry]);
    return id;
  }, []);

  const updateRelayStatus = useCallback(
    (id: string, status: ClientDiscoveredDevice['relayStatus'], error?: string) => {
      setDiscoveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, relayStatus: status, error } : d)),
      );
    },
    [],
  );

  /**
   * Start Bluetooth scan using Web Bluetooth API.
   * Triggers browser permission dialog for device selection.
   */
  const startBluetoothScan = useCallback(async () => {
    if (!isBluetoothAvailable()) return;

    setScanning(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [],
      });

      const rawIdentifier = device.id || device.name || 'unknown-ble';
      const entryId = addDiscovery({
        name: device.name || 'Unknown BLE Device',
        type: 'bluetooth',
        rawIdentifier,
        relayStatus: 'pending',
        discoveredAt: Date.now(),
      });

      // Relay to backend
      try {
        await discoveryService.reportClientDiscovery({
          transportType: 'ble',
          rawIdentifier,
          rawData: {
            name: device.name,
            bluetoothId: device.id,
          },
        });
        updateRelayStatus(entryId, 'sent');
      } catch (err) {
        updateRelayStatus(
          entryId,
          'failed',
          err instanceof Error ? err.message : 'Relay failed',
        );
      }
    } catch (err) {
      // User cancelled or API error — not a problem
      if (err instanceof Error && err.name !== 'NotFoundError') {
        console.error('[useClientDiscovery] Bluetooth scan error:', err.message);
      }
    } finally {
      setScanning(false);
    }
  }, [addDiscovery, updateRelayStatus]);

  /**
   * Start Serial scan using Web Serial API.
   * Triggers browser permission dialog for port selection.
   */
  const startSerialScan = useCallback(async () => {
    if (!isSerialAvailable()) return;

    setScanning(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      const info = port.getInfo?.() ?? {};

      const rawIdentifier = `serial-${info.usbVendorId ?? 'unknown'}-${info.usbProductId ?? 'unknown'}`;
      const entryId = addDiscovery({
        name: `Serial Device (${info.usbVendorId ?? '?'}:${info.usbProductId ?? '?'})`,
        type: 'serial',
        rawIdentifier,
        relayStatus: 'pending',
        discoveredAt: Date.now(),
      });

      // Relay to backend
      try {
        await discoveryService.reportClientDiscovery({
          transportType: 'usb',
          rawIdentifier,
          rawData: {
            usbVendorId: info.usbVendorId,
            usbProductId: info.usbProductId,
          },
        });
        updateRelayStatus(entryId, 'sent');
      } catch (err) {
        updateRelayStatus(
          entryId,
          'failed',
          err instanceof Error ? err.message : 'Relay failed',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        console.error('[useClientDiscovery] Serial scan error:', err.message);
      }
    } finally {
      setScanning(false);
    }
  }, [addDiscovery, updateRelayStatus]);

  return {
    discoveries,
    scanning,
    startBluetoothScan,
    startSerialScan,
    isBluetoothAvailable: isBluetoothAvailable(),
    isSerialAvailable: isSerialAvailable(),
  };
}

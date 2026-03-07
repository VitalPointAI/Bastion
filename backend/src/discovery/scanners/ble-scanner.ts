/**
 * BLE Scanner
 *
 * Phase 32 Plan 03: Bluetooth Low Energy scanner using @stoprocent/noble.
 * Discovers BLE peripherals and emits standardized DiscoveryEvent objects.
 * Gracefully degrades when Bluetooth hardware or drivers are unavailable.
 */

import { BaseScanner } from './scanner-interface.js';
import type { DiscoveryEvent, ScannerConfig } from '../types.js';

// Dynamic import handle for noble (may fail if native module unavailable)
let noble: typeof import('@stoprocent/noble') | null = null;

try {
  noble = await import('@stoprocent/noble');
} catch (err) {
  console.warn(
    '[BLEScanner] @stoprocent/noble not available — BLE scanning disabled.',
    err instanceof Error ? err.message : err,
  );
}

export class BLEScanner extends BaseScanner {
  readonly transportType = 'ble' as const;

  private _isAvailable = false;
  private _scanTimer: ReturnType<typeof setInterval> | null = null;
  private _scanning = false;

  constructor() {
    super();
    this._checkAvailability();
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  private _checkAvailability(): void {
    if (!noble) {
      this._isAvailable = false;
      return;
    }

    try {
      // noble.state is synchronous — 'poweredOn' means adapter is ready
      this._isAvailable = noble.state === 'poweredOn';
    } catch {
      this._isAvailable = false;
    }

    // Listen for state changes so availability updates at runtime
    if (noble) {
      noble.on('stateChange', (state: string) => {
        const wasAvailable = this._isAvailable;
        this._isAvailable = state === 'poweredOn';

        if (wasAvailable && !this._isAvailable) {
          console.warn('[BLEScanner] Bluetooth adapter state changed to:', state);
          this.emit('error', new Error(`Bluetooth adapter state: ${state}`));
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  protected onStart(config: ScannerConfig): void {
    if (!noble || !this._isAvailable) {
      console.warn('[BLEScanner] Bluetooth not available, skipping start');
      return;
    }

    const nobleRef = noble;

    // Set up discover handler
    nobleRef.on('discover', (peripheral) => {
      if (this._paused) return;

      const now = Date.now();
      const event: DiscoveryEvent = {
        transportType: 'ble',
        rawIdentifier: peripheral.address || peripheral.id,
        signalStrength: peripheral.rssi,
        firstSeen: now,
        lastSeen: now,
        rawData: {
          id: peripheral.id,
          address: peripheral.address,
          addressType: peripheral.addressType,
          connectable: peripheral.connectable,
          localName: peripheral.advertisement?.localName ?? undefined,
          serviceUuids: peripheral.advertisement?.serviceUuids ?? [],
          manufacturerData: peripheral.advertisement?.manufacturerData
            ? peripheral.advertisement.manufacturerData.toString('hex')
            : undefined,
          txPowerLevel: peripheral.advertisement?.txPowerLevel ?? undefined,
        },
      };

      this.emit('discovered', event);
    });

    // Periodic scan cycles: scan for 80% of interval, rest for 20%
    const scanDuration = Math.floor(config.intervalMs * 0.8);

    this._scanTimer = setInterval(() => {
      if (this._paused || this._scanning) return;

      try {
        nobleRef.startScanning([], true); // all services, allow duplicates
        this._scanning = true;

        setTimeout(() => {
          try {
            nobleRef.stopScanning();
          } catch {
            // Ignore stop errors (adapter may have gone away)
          }
          this._scanning = false;
        }, scanDuration);
      } catch (err) {
        this._scanning = false;
        if (err instanceof Error && err.message.includes('EPERM')) {
          console.error(
            '[BLEScanner] Permission denied. BLE scanning requires root or cap_net_raw.',
            'Run: sudo setcap cap_net_raw+eip $(which node)',
          );
        }
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }, config.intervalMs);
  }

  protected onStop(): void {
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }

    if (noble && this._scanning) {
      try {
        noble.stopScanning();
      } catch {
        // Ignore — adapter may already be gone
      }
      this._scanning = false;
    }

    if (noble) {
      noble.removeAllListeners('discover');
    }
  }

  protected onPause(): void {
    if (noble && this._scanning) {
      try {
        noble.stopScanning();
      } catch {
        // Ignore
      }
      this._scanning = false;
    }
  }

  protected onResume(): void {
    // Next interval tick will restart scanning
  }
}

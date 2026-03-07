/**
 * USB/Serial Scanner
 *
 * Phase 32 Plan 03: Enumerates USB/serial ports using the serialport library.
 * Detects new and removed devices by polling SerialPort.list() at configured
 * intervals. Emits standardized DiscoveryEvent objects with vendor/product IDs.
 */

import { BaseScanner } from './scanner-interface.js';
import type { DiscoveryEvent, ScannerConfig } from '../types.js';

// Dynamic import for graceful degradation
let SerialPortClass: { list: () => Promise<PortInfo[]> } | null = null;

interface PortInfo {
  path: string;
  manufacturer: string | undefined;
  serialNumber: string | undefined;
  pnpId: string | undefined;
  locationId: string | undefined;
  productId: string | undefined;
  vendorId: string | undefined;
}

try {
  const sp = await import('serialport');
  SerialPortClass = sp.SerialPort;
} catch (err) {
  console.warn(
    '[USBScanner] serialport not available — USB/Serial scanning disabled.',
    err instanceof Error ? err.message : err,
  );
}

/** Tracks a seen port with a debounce timestamp for stable detection */
interface SeenPort {
  port: PortInfo;
  firstSeen: number;
  lastSeen: number;
  stable: boolean;
}

/** Debounce time (ms) before a newly detected port is emitted as discovered */
const DEBOUNCE_MS = 300;

export class USBScanner extends BaseScanner {
  readonly transportType = 'usb' as const;

  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _seenPorts: Map<string, SeenPort> = new Map();
  private _isAvailable = false;

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

  private async _checkAvailability(): Promise<void> {
    if (!SerialPortClass) {
      this._isAvailable = false;
      return;
    }

    try {
      await SerialPortClass.list();
      this._isAvailable = true;
    } catch {
      this._isAvailable = false;
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  protected onStart(config: ScannerConfig): void {
    if (!SerialPortClass) {
      console.warn('[USBScanner] serialport not available, skipping start');
      return;
    }

    this._seenPorts.clear();

    this._pollTimer = setInterval(() => {
      if (this._paused) return;
      this._poll().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
    }, config.intervalMs);

    // Initial poll
    this._poll().catch((err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });
  }

  protected onStop(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._seenPorts.clear();
  }

  protected onPause(): void {
    // Polls will be skipped while _paused is true
  }

  protected onResume(): void {
    // Next interval tick will resume polling
  }

  // -------------------------------------------------------------------------
  // Polling logic
  // -------------------------------------------------------------------------

  private async _poll(): Promise<void> {
    if (!SerialPortClass) return;

    let ports: PortInfo[];
    try {
      ports = await SerialPortClass.list();
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const now = Date.now();
    const currentPaths = new Set<string>();

    for (const port of ports) {
      currentPaths.add(port.path);

      const existing = this._seenPorts.get(port.path);

      if (!existing) {
        // New port detected — start debounce tracking
        this._seenPorts.set(port.path, {
          port,
          firstSeen: now,
          lastSeen: now,
          stable: false,
        });
      } else {
        existing.lastSeen = now;

        // Check debounce: port has been seen long enough to be considered stable
        if (!existing.stable && now - existing.firstSeen >= DEBOUNCE_MS) {
          existing.stable = true;
          this._emitDiscovered(existing);
        }
      }
    }

    // Detect removed ports
    for (const [path, seen] of this._seenPorts) {
      if (!currentPaths.has(path)) {
        this._seenPorts.delete(path);
        if (seen.stable) {
          this.emit('lost', path);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event emission
  // -------------------------------------------------------------------------

  private _emitDiscovered(seen: SeenPort): void {
    const { port } = seen;

    const event: DiscoveryEvent = {
      transportType: 'usb',
      rawIdentifier: port.path,
      firstSeen: seen.firstSeen,
      lastSeen: seen.lastSeen,
      rawData: {
        path: port.path,
        vendorId: port.vendorId ?? undefined,
        productId: port.productId ?? undefined,
        manufacturer: port.manufacturer ?? undefined,
        serialNumber: port.serialNumber ?? undefined,
        pnpId: port.pnpId ?? undefined,
        locationId: port.locationId ?? undefined,
      },
    };

    this.emit('discovered', event);
  }
}

/**
 * Scanner Interface Module
 *
 * Phase 32 Plan 03: Re-exports core scanner types and provides a BaseScanner
 * abstract class that implements common lifecycle management via EventEmitter.
 * Concrete scanners (BLE, WiFi, USB, TAK) extend BaseScanner and implement
 * the transport-specific hooks.
 */

import { EventEmitter } from 'node:events';
import type {
  TransportScanner,
  DiscoveryEvent,
  ScannerConfig,
  TransportType,
} from '../types.js';

// Re-export core types for convenience
export type { TransportScanner, DiscoveryEvent, ScannerConfig, TransportType };

// ---------------------------------------------------------------------------
// Default Scan Intervals (milliseconds)
// ---------------------------------------------------------------------------

export const DEFAULT_SCAN_INTERVALS: Record<TransportType, number> = {
  ble: 10_000,
  wifi: 30_000,
  usb: 5_000,
  tak: 15_000,
};

// ---------------------------------------------------------------------------
// BaseScanner — abstract EventEmitter implementing TransportScanner lifecycle
// ---------------------------------------------------------------------------

export abstract class BaseScanner extends EventEmitter implements TransportScanner {
  abstract readonly transportType: TransportType;
  abstract readonly isAvailable: boolean;

  protected _config: ScannerConfig | null = null;
  protected _paused = false;

  /** Concrete scanners implement transport-specific start logic. */
  protected abstract onStart(config: ScannerConfig): void;
  /** Concrete scanners implement transport-specific stop logic. */
  protected abstract onStop(): void;
  /** Hook called when scanner is paused. */
  protected abstract onPause(): void;
  /** Hook called when scanner is resumed. */
  protected abstract onResume(): void;

  start(config: ScannerConfig): void {
    this._config = config;
    this._paused = false;
    this.onStart(config);
  }

  stop(): void {
    this.onStop();
    this._config = null;
    this._paused = false;
  }

  pause(): void {
    this._paused = true;
    this.onPause();
  }

  resume(): void {
    this._paused = false;
    this.onResume();
  }
}

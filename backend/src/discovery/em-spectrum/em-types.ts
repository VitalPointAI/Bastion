/**
 * EM Spectrum Awareness — Domain Types
 *
 * Phase 32 Plan 07: Defines EM band classifications, signal entries,
 * emission footprint types, and the extensible EMDataSource interface
 * for future SDR integration.
 *
 * Tier 1: Inferred from scanner RSSI data (always available).
 * Tier 2: Direct SDR measurement (future, via EMDataSource interface).
 */

import type { TransportType } from '../types.js';

// ---------------------------------------------------------------------------
// EM Bands
// ---------------------------------------------------------------------------

/**
 * Electromagnetic frequency bands relevant to tactical discovery.
 * Uses const object per project convention (not enum).
 */
export const EMBand = {
  bluetooth: 'bluetooth',   // 2.4 GHz ISM band
  wifi_2g: 'wifi_2g',       // 2.4 GHz ISM band
  wifi_5g: 'wifi_5g',       // 5 GHz UNII bands
  vhf: 'vhf',               // 30-300 MHz
  uhf: 'uhf',               // 300-3000 MHz
  hf: 'hf',                 // 3-30 MHz
  satcom: 'satcom',         // L/S/C/Ku/Ka bands
  unknown: 'unknown',
} as const;
export type EMBand = (typeof EMBand)[keyof typeof EMBand];

// ---------------------------------------------------------------------------
// Signal Entry
// ---------------------------------------------------------------------------

/**
 * A single EM signal observation — either from an external device
 * or from Bastion's own transmissions.
 */
export interface EMSignalEntry {
  /** Frequency band classification */
  band: EMBand;
  /** Observed frequency in MHz */
  frequencyMHz: number;
  /** Signal strength in dBm */
  signalStrengthDbm: number;
  /** Device rawId or 'self' for own emissions */
  sourceIdentifier: string;
  /** Whether this is a discovered device, self-emission, or unknown */
  sourceType: 'discovered' | 'self' | 'unknown';
  /** Unix timestamp (ms) of observation */
  timestamp: number;
  /** Transport type that observed/generated this signal */
  transportType?: TransportType;
}

// ---------------------------------------------------------------------------
// Emission Footprint
// ---------------------------------------------------------------------------

/**
 * Bastion's own electromagnetic footprint — what we are radiating
 * and what external signals we observe.
 */
export interface EMFootprint {
  /** All observed environmental signals */
  entries: EMSignalEntry[];
  /** Bastion's own active transmissions */
  activeTransmissions: EMSignalEntry[];
  /** When this footprint was last updated (ms) */
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// EM Data Source Interface (SDR extension point)
// ---------------------------------------------------------------------------

/**
 * Abstraction for EM signal sources. Tier 1 is inferred from scanner
 * RSSI (implemented by EMCollector). Tier 2 (SDR hardware) can be
 * added later by implementing this interface — no refactoring needed.
 */
export interface EMDataSource {
  /** Whether this source infers from scanners or uses direct SDR */
  readonly sourceType: 'inferred' | 'sdr';
  /** Get current signal observations */
  getSignals(): EMSignalEntry[];
  /** Start collecting signal data */
  start(): void;
  /** Stop collecting signal data */
  stop(): void;
}

// ---------------------------------------------------------------------------
// EM Snapshot
// ---------------------------------------------------------------------------

/**
 * Point-in-time EM picture combining environmental and own-emission
 * data with per-band summaries for tactical display.
 */
export interface EMSnapshot {
  /** When this snapshot was taken (ms) */
  timestamp: number;
  /** Signals from external/discovered devices */
  environmentSignals: EMSignalEntry[];
  /** Bastion's own emissions */
  ownEmissions: EMSignalEntry[];
  /** Per-band summary: device count and average signal strength */
  bandSummary: Record<EMBand, { count: number; avgStrength: number }>;
}

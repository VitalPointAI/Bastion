/**
 * EM Collector — Electromagnetic Spectrum Aggregator
 *
 * Phase 32 Plan 07: Aggregates EM signal data from all active transport
 * scanners (Tier 1 — inferred from RSSI) and tracks Bastion's own
 * electromagnetic emissions for OPSEC visibility.
 *
 * Subscribes to MessageBus `discovery.device.discovered` for environmental
 * signals, and scanner lifecycle events for own-emission tracking.
 *
 * Implements EMDataSource interface so it can be composed with future SDR
 * sources without architectural changes.
 */

import type { DiscoveryEvent } from '../types.js';
import { TransportType } from '../types.js';
import { EMBand } from './em-types.js';
import type { EMSignalEntry, EMSnapshot, EMDataSource } from './em-types.js';
import type { MessageBus } from '../../messaging/message-bus.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default sliding window duration for signal entries (5 minutes) */
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/** Cleanup interval — prune expired entries periodically */
const CLEANUP_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Frequency helpers
// ---------------------------------------------------------------------------

/**
 * Derive EM band from transport type and optional raw data.
 * BLE and WiFi channels map to specific frequency ranges.
 */
function inferBand(transportType: string, rawData: Record<string, unknown>): EMBand {
  switch (transportType) {
    case TransportType.ble:
      return EMBand.bluetooth;

    case TransportType.wifi: {
      // Infer from channel or frequency in rawData
      const channel = rawData.channel as number | undefined;
      const freq = rawData.frequency as number | undefined;
      if (freq && freq > 4900) return EMBand.wifi_5g;
      if (channel && channel > 14) return EMBand.wifi_5g;
      return EMBand.wifi_2g;
    }

    case TransportType.tak: {
      // TAK devices typically operate on VHF/UHF frequencies
      const takFreq = rawData.frequency as number | undefined;
      if (takFreq) {
        if (takFreq >= 3 && takFreq <= 30) return EMBand.hf;
        if (takFreq >= 30 && takFreq <= 300) return EMBand.vhf;
        if (takFreq >= 300 && takFreq <= 3000) return EMBand.uhf;
      }
      // Default TAK to VHF (most common for ATAK radios)
      return EMBand.vhf;
    }

    case TransportType.usb:
      // USB is wired — no EM contribution
      return EMBand.unknown;

    default:
      return EMBand.unknown;
  }
}

/**
 * Derive approximate frequency in MHz from transport type and raw data.
 */
function inferFrequency(transportType: string, rawData: Record<string, unknown>): number {
  switch (transportType) {
    case TransportType.ble: {
      // BLE channels 0-39 map to 2402-2480 MHz
      const bleChannel = rawData.channel as number | undefined;
      if (bleChannel !== undefined && bleChannel >= 0 && bleChannel <= 39) {
        return 2402 + bleChannel * 2;
      }
      return 2440; // Center of BLE band
    }

    case TransportType.wifi: {
      const freq = rawData.frequency as number | undefined;
      if (freq) return freq;
      const channel = rawData.channel as number | undefined;
      if (channel) {
        // Standard WiFi channel-to-frequency mapping
        if (channel <= 14) return 2407 + (channel - 1) * 5;
        if (channel >= 36) return 5000 + channel * 5;
      }
      return 2437; // Channel 6 default
    }

    case TransportType.tak: {
      const takFreq = rawData.frequency as number | undefined;
      return takFreq ?? 150; // Default 150 MHz (VHF)
    }

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// EMCollector
// ---------------------------------------------------------------------------

export class EMCollector implements EMDataSource {
  readonly sourceType: 'inferred' = 'inferred';

  /** Sliding window of environmental signal observations */
  private environmentSignals: EMSignalEntry[] = [];

  /** Bastion's own active emissions */
  private ownEmissions: Map<string, EMSignalEntry> = new Map();

  /** Window duration in ms */
  private windowMs: number;

  /** Cleanup timer handle */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** MessageBus subscription IDs for cleanup */
  private subscriptionIds: string[] = [];

  /** Reference to message bus for subscriptions */
  private messageBus: MessageBus | null = null;

  constructor(windowMs: number = DEFAULT_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  // -----------------------------------------------------------------------
  // EMDataSource interface
  // -----------------------------------------------------------------------

  /**
   * Get all current signals (both environment and own).
   */
  getSignals(): EMSignalEntry[] {
    this.pruneExpired();
    const ownList: EMSignalEntry[] = [];
    this.ownEmissions.forEach((entry) => ownList.push(entry));
    return [...this.environmentSignals, ...ownList];
  }

  /**
   * Start the collector — begin periodic cleanup of expired entries.
   */
  start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.pruneExpired(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the collector — clear cleanup timer and unsubscribe.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // MessageBus integration
  // -----------------------------------------------------------------------

  /**
   * Subscribe to discovery events via MessageBus for automatic signal
   * ingestion. Also subscribes to scanner lifecycle events for
   * own-emission tracking.
   */
  subscribe(messageBus: MessageBus): void {
    this.messageBus = messageBus;

    // Subscribe to device discovered events for environmental signal data
    const discoveredSubId = messageBus.subscribe(
      'did:near:system-em-collector',
      {
        channels: ['discovery.device.discovered'],
        callback: async (message) => {
          const event = message.payload as unknown as DiscoveryEvent;
          if (event && event.transportType && event.rawIdentifier) {
            this.ingestDiscoveryEvent(event);
          }
        },
      },
    );
    this.subscriptionIds.push(discoveredSubId);

    // Subscribe to scanner lifecycle events for own-emission tracking
    const scannerChannels = [
      'discovery.scan.ble',
      'discovery.scan.wifi',
      'discovery.scan.tak',
    ];

    for (const channel of scannerChannels) {
      const subId = messageBus.subscribe(
        'did:near:system-em-collector',
        {
          channels: [channel],
          callback: async (message) => {
            const payload = message.payload as Record<string, unknown>;
            const event = payload.event as string;
            const transport = payload.transport as string;
            this.handleScannerLifecycle(transport, event);
          },
        },
      );
      this.subscriptionIds.push(subId);
    }
  }

  // -----------------------------------------------------------------------
  // Signal ingestion
  // -----------------------------------------------------------------------

  /**
   * Ingest a discovery event and extract EM signal data.
   * USB devices are wired and produce no EM contribution.
   */
  ingestDiscoveryEvent(event: DiscoveryEvent): void {
    // USB is wired — no EM contribution
    if (event.transportType === TransportType.usb) return;

    const band = inferBand(event.transportType, event.rawData);
    if (band === EMBand.unknown) return;

    const entry: EMSignalEntry = {
      band,
      frequencyMHz: inferFrequency(event.transportType, event.rawData),
      signalStrengthDbm: event.signalStrength ?? -100,
      sourceIdentifier: event.rawIdentifier,
      sourceType: 'discovered',
      timestamp: Date.now(),
      transportType: event.transportType,
    };

    this.environmentSignals.push(entry);
  }

  // -----------------------------------------------------------------------
  // Own-emission tracking
  // -----------------------------------------------------------------------

  /**
   * Record one of Bastion's own electromagnetic emissions.
   * Called when scanners actively transmit (BLE scanning, WiFi probes, etc.).
   */
  recordOwnEmission(band: EMBand, frequencyMHz: number, powerDbm: number): void {
    const key = `${band}:${frequencyMHz}`;
    const entry: EMSignalEntry = {
      band,
      frequencyMHz,
      signalStrengthDbm: powerDbm,
      sourceIdentifier: 'self',
      sourceType: 'self',
      timestamp: Date.now(),
    };
    this.ownEmissions.set(key, entry);
  }

  /**
   * Remove an own-emission record (when a scanner stops transmitting).
   */
  clearOwnEmission(band: EMBand, frequencyMHz: number): void {
    const key = `${band}:${frequencyMHz}`;
    this.ownEmissions.delete(key);
  }

  /**
   * Handle scanner lifecycle events to track Bastion's own emissions.
   * Active BLE scanning emits on bluetooth band.
   * WiFi mDNS/SSDP queries emit on wifi bands.
   * TAK passive listening does not emit; active transmit does.
   */
  private handleScannerLifecycle(transport: string, event: string): void {
    if (event === 'started' || event === 'resumed') {
      switch (transport) {
        case TransportType.ble:
          // BLE active scanning emits inquiry packets
          this.recordOwnEmission(EMBand.bluetooth, 2440, -20);
          break;
        case TransportType.wifi:
          // WiFi discovery sends mDNS/SSDP probes on 2.4 GHz
          this.recordOwnEmission(EMBand.wifi_2g, 2437, -15);
          break;
        case TransportType.tak:
          // TAK listening is passive — no emission by default
          // Active TAK transmit would be recorded separately
          break;
      }
    } else if (event === 'stopped' || event === 'paused') {
      switch (transport) {
        case TransportType.ble:
          this.clearOwnEmission(EMBand.bluetooth, 2440);
          break;
        case TransportType.wifi:
          this.clearOwnEmission(EMBand.wifi_2g, 2437);
          break;
        case TransportType.tak:
          // Clear any active TAK transmissions
          this.clearOwnEmission(EMBand.vhf, 150);
          break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot / Query
  // -----------------------------------------------------------------------

  /**
   * Return current EM picture with per-band summaries.
   */
  getSnapshot(): EMSnapshot {
    this.pruneExpired();

    const ownList: EMSignalEntry[] = [];
    this.ownEmissions.forEach((entry) => ownList.push(entry));

    // Build per-band summary
    const allSignals = [...this.environmentSignals, ...ownList];
    const bandAccum: Record<string, { total: number; count: number }> = {};

    for (const signal of allSignals) {
      if (!bandAccum[signal.band]) {
        bandAccum[signal.band] = { total: 0, count: 0 };
      }
      bandAccum[signal.band].total += signal.signalStrengthDbm;
      bandAccum[signal.band].count += 1;
    }

    const bandSummary = {} as Record<EMBand, { count: number; avgStrength: number }>;
    const allBands = Object.values(EMBand);
    for (const band of allBands) {
      const acc = bandAccum[band];
      if (acc && acc.count > 0) {
        bandSummary[band] = {
          count: acc.count,
          avgStrength: Math.round((acc.total / acc.count) * 100) / 100,
        };
      } else {
        bandSummary[band] = { count: 0, avgStrength: 0 };
      }
    }

    return {
      timestamp: Date.now(),
      environmentSignals: [...this.environmentSignals],
      ownEmissions: ownList,
      bandSummary,
    };
  }

  /**
   * Return only Bastion's own emissions — the OPSEC view.
   * Operators use this to understand their electromagnetic footprint.
   */
  getOwnFootprint(): EMSignalEntry[] {
    const result: EMSignalEntry[] = [];
    this.ownEmissions.forEach((entry) => result.push(entry));
    return result;
  }

  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------

  /**
   * Remove signal entries older than the sliding window.
   */
  private pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    this.environmentSignals = this.environmentSignals.filter(
      (entry) => entry.timestamp >= cutoff,
    );
  }

  /**
   * Get environment signal count (for monitoring/debugging).
   */
  getEnvironmentSignalCount(): number {
    return this.environmentSignals.length;
  }

  /**
   * Get own emission count (for monitoring/debugging).
   */
  getOwnEmissionCount(): number {
    return this.ownEmissions.size;
  }
}

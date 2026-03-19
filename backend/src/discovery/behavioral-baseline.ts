/**
 * Behavioral Baseline — Online Anomaly Detection
 *
 * Phase 32 Plan 06: Uses Welford's online algorithm to maintain running
 * mean/variance for device behavioral metrics. Flags anomalies beyond
 * 3-sigma after a minimum of 10 samples have been collected.
 *
 * Integration: DiscoveryService calls recordMetric() on each telemetry
 * ingestion. If anomaly detected, the device is auto-quarantined and
 * an alert is published via MessageBus.
 */

import { discoveryStore } from './discovery-store.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of standard deviations beyond which a value is anomalous */
const ANOMALY_SIGMA_THRESHOLD = 3.0;

/** Minimum samples required before flagging anomalies */
const MIN_SAMPLE_COUNT = 10;

/** Predefined metric types for device behavioral monitoring */
export const MetricTypes = {
  /** Messages per minute */
  telemetry_rate: 'telemetry_rate',
  /** Milliseconds to respond to Bastion commands */
  command_response_time: 'command_response_time',
  /** Bytes per interval */
  data_volume: 'data_volume',
  /** Disconnection frequency */
  connection_drops: 'connection_drops',
} as const;

export type MetricType = (typeof MetricTypes)[keyof typeof MetricTypes];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of checking a metric value against a device's behavioral baseline */
export interface AnomalyCheck {
  /** Whether this value is anomalous (beyond threshold with sufficient samples) */
  isAnomaly: boolean;
  /** Number of standard deviations from the mean */
  deviation: number;
  /** Sigma threshold used for detection (currently 3.0) */
  threshold: number;
  /** The metric type that was checked */
  metricType: string;
  /** The actual value that was recorded */
  value: number;
}

/** Aggregate health status for a device across all baselines */
export interface DeviceHealthCheck {
  healthy: boolean;
  anomalies: AnomalyCheck[];
}

// ---------------------------------------------------------------------------
// Internal running state (in-memory cache of Welford accumulators)
// ---------------------------------------------------------------------------

interface WelfordState {
  count: number;
  mean: number;
  m2: number;
}

/**
 * In-memory cache: deviceDid:metricType -> WelfordState
 * Avoids DB reads on every metric recording. Populated lazily from store.
 */
const welfordCache = new Map<string, WelfordState>();

function cacheKey(deviceDid: string, metricType: string): string {
  return `${deviceDid}:${metricType}`;
}

// ---------------------------------------------------------------------------
// BehavioralBaseline
// ---------------------------------------------------------------------------

/**
 * Online anomaly detection using Welford's algorithm for running
 * mean/variance computation.
 *
 * Welford's algorithm updates in O(1) per sample:
 *   count++
 *   delta = value - mean
 *   mean += delta / count
 *   delta2 = value - mean
 *   M2 += delta * delta2
 *   variance = M2 / count  (population variance)
 *   stddev = sqrt(variance)
 */
export class BehavioralBaseline {
  /**
   * Record a metric value and check for anomalies.
   *
   * 1. Load or initialize running stats (Welford accumulator)
   * 2. Update mean/variance online
   * 3. Check if value exceeds 3-sigma (only if sampleCount >= MIN_SAMPLE_COUNT)
   * 4. Persist updated baseline
   * 5. Return anomaly check result
   */
  async recordMetric(
    deviceDid: string,
    metricType: string,
    value: number,
  ): Promise<AnomalyCheck> {
    const key = cacheKey(deviceDid, metricType);

    // Load existing state from cache or database
    let state = welfordCache.get(key);
    if (!state) {
      state = await this.loadFromStore(deviceDid, metricType);
      welfordCache.set(key, state);
    }

    // Welford's online update
    state.count++;
    const delta = value - state.mean;
    state.mean += delta / state.count;
    const delta2 = value - state.mean;
    state.m2 += delta * delta2;

    // Compute standard deviation (population variance for stability)
    const variance = state.count > 1 ? state.m2 / state.count : 0;
    const stddev = Math.sqrt(variance);

    // Check anomaly: only flag if we have enough samples and stddev is non-zero
    const deviation = stddev > 0 ? Math.abs(value - state.mean) / stddev : 0;
    const isAnomaly =
      state.count >= MIN_SAMPLE_COUNT &&
      stddev > 0 &&
      deviation > ANOMALY_SIGMA_THRESHOLD;

    // Persist to database
    await discoveryStore.upsertBaseline(
      deviceDid,
      metricType,
      state.mean,
      stddev,
      state.count,
    );

    return {
      isAnomaly,
      deviation: Math.round(deviation * 100) / 100,
      threshold: ANOMALY_SIGMA_THRESHOLD,
      metricType,
      value,
    };
  }

  /**
   * Check all baselines for a device and return aggregate health status.
   *
   * A device is "healthy" if none of its current baselines show anomalies
   * when the latest recorded value is compared against the baseline.
   * Since we only store running stats (not the latest value), this method
   * returns the stored baselines and flags any with stddev = 0 as healthy.
   */
  async checkDeviceHealth(deviceDid: string): Promise<DeviceHealthCheck> {
    const baselines = await discoveryStore.getBaselines(deviceDid);
    const anomalies: AnomalyCheck[] = [];

    for (const baseline of baselines) {
      // For health checks, we report the current baseline state.
      // A baseline with insufficient samples or zero stddev is considered healthy.
      const hasSufficientData = baseline.sampleCount >= MIN_SAMPLE_COUNT;
      const check: AnomalyCheck = {
        isAnomaly: false,
        deviation: 0,
        threshold: ANOMALY_SIGMA_THRESHOLD,
        metricType: baseline.metricType,
        value: baseline.baselineMean,
      };

      if (hasSufficientData && baseline.baselineStddev > 0) {
        // Device health is based on whether the last recorded metric
        // was within normal range. Since we don't store the last value,
        // we report the baseline statistics. Anomalies are caught in
        // real-time by recordMetric().
        anomalies.push(check);
      }
    }

    return {
      healthy: anomalies.every((a) => !a.isAnomaly),
      anomalies,
    };
  }

  /**
   * Clear cached state for a device (e.g., after quarantine release).
   */
  clearCache(deviceDid: string): void {
    const prefix = `${deviceDid}:`;
    const keysToDelete: string[] = [];
    welfordCache.forEach((_val, key) => {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => welfordCache.delete(k));
  }

  /**
   * Clear all cached state (e.g., on service restart).
   */
  clearAllCaches(): void {
    welfordCache.clear();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Load baseline from the database and convert to Welford state.
   * If no baseline exists, returns a fresh accumulator.
   */
  private async loadFromStore(
    deviceDid: string,
    metricType: string,
  ): Promise<WelfordState> {
    const baselines = await discoveryStore.getBaselines(deviceDid);
    const existing = baselines.find((b) => b.metricType === metricType);

    if (!existing || existing.sampleCount === 0) {
      return { count: 0, mean: 0, m2: 0 };
    }

    // Reconstruct M2 from stored mean, stddev, and count.
    // variance = stddev^2, M2 = variance * count (population variance)
    const variance = existing.baselineStddev * existing.baselineStddev;
    const m2 = variance * existing.sampleCount;

    return {
      count: existing.sampleCount,
      mean: existing.baselineMean,
      m2,
    };
  }
}

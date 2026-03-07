/**
 * Resource Telemetry Service
 *
 * Phase 27 Plan 04: Singleton service for telemetry ingestion and batched
 * WebSocket push. Position updates are batched every 3 seconds and broadcast
 * to connected clients via registered broadcast callbacks.
 */

import { getResourceRegistry } from './resource-registry.js';
import { getPluginRegistry } from './plugins/plugin-registry.js';
import type { WebSocket } from 'ws';

/**
 * A single telemetry frame with position and optional kinematics.
 */
export interface TelemetryFrame {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

/**
 * ResourceTelemetryService — batches position updates and pushes via WebSocket.
 *
 * Ingested positions overwrite previous for the same resource (latest wins).
 * Every BATCH_INTERVAL_MS, all pending positions are flushed as a single batch
 * message to all registered WebSocket subscribers.
 */
export class ResourceTelemetryService {
  /** resourceId -> latest TelemetryFrame */
  private pendingPositions: Map<string, TelemetryFrame> = new Map();

  /** Interval handle for periodic flush */
  private batchInterval: ReturnType<typeof setInterval> | null = null;

  /** Batch interval in milliseconds (3 seconds per research recommendation) */
  private readonly BATCH_INTERVAL_MS = 3000;

  /** WebSocket connections subscribed to telemetry broadcasts */
  private subscribers: Set<WebSocket> = new Set();

  /**
   * Start the periodic batch flush.
   */
  start(): void {
    if (this.batchInterval) return;
    this.batchInterval = setInterval(() => this.flushPositions(), this.BATCH_INTERVAL_MS);
    console.log(`[ResourceTelemetry] Started batching at ${this.BATCH_INTERVAL_MS}ms intervals`);
  }

  /**
   * Stop the periodic batch flush.
   */
  stop(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
      console.log('[ResourceTelemetry] Stopped batching');
    }
  }

  /**
   * Register a WebSocket connection for telemetry broadcasts.
   */
  addSubscriber(ws: WebSocket): void {
    this.subscribers.add(ws);
    ws.on('close', () => {
      this.subscribers.delete(ws);
    });
  }

  /**
   * Remove a WebSocket connection from telemetry broadcasts.
   */
  removeSubscriber(ws: WebSocket): void {
    this.subscribers.delete(ws);
  }

  /**
   * Ingest telemetry data for a resource.
   *
   * Latest position overwrites previous for the same resource.
   * Also writes through to registry cache and invokes plugin telemetry handler.
   */
  ingestTelemetry(
    resourceId: string,
    data: { lat: number; lng: number; heading?: number; speed?: number }
  ): void {
    const frame: TelemetryFrame = {
      lat: data.lat,
      lng: data.lng,
      heading: data.heading,
      speed: data.speed,
      timestamp: Date.now(),
    };

    // Store latest position (overwrites previous for same resource)
    this.pendingPositions.set(resourceId, frame);

    // Write-through: update resource location in registry cache
    const registry = getResourceRegistry();
    const resource = registry.getResource(resourceId);
    if (resource) {
      // Update location in the cached resource object
      (resource as { location?: { lat: number; lng: number } }).location = {
        lat: data.lat,
        lng: data.lng,
      };
    }

    // Invoke plugin telemetry handler if defined (fire-and-forget)
    const pluginRegistry = getPluginRegistry();
    if (resource) {
      const plugin = pluginRegistry.getPlugin(resource.category);
      if (plugin?.processTelemetry) {
        plugin.processTelemetry(resourceId, data).catch((err) => {
          console.error(`[ResourceTelemetry] Plugin telemetry error for ${resourceId}:`, err);
        });
      }
    }
  }

  /**
   * Flush pending positions to all WebSocket subscribers as a batch.
   */
  private flushPositions(): void {
    if (this.pendingPositions.size === 0) return;

    // Build batch payload
    const positions: Record<string, TelemetryFrame> = {};
    for (const [id, frame] of this.pendingPositions) {
      positions[id] = frame;
    }

    const payload = JSON.stringify({
      type: 'resource:position_batch',
      positions,
    });

    // Broadcast to all subscribers
    let sent = 0;
    for (const ws of this.subscribers) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(payload);
        sent++;
      }
    }

    // Clear pending positions after broadcast
    this.pendingPositions.clear();

    if (sent > 0) {
      console.log(
        `[ResourceTelemetry] Flushed ${Object.keys(positions).length} positions to ${sent} subscribers`
      );
    }
  }
}

// ---- Singleton ----

let instance: ResourceTelemetryService | null = null;

/**
 * Get the singleton ResourceTelemetryService instance.
 */
export function getResourceTelemetryService(): ResourceTelemetryService {
  if (!instance) {
    instance = new ResourceTelemetryService();
  }
  return instance;
}

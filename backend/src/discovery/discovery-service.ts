/**
 * Discovery Service — Singleton Orchestrator
 *
 * Phase 32 Plan 05: Manages all transport scanners and routes discovery events
 * through the onboarding pipeline. Enforces admin interface restrictions,
 * handles device reconnection, and publishes lifecycle events to message bus.
 *
 * Follows ResourceRegistry singleton pattern.
 */

import { discoveryStore } from './discovery-store.js';
import { FingerprintService } from './fingerprint-service.js';
import { AcceptanceGate } from './acceptance-gate.js';
import { OnboardingPipeline } from './onboarding-pipeline.js';
import { BLEScanner } from './scanners/ble-scanner.js';
import { WiFiScanner } from './scanners/wifi-scanner.js';
import { USBScanner } from './scanners/usb-scanner.js';
import { TAKScanner } from './scanners/tak-scanner.js';
import { MDNSScanner } from './scanners/mdns-scanner.js';
import { ARPScanner } from './scanners/arp-scanner.js';
import { DEFAULT_SCAN_INTERVALS } from './scanners/scanner-interface.js';
import { DeviceState, TransportType, DiscoveryOrigin } from './types.js';
import type {
  TransportScanner,
  DiscoveryEvent,
  ScannerConfig,
  DeviceState as DeviceStateType,
  DiscoveryOrigin as DiscoveryOriginType,
} from './types.js';
import type { ResourceRegistry } from '../resources/resource-registry.js';
import type { MessageBus } from '../messaging/message-bus.js';
import type { GateService } from '../gates/gate-service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of each scanner */
export interface ScannerStatus {
  available: boolean;
  running: boolean;
  paused: boolean;
  lastEvent?: number;
}

/** Overall discovery service status */
export interface DiscoveryStatus {
  scanners: Record<string, ScannerStatus>;
  deviceCounts: Partial<Record<DeviceStateType, number>>;
  scope: string;
  origin: DiscoveryOriginType;
}

// ---------------------------------------------------------------------------
// Admin config key for disabled interfaces
// ---------------------------------------------------------------------------

/** Config key checked for disabled transport types. In PROTECTED_CONFIG_KEYS. */
const DISABLED_INTERFACES_KEY = 'discovery.disabled_interfaces';

// ---------------------------------------------------------------------------
// DiscoveryService
// ---------------------------------------------------------------------------

export class DiscoveryService {
  private scanners: Map<string, TransportScanner> = new Map();
  private scannerConfigs: Map<string, ScannerConfig> = new Map();
  private scannerLastEvent: Map<string, number> = new Map();
  private pipeline: OnboardingPipeline | null = null;
  private disabledInterfaces: Set<string> = new Set();
  private persistentConnections: Set<string> = new Set();
  private scope = 'global';
  private origin: DiscoveryOriginType = DiscoveryOrigin.server;
  private running = false;
  private paused = false;
  private initialized = false;

  // Dependencies injected during initialize()
  private resourceRegistry: ResourceRegistry | null = null;
  private messageBus: MessageBus | null = null;
  private gateService: GateService | null = null;

  // Event handler references for cleanup
  private discoveredHandlers: Map<string, (evt: DiscoveryEvent) => void> = new Map();
  private lostHandlers: Map<string, (id: string) => void> = new Map();
  private errorHandlers: Map<string, (err: Error) => void> = new Map();

  private constructor() {
    // Private constructor — use getDiscoveryService()
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Initialize the discovery service with all dependencies.
   *
   * - Ensures discovery tables exist
   * - Instantiates all 4 scanners
   * - Creates onboarding pipeline
   * - Wires scanner events to pipeline
   * - Loads disabled interfaces from admin config
   * - Does NOT auto-start scanners
   */
  async initialize(deps: {
    resourceRegistry: ResourceRegistry;
    messageBus: MessageBus;
    gateService?: GateService;
  }): Promise<void> {
    if (this.initialized) return;

    this.resourceRegistry = deps.resourceRegistry;
    this.messageBus = deps.messageBus;
    this.gateService = deps.gateService ?? null;

    // Ensure discovery tables exist
    await discoveryStore.ensureDiscoveryTables();

    // Initialize scanners
    this.initializeScanners();

    // Initialize default configs from DEFAULT_SCAN_INTERVALS
    for (const [transport, interval] of Object.entries(DEFAULT_SCAN_INTERVALS)) {
      this.scannerConfigs.set(transport, {
        intervalMs: interval,
        enabled: true,
      });
    }

    // Load disabled interfaces
    await this.loadDisabledInterfaces();

    // Create onboarding pipeline
    const fingerprintService = new FingerprintService();
    const acceptanceGate = new AcceptanceGate(discoveryStore, this.gateService ?? undefined);

    this.pipeline = new OnboardingPipeline({
      discoveryStore,
      fingerprintService,
      acceptanceGate,
      resourceRegistry: this.resourceRegistry,
      messageBus: this.messageBus,
    });

    // Try to set pg-boss for Ironclaw job enqueueing
    try {
      const { getSharedBoss } = await import('../lib/database.js');
      const boss = await getSharedBoss();
      this.pipeline.setBoss(boss);
    } catch {
      console.warn('[DiscoveryService] pg-boss not available for Ironclaw jobs');
    }

    // Wire scanner events
    this.wireEvents();

    this.initialized = true;
    console.log('[DiscoveryService] Initialized with 4 transport scanners');
  }

  /**
   * Instantiate all 4 transport scanners.
   */
  private initializeScanners(): void {
    const ble = new BLEScanner();
    const wifi = new WiFiScanner();
    const usb = new USBScanner();
    const tak = new TAKScanner();

    const mdns = new MDNSScanner();
    const arp = new ARPScanner();

    this.scanners.set(TransportType.ble, ble);
    this.scanners.set(TransportType.wifi, wifi);
    this.scanners.set(TransportType.usb, usb);
    this.scanners.set(TransportType.tak, tak);
    this.scanners.set(TransportType.mdns, mdns);
    this.scanners.set(TransportType.arp, arp);
  }

  /**
   * Wire scanner events to the onboarding pipeline and state management.
   */
  private wireEvents(): void {
    for (const [transport, scanner] of this.scanners.entries()) {
      // 'discovered' -> route to pipeline
      const onDiscovered = (evt: DiscoveryEvent): void => {
        this.scannerLastEvent.set(transport, Date.now());
        this.handleDiscoveryEvent(evt).catch((err) => {
          console.error(
            `[DiscoveryService] Error handling discovery event for ${transport}:`,
            err instanceof Error ? err.message : err,
          );
        });
      };
      this.discoveredHandlers.set(transport, onDiscovered);
      scanner.on('discovered', onDiscovered);

      // 'lost' -> handle device disconnection
      const onLost = (id: string): void => {
        this.handleDeviceLost(transport, id).catch((err) => {
          console.error(
            `[DiscoveryService] Error handling lost device ${id}:`,
            err instanceof Error ? err.message : err,
          );
        });
      };
      this.lostHandlers.set(transport, onLost);
      scanner.on('lost', onLost);

      // 'error' -> log scanner errors
      const onError = (err: Error): void => {
        console.error(
          `[DiscoveryService] Scanner error [${transport}]:`,
          err.message,
        );
        this.publishScanEvent(`discovery.scan.${transport}`, {
          event: 'error',
          transport,
          error: err.message,
        });
      };
      this.errorHandlers.set(transport, onError);
      scanner.on('error', onError);
    }
  }

  // -------------------------------------------------------------------------
  // Scanner lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start all enabled scanners.
   * Respects admin interface restrictions — disabled scanners are skipped.
   * Accepts an origin parameter for tri-origin model (server/client/remote).
   */
  start(scope?: string, origin?: DiscoveryOriginType): void {
    if (!this.initialized) {
      throw new Error('DiscoveryService not initialized — call initialize() first');
    }

    this.scope = scope ?? 'global';
    this.origin = origin ?? DiscoveryOrigin.server;
    this.running = true;
    this.paused = false;

    // Remote origin scans are handled separately via startRemoteScan()
    if (this.origin === DiscoveryOrigin.remote) {
      console.log(`[DiscoveryService] Remote scan mode — use startRemoteScan() for targets`);
      return;
    }

    // Client origin doesn't start server scanners — devices come via ingestClientDiscovery()
    if (this.origin === DiscoveryOrigin.client) {
      console.log(`[DiscoveryService] Client scan mode — awaiting browser-reported devices`);
      return;
    }

    for (const [transport, scanner] of this.scanners.entries()) {
      // Skip disabled interfaces
      if (this.disabledInterfaces.has(transport)) {
        console.log(
          `[DiscoveryService] Scanner ${transport} is disabled by admin config — skipping`,
        );
        continue;
      }

      const config = this.scannerConfigs.get(transport);
      if (config && config.enabled && scanner.isAvailable) {
        scanner.start(config);
        this.publishScanEvent(`discovery.scan.${transport}`, {
          event: 'started',
          transport,
          scope: this.scope,
          origin: this.origin,
        });
      }
    }

    console.log(`[DiscoveryService] Started (scope: ${this.scope}, origin: ${this.origin})`);
  }

  /**
   * Stop all scanners.
   */
  stop(): void {
    this.running = false;
    this.paused = false;

    for (const [transport, scanner] of this.scanners.entries()) {
      try {
        scanner.stop();
        this.publishScanEvent(`discovery.scan.${transport}`, {
          event: 'stopped',
          transport,
        });
      } catch (err) {
        console.error(
          `[DiscoveryService] Error stopping scanner ${transport}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log('[DiscoveryService] Stopped');
  }

  /**
   * Pause all running scanners.
   */
  pause(): void {
    if (!this.running) return;
    this.paused = true;

    for (const [transport, scanner] of this.scanners.entries()) {
      if (!this.disabledInterfaces.has(transport)) {
        try {
          scanner.pause();
          this.publishScanEvent(`discovery.scan.${transport}`, {
            event: 'paused',
            transport,
          });
        } catch {
          // Scanner may not be running — ignore
        }
      }
    }

    console.log('[DiscoveryService] Paused');
  }

  /**
   * Resume all paused scanners.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;

    for (const [transport, scanner] of this.scanners.entries()) {
      if (!this.disabledInterfaces.has(transport)) {
        try {
          scanner.resume();
          this.publishScanEvent(`discovery.scan.${transport}`, {
            event: 'resumed',
            transport,
          });
        } catch {
          // Scanner may not be started — ignore
        }
      }
    }

    console.log('[DiscoveryService] Resumed');
  }

  // -------------------------------------------------------------------------
  // Scanner configuration
  // -------------------------------------------------------------------------

  /**
   * Update a scanner's config at runtime.
   * If the scanner is running, it will be restarted with the new config.
   */
  setScannerConfig(transport: string, config: Partial<ScannerConfig>): void {
    const existing = this.scannerConfigs.get(transport) ?? {
      intervalMs: DEFAULT_SCAN_INTERVALS[transport as keyof typeof DEFAULT_SCAN_INTERVALS] ?? 10_000,
      enabled: true,
    };

    const updated: ScannerConfig = {
      ...existing,
      ...config,
    };

    this.scannerConfigs.set(transport, updated);

    // If running, restart scanner with new config
    if (this.running && !this.paused) {
      const scanner = this.scanners.get(transport);
      if (scanner && !this.disabledInterfaces.has(transport)) {
        scanner.stop();
        if (updated.enabled && scanner.isAvailable) {
          scanner.start(updated);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /**
   * Get the current status of all scanners and device counts by state.
   */
  async getStatus(): Promise<DiscoveryStatus> {
    const scanners: Record<string, ScannerStatus> = {};

    for (const [transport, scanner] of this.scanners.entries()) {
      const isDisabled = this.disabledInterfaces.has(transport);
      scanners[transport] = {
        available: scanner.isAvailable && !isDisabled,
        running: this.running && !isDisabled && scanner.isAvailable,
        paused: this.paused,
        lastEvent: this.scannerLastEvent.get(transport),
      };
    }

    // Count devices by state
    const deviceCounts: Partial<Record<DeviceStateType, number>> = {};
    const allStates = Object.values(DeviceState);
    for (const state of allStates) {
      const devices = await discoveryStore.listDevicesByState(state);
      if (devices.length > 0) {
        deviceCounts[state] = devices.length;
      }
    }

    return {
      scanners,
      deviceCounts,
      scope: this.scope,
      origin: this.origin,
    };
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Handle a discovery event from a scanner.
   * Checks for reconnection of previously known devices,
   * then routes through the onboarding pipeline.
   */
  private async handleDiscoveryEvent(event: DiscoveryEvent): Promise<void> {
    if (!this.pipeline) return;

    // Check for previously known device (reconnection detection)
    const existing = await discoveryStore.getDeviceByRawId(
      event.transportType,
      event.rawIdentifier,
    );

    if (existing && existing.state === DeviceState.disconnected) {
      // Reconnection detected — re-establish based on trust tier
      const trustTier = existing.resourceId
        ? await this.getDeviceTrustTier(existing.resourceId)
        : null;

      if (trustTier === 'participant' || trustTier === 'autonomous') {
        // Maintain persistent connection for higher trust tiers
        this.persistentConnections.add(existing.id);
      }
    }

    // Route through pipeline
    const result = await this.pipeline.processDiscoveryEvent(event, this.scope);

    // Track persistent connections for newly onboarded devices
    if (result.success && result.resourceId) {
      const trustTier = await this.getDeviceTrustTier(result.resourceId);
      if (trustTier === 'participant' || trustTier === 'autonomous') {
        const device = await discoveryStore.getDeviceByRawId(
          event.transportType,
          event.rawIdentifier,
        );
        if (device) {
          this.persistentConnections.add(device.id);
        }
      }
    }
  }

  /**
   * Handle a device lost event from a scanner.
   * Updates device state to disconnected and removes from persistent connections.
   */
  private async handleDeviceLost(transport: string, rawIdentifier: string): Promise<void> {
    const device = await discoveryStore.getDeviceByRawId(transport, rawIdentifier);
    if (!device) return;

    // Only transition to disconnected from connected state
    if (device.state === DeviceState.connected) {
      await discoveryStore.updateDeviceState(device.id, DeviceState.disconnected);

      // Remove from persistent connections
      this.persistentConnections.delete(device.id);

      // Publish disconnection event
      this.publishScanEvent(`discovery.device.disconnected`, {
        deviceId: device.id,
        transportType: transport,
        deviceDid: device.deviceDid,
        resourceId: device.resourceId,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Remote & Client origin scanning
  // -------------------------------------------------------------------------

  /**
   * Start a remote scan against configured scan targets.
   * Iterates enabled targets and probes each address using WiFi scanner.
   */
  async startRemoteScan(): Promise<{ targetsScanned: number }> {
    if (!this.initialized) {
      throw new Error('DiscoveryService not initialized');
    }

    const targets = await discoveryStore.listScanTargets();
    const enabledTargets = targets.filter((t) => t.enabled);

    for (const target of enabledTargets) {
      this.publishScanEvent('discovery.scan.remote', {
        event: 'remote_probe',
        targetId: target.id,
        address: target.address,
        portRange: target.portRange,
      });
    }

    console.log(`[DiscoveryService] Remote scan started for ${enabledTargets.length} targets`);
    return { targetsScanned: enabledTargets.length };
  }

  /**
   * Ingest a discovery event reported by a client browser.
   * Routes through the standard onboarding pipeline with origin='client'.
   */
  async ingestClientDiscovery(event: DiscoveryEvent): Promise<void> {
    if (!this.pipeline) return;

    const result = await this.pipeline.processDiscoveryEvent(event, this.scope);
    if (result.success) {
      this.publishScanEvent('discovery.device.client_reported', {
        event: 'client_discovery',
        transportType: event.transportType,
        rawIdentifier: event.rawIdentifier,
        resourceId: result.resourceId,
      });
    }
  }

  /**
   * Ingest a discovery event reported by a local bridge agent.
   * Routes through the standard onboarding pipeline with origin='bridge'.
   */
  async ingestBridgeDiscovery(event: DiscoveryEvent): Promise<{ success: boolean; resourceId?: string }> {
    if (!this.pipeline) return { success: false };

    const result = await this.pipeline.processDiscoveryEvent(event, this.scope);
    if (result.success) {
      this.publishScanEvent('discovery.device.bridge_reported', {
        event: 'bridge_discovery',
        transportType: event.transportType,
        rawIdentifier: event.rawIdentifier,
        resourceId: result.resourceId,
      });
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Interface restrictions
  // -------------------------------------------------------------------------

  /**
   * Load disabled interfaces from admin config.
   * These interfaces are in PROTECTED_CONFIG_KEYS so Ironclaw cannot modify them.
   */
  private async loadDisabledInterfaces(): Promise<void> {
    try {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      const result = await pool.query(
        `SELECT value FROM admin_config WHERE key = $1`,
        [DISABLED_INTERFACES_KEY],
      );

      if (result.rows.length > 0) {
        const disabled = result.rows[0].value as string[];
        if (Array.isArray(disabled)) {
          this.disabledInterfaces = new Set(disabled);
          console.log(
            `[DiscoveryService] Disabled interfaces: ${disabled.join(', ')}`,
          );
        }
      }
    } catch {
      // admin_config table may not exist yet — no disabled interfaces
      console.log('[DiscoveryService] No admin config for disabled interfaces');
    }
  }

  /**
   * Update disabled interfaces (admin-only API).
   * Takes effect immediately — disabled scanners are stopped.
   */
  async setDisabledInterfaces(interfaces: string[]): Promise<void> {
    this.disabledInterfaces = new Set(interfaces);

    // Stop any scanners that are now disabled
    if (this.running) {
      for (const transport of interfaces) {
        const scanner = this.scanners.get(transport);
        if (scanner) {
          try {
            scanner.stop();
          } catch {
            // May already be stopped
          }
        }
      }
    }

    // Persist to admin config
    try {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      await pool.query(
        `INSERT INTO admin_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [DISABLED_INTERFACES_KEY, JSON.stringify(interfaces)],
      );
    } catch {
      console.warn('[DiscoveryService] Failed to persist disabled interfaces to admin config');
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Get the trust tier for a resource by its resource ID.
   * Returns null if resource not found.
   */
  private async getDeviceTrustTier(
    resourceId: string,
  ): Promise<string | null> {
    if (!this.resourceRegistry) return null;

    try {
      await this.resourceRegistry.ensureInitialized();
      const resource = this.resourceRegistry.getResource(resourceId);
      return resource?.trustTier ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Publish a scan lifecycle event to the message bus.
   */
  private publishScanEvent(
    channel: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.messageBus) return;

    this.messageBus
      .publish({
        sourceDid: 'did:near:system-discovery',
        sourceType: 'system' as never,
        destinationType: 'broadcast' as never,
        destinationTarget: channel,
        messageType: channel,
        payload,
        priority: 'normal' as never,
      })
      .catch((err: unknown) => {
        console.warn(
          `[DiscoveryService] Failed to publish scan event ${channel}:`,
          err instanceof Error ? err.message : err,
        );
      });
  }

  /**
   * Get the onboarding pipeline (for external Ironclaw result handling).
   */
  getPipeline(): OnboardingPipeline | null {
    return this.pipeline;
  }

  /**
   * Check if a transport is available and not disabled.
   */
  isTransportAvailable(transport: string): boolean {
    const scanner = this.scanners.get(transport);
    if (!scanner) return false;
    return scanner.isAvailable && !this.disabledInterfaces.has(transport);
  }

  /**
   * Get persistent connections (for monitoring/debugging).
   */
  getPersistentConnections(): Set<string> {
    return new Set(this.persistentConnections);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let serviceInstance: DiscoveryService | null = null;

/**
 * Get the singleton DiscoveryService instance.
 * Call initialize() before first use.
 */
export function getDiscoveryService(): DiscoveryService {
  if (!serviceInstance) {
    // Access private constructor via type assertion
    serviceInstance = new (DiscoveryService as unknown as { new (): DiscoveryService })();
  }
  return serviceInstance;
}

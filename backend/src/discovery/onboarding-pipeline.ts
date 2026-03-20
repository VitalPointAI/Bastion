/**
 * Onboarding Pipeline
 *
 * Phase 32 Plan 05: Chains discovery pipeline stages in order:
 * deduplication -> insert -> fingerprint -> authenticate -> gate check -> onboard.
 *
 * Handles all gate decisions (allowed, rejected, unknown), reconnection of
 * previously known devices, and Ironclaw analysis enqueueing for unknowns.
 * Devices start at observer trust tier per user decision.
 */

import { discoveryStore } from './discovery-store.js';
import { FingerprintService } from './fingerprint-service.js';
import { verifySimpleDevice, generateChallenge, verifyChallenge, isChallengeExpired } from './challenge-auth.js';
import { AcceptanceGate } from './acceptance-gate.js';
import { DeviceState, TransportType } from './types.js';
import type {
  DiscoveryEvent,
  DeviceFingerprint,
  OnboardingResult,
  ChallengeResult,
} from './types.js';
import type { ResourceRegistry } from '../resources/resource-registry.js';
import type { MessageBus } from '../messaging/message-bus.js';
import type { PgBoss } from 'pg-boss';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** DID for the discovery system when publishing messages */
const DISCOVERY_SYSTEM_DID = 'did:near:system-discovery';

/** pg-boss queue name for Ironclaw analysis jobs */
const IRONCLAW_QUEUE = 'discovery.ironclaw_analysis';

// ---------------------------------------------------------------------------
// OnboardingPipeline
// ---------------------------------------------------------------------------

export class OnboardingPipeline {
  private store: typeof discoveryStore;
  private fingerprintService: FingerprintService;
  private acceptanceGate: AcceptanceGate;
  private resourceRegistry: ResourceRegistry;
  private messageBus: MessageBus;
  private boss: PgBoss | null = null;

  constructor(deps: {
    discoveryStore: typeof discoveryStore;
    fingerprintService: FingerprintService;
    acceptanceGate: AcceptanceGate;
    resourceRegistry: ResourceRegistry;
    messageBus: MessageBus;
  }) {
    this.store = deps.discoveryStore;
    this.fingerprintService = deps.fingerprintService;
    this.acceptanceGate = deps.acceptanceGate;
    this.resourceRegistry = deps.resourceRegistry;
    this.messageBus = deps.messageBus;
  }

  /**
   * Set the pg-boss instance for Ironclaw job enqueueing.
   */
  setBoss(boss: PgBoss): void {
    this.boss = boss;
  }

  // -------------------------------------------------------------------------
  // Main pipeline entry
  // -------------------------------------------------------------------------

  /**
   * Process a discovery event through the full onboarding pipeline.
   *
   * Steps: dedup -> insert -> fingerprint -> auth -> gate -> onboard
   *
   * @param event - Raw discovery event from a scanner
   * @param scope - Problem set scope for access list evaluation ('global' or PS id)
   * @returns OnboardingResult with success status and optional resource/DID info
   */
  async processDiscoveryEvent(
    event: DiscoveryEvent,
    scope: string,
  ): Promise<OnboardingResult> {
    try {
      // Step 1: Deduplication
      const existing = await this.store.getDeviceByRawId(
        event.transportType,
        event.rawIdentifier,
      );

      if (existing) {
        return this.handleExistingDevice(existing, event);
      }

      // Step 2: Insert new device record
      const device = await this.store.insertDiscoveredDevice({
        transportType: event.transportType,
        rawIdentifier: event.rawIdentifier,
        fingerprint: null,
        state: DeviceState.discovered,
        firstSeen: new Date(event.firstSeen),
        lastSeen: new Date(event.lastSeen),
        signalStrength: event.signalStrength,
      });

      // Step 3: Fingerprint
      const fingerprint = await this.runFingerprinting(device.id, event);

      // Step 4: Authenticate
      const authResult = await this.runAuthentication(device.id, event, fingerprint);
      if (!authResult.success) {
        return {
          success: false,
          error: 'Authentication failed — device quarantined',
        };
      }

      // Step 5: Gate check
      const gateResult = await this.runGateCheck(device.id, fingerprint, scope);
      if (gateResult === 'rejected') {
        return { success: false, error: 'Device rejected by acceptance gate' };
      }
      if (gateResult === 'unknown') {
        return {
          success: false,
          error: 'Device sent to Ironclaw for analysis — pending DAO approval',
        };
      }

      // Step 6: Onboard (gate returned 'allowed')
      return this.runOnboarding(device.id, fingerprint, authResult, scope);
    } catch (err) {
      // Pipeline error — quarantine the device if we have a record
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown pipeline error';
      console.error(
        `[OnboardingPipeline] Pipeline error for ${event.transportType}:${event.rawIdentifier}:`,
        errorMessage,
      );

      // Try to quarantine if device was inserted
      try {
        const device = await this.store.getDeviceByRawId(
          event.transportType,
          event.rawIdentifier,
        );
        if (device && device.state !== DeviceState.quarantined) {
          await this.store.updateDeviceState(device.id, DeviceState.quarantined, {
            quarantineReason: `Pipeline error: ${errorMessage}`,
          } as never);
        }
      } catch {
        // Best-effort quarantine — log and continue
      }

      return { success: false, error: errorMessage };
    }
  }

  // -------------------------------------------------------------------------
  // Ironclaw result handler
  // -------------------------------------------------------------------------

  /**
   * Process the result of an Ironclaw analysis + DAO vote.
   *
   * Called when Ironclaw completes analysis and DAO approves/rejects the device.
   *
   * @param deviceId - The discovered device ID
   * @param approved - Whether DAO approved the device
   * @param analysis - Ironclaw analysis data for audit trail
   */
  async processIronclawResult(
    deviceId: string,
    approved: boolean,
    analysis: Record<string, unknown>,
  ): Promise<void> {
    if (approved) {
      // Update with analysis data, move to onboarding
      await this.store.updateDeviceState(deviceId, DeviceState.onboarding, {
        ironclawAnalysis: analysis,
      } as never);

      // Run onboarding step (need to retrieve device for fingerprint)
      const pool = (await import('../lib/database.js')).getPool();
      const result = await pool.query(
        'SELECT * FROM discovered_devices WHERE id = $1',
        [deviceId],
      );
      if (result.rows.length > 0) {
        const device = result.rows[0];
        const fingerprint = device.fingerprint as DeviceFingerprint | null;
        if (fingerprint) {
          await this.runOnboarding(
            deviceId,
            fingerprint,
            { success: true }, // Auth already passed before Ironclaw
            'global',
          );
        }
      }
    } else {
      await this.store.updateDeviceState(deviceId, DeviceState.rejected, {
        ironclawAnalysis: analysis,
      } as never);

      await this.publishEvent('discovery.device.rejected', {
        deviceId,
        reason: 'Ironclaw analysis: DAO rejected device',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step handlers
  // -------------------------------------------------------------------------

  /**
   * Handle a device that already exists in the store.
   * Reconnect disconnected devices, skip already-processing devices.
   */
  private async handleExistingDevice(
    existing: import('./types.js').DiscoveredDevice,
    event: DiscoveryEvent,
  ): Promise<OnboardingResult> {
    switch (existing.state) {
      case DeviceState.connected:
      case DeviceState.onboarding:
        // Already handled — just update lastSeen
        await this.store.updateDeviceState(existing.id, existing.state, {
          lastSeen: new Date(event.lastSeen),
          signalStrength: event.signalStrength,
        } as never);
        return {
          success: true,
          resourceId: existing.resourceId,
          deviceDid: existing.deviceDid,
        };

      case DeviceState.disconnected:
        // Reconnect flow — update state back to connected
        await this.store.updateDeviceState(existing.id, DeviceState.connected, {
          lastSeen: new Date(event.lastSeen),
          signalStrength: event.signalStrength,
        } as never);
        await this.publishEvent('discovery.device.connected', {
          deviceId: existing.id,
          transportType: existing.transportType,
          reconnect: true,
        });
        return {
          success: true,
          resourceId: existing.resourceId,
          deviceDid: existing.deviceDid,
        };

      case DeviceState.rejected:
      case DeviceState.revoked:
        // Don't re-process — log attempt
        console.warn(
          `[OnboardingPipeline] Rejected/revoked device re-appeared: ${existing.id} (${existing.state})`,
        );
        await this.store.updateDeviceState(existing.id, existing.state, {
          lastSeen: new Date(event.lastSeen),
        } as never);
        return {
          success: false,
          error: `Device is ${existing.state} — not re-processing`,
        };

      case DeviceState.quarantined:
        // Don't re-process quarantined devices
        console.warn(
          `[OnboardingPipeline] Quarantined device re-appeared: ${existing.id}`,
        );
        await this.store.updateDeviceState(existing.id, existing.state, {
          lastSeen: new Date(event.lastSeen),
        } as never);
        return {
          success: false,
          error: 'Device is quarantined — not re-processing',
        };

      default:
        // Device is in some intermediate state (fingerprinting, authenticating, etc.)
        // Update lastSeen but don't restart the pipeline
        await this.store.updateDeviceState(existing.id, existing.state, {
          lastSeen: new Date(event.lastSeen),
        } as never);
        return {
          success: false,
          error: `Device in intermediate state: ${existing.state}`,
        };
    }
  }

  /**
   * Step 3: Fingerprint the device.
   */
  private async runFingerprinting(
    deviceId: string,
    event: DiscoveryEvent,
  ): Promise<DeviceFingerprint> {
    await this.store.updateDeviceState(deviceId, DeviceState.fingerprinting);
    const fingerprint = await this.fingerprintService.fingerprint(event);
    await this.store.updateDeviceState(deviceId, DeviceState.fingerprinting, {
      fingerprint,
    } as never);
    return fingerprint;
  }

  /**
   * Step 4: Authenticate the device.
   *
   * BLE/USB (simple devices) use verifySimpleDevice.
   * WiFi/TAK (network-capable) attempt challenge-response first,
   * falling back to verifySimpleDevice.
   */
  private async runAuthentication(
    deviceId: string,
    event: DiscoveryEvent,
    fingerprint: DeviceFingerprint,
  ): Promise<ChallengeResult> {
    await this.store.updateDeviceState(deviceId, DeviceState.authenticating);

    let result: ChallengeResult;

    if (
      event.transportType === TransportType.ble ||
      event.transportType === TransportType.usb
    ) {
      // Simple devices — fingerprint stability verification
      result = await verifySimpleDevice(event, fingerprint);
    } else {
      // Network-capable devices — try challenge-response
      const publicKey = (event.rawData.publicKey as string) ?? null;
      if (publicKey) {
        const challenge = generateChallenge();
        // In a real implementation the challenge would be sent to the device
        // and its response received. For now, check if device provided a
        // pre-signed response in rawData (common in TAK/CoT).
        const response = event.rawData.challengeResponse as Buffer | undefined;
        if (response && !isChallengeExpired(challenge)) {
          result = await verifyChallenge(challenge.nonce, response, publicKey);
        } else {
          // Device didn't respond to challenge — fall back to simple verification
          result = await verifySimpleDevice(event, fingerprint);
        }
      } else {
        // No public key available — use simple verification
        result = await verifySimpleDevice(event, fingerprint);
      }
    }

    if (!result.success) {
      await this.store.updateDeviceState(deviceId, DeviceState.quarantined, {
        quarantineReason: 'auth_failed',
      } as never);
      await this.publishEvent('discovery.device.quarantined', {
        deviceId,
        reason: 'auth_failed',
      });
    }

    return result;
  }

  /**
   * Step 5: Run the acceptance gate check.
   *
   * Returns 'allowed', 'rejected', or 'unknown'.
   * For 'unknown', enqueues Ironclaw analysis job.
   */
  private async runGateCheck(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    scope: string,
  ): Promise<'allowed' | 'rejected' | 'unknown'> {
    await this.store.updateDeviceState(deviceId, DeviceState.gate_check);

    const decision = await this.acceptanceGate.evaluate(
      deviceId,
      fingerprint,
      scope,
    );

    switch (decision.decision) {
      case 'allowed':
        // Publish notification — operators know a device was auto-accepted
        await this.publishEvent('discovery.device.allowed', {
          deviceId,
          matchedEntry: decision.matchedEntry,
        });
        return 'allowed';

      case 'rejected':
        await this.store.updateDeviceState(deviceId, DeviceState.rejected, {
          quarantineReason: `Rejected by access list: ${decision.matchedEntry?.matchType}=${decision.matchedEntry?.matchValue}`,
        } as never);
        await this.publishEvent('discovery.device.rejected', {
          deviceId,
          reason: 'blocklist_match',
          matchedEntry: decision.matchedEntry,
        });
        return 'rejected';

      case 'unknown':
        // Enqueue Ironclaw analysis
        await this.store.updateDeviceState(
          deviceId,
          DeviceState.ironclaw_analysis,
        );
        await this.enqueueIronclawJob(deviceId, fingerprint);
        await this.publishEvent('discovery.device.ironclaw_analysis', {
          deviceId,
          fingerprint,
        });
        return 'unknown';

      default:
        return 'unknown';
    }
  }

  /**
   * Step 6: Onboard the device as a Bastion resource.
   *
   * Creates a resource DID, registers as observer trust tier,
   * updates the device record, and publishes success notification.
   */
  private async runOnboarding(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    authResult: ChallengeResult,
    scope: string,
  ): Promise<OnboardingResult> {
    await this.store.updateDeviceState(deviceId, DeviceState.onboarding);

    try {
      // Register as resource with observer trust tier
      const displayName =
        fingerprint.displayName ??
        fingerprint.manufacturer ??
        `Device-${deviceId.substring(0, 8)}`;

      const registered = await this.resourceRegistry.registerResource({
        name: displayName,
        category: 'sensors' as const, // Discovery devices default to sensors category
        missionId: scope === 'global' ? 'discovery' : scope,
        specifications: {
          fingerprint,
          deviceId,
          authPublicKey: authResult.devicePublicKey,
          trustTier: 'observer', // Devices start as observer per user decision
          discoveredAt: new Date().toISOString(),
        },
        isAutonomous: false, // Observer tier — not autonomous
        capabilities: fingerprint.capabilities,
      });

      // Update device record with DID and resource ID
      await this.store.updateDeviceState(deviceId, DeviceState.connected, {
        deviceDid: registered.did,
        resourceId: registered.id,
      } as never);

      // Publish onboarding success notification
      await this.publishEvent('discovery.device.connected', {
        deviceId,
        resourceId: registered.id,
        deviceDid: registered.did,
        displayName,
        trustTier: 'observer',
      });

      return {
        success: true,
        resourceId: registered.id,
        deviceDid: registered.did,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Onboarding registration failed';
      await this.store.updateDeviceState(deviceId, DeviceState.quarantined, {
        quarantineReason: `Onboarding failed: ${errorMessage}`,
      } as never);
      return { success: false, error: errorMessage };
    }
  }

  // -------------------------------------------------------------------------
  // Ironclaw job enqueueing
  // -------------------------------------------------------------------------

  /**
   * Enqueue an Ironclaw analysis job via pg-boss.
   * The Ironclaw service (Phase 30) picks this up via its tool-bridge pattern.
   */
  private async enqueueIronclawJob(
    deviceId: string,
    fingerprint: DeviceFingerprint,
  ): Promise<void> {
    if (!this.boss) {
      // Try to get shared boss instance
      try {
        const { getSharedBoss } = await import('../lib/database.js');
        this.boss = await getSharedBoss();
      } catch {
        console.warn(
          '[OnboardingPipeline] pg-boss not available — Ironclaw job not enqueued',
        );
        return;
      }
    }

    if (this.boss) {
      await this.boss.createQueue(IRONCLAW_QUEUE);
      await this.boss.send(IRONCLAW_QUEUE, {
        deviceId,
        fingerprint,
        enqueuedAt: new Date().toISOString(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Event publishing
  // -------------------------------------------------------------------------

  /**
   * Publish a discovery event to the message bus.
   */
  private async publishEvent(
    channel: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.messageBus.publish({
        sourceDid: DISCOVERY_SYSTEM_DID,
        sourceType: 'system' as never,
        destinationType: 'broadcast' as never,
        destinationTarget: channel,
        messageType: channel,
        payload,
        priority: 'normal' as never,
      });
    } catch (err) {
      // Non-fatal — log and continue
      console.warn(
        `[OnboardingPipeline] Failed to publish event ${channel}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Acceptance Gate — Allowlist/Blocklist with DAO Governance
 *
 * Phase 32 Plan 04: Evaluates discovered devices against scope-aware access lists
 * and creates DAO decision gates for unknown devices requiring operator approval.
 *
 * Blocklist takes precedence over allowlist (security-first).
 * Scope inheritance: PS adds to but cannot subtract from global blocklist.
 */

import { discoveryStore } from './discovery-store.js';
import { FingerprintService } from './fingerprint-service.js';
import type { GateService } from '../gates/gate-service.js';
import { GateType } from '../gates/gate-types.js';
import type { DeviceFingerprint, DeviceAccessEntry, MatchType } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcceptanceDecision {
  decision: 'allowed' | 'rejected' | 'unknown';
  matchedEntry?: DeviceAccessEntry;
}

// ---------------------------------------------------------------------------
// AcceptanceGate
// ---------------------------------------------------------------------------

export class AcceptanceGate {
  private store: typeof discoveryStore;
  private gateService?: GateService;

  constructor(
    store: typeof discoveryStore,
    gateService?: GateService,
  ) {
    this.store = store;
    this.gateService = gateService;
  }

  /**
   * Evaluate a device against the effective access list for the given scope.
   *
   * Check priority order:
   * 1. fingerprint_hash (most specific)
   * 2. mac (if rawIdentifier looks like MAC)
   * 3. vendor_id (from manufacturer)
   * 4. product_id (from model)
   * 5. cot_type (for TAK devices)
   *
   * Blocklist check first — if ANY match type is blocked, device is rejected.
   * Allowlist check second — if any match type is allowed, device proceeds.
   * No match on either list — device is unknown and requires DAO approval.
   */
  async evaluate(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    scope: string,
  ): Promise<AcceptanceDecision> {
    const fingerprintHash = FingerprintService.generateFingerprintHash(fingerprint);

    // Build match candidates in priority order
    const matchCandidates = this.buildMatchCandidates(
      deviceId,
      fingerprint,
      fingerprintHash,
    );

    // Check blocklist FIRST — blocklist takes precedence
    for (const candidate of matchCandidates) {
      const result = await this.store.checkAccessList(
        candidate.matchType,
        candidate.matchValue,
        scope,
      );
      if (result.blocked) {
        return { decision: 'rejected', matchedEntry: result.entry };
      }
    }

    // Check allowlist second
    for (const candidate of matchCandidates) {
      const result = await this.store.checkAccessList(
        candidate.matchType,
        candidate.matchValue,
        scope,
      );
      if (result.allowed) {
        return { decision: 'allowed', matchedEntry: result.entry };
      }
    }

    // No match on either list — unknown device
    return { decision: 'unknown' };
  }

  /**
   * Create a DAO decision gate for onboarding an unknown device.
   * Returns the gate ID for tracking.
   */
  async createOnboardingGate(
    problemSetId: string,
    deviceId: string,
    fingerprint: DeviceFingerprint,
    ironclawAnalysis?: Record<string, unknown>,
  ): Promise<string> {
    if (!this.gateService) {
      throw new Error(
        'GateService not configured — cannot create onboarding gate',
      );
    }

    const gate = await this.gateService.createGate({
      problem_set_id: problemSetId,
      gate_type: GateType.device_onboard as never,
      target_item_id: deviceId,
      target_item_type: 'device',
      target_item_title: `Onboard: ${fingerprint.displayName || 'Unknown device'}`,
      enforcement: 'hard_block',
    });

    // Store decision context (fingerprint + ironclaw analysis) via gate update
    // The gate's decision_context field holds the supporting evidence
    if (ironclawAnalysis || fingerprint) {
      const pool = (await import('../lib/database.js')).getPool();
      await pool.query(
        `UPDATE decision_gates SET decision_context = $1 WHERE id = $2`,
        [
          JSON.stringify({ fingerprint, ironclawAnalysis: ironclawAnalysis ?? null }),
          gate.id,
        ],
      );
    }

    return gate.id;
  }

  /**
   * Emergency disconnect: immediately revoke device access.
   * Logged with admin DID and reason. Creates post-hoc DAO gate for ratification.
   */
  async handleEmergencyDisconnect(
    deviceId: string,
    adminDid: string,
    reason: string,
  ): Promise<void> {
    // Update device state to revoked
    await this.store.updateDeviceState(deviceId, 'revoked', {
      quarantineReason: `Emergency disconnect by ${adminDid}: ${reason}`,
    } as never);

    // Log the emergency action
    console.warn(
      `[AcceptanceGate] EMERGENCY DISCONNECT: device=${deviceId} admin=${adminDid} reason="${reason}"`,
    );

    // Create post-hoc DAO gate for ratification (soft warning — already acted)
    if (this.gateService) {
      await this.gateService.createGate({
        problem_set_id: 'global',
        gate_type: GateType.device_onboard as never,
        target_item_id: deviceId,
        target_item_type: 'device',
        target_item_title: `Ratify emergency disconnect: ${deviceId}`,
        enforcement: 'soft_warning',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build match candidates in priority order from fingerprint data.
   */
  private buildMatchCandidates(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    fingerprintHash: string,
  ): Array<{ matchType: MatchType; matchValue: string }> {
    const candidates: Array<{ matchType: MatchType; matchValue: string }> = [];

    // 1. fingerprint_hash (most specific)
    candidates.push({
      matchType: 'fingerprint_hash' as MatchType,
      matchValue: fingerprintHash,
    });

    // 2. mac (if hardwareId looks like MAC address)
    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
    if (fingerprint.hardwareId && macPattern.test(fingerprint.hardwareId)) {
      candidates.push({
        matchType: 'mac' as MatchType,
        matchValue: fingerprint.hardwareId.toLowerCase(),
      });
    }

    // 3. vendor_id (from manufacturer)
    if (fingerprint.manufacturer) {
      candidates.push({
        matchType: 'vendor_id' as MatchType,
        matchValue: fingerprint.manufacturer,
      });
    }

    // 4. product_id (from model)
    if (fingerprint.model) {
      candidates.push({
        matchType: 'product_id' as MatchType,
        matchValue: fingerprint.model,
      });
    }

    // 5. cot_type (for TAK devices — extract from capabilities)
    const cotCapability = fingerprint.capabilities.find((c) =>
      c.startsWith('cot:'),
    );
    if (cotCapability) {
      candidates.push({
        matchType: 'cot_type' as MatchType,
        matchValue: cotCapability.replace('cot:', ''),
      });
    }

    return candidates;
  }
}

/**
 * Ironclaw Audit Anchor Service
 *
 * Phase 30 Plan 08: Batch blockchain anchoring of the action audit trail.
 * Computes Merkle roots from action log hashes and creates anchor records.
 * Emergency actions are anchored immediately (not batched).
 *
 * TODO: Submit Merkle root to NEAR contract -- requires contract method
 * for audit anchoring. Currently logs anchors and persists to DB only.
 */

import { createHash } from 'crypto';
import { ironclawStore } from './ironclaw-store.js';
import type { ActionLogEntry } from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100; // Anchor every 100 actions
const BATCH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnchorResult {
  anchored: boolean;
  actionCount?: number;
  merkleRoot?: string;
}

// ---------------------------------------------------------------------------
// AuditAnchorService
// ---------------------------------------------------------------------------

export class AuditAnchorService {
  private batchSize = BATCH_SIZE;
  private batchIntervalMs = BATCH_INTERVAL_MS;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the periodic audit anchoring service.
   */
  async start(): Promise<void> {
    this.intervalTimer = setInterval(() => {
      void this.checkAndAnchor(true);
    }, this.batchIntervalMs);

    console.log(
      `[AuditAnchorService] Started, batch every ${this.batchSize} actions or ${this.batchIntervalMs / 60_000} minutes`,
    );
  }

  /**
   * Stop the audit anchoring service.
   */
  async stop(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    console.log('[AuditAnchorService] Stopped');
  }

  /**
   * Check for unanchored actions and anchor them if threshold is met.
   * When triggered by interval timer, anchors regardless of batch size.
   */
  async checkAndAnchor(timerTriggered = false): Promise<AnchorResult> {
    try {
      // Get latest anchor to determine the starting point
      const latestAnchor = await ironclawStore.getLatestAnchor();
      const since = latestAnchor?.batch_end ?? '1970-01-01T00:00:00Z';

      // Get unanchored actions since last anchor
      const actions = await ironclawStore.getUnanchoredActions(since);

      if (actions.length === 0) {
        return { anchored: false };
      }

      // Only anchor if batch threshold met or triggered by timer
      if (actions.length < this.batchSize && !timerTriggered) {
        return { anchored: false };
      }

      // Compute Merkle root from action hashes
      const leafHashes = actions.map((action) => this.hashAction(action));
      const merkleRoot = this.computeMerkleRoot(leafHashes);

      // Create anchor record
      const anchor = await ironclawStore.createAnchor({
        batch_start: actions[0].created_at,
        batch_end: actions[actions.length - 1].created_at,
        action_count: actions.length,
        merkle_root: merkleRoot,
        tx_hash: null,
        anchored_at: null,
      });

      // TODO: Submit Merkle root to NEAR contract -- requires contract method
      // for audit anchoring. For now, log the anchor.
      console.log(
        `[AuditAnchorService] Anchored ${actions.length} actions, ` +
          `merkle_root: ${merkleRoot.slice(0, 16)}..., ` +
          `anchor_id: ${anchor.id}`,
      );

      return {
        anchored: true,
        actionCount: actions.length,
        merkleRoot,
      };
    } catch (err) {
      console.error(
        '[AuditAnchorService] Error during anchoring:',
        err instanceof Error ? err.message : err,
      );
      return { anchored: false };
    }
  }

  /**
   * Compute Merkle root from an array of hex hash strings.
   * Uses binary tree: pairs hashes, combines with SHA-256.
   * Odd leaves are duplicated to make even count.
   */
  computeMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
      return createHash('sha256').update('').digest('hex');
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    let level = [...hashes];

    while (level.length > 1) {
      const nextLevel: string[] = [];

      // If odd number, duplicate the last hash
      if (level.length % 2 !== 0) {
        level.push(level[level.length - 1]);
      }

      for (let i = 0; i < level.length; i += 2) {
        const combined = createHash('sha256')
          .update(level[i] + level[i + 1])
          .digest('hex');
        nextLevel.push(combined);
      }

      level = nextLevel;
    }

    return level[0];
  }

  /**
   * Hash an action log entry for Merkle tree inclusion.
   * Uses canonical JSON with sorted keys for deterministic output.
   */
  hashAction(action: ActionLogEntry): string {
    const canonical = JSON.stringify({
      action_payload: action.action_payload,
      action_type: action.action_type,
      created_at: action.created_at,
      decision: action.decision,
      id: action.id,
      user_did: action.user_did,
    });

    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Anchor an emergency action immediately without batching.
   * Per discretion recommendation: emergency actions get instant anchoring.
   */
  async anchorEmergencyAction(action: ActionLogEntry): Promise<void> {
    try {
      const actionHash = this.hashAction(action);
      // Single-action Merkle root is just the hash itself
      const merkleRoot = actionHash;

      const anchor = await ironclawStore.createAnchor({
        batch_start: action.created_at,
        batch_end: action.created_at,
        action_count: 1,
        merkle_root: merkleRoot,
        tx_hash: null,
        anchored_at: null,
      });

      // TODO: Submit Merkle root to NEAR contract immediately for emergency actions.
      console.log(
        `[AuditAnchorService] Emergency anchor for action ${action.id}, ` +
          `merkle_root: ${merkleRoot.slice(0, 16)}..., ` +
          `anchor_id: ${anchor.id}`,
      );
    } catch (err) {
      console.error(
        '[AuditAnchorService] Emergency anchor failed for action:',
        action.id,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const auditAnchorService = new AuditAnchorService();

/**
 * Strategy Reviewer Checkpointing Integration
 *
 * Integrates the strategy reviewer graph with:
 * 1. PostgresSaver for state persistence
 * 2. Human-in-the-loop checkpoints for approval workflow
 */

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { MemorySaver } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { getPool } from '../../../lib/database.js';
import {
  type StrategyReviewReport,
} from '../state.js';

// ============================================================================
// Review Checkpoint Types
// ============================================================================

/**
 * Review checkpoint status
 */
export type ReviewCheckpointStatus =
  | 'pending_human_approval'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * Review checkpoint record
 */
export interface ReviewCheckpoint {
  /** Unique checkpoint ID */
  checkpointId: string;
  /** Associated review report ID */
  reviewId: string;
  /** Document being reviewed */
  documentId: string;
  /** LangGraph thread ID for state recovery */
  threadId: string;
  /** Review report at checkpoint */
  report: StrategyReviewReport;
  /** Checkpoint status */
  status: ReviewCheckpointStatus;
  /** When checkpoint was created */
  createdAt: Date;
  /** When decision was made */
  decidedAt?: Date;
  /** Who made the decision (DID) */
  decidedBy?: string;
  /** Reason for decision */
  decisionReason?: string;
  /** Expiration time (optional) */
  expiresAt?: Date;
}

/**
 * Human decision on review checkpoint
 */
export interface ReviewDecision {
  /** Approve or reject */
  approved: boolean;
  /** Who made decision (DID) */
  decidedBy: string;
  /** Decision reason */
  reason?: string;
  /** Selective acceptance - only accept these objective IDs */
  acceptedObjectiveIds?: string[];
}

// ============================================================================
// SQL Schema
// ============================================================================

const REVIEW_CHECKPOINT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS review_checkpoints (
    checkpoint_id UUID PRIMARY KEY,
    review_id UUID NOT NULL,
    document_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    report JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_human_approval',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by TEXT,
    decision_reason TEXT,
    expires_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_review_checkpoints_document_id
    ON review_checkpoints(document_id);
  CREATE INDEX IF NOT EXISTS idx_review_checkpoints_status
    ON review_checkpoints(status);
  CREATE INDEX IF NOT EXISTS idx_review_checkpoints_created_at
    ON review_checkpoints(created_at);
`;

// ============================================================================
// Review Checkpoint Manager
// ============================================================================

/**
 * Manages human approval checkpoints for strategy reviews.
 */
export class ReviewCheckpointManager {
  private initialized = false;
  private checkpointer: PostgresSaver | MemorySaver | null = null;

  /**
   * Initialize the manager (creates tables).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    await pool.query(REVIEW_CHECKPOINT_SCHEMA);

    // Try to create PostgresSaver, fall back to MemorySaver
    try {
      const connectionString = process.env.DATABASE_URL;
      if (connectionString) {
        this.checkpointer = PostgresSaver.fromConnString(connectionString);
        await this.checkpointer.setup();
        console.log('[ReviewCheckpoint] PostgresSaver initialized');
      } else {
        this.checkpointer = new MemorySaver();
        console.log('[ReviewCheckpoint] MemorySaver fallback (no DATABASE_URL)');
      }
    } catch (error) {
      console.warn('[ReviewCheckpoint] Failed to initialize PostgresSaver, using MemorySaver:', error);
      this.checkpointer = new MemorySaver();
    }

    this.initialized = true;
    console.log('[ReviewCheckpoint] Manager initialized');
  }

  /**
   * Get the LangGraph checkpointer instance.
   */
  async getCheckpointer(): Promise<PostgresSaver | MemorySaver> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.checkpointer!;
  }

  /**
   * Create a checkpoint for human approval.
   */
  async createCheckpoint(
    report: StrategyReviewReport,
    threadId: string
  ): Promise<ReviewCheckpoint> {
    if (!this.initialized) {
      await this.initialize();
    }

    const checkpoint: ReviewCheckpoint = {
      checkpointId: randomUUID(),
      reviewId: report.id,
      documentId: report.documentId,
      threadId,
      report,
      status: 'pending_human_approval',
      createdAt: new Date(),
    };

    // Store in database
    const pool = getPool();
    await pool.query(
      `INSERT INTO review_checkpoints (
        checkpoint_id, review_id, document_id, thread_id, report, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        checkpoint.checkpointId,
        checkpoint.reviewId,
        checkpoint.documentId,
        checkpoint.threadId,
        JSON.stringify(checkpoint.report),
        checkpoint.status,
        checkpoint.createdAt,
      ]
    );

    console.log(`[ReviewCheckpoint] Created checkpoint ${checkpoint.checkpointId} for review ${report.id}`);
    return checkpoint;
  }

  /**
   * Get a checkpoint by ID.
   */
  async getCheckpoint(checkpointId: string): Promise<ReviewCheckpoint | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM review_checkpoints WHERE checkpoint_id = $1',
      [checkpointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToCheckpoint(result.rows[0]);
  }

  /**
   * Get checkpoints for a document.
   */
  async getCheckpointsForDocument(documentId: string): Promise<ReviewCheckpoint[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM review_checkpoints
       WHERE document_id = $1
       ORDER BY created_at DESC`,
      [documentId]
    );

    return result.rows.map(this.rowToCheckpoint);
  }

  /**
   * Get pending checkpoints.
   */
  async getPendingCheckpoints(limit = 50): Promise<ReviewCheckpoint[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM review_checkpoints
       WHERE status = 'pending_human_approval'
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(this.rowToCheckpoint);
  }

  /**
   * Approve a checkpoint.
   */
  async approve(
    checkpointId: string,
    decision: Omit<ReviewDecision, 'approved'>
  ): Promise<ReviewCheckpoint> {
    return this.resolveCheckpoint(checkpointId, { ...decision, approved: true });
  }

  /**
   * Reject a checkpoint.
   */
  async reject(
    checkpointId: string,
    decision: Omit<ReviewDecision, 'approved'>
  ): Promise<ReviewCheckpoint> {
    return this.resolveCheckpoint(checkpointId, { ...decision, approved: false });
  }

  /**
   * Partially approve a checkpoint (accept some objectives).
   */
  async approvePartial(
    checkpointId: string,
    decision: Omit<ReviewDecision, 'approved'> & { acceptedObjectiveIds: string[] }
  ): Promise<ReviewCheckpoint> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    if (checkpoint.status !== 'pending_human_approval') {
      throw new Error(`Checkpoint ${checkpointId} already resolved (${checkpoint.status})`);
    }

    // Update report status to partial
    const updatedReport: StrategyReviewReport = {
      ...checkpoint.report,
      status: 'partial',
    };

    const pool = getPool();
    await pool.query(
      `UPDATE review_checkpoints SET
        status = 'approved',
        report = $1,
        decided_at = NOW(),
        decided_by = $2,
        decision_reason = $3
      WHERE checkpoint_id = $4`,
      [
        JSON.stringify(updatedReport),
        decision.decidedBy,
        decision.reason || `Partial approval: ${decision.acceptedObjectiveIds.length} objectives accepted`,
        checkpointId,
      ]
    );

    const updated = await this.getCheckpoint(checkpointId);
    console.log(`[ReviewCheckpoint] Partially approved ${checkpointId}: ${decision.acceptedObjectiveIds.length} objectives`);
    return updated!;
  }

  /**
   * Resolve a checkpoint (approve or reject).
   */
  private async resolveCheckpoint(
    checkpointId: string,
    decision: ReviewDecision
  ): Promise<ReviewCheckpoint> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    if (checkpoint.status !== 'pending_human_approval') {
      throw new Error(`Checkpoint ${checkpointId} already resolved (${checkpoint.status})`);
    }

    const newStatus = decision.approved ? 'approved' : 'rejected';
    const reportStatus = decision.approved ? 'accepted' : 'rejected';

    // Update report
    const updatedReport: StrategyReviewReport = {
      ...checkpoint.report,
      status: reportStatus,
      ...(decision.approved
        ? { acceptedAt: new Date(), acceptedBy: decision.decidedBy }
        : { rejectedAt: new Date(), rejectedBy: decision.decidedBy, rejectionReason: decision.reason }),
    };

    const pool = getPool();
    await pool.query(
      `UPDATE review_checkpoints SET
        status = $1,
        report = $2,
        decided_at = NOW(),
        decided_by = $3,
        decision_reason = $4
      WHERE checkpoint_id = $5`,
      [newStatus, JSON.stringify(updatedReport), decision.decidedBy, decision.reason || null, checkpointId]
    );

    const updated = await this.getCheckpoint(checkpointId);
    console.log(`[ReviewCheckpoint] ${newStatus} checkpoint ${checkpointId}`);
    return updated!;
  }

  /**
   * Convert database row to checkpoint.
   */
  private rowToCheckpoint(row: Record<string, unknown>): ReviewCheckpoint {
    return {
      checkpointId: row.checkpoint_id as string,
      reviewId: row.review_id as string,
      documentId: row.document_id as string,
      threadId: row.thread_id as string,
      report: row.report as StrategyReviewReport,
      status: row.status as ReviewCheckpointStatus,
      createdAt: new Date(row.created_at as string),
      decidedAt: row.decided_at ? new Date(row.decided_at as string) : undefined,
      decidedBy: row.decided_by as string | undefined,
      decisionReason: row.decision_reason as string | undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: ReviewCheckpointManager | null = null;

/**
 * Get or create the review checkpoint manager singleton.
 */
export function getReviewCheckpointManager(): ReviewCheckpointManager {
  if (!managerInstance) {
    managerInstance = new ReviewCheckpointManager();
  }
  return managerInstance;
}

/**
 * Human-in-the-Loop Checkpoints
 *
 * Implements human approval checkpoints within LangGraph flows.
 * Enables human oversight for critical decisions, classification
 * escalation, and high-risk actions.
 *
 * Features:
 * - Configurable checkpoint triggers
 * - Workflow pause and resume
 * - State modification on approval
 * - Integration with message bus for notifications
 * - PostgreSQL persistence for pending checkpoints
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { getMessageBus } from '../messaging/message-bus.js';
import {
  BastionStateAnnotation,
  type BastionState,
  type ClassificationLevel,
  type InterruptSignal,
  CLASSIFICATION_ORDER,
} from './state.js';

/**
 * Checkpoint trigger types
 */
export enum CheckpointTriggerType {
  /** Classification is about to escalate */
  ClassificationEscalation = 'classification_escalation',
  /** High-risk action (transfers, function calls) */
  HighRiskAction = 'high_risk_action',
  /** Explicit human review requested */
  ExplicitRequest = 'explicit_request',
  /** Autonomy level exceeded */
  AutonomyExceeded = 'autonomy_exceeded',
  /** Iteration limit reached */
  IterationLimit = 'iteration_limit',
  /** Custom trigger */
  Custom = 'custom',
}

/**
 * Checkpoint trigger configuration
 */
export interface CheckpointTrigger {
  /** Trigger type */
  type: CheckpointTriggerType;
  /** Human-readable description */
  description: string;
  /** Condition function - returns true if checkpoint should trigger */
  condition: (state: BastionState) => boolean;
  /** Priority (higher = more important) */
  priority?: number;
  /** Required approval role (if any) */
  requiredRole?: string;
}

/**
 * Pending checkpoint record
 */
export interface PendingCheckpoint {
  /** Unique checkpoint ID */
  checkpointId: string;
  /** Thread ID for state recovery */
  threadId: string;
  /** Trigger that caused the checkpoint */
  trigger: CheckpointTriggerType;
  /** Trigger description */
  triggerDescription: string;
  /** State at checkpoint (serialized) */
  state: BastionState;
  /** Classification level */
  classification: ClassificationLevel;
  /** Current agent */
  currentAgent: string | null;
  /** Next intended agent */
  nextAgent: string | null;
  /** When checkpoint was created */
  createdAt: string;
  /** Checkpoint status */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Expiration time (if any) */
  expiresAt?: string;
  /** Who approved/rejected */
  decidedBy?: string;
  /** Decision timestamp */
  decidedAt?: string;
  /** Decision reason */
  decisionReason?: string;
  /** State modifications on approval */
  modifications?: Record<string, unknown>;
  /** Priority */
  priority?: number;
  /** Required role for approval */
  requiredRole?: string;
}

/**
 * Human decision on a checkpoint
 */
export interface HumanDecision {
  /** Was the checkpoint approved */
  approved: boolean;
  /** Who made the decision */
  decidedBy: string;
  /** Reason for decision */
  reason?: string;
  /** State modifications (if approved) */
  modifications?: Partial<BastionState>;
}

/**
 * Result of resuming after checkpoint
 */
export interface ResumeResult {
  /** Whether execution resumed */
  resumed: boolean;
  /** Whether execution was terminated */
  terminated: boolean;
  /** Reason for termination if applicable */
  terminationReason?: string;
  /** Thread ID */
  threadId: string;
  /** Checkpoint ID that was resolved */
  checkpointId: string;
}

/**
 * SQL for initializing checkpoint tables
 */
const INIT_SQL = `
  -- Human checkpoints table
  CREATE TABLE IF NOT EXISTS human_checkpoints (
    checkpoint_id UUID PRIMARY KEY,
    thread_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_description TEXT NOT NULL,
    state JSONB NOT NULL,
    classification TEXT NOT NULL,
    current_agent TEXT,
    next_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    modifications JSONB,
    priority INTEGER DEFAULT 0,
    required_role TEXT
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_human_checkpoints_thread_id ON human_checkpoints(thread_id);
  CREATE INDEX IF NOT EXISTS idx_human_checkpoints_status ON human_checkpoints(status);
  CREATE INDEX IF NOT EXISTS idx_human_checkpoints_classification ON human_checkpoints(classification);
  CREATE INDEX IF NOT EXISTS idx_human_checkpoints_created_at ON human_checkpoints(created_at);
  CREATE INDEX IF NOT EXISTS idx_human_checkpoints_expires_at ON human_checkpoints(expires_at);
`;

/**
 * HumanCheckpointManager - Manages human approval checkpoints
 */
export class HumanCheckpointManager {
  private initialized = false;
  private triggers: Map<string, CheckpointTrigger> = new Map();
  private pendingCheckpoints: Map<string, PendingCheckpoint> = new Map();

  constructor() {
    // Register default triggers
    this.registerDefaultTriggers();
  }

  /**
   * Initialize the manager (creates tables)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    try {
      await pool.query(INIT_SQL);

      // Load pending checkpoints from database
      await this.loadPendingCheckpoints();

      this.initialized = true;
      console.log('[HumanCheckpoints] Initialized');
    } catch (error) {
      console.error('[HumanCheckpoints] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure initialization
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Register a checkpoint trigger
   */
  registerTrigger(id: string, trigger: CheckpointTrigger): void {
    this.triggers.set(id, trigger);
  }

  /**
   * Remove a trigger
   */
  removeTrigger(id: string): void {
    this.triggers.delete(id);
  }

  /**
   * Create a checkpoint node for the graph
   */
  createCheckpointNode(
    triggerIds?: string[]
  ): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      await this.ensureInitialized();

      // Get triggers to check
      const triggersToCheck = triggerIds
        ? triggerIds.map(id => this.triggers.get(id)).filter((t): t is CheckpointTrigger => t !== undefined)
        : Array.from(this.triggers.values());

      // Find first matching trigger
      let matchedTrigger: CheckpointTrigger | null = null;
      for (const trigger of triggersToCheck) {
        if (trigger.condition(state)) {
          matchedTrigger = trigger;
          break;
        }
      }

      if (!matchedTrigger) {
        // No checkpoint needed
        return {};
      }

      // Create checkpoint
      const checkpointId = randomUUID();
      const checkpoint: PendingCheckpoint = {
        checkpointId,
        threadId: state.threadId,
        trigger: matchedTrigger.type,
        triggerDescription: matchedTrigger.description,
        state,
        classification: state.classification,
        currentAgent: state.currentAgent,
        nextAgent: state.next,
        createdAt: new Date().toISOString(),
        status: 'pending',
        priority: matchedTrigger.priority,
        requiredRole: matchedTrigger.requiredRole,
      };

      // Store checkpoint
      await this.storeCheckpoint(checkpoint);

      // Notify via message bus
      await this.notifyCheckpoint(checkpoint);

      // Return interrupt signal
      return {
        interrupt: {
          checkpointId,
          reason: matchedTrigger.type,
          context: {
            triggerDescription: matchedTrigger.description,
            classification: state.classification,
            currentAgent: state.currentAgent,
          },
        },
      };
    };
  }

  /**
   * Get pending checkpoints
   */
  async getPendingCheckpoints(options?: {
    classification?: ClassificationLevel;
    status?: 'pending' | 'approved' | 'rejected' | 'expired';
    limit?: number;
    offset?: number;
  }): Promise<{ checkpoints: PendingCheckpoint[]; total: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options?.classification) {
      conditions.push(`classification = $${paramIdx}`);
      params.push(options.classification);
      paramIdx++;
    }

    if (options?.status) {
      conditions.push(`status = $${paramIdx}`);
      params.push(options.status);
      paramIdx++;
    } else {
      conditions.push(`status = 'pending'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Get count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM human_checkpoints ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get checkpoints
    params.push(limit);
    params.push(offset);
    const result = await pool.query(
      `SELECT * FROM human_checkpoints ${whereClause}
       ORDER BY priority DESC, created_at ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return {
      checkpoints: result.rows.map(this.rowToCheckpoint),
      total,
    };
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(checkpointId: string): Promise<PendingCheckpoint | null> {
    await this.ensureInitialized();

    // Check memory cache first
    if (this.pendingCheckpoints.has(checkpointId)) {
      return this.pendingCheckpoints.get(checkpointId)!;
    }

    // Query database
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM human_checkpoints WHERE checkpoint_id = $1',
      [checkpointId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToCheckpoint(result.rows[0]);
  }

  /**
   * Approve a checkpoint and resume execution
   */
  async approve(
    checkpointId: string,
    decision: Omit<HumanDecision, 'approved'>
  ): Promise<ResumeResult> {
    return this.resolve(checkpointId, { ...decision, approved: true });
  }

  /**
   * Reject a checkpoint and terminate execution
   */
  async reject(
    checkpointId: string,
    decision: Omit<HumanDecision, 'approved'>
  ): Promise<ResumeResult> {
    return this.resolve(checkpointId, { ...decision, approved: false });
  }

  /**
   * Resolve a checkpoint (approve or reject)
   */
  async resolve(
    checkpointId: string,
    decision: HumanDecision
  ): Promise<ResumeResult> {
    await this.ensureInitialized();

    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    if (checkpoint.status !== 'pending') {
      throw new Error(`Checkpoint ${checkpointId} already resolved (${checkpoint.status})`);
    }

    const now = new Date().toISOString();
    const status = decision.approved ? 'approved' : 'rejected';

    // Update database
    const pool = getPool();
    await pool.query(
      `UPDATE human_checkpoints SET
        status = $1,
        decided_by = $2,
        decided_at = $3,
        decision_reason = $4,
        modifications = $5
      WHERE checkpoint_id = $6`,
      [
        status,
        decision.decidedBy,
        now,
        decision.reason || null,
        decision.modifications ? JSON.stringify(decision.modifications) : null,
        checkpointId,
      ]
    );

    // Remove from memory cache
    this.pendingCheckpoints.delete(checkpointId);

    // Notify resolution
    await this.notifyResolution(checkpoint, decision);

    if (decision.approved) {
      return {
        resumed: true,
        terminated: false,
        threadId: checkpoint.threadId,
        checkpointId,
      };
    } else {
      return {
        resumed: false,
        terminated: true,
        terminationReason: decision.reason || 'Checkpoint rejected',
        threadId: checkpoint.threadId,
        checkpointId,
      };
    }
  }

  /**
   * Get state for resuming after approval
   */
  async getResumeState(checkpointId: string): Promise<BastionState | null> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint || checkpoint.status !== 'approved') {
      return null;
    }

    // Apply modifications if any
    let resumeState = checkpoint.state;
    if (checkpoint.modifications) {
      resumeState = {
        ...resumeState,
        ...checkpoint.modifications,
        interrupt: null, // Clear interrupt
      };
    } else {
      resumeState = {
        ...resumeState,
        interrupt: null,
      };
    }

    return resumeState;
  }

  /**
   * Expire old checkpoints
   */
  async expireCheckpoints(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(`
      UPDATE human_checkpoints
      SET status = 'expired'
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    `);

    const expiredCount = result.rowCount || 0;

    // Remove from memory cache
    for (const [id, checkpoint] of this.pendingCheckpoints) {
      if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
        this.pendingCheckpoints.delete(id);
      }
    }

    return expiredCount;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Register default checkpoint triggers
   */
  private registerDefaultTriggers(): void {
    // Classification escalation
    this.triggers.set('classification_escalation', {
      type: CheckpointTriggerType.ClassificationEscalation,
      description: 'Classification level is about to escalate',
      condition: (state) => {
        // Check if next agent has lower clearance than current classification
        if (state.agentClearance && state.classification) {
          const clearanceLevel = CLASSIFICATION_ORDER[state.agentClearance];
          const classificationLevel = CLASSIFICATION_ORDER[state.classification];
          return classificationLevel > clearanceLevel;
        }
        return false;
      },
      priority: 10,
    });

    // High iteration count
    this.triggers.set('iteration_limit', {
      type: CheckpointTriggerType.IterationLimit,
      description: 'Approaching maximum iteration limit',
      condition: (state) => {
        const threshold = Math.floor(state.maxInvocations * 0.8);
        return state.invocationCount >= threshold;
      },
      priority: 5,
    });

    // Explicit interrupt requested in state
    this.triggers.set('explicit_request', {
      type: CheckpointTriggerType.ExplicitRequest,
      description: 'Explicit human review requested',
      condition: (state) => {
        return state.metadata?.requestHumanReview === true;
      },
      priority: 8,
    });
  }

  /**
   * Store checkpoint to database
   */
  private async storeCheckpoint(checkpoint: PendingCheckpoint): Promise<void> {
    // Store in memory
    this.pendingCheckpoints.set(checkpoint.checkpointId, checkpoint);

    // Store in database
    const pool = getPool();
    await pool.query(
      `INSERT INTO human_checkpoints (
        checkpoint_id, thread_id, trigger_type, trigger_description,
        state, classification, current_agent, next_agent,
        created_at, status, expires_at, priority, required_role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        checkpoint.checkpointId,
        checkpoint.threadId,
        checkpoint.trigger,
        checkpoint.triggerDescription,
        JSON.stringify(checkpoint.state),
        checkpoint.classification,
        checkpoint.currentAgent,
        checkpoint.nextAgent,
        checkpoint.createdAt,
        checkpoint.status,
        checkpoint.expiresAt || null,
        checkpoint.priority || 0,
        checkpoint.requiredRole || null,
      ]
    );
  }

  /**
   * Load pending checkpoints from database
   */
  private async loadPendingCheckpoints(): Promise<void> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM human_checkpoints WHERE status = 'pending'`
    );

    for (const row of result.rows) {
      const checkpoint = this.rowToCheckpoint(row);
      this.pendingCheckpoints.set(checkpoint.checkpointId, checkpoint);
    }

    console.log(`[HumanCheckpoints] Loaded ${this.pendingCheckpoints.size} pending checkpoints`);
  }

  /**
   * Notify about new checkpoint via message bus
   */
  private async notifyCheckpoint(checkpoint: PendingCheckpoint): Promise<void> {
    try {
      const bus = getMessageBus();
      await bus.ensureInitialized();

      await bus.publish({
        sourceDid: 'system:orchestration',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'system.human-checkpoints',
        messageType: 'checkpoint.required',
        payload: {
          checkpointId: checkpoint.checkpointId,
          trigger: checkpoint.trigger,
          triggerDescription: checkpoint.triggerDescription,
          classification: checkpoint.classification,
          currentAgent: checkpoint.currentAgent,
          threadId: checkpoint.threadId,
          createdAt: checkpoint.createdAt,
          priority: checkpoint.priority,
        },
        attributes: {
          classification: checkpoint.classification,
          releasability: [],
          dissemination: [],
          originator: 'system:orchestration',
          orcon: false,
        },
        priority: checkpoint.priority && checkpoint.priority >= 8 ? 'high' : 'normal',
      });

      console.log(`[HumanCheckpoints] Notified checkpoint ${checkpoint.checkpointId}`);
    } catch (error) {
      console.error('[HumanCheckpoints] Failed to notify checkpoint:', error);
    }
  }

  /**
   * Notify about checkpoint resolution
   */
  private async notifyResolution(
    checkpoint: PendingCheckpoint,
    decision: HumanDecision
  ): Promise<void> {
    try {
      const bus = getMessageBus();
      await bus.ensureInitialized();

      await bus.publish({
        sourceDid: 'system:orchestration',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'system.human-checkpoints',
        messageType: decision.approved ? 'checkpoint.approved' : 'checkpoint.rejected',
        payload: {
          checkpointId: checkpoint.checkpointId,
          threadId: checkpoint.threadId,
          decidedBy: decision.decidedBy,
          reason: decision.reason,
          approved: decision.approved,
        },
        attributes: {
          classification: checkpoint.classification,
          releasability: [],
          dissemination: [],
          originator: 'system:orchestration',
          orcon: false,
        },
        priority: 'normal',
      });
    } catch (error) {
      console.error('[HumanCheckpoints] Failed to notify resolution:', error);
    }
  }

  /**
   * Convert database row to checkpoint
   */
  private rowToCheckpoint(row: Record<string, unknown>): PendingCheckpoint {
    return {
      checkpointId: row.checkpoint_id as string,
      threadId: row.thread_id as string,
      trigger: row.trigger_type as CheckpointTriggerType,
      triggerDescription: row.trigger_description as string,
      state: row.state as BastionState,
      classification: row.classification as ClassificationLevel,
      currentAgent: row.current_agent as string | null,
      nextAgent: row.next_agent as string | null,
      createdAt: row.created_at as string,
      status: row.status as 'pending' | 'approved' | 'rejected' | 'expired',
      expiresAt: row.expires_at as string | undefined,
      decidedBy: row.decided_by as string | undefined,
      decidedAt: row.decided_at as string | undefined,
      decisionReason: row.decision_reason as string | undefined,
      modifications: row.modifications as Record<string, unknown> | undefined,
      priority: row.priority as number | undefined,
      requiredRole: row.required_role as string | undefined,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: HumanCheckpointManager | null = null;

/**
 * Get or create the checkpoint manager singleton
 */
export function getCheckpointManager(): HumanCheckpointManager {
  if (!managerInstance) {
    managerInstance = new HumanCheckpointManager();
  }
  return managerInstance;
}

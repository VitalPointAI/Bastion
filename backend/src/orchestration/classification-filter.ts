/**
 * Classification-Aware State Filter
 *
 * Implements ABAC enforcement between agents in multi-agent workflows.
 * Filters state (messages, data) before each agent invocation to ensure
 * classified information does not reach unauthorized agents.
 *
 * Key responsibilities:
 * - Filter messages based on classification level
 * - Audit all filtering decisions
 * - Integrate with existing ABAC enforcer
 * - Support content redaction for partial disclosure
 */

import { randomUUID } from 'crypto';
import type { BaseMessage } from '@langchain/core/messages';
import { getPool } from '../lib/database.js';
import { ABACEnforcer } from '../security/abac-enforcer.js';
import {
  type BastionState,
  type ClassificationLevel,
  type ExecutionTraceEntry,
  CLASSIFICATION_ORDER,
  isMessageAccessible,
} from './state.js';

/**
 * Filter decision record for audit
 */
export interface FilterDecision {
  /** Unique decision ID */
  decisionId: string;
  /** Timestamp of decision */
  timestamp: string;
  /** Thread ID for context */
  threadId: string;
  /** Target agent DID/ID */
  targetAgent: string;
  /** Target agent's clearance level */
  targetClearance: ClassificationLevel;
  /** Source content classification */
  sourceClassification: ClassificationLevel;
  /** Whether access was allowed */
  allowed: boolean;
  /** Number of items filtered */
  filteredCount: number;
  /** Reason for decision */
  reason: string;
}

/**
 * Audit entry for filtered content
 */
export interface FilterAuditEntry {
  /** Filter decision */
  decision: FilterDecision;
  /** IDs/hashes of filtered message content (not the content itself) */
  filteredItemIds: string[];
  /** Content classification levels that were filtered */
  filteredLevels: ClassificationLevel[];
}

/**
 * SQL for initializing filter audit tables
 */
const INIT_SQL = `
  -- Classification filter audit table
  CREATE TABLE IF NOT EXISTS classification_filter_audit (
    decision_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    thread_id TEXT NOT NULL,
    target_agent TEXT NOT NULL,
    target_clearance TEXT NOT NULL,
    source_classification TEXT NOT NULL,
    allowed BOOLEAN NOT NULL,
    filtered_count INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    filtered_item_ids JSONB NOT NULL DEFAULT '[]',
    filtered_levels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Indexes for querying filter audit
  CREATE INDEX IF NOT EXISTS idx_filter_audit_thread_id ON classification_filter_audit(thread_id);
  CREATE INDEX IF NOT EXISTS idx_filter_audit_target_agent ON classification_filter_audit(target_agent);
  CREATE INDEX IF NOT EXISTS idx_filter_audit_timestamp ON classification_filter_audit(timestamp);
  CREATE INDEX IF NOT EXISTS idx_filter_audit_allowed ON classification_filter_audit(allowed);
`;

/**
 * ClassificationFilter - Enforces ABAC between agents
 */
export class ClassificationFilter {
  private initialized = false;
  private enforcer: ABACEnforcer;

  constructor(enforcer?: ABACEnforcer) {
    this.enforcer = enforcer || new ABACEnforcer();
  }

  /**
   * Initialize the filter (creates audit table)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.enforcer.initialize();

    const pool = getPool();
    try {
      await pool.query(INIT_SQL);
      this.initialized = true;
      console.log('[ClassificationFilter] Initialized');
    } catch (error) {
      console.error('[ClassificationFilter] Failed to initialize:', error);
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
   * Filter state for a target agent based on clearance level
   *
   * @param state Current workflow state
   * @param targetAgentId Agent identifier
   * @param targetClearance Clearance level of target agent
   * @returns Filtered state with audit entry in trace
   */
  async filterState(
    state: BastionState,
    targetAgentId: string,
    targetClearance: ClassificationLevel
  ): Promise<BastionState> {
    await this.ensureInitialized();

    const targetLevel = CLASSIFICATION_ORDER[targetClearance];
    const _sourceLevel = CLASSIFICATION_ORDER[state.classification];

    // Track what gets filtered
    const filteredMessageIds: string[] = [];
    const filteredLevels: Set<ClassificationLevel> = new Set();

    // Filter messages to only those at or below target clearance
    const filteredMessages = state.messages.filter((msg) => {
      // Get classification from message metadata
      const msgClassification = this.getMessageClassification(msg);
      const msgLevel = CLASSIFICATION_ORDER[msgClassification];

      if (msgLevel > targetLevel) {
        // This message is above clearance - filter it
        const msgId = this.getMessageId(msg);
        filteredMessageIds.push(msgId);
        filteredLevels.add(msgClassification);
        return false;
      }

      return true;
    });

    // Determine if any filtering occurred
    const wasFiltered = filteredMessageIds.length > 0;
    const allowed = filteredMessages.length > 0 || state.messages.length === 0;

    // Create filter decision
    const decision: FilterDecision = {
      decisionId: randomUUID(),
      timestamp: new Date().toISOString(),
      threadId: state.threadId,
      targetAgent: targetAgentId,
      targetClearance,
      sourceClassification: state.classification,
      allowed,
      filteredCount: filteredMessageIds.length,
      reason: wasFiltered
        ? `Filtered ${filteredMessageIds.length} message(s) above ${targetClearance} clearance`
        : `All ${state.messages.length} message(s) accessible at ${targetClearance} clearance`,
    };

    // Audit the decision
    await this.auditFilterDecision(decision, filteredMessageIds, Array.from(filteredLevels));

    // Create trace entry
    const traceEntry: ExecutionTraceEntry = {
      spanId: randomUUID(),
      parentSpanId: state.executionTrace.length > 0
        ? state.executionTrace[state.executionTrace.length - 1].spanId
        : undefined,
      agentId: 'classification-filter',
      operation: 'filter-state',
      startedAt: decision.timestamp,
      completedAt: decision.timestamp,
      durationMs: 0,
      status: 'success',
      classification: state.classification,
      wasFiltered,
      filteredCount: filteredMessageIds.length,
    };

    // Return filtered state
    return {
      ...state,
      messages: filteredMessages,
      agentClearance: targetClearance,
      previousAgent: state.currentAgent,
      currentAgent: targetAgentId,
      executionTrace: [...state.executionTrace, traceEntry],
    };
  }

  /**
   * Check if an agent can receive the current state
   * Does not modify state, just checks access
   */
  async canAgentReceive(
    state: BastionState,
    targetAgentId: string,
    targetClearance: ClassificationLevel
  ): Promise<{ allowed: boolean; reason: string }> {
    const targetLevel = CLASSIFICATION_ORDER[targetClearance];
    const stateLevel = CLASSIFICATION_ORDER[state.classification];

    // Agent cannot receive state if any content is above their clearance
    // that cannot be filtered (e.g., the entire task is classified)
    if (stateLevel > targetLevel) {
      return {
        allowed: false,
        reason: `Task classification ${state.classification} exceeds agent clearance ${targetClearance}`,
      };
    }

    // Check if there are any messages at all that agent can see
    const accessibleMessages = state.messages.filter((msg) => {
      const msgClassification = this.getMessageClassification(msg);
      return isMessageAccessible(msgClassification, targetClearance);
    });

    if (state.messages.length > 0 && accessibleMessages.length === 0) {
      return {
        allowed: false,
        reason: `No messages accessible at ${targetClearance} clearance`,
      };
    }

    return {
      allowed: true,
      reason: `Agent ${targetAgentId} can receive state at ${targetClearance} clearance`,
    };
  }

  /**
   * Redact content instead of filtering entirely
   * Useful for partial disclosure scenarios
   *
   * @param msg Message to potentially redact
   * @param targetClearance Clearance level of target
   * @returns Original message if accessible, redacted message info otherwise
   */
  redactMessage(
    msg: BaseMessage,
    targetClearance: ClassificationLevel
  ): { message: BaseMessage; wasRedacted: boolean; redactedContent?: string } {
    const msgClassification = this.getMessageClassification(msg);
    const msgLevel = CLASSIFICATION_ORDER[msgClassification];
    const targetLevel = CLASSIFICATION_ORDER[targetClearance];

    if (msgLevel <= targetLevel) {
      return { message: msg, wasRedacted: false }; // No redaction needed
    }

    // Return original message with redaction info
    // The caller can decide how to handle the redaction
    const redactedContent = `[REDACTED - ${msgClassification} content not accessible at ${targetClearance} clearance]`;

    return {
      message: msg,
      wasRedacted: true,
      redactedContent,
    };
  }

  /**
   * Get classification from message metadata
   */
  private getMessageClassification(msg: BaseMessage): ClassificationLevel {
    // Check additional_kwargs for classification
    const classification = msg.additional_kwargs?.classification as string | undefined;

    if (classification && classification in CLASSIFICATION_ORDER) {
      return classification as ClassificationLevel;
    }

    // Default to UNCLASS if not specified
    return 'UNCLASS';
  }

  /**
   * Get a unique identifier for a message (for audit purposes)
   */
  private getMessageId(msg: BaseMessage): string {
    // Try to get ID from message
    const msgId = msg.id || msg.additional_kwargs?.id;
    if (msgId) {
      return String(msgId);
    }

    // Generate hash from content
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);

    // Simple hash for deduplication (not cryptographic)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `msg-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Audit a filter decision to database
   */
  private async auditFilterDecision(
    decision: FilterDecision,
    filteredItemIds: string[],
    filteredLevels: ClassificationLevel[]
  ): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(
        `INSERT INTO classification_filter_audit (
          decision_id, timestamp, thread_id, target_agent,
          target_clearance, source_classification, allowed,
          filtered_count, reason, filtered_item_ids, filtered_levels
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          decision.decisionId,
          decision.timestamp,
          decision.threadId,
          decision.targetAgent,
          decision.targetClearance,
          decision.sourceClassification,
          decision.allowed,
          decision.filteredCount,
          decision.reason,
          JSON.stringify(filteredItemIds),
          JSON.stringify(filteredLevels),
        ]
      );
    } catch (error) {
      // Log but don't fail the filter operation
      console.error('[ClassificationFilter] Failed to audit decision:', error);
    }
  }

  /**
   * Get filter audit history for a thread
   */
  async getAuditHistory(
    threadId: string,
    limit: number = 100
  ): Promise<FilterDecision[]> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT * FROM classification_filter_audit
         WHERE thread_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [threadId, limit]
      );

      return result.rows.map((row) => ({
        decisionId: row.decision_id,
        timestamp: row.timestamp,
        threadId: row.thread_id,
        targetAgent: row.target_agent,
        targetClearance: row.target_clearance as ClassificationLevel,
        sourceClassification: row.source_classification as ClassificationLevel,
        allowed: row.allowed,
        filteredCount: row.filtered_count,
        reason: row.reason,
      }));
    } catch (error) {
      console.error('[ClassificationFilter] Failed to get audit history:', error);
      throw error;
    }
  }

  /**
   * Get filter statistics for monitoring
   */
  async getFilterStats(
    since?: Date
  ): Promise<{
    totalDecisions: number;
    allowedDecisions: number;
    deniedDecisions: number;
    totalFiltered: number;
    byClassification: Record<string, number>;
  }> {
    await this.ensureInitialized();
    const pool = getPool();

    const sinceClause = since ? 'WHERE timestamp >= $1' : '';
    const params = since ? [since.toISOString()] : [];

    try {
      // Total counts
      const countResult = await pool.query(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN allowed THEN 1 ELSE 0 END) as allowed,
           SUM(CASE WHEN NOT allowed THEN 1 ELSE 0 END) as denied,
           SUM(filtered_count) as filtered
         FROM classification_filter_audit
         ${sinceClause}`,
        params
      );

      // By classification
      const byClassResult = await pool.query(
        `SELECT source_classification, COUNT(*) as count
         FROM classification_filter_audit
         ${sinceClause}
         GROUP BY source_classification`,
        params
      );

      const byClassification: Record<string, number> = {};
      for (const row of byClassResult.rows) {
        byClassification[row.source_classification] = parseInt(row.count, 10);
      }

      const row = countResult.rows[0];
      return {
        totalDecisions: parseInt(row.total, 10) || 0,
        allowedDecisions: parseInt(row.allowed, 10) || 0,
        deniedDecisions: parseInt(row.denied, 10) || 0,
        totalFiltered: parseInt(row.filtered, 10) || 0,
        byClassification,
      };
    } catch (error) {
      console.error('[ClassificationFilter] Failed to get stats:', error);
      throw error;
    }
  }
}

// ============================================================================
// LangGraph Node Factory
// ============================================================================

/**
 * Create a LangGraph node that filters state for a specific agent
 *
 * @param targetAgentId ID of the agent to filter for
 * @param targetClearance Clearance level of the target agent
 * @param filter Optional filter instance (uses singleton if not provided)
 * @returns LangGraph node function
 */
export function createClassificationFilterNode(
  targetAgentId: string,
  targetClearance: ClassificationLevel,
  filter?: ClassificationFilter
): (state: BastionState) => Promise<Partial<BastionState>> {
  const filterInstance = filter || getClassificationFilter();

  return async (state: BastionState): Promise<Partial<BastionState>> => {
    return filterInstance.filterState(state, targetAgentId, targetClearance);
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let filterInstance: ClassificationFilter | null = null;

/**
 * Get or create the classification filter singleton
 */
export function getClassificationFilter(): ClassificationFilter {
  if (!filterInstance) {
    filterInstance = new ClassificationFilter();
  }
  return filterInstance;
}

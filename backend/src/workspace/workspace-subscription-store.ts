/**
 * Workspace Subscription Store
 *
 * Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing
 *
 * Manages cross-workspace data-sharing subscriptions. A subscription records that
 * subscriber_problem_set_id has requested access to data published by publisher_problem_set_id.
 * Approval flows: manual (commander approves), auto (always approved), or agent (AI decides).
 *
 * Also creates problem_set_data_cache for caching referenced problem set data locally.
 *
 * Tables: problem_set_subscriptions, problem_set_data_cache
 * ID formats: WSUB-{uuid}, WDC-{uuid}
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initWorkspaceSubscriptionTables(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_subscriptions (
      id TEXT PRIMARY KEY,
      subscriber_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      publisher_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      data_types TEXT[] NOT NULL DEFAULT '{}',
      approval_status TEXT NOT NULL DEFAULT 'pending',
      approval_mechanism TEXT NOT NULL DEFAULT 'manual',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      requested_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(subscriber_problem_set_id, publisher_problem_set_id)
    );
    CREATE INDEX IF NOT EXISTS idx_psub_subscriber ON problem_set_subscriptions(subscriber_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_psub_publisher ON problem_set_subscriptions(publisher_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_psub_status ON problem_set_subscriptions(approval_status);

    CREATE TABLE IF NOT EXISTS problem_set_data_cache (
      id TEXT PRIMARY KEY,
      consumer_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      data_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      source_version TEXT,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notified_at TIMESTAMPTZ,
      UNIQUE(consumer_problem_set_id, source_problem_set_id, data_type)
    );
    CREATE INDEX IF NOT EXISTS idx_pdc_consumer ON problem_set_data_cache(consumer_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_pdc_source ON problem_set_data_cache(source_problem_set_id);
  `);
}

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceSubscription {
  id: string;
  subscriberWorkspaceId: string;
  publisherWorkspaceId: string;
  dataTypes: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalMechanism: 'manual' | 'auto' | 'agent';
  approvedBy: string | null;
  approvedAt: Date | null;
  requestedBy: string;
  createdAt: Date;
}

interface WorkspaceSubscriptionRow {
  id: string;
  subscriber_problem_set_id: string;
  publisher_problem_set_id: string;
  data_types: string[];
  approval_status: string;
  approval_mechanism: string;
  approved_by: string | null;
  approved_at: Date | null;
  requested_by: string;
  created_at: Date;
}

// ============================================================================
// Workspace Subscription Store
// ============================================================================

export class WorkspaceSubscriptionStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceSubscriptionTables();
      this.initialized = true;
    }
  }

  private mapRow(row: WorkspaceSubscriptionRow): WorkspaceSubscription {
    return {
      id: row.id,
      subscriberWorkspaceId: row.subscriber_problem_set_id,
      publisherWorkspaceId: row.publisher_problem_set_id,
      dataTypes: row.data_types,
      approvalStatus: row.approval_status as WorkspaceSubscription['approvalStatus'],
      approvalMechanism: row.approval_mechanism as WorkspaceSubscription['approvalMechanism'],
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      requestedBy: row.requested_by,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Create a new cross-workspace subscription request.
   * Starts in 'pending' status; use updateApprovalStatus to approve or reject.
   */
  async createSubscription(input: {
    subscriberWorkspaceId: string;
    publisherWorkspaceId: string;
    dataTypes: string[];
    approvalMechanism?: 'manual' | 'auto' | 'agent';
    requestedBy: string;
  }): Promise<WorkspaceSubscription> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `WSUB-${randomUUID()}`;
    const mechanism = input.approvalMechanism ?? 'manual';

    const result = await pool.query(
      `
      INSERT INTO problem_set_subscriptions (
        id, subscriber_problem_set_id, publisher_problem_set_id,
        data_types, approval_status, approval_mechanism, requested_by, created_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
      RETURNING *
      `,
      [
        id,
        input.subscriberWorkspaceId,
        input.publisherWorkspaceId,
        input.dataTypes,
        mechanism,
        input.requestedBy,
      ],
    );

    return this.mapRow(result.rows[0] as WorkspaceSubscriptionRow);
  }

  /**
   * Get a subscription by its ID.
   */
  async getSubscription(id: string): Promise<WorkspaceSubscription | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_subscriptions WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as WorkspaceSubscriptionRow);
  }

  /**
   * List all subscriptions where the given workspace is the subscriber (data consumer).
   */
  async listBySubscriber(subscriberWorkspaceId: string): Promise<WorkspaceSubscription[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_subscriptions WHERE subscriber_problem_set_id = $1 ORDER BY created_at DESC',
      [subscriberWorkspaceId],
    );

    return result.rows.map((row) => this.mapRow(row as WorkspaceSubscriptionRow));
  }

  /**
   * List all subscriptions where the given workspace is the publisher (data source).
   */
  async listByPublisher(publisherWorkspaceId: string): Promise<WorkspaceSubscription[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_subscriptions WHERE publisher_problem_set_id = $1 ORDER BY created_at DESC',
      [publisherWorkspaceId],
    );

    return result.rows.map((row) => this.mapRow(row as WorkspaceSubscriptionRow));
  }

  /**
   * Update the approval status of a subscription.
   * Call with 'approved' and approvedBy when a commander or agent approves.
   */
  async updateApprovalStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy: string,
  ): Promise<WorkspaceSubscription> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      UPDATE problem_set_subscriptions
      SET approval_status = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, approvedBy, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Subscription not found: ${id}`);
    }

    return this.mapRow(result.rows[0] as WorkspaceSubscriptionRow);
  }

  /**
   * Delete a subscription. No-op if subscription does not exist.
   */
  async deleteSubscription(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query('DELETE FROM problem_set_subscriptions WHERE id = $1', [id]);
  }
}

// Singleton export
export const workspaceSubscriptionStore = new WorkspaceSubscriptionStore();

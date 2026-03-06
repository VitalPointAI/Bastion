import { getPool } from '../../lib/database.js';
import { ROEOverride } from '../types.js';
import { TacticalAction, ROECheckResult, ROEOverrideRequest } from './types.js';

interface ROECheckEvent {
  action: TacticalAction;
  result: ROECheckResult;
  timestamp: Date;
}

interface ROEOverrideEvent {
  overrides: ROEOverride[];
  request: ROEOverrideRequest;
  timestamp: Date;
}

class ROEAuditLog {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roe_audit_log (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        action_id TEXT,
        event_data JSONB NOT NULL,
        blockchain_tx_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_roe_audit_plan ON roe_audit_log(plan_id);
      CREATE INDEX IF NOT EXISTS idx_roe_audit_mission ON roe_audit_log(mission_id);
      CREATE INDEX IF NOT EXISTS idx_roe_audit_action ON roe_audit_log(action_id);
    `);

    this.initialized = true;
  }

  /**
   * Record ROE check in audit log
   */
  async recordCheck(event: ROECheckEvent): Promise<string> {
    await this.ensureInitialized();

    const pool = getPool();
    const id = `ROE-CHK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(`
      INSERT INTO roe_audit_log (id, event_type, plan_id, mission_id, action_id, event_data, created_at)
      VALUES ($1, 'check', $2, $3, $4, $5, $6)
    `, [
      id,
      event.action.planId,
      event.action.missionId,
      event.action.id,
      {
        action: event.action,
        result: event.result,
      },
      event.timestamp,
    ]);

    // In production, this would record to NEAR blockchain
    // For now, we generate a placeholder hash
    const txHash = `near:${id}`;

    await pool.query(
      'UPDATE roe_audit_log SET blockchain_tx_hash = $1 WHERE id = $2',
      [txHash, id]
    );

    return txHash;
  }

  /**
   * Record ROE override in audit log with blockchain
   */
  async recordOverride(event: ROEOverrideEvent): Promise<string> {
    await this.ensureInitialized();

    const pool = getPool();
    const id = `ROE-OVR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(`
      INSERT INTO roe_audit_log (id, event_type, plan_id, mission_id, action_id, event_data, created_at)
      VALUES ($1, 'override', $2, $3, $4, $5, $6)
    `, [
      id,
      event.request.planId,
      event.overrides[0]?.actionContext?.missionId || '',
      event.request.actionId,
      {
        overrides: event.overrides,
        request: {
          actionId: event.request.actionId,
          planId: event.request.planId,
          justification: event.request.justification,
          commanderDID: event.request.commanderDID,
          violationCount: event.request.violations.length,
        },
      },
      event.timestamp,
    ]);

    // Record to NEAR blockchain for immutability
    // This is critical - ROE overrides must be tamper-proof
    const txHash = await this.recordToBlockchain({
      type: 'roe_override',
      id,
      planId: event.request.planId,
      actionId: event.request.actionId,
      commanderDID: event.request.commanderDID,
      justification: event.request.justification,
      violationCount: event.request.violations.length,
      timestamp: event.timestamp.toISOString(),
    });

    await pool.query(
      'UPDATE roe_audit_log SET blockchain_tx_hash = $1 WHERE id = $2',
      [txHash, id]
    );

    return txHash;
  }

  /**
   * Record to NEAR blockchain
   * In production, this would use the actual NEAR contract
   */
  private async recordToBlockchain(data: Record<string, unknown>): Promise<string> {
    // TODO: Implement actual NEAR contract call
    // For now, return placeholder hash
    // This would use near-api-js to call the audit contract

    // Placeholder implementation:
    const hash = `near:roe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[ROE Audit] Would record to blockchain:', data);

    return hash;
  }

  /**
   * Get audit history for a plan
   */
  async getAuditHistory(planId: string): Promise<Record<string, unknown>[]> {
    await this.ensureInitialized();

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM roe_audit_log WHERE plan_id = $1 ORDER BY created_at DESC',
      [planId]
    );

    return result.rows;
  }

  /**
   * Verify blockchain record exists
   */
  async verifyBlockchainRecord(txHash: string): Promise<boolean> {
    // TODO: Implement actual NEAR verification
    // Would query NEAR RPC to verify transaction exists
    return txHash.startsWith('near:');
  }
}

export const roeAuditLog = new ROEAuditLog();

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('edge-local.db');

// Initialize local database
db.exec(`
  CREATE TABLE IF NOT EXISTS local_operations (
    operation_id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    synced INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export interface Operation {
  operation_id: string;
  operation_type: string;
  payload: object;
}

/**
 * Queue operation for sync when offline
 */
export function queueOperation(type: string, payload: object): string {
  const operationId = randomUUID();
  db.prepare(`
    INSERT INTO local_operations (operation_id, operation_type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(operationId, type, JSON.stringify(payload), Date.now());
  return operationId;
}

/**
 * Get all unsynced operations
 */
export function getSyncQueue(): Operation[] {
  const rows = db.prepare(`
    SELECT * FROM local_operations
    WHERE synced = 0
    ORDER BY created_at ASC
  `).all() as any[];

  return rows.map(row => ({
    operation_id: row.operation_id,
    operation_type: row.operation_type,
    payload: JSON.parse(row.payload)
  }));
}

/**
 * Mark operation as synced
 */
export function markSynced(operationId: string): void {
  db.prepare(`
    UPDATE local_operations
    SET synced = 1
    WHERE operation_id = ?
  `).run(operationId);
}

/**
 * Clear old synced operations (retention)
 */
export function clearSyncedOperations(olderThanMs: number): void {
  const cutoff = Date.now() - olderThanMs;
  db.prepare(`
    DELETE FROM local_operations
    WHERE synced = 1 AND created_at < ?
  `).run(cutoff);
}

export { db };

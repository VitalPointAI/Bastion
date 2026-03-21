/**
 * Configuration Store
 * PostgreSQL persistence for system configuration with encryption and audit trail
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import { encryptData, decryptData } from '../../lib/encryption.js';
import type { ConfigAuditEntry } from './types.js';

// Encryption key for config values (should be set via env var in production)
const CONFIG_ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || '';

/**
 * Initialize system_config and config_audit tables
 */
export async function initConfigTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      value JSONB NOT NULL,
      encrypted BOOLEAN NOT NULL DEFAULT FALSE,
      encryption_nonce TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

    CREATE TABLE IF NOT EXISTS config_audit (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      previous_value JSONB,
      new_value JSONB NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_config_audit_category ON config_audit(category);
    CREATE INDEX IF NOT EXISTS idx_config_audit_changed_at ON config_audit(changed_at);
    CREATE INDEX IF NOT EXISTS idx_config_audit_key ON config_audit(key);
  `);
}

/**
 * Check if a config key should be encrypted
 */
function shouldEncrypt(key: string): boolean {
  const sensitivePatterns = ['apiKey', 'apikey', 'secret', 'password', 'token', 'webhook'];
  return sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()));
}

/**
 * Encrypt sensitive fields in a config object
 */
async function encryptSensitiveFields(
  value: unknown,
  encryptionKey: string
): Promise<{ value: unknown; nonce?: string }> {
  if (!encryptionKey) {
    console.warn('CONFIG_ENCRYPTION_KEY not set, storing sensitive data unencrypted');
    return { value };
  }

  if (typeof value !== 'object' || value === null) {
    return { value };
  }

  // Encode each sensitive field as "nonce:ciphertext" so each field carries
  // its own nonce. The config-level nonce column stores a sentinel value
  // indicating per-field nonces are in use.
  const encrypted = { ...value as Record<string, unknown> };

  for (const [key, val] of Object.entries(encrypted)) {
    if (shouldEncrypt(key) && typeof val === 'string' && val.length > 0) {
      const result = await encryptData(val, encryptionKey);
      // Store as "nonce:ciphertext" so decryption can extract the per-field nonce
      encrypted[key] = `${result.nonce}:${result.encrypted}`;
    } else if (typeof val === 'object' && val !== null) {
      const nested = await encryptSensitiveFields(val, encryptionKey);
      encrypted[key] = nested.value;
    }
  }

  // Sentinel nonce indicating per-field nonces are embedded in each value
  return { value: encrypted, nonce: 'per-field' };
}

/**
 * Decrypt sensitive fields in a config object
 */
async function decryptSensitiveFields(
  value: unknown,
  encryptionKey: string,
  nonce?: string
): Promise<unknown> {
  if (!encryptionKey || !nonce) {
    return value;
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const decrypted = { ...value as Record<string, unknown> };
  const isPerField = nonce === 'per-field';

  for (const [key, val] of Object.entries(decrypted)) {
    if (shouldEncrypt(key) && typeof val === 'string' && val.length > 0) {
      try {
        if (isPerField && val.includes(':')) {
          // Per-field nonce format: "nonce:ciphertext"
          const colonIdx = val.indexOf(':');
          const fieldNonce = val.slice(0, colonIdx);
          const fieldCiphertext = val.slice(colonIdx + 1);
          const result = await decryptData(fieldCiphertext, encryptionKey, fieldNonce);
          decrypted[key] = result.toString('utf-8');
        } else {
          // Legacy: single shared nonce for all fields
          const result = await decryptData(val, encryptionKey, nonce);
          decrypted[key] = result.toString('utf-8');
        }
      } catch {
        // Value might not be encrypted, keep original
        decrypted[key] = val;
      }
    } else if (typeof val === 'object' && val !== null) {
      decrypted[key] = await decryptSensitiveFields(val, encryptionKey, nonce);
    }
  }

  return decrypted;
}

/**
 * Configuration Store Class
 * CRUD operations for system configuration with encryption and audit
 */
export class ConfigStore {
  private initialized = false;

  /**
   * Ensure tables exist before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initConfigTables();
      this.initialized = true;
    }
  }

  /**
   * Get a configuration value by key
   */
  async getConfig<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT value, encrypted, encryption_nonce FROM system_config WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    let value = row.value;

    if (row.encrypted && row.encryption_nonce && CONFIG_ENCRYPTION_KEY) {
      value = await decryptSensitiveFields(value, CONFIG_ENCRYPTION_KEY, row.encryption_nonce);
    }

    return value as T;
  }

  /**
   * Set a configuration value
   * Records an audit entry before update
   */
  async setConfig<T>(
    key: string,
    category: string,
    value: T,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current value for audit
      const currentResult = await client.query(
        'SELECT value FROM system_config WHERE key = $1',
        [key]
      );
      const previousValue = currentResult.rows.length > 0 ? currentResult.rows[0].value : null;

      // Check if encryption is needed
      const needsEncryption = typeof value === 'object' && value !== null;
      let storedValue: unknown = value;
      let nonce: string | undefined;
      let encrypted = false;

      if (needsEncryption && CONFIG_ENCRYPTION_KEY) {
        const encryptResult = await encryptSensitiveFields(value, CONFIG_ENCRYPTION_KEY);
        storedValue = encryptResult.value;
        nonce = encryptResult.nonce;
        encrypted = !!nonce;
      }

      // Record audit entry
      const auditId = `AUD-${randomUUID().slice(0, 8)}`;
      await client.query(`
        INSERT INTO config_audit (id, category, key, previous_value, new_value, changed_by, changed_at, reason)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [
        auditId,
        category,
        key,
        previousValue ? JSON.stringify(previousValue) : null,
        JSON.stringify(value), // Store unencrypted value in audit for readability
        changedBy,
        reason || null,
      ]);

      // Upsert configuration
      await client.query(`
        INSERT INTO system_config (key, category, value, encrypted, encryption_nonce, updated_at, updated_by)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        ON CONFLICT (key) DO UPDATE SET
          category = EXCLUDED.category,
          value = EXCLUDED.value,
          encrypted = EXCLUDED.encrypted,
          encryption_nonce = EXCLUDED.encryption_nonce,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `, [key, category, JSON.stringify(storedValue), encrypted, nonce || null, changedBy]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all configurations, optionally filtered by category
   */
  async getAllConfigs(category?: string): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT key, value, encrypted, encryption_nonce FROM system_config';
    const params: string[] = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    const result = await pool.query(query, params);
    const configs: Record<string, unknown> = {};

    for (const row of result.rows) {
      let value = row.value;
      if (row.encrypted && row.encryption_nonce && CONFIG_ENCRYPTION_KEY) {
        value = await decryptSensitiveFields(value, CONFIG_ENCRYPTION_KEY, row.encryption_nonce);
      }
      configs[row.key] = value;
    }

    return configs;
  }

  /**
   * Get audit history for configuration changes
   */
  async getAuditHistory(options?: {
    key?: string;
    category?: string;
    limit?: number;
    since?: Date;
  }): Promise<ConfigAuditEntry[]> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT * FROM config_audit WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.key) {
      query += ` AND key = $${paramIndex++}`;
      params.push(options.key);
    }

    if (options?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }

    if (options?.since) {
      query += ` AND changed_at >= $${paramIndex++}`;
      params.push(options.since);
    }

    query += ' ORDER BY changed_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id as string,
      category: row.category as string,
      key: row.key as string,
      previousValue: row.previous_value,
      newValue: row.new_value,
      changedBy: row.changed_by as string,
      changedAt: new Date(row.changed_at as string),
      reason: row.reason as string | undefined,
    }));
  }

  /**
   * Delete a configuration key
   */
  async deleteConfig(key: string, deletedBy: string, reason?: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current value for audit
      const currentResult = await client.query(
        'SELECT value, category FROM system_config WHERE key = $1',
        [key]
      );

      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const row = currentResult.rows[0];

      // Record audit entry for deletion
      const auditId = `AUD-${randomUUID().slice(0, 8)}`;
      await client.query(`
        INSERT INTO config_audit (id, category, key, previous_value, new_value, changed_by, changed_at, reason)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [
        auditId,
        row.category,
        key,
        JSON.stringify(row.value),
        JSON.stringify(null),
        deletedBy,
        reason || 'Configuration deleted',
      ]);

      // Delete configuration
      const deleteResult = await client.query(
        'DELETE FROM system_config WHERE key = $1',
        [key]
      );

      await client.query('COMMIT');
      return (deleteResult.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const configStore = new ConfigStore();

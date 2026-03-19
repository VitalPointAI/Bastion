/**
 * Discovery PostgreSQL Store
 *
 * Phase 32 Plan 01: CRUD operations for discovered_devices, device_access_list,
 * and device_behavioral_baselines tables.
 *
 * Follows resource-store.ts and gate-store.ts patterns:
 * - getPool() for database connection
 * - ensureDiscoveryTables() for auto-creation on first use
 * - Singleton export as discoveryStore
 * - gen_random_uuid() for ID generation
 */

import { getPool } from '../lib/database.js';
import type {
  DiscoveredDevice,
  DeviceAccessEntry,
  DeviceBehavioralBaseline,
  DeviceState,
  AccessListType,
  MatchType,
  DeviceFingerprint,
  ScanTarget,
  DiscoveryOrigin,
} from './types.js';

// ---------------------------------------------------------------------------
// Table initialization
// ---------------------------------------------------------------------------

let tablesInitialized = false;

async function ensureDiscoveryTables(): Promise<void> {
  if (tablesInitialized) return;

  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discovered_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transport_type TEXT NOT NULL,
      raw_identifier TEXT NOT NULL,
      fingerprint JSONB,
      state TEXT NOT NULL DEFAULT 'discovered',
      device_did TEXT,
      resource_id TEXT,
      first_seen TIMESTAMPTZ NOT NULL,
      last_seen TIMESTAMPTZ NOT NULL,
      signal_strength INTEGER,
      location JSONB,
      ironclaw_analysis JSONB,
      gate_id TEXT,
      quarantine_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_discovered_state
      ON discovered_devices(state);
    CREATE INDEX IF NOT EXISTS idx_discovered_transport
      ON discovered_devices(transport_type);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_access_list (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_type TEXT NOT NULL CHECK (list_type IN ('allow', 'block')),
      scope TEXT NOT NULL DEFAULT 'global',
      match_type TEXT NOT NULL CHECK (match_type IN ('mac', 'vendor_id', 'product_id', 'cot_type', 'fingerprint_hash')),
      match_value TEXT NOT NULL,
      display_name TEXT,
      added_by TEXT NOT NULL,
      gate_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      UNIQUE(list_type, scope, match_type, match_value)
    );

    CREATE INDEX IF NOT EXISTS idx_device_access_scope
      ON device_access_list(scope, list_type);
  `);

  // Add origin columns to discovered_devices if missing
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE discovered_devices ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'server';
      ALTER TABLE discovered_devices ADD COLUMN IF NOT EXISTS source_target_id UUID;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      address TEXT NOT NULL,
      port_range TEXT,
      protocol TEXT NOT NULL DEFAULT 'tcp' CHECK (protocol IN ('tcp', 'udp', 'icmp')),
      label TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      legal_consent_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_did TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      target_id UUID,
      legal_text_hash TEXT NOT NULL,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      ip_address TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_consent_user_type
      ON consent_records(user_did, consent_type);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_behavioral_baselines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_did TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      baseline_mean DOUBLE PRECISION,
      baseline_stddev DOUBLE PRECISION,
      sample_count INTEGER DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(device_did, metric_type)
    );
  `);

  tablesInitialized = true;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToDevice(row: Record<string, unknown>): DiscoveredDevice {
  return {
    id: row.id as string,
    transportType: row.transport_type as DiscoveredDevice['transportType'],
    rawIdentifier: row.raw_identifier as string,
    fingerprint: (row.fingerprint as DeviceFingerprint) ?? null,
    state: row.state as DeviceState,
    deviceDid: (row.device_did as string) ?? undefined,
    resourceId: (row.resource_id as string) ?? undefined,
    firstSeen: new Date(row.first_seen as string),
    lastSeen: new Date(row.last_seen as string),
    signalStrength: (row.signal_strength as number) ?? undefined,
    location: (row.location as { lat: number; lng: number }) ?? undefined,
    ironclawAnalysis: (row.ironclaw_analysis as Record<string, unknown>) ?? undefined,
    gateId: (row.gate_id as string) ?? undefined,
    quarantineReason: (row.quarantine_reason as string) ?? undefined,
    origin: (row.origin as DiscoveryOrigin) ?? undefined,
    sourceTargetId: (row.source_target_id as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToScanTarget(row: Record<string, unknown>): ScanTarget {
  return {
    id: row.id as string,
    address: row.address as string,
    portRange: (row.port_range as string) ?? undefined,
    protocol: row.protocol as ScanTarget['protocol'],
    label: row.label as string,
    enabled: row.enabled as boolean,
    legalConsentAt: row.legal_consent_at ? new Date(row.legal_consent_at as string) : undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToAccessEntry(row: Record<string, unknown>): DeviceAccessEntry {
  return {
    id: row.id as string,
    listType: row.list_type as DeviceAccessEntry['listType'],
    scope: row.scope as string,
    matchType: row.match_type as DeviceAccessEntry['matchType'],
    matchValue: row.match_value as string,
    displayName: (row.display_name as string) ?? undefined,
    addedBy: row.added_by as string,
    gateId: (row.gate_id as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
  };
}

function rowToBaseline(row: Record<string, unknown>): DeviceBehavioralBaseline {
  return {
    id: row.id as string,
    deviceDid: row.device_did as string,
    metricType: row.metric_type as string,
    baselineMean: row.baseline_mean as number,
    baselineStddev: row.baseline_stddev as number,
    sampleCount: row.sample_count as number,
    lastUpdated: new Date(row.last_updated as string),
  };
}

// ---------------------------------------------------------------------------
// Discovered Devices CRUD
// ---------------------------------------------------------------------------

async function insertDiscoveredDevice(
  device: Omit<DiscoveredDevice, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DiscoveredDevice> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO discovered_devices (
      transport_type, raw_identifier, fingerprint, state,
      device_did, resource_id, first_seen, last_seen,
      signal_strength, location, ironclaw_analysis,
      gate_id, quarantine_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      device.transportType,
      device.rawIdentifier,
      device.fingerprint ? JSON.stringify(device.fingerprint) : null,
      device.state,
      device.deviceDid ?? null,
      device.resourceId ?? null,
      device.firstSeen,
      device.lastSeen,
      device.signalStrength ?? null,
      device.location ? JSON.stringify(device.location) : null,
      device.ironclawAnalysis ? JSON.stringify(device.ironclawAnalysis) : null,
      device.gateId ?? null,
      device.quarantineReason ?? null,
    ],
  );

  return rowToDevice(result.rows[0]);
}

async function updateDeviceState(
  id: string,
  state: DeviceState,
  extra?: Partial<DiscoveredDevice>,
): Promise<DiscoveredDevice | null> {
  await ensureDiscoveryTables();
  const pool = getPool();

  // Build dynamic SET clause for extra fields
  const setClauses = ['state = $2', 'updated_at = NOW()'];
  const params: unknown[] = [id, state];
  let paramIdx = 3;

  if (extra?.fingerprint !== undefined) {
    setClauses.push(`fingerprint = $${paramIdx}`);
    params.push(extra.fingerprint ? JSON.stringify(extra.fingerprint) : null);
    paramIdx++;
  }
  if (extra?.deviceDid !== undefined) {
    setClauses.push(`device_did = $${paramIdx}`);
    params.push(extra.deviceDid);
    paramIdx++;
  }
  if (extra?.resourceId !== undefined) {
    setClauses.push(`resource_id = $${paramIdx}`);
    params.push(extra.resourceId);
    paramIdx++;
  }
  if (extra?.lastSeen !== undefined) {
    setClauses.push(`last_seen = $${paramIdx}`);
    params.push(extra.lastSeen);
    paramIdx++;
  }
  if (extra?.signalStrength !== undefined) {
    setClauses.push(`signal_strength = $${paramIdx}`);
    params.push(extra.signalStrength);
    paramIdx++;
  }
  if (extra?.location !== undefined) {
    setClauses.push(`location = $${paramIdx}`);
    params.push(extra.location ? JSON.stringify(extra.location) : null);
    paramIdx++;
  }
  if (extra?.ironclawAnalysis !== undefined) {
    setClauses.push(`ironclaw_analysis = $${paramIdx}`);
    params.push(extra.ironclawAnalysis ? JSON.stringify(extra.ironclawAnalysis) : null);
    paramIdx++;
  }
  if (extra?.gateId !== undefined) {
    setClauses.push(`gate_id = $${paramIdx}`);
    params.push(extra.gateId);
    paramIdx++;
  }
  if (extra?.quarantineReason !== undefined) {
    setClauses.push(`quarantine_reason = $${paramIdx}`);
    params.push(extra.quarantineReason);
  }

  const result = await pool.query(
    `UPDATE discovered_devices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );

  return result.rows.length > 0 ? rowToDevice(result.rows[0]) : null;
}

async function getDeviceByRawId(
  transportType: string,
  rawIdentifier: string,
): Promise<DiscoveredDevice | null> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM discovered_devices
     WHERE transport_type = $1 AND raw_identifier = $2
     ORDER BY last_seen DESC LIMIT 1`,
    [transportType, rawIdentifier],
  );

  return result.rows.length > 0 ? rowToDevice(result.rows[0]) : null;
}

async function listDevicesByState(state: DeviceState): Promise<DiscoveredDevice[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM discovered_devices WHERE state = $1 ORDER BY last_seen DESC`,
    [state],
  );

  return result.rows.map(rowToDevice);
}

async function listDevicesByTransport(transportType: string): Promise<DiscoveredDevice[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM discovered_devices WHERE transport_type = $1 ORDER BY last_seen DESC`,
    [transportType],
  );

  return result.rows.map(rowToDevice);
}

// ---------------------------------------------------------------------------
// Access List CRUD
// ---------------------------------------------------------------------------

async function getAccessList(
  scope: string,
  listType: AccessListType,
): Promise<DeviceAccessEntry[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM device_access_list
     WHERE scope = $1 AND list_type = $2
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`,
    [scope, listType],
  );

  return result.rows.map(rowToAccessEntry);
}

/**
 * Get effective access list for a problem set scope.
 *
 * Merges global + PS-specific entries:
 * - Blocklist: union (PS cannot remove global blocks)
 * - Allowlist: union (PS supplements global)
 */
async function getEffectiveAccessList(
  problemSetId: string,
  listType: AccessListType,
): Promise<DeviceAccessEntry[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM device_access_list
     WHERE list_type = $1
       AND (scope = 'global' OR scope = $2)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY scope ASC, created_at DESC`,
    [listType, problemSetId],
  );

  // Deduplicate: if same match_type+match_value exists in both global and PS,
  // PS-specific entry takes precedence for display but both are effective
  const seen = new Map<string, DeviceAccessEntry>();
  for (const row of result.rows) {
    const entry = rowToAccessEntry(row);
    const key = `${entry.matchType}:${entry.matchValue}`;
    // PS-specific entries override global for dedup purposes
    if (!seen.has(key) || entry.scope !== 'global') {
      seen.set(key, entry);
    }
  }

  return Array.from(seen.values());
}

async function addAccessEntry(
  entry: Omit<DeviceAccessEntry, 'id' | 'createdAt'>,
): Promise<DeviceAccessEntry> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO device_access_list (
      list_type, scope, match_type, match_value,
      display_name, added_by, gate_id, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (list_type, scope, match_type, match_value)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      added_by = EXCLUDED.added_by,
      gate_id = EXCLUDED.gate_id,
      expires_at = EXCLUDED.expires_at
    RETURNING *`,
    [
      entry.listType,
      entry.scope,
      entry.matchType,
      entry.matchValue,
      entry.displayName ?? null,
      entry.addedBy,
      entry.gateId ?? null,
      entry.expiresAt ?? null,
    ],
  );

  return rowToAccessEntry(result.rows[0]);
}

async function removeAccessEntry(id: string): Promise<boolean> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM device_access_list WHERE id = $1`,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Check access list for a given match against effective scope.
 * Returns whether the match is allowed, blocked, or neither.
 */
async function checkAccessList(
  matchType: MatchType,
  matchValue: string,
  scope: string,
): Promise<{ allowed: boolean; blocked: boolean; entry?: DeviceAccessEntry }> {
  await ensureDiscoveryTables();
  const pool = getPool();

  // Check blocklist first (blocklist takes precedence)
  const blockResult = await pool.query(
    `SELECT * FROM device_access_list
     WHERE list_type = 'block'
       AND match_type = $1
       AND match_value = $2
       AND (scope = 'global' OR scope = $3)
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [matchType, matchValue, scope],
  );

  if (blockResult.rows.length > 0) {
    return {
      allowed: false,
      blocked: true,
      entry: rowToAccessEntry(blockResult.rows[0]),
    };
  }

  // Check allowlist
  const allowResult = await pool.query(
    `SELECT * FROM device_access_list
     WHERE list_type = 'allow'
       AND match_type = $1
       AND match_value = $2
       AND (scope = 'global' OR scope = $3)
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [matchType, matchValue, scope],
  );

  if (allowResult.rows.length > 0) {
    return {
      allowed: true,
      blocked: false,
      entry: rowToAccessEntry(allowResult.rows[0]),
    };
  }

  // Not on either list
  return { allowed: false, blocked: false };
}

// ---------------------------------------------------------------------------
// Behavioral Baselines CRUD
// ---------------------------------------------------------------------------

async function upsertBaseline(
  deviceDid: string,
  metricType: string,
  mean: number,
  stddev: number,
  sampleCount: number,
): Promise<void> {
  await ensureDiscoveryTables();
  const pool = getPool();

  await pool.query(
    `INSERT INTO device_behavioral_baselines (
      device_did, metric_type, baseline_mean, baseline_stddev, sample_count, last_updated
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (device_did, metric_type)
    DO UPDATE SET
      baseline_mean = $3,
      baseline_stddev = $4,
      sample_count = $5,
      last_updated = NOW()`,
    [deviceDid, metricType, mean, stddev, sampleCount],
  );
}

async function getBaselines(deviceDid: string): Promise<DeviceBehavioralBaseline[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM device_behavioral_baselines WHERE device_did = $1 ORDER BY metric_type`,
    [deviceDid],
  );

  return result.rows.map(rowToBaseline);
}

// ---------------------------------------------------------------------------
// Scan Targets CRUD
// ---------------------------------------------------------------------------

async function addScanTarget(
  target: Omit<ScanTarget, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ScanTarget> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO scan_targets (address, port_range, protocol, label, enabled, legal_consent_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      target.address,
      target.portRange ?? null,
      target.protocol,
      target.label,
      target.enabled,
      target.legalConsentAt ?? null,
      target.createdBy,
    ],
  );

  return rowToScanTarget(result.rows[0]);
}

async function listScanTargets(): Promise<ScanTarget[]> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM scan_targets ORDER BY created_at DESC`,
  );

  return result.rows.map(rowToScanTarget);
}

async function updateScanTarget(
  id: string,
  updates: Partial<Omit<ScanTarget, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<ScanTarget | null> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const setClauses = ['updated_at = NOW()'];
  const params: unknown[] = [id];
  let paramIdx = 2;

  if (updates.address !== undefined) {
    setClauses.push(`address = $${paramIdx++}`);
    params.push(updates.address);
  }
  if (updates.portRange !== undefined) {
    setClauses.push(`port_range = $${paramIdx++}`);
    params.push(updates.portRange);
  }
  if (updates.protocol !== undefined) {
    setClauses.push(`protocol = $${paramIdx++}`);
    params.push(updates.protocol);
  }
  if (updates.label !== undefined) {
    setClauses.push(`label = $${paramIdx++}`);
    params.push(updates.label);
  }
  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = $${paramIdx++}`);
    params.push(updates.enabled);
  }
  if (updates.legalConsentAt !== undefined) {
    setClauses.push(`legal_consent_at = $${paramIdx}`);
    params.push(updates.legalConsentAt);
  }

  const result = await pool.query(
    `UPDATE scan_targets SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );

  return result.rows.length > 0 ? rowToScanTarget(result.rows[0]) : null;
}

async function removeScanTarget(id: string): Promise<boolean> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM scan_targets WHERE id = $1`,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Consent Records CRUD
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  id: string;
  userDid: string;
  consentType: string;
  targetId?: string;
  legalTextHash: string;
  acceptedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
}

function rowToConsentRecord(row: Record<string, unknown>): ConsentRecord {
  return {
    id: row.id as string,
    userDid: row.user_did as string,
    consentType: row.consent_type as string,
    targetId: (row.target_id as string) ?? undefined,
    legalTextHash: row.legal_text_hash as string,
    acceptedAt: new Date(row.accepted_at as string),
    expiresAt: new Date(row.expires_at as string),
    ipAddress: (row.ip_address as string) ?? undefined,
  };
}

async function recordConsent(
  record: Omit<ConsentRecord, 'id'>,
): Promise<ConsentRecord> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO consent_records (user_did, consent_type, target_id, legal_text_hash, accepted_at, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      record.userDid,
      record.consentType,
      record.targetId ?? null,
      record.legalTextHash,
      record.acceptedAt,
      record.expiresAt,
      record.ipAddress ?? null,
    ],
  );

  return rowToConsentRecord(result.rows[0]);
}

async function getValidConsent(
  userDid: string,
  consentType: string,
  targetId?: string,
): Promise<ConsentRecord | null> {
  await ensureDiscoveryTables();
  const pool = getPool();

  const query = targetId
    ? `SELECT * FROM consent_records
       WHERE user_did = $1 AND consent_type = $2 AND target_id = $3
         AND expires_at > NOW()
       ORDER BY accepted_at DESC LIMIT 1`
    : `SELECT * FROM consent_records
       WHERE user_did = $1 AND consent_type = $2 AND target_id IS NULL
         AND expires_at > NOW()
       ORDER BY accepted_at DESC LIMIT 1`;

  const params = targetId ? [userDid, consentType, targetId] : [userDid, consentType];
  const result = await pool.query(query, params);

  return result.rows.length > 0 ? rowToConsentRecord(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const discoveryStore = {
  ensureDiscoveryTables,
  insertDiscoveredDevice,
  updateDeviceState,
  getDeviceByRawId,
  listDevicesByState,
  listDevicesByTransport,
  getAccessList,
  getEffectiveAccessList,
  addAccessEntry,
  removeAccessEntry,
  checkAccessList,
  upsertBaseline,
  getBaselines,
  addScanTarget,
  listScanTargets,
  updateScanTarget,
  removeScanTarget,
  recordConsent,
  getValidConsent,
};

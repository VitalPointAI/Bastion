/**
 * DID VC Claim Middleware for MCP Tool Authorization
 *
 * Phase 60 Plan 02: Implements DID-based Verifiable Credential claim resolution
 * and tool gating for Bastion MCP tools.
 *
 * TODO: Replace with NEAR blockchain DID document resolution when VC
 * infrastructure is live. Currently stubs claims from the AgentConfig table
 * (to be created in 60-03).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VCClaim {
  type: string;
  value: string;
  issuer: string;
  issuedAt: Date;
}

export type ClearanceLevel = 'UNCLASSIFIED' | 'CUI' | 'SECRET' | 'TOP_SECRET';

export type StaffSection =
  | 'Commander'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S6'
  | 'S9'
  | 'XO'
  | 'CSM'
  | 'Other';

// ---------------------------------------------------------------------------
// Clearance hierarchy
// ---------------------------------------------------------------------------

const CLEARANCE_LEVELS: Record<ClearanceLevel, number> = {
  UNCLASSIFIED: 0,
  CUI: 1,
  SECRET: 2,
  TOP_SECRET: 3,
};

// ---------------------------------------------------------------------------
// 1-hour TTL claim cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  claims: VCClaim[];
  fetchedAt: number; // epoch ms
}

const claimCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedClaims(did: string): VCClaim[] | null {
  const entry = claimCache.get(did);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    claimCache.delete(did);
    return null;
  }
  return entry.claims;
}

function cacheClaims(did: string, claims: VCClaim[]): void {
  claimCache.set(did, { claims, fetchedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Stub: fetch claims from AgentConfig (60-03 will create the table)
// ---------------------------------------------------------------------------

async function fetchClaimsFromAgentConfig(did: string): Promise<VCClaim[]> {
  // TODO: Replace with NEAR blockchain DID document resolution when VC
  // infrastructure is live. This stub queries the AgentConfig table once
  // 60-03 creates it. Until then, resolve to an empty claims array so that
  // non-clearance-gated tools remain accessible and clearance-gated tools
  // require explicit MCP_ALLOWED_DIDS allowlist membership.

  try {
    // Dynamic import to avoid circular dependency at module load time
    const { db } = await import('../../db/db.js');
    const rows = await db.query<{ claim_type: string; claim_value: string; issuer: string; issued_at: string }>(
      `SELECT claim_type, claim_value, issuer, issued_at
         FROM agent_vc_claims
        WHERE agent_did = $1
          AND (expires_at IS NULL OR expires_at > NOW())`,
      [did],
    );

    return rows.rows.map((row) => ({
      type: row.claim_type,
      value: row.claim_value,
      issuer: row.issuer,
      issuedAt: new Date(row.issued_at),
    }));
  } catch {
    // Table doesn't exist yet (pre-60-03) or DB unavailable — return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Resolve DID Verifiable Credential claims with a 1-hour TTL cache.
 *
 * TODO: Replace with NEAR blockchain DID document resolution when VC
 * infrastructure is live.
 */
export async function resolveDIDClaims(did: string): Promise<VCClaim[]> {
  const cached = getCachedClaims(did);
  if (cached) return cached;

  const claims = await fetchClaimsFromAgentConfig(did);
  cacheClaims(did, claims);
  return claims;
}

/**
 * Check whether the provided claims satisfy the minimum clearance level.
 */
export function requireClearance(claims: VCClaim[], minLevel: ClearanceLevel): boolean {
  const clearanceClaim = claims.find((c) => c.type === 'ClearanceLevel');
  if (!clearanceClaim) return false;

  const agentLevel = CLEARANCE_LEVELS[clearanceClaim.value as ClearanceLevel];
  const requiredLevel = CLEARANCE_LEVELS[minLevel];

  if (agentLevel === undefined) return false;
  return agentLevel >= requiredLevel;
}

/**
 * Extract staff section from DID claims. Returns 'Other' if no StaffRole claim found.
 */
export function getStaffSection(claims: VCClaim[]): StaffSection {
  const staffClaim = claims.find((c) => c.type === 'StaffRole');
  if (!staffClaim) return 'Other';

  const validSections: StaffSection[] = [
    'Commander', 'S1', 'S2', 'S3', 'S4', 'S6', 'S9', 'XO', 'CSM', 'Other',
  ];

  const section = staffClaim.value as StaffSection;
  return validSections.includes(section) ? section : 'Other';
}

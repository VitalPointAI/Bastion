/**
 * Tool and Team DID Management
 *
 * Helpers for creating and resolving DIDs for tools and teams.
 * Follows the same pattern as agent-did.ts for consistency.
 *
 * Tool DIDs: did:near:tool-{toolId}
 * Team DIDs: did:near:team-{teamId}
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// System secrets for deriving keys (should match DID service pattern)
const TOOL_KEY_CONTEXT = 'bastion-tool-did-v1';
const TEAM_KEY_CONTEXT = 'bastion-team-did-v1';

/**
 * DID result containing the DID string and associated keys.
 */
export interface DIDResult {
  did: string;
  blindedKey: string;
  publicKey: string;
}

/**
 * Generate deterministic keys for a tool DID.
 * Uses HKDF with tool ID to derive consistent keys.
 */
function deriveToolKeys(toolId: string): {
  blindedKey: string;
  publicKey: string;
} {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${TOOL_KEY_CONTEXT}:${toolId}`);

  // Derive 64 bytes: 32 for blinded key, 32 for public key
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);

  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}

/**
 * Generate deterministic keys for a team DID.
 * Uses HKDF with team ID to derive consistent keys.
 */
function deriveTeamKeys(teamId: string): {
  blindedKey: string;
  publicKey: string;
} {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${TEAM_KEY_CONTEXT}:${teamId}`);

  // Derive 64 bytes: 32 for blinded key, 32 for public key
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);

  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}

/**
 * Create a DID for an MCP tool.
 * Returns the DID string and associated keys.
 */
export async function createToolDID(toolId: string): Promise<DIDResult> {
  // Generate deterministic keys
  const keys = deriveToolKeys(toolId);

  // DID format: did:near:tool-{toolId}
  const did = `did:near:tool-${toolId}`;

  return {
    did,
    blindedKey: keys.blindedKey,
    publicKey: keys.publicKey,
  };
}

/**
 * Create a DID for an agent team.
 * Returns the DID string and associated keys.
 */
export async function createTeamDID(teamId: string): Promise<DIDResult> {
  // Generate deterministic keys
  const keys = deriveTeamKeys(teamId);

  // DID format: did:near:team-{teamId}
  const did = `did:near:team-${teamId}`;

  return {
    did,
    blindedKey: keys.blindedKey,
    publicKey: keys.publicKey,
  };
}

/**
 * Parse tool ID from a tool DID.
 * Returns null if the DID is not a valid tool DID.
 */
export function parseToolDID(toolDID: string): string | null {
  const match = toolDID.match(/^did:near:tool-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Parse team ID from a team DID.
 * Returns null if the DID is not a valid team DID.
 */
export function parseTeamDID(teamDID: string): string | null {
  const match = teamDID.match(/^did:near:team-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Verify a tool's DID matches expected keys.
 * Used for authentication/verification of tool identity.
 */
export function verifyToolDID(toolId: string, providedPublicKey: string): boolean {
  const keys = deriveToolKeys(toolId);
  return keys.publicKey === providedPublicKey;
}

/**
 * Verify a team's DID matches expected keys.
 * Used for authentication/verification of team identity.
 */
export function verifyTeamDID(teamId: string, providedPublicKey: string): boolean {
  const keys = deriveTeamKeys(teamId);
  return keys.publicKey === providedPublicKey;
}

/**
 * Check if a DID is a tool DID.
 */
export function isToolDID(did: string): boolean {
  return did.startsWith('did:near:tool-');
}

/**
 * Check if a DID is a team DID.
 */
export function isTeamDID(did: string): boolean {
  return did.startsWith('did:near:team-');
}

/**
 * Check if a DID is an agent DID.
 */
export function isAgentDID(did: string): boolean {
  return did.startsWith('did:near:agent-');
}

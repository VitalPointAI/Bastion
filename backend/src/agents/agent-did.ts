/**
 * Agent DID Management
 *
 * Helpers for creating and resolving agent decentralized identifiers (DIDs).
 * Agent DIDs follow format: did:near:agent-{agentId}
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { getAgentRegistry } from './registry.js';
import type { AgentManifest } from './types.js';

// System secret for deriving agent keys (should match DID service pattern)
const AGENT_KEY_CONTEXT = 'bastion-agent-did-v1';

/**
 * Generate deterministic keys for an agent DID.
 * Uses HKDF with agent ID to derive consistent keys.
 */
function deriveAgentKeys(agentId: string): {
  blindedKey: string;
  publicKey: string;
} {
  const systemSecret = process.env.ENCRYPTION_KEY || 'dev-secret-key';
  const info = utf8ToBytes(`${AGENT_KEY_CONTEXT}:${agentId}`);

  // Derive 64 bytes: 32 for blinded key, 32 for public key
  const derived = hkdf(sha256, utf8ToBytes(systemSecret), undefined, info, 64);

  return {
    blindedKey: bytesToHex(derived.slice(0, 32)),
    publicKey: bytesToHex(derived.slice(32, 64)),
  };
}

/**
 * Create a DID for an agent.
 * Returns the DID string and associated keys.
 */
export async function createAgentDID(agentId: string): Promise<{
  did: string;
  blindedKey: string;
  publicKey: string;
}> {
  // Generate deterministic keys
  const keys = deriveAgentKeys(agentId);

  // DID format: did:near:agent-{agentId}
  const did = `did:near:agent-${agentId}`;

  return {
    did,
    blindedKey: keys.blindedKey,
    publicKey: keys.publicKey,
  };
}

/**
 * Resolve an agent DID to its manifest.
 * Returns null if agent not found.
 */
export async function resolveAgentDID(agentDID: string): Promise<AgentManifest | null> {
  // Parse agent ID from DID
  const match = agentDID.match(/^did:near:agent-(.+)$/);
  if (!match) {
    return null;
  }

  const agentId = match[1];
  const registry = getAgentRegistry();
  const agent = registry.getAgent(agentId);

  return agent || null;
}

/**
 * Verify an agent's DID matches expected keys.
 * Used for authentication/verification of agent identity.
 */
export function verifyAgentDID(agentId: string, providedPublicKey: string): boolean {
  const keys = deriveAgentKeys(agentId);
  return keys.publicKey === providedPublicKey;
}

/**
 * User Secret Derivation
 *
 * Derives the deterministic DID user secret from a NEAR account ID.
 * This secret is the root for all DID-related key derivation:
 * - DID blinded key (for on-chain lookup)
 * - DID encryption key (for document encryption)
 * - NEAR signing key (for on-chain transactions)
 *
 * The same derivation is used in identity.ts /register endpoint.
 * Extracted here so credential anchoring can re-derive it from the account ID.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const DID_SECRET_SEED = process.env.DID_SECRET_SEED || 'dev-seed';

/**
 * Derive the user's DID secret from their NEAR account ID.
 *
 * This is deterministic: same accountId + same DID_SECRET_SEED = same secret.
 * The secret is 32 bytes and serves as input key material for all DID operations.
 */
export function deriveUserSecretFromAccount(accountId: string): Uint8Array {
  const salt = utf8ToBytes('bastion-did-v1');
  const info = utf8ToBytes(`did:near:${accountId}`);
  const ikm = utf8ToBytes(accountId + ':' + DID_SECRET_SEED);
  return hkdf(sha256, ikm, salt, info, 32);
}

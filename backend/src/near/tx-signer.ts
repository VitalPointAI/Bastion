/**
 * NEAR Transaction Signer
 *
 * Derives a user-specific Ed25519 signing keypair from the DID user secret,
 * creates an implicit NEAR account (hex of public key), and signs contract
 * calls as that account.
 *
 * ARCHITECTURE:
 * - Each user gets a deterministic "signing account" derived from their DID secret
 * - The signing account is an implicit NEAR account (64-char hex = Ed25519 pubkey)
 * - On-chain transactions show the USER's signing account as signer — proper audit trail
 * - The DID secret is deterministic from accountId + DID_SECRET_SEED (server-side)
 *   or from PRF output (passkey-derived)
 * - The signing account must be funded with NEAR for gas before first use
 *
 * KEY DERIVATION:
 * userSecret (32 bytes) → HKDF("bastion-near-signing-v1") → signingKeySeed (32 bytes)
 *                        → Ed25519 keypair → implicit account = hex(pubKey)
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { type KeyPairString } from '@near-js/crypto';
import { Account } from '@near-js/accounts';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPairSigner } from '@near-js/signers';
import type { ResourceCaveats, EmploymentContext, EmploymentAuthResult } from '../resources/types.js';

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did.bastion.testnet';
const CREDENTIAL_CONTRACT_ID = process.env.CREDENTIAL_CONTRACT_ID || 'credentials.bastion.testnet';

// Funder account for auto-funding new signing accounts
const FUNDER_ACCOUNT_ID = process.env.NEAR_FUNDER_ACCOUNT_ID || '';
const FUNDER_PRIVATE_KEY = process.env.NEAR_FUNDER_PRIVATE_KEY || '';

// Gas limit for contract calls (30 TGas)
const DEFAULT_GAS = BigInt('30000000000000');
// Amount to seed new signing accounts (0.1 NEAR — enough for ~hundreds of DID ops)
const FUNDING_AMOUNT = BigInt('100000000000000000000000'); // 0.1 NEAR in yoctoNEAR

// Track accounts already funded this process lifetime (prevents double-funding on concurrent calls)
const fundedAccounts = new Set<string>();

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive a NEAR Ed25519 signing keypair from the user's DID secret.
 *
 * Uses HKDF with a distinct info string to produce a signing key that's
 * cryptographically independent from the DID encryption/blinding keys.
 */
export function deriveSigningKeyPair(userSecret: Uint8Array): {
  seed: Uint8Array;
  publicKey: Uint8Array;
  signingAccountId: string;
  keyPairString: KeyPairString;
} {
  // Derive a 32-byte signing seed (distinct from DID encryption key)
  const seed = hkdf(sha256, userSecret, utf8ToBytes('bastion-near-signing-v1'), utf8ToBytes('signing-key'), 32);

  // Ed25519 public key from seed
  const publicKey = ed25519.getPublicKey(seed);

  // Implicit NEAR account = hex of public key
  const signingAccountId = bytesToHex(publicKey);

  // Build NEAR-compatible key string: ed25519:<base58(seed || pubKey)>
  const extendedKey = new Uint8Array(64);
  extendedKey.set(seed, 0);
  extendedKey.set(publicKey, 32);
  const keyPairString = `ed25519:${base58Encode(extendedKey)}` as KeyPairString;

  return { seed, publicKey, signingAccountId, keyPairString };
}

/**
 * Get the signing account ID for a user (without exposing the key).
 */
export function getSigningAccountId(userSecret: Uint8Array): string {
  const seed = hkdf(sha256, userSecret, utf8ToBytes('bastion-near-signing-v1'), utf8ToBytes('signing-key'), 32);
  const publicKey = ed25519.getPublicKey(seed);
  return bytesToHex(publicKey);
}

// ============================================================================
// Account Auto-Funding
// ============================================================================

/**
 * Fund a new signing account by transferring NEAR from the funder account.
 * Creates the implicit account on-chain so it can sign transactions.
 */
async function fundSigningAccount(
  signingAccountId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!FUNDER_ACCOUNT_ID || !FUNDER_PRIVATE_KEY) {
    return { success: false, error: 'NEAR_FUNDER_ACCOUNT_ID / NEAR_FUNDER_PRIVATE_KEY not configured' };
  }
  try {
    const signer = KeyPairSigner.fromSecretKey(FUNDER_PRIVATE_KEY as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const funderAccount = new Account(FUNDER_ACCOUNT_ID, provider, signer);

    await funderAccount.sendMoney(signingAccountId, FUNDING_AMOUNT);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[tx-signer] Failed to fund ${signingAccountId}:`, msg);
    return { success: false, error: msg };
  }
}

// ============================================================================
// Transaction Signing & Submission
// ============================================================================

/**
 * Sign and submit a function call transaction as the user's signing account.
 *
 * @param userSecret - The user's DID secret (32 bytes)
 * @param contractId - Target contract account ID
 * @param methodName - Contract method to call
 * @param args - Method arguments (will be JSON-serialized)
 * @param gas - Gas to attach (defaults to 30 TGas)
 * @param deposit - NEAR deposit to attach (defaults to 0)
 * @returns Transaction result or error
 */
export async function signAndSubmitFunctionCall(
  userSecret: Uint8Array,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
  gas: bigint = DEFAULT_GAS,
  deposit: bigint = BigInt(0),
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { signingAccountId, keyPairString } = deriveSigningKeyPair(userSecret);

    // Auto-fund the signing account if it doesn't exist or balance is too low
    const funded = await isSigningAccountFunded(userSecret);
    if (!funded) {
      fundedAccounts.delete(signingAccountId); // Clear cache so we re-check next time too
      const fundResult = await fundSigningAccount(signingAccountId);
      if (!fundResult.success) {
        return { success: false, error: `Failed to fund signing account: ${fundResult.error}` };
      }
      console.log(`[tx-signer] Auto-funded signing account ${signingAccountId}`);
    }

    const signer = KeyPairSigner.fromSecretKey(keyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const account = new Account(signingAccountId, provider, signer);

    const result = await account.functionCall({
      contractId,
      methodName,
      args,
      gas,
      attachedDeposit: deposit,
    });

    // Check for success
    if (result.status && typeof result.status === 'object' && 'Failure' in result.status) {
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(result.status.Failure)}`,
      };
    }

    // Record NEAR cost (fire-and-forget)
    import('../cost/cost-store.js').then(({ costStore }) => {
      costStore.recordNEARCost({
        costType: deposit > 0 ? 'near_storage' : 'near_gas',
        actorDid: `did:near:${signingAccountId.slice(0, 16)}`,
        deposit,
        gasBurned: gas,
        operation: `${contractId}::${methodName}`,
      }).catch(() => {});
    }).catch(() => {});

    return {
      success: true,
      txHash: result.transaction?.hash,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[tx-signer] ${methodName} failed:`, msg);
    return { success: false, error: msg };
  }
}

// ============================================================================
// DID Registry Operations
// ============================================================================

/**
 * Store an encrypted DID document on-chain via the DID Registry contract.
 * Signed by the user's derived signing account.
 */
export async function storeDIDOnChain(
  userSecret: Uint8Array,
  blindedKey: Uint8Array,
  encryptedDocument: Uint8Array,
  encryptedEntityType: Uint8Array,
  nonce: Uint8Array,
  entityTypeNonce?: Uint8Array,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Attach storage deposit (0.01 NEAR covers ~1KB on-chain)
  const STORAGE_DEPOSIT = BigInt('10000000000000000000000'); // 0.01 NEAR
  return signAndSubmitFunctionCall(
    userSecret,
    DID_CONTRACT_ID,
    'store_did',
    {
      blinded_key: Array.from(blindedKey),
      encrypted_document: Array.from(encryptedDocument),
      encrypted_entity_type: Array.from(encryptedEntityType),
      nonce: Array.from(nonce),
      entity_type_nonce: entityTypeNonce ? Array.from(entityTypeNonce) : null,
    },
    DEFAULT_GAS,
    STORAGE_DEPOSIT,
  );
}

// ============================================================================
// Credential Registry Operations
// ============================================================================

/**
 * Anchor an encrypted credential on-chain via the Credential Registry contract.
 * Signed by the user's derived signing account.
 *
 * @param userSecret - User's DID secret (for signing)
 * @param credentialHash - SHA256 hash of the credential (from credential-service)
 * @param encryptedMetadata - Encrypted credential metadata (type, issuer, subject)
 * @param nonce - Encryption nonce (24 bytes)
 * @param expirationDate - Optional expiration timestamp (milliseconds)
 */
export async function anchorCredentialOnChain(
  userSecret: Uint8Array,
  credentialHash: Uint8Array,
  encryptedMetadata: Uint8Array,
  nonce: Uint8Array,
  expirationDate?: number,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Derive blinded credential ID and revocation key from credential hash
  // These MUST be different (contract enforces this)
  const blindedCredentialId = hkdf(
    sha256, userSecret,
    utf8ToBytes('credential-lookup'),
    new Uint8Array([...credentialHash, ...utf8ToBytes('credential-id')]),
    32,
  );
  const blindedRevocationKey = hkdf(
    sha256, userSecret,
    utf8ToBytes('credential-revocation'),
    new Uint8Array([...credentialHash, ...utf8ToBytes('revocation-key')]),
    32,
  );

  // Attach storage deposit (0.01 NEAR covers credential entry)
  const STORAGE_DEPOSIT = BigInt('10000000000000000000000'); // 0.01 NEAR
  return signAndSubmitFunctionCall(
    userSecret,
    CREDENTIAL_CONTRACT_ID,
    'anchor_credential',
    {
      blinded_credential_id: Array.from(blindedCredentialId),
      blinded_revocation_key: Array.from(blindedRevocationKey),
      credential_hash: Array.from(credentialHash),
      encrypted_metadata: Array.from(encryptedMetadata),
      nonce: Array.from(nonce),
      expiration_date: expirationDate ?? null,
    },
    DEFAULT_GAS,
    STORAGE_DEPOSIT,
  );
}

// ============================================================================
// Account Funding
// ============================================================================

/**
 * Check if the user's signing account exists on-chain (is funded).
 */
/** Minimum balance required for a DID operation (storage deposit + gas) */
const MIN_OPERATIONAL_BALANCE = BigInt('20000000000000000000000'); // 0.02 NEAR

export async function isSigningAccountFunded(userSecret: Uint8Array): Promise<boolean> {
  const signingAccountId = getSigningAccountId(userSecret);
  try {
    const response = await fetch(NEAR_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'check-signing-account',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: signingAccountId,
        },
      }),
    });
    const result = await response.json() as { error?: unknown; result?: { amount?: string } };
    if (result.error) return false;

    // Check if balance is sufficient for operations, not just that the account exists
    const balance = BigInt(result.result?.amount ?? '0');
    if (balance < MIN_OPERATIONAL_BALANCE) {
      console.log(`[tx-signer] Account ${signingAccountId.slice(0, 12)}... balance ${balance} below minimum ${MIN_OPERATIONAL_BALANCE} — needs re-funding`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Resource Caveat Operations (Phase 58 Plan 02)
// ============================================================================

/**
 * Serialize ResourceCaveats from TS camelCase to Rust snake_case for on-chain storage.
 * GeoBounds integers are already integers (contract uses i64 = degrees * 1_000_000).
 */
function serializeCaveatsForChain(caveats: ResourceCaveats, signingAccountId: string): Record<string, unknown> {
  return {
    classification: caveats.classification,
    releasability: caveats.releasability,
    geo_bounds: caveats.geoBounds
      ? {
          north: Math.round(caveats.geoBounds.north),
          south: Math.round(caveats.geoBounds.south),
          east: Math.round(caveats.geoBounds.east),
          west: Math.round(caveats.geoBounds.west),
        }
      : null,
    roe_tier: caveats.roeTier,
    time_windows: caveats.timeWindows.map((tw) => ({
      start_ms: tw.startMs,
      end_ms: tw.endMs,
    })),
    employment_constraints: caveats.employmentConstraints,
    updated_by: signingAccountId,
    updated_at: Date.now() * 1_000_000, // nanoseconds for NEAR
  };
}

/**
 * Store resource caveats on-chain via the DID registry's update_resource_caveats method.
 * Signs as the system admin account (resource DIDs are admin-owned, not user-owned).
 *
 * @param userSecret - System HKDF-derived secret (NOT a per-user secret)
 * @param blindedKeyHex - Hex string of the resource's blinded key
 * @param caveats - Resource caveats to store on-chain
 */
export async function storeResourceCaveatsOnChain(
  userSecret: Uint8Array,
  blindedKeyHex: string,
  caveats: ResourceCaveats,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const { signingAccountId } = deriveSigningKeyPair(userSecret);
  const blindedKeyBytes = Buffer.from(blindedKeyHex, 'hex');
  const STORAGE_DEPOSIT = BigInt('5000000000000000000000'); // 0.005 NEAR

  return signAndSubmitFunctionCall(
    userSecret,
    DID_CONTRACT_ID,
    'update_resource_caveats',
    {
      blinded_key: Array.from(blindedKeyBytes),
      caveats: serializeCaveatsForChain(caveats, signingAccountId),
    },
    DEFAULT_GAS,
    STORAGE_DEPOSIT,
  );
}

/**
 * Check whether a resource is authorized for employment via a NEAR RPC view call.
 * No signing needed — this is a view method.
 *
 * @param blindedKeyHex - Hex string of the resource's blinded key
 * @param context - Employment context (requesting account, location, time, ROE tier, nation)
 * @returns EmploymentAuthResult — authorized + reasons list
 */
export async function checkEmploymentAuthViaRPC(
  blindedKeyHex: string,
  context: EmploymentContext,
): Promise<EmploymentAuthResult> {
  try {
    const blindedKeyBytes = Array.from(Buffer.from(blindedKeyHex, 'hex'));
    const snakeCaseContext = {
      requesting_account: context.requestingAccount,
      location: context.location
        ? {
            north: Math.round(context.location.north),
            south: Math.round(context.location.south),
            east: Math.round(context.location.east),
            west: Math.round(context.location.west),
          }
        : null,
      timestamp_ms: context.timestampMs,
      roe_tier_required: context.roeTierRequired,
      nation_code: context.nationCode ?? null,
    };

    const response = await fetch(NEAR_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'employment-check',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: DID_CONTRACT_ID,
          method_name: 'check_employment_authorized',
          args_base64: Buffer.from(
            JSON.stringify({ blinded_key: blindedKeyBytes, context: snakeCaseContext })
          ).toString('base64'),
        },
      }),
    });

    const rpcResult = await response.json() as { result?: { result?: number[] } };
    if (rpcResult.result?.result) {
      const decoded = JSON.parse(Buffer.from(rpcResult.result.result).toString()) as EmploymentAuthResult;
      return decoded;
    }
    return { authorized: false, reasons: ['RPC call failed: no result'] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[tx-signer] checkEmploymentAuthViaRPC failed:', msg);
    return { authorized: false, reasons: ['RPC call failed'] };
  }
}

// ============================================================================
// Utilities
// ============================================================================

/** Base58 encode (Bitcoin alphabet, same as NEAR) */
function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    result = ALPHABET[remainder] + result;
  }
  for (const byte of bytes) {
    if (byte === 0) result = '1' + result;
    else break;
  }
  return result || '1';
}

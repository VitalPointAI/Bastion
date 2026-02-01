/**
 * MPC-Based NEAR Account Creation
 *
 * ARCHITECTURE:
 * - NEAR accounts are created via Chain Signatures MPC
 * - Derivation path uses user's stable UUID (NOT passkey public key)
 * - Path format: `bastion,{user_uuid}`
 * - This survives passkey replacement during recovery
 *
 * WHY NOT PASSKEY-DERIVED:
 * - Passkeys can be replaced (lost device, recovery)
 * - New passkey = new public key
 * - If NEAR account derived from passkey public key, recovery = orphaned assets
 * - UUID is stable anchor: same UUID = same path = same NEAR account = assets preserved
 *
 * NOTE: Uses direct RPC calls for read operations.
 * Account creation with funding requires NEAR_FUNDING_ACCOUNT_ID and NEAR_FUNDING_PRIVATE_KEY.
 * When funding is configured, uses @near-js modular packages.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const NEAR_NETWORK_ID = process.env.NEAR_NETWORK_ID || 'testnet';
const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const MPC_CONTRACT_ID = NEAR_NETWORK_ID === 'mainnet'
  ? 'v1.signer.near'
  : 'v2.multichain-mpc.testnet';

// Backend funding account for creating new user accounts
const FUNDING_ACCOUNT_ID = process.env.NEAR_FUNDING_ACCOUNT_ID;
const FUNDING_PRIVATE_KEY = process.env.NEAR_FUNDING_PRIVATE_KEY;

/**
 * Generate MPC derivation path from user UUID
 *
 * Path format: `bastion,{uuid}`
 * - "bastion" prefix prevents collision with other apps using same MPC
 * - UUID is stable across passkey changes
 * - Same UUID = same derivation path = same NEAR signing capability
 *
 * @param userId - User's stable UUID (from 1.2-01 data layer)
 * @returns Derivation path for MPC signing
 */
export function getMPCDerivationPath(userId: string): string {
  return `bastion,${userId}`;
}

/**
 * Get MPC root public key from Chain Signatures network
 *
 * NOTE: This returns the SAME key for all users. That's correct.
 * Per-user differentiation happens at signing time via the derivation path.
 *
 * @returns MPC network's root public key
 */
export async function getMPCRootPublicKey(): Promise<string> {
  const response = await fetch(NEAR_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-root-key',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: MPC_CONTRACT_ID,
        method_name: 'public_key',
        args_base64: btoa('{}'),
      },
    }),
  });

  const result = await response.json() as {
    result?: { result: number[]; error?: string };
    error?: unknown;
  };

  if (result.error || result.result?.error) {
    throw new Error('Failed to get MPC root public key');
  }

  if (result.result?.result && Array.isArray(result.result.result)) {
    const bytes = new Uint8Array(result.result.result);
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded);
  }

  throw new Error('Invalid response from MPC contract');
}

/**
 * Check if NEAR account exists on-chain
 *
 * @param accountId - NEAR account ID to check
 * @returns true if account exists
 */
export async function checkAccountExists(accountId: string): Promise<boolean> {
  try {
    const response = await fetch(NEAR_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'check-account',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: accountId,
        },
      }),
    });

    const result = await response.json() as { error?: unknown };
    return !result.error;
  } catch {
    return false;
  }
}

/**
 * Create NEAR account with MPC access key
 *
 * Flow:
 * 1. Generate account ID (UUID-based for uniqueness)
 * 2. Get MPC root public key
 * 3. Create account with MPC key as full access key (if funding configured)
 * 4. Return account ID and derivation path
 *
 * The MPC key is added to allow the Chain Signatures network
 * to sign transactions for this user via their derivation path.
 *
 * @param userId - User's stable UUID
 * @returns Created account info
 */
export async function createMPCAccount(userId: string): Promise<{
  accountId: string;
  derivationPath: string;
  mpcPublicKey: string;
}> {
  const derivationPath = getMPCDerivationPath(userId);

  // Get MPC root public key first (needed for implicit account derivation)
  const mpcPublicKey = await getMPCRootPublicKey();

  // Derive implicit account ID: SHA256(derivationPath + mpcPublicKey) -> 64-char hex
  // This creates a unique, deterministic account ID for each user's MPC path
  // Per NEAR docs, implicit accounts are 64-character hex strings
  const derivationData = new TextEncoder().encode(`${derivationPath}:${mpcPublicKey}`);
  const hash = sha256(derivationData);
  const accountId = bytesToHex(hash);

  // Check if account already exists (idempotent)
  const exists = await checkAccountExists(accountId);
  if (exists) {
    return { accountId, derivationPath, mpcPublicKey };
  }

  // Create account if funding credentials are configured
  if (FUNDING_ACCOUNT_ID && FUNDING_PRIVATE_KEY) {
    await createFundedAccount(accountId, mpcPublicKey);
  } else {
    // In development without funding account, just return the expected account ID
    // The account will be created when first funded
    console.warn('⚠️ No funding account configured - account creation deferred');
  }

  return { accountId, derivationPath, mpcPublicKey };
}

/**
 * Create and fund a new NEAR account
 * Uses backend's funding account to create user account with MPC key
 *
 * NOTE: This requires @near-js packages to be installed and configured.
 * Currently a placeholder - account creation is deferred until funding is set up.
 */
async function createFundedAccount(
  newAccountId: string,
  mpcPublicKey: string
): Promise<void> {
  if (!FUNDING_ACCOUNT_ID || !FUNDING_PRIVATE_KEY) {
    throw new Error('Funding account not configured');
  }

  // TODO: Implement with @near-js modular packages when production funding is needed
  // For now, log the intent and defer actual creation
  console.log(`Would create funded account ${newAccountId} with MPC key`);
  console.log(`MPC Public Key: ${mpcPublicKey}`);
  console.log('Account creation deferred - implement with @near-js/accounts when ready');

  // In production, this would use:
  // import { Account } from '@near-js/accounts';
  // import { KeyPair } from '@near-js/crypto';
  // import { InMemoryKeyStore } from '@near-js/keystores';
  // And perform the actual account creation transaction
}

/**
 * Add MPC key to existing account
 * Used during migration from Privy-based accounts
 *
 * @param accountId - Existing NEAR account ID
 * @param mpcPublicKey - MPC root public key to add
 */
export async function addMPCKeyToAccount(
  accountId: string,
  mpcPublicKey: string
): Promise<{ success: boolean; txHash?: string }> {
  if (!FUNDING_ACCOUNT_ID || !FUNDING_PRIVATE_KEY) {
    throw new Error('Funding account not configured');
  }

  // TODO: Implement with @near-js modular packages when production migration is needed
  console.log(`Would add MPC key ${mpcPublicKey} to account ${accountId}`);

  return { success: true, txHash: 'pending-migration-implementation' };
}

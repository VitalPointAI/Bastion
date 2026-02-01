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
 */

import { Account, connect, KeyPair, keyStores } from 'near-api-js';

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
 * 3. Create account with MPC key as full access key
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

  // Generate account ID: bastion-{first-8-chars-of-uuid}.{network}
  // Using UUID prefix ensures uniqueness while keeping account ID readable
  const accountIdPrefix = `bastion-${userId.slice(0, 8).toLowerCase()}`;
  const accountId = NEAR_NETWORK_ID === 'mainnet'
    ? `${accountIdPrefix}.near`
    : `${accountIdPrefix}.testnet`;

  // Check if account already exists (idempotent)
  const exists = await checkAccountExists(accountId);
  if (exists) {
    const mpcPublicKey = await getMPCRootPublicKey();
    return { accountId, derivationPath, mpcPublicKey };
  }

  // Get MPC root public key
  const mpcPublicKey = await getMPCRootPublicKey();

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
 */
async function createFundedAccount(
  newAccountId: string,
  mpcPublicKey: string
): Promise<void> {
  if (!FUNDING_ACCOUNT_ID || !FUNDING_PRIVATE_KEY) {
    throw new Error('Funding account not configured');
  }

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(FUNDING_PRIVATE_KEY);
  await keyStore.setKey(NEAR_NETWORK_ID, FUNDING_ACCOUNT_ID, keyPair);

  const near = await connect({
    networkId: NEAR_NETWORK_ID,
    nodeUrl: NEAR_RPC_URL,
    keyStore,
  });

  const fundingAccount = await near.account(FUNDING_ACCOUNT_ID);

  // Create account with initial balance and MPC key
  // The MPC key format needs to match what Chain Signatures expects
  await fundingAccount.createAccount(
    newAccountId,
    mpcPublicKey, // MPC root public key as the access key
    '100000000000000000000000' // 0.1 NEAR initial balance
  );
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

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(FUNDING_PRIVATE_KEY);
  await keyStore.setKey(NEAR_NETWORK_ID, FUNDING_ACCOUNT_ID, keyPair);

  const near = await connect({
    networkId: NEAR_NETWORK_ID,
    nodeUrl: NEAR_RPC_URL,
    keyStore,
  });

  const fundingAccount = await near.account(FUNDING_ACCOUNT_ID);

  // This requires the funding account to have access to the target account
  // In practice, this would be done via a smart contract or the user's existing key
  // For now, this is a placeholder for the migration flow
  console.log(`Would add MPC key ${mpcPublicKey} to account ${accountId}`);

  return { success: true, txHash: 'pending-migration-implementation' };
}

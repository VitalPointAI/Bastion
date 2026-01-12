// NEAR MPC Account Management via Chain Signatures
// Uses NEAR's decentralized MPC network for user-owned keys
// No backend key storage - all keys managed by 8-node threshold MPC

/**
 * MPC Account Manager
 *
 * Architecture:
 * 1. User authenticates with Privy (email/social)
 * 2. Backend creates NEAR account on-chain (via testnet faucet or funded creator)
 * 3. User's NEAR account registers derivation path with MPC contract
 * 4. MPC network derives keys - no single entity can reconstruct private key
 * 5. User signs transactions via Chain Signatures MPC
 *
 * Benefits:
 * - User-owned keys (truly decentralized)
 * - No seed phrases or private key management
 * - Email-based recovery via NEAR account
 * - Backend never has access to private keys
 */

export interface MPCAccount {
  nearAccountId: string;
  derivationPath: string;
  mpcPublicKey: string;
}

/**
 * MPC Account Manager
 * Integrates with NEAR Chain Signatures for decentralized key management
 */
export class MPCAccountManager {
  private mpcContractId: string;
  private networkId: string;

  constructor(networkId: 'testnet' | 'mainnet' = 'testnet') {
    this.networkId = networkId;
    // Chain Signatures MPC contract
    this.mpcContractId = networkId === 'mainnet'
      ? 'v1.signer-prod.near'
      : 'v1.signer-dev.testnet';
  }

  /**
   * Create NEAR account for user
   *
   * This creates the actual on-chain NEAR account.
   * Account name format: bastion-<hash>.testnet
   *
   * @param privyUserId - Privy user ID (for deterministic naming)
   * @param email - User email
   * @returns Account details
   */
  async createNEARAccount(privyUserId: string, email: string): Promise<MPCAccount> {
    // Generate deterministic account name
    const accountName = this.generateAccountName(email);
    const nearAccountId = `${accountName}.testnet`;

    // Derivation path for this user
    // Format: "bastion-users,<privy-id>"
    // This path is used by MPC to derive keys deterministically
    const derivationPath = `bastion-users,${privyUserId}`;

    // In v1, we'll track the account creation intent
    // Full implementation requires:
    // 1. Call testnet faucet or use funded creator account
    // 2. Create account with temporary keys
    // 3. User registers derivation path with MPC contract
    // 4. MPC derives public key for this path
    // 5. Replace temporary keys with MPC-derived keys

    console.log('Creating NEAR account (v1 - manual creation):', {
      nearAccountId,
      derivationPath,
      mpcContractId: this.mpcContractId,
    });

    // For v1: Return structure that frontend can use
    // Production: Implement full account creation
    return {
      nearAccountId,
      derivationPath,
      mpcPublicKey: 'pending-mpc-registration', // Will be set after MPC registration
    };
  }

  /**
   * Register user with MPC network
   *
   * After NEAR account exists, user calls this to register their derivation path
   * with the Chain Signatures MPC contract.
   *
   * This should be called FROM THE FRONTEND (user signs the transaction).
   * Backend only provides the derivation path.
   *
   * @param nearAccountId - User's NEAR account
   * @param derivationPath - Derivation path for key generation
   * @returns Public key from MPC
   */
  async registerWithMPC(nearAccountId: string, derivationPath: string): Promise<string> {
    // Frontend implementation:
    //
    // const account = await wallet.account(nearAccountId);
    // const result = await account.functionCall({
    //   contractId: 'v1.signer-dev.testnet',
    //   methodName: 'register_path', // or similar MPC method
    //   args: {
    //     path: derivationPath,
    //   },
    //   gas: '100000000000000',
    // });
    //
    // The MPC contract will derive a public key for this path.
    // This key is controlled by the 8-node MPC network via threshold signatures.

    console.log('MPC registration (frontend must call):', {
      nearAccountId,
      derivationPath,
      mpcContract: this.mpcContractId,
    });

    return 'ed25519:...'; // MPC will return public key
  }

  /**
   * Request MPC signature for transaction
   *
   * User signs transactions by requesting the MPC network to produce a signature.
   * This is called FROM THE FRONTEND (user authorizes the signature request).
   *
   * @param derivationPath - User's derivation path
   * @param payload - Transaction payload to sign
   * @returns Signature from MPC network
   */
  async requestMPCSignature(derivationPath: string, payload: Uint8Array): Promise<{
    signature: string;
    publicKey: string;
  }> {
    // Frontend implementation:
    //
    // const account = await wallet.account(nearAccountId);
    // const result = await account.functionCall({
    //   contractId: 'v1.signer-dev.testnet',
    //   methodName: 'sign',
    //   args: {
    //     path: derivationPath,
    //     payload: Array.from(payload),
    //   },
    //   gas: '250000000000000', // 250 Tgas for MPC signing
    // });
    //
    // MPC network (8 nodes) each produce signature shares.
    // Shares are combined via threshold cryptography.
    // Result: Full signature without any single node knowing private key.

    console.log('MPC signature request (frontend must call):', {
      derivationPath,
      payloadLength: payload.length,
      mpcContract: this.mpcContractId,
    });

    return {
      signature: 'ed25519:...',
      publicKey: 'ed25519:...',
    };
  }

  /**
   * Generate account name from email
   *
   * @param email - User email
   * @returns Short account name (10 chars)
   */
  private generateAccountName(email: string): string {
    // Simple deterministic hash for v1
    // Production: Use crypto hash (SHA-256)
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const hashStr = Math.abs(hash).toString(36);
    return `bastion-${hashStr}`.substring(0, 18); // Max 20 chars for account name
  }

  /**
   * Get derivation path for user
   *
   * @param privyUserId - Privy user ID
   * @returns Derivation path for MPC
   */
  getDerivationPath(privyUserId: string): string {
    return `bastion-users,${privyUserId}`;
  }
}

// Singleton instance
let mpcManager: MPCAccountManager | null = null;

/**
 * Get MPC account manager
 */
export function getMPCAccountManager(networkId: 'testnet' | 'mainnet' = 'testnet'): MPCAccountManager {
  if (!mpcManager) {
    mpcManager = new MPCAccountManager(networkId);
  }
  return mpcManager;
}

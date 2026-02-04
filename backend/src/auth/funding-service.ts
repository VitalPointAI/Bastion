/**
 * Funding Service for NEAR Implicit Account Activation
 *
 * Calls the funding contract to transfer NEAR to new implicit accounts.
 * Implements retry logic with exponential backoff for transient failures.
 *
 * ARCHITECTURE:
 * - Funding occurs after passkey registration, before session creation
 * - If funding fails after all retries, registration fails completely
 * - No partial account states: either fully funded or not created
 */

import { type KeyPairString } from '@near-js/crypto';
import { Account } from '@near-js/accounts';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPairSigner } from '@near-js/signers';

const NEAR_NETWORK_ID = process.env.NEAR_NETWORK_ID || 'testnet';
const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const FUNDING_CONTRACT_ID = process.env.NEAR_FUNDING_CONTRACT_ID;
const BACKEND_ACCOUNT_ID = process.env.NEAR_BACKEND_ACCOUNT_ID;
const BACKEND_PRIVATE_KEY = process.env.NEAR_BACKEND_PRIVATE_KEY;

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 10000; // 10 seconds

export interface FundingResult {
  success: boolean;
  txHash?: string;
  error?: string;
  attempts: number;
}

export interface FundingHistoryItem {
  account_id: string;
  amount: string;
  timestamp: number;
  block_height: number;
}

export interface ContractStatus {
  balance: string;
  availableBalance: string;
  fundingAmount: string;
  totalFunded: number;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

export class FundingService {
  private account: Account | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Lazy initialization of NEAR account
   */
  private async ensureInitialized(): Promise<void> {
    if (this.account) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    if (!FUNDING_CONTRACT_ID) {
      console.warn('[funding-service] NEAR_FUNDING_CONTRACT_ID not configured - funding disabled');
      return;
    }

    if (!BACKEND_ACCOUNT_ID || !BACKEND_PRIVATE_KEY) {
      console.warn('[funding-service] Backend NEAR credentials not configured - funding disabled');
      return;
    }

    try {
      // Create signer from private key
      const signer = KeyPairSigner.fromSecretKey(BACKEND_PRIVATE_KEY as KeyPairString);
      const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });

      // Create account instance (new API: accountId, provider, signer)
      this.account = new Account(BACKEND_ACCOUNT_ID, provider, signer);

      console.log('[funding-service] Initialized successfully');
    } catch (error) {
      console.error('[funding-service] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check if funding is enabled (contract configured)
   */
  isEnabled(): boolean {
    return !!(FUNDING_CONTRACT_ID && BACKEND_ACCOUNT_ID && BACKEND_PRIVATE_KEY);
  }

  /**
   * Fund an implicit account with retry logic
   *
   * @param accountId - 64-character hex implicit account ID
   * @returns FundingResult with success status, tx hash, and attempt count
   */
  async fundAccount(accountId: string): Promise<FundingResult> {
    if (!this.isEnabled()) {
      console.warn('[funding-service] Funding disabled - skipping account funding');
      return { success: true, attempts: 0 }; // Treat as success in dev mode
    }

    await this.ensureInitialized();

    if (!this.account) {
      return {
        success: false,
        error: 'Funding service not initialized',
        attempts: 0
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = getBackoffDelay(attempt);
          console.log(`[funding-service] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay...`);
          await sleep(delay);
        }

        // Call the funding contract
        const result = await this.account.functionCall({
          contractId: FUNDING_CONTRACT_ID!,
          methodName: 'fund',
          args: { account_id: accountId },
          gas: BigInt('30000000000000'), // 30 TGas
          attachedDeposit: BigInt(0),
        });

        // Check for success
        if (result.status && typeof result.status === 'object' && 'SuccessValue' in result.status) {
          console.log(`[funding-service] Account ${accountId} funded successfully`);
          return {
            success: true,
            txHash: result.transaction?.hash,
            attempts: attempt + 1
          };
        }

        // Transaction executed but may have failed
        if (result.status && typeof result.status === 'object' && 'Failure' in result.status) {
          throw new Error(`Transaction failed: ${JSON.stringify(result.status.Failure)}`);
        }

        console.log(`[funding-service] Account ${accountId} funded successfully`);
        return {
          success: true,
          txHash: result.transaction?.hash,
          attempts: attempt + 1
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[funding-service] Attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry on certain errors
        if (lastError.message.includes('already been funded')) {
          // Account already funded - treat as success
          return { success: true, attempts: attempt + 1 };
        }

        if (lastError.message.includes('Unauthorized')) {
          // Backend not authorized - won't succeed with retries
          return {
            success: false,
            error: 'Backend not authorized to fund accounts',
            attempts: attempt + 1
          };
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error after all retries',
      attempts: MAX_RETRIES
    };
  }

  /**
   * Get funding contract status (for admin UI)
   */
  async getContractStatus(): Promise<ContractStatus | null> {
    if (!FUNDING_CONTRACT_ID) {
      return null;
    }

    try {
      const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });

      // Query view methods
      const [balanceResult, availableResult, amountResult, totalResult] = await Promise.all([
        this.callViewMethod(provider, 'get_balance', {}),
        this.callViewMethod(provider, 'get_available_balance', {}),
        this.callViewMethod(provider, 'get_funding_amount', {}),
        this.callViewMethod(provider, 'get_total_funded', {}),
      ]);

      return {
        balance: balanceResult || '0',
        availableBalance: availableResult || '0',
        fundingAmount: amountResult || '0',
        totalFunded: parseInt(totalResult || '0', 10),
      };
    } catch (error) {
      console.error('[funding-service] Failed to get contract status:', error);
      return null;
    }
  }

  /**
   * Get funding history (for admin UI)
   */
  async getFundingHistory(fromIndex: number = 0, limit: number = 20): Promise<FundingHistoryItem[]> {
    if (!FUNDING_CONTRACT_ID) {
      return [];
    }

    try {
      const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
      const result = await this.callViewMethod(provider, 'get_funding_history', {
        from_index: fromIndex,
        limit
      });

      return result ? JSON.parse(result) : [];
    } catch (error) {
      console.error('[funding-service] Failed to get funding history:', error);
      return [];
    }
  }

  /**
   * Check if account has been funded
   */
  async isAccountFunded(accountId: string): Promise<boolean> {
    if (!FUNDING_CONTRACT_ID) {
      return false;
    }

    try {
      const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
      const result = await this.callViewMethod(provider, 'is_funded', {
        account_id: accountId
      });

      return result === 'true';
    } catch (error) {
      console.error('[funding-service] Failed to check funding status:', error);
      return false;
    }
  }

  /**
   * Helper to call view methods on the funding contract
   */
  private async callViewMethod(
    provider: JsonRpcProvider,
    methodName: string,
    args: Record<string, unknown>
  ): Promise<string | null> {
    try {
      const response = await provider.query({
        request_type: 'call_function',
        finality: 'final',
        account_id: FUNDING_CONTRACT_ID!,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      });

      if ('result' in response && Array.isArray(response.result)) {
        const bytes = new Uint8Array(response.result);
        return new TextDecoder().decode(bytes).replace(/"/g, '');
      }

      return null;
    } catch (error) {
      console.error(`[funding-service] View method ${methodName} failed:`, error);
      return null;
    }
  }
}

// Singleton instance
let fundingService: FundingService | null = null;

export function getFundingService(): FundingService {
  if (!fundingService) {
    fundingService = new FundingService();
  }
  return fundingService;
}

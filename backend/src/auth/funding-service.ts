/**
 * Funding Service for NEAR Implicit Account Activation
 *
 * Sends NEAR directly from the funder account to new implicit accounts.
 * Uses the same funder account as tx-signer (NEAR_FUNDER_ACCOUNT_ID).
 *
 * ARCHITECTURE:
 * - Funder is a standard NEAR account (funding.bastion.testnet) with NEAR balance
 * - Funds new implicit accounts via direct sendMoney transfers
 * - Admin dashboard queries funder balance via RPC (no contract needed)
 * - Track funded accounts in-memory + RPC account existence checks
 */

import { type KeyPairString } from '@near-js/crypto';
import { Account } from '@near-js/accounts';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPairSigner } from '@near-js/signers';

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const FUNDER_ACCOUNT_ID = process.env.NEAR_FUNDER_ACCOUNT_ID || '';
const FUNDER_PRIVATE_KEY = process.env.NEAR_FUNDER_PRIVATE_KEY || '';

// Amount to send per account (0.1 NEAR — enough for hundreds of DID ops)
const FUNDING_AMOUNT = BigInt('100000000000000000000000'); // 0.1 NEAR in yoctoNEAR

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;

// Track accounts funded this process lifetime
const fundedAccountsLog: Array<{ accountId: string; timestamp: number }> = [];

export interface FundingResult {
  success: boolean;
  txHash?: string;
  error?: string;
  attempts: number;
}

export interface FunderStatus {
  balance: string;           // yoctoNEAR
  availableBalance: string;  // yoctoNEAR (balance minus storage staking)
  fundingAmountPerAccount: string; // yoctoNEAR
  totalFundedThisSession: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

export class FundingService {
  private account: Account | null = null;
  private initPromise: Promise<void> | null = null;

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
    if (!FUNDER_ACCOUNT_ID || !FUNDER_PRIVATE_KEY) {
      console.warn('[funding-service] NEAR_FUNDER_ACCOUNT_ID / NEAR_FUNDER_PRIVATE_KEY not configured - funding disabled');
      return;
    }

    try {
      const signer = KeyPairSigner.fromSecretKey(FUNDER_PRIVATE_KEY as KeyPairString);
      const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
      this.account = new Account(FUNDER_ACCOUNT_ID, provider, signer);
      console.log(`[funding-service] Initialized with funder account: ${FUNDER_ACCOUNT_ID}`);
    } catch (error) {
      console.error('[funding-service] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check if funding is enabled (funder account configured)
   */
  isEnabled(): boolean {
    return !!(FUNDER_ACCOUNT_ID && FUNDER_PRIVATE_KEY);
  }

  /**
   * Fund an implicit account via direct NEAR transfer
   */
  async fundAccount(accountId: string): Promise<FundingResult> {
    if (!this.isEnabled()) {
      console.warn('[funding-service] Funding disabled - skipping account funding');
      return { success: true, attempts: 0 };
    }

    await this.ensureInitialized();

    if (!this.account) {
      return { success: false, error: 'Funding service not initialized', attempts: 0 };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = getBackoffDelay(attempt);
          console.log(`[funding-service] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay...`);
          await sleep(delay);
        }

        // Check if already funded (account exists on-chain)
        const alreadyExists = await this.checkAccountExists(accountId);
        if (alreadyExists) {
          console.log(`[funding-service] Account ${accountId} already exists on-chain, skipping`);
          return { success: true, attempts: attempt + 1 };
        }

        // Direct transfer — creates implicit account on-chain
        const result = await this.account.sendMoney(accountId, FUNDING_AMOUNT);

        if (result.status && typeof result.status === 'object' && 'Failure' in result.status) {
          throw new Error(`Transaction failed: ${JSON.stringify(result.status.Failure)}`);
        }

        fundedAccountsLog.push({ accountId, timestamp: Date.now() });
        console.log(`[funding-service] Account ${accountId} funded successfully`);
        return {
          success: true,
          txHash: result.transaction?.hash,
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[funding-service] Attempt ${attempt + 1} failed:`, lastError.message);

        if (lastError.message.includes('Unauthorized')) {
          return { success: false, error: 'Funder account not authorized', attempts: attempt + 1 };
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error after all retries',
      attempts: MAX_RETRIES,
    };
  }

  /**
   * Get funder account status via RPC (for admin dashboard)
   */
  async getFunderStatus(): Promise<FunderStatus | null> {
    if (!FUNDER_ACCOUNT_ID) return null;

    try {
      const response = await fetch(NEAR_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'funder-status',
          method: 'query',
          params: {
            request_type: 'view_account',
            finality: 'final',
            account_id: FUNDER_ACCOUNT_ID,
          },
        }),
      });

      const result = await response.json() as {
        result?: { amount: string; locked: string; storage_usage: number };
        error?: unknown;
      };

      if (result.error || !result.result) {
        console.error('[funding-service] RPC error querying funder account:', result.error);
        return null;
      }

      const { amount, locked } = result.result;
      // available = total - locked (storage staking)
      const available = BigInt(amount) - BigInt(locked);

      return {
        balance: amount,
        availableBalance: available > 0n ? available.toString() : '0',
        fundingAmountPerAccount: FUNDING_AMOUNT.toString(),
        totalFundedThisSession: fundedAccountsLog.length,
      };
    } catch (error) {
      console.error('[funding-service] Failed to get funder status:', error);
      return null;
    }
  }

  /**
   * Get the funder account ID
   */
  getFunderAccountId(): string {
    return FUNDER_ACCOUNT_ID;
  }

  /**
   * Get recent funding activity (in-memory log from this process)
   */
  getRecentActivity(limit: number = 20): Array<{ accountId: string; timestamp: number }> {
    return fundedAccountsLog.slice(-limit).reverse();
  }

  /**
   * Check if an implicit account exists on-chain (is funded)
   */
  async checkAccountExists(accountId: string): Promise<boolean> {
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
   * Send a top-up transfer to the funder account from... itself won't work.
   * Top-up must be done externally. This method returns instructions.
   */
  getTopUpInstructions(): { cliCommand: string; accountId: string } {
    return {
      accountId: FUNDER_ACCOUNT_ID,
      cliCommand: `near send YOUR_ACCOUNT.testnet ${FUNDER_ACCOUNT_ID} 10`,
    };
  }
}

// Singleton
let fundingService: FundingService | null = null;

export function getFundingService(): FundingService {
  if (!fundingService) {
    fundingService = new FundingService();
  }
  return fundingService;
}

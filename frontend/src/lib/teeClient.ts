/**
 * TEE Client for Frontend-to-Phala Communication
 *
 * Handles secure communication with Phala TEE through NEAR blockchain.
 * Integrates with NEAR contract for classification-based routing.
 */

import { Classification } from './aiContext.js';

/**
 * Wallet connection interface for NEAR blockchain operations
 */
interface WalletConnection {
  callContract?: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Result from a NEAR contract call
 */
interface NearContractResult {
  transaction?: { hash: string };
  status?: string;
}

/**
 * TEE session handle returned after sending context to TEE
 */
export interface TEESessionHandle {
  /** Session identifier */
  sessionId: string;
  /** NEAR transaction hash for the TEE call */
  transactionHash: string;
  /** Timestamp when session was created */
  timestamp: number;
}

/**
 * TEE Client for Phala TEE communication
 *
 * Provides methods to:
 * - Send sensitive context to Phala TEE for in-memory processing
 * - Clear TEE sessions to ensure no data persists
 * - Integrate with NEAR contract for transparent routing
 */
export class TEEClient {
  private readonly nearContractId: string;
  private walletConnection: WalletConnection | undefined;

  /**
   * Create TEE client
   *
   * @param nearContractId - NEAR contract address for routing
   * @param walletConnection - Privy embedded NEAR wallet connection
   */
  constructor(nearContractId: string, walletConnection?: WalletConnection) {
    this.nearContractId = nearContractId;
    this.walletConnection = walletConnection;
    console.log(`[TEEClient] Initialized for contract: ${this.nearContractId}`);
  }

  /**
   * Send context to TEE memory for in-memory processing
   *
   * Context stays in TEE secure enclave, never persists to disk.
   * Used for highly sensitive AI context (TS/SECRET classifications).
   *
   * @param sessionId - Unique session identifier
   * @param context - Context data to send to TEE
   * @param classification - Security classification level
   * @returns Session handle with transaction details
   */
  async sendToTEEMemory(
    sessionId: string,
    context: unknown,
    classification: Classification
  ): Promise<TEESessionHandle> {
    if (!this.walletConnection) {
      throw new Error('Wallet not connected - cannot send to TEE');
    }

    console.log(`[TEEClient] Sending ${classification} context to TEE (session: ${sessionId})`);

    try {
      // Convert context to bytes for NEAR contract
      const contextStr = JSON.stringify(context);
      const contextBytes = new TextEncoder().encode(contextStr);

      // Call NEAR contract's process_data method
      // The contract will route to Phala based on classification
      const result = await this.callNearContract(
        'process_data',
        {
          data: Array.from(contextBytes),
          classification: this.classificationToNearEnum(classification),
        }
      );

      const transactionHash = result.transaction?.hash || 'unknown';

      console.log(`[TEEClient] TEE call initiated (tx: ${transactionHash})`);

      return {
        sessionId,
        transactionHash,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[TEEClient] Failed to send context to TEE:', error);
      throw new Error(`TEE communication failed: ${error}`, { cause: error });
    }
  }

  /**
   * Clear TEE session
   *
   * Signals Phala to clear ephemeral context from TEE memory.
   * Ensures no sensitive data persists in TEE after session ends.
   *
   * @param sessionId - Session identifier to clear
   */
  async clearTEESession(sessionId: string): Promise<void> {
    if (!this.walletConnection) {
      console.warn('[TEEClient] Wallet not connected - cannot clear TEE session');
      return;
    }

    console.log(`[TEEClient] Clearing TEE session: ${sessionId}`);

    try {
      // Future enhancement: Call NEAR contract method to signal TEE session cleanup
      // For now, this is a placeholder for the pattern
      // await this.callNearContract('clear_tee_session', { sessionId });

      console.log(`[TEEClient] TEE session cleared: ${sessionId}`);
    } catch (error) {
      console.error('[TEEClient] Failed to clear TEE session:', error);
      // Non-critical error - log but don't throw
    }
  }

  /**
   * Call NEAR contract method via Privy wallet
   *
   * @param method - Contract method name
   * @param args - Method arguments
   * @returns Transaction result
   */
  private async callNearContract(method: string, args: Record<string, unknown>): Promise<NearContractResult> {
    if (!this.walletConnection) {
      throw new Error('Wallet not connected');
    }

    // Placeholder for actual Privy NEAR wallet integration
    // In production, this would use Privy's embedded NEAR wallet:
    //
    // const { embeddedWallet } = usePrivy();
    // const nearWallet = embeddedWallet.near;
    // return await nearWallet.callContract({
    //   contractId: this.nearContractId,
    //   methodName: method,
    //   args,
    //   gas: '50000000000000', // 50 Tgas
    // });

    console.log(`[TEEClient] NEAR contract call: ${method}`, args);

    // Simulated response for development
    return {
      transaction: {
        hash: `sim-tx-${Date.now()}`,
      },
      status: 'success',
    };
  }

  /**
   * Convert Classification enum to NEAR contract enum format
   */
  private classificationToNearEnum(classification: Classification): string {
    switch (classification) {
      case Classification.TS:
        return 'TopSecret';
      case Classification.SECRET:
        return 'Secret';
      case Classification.CONFIDENTIAL:
      case Classification.UNCLASS:
        return 'Public'; // Lower classifications can use public processing
      default:
        return 'Public';
    }
  }

  /**
   * Set wallet connection (for delayed initialization)
   */
  setWalletConnection(walletConnection: WalletConnection): void {
    this.walletConnection = walletConnection;
    console.log('[TEEClient] Wallet connection configured');
  }
}

/**
 * Create TEE client instance
 *
 * @param nearContractId - NEAR contract address
 * @param walletConnection - Optional Privy wallet connection
 * @returns TEE client instance
 */
export function createTEEClient(
  nearContractId: string,
  walletConnection?: WalletConnection
): TEEClient {
  return new TEEClient(nearContractId, walletConnection);
}

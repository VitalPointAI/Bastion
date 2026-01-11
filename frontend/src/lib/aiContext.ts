/**
 * AI Context Security Manager
 *
 * Manages AI context data with classification-based persistence and ephemeral handling.
 * Implements security patterns for handling sensitive AI training data and context.
 *
 * Classification levels:
 * - TS (Top Secret): Ephemeral only, never persisted, memory-only or TEE memory
 * - SECRET: Ephemeral only, never persisted, memory-only or TEE memory
 * - CONFIDENTIAL: Encrypted before any storage, session-based
 * - UNCLASS: Can be persisted normally (not yet implemented)
 */

import { encryptData, decryptData } from './encryption.js';

/**
 * Classification levels for AI context data
 */
export const Classification = {
  /** Top Secret - Most sensitive, ephemeral only */
  TS: 'TS',
  /** Secret - Highly sensitive, ephemeral only */
  SECRET: 'SECRET',
  /** Confidential - Sensitive, encrypted storage allowed */
  CONFIDENTIAL: 'CONFIDENTIAL',
  /** Unclassified - Normal handling */
  UNCLASS: 'UNCLASS',
} as const;

export type Classification = typeof Classification[keyof typeof Classification];

/**
 * Context entry with metadata
 */
export interface ContextEntry {
  /** Context data (may be encrypted) */
  data: any;
  /** Classification level */
  classification: Classification;
  /** Timestamp when context was added */
  timestamp: number;
  /** Session ID */
  sessionId: string;
}

/**
 * Encrypted context entry for CONFIDENTIAL data
 */
export interface EncryptedContext {
  /** Encrypted data (base64) */
  encrypted: string;
  /** Encryption nonce (hex) */
  nonce: string;
  /** Encryption key (hex) - stored in session storage */
  key: string;
  /** Classification level */
  classification: Classification;
  /** Timestamp */
  timestamp: number;
  /** Session ID */
  sessionId: string;
}

/**
 * AI Context Manager
 *
 * Handles classification-based storage and retrieval of AI context data:
 * - TS/SECRET: In-memory only (ephemeral), cleared on session end
 * - CONFIDENTIAL: Encrypted and stored in session storage
 * - UNCLASS: Normal storage (not yet implemented)
 */
export class AIContextManager {
  /**
   * Ephemeral context storage (in-memory only)
   * Used for TS and SECRET classifications
   * Key: sessionId, Value: context entry
   */
  private ephemeralContext: Map<string, ContextEntry>;

  /**
   * Encrypted context storage (session-based)
   * Used for CONFIDENTIAL classification
   * Key: sessionId, Value: encrypted context entry
   */
  private encryptedContext: Map<string, EncryptedContext>;

  constructor() {
    this.ephemeralContext = new Map();
    this.encryptedContext = new Map();
  }

  /**
   * Add context to appropriate storage based on classification
   *
   * @param sessionId - Unique session identifier
   * @param context - Context data to store
   * @param classification - Security classification level
   */
  async addContext(
    sessionId: string,
    context: any,
    classification: Classification
  ): Promise<void> {
    const timestamp = Date.now();

    switch (classification) {
      case Classification.TS:
      case Classification.SECRET:
        // Store in ephemeral memory only
        this.ephemeralContext.set(sessionId, {
          data: context,
          classification,
          timestamp,
          sessionId,
        });
        console.log(`[AIContext] Added ${classification} context to ephemeral storage (session: ${sessionId})`);
        break;

      case Classification.CONFIDENTIAL:
        // Encrypt and store in session storage
        await this.addEncryptedContext(sessionId, context, classification, timestamp);
        console.log(`[AIContext] Added CONFIDENTIAL context to encrypted storage (session: ${sessionId})`);
        break;

      case Classification.UNCLASS:
        // For now, treat as CONFIDENTIAL (future: implement normal storage)
        await this.addEncryptedContext(sessionId, context, classification, timestamp);
        console.log(`[AIContext] Added UNCLASS context to encrypted storage (session: ${sessionId})`);
        break;
    }
  }

  /**
   * Add encrypted context entry
   */
  private async addEncryptedContext(
    sessionId: string,
    context: any,
    classification: Classification,
    timestamp: number
  ): Promise<void> {
    // Encrypt context data
    const contextStr = JSON.stringify(context);
    const { encrypted, nonce, key } = await encryptData(contextStr);

    // Store encrypted context
    this.encryptedContext.set(sessionId, {
      encrypted,
      nonce,
      key,
      classification,
      timestamp,
      sessionId,
    });
  }

  /**
   * Get context from appropriate storage based on classification
   *
   * @param sessionId - Session identifier
   * @param classification - Expected classification level
   * @returns Context data or null if not found or access denied
   */
  async getContext(
    sessionId: string,
    classification: Classification
  ): Promise<any | null> {
    switch (classification) {
      case Classification.TS:
      case Classification.SECRET:
        // Retrieve from ephemeral storage
        const ephemeralEntry = this.ephemeralContext.get(sessionId);
        if (!ephemeralEntry) {
          console.warn(`[AIContext] No ephemeral context found for session: ${sessionId}`);
          return null;
        }
        if (ephemeralEntry.classification !== classification) {
          console.error(`[AIContext] Classification mismatch for session: ${sessionId}`);
          return null;
        }
        return ephemeralEntry.data;

      case Classification.CONFIDENTIAL:
      case Classification.UNCLASS:
        // Retrieve and decrypt from encrypted storage
        return await this.getEncryptedContext(sessionId);
    }
  }

  /**
   * Get and decrypt encrypted context entry
   */
  private async getEncryptedContext(sessionId: string): Promise<any | null> {
    const encryptedEntry = this.encryptedContext.get(sessionId);
    if (!encryptedEntry) {
      console.warn(`[AIContext] No encrypted context found for session: ${sessionId}`);
      return null;
    }

    try {
      // Decrypt context
      const decryptedStr = await decryptData(
        encryptedEntry.encrypted,
        encryptedEntry.key,
        encryptedEntry.nonce
      );
      return JSON.parse(decryptedStr);
    } catch (error) {
      console.error(`[AIContext] Failed to decrypt context for session: ${sessionId}`, error);
      return null;
    }
  }

  /**
   * Clear session context
   *
   * Explicitly removes all context data for a session:
   * - Clears ephemeral data from memory
   * - Clears encrypted session data
   * - Future: Notify TEE to clear session
   *
   * @param sessionId - Session identifier to clear
   */
  clearSession(sessionId: string): void {
    // Clear ephemeral context
    const hadEphemeral = this.ephemeralContext.delete(sessionId);

    // Clear encrypted context
    const hadEncrypted = this.encryptedContext.delete(sessionId);

    if (hadEphemeral || hadEncrypted) {
      console.log(`[AIContext] Cleared session: ${sessionId} (ephemeral: ${hadEphemeral}, encrypted: ${hadEncrypted})`);
    } else {
      console.warn(`[AIContext] No context found to clear for session: ${sessionId}`);
    }

    // Future enhancement: Notify TEE to clear session
    // await teeClient.clearTEESession(sessionId);
  }

  /**
   * Clear all sessions
   *
   * Useful for logout or security cleanup
   */
  clearAllSessions(): void {
    const ephemeralCount = this.ephemeralContext.size;
    const encryptedCount = this.encryptedContext.size;

    this.ephemeralContext.clear();
    this.encryptedContext.clear();

    console.log(`[AIContext] Cleared all sessions (ephemeral: ${ephemeralCount}, encrypted: ${encryptedCount})`);
  }

  /**
   * Get session count by classification
   */
  getSessionStats(): {
    ephemeral: number;
    encrypted: number;
    total: number;
  } {
    return {
      ephemeral: this.ephemeralContext.size,
      encrypted: this.encryptedContext.size,
      total: this.ephemeralContext.size + this.encryptedContext.size,
    };
  }
}

/**
 * Global AI context manager instance
 */
export const aiContextManager = new AIContextManager();

/**
 * Migration Service - DID Re-encryption
 *
 * Phase 1.2 Plan 06: DID migration between different secret derivation methods
 *
 * CRITICAL: This service handles migrating DIDs when userSecret derivation
 * changes while preserving DID document content and user access.
 *
 * USE CASES:
 * 1. Upgrading from one secret derivation method to another
 * 2. Migrating from legacy auth systems
 * 3. Security-mandated secret rotation
 *
 * Migration flow:
 * 1. User authenticates with old method
 * 2. System derives old userSecret
 * 3. User authenticates with new method
 * 4. System receives new userSecret (e.g., PRF output from passkey)
 * 5. DID is decrypted with old secret, re-encrypted with new
 * 6. User marked as migrated (migration complete flag)
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { DIDService, getDIDService } from '../identity/did-service.js';
import { UserStore, getUserStore } from './user-store.js';
import { PasskeyStore, getPasskeyStore } from './passkey-store.js';
import type { DIDDocument } from '../identity/types.js';

export interface MigrationStatus {
  userId: string;
  email: string;
  nearAccountId: string | null;
  hasDID: boolean;
  passkeyRegistered: boolean;
  migrationNeeded: boolean;
  prfCapable: boolean;
}

export interface MigrationResult {
  success: boolean;
  didPreserved: boolean;
  newAccountId?: string;
  error?: string;
}

export class MigrationService {
  private userStore: UserStore;
  private passkeyStore: PasskeyStore;
  private didService: DIDService;

  constructor() {
    this.userStore = getUserStore();
    this.passkeyStore = getPasskeyStore();
    this.didService = getDIDService();
  }

  /**
   * Derive user secret from a custom method
   *
   * EXAMPLE: If migrating from an external auth provider
   * This demonstrates the pattern for old secret derivation.
   *
   * @param context - Context string for HKDF (e.g., "legacy-auth-v1")
   * @param identifier - User identifier from old system
   */
  async deriveLegacyUserSecret(
    context: string,
    identifier: string
  ): Promise<Uint8Array> {
    const salt = utf8ToBytes('bastion-user-secret');
    const info = utf8ToBytes(context);
    const ikm = utf8ToBytes(identifier);

    return hkdf(sha256, ikm, salt, info, 32);
  }

  /**
   * Get migration status for a user
   */
  async getMigrationStatus(email: string): Promise<MigrationStatus | null> {
    const user = await this.userStore.findByEmail(email);
    if (!user) return null;

    const passkeys = await this.passkeyStore.findByUserId(user.id);
    const prfCapable = await this.passkeyStore.hasPrfCapableCredential(user.id);

    // Check if DID exists (we check with current method, assuming PRF-based)
    // In a real migration scenario, you'd check with the OLD derivation method
    const hasDID = user.nearAccountId
      ? await this.checkDIDExists(user.nearAccountId, user.id)
      : false;

    return {
      userId: user.id,
      email: user.email,
      nearAccountId: user.nearAccountId ?? null,
      hasDID,
      passkeyRegistered: user.passkeyRegistered,
      migrationNeeded: false, // Set to true if migration criteria met
      prfCapable,
    };
  }

  /**
   * Check if DID exists for account
   * Uses current secret derivation method
   */
  private async checkDIDExists(
    accountId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // For this check, we use a dummy secret derivation
      // In practice, you'd use the current/expected secret
      const testSecret = await this.deriveLegacyUserSecret(
        'test-check-v1',
        userId
      );
      return await this.didService.isDIDActive(accountId, testSecret);
    } catch {
      return false;
    }
  }

  /**
   * Migrate user's DID from old secret to new secret
   *
   * CRITICAL: This is the core migration logic that preserves DID access.
   *
   * @param email - User email
   * @param oldSecret - Secret derived from old authentication method
   * @param newSecret - Secret derived from new authentication method (e.g., PRF)
   * @param newAccountId - New NEAR account ID (from MPC with UUID-based derivation)
   */
  async migrateDID(
    email: string,
    oldSecret: Uint8Array,
    newSecret: Uint8Array,
    newAccountId: string
  ): Promise<MigrationResult> {
    // Find user
    const user = await this.userStore.findByEmail(email);
    if (!user) {
      return { success: false, didPreserved: false, error: 'User not found' };
    }

    if (!user.nearAccountId) {
      // No existing NEAR account - nothing to migrate
      await this.userStore.updateNearAccountId(user.id, newAccountId);
      return { success: true, didPreserved: false, newAccountId };
    }

    try {
      // Step 1: Resolve existing DID with old secret
      const existingDID = await this.didService.resolveDID(
        user.nearAccountId,
        oldSecret
      );

      if (!existingDID) {
        // No DID to migrate
        console.log('No existing DID found for migration');
        await this.userStore.updateNearAccountId(user.id, newAccountId);
        return { success: true, didPreserved: false, newAccountId };
      }

      console.log('Migrating DID:', existingDID.id);

      // Step 2: Check if old and new account IDs are the same
      if (user.nearAccountId === newAccountId) {
        // Same account - need to re-encrypt DID with new secret
        console.log('Same account ID - re-encrypting DID in place');

        // For same-account migration:
        // 1. Store the DID document data
        // 2. Create new encrypted DID with new secret
        // 3. The old encrypted DID becomes inaccessible (expected)

        // Extract key info from existing DID
        const publicKeyBase58 = existingDID.publicKey?.[0]?.publicKeyBase58 || '';

        // Create new DID entry with new secret
        // This overwrites the old blinded key entry on-chain
        await this.didService.createDID(
          newAccountId,
          existingDID.entityType,
          newSecret,
          publicKeyBase58
        );

        console.log('DID re-encrypted with new secret');
      } else {
        // Different account IDs
        console.log('Account ID changed:', user.nearAccountId, '->', newAccountId);
        console.log('Creating new DID with new account');

        // Extract key info from existing DID
        const publicKeyBase58 = existingDID.publicKey?.[0]?.publicKeyBase58 || '';

        // Create new DID with new account ID and new secret
        await this.didService.createDID(
          newAccountId,
          existingDID.entityType,
          newSecret,
          publicKeyBase58
        );
      }

      // Step 3: Update user record
      await this.userStore.updateNearAccountId(user.id, newAccountId);

      return {
        success: true,
        didPreserved: true,
        newAccountId,
      };
    } catch (error) {
      console.error('DID migration failed:', error);
      return {
        success: false,
        didPreserved: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      };
    }
  }

  /**
   * Check if user needs migration
   * This is a placeholder - override with actual migration criteria
   */
  async needsMigration(email: string): Promise<boolean> {
    const status = await this.getMigrationStatus(email);
    if (!status) return false;

    // Example criteria:
    // - User has DID but no PRF-capable passkey
    // - User is on legacy auth system
    return status.hasDID && !status.prfCapable;
  }
}

// Singleton
let instance: MigrationService | null = null;
export function getMigrationService(): MigrationService {
  if (!instance) {
    instance = new MigrationService();
  }
  return instance;
}

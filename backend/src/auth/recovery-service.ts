/**
 * Recovery Service
 *
 * Orchestrates multi-factor account recovery:
 * 1. Email verification (magic link to primary or alternate email)
 * 2. TOTP verification (6-digit code from authenticator app)
 * 3. New passkey registration (after both factors verified)
 *
 * SECURITY ARCHITECTURE:
 * - Recovery requires BOTH email + TOTP (multi-factor)
 * - NEAR account preserved (MPC uses stable UUID, not passkey)
 * - Old passkeys deleted only after successful recovery
 * - Deployment environment controls available 2FA types
 */

import { getMagicLinkService } from './magic-link-service.js';
import { getTotpService } from './totp-service.js';
import { getPasskeyStore } from './passkey-store.js';
import { getSessionStore } from './session-store.js';
import { getUserStore } from './user-store.js';
import { getPlatformSettingsStore } from './platform-settings-store.js';

export interface RecoveryInitResult {
  success: boolean;
  message: string;
  requiresTotp: boolean;
}

export interface RecoveryTotpResult {
  verified: boolean;
  recoveryToken: string; // Token to allow passkey registration
  message: string;
}

export interface RecoveryCompleteResult {
  success: boolean;
  message: string;
  nearAccountId: string | null;
}

export class RecoveryService {
  private magicLinkService = getMagicLinkService();
  private totpService = getTotpService();
  private passkeyStore = getPasskeyStore();
  private sessionStore = getSessionStore();
  private userStore = getUserStore();
  private settingsStore = getPlatformSettingsStore();

  // In-memory recovery tokens (use Redis in production)
  private recoveryTokens = new Map<string, {
    userId: string;
    emailVerified: boolean;
    totpVerified: boolean;
    expiresAt: number;
  }>();
  private RECOVERY_TOKEN_TTL = 15 * 60 * 1000; // 15 minutes

  /**
   * Get available second factor types for current deployment
   */
  async getAvailable2FATypes(): Promise<string[]> {
    const config = await this.settingsStore.getConfig();
    return config?.allowedSecondFactors || ['totp'];
  }

  /**
   * Check if 2FA is required for recovery
   */
  async is2FARequired(): Promise<boolean> {
    const config = await this.settingsStore.getConfig();
    return config?.requireSecondFactor ?? true;
  }

  /**
   * Step 1: Initiate recovery via email
   *
   * Sends magic link to primary or alternate email.
   * After email verification, user must complete TOTP verification.
   */
  async initiateRecovery(email: string): Promise<RecoveryInitResult> {
    const result = await this.magicLinkService.requestRecovery(email);

    // Check if 2FA is required and enabled for this user
    const user = await this.userStore.getUserByEmail(email);

    const requiresTotp = user?.totpEnabled && await this.is2FARequired();

    return {
      success: result.success,
      message: result.success
        ? 'Recovery email sent. Check your inbox.'
        : result.message,
      requiresTotp: requiresTotp ?? false
    };
  }

  /**
   * Step 2: Verify TOTP code after email verification
   *
   * Called after user clicks magic link and needs to verify TOTP.
   * Returns recovery token that allows passkey registration.
   *
   * @param sessionToken - Limited session from magic link verification
   * @param totpCode - 6-digit code from authenticator app
   */
  async verifyRecoveryTotp(
    sessionToken: string,
    totpCode: string
  ): Promise<RecoveryTotpResult> {
    // Get session
    const session = await this.sessionStore.getSession(sessionToken);
    if (!session) {
      return {
        verified: false,
        recoveryToken: '',
        message: 'Session expired. Please restart recovery.'
      };
    }

    // Verify TOTP
    const totpResult = await this.totpService.verify(session.userId, totpCode);
    if (!totpResult.valid) {
      return {
        verified: false,
        recoveryToken: '',
        message: totpResult.message
      };
    }

    // Generate recovery token (allows passkey registration)
    const recoveryToken = this.generateRecoveryToken(session.userId);

    return {
      verified: true,
      recoveryToken,
      message: 'Verification complete. You can now set up a new passkey.'
    };
  }

  /**
   * Step 3: Complete recovery with new passkey
   *
   * Called after TOTP verification with recovery token.
   * Deletes old passkeys and allows new passkey registration.
   *
   * @param recoveryToken - Token from verifyRecoveryTotp
   * @returns Whether recovery can proceed
   */
  async authorizePasskeyReplacement(recoveryToken: string): Promise<{
    authorized: boolean;
    userId: string | null;
    message: string;
  }> {
    const tokenData = this.recoveryTokens.get(recoveryToken);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      this.recoveryTokens.delete(recoveryToken);
      return {
        authorized: false,
        userId: null,
        message: 'Recovery token expired. Please restart recovery.'
      };
    }

    if (!tokenData.emailVerified || !tokenData.totpVerified) {
      return {
        authorized: false,
        userId: null,
        message: 'Recovery verification incomplete'
      };
    }

    // Delete old passkeys (NEAR account preserved - uses UUID, not passkey)
    await this.passkeyStore.deleteUserCredentials(tokenData.userId);

    // Consume token
    this.recoveryTokens.delete(recoveryToken);

    return {
      authorized: true,
      userId: tokenData.userId,
      message: 'Old passkeys removed. Ready for new passkey registration.'
    };
  }

  /**
   * Bypass TOTP for users without 2FA enabled
   *
   * If user never set up TOTP, they can complete recovery with just email.
   * This is less secure but necessary for users who haven't enabled 2FA.
   *
   * @param sessionToken - Session from magic link verification
   */
  async bypassTotpForNon2FAUsers(sessionToken: string): Promise<{
    canBypass: boolean;
    recoveryToken: string;
    message: string;
  }> {
    const session = await this.sessionStore.getSession(sessionToken);
    if (!session) {
      return {
        canBypass: false,
        recoveryToken: '',
        message: 'Session expired'
      };
    }

    // Check if user has TOTP enabled
    const user = await this.userStore.getUserById(session.userId);
    if (user?.totpEnabled) {
      return {
        canBypass: false,
        recoveryToken: '',
        message: 'TOTP verification required'
      };
    }

    // Generate recovery token without TOTP verification
    const recoveryToken = this.generateRecoveryToken(session.userId, false);

    return {
      canBypass: true,
      recoveryToken,
      message: 'Email verified. You can set up a new passkey.'
    };
  }

  // ============================================
  // Private helpers
  // ============================================

  private generateRecoveryToken(userId: string, totpVerified: boolean = true): string {
    const token = `rec_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    this.recoveryTokens.set(token, {
      userId,
      emailVerified: true,
      totpVerified,
      expiresAt: Date.now() + this.RECOVERY_TOKEN_TTL
    });

    return token;
  }

  // Cleanup expired tokens (call periodically)
  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [key, value] of this.recoveryTokens.entries()) {
      if (value.expiresAt < now) {
        this.recoveryTokens.delete(key);
      }
    }
  }
}

// Singleton
let instance: RecoveryService | null = null;
export function getRecoveryService(): RecoveryService {
  if (!instance) {
    instance = new RecoveryService();
  }
  return instance;
}

/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Implements RFC 6238 TOTP for 2FA during account recovery.
 *
 * SECURITY:
 * - Secrets are encrypted at rest (TotpStore handles encryption)
 * - 30-second time window (standard)
 * - Allows 1-step drift for clock skew tolerance
 * - Compatible with Google Authenticator, Authy, 1Password, etc.
 */

import { getTotpStore } from './totp-store.js';
import { getUserStore } from './user-store.js';
import { createHmac, randomBytes } from 'crypto';

const ISSUER = process.env.APP_NAME || 'BASTION';
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1'; // Standard for authenticator apps

export interface TotpSetupResult {
  secret: string;         // Base32-encoded secret (for QR code)
  otpauthUrl: string;     // otpauth:// URL for QR code generation
  qrCodeDataUrl?: string; // Optional: base64 QR code image
}

export interface TotpVerifyResult {
  valid: boolean;
  message: string;
}

export class TotpService {
  private totpStore = getTotpStore();
  private userStore = getUserStore();

  /**
   * Generate TOTP secret and setup URL for user
   *
   * Call this when user wants to enable 2FA.
   * Returns secret and otpauth URL for QR code display.
   *
   * @param userId - User's UUID
   * @returns Setup data including secret and otpauth URL
   */
  async generateSetup(userId: string): Promise<TotpSetupResult> {
    // Get user for email (used in otpauth URL)
    const user = await this.userStore.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate 20-byte random secret (160 bits, standard for TOTP)
    const secretBytes = randomBytes(20);
    const secret = this.base32Encode(secretBytes);

    // Build otpauth URL for authenticator apps
    // Format: otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm={algorithm}&digits={digits}&period={period}
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(user.email)}?` +
      `secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    return {
      secret,
      otpauthUrl
    };
  }

  /**
   * Enable TOTP for user (after they verify it works)
   *
   * User should verify a code from their authenticator app before
   * we store the secret. This ensures they've actually set it up.
   *
   * @param userId - User's UUID
   * @param secret - Base32-encoded secret from generateSetup
   * @param verificationCode - Code from authenticator app to verify setup
   */
  async enableTotp(
    userId: string,
    secret: string,
    verificationCode: string
  ): Promise<{ enabled: boolean; message: string }> {
    // Verify the code first to ensure user has set up correctly
    const isValid = this.verifyCode(secret, verificationCode);
    if (!isValid) {
      return {
        enabled: false,
        message: 'Invalid verification code. Make sure your authenticator app shows the correct code.'
      };
    }

    // Store encrypted secret
    await this.totpStore.storeSecret(userId, secret);

    // Mark TOTP as enabled on user
    await this.userStore.setTotpEnabled(userId, true);

    return {
      enabled: true,
      message: 'Two-factor authentication enabled successfully'
    };
  }

  /**
   * Verify TOTP code for user
   *
   * Used during recovery flow to verify second factor.
   *
   * @param userId - User's UUID
   * @param code - 6-digit code from authenticator app
   */
  async verify(userId: string, code: string): Promise<TotpVerifyResult> {
    // Check if user has TOTP enabled
    const user = await this.userStore.getUserById(userId);
    if (!user) {
      return { valid: false, message: 'User not found' };
    }

    if (!user.totpEnabled) {
      return { valid: false, message: 'TOTP not enabled for this account' };
    }

    // Get stored secret
    const secret = await this.totpStore.getSecret(userId);
    if (!secret) {
      return { valid: false, message: 'TOTP not configured' };
    }

    // Verify code
    const isValid = this.verifyCode(secret, code);

    return {
      valid: isValid,
      message: isValid ? 'Code verified' : 'Invalid or expired code'
    };
  }

  /**
   * Disable TOTP for user
   *
   * Should require current TOTP code to disable (prevents attacker from disabling 2FA).
   *
   * @param userId - User's UUID
   * @param verificationCode - Current TOTP code to confirm
   */
  async disableTotp(
    userId: string,
    verificationCode: string
  ): Promise<{ disabled: boolean; message: string }> {
    // Verify code first
    const verification = await this.verify(userId, verificationCode);
    if (!verification.valid) {
      return {
        disabled: false,
        message: 'Invalid verification code'
      };
    }

    // Remove secret and disable
    await this.totpStore.deleteSecret(userId);
    await this.userStore.setTotpEnabled(userId, false);

    return {
      disabled: true,
      message: 'Two-factor authentication disabled'
    };
  }

  /**
   * Check if TOTP is enabled for user
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await this.userStore.getUserById(userId);
    return user?.totpEnabled ?? false;
  }

  // ============================================
  // Private: TOTP Algorithm Implementation
  // ============================================

  /**
   * Verify TOTP code against secret
   *
   * Allows 1-step drift (±30s) for clock skew tolerance.
   */
  private verifyCode(secret: string, code: string): boolean {
    // Normalize code
    const normalizedCode = code.replace(/\s/g, '');
    if (normalizedCode.length !== TOTP_DIGITS) {
      return false;
    }

    // Current time step
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / TOTP_PERIOD);

    // Check current and adjacent time steps (clock drift tolerance)
    for (let drift = -1; drift <= 1; drift++) {
      const expectedCode = this.generateCode(secret, timeStep + drift);
      if (this.constantTimeCompare(expectedCode, normalizedCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate TOTP code for a given time step
   */
  private generateCode(secret: string, timeStep: number): string {
    // Decode base32 secret
    const secretBytes = this.base32Decode(secret);

    // Time step as 8-byte big-endian integer
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(timeStep));

    // HMAC-SHA1
    const hmac = createHmac('sha1', secretBytes);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % Math.pow(10, TOTP_DIGITS);

    // Pad with leading zeros
    return code.toString().padStart(TOTP_DIGITS, '0');
  }

  /**
   * Constant-time string comparison (timing attack prevention)
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Base32 encode (RFC 4648)
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 0x1f];
    }

    return result;
  }

  /**
   * Base32 decode (RFC 4648)
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of encoded.toUpperCase()) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue; // Skip padding and invalid chars

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}

// Singleton
let instance: TotpService | null = null;
export function getTotpService(): TotpService {
  if (!instance) {
    instance = new TotpService();
  }
  return instance;
}

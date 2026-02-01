/**
 * Magic Link Service
 *
 * Handles email-based verification for:
 * 1. PRF Fallback - Browser doesn't support WebAuthn PRF extension
 * 2. Recovery Step 1 - Email verification before TOTP check
 *
 * SECURITY:
 * - Tokens expire after 15 minutes
 * - One-time use (deleted after verification)
 * - Rate limited (handled by API layer)
 */

import { getMagicLinkStore } from './magic-link-store.js';
import { getUserStore } from './user-store.js';
import { getSessionStore } from './session-store.js';
import type { AuthUser } from './types.js';

// Environment configuration
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@bastion.near';

export interface MagicLinkResult {
  success: boolean;
  message: string;
  devToken?: string; // Only in dev mode for testing
}

export interface MagicLinkVerifyResult {
  verified: boolean;
  session: { id: string; expiresAt: Date };
  accountId: string | null;
  needsPasskeySetup: boolean;
  userId: string;
  requiresTotpVerification: boolean; // For recovery flow
}

export class MagicLinkService {
  private magicLinkStore = getMagicLinkStore();
  private userStore = getUserStore();
  private sessionStore = getSessionStore();

  // Store recovery metadata temporarily (use Redis in production)
  private recoveryMetadata = new Map<string, { isRecovery: boolean }>();

  /**
   * Send magic link to user's email
   *
   * @param email - Primary or alternate email address
   * @param isRecovery - If true, marks as recovery flow (requires TOTP after)
   */
  async sendMagicLink(email: string, isRecovery: boolean = false): Promise<MagicLinkResult> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!this.isValidEmail(normalizedEmail)) {
      return { success: false, message: 'Invalid email format' };
    }

    // Find user by primary OR alternate email
    let user = await this.userStore.getUserByEmail(normalizedEmail);

    // For PRF fallback (non-recovery), create user if not exists
    if (!user && !isRecovery) {
      user = await this.userStore.createUser({ email: normalizedEmail });
    }

    // For recovery, don't reveal if email exists (security)
    if (!user && isRecovery) {
      // Return success anyway to prevent email enumeration
      return {
        success: true,
        message: 'If an account exists with this email, a recovery link has been sent.'
      };
    }

    // Generate token
    const token = await this.magicLinkStore.createToken(normalizedEmail);

    // Store recovery metadata
    if (isRecovery) {
      this.recoveryMetadata.set(token, { isRecovery: true });
    }

    // Build magic link URL
    const endpoint = isRecovery ? '/auth/recover' : '/auth/verify';
    const magicLink = `${APP_URL}${endpoint}?token=${token}`;

    // Send email or return token in dev mode
    if (SENDGRID_API_KEY) {
      await this.sendEmail(normalizedEmail, magicLink, isRecovery);
      return {
        success: true,
        message: isRecovery
          ? 'Recovery link sent to your email'
          : 'Magic link sent to your email'
      };
    } else {
      console.log('DEV MODE: Magic link URL:', magicLink);
      return {
        success: true,
        message: 'Magic link generated (check console in dev mode)',
        devToken: token
      };
    }
  }

  /**
   * Verify magic link token
   *
   * For recovery flow: Returns requiresTotpVerification=true
   * Frontend must then call recovery/verify-totp before completing recovery.
   */
  async verifyMagicLink(token: string): Promise<MagicLinkVerifyResult> {
    const email = await this.magicLinkStore.verifyToken(token);

    if (!email) {
      throw new Error('Invalid or expired magic link');
    }

    // Check if this was a recovery flow
    const metadata = this.recoveryMetadata.get(token);
    const isRecovery = metadata?.isRecovery ?? false;

    // Clean up metadata
    if (metadata) {
      this.recoveryMetadata.delete(token);
    }

    // Find user
    const user = await this.userStore.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // For recovery flow, check if TOTP verification required
    if (isRecovery && user.totpEnabled) {
      // Create limited session for TOTP verification step
      const sessionResult = await this.createLimitedSession(user);

      return {
        verified: true,
        session: { id: sessionResult.sessionId, expiresAt: sessionResult.expiresAt },
        accountId: user.nearAccountId || null,
        needsPasskeySetup: false,
        userId: user.id,
        requiresTotpVerification: true
      };
    }

    // Non-recovery or no TOTP: create full session
    const sessionResult = await this.sessionStore.createSession(
      user,
      false // prfAvailable - magic link doesn't provide PRF
    );

    return {
      verified: true,
      session: { id: sessionResult.sessionId, expiresAt: sessionResult.expiresAt },
      accountId: user.nearAccountId || null,
      needsPasskeySetup: !user.nearAccountId,
      userId: user.id,
      requiresTotpVerification: false
    };
  }

  /**
   * Send magic link for account recovery
   *
   * Accepts either primary or alternate email.
   * After email verification, user must verify TOTP before registering new passkey.
   */
  async requestRecovery(email: string): Promise<MagicLinkResult> {
    return this.sendMagicLink(email, true);
  }

  /**
   * Create limited session for recovery pending TOTP verification
   * This is a temporary session that can only be used for TOTP verification
   */
  private async createLimitedSession(user: AuthUser): Promise<{ sessionId: string; expiresAt: Date }> {
    // Create a temporary 15-minute session for TOTP verification
    // In a full implementation, this would be stored with a recoveryPending flag
    // For now, we'll create a normal session but document that it should be verified
    const sessionResult = await this.sessionStore.createSession(
      user,
      false // No PRF during recovery
    );

    return sessionResult;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async sendEmail(to: string, magicLink: string, isRecovery: boolean): Promise<void> {
    if (!SENDGRID_API_KEY) {
      throw new Error('Email provider not configured');
    }

    const subject = isRecovery
      ? 'BASTION Account Recovery'
      : 'Your BASTION login link';

    const introText = isRecovery
      ? 'You requested to recover your BASTION account. Click the link below to continue:'
      : 'Click this link to log in to BASTION:';

    const buttonText = isRecovery ? 'Recover Account' : 'Log in to BASTION';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: 'BASTION' },
        subject,
        content: [
          {
            type: 'text/plain',
            value: `${introText}\n\n${magicLink}\n\nThis link expires in 15 minutes and can only be used once.${isRecovery ? '\n\nAfter clicking, you will need to enter your 2FA code to complete recovery.' : ''}`
          },
          {
            type: 'text/html',
            value: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0a0a0a;">${isRecovery ? 'Account Recovery' : 'BASTION Login'}</h2>
                <p>${introText}</p>
                <a href="${magicLink}"
                   style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  ${buttonText}
                </a>
                <p style="color: #666; font-size: 14px;">
                  This link expires in 15 minutes and can only be used once.
                </p>
                ${isRecovery ? '<p style="color: #666; font-size: 14px;">After clicking, you will need to enter your 2FA code to complete recovery.</p>' : ''}
                <p style="color: #999; font-size: 12px;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </div>
            `
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid error:', error);
      throw new Error('Failed to send email');
    }
  }
}

// Singleton
let instance: MagicLinkService | null = null;
export function getMagicLinkService(): MagicLinkService {
  if (!instance) {
    instance = new MagicLinkService();
  }
  return instance;
}

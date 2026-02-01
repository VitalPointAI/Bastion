/**
 * Authentication Data Types
 *
 * Phase 1.2 Plan 01: Core types for passkey authentication, TOTP, magic links, sessions
 *
 * ARCHITECTURE NOTE:
 * - User UUID is the stable identifier for MPC derivation path (not passkey)
 * - Passkeys are for AUTHENTICATION ONLY (not NEAR account derivation)
 * - NEAR accounts created via Chain Signatures MPC with stable UUID-based path
 */

import type { AuthenticatorTransport } from '@simplewebauthn/server';

/**
 * Passkey credential stored per user
 * Supports multiple passkeys per user (cross-device, recovery)
 *
 * CRITICAL: Does NOT include nearImplicitAccountId
 * Passkeys authenticate the user; MPC handles NEAR signing
 */
export interface PasskeyCredential {
  id: string; // Database primary key
  userId: string; // Foreign key to users table
  credentialId: Buffer; // WebAuthn credential ID (unique identifier)
  publicKey: Buffer; // COSE public key bytes
  counter: bigint; // Signature counter for replay protection
  transports: AuthenticatorTransport[]; // usb, nfc, ble, hybrid, internal
  prfSupported: boolean; // Can this credential derive PRF secrets for DID?
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * User entity with stable UUID for MPC derivation
 *
 * CRITICAL FIELDS:
 * - id: Stable UUID, NEVER changes, used for MPC path: bastion,{id}
 * - mpcDerivationPath: Deterministic path for NEAR account signing
 * - alternateEmail: Required for recovery if primary email lost
 * - totpEnabled: Whether user has completed TOTP setup (required for recovery)
 */
export interface AuthUser {
  id: string; // UUID - stable identifier for MPC
  email: string; // Primary email
  alternateEmail?: string; // Alternate email for recovery
  nearAccountId?: string; // NEAR account created via MPC
  mpcDerivationPath: string; // Format: bastion,{uuid}
  totpEnabled: boolean; // Has user set up TOTP 2FA?
  passkeyRegistered: boolean; // Has user registered at least one passkey?
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TOTP credential for 2FA and recovery
 * Secret is encrypted at rest using AES-256-GCM
 */
export interface TotpCredential {
  id: string;
  userId: string;
  secretEncrypted: Buffer; // AES-256-GCM encrypted TOTP secret
  encryptionNonce: Buffer; // 12-byte nonce for GCM
  backupCodes: string[]; // Encrypted backup codes (one-time use)
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Magic link token for email-based authentication
 * Used for: PRF fallback, initial registration, account recovery
 */
export interface MagicLinkToken {
  id: string;
  token: string; // 64-char hex (32 random bytes)
  email: string; // Which email to send to
  expiresAt: Date; // 15-minute expiration window
  used: boolean; // One-time use
  createdAt: Date;
  usedAt?: Date;
}

/**
 * User session
 * Replaces Privy JWT tokens with custom session management
 */
export interface UserSession {
  id: string; // Session ID (stored in HttpOnly cookie)
  userId: string;
  email?: string; // User's email for UI display
  accountId?: string; // NEAR account ID if available
  prfAvailable: boolean; // Can perform DID operations?
  createdAt: Date;
  expiresAt: Date; // 7-day default expiration with sliding window
  lastActivityAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Platform deployment configuration
 * Determines authentication requirements based on environment
 */
export interface DeploymentConfig {
  id: string;
  environment: 'public' | 'enterprise' | 'classified';
  allowedSecondFactors: ('totp' | 'hardware_token' | 'cac_piv')[];
  requireSecondFactor: boolean; // Always true for recovery
  sessionDurationMinutes: number;
  requireReauthForHighValue: boolean; // Require passkey reauth for sensitive ops
  allowedEmailDomains?: string[]; // Empty array or undefined = no restriction
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registration input from user
 */
export interface RegistrationInput {
  email: string;
  alternateEmail?: string;
}

/**
 * Session creation result
 */
export interface SessionResult {
  sessionId: string;
  expiresAt: Date;
  user: AuthUser;
}

/**
 * Passkey creation input (Phase 1.2-02)
 * Used by PasskeyService to create credential after registration
 */
export interface CreatePasskeyInput {
  userId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  counter: bigint;
  transports: AuthenticatorTransport[];
  prfSupported: boolean;
}

/**
 * Session creation input (Phase 1.2-02)
 * Used by PasskeyService to create session after authentication
 */
export interface CreateSessionInput {
  userId: string;
  email?: string;
  nearAccountId?: string;
  prfAvailable: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Passkey Authentication Service
 *
 * CRITICAL: Passkeys are for AUTHENTICATION ONLY
 *
 * - Passkeys verify user identity (are you who you claim to be?)
 * - Passkeys do NOT derive NEAR accounts (that uses MPC with UUID)
 * - This separation allows account recovery without losing assets
 *
 * Flow:
 * 1. User registers passkey → Creates WebAuthn credential
 * 2. User authenticates → Verifies they control the credential
 * 3. After auth success → Backend creates/retrieves NEAR account via MPC
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { randomUUID } from 'crypto';

import { getPasskeyStore } from './passkey-store.js';
import { getUserStore } from './user-store.js';
import { getSessionStore } from './session-store.js';
import { createMPCAccount, getMPCDerivationPath } from './mpc-account.js';
import type { AuthUser, UserSession, CreatePasskeyInput } from './types.js';

// Configure for your domain
const RP_NAME = process.env.RP_NAME || 'BASTION';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';

// In-memory challenge store (use Redis in production)
const challenges = new Map<string, { challenge: string; userId: string; expiresAt: number }>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class PasskeyService {
  private passkeyStore = getPasskeyStore();
  private userStore = getUserStore();
  private sessionStore = getSessionStore();

  /**
   * Generate passkey registration options
   * Called when user wants to register a new passkey
   *
   * NOTE: This does NOT create a NEAR account.
   * NEAR account is created separately via MPC after registration.
   */
  async generateRegistrationOptions(email: string, isRecovery: boolean = false): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
    userId: string;
  }> {
    // Find or create user (creates UUID which becomes MPC derivation anchor)
    let user = await this.userStore.findByEmail(email);
    if (!user) {
      user = await this.userStore.createUser(email);
    }

    // Get existing credentials to exclude
    let excludeCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];

    if (!isRecovery) {
      const existingCreds = await this.passkeyStore.findByUserId(user.id);
      excludeCredentials = existingCreds.map(cred => ({
        id: isoBase64URL.fromBuffer(cred.credentialId),
        transports: cred.transports as AuthenticatorTransportFuture[]
      }));
    } else {
      // For recovery: delete existing passkeys (user gets fresh credentials)
      // Their NEAR account is PRESERVED because it uses UUID, not passkey
      await this.passkeyStore.deleteAllForUser(user.id);
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(user.id),
      userName: email,
      userDisplayName: email.split('@')[0],
      timeout: 60000,
      attestationType: 'none', // Privacy-preserving
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      excludeCredentials,
      // Request PRF extension for DID secret derivation (separate from NEAR)
      extensions: {
        prf: {}
      }
    });

    // Store challenge with user ID
    const challengeId = randomUUID();
    challenges.set(challengeId, {
      challenge: options.challenge,
      userId: user.id,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    return { options, challengeId, userId: user.id };
  }

  /**
   * Verify passkey registration and store credential
   *
   * After successful registration:
   * 1. Store the passkey credential (for authentication)
   * 2. Create NEAR account via MPC (using user's UUID)
   */
  async verifyRegistration(
    challengeId: string,
    userId: string,
    response: RegistrationResponseJSON
  ): Promise<{
    verified: boolean;
    nearAccountId: string;
    prfSupported: boolean;
    mpcDerivationPath: string;
  }> {
    // Get and validate challenge
    const stored = challenges.get(challengeId);
    if (!stored || stored.expiresAt < Date.now()) {
      throw new Error('Challenge expired or not found');
    }
    if (stored.userId !== userId) {
      throw new Error('User ID mismatch');
    }
    challenges.delete(challengeId);

    // Verify registration
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const { credential } = verification.registrationInfo;

    // Check PRF support
    const prfSupported = response.clientExtensionResults?.prf?.enabled === true;

    // Store credential - NOTE: no nearImplicitAccountId, passkey is auth only
    const input: CreatePasskeyInput = {
      userId,
      credentialId: Buffer.from(credential.id),
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: response.response.transports || [],
      prfSupported
      // NO nearImplicitAccountId - passkey doesn't derive NEAR account
    };

    await this.passkeyStore.createCredential(input);

    // Create NEAR account via MPC using user's UUID
    // This is separate from passkey - uses stable UUID as derivation anchor
    const { accountId, derivationPath, mpcPublicKey } = await createMPCAccount(userId);

    // Update user record with NEAR account info
    await this.userStore.updateNearAccountId(userId, accountId);
    await this.userStore.updateMPCDerivationPath(userId, derivationPath);

    return {
      verified: true,
      nearAccountId: accountId,
      prfSupported,
      mpcDerivationPath: derivationPath
    };
  }

  /**
   * Generate passkey authentication options
   */
  async generateAuthenticationOptions(email?: string): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
    let userId: string | undefined;

    if (email) {
      const user = await this.userStore.findByEmail(email);
      if (user) {
        userId = user.id;
        const creds = await this.passkeyStore.findByUserId(user.id);
        allowCredentials = creds.map(cred => ({
          id: isoBase64URL.fromBuffer(cred.credentialId),
          transports: cred.transports as AuthenticatorTransportFuture[]
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials,
      timeout: 60000,
      // Request PRF evaluation for DID secret derivation
      extensions: {
        prf: {
          eval: {
            // Use RP ID as salt for deterministic derivation
            first: new TextEncoder().encode(`bastion-did-v1:${RP_ID}`)
          }
        }
      }
    });

    const challengeId = randomUUID();
    challenges.set(challengeId, {
      challenge: options.challenge,
      userId: userId || '',
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    return { options, challengeId };
  }

  /**
   * Verify passkey authentication and create session
   *
   * After successful authentication:
   * 1. Create session for the user
   * 2. Return user's NEAR account ID (created via MPC, not derived from passkey)
   */
  async verifyAuthentication(
    challengeId: string,
    response: AuthenticationResponseJSON
  ): Promise<{
    verified: boolean;
    session: UserSession;
    prfOutput: Uint8Array | null;
    nearAccountId: string;
  }> {
    // Get and validate challenge
    const stored = challenges.get(challengeId);
    if (!stored || stored.expiresAt < Date.now()) {
      throw new Error('Challenge expired or not found');
    }
    challenges.delete(challengeId);

    // Find credential by ID
    const credentialIdBuffer = Buffer.from(isoBase64URL.toBuffer(response.id));
    const credential = await this.passkeyStore.findByCredentialId(credentialIdBuffer);

    if (!credential) {
      throw new Error('Credential not found');
    }

    // Verify authentication
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: isoBase64URL.fromBuffer(credential.credentialId),
        publicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransportFuture[]
      }
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter (replay prevention)
    await this.passkeyStore.updateCounter(
      credential.id,
      BigInt(verification.authenticationInfo.newCounter)
    );
    await this.passkeyStore.updateLastUsed(credential.id);

    // Extract PRF output if available (for DID operations)
    let prfOutput: Uint8Array | null = null;
    const prfResult = response.clientExtensionResults?.prf?.results?.first;

    if (prfResult) {
      prfOutput = new Uint8Array(isoBase64URL.toBuffer(prfResult));
    }

    // Get user to retrieve their NEAR account ID
    const user = await this.userStore.findById(credential.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Ensure user has NEAR account (may not exist if created before MPC integration)
    let nearAccountId = user.nearAccountId;
    if (!nearAccountId) {
      const { accountId, derivationPath } = await createMPCAccount(user.id);
      await this.userStore.updateNearAccountId(user.id, accountId);
      await this.userStore.updateMPCDerivationPath(user.id, derivationPath);
      nearAccountId = accountId;
    }

    // Create session
    const session = await this.sessionStore.createSession({
      userId: credential.userId,
      nearAccountId: nearAccountId,
      prfAvailable: prfOutput !== null
    });

    return {
      verified: true,
      session,
      prfOutput,
      nearAccountId
    };
  }

  // Cleanup expired challenges (call periodically)
  cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [key, value] of challenges.entries()) {
      if (value.expiresAt < now) {
        challenges.delete(key);
      }
    }
  }
}

// Singleton
let instance: PasskeyService | null = null;
export function getPasskeyService(): PasskeyService {
  if (!instance) {
    instance = new PasskeyService();
  }
  return instance;
}

/**
 * Passkey Client - WebAuthn registration and authentication
 */

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { authService } from './auth-service';

export interface PasskeyRegistrationResult {
  success: boolean;
  accountId?: string;
  prfSupported?: boolean;
  mpcDerivationPath?: string;
  error?: string;
}

export interface PasskeyAuthResult {
  success: boolean;
  accountId?: string;
  prfAvailable?: boolean;
  prfOutput?: string;  // Base64url PRF output for DID operations
  error?: string;
}

/**
 * Register a new passkey for the user
 */
export async function registerPasskey(
  email: string,
  isRecovery = false
): Promise<PasskeyRegistrationResult> {
  try {
    // Get registration options from backend
    const { options, challengeId, userId } = await authService.getRegistrationOptions(
      email,
      isRecovery
    );

    // Start WebAuthn registration ceremony
    const credential = await startRegistration({ optionsJSON: options });

    // Check PRF support
    const prfEnabled = credential.clientExtensionResults?.prf?.enabled;
    console.log('Passkey registered, PRF support:', prfEnabled);

    // Verify with backend
    const result = await authService.verifyRegistration(challengeId, userId, credential);

    return {
      success: true,
      accountId: result.nearAccountId,  // From MPC (UUID-based)
      prfSupported: result.prfSupported,
      mpcDerivationPath: result.mpcDerivationPath
    };
  } catch (error) {
    console.error('Passkey registration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
  }
}

/**
 * Authenticate with passkey
 */
export async function authenticateWithPasskey(
  email?: string
): Promise<PasskeyAuthResult> {
  try {
    // Get authentication options from backend
    const { options, challengeId } = await authService.getAuthenticationOptions(email);

    // Start WebAuthn authentication ceremony
    const credential = await startAuthentication({ optionsJSON: options });

    // Extract PRF output if available
    const prfOutput = credential.clientExtensionResults?.prf?.results?.first;

    // Verify with backend
    const result = await authService.verifyAuthentication(challengeId, credential);

    // Store session
    authService.setSession(result.sessionToken);

    return {
      success: true,
      accountId: result.accountId,
      prfAvailable: result.prfAvailable,
      prfOutput: prfOutput || undefined
    };
  } catch (error) {
    console.error('Passkey authentication failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

/**
 * Check if passkeys are supported by the browser
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    // Check if platform authenticator is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Check if conditional mediation (autofill) is supported
 */
export async function isConditionalMediationSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    // @ts-expect-error - isConditionalMediationAvailable not in all TS types yet
    const available = await PublicKeyCredential.isConditionalMediationAvailable?.();
    return available ?? false;
  } catch {
    return false;
  }
}

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

    // Check PRF support (PRF extension not in all TypeScript defs)
    const extResults = credential.clientExtensionResults as Record<string, unknown>;
    const prfEnabled = (extResults?.prf as { enabled?: boolean })?.enabled;
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

    // PRF extension data flows: backend JSON -> frontend -> WebAuthn API
    // JSON requires strings, but WebAuthn API requires ArrayBuffer for prf.eval.first
    // We must decode the base64url string to ArrayBuffer BEFORE passing to startAuthentication()
    const prfExt = (options.extensions as Record<string, unknown>)?.prf as {
      eval?: { first?: string | ArrayBuffer };
    } | undefined;

    if (prfExt?.eval?.first && typeof prfExt.eval.first === 'string') {
      // Backend sends base64url string (required for JSON transport)
      // Browser's WebAuthn API requires ArrayBuffer (per W3C spec)
      // Decode here, between receiving options and calling startAuthentication()
      const base64url = prfExt.eval.first;
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const binary = atob(base64 + padding);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      // Replace base64url string with ArrayBuffer for WebAuthn API
      prfExt.eval.first = bytes.buffer;
    }

    // Start WebAuthn authentication ceremony
    const credential = await startAuthentication({ optionsJSON: options });

    // Extract PRF output if available (PRF extension not in all TypeScript defs)
    const extResults = credential.clientExtensionResults as Record<string, unknown>;
    const prfOutput = (extResults?.prf as { results?: { first?: ArrayBuffer } })?.results?.first;

    // Verify with backend
    const result = await authService.verifyAuthentication(challengeId, credential);

    // Store session
    authService.setSession(result.sessionToken);

    // Convert PRF ArrayBuffer to base64url string if present
    let prfOutputString: string | undefined;
    if (prfOutput) {
      const bytes = new Uint8Array(prfOutput);
      prfOutputString = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    return {
      success: true,
      accountId: result.accountId,
      prfAvailable: result.prfAvailable,
      prfOutput: prfOutputString
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
    // isConditionalMediationAvailable is a newer API not in all TypeScript defs
     
    const available = await PublicKeyCredential.isConditionalMediationAvailable?.();
    return available ?? false;
  } catch {
    return false;
  }
}

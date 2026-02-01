/**
 * Authentication API
 *
 * Phase 1.2: Passkey Authentication & NEAR Implicit Accounts
 *
 * Endpoints:
 * - Magic Link: /magic-link/* (PRF fallback)
 * - TOTP (2FA): /totp/* (setup, enable, disable, status)
 * - Recovery: /recovery/* (multi-factor account recovery)
 * - Passkey: /passkey/* (added by plan 1.2-02)
 *
 * ARCHITECTURE:
 * - Passkeys for authentication only (not NEAR account derivation)
 * - NEAR accounts created via MPC with stable UUID-based path
 * - Multi-factor recovery: Email + TOTP
 * - Deployment-configurable 2FA types
 */

import express from 'express';
import { getMagicLinkService } from '../auth/magic-link-service.js';
import { getTotpService } from '../auth/totp-service.js';
import { getRecoveryService } from '../auth/recovery-service.js';
import { getSessionStore } from '../auth/session-store.js';
import { getPasskeyService } from '../auth/passkey-service.js';

const router = express.Router();

// ============================================
// Magic Link Endpoints (PRF Fallback)
// ============================================

/**
 * POST /api/auth/magic-link/send
 * Send magic link for PRF-fallback authentication
 */
router.post('/magic-link/send', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const service = getMagicLinkService();
    const result = await service.sendMagicLink(email, false);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error('Magic link send error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

/**
 * POST /api/auth/magic-link/verify
 * Verify magic link token
 */
router.post('/magic-link/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const service = getMagicLinkService();
    const result = await service.verifyMagicLink(token);

    res.json({
      verified: result.verified,
      sessionToken: result.session.id,
      accountId: result.accountId,
      needsPasskeySetup: result.needsPasskeySetup,
      requiresTotpVerification: result.requiresTotpVerification
    });
  } catch (error) {
    console.error('Magic link verify error:', error);
    res.status(401).json({ error: 'Verification failed' });
  }
});

// ============================================
// TOTP (2FA) Endpoints
// ============================================

/**
 * POST /api/auth/totp/setup
 * Generate TOTP secret for user
 */
router.post('/totp/setup', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    const session = await sessionStore.getSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const totpService = getTotpService();
    const setup = await totpService.generateSetup(session.userId);

    res.json({
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ error: 'Failed to generate TOTP setup' });
  }
});

/**
 * POST /api/auth/totp/enable
 * Enable TOTP with verification code
 */
router.post('/totp/enable', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ error: 'Secret and code required' });
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    const session = await sessionStore.getSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const totpService = getTotpService();
    const result = await totpService.enableTotp(session.userId, secret, code);

    res.json(result);
  } catch (error) {
    console.error('TOTP enable error:', error);
    res.status(500).json({ error: 'Failed to enable TOTP' });
  }
});

/**
 * POST /api/auth/totp/disable
 * Disable TOTP with verification code
 */
router.post('/totp/disable', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    const session = await sessionStore.getSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const totpService = getTotpService();
    const result = await totpService.disableTotp(session.userId, code);

    res.json(result);
  } catch (error) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ error: 'Failed to disable TOTP' });
  }
});

/**
 * GET /api/auth/totp/status
 * Check if TOTP is enabled for current user
 */
router.get('/totp/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    const session = await sessionStore.getSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const totpService = getTotpService();
    const enabled = await totpService.isEnabled(session.userId);

    res.json({ totpEnabled: enabled });
  } catch (error) {
    console.error('TOTP status error:', error);
    res.status(500).json({ error: 'Failed to get TOTP status' });
  }
});

// ============================================
// Account Recovery Endpoints (Multi-Factor)
// ============================================

/**
 * POST /api/auth/recovery/initiate
 * Start account recovery - sends email to primary or alternate address
 */
router.post('/recovery/initiate', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const recoveryService = getRecoveryService();
    const result = await recoveryService.initiateRecovery(email);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a recovery link has been sent.',
      requiresTotp: result.requiresTotp
    });
  } catch (error) {
    console.error('Recovery initiate error:', error);
    // Still return success for security
    res.json({
      success: true,
      message: 'If an account exists with this email, a recovery link has been sent.'
    });
  }
});

/**
 * POST /api/auth/recovery/verify-totp
 * Verify TOTP code during recovery flow
 */
router.post('/recovery/verify-totp', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session required' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'TOTP code required' });
    }

    const sessionToken = authHeader.slice(7);
    const recoveryService = getRecoveryService();
    const result = await recoveryService.verifyRecoveryTotp(sessionToken, code);

    res.json(result);
  } catch (error) {
    console.error('Recovery TOTP verify error:', error);
    res.status(401).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/recovery/authorize-passkey
 * Authorize passkey replacement after multi-factor verification
 */
router.post('/recovery/authorize-passkey', async (req, res) => {
  try {
    const { recoveryToken } = req.body;
    if (!recoveryToken) {
      return res.status(400).json({ error: 'Recovery token required' });
    }

    const recoveryService = getRecoveryService();
    const result = await recoveryService.authorizePasskeyReplacement(recoveryToken);

    res.json(result);
  } catch (error) {
    console.error('Recovery authorize error:', error);
    res.status(401).json({ error: 'Authorization failed' });
  }
});

/**
 * POST /api/auth/recovery/bypass-totp
 * For users without TOTP enabled - bypass 2FA step
 */
router.post('/recovery/bypass-totp', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session required' });
    }

    const sessionToken = authHeader.slice(7);
    const recoveryService = getRecoveryService();
    const result = await recoveryService.bypassTotpForNon2FAUsers(sessionToken);

    res.json(result);
  } catch (error) {
    console.error('Recovery bypass error:', error);
    res.status(401).json({ error: 'Bypass not allowed' });
  }
});

/**
 * GET /api/auth/recovery/2fa-types
 * Get available 2FA types for current deployment
 */
router.get('/recovery/2fa-types', async (_req, res) => {
  try {
    const recoveryService = getRecoveryService();
    const types = await recoveryService.getAvailable2FATypes();

    res.json({ types });
  } catch (error) {
    console.error('2FA types error:', error);
    res.status(500).json({ error: 'Failed to get 2FA types' });
  }
});

// ============================================
// Passkey Endpoints (Plan 1.2-02)
// ============================================

/**
 * POST /api/auth/passkey/register-options
 * Generate passkey registration options
 *
 * Body: { email: string, isRecovery?: boolean }
 * Response: { options: PublicKeyCredentialCreationOptionsJSON, challengeId: string, userId: string }
 *
 * Note: isRecovery=true deletes existing passkeys but preserves NEAR account
 */
router.post('/passkey/register-options', async (req, res) => {
  try {
    const { email, isRecovery } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const service = getPasskeyService();
    const result = await service.generateRegistrationOptions(email, isRecovery);

    res.json({
      options: result.options,
      challengeId: result.challengeId,
      userId: result.userId
    });
  } catch (error) {
    console.error('Registration options error:', error);
    res.status(500).json({
      error: 'Failed to generate registration options',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auth/passkey/register
 * Verify passkey registration
 *
 * Body: { challengeId: string, userId: string, response: RegistrationResponseJSON }
 * Response: { verified: boolean, nearAccountId: string, prfSupported: boolean, mpcDerivationPath: string }
 *
 * Note: NEAR account is created via MPC using user's UUID, NOT derived from passkey
 */
router.post('/passkey/register', async (req, res) => {
  try {
    const { challengeId, userId, response } = req.body;

    if (!challengeId || !userId || !response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const service = getPasskeyService();
    const result = await service.verifyRegistration(challengeId, userId, response);

    res.json(result);
  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(400).json({
      error: 'Registration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auth/passkey/auth-options
 * Generate passkey authentication options
 *
 * Body: { email?: string } - optional, for allowing specific credentials
 * Response: { options: PublicKeyCredentialRequestOptionsJSON, challengeId: string }
 */
router.post('/passkey/auth-options', async (req, res) => {
  try {
    const { email } = req.body;

    const service = getPasskeyService();
    const result = await service.generateAuthenticationOptions(email);

    res.json(result);
  } catch (error) {
    console.error('Authentication options error:', error);
    res.status(500).json({
      error: 'Failed to generate authentication options',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auth/passkey/authenticate
 * Verify passkey authentication
 *
 * Body: { challengeId: string, response: AuthenticationResponseJSON }
 * Response: { verified: boolean, sessionToken: string, nearAccountId: string, prfAvailable: boolean }
 *
 * Note: nearAccountId comes from MPC (UUID-based), not from passkey
 */
router.post('/passkey/authenticate', async (req, res) => {
  try {
    const { challengeId, response } = req.body;

    if (!challengeId || !response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const service = getPasskeyService();
    const result = await service.verifyAuthentication(challengeId, response);

    res.json({
      verified: result.verified,
      sessionToken: result.session.id,
      nearAccountId: result.nearAccountId,
      prfAvailable: result.prfOutput !== null
    });
  } catch (error) {
    console.error('Authentication verification error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// Session Management Endpoints
// ============================================

/**
 * GET /api/auth/session
 * Get current session from Authorization header
 *
 * Headers: Authorization: Bearer <sessionToken>
 * Response: { userId: string, nearAccountId: string, prfAvailable: boolean, expiresAt: string }
 */
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    const session = await sessionStore.getSession(sessionToken);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    res.json({
      userId: session.userId,
      nearAccountId: session.accountId,
      prfAvailable: session.prfAvailable,
      expiresAt: session.expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/auth/logout
 * Delete current session
 *
 * Headers: Authorization: Bearer <sessionToken>
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.json({ success: true }); // Already logged out
    }

    const sessionToken = authHeader.slice(7);
    const sessionStore = getSessionStore();
    await sessionStore.deleteSession(sessionToken);

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;

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
// NOTE: Passkey endpoints will be added by plan 1.2-02
// Route prefixes reserved:
// - POST /api/auth/passkey/register-start
// - POST /api/auth/passkey/register-finish
// - POST /api/auth/passkey/authenticate-start
// - POST /api/auth/passkey/authenticate-finish

export default router;

/**
 * Authentication API Routes
 *
 * Endpoints for passkey-based authentication.
 *
 * ARCHITECTURE:
 * - Passkeys handle AUTHENTICATION (identity verification)
 * - NEAR accounts are created via MPC (separate from passkey)
 * - This separation enables account recovery without asset loss
 */

import express from 'express';
import { getPasskeyService } from '../auth/passkey-service.js';

const router = express.Router();

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
    const service = getPasskeyService();
    const session = await service['sessionStore'].getSession(sessionToken);

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
    const service = getPasskeyService();
    await service['sessionStore'].deleteSession(sessionToken);

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;

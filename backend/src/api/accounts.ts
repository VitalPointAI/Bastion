// Account Management API
// Creates NEAR accounts and tracks MPC derivation paths
// Actual key management handled by Chain Signatures MPC (user-owned)

import express from 'express';
import { getMPCAccountManager } from '../lib/mpc-accounts.js';
import { Pool } from 'pg';

const router = express.Router();

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'coalition_ops',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * POST /api/accounts/create
 *
 * Create NEAR account for authenticated Privy user
 * Account is created on-chain, keys managed by Chain Signatures MPC
 *
 * Request body:
 * {
 *   privyUserId: string,
 *   email: string,
 *   authToken: string (Privy JWT - for verification)
 * }
 *
 * Response:
 * {
 *   accountId: string,           // NEAR account ID (bastion-xxx.testnet)
 *   derivationPath: string,      // MPC derivation path
 *   mpcContractId: string,       // Chain Signatures MPC contract
 *   status: 'pending' | 'created'
 * }
 */
router.post('/create', async (req, res) => {
  try {
    const { privyUserId, email, authToken } = req.body;

    // Validate required fields
    if (!privyUserId || !email) {
      return res.status(400).json({
        error: 'Missing required fields: privyUserId, email',
      });
    }

    // TODO: Verify Privy JWT token
    // Production: Verify authToken with Privy's API
    // For v1, trust the frontend (behind auth)
    if (!authToken) {
      return res.status(401).json({
        error: 'Authentication token required',
      });
    }

    // Check if user already has an account
    const existingAccount = await pool.query(
      'SELECT near_account_id, derivation_path FROM user_accounts WHERE privy_user_id = $1',
      [privyUserId]
    );

    if (existingAccount.rows.length > 0) {
      // Account already exists
      return res.json({
        accountId: existingAccount.rows[0].near_account_id,
        derivationPath: existingAccount.rows[0].derivation_path,
        mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
          ? 'v1.signer-prod.near'
          : 'v1.signer-dev.testnet',
        status: 'created',
      });
    }

    // Create new NEAR account
    const mpcManager = getMPCAccountManager(
      process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
    );

    const account = await mpcManager.createNEARAccount(privyUserId, email);

    // Store account mapping in database
    await pool.query(
      `INSERT INTO user_accounts
       (privy_user_id, email, near_account_id, derivation_path, mpc_public_key, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [privyUserId, email, account.nearAccountId, account.derivationPath, account.mpcPublicKey]
    );

    console.log('NEAR account created:', {
      privyUserId,
      email,
      accountId: account.nearAccountId,
      derivationPath: account.derivationPath,
      onChain: account.onChain,
    });

    res.json({
      accountId: account.nearAccountId,
      derivationPath: account.derivationPath,
      mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
        ? 'v1.signer-prod.near'
        : 'v1.signer-dev.testnet',
      mpcPublicKey: account.mpcPublicKey,
      onChain: account.onChain,
      status: account.onChain ? 'created' : 'pending',
    });
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({
      error: 'Failed to create account',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/accounts/:privyUserId
 *
 * Get NEAR account for Privy user
 *
 * Response:
 * {
 *   accountId: string,
 *   derivationPath: string,
 *   mpcContractId: string,
 *   exists: boolean
 * }
 */
router.get('/:privyUserId', async (req, res) => {
  try {
    const { privyUserId } = req.params;

    const result = await pool.query(
      'SELECT near_account_id, derivation_path FROM user_accounts WHERE privy_user_id = $1',
      [privyUserId]
    );

    if (result.rows.length === 0) {
      return res.json({
        exists: false,
      });
    }

    res.json({
      accountId: result.rows[0].near_account_id,
      derivationPath: result.rows[0].derivation_path,
      mpcContractId: process.env.NEAR_NETWORK === 'mainnet'
        ? 'v1.signer-prod.near'
        : 'v1.signer-dev.testnet',
      exists: true,
    });
  } catch (error) {
    console.error('Account lookup error:', error);
    res.status(500).json({
      error: 'Failed to lookup account',
    });
  }
});

/**
 * POST /api/accounts/update-mpc-key
 *
 * Update MPC public key after frontend registers with MPC contract
 *
 * Request body:
 * {
 *   privyUserId: string,
 *   mpcPublicKey: string (from MPC registration)
 * }
 */
router.post('/update-mpc-key', async (req, res) => {
  try {
    const { privyUserId, mpcPublicKey } = req.body;

    if (!privyUserId || !mpcPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    await pool.query(
      'UPDATE user_accounts SET mpc_public_key = $1 WHERE privy_user_id = $2',
      [mpcPublicKey, privyUserId]
    );

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('MPC key update error:', error);
    res.status(500).json({
      error: 'Failed to update MPC key',
    });
  }
});

export default router;

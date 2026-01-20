import { Router, Request, Response } from 'express';
import { getDIDService } from '../identity/did-service.js';
import { EntityType } from '../identity/types.js';
import { hexToBlindedKey, blindedKeyToHex, deriveDIDBlindedKey } from '../identity/blinded-keys.js';

const router = Router();
const didService = getDIDService();

/**
 * POST /api/identity/did/create
 * Create a new DID (requires user secret in secure header)
 */
router.post('/did/create', async (req: Request, res: Response) => {
  try {
    const { accountId, entityType, publicKeyBase58 } = req.body;

    // User secret should come from authenticated session
    // For now, derive from a header (in production, from TEE or secure storage)
    const userSecretHex = req.headers['x-user-secret'] as string;
    if (!userSecretHex) {
      res.status(401).json({ error: 'User secret required for DID creation' });
      return;
    }

    if (!accountId || !entityType || !publicKeyBase58) {
      res.status(400).json({ error: 'accountId, entityType, and publicKeyBase58 required' });
      return;
    }

    const validEntityTypes: EntityType[] = ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'];
    if (!validEntityTypes.includes(entityType)) {
      res.status(400).json({ error: 'Invalid entityType', validEntityTypes });
      return;
    }

    const userSecret = hexToBlindedKey(userSecretHex);
    const result = await didService.createDID(accountId, entityType, userSecret, publicKeyBase58);

    res.json({
      success: true,
      did: result.did,
      blindedKey: result.blindedKey,
      message: 'DID created and stored encrypted on-chain'
    });
  } catch (error) {
    console.error('DID creation error:', error);
    res.status(500).json({ error: 'Failed to create DID' });
  }
});

/**
 * POST /api/identity/did/resolve
 * Resolve a DID (requires user secret for decryption)
 */
router.post('/did/resolve', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    const userSecretHex = req.headers['x-user-secret'] as string;

    if (!userSecretHex) {
      res.status(401).json({ error: 'User secret required for DID resolution' });
      return;
    }

    if (!accountId) {
      res.status(400).json({ error: 'accountId required' });
      return;
    }

    const userSecret = hexToBlindedKey(userSecretHex);
    const document = await didService.resolveDID(accountId, userSecret);

    if (!document) {
      res.status(404).json({ error: 'DID not found or unable to decrypt' });
      return;
    }

    res.json({ document });
  } catch (error) {
    console.error('DID resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve DID' });
  }
});

/**
 * POST /api/identity/did/check-active
 * Check if a DID is active (without full decryption)
 */
router.post('/did/check-active', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    const userSecretHex = req.headers['x-user-secret'] as string;

    if (!userSecretHex || !accountId) {
      res.status(400).json({ error: 'accountId and user secret required' });
      return;
    }

    const userSecret = hexToBlindedKey(userSecretHex);
    const active = await didService.isDIDActive(accountId, userSecret);

    res.json({ accountId, active });
  } catch (error) {
    console.error('DID status check error:', error);
    res.status(500).json({ error: 'Failed to check DID status' });
  }
});

/**
 * POST /api/identity/derive-blinded-key
 * Derive a blinded key (utility endpoint)
 */
router.post('/derive-blinded-key', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    const userSecretHex = req.headers['x-user-secret'] as string;

    if (!userSecretHex || !accountId) {
      res.status(400).json({ error: 'accountId and user secret required' });
      return;
    }

    const userSecret = hexToBlindedKey(userSecretHex);
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);

    res.json({
      accountId,
      blindedKey: blindedKeyToHex(blindedKey)
    });
  } catch (error) {
    console.error('Key derivation error:', error);
    res.status(500).json({ error: 'Failed to derive blinded key' });
  }
});

/**
 * GET /api/identity/entity-types
 * List valid entity types
 */
router.get('/entity-types', (_req: Request, res: Response) => {
  res.json({
    entityTypes: ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'],
    description: {
      Human: 'Human users with authentication',
      AiAgent: 'AI agents and autonomous systems',
      Vehicle: 'Vehicles and platforms',
      Mission: 'Mission definitions',
      DataObject: 'Data objects with classification',
      Organization: 'Organizations and units',
      Resource: 'Other trackable resources'
    }
  });
});

// ============================================================================
// SIMPLE FRONTEND ENDPOINTS (no user secret required)
// These provide basic DID existence checks for frontend integration
// ============================================================================

/**
 * GET /api/identity/account/:accountId
 * Check if an account has a DID registered (simple existence check)
 * Used by frontend to determine if DID creation is needed
 */
router.get('/account/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      res.status(400).json({ error: 'accountId required' });
      return;
    }

    // Build the DID from account ID
    const did = `did:near:${accountId}`;

    // For now, we can't check on-chain without user secret (encrypted storage)
    // Return the expected DID format - actual verification happens when user has secret
    // This allows frontend to proceed with DID creation attempt
    res.json({
      accountId,
      did,
      didDocument: null, // Would need user secret to decrypt
      message: 'DID lookup requires authentication for full resolution'
    });
  } catch (error) {
    console.error('Account DID lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup account DID' });
  }
});

/**
 * POST /api/identity/register
 * Simple DID registration endpoint for frontend
 * Creates a DID for a new user (derives secret from account for now)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { accountId, entityType } = req.body;

    if (!accountId || !entityType) {
      res.status(400).json({ error: 'accountId and entityType required' });
      return;
    }

    const validEntityTypes: EntityType[] = ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'];
    if (!validEntityTypes.includes(entityType)) {
      res.status(400).json({ error: 'Invalid entityType', validEntityTypes });
      return;
    }

    // For automatic DID creation, derive a deterministic secret from account ID
    // In production, this would come from secure key management (TEE/MPC)
    const { hkdf } = await import('@noble/hashes/hkdf.js');
    const { sha256 } = await import('@noble/hashes/sha2.js');
    const { utf8ToBytes } = await import('@noble/hashes/utils.js');

    // Derive user secret deterministically from account ID
    // This ensures the same account always gets the same DID encryption key
    const salt = utf8ToBytes('bastion-did-v1');
    const info = utf8ToBytes(`did:near:${accountId}`);
    const ikm = utf8ToBytes(accountId + ':' + (process.env.DID_SECRET_SEED || 'dev-seed'));
    const userSecret = hkdf(sha256, ikm, salt, info, 32);

    // Generate a placeholder public key (in production, from user's actual key)
    const publicKeyBase58 = 'placeholder-' + accountId.slice(0, 16);

    const result = await didService.createDID(accountId, entityType, userSecret, publicKeyBase58);

    res.json({
      success: true,
      did: result.did,
      message: 'DID registered successfully'
    });
  } catch (error: any) {
    console.error('DID registration error:', error);

    // Check if DID already exists
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      res.status(409).json({ error: 'DID already registered for this account' });
      return;
    }

    res.status(500).json({ error: 'Failed to register DID' });
  }
});

/**
 * POST /api/identity/validate
 * Validate DID format
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { did } = req.body;

    if (!did) {
      res.status(400).json({ error: 'did required' });
      return;
    }

    // Validate did:near format
    const didRegex = /^did:near:[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i;
    const valid = didRegex.test(did);

    res.json({
      did,
      valid,
      method: valid ? 'near' : null,
      message: valid ? 'Valid NEAR DID format' : 'Invalid DID format'
    });
  } catch (error) {
    console.error('DID validation error:', error);
    res.status(500).json({ error: 'Failed to validate DID' });
  }
});

/**
 * GET /api/identity/resolve/:did
 * Public DID resolution (returns metadata only, not encrypted content)
 */
router.get('/resolve/:did', async (req: Request, res: Response) => {
  try {
    const did = req.params.did as string;

    if (!did || !did.startsWith('did:near:')) {
      res.status(400).json({
        didDocument: null,
        didResolutionMetadata: { error: 'Invalid DID format' },
        didDocumentMetadata: {}
      });
      return;
    }

    // Return W3C DID Resolution format
    // Full document requires user secret for decryption
    res.json({
      didDocument: null, // Would need user secret to decrypt
      didResolutionMetadata: {
        contentType: 'application/did+json',
        message: 'Full resolution requires authentication'
      },
      didDocumentMetadata: {
        created: new Date().toISOString(),
        deactivated: false
      }
    });
  } catch (error) {
    console.error('DID resolution error:', error);
    res.status(500).json({
      didDocument: null,
      didResolutionMetadata: { error: 'Resolution failed' },
      didDocumentMetadata: {}
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getDIDService } from '../identity/did-service';
import { EntityType } from '../identity/types';
import { hexToBlindedKey, blindedKeyToHex, deriveDIDBlindedKey } from '../identity/blinded-keys';

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
router.get('/entity-types', (req: Request, res: Response) => {
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

export default router;

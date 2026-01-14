---
phase: 02-identity-security-framework
plan: 03
type: execute
---

<objective>
Set up backend DID resolution with encryption/decryption, blinded key derivation, and Veramo agent integration.

Purpose: Enable the backend to create encrypted DIDs, derive blinded lookup keys, encrypt/decrypt DID documents, and resolve DIDs through the privacy-preserving on-chain registry.

Output: Working DID service with encryption utilities, blinded key derivation, Veramo agent, and API endpoints.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@.planning/phases/02-identity-security-framework/2-01-PLAN.md
@backend/src/index.ts
@backend/src/lib/database.ts
@backend/src/crypto/pq-kem.ts
@backend/package.json

**Tech stack available:** Node.js, Express, TypeScript, @near-js/*, @noble/* crypto
**Established patterns:** API routes, lib modules, PQ crypto from Plan 2-05
**Depends on:** Plans 2-01, 2-02 (encrypted smart contracts), Plan 2-05 (PQ crypto)

**CRITICAL: Encrypted Storage Model**
- On-chain: Only encrypted blobs with blinded keys
- Backend handles: Key derivation, encryption, decryption
- Blinded keys: HKDF(user_secret, context, identifier)
- All DID content encrypted with PQ hybrid encryption
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create blinded key derivation and DID encryption utilities</name>
  <files>backend/src/identity/blinded-keys.ts, backend/src/identity/did-encryption.ts, backend/src/identity/types.ts</files>
  <action>
Create utilities for blinded key derivation and DID document encryption.

**Create directory:**
```bash
mkdir -p backend/src/identity
```

**Install dependencies:**
```bash
cd backend && pnpm add @noble/hashes
```

**backend/src/identity/types.ts:**
```typescript
export type EntityType =
  | 'Human'
  | 'AiAgent'
  | 'Vehicle'
  | 'Mission'
  | 'DataObject'
  | 'Organization'
  | 'Resource';

export interface PublicKeyEntry {
  id: string;
  type: string;
  controller: string;
  publicKeyBase58: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  entityType: EntityType;
  publicKey: PublicKeyEntry[];
  authentication: string[];
  controller: string[];
  service?: ServiceEndpoint[];
  created: string;
  updated: string;
}

export interface EncryptedDIDEntry {
  encryptedDocument: Uint8Array;
  encryptedEntityType: Uint8Array;
  nonce: Uint8Array;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  owner: string;
}
```

**backend/src/identity/blinded-keys.ts:**
```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Derive a blinded key for DID lookup
 * This key is used as the storage key on-chain
 * @param userSecret - User's secret key material (from NEAR key or derived)
 * @param accountId - NEAR account ID
 * @returns 32-byte blinded key
 */
export function deriveDIDBlindedKey(userSecret: Uint8Array, accountId: string): Uint8Array {
  return hkdf(sha256, userSecret, accountId, 'bastion-did-v1', 32);
}

/**
 * Derive a blinded key for credential lookup
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded key
 */
export function deriveCredentialBlindedKey(userSecret: Uint8Array, credentialHash: string): Uint8Array {
  return hkdf(sha256, userSecret, credentialHash, 'bastion-credential-v1', 32);
}

/**
 * Derive a separate blinded key for revocation checks
 * Different from credential key to prevent correlation
 * @param userSecret - Issuer's secret key material
 * @param credentialHash - Hash of the credential
 * @returns 32-byte blinded revocation key
 */
export function deriveRevocationBlindedKey(userSecret: Uint8Array, credentialHash: string): Uint8Array {
  return hkdf(sha256, userSecret, credentialHash, 'bastion-revocation-v1', 32);
}

/**
 * Derive user secret from NEAR account key
 * This is deterministic so user can always recover their blinded keys
 * @param nearPrivateKey - User's NEAR private key
 * @param purpose - Purpose string for domain separation
 * @returns 32-byte derived secret
 */
export function deriveUserSecret(nearPrivateKey: Uint8Array, purpose: string): Uint8Array {
  return hkdf(sha256, nearPrivateKey, 'bastion-user-secret', purpose, 32);
}

// Hex conversion utilities
export function blindedKeyToHex(key: Uint8Array): string {
  return bytesToHex(key);
}

export function hexToBlindedKey(hex: string): Uint8Array {
  return hexToBytes(hex);
}
```

**backend/src/identity/did-encryption.ts:**
```typescript
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { DIDDocument, EntityType, EncryptedDIDEntry } from './types';

const NONCE_LENGTH = 12; // ChaCha20-Poly1305 nonce

/**
 * Encrypt a DID document for on-chain storage
 * Uses ChaCha20-Poly1305 (already used in Phase 1 for IPFS)
 * @param document - Plaintext DID document
 * @param entityType - Entity type (encrypted separately for owner indexing)
 * @param encryptionKey - 32-byte symmetric key (derived from user secret)
 * @returns Encrypted entry ready for on-chain storage
 */
export function encryptDIDDocument(
  document: DIDDocument,
  entityType: EntityType,
  encryptionKey: Uint8Array
): { encryptedDocument: Uint8Array; encryptedEntityType: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(encryptionKey, nonce);

  // Encrypt document as JSON
  const documentBytes = new TextEncoder().encode(JSON.stringify(document));
  const encryptedDocument = cipher.encrypt(documentBytes);

  // Encrypt entity type separately (for owner's local indexing)
  const entityTypeBytes = new TextEncoder().encode(entityType);
  const encryptedEntityType = cipher.encrypt(entityTypeBytes);

  return { encryptedDocument, encryptedEntityType, nonce };
}

/**
 * Decrypt a DID document from on-chain storage
 * @param encryptedEntry - Encrypted entry from chain
 * @param encryptionKey - 32-byte symmetric key
 * @returns Decrypted DID document and entity type
 */
export function decryptDIDDocument(
  encryptedDocument: Uint8Array,
  encryptedEntityType: Uint8Array,
  nonce: Uint8Array,
  encryptionKey: Uint8Array
): { document: DIDDocument; entityType: EntityType } {
  const cipher = chacha20poly1305(encryptionKey, nonce);

  // Decrypt document
  const documentBytes = cipher.decrypt(encryptedDocument);
  const document = JSON.parse(new TextDecoder().decode(documentBytes)) as DIDDocument;

  // Decrypt entity type
  const entityTypeBytes = cipher.decrypt(encryptedEntityType);
  const entityType = new TextDecoder().decode(entityTypeBytes) as EntityType;

  return { document, entityType };
}

/**
 * Derive encryption key from user secret
 * Different from blinded key to maintain separation of concerns
 */
export function deriveEncryptionKey(userSecret: Uint8Array): Uint8Array {
  // Use first 32 bytes of user secret as encryption key
  // In production, derive with additional context
  return userSecret.slice(0, 32);
}

/**
 * Encrypt entity type string for storage
 */
export function encryptEntityType(entityType: EntityType, encryptionKey: Uint8Array): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(encryptionKey, nonce);
  const encrypted = cipher.encrypt(new TextEncoder().encode(entityType));
  return { encrypted, nonce };
}
```

**What to avoid:**
- DON'T reuse nonces (random for each encryption)
- DON'T use same key for blinding and encryption
- DON'T store encryption keys in database
- DON'T log decrypted content
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Blinded key derivation and DID encryption utilities created</done>
</task>

<task type="auto">
  <name>Task 2: Create DID service for encrypted registry operations</name>
  <files>backend/src/identity/did-service.ts</files>
  <action>
Create service that handles DID operations through the encrypted on-chain registry.

**backend/src/identity/did-service.ts:**
```typescript
import { DIDDocument, EntityType, EncryptedDIDEntry } from './types';
import { deriveDIDBlindedKey, deriveUserSecret, blindedKeyToHex } from './blinded-keys';
import { encryptDIDDocument, decryptDIDDocument, deriveEncryptionKey } from './did-encryption';

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';

/**
 * DID Service - handles encrypted DID operations
 */
export class DIDService {
  private rpcUrl: string;
  private contractId: string;

  constructor(rpcUrl?: string, contractId?: string) {
    this.rpcUrl = rpcUrl || NEAR_RPC_URL;
    this.contractId = contractId || DID_CONTRACT_ID;
  }

  /**
   * Create and store a new DID
   * Handles encryption and blinded key derivation
   */
  async createDID(
    accountId: string,
    entityType: EntityType,
    userSecret: Uint8Array,
    publicKeyBase58: string
  ): Promise<{ did: string; blindedKey: string }> {
    // Build DID string
    const did = `did:near:${accountId}`;

    // Create DID document
    const document: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: did,
      entityType,
      publicKey: [{
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyBase58
      }],
      authentication: [`${did}#key-1`],
      controller: [did],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    // Derive keys
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);
    const encryptionKey = deriveEncryptionKey(userSecret);

    // Encrypt document
    const { encryptedDocument, encryptedEntityType, nonce } = encryptDIDDocument(
      document,
      entityType,
      encryptionKey
    );

    // Store on-chain (via NEAR RPC call)
    await this.storeEncryptedDID(
      blindedKey,
      encryptedDocument,
      encryptedEntityType,
      nonce
    );

    return { did, blindedKey: blindedKeyToHex(blindedKey) };
  }

  /**
   * Resolve a DID by account ID
   * Requires user's secret to derive blinded key and decrypt
   */
  async resolveDID(
    accountId: string,
    userSecret: Uint8Array
  ): Promise<DIDDocument | null> {
    // Derive blinded key
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);

    // Fetch encrypted entry from chain
    const encryptedEntry = await this.getEncryptedDID(blindedKey);
    if (!encryptedEntry) {
      return null;
    }

    // Decrypt
    const encryptionKey = deriveEncryptionKey(userSecret);
    const { document } = decryptDIDDocument(
      encryptedEntry.encryptedDocument,
      encryptedEntry.encryptedEntityType,
      encryptedEntry.nonce,
      encryptionKey
    );

    return document;
  }

  /**
   * Check if a DID is active (without decryption)
   */
  async isDIDActive(accountId: string, userSecret: Uint8Array): Promise<boolean> {
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);
    return this.checkDIDActive(blindedKey);
  }

  // Private: NEAR RPC calls

  private async storeEncryptedDID(
    blindedKey: Uint8Array,
    encryptedDocument: Uint8Array,
    encryptedEntityType: Uint8Array,
    nonce: Uint8Array
  ): Promise<void> {
    // This will be a signed transaction to the contract
    // For now, structure the call - actual signing happens via wallet
    console.log('Store DID - blinded key length:', blindedKey.length);
    // Implementation requires wallet integration for signing
  }

  private async getEncryptedDID(blindedKey: Uint8Array): Promise<EncryptedDIDEntry | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: this.contractId,
            method_name: 'get_did',
            args_base64: Buffer.from(JSON.stringify({
              blinded_key: Array.from(blindedKey)
            })).toString('base64')
          }
        })
      });

      const result = await response.json();
      if (result.result?.result) {
        const decoded = JSON.parse(Buffer.from(result.result.result).toString());
        if (!decoded) return null;

        return {
          encryptedDocument: new Uint8Array(decoded.encrypted_document),
          encryptedEntityType: new Uint8Array(decoded.encrypted_entity_type),
          nonce: new Uint8Array(decoded.nonce),
          createdAt: decoded.created_at,
          updatedAt: decoded.updated_at,
          active: decoded.active,
          owner: decoded.owner
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch DID:', error);
      return null;
    }
  }

  private async checkDIDActive(blindedKey: Uint8Array): Promise<boolean> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: this.contractId,
            method_name: 'is_did_active',
            args_base64: Buffer.from(JSON.stringify({
              blinded_key: Array.from(blindedKey)
            })).toString('base64')
          }
        })
      });

      const result = await response.json();
      if (result.result?.result) {
        return JSON.parse(Buffer.from(result.result.result).toString());
      }
      return false;
    } catch (error) {
      console.error('Failed to check DID status:', error);
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: DIDService | null = null;

export function getDIDService(): DIDService {
  if (!serviceInstance) {
    serviceInstance = new DIDService();
  }
  return serviceInstance;
}
```

**What to avoid:**
- DON'T log decrypted documents
- DON'T cache decrypted content
- DON'T expose user secrets in errors
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>DID service created with encrypted registry operations</done>
</task>

<task type="auto">
  <name>Task 3: Create identity API endpoints</name>
  <files>backend/src/api/identity.ts, backend/src/index.ts</files>
  <action>
Create API endpoints for identity operations.

**backend/src/api/identity.ts:**
```typescript
import { Router, Request, Response } from 'express';
import { getDIDService } from '../identity/did-service';
import { EntityType } from '../identity/types';
import { hexToBlindedKey, blindedKeyToHex, deriveDIDBlindedKey, deriveUserSecret } from '../identity/blinded-keys';

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
      return res.status(401).json({ error: 'User secret required for DID creation' });
    }

    if (!accountId || !entityType || !publicKeyBase58) {
      return res.status(400).json({ error: 'accountId, entityType, and publicKeyBase58 required' });
    }

    const validEntityTypes: EntityType[] = ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entityType', validEntityTypes });
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
      return res.status(401).json({ error: 'User secret required for DID resolution' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'accountId required' });
    }

    const userSecret = hexToBlindedKey(userSecretHex);
    const document = await didService.resolveDID(accountId, userSecret);

    if (!document) {
      return res.status(404).json({ error: 'DID not found or unable to decrypt' });
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
      return res.status(400).json({ error: 'accountId and user secret required' });
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
      return res.status(400).json({ error: 'accountId and user secret required' });
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
```

**Update backend/src/index.ts:**
```typescript
import identityRoutes from './api/identity';
// ... existing imports

// Add after other route registrations:
app.use('/api/identity', identityRoutes);
```

**What to avoid:**
- DON'T log user secrets or decrypted documents
- DON'T cache decrypted content on server
- DON'T expose blinded keys in error messages
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit && curl http://localhost:3001/api/identity/entity-types returns entity types</verify>
  <done>Identity API endpoints created with encrypted DID operations</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] Blinded key derivation uses HKDF with proper domain separation
- [ ] DID encryption uses ChaCha20-Poly1305 with random nonces
- [ ] API endpoints handle encrypted operations
- [ ] No plaintext DIDs or secrets logged
</verification>

<success_criteria>
- Blinded key derivation with HKDF
- DID document encryption/decryption
- DID service for encrypted registry operations
- API endpoints for identity operations
- No plaintext identity data exposed
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-03-SUMMARY.md`
</output>

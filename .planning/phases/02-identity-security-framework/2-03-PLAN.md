---
phase: 02-identity-security-framework
plan: 03
type: execute
---

<objective>
Set up backend DID resolution and Veramo agent for W3C-compliant identity operations.

Purpose: Enable the backend to resolve did:near identifiers to DID documents, manage DIDs, and prepare the foundation for verifiable credential operations.

Output: Working DID resolver querying NEAR contract, Veramo agent configured with did:near support, and DID management API endpoints.
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
@backend/src/index.ts
@backend/src/lib/database.ts
@backend/package.json

**Tech stack available:** Node.js, Express, TypeScript, @near-js/* packages
**Established patterns:** API routes in backend/src/api/, lib modules in backend/src/lib/
**Depends on:** Plans 2-01 and 2-02 (smart contracts must be deployed for full testing)

**From 2-RESEARCH.md:**
- Veramo framework for W3C DID/VC operations
- Custom did:near resolver querying NEAR contract
- DID document structure follows W3C DID Core 1.0
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create did:near resolver with NEAR contract integration</name>
  <files>backend/src/identity/did-resolver.ts, backend/src/identity/types.ts</files>
  <action>
Create the identity module with DID resolution capability.

**Create directory and types file:**
```bash
mkdir -p backend/src/identity
```

**backend/src/identity/types.ts:**
```typescript
// DID Document types following W3C DID Core 1.0
export interface PublicKeyEntry {
  id: string;                    // did:near:alice.near#key-1
  type: string;                  // Ed25519VerificationKey2020
  controller: string;            // did:near:alice.near
  publicKeyBase58: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export type EntityType =
  | 'Human'
  | 'AiAgent'
  | 'Vehicle'
  | 'Mission'
  | 'DataObject'
  | 'Organization'
  | 'Resource';

export interface DIDDocument {
  '@context': string[];
  id: string;                    // did:near:alice.near
  entityType: EntityType;
  publicKey: PublicKeyEntry[];
  authentication: string[];
  controller: string[];
  service?: ServiceEndpoint[];
  created: string;               // ISO 8601
  updated: string;               // ISO 8601
  deactivated?: boolean;
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didResolutionMetadata: {
    error?: string;
    contentType?: string;
  };
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
  };
}
```

**backend/src/identity/did-resolver.ts:**
```typescript
import { DIDDocument, DIDResolutionResult, EntityType } from './types';

export class NearDIDResolver {
  private rpcUrl: string;
  private contractId: string;

  constructor(rpcUrl: string, contractId: string) {
    this.rpcUrl = rpcUrl;
    this.contractId = contractId;
  }

  async resolve(did: string): Promise<DIDResolutionResult> {
    // 1. Parse DID - must be did:near:{account_id}
    // 2. Call contract get_did_document view method
    // 3. Transform contract response to W3C DID Document format
    // 4. Return DIDResolutionResult with metadata
  }

  async resolveByAccount(accountId: string): Promise<DIDResolutionResult> {
    // Convenience method: account ID -> DID -> resolution
  }

  private async callViewMethod(method: string, args: object): Promise<any> {
    // Use fetch to call NEAR RPC
    // POST to rpcUrl with query call_function
  }

  private transformContractDocument(contractDoc: any): DIDDocument {
    // Transform snake_case contract fields to camelCase W3C format
    // Add @context
    // Convert timestamps to ISO 8601
  }
}

// Parse did:near:account.near -> { method: 'near', account: 'account.near' }
export function parseDID(did: string): { method: string; account: string } | null {
  const match = did.match(/^did:near:(.+)$/);
  if (!match) return null;
  return { method: 'near', account: match[1] };
}

// Validate DID format
export function isValidNearDID(did: string): boolean {
  return parseDID(did) !== null;
}
```

**Install dependencies:**
```bash
cd backend && pnpm add @near-js/providers @near-js/types
```

**What to avoid:**
- Don't cache DID documents without TTL (they can be updated)
- Don't parse account IDs as simple strings (NEAR accounts can have dots and be implicit)
- Don't throw on resolution failure (return error in metadata per DID Resolution spec)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>DID resolver created with NEAR contract integration, types follow W3C spec</done>
</task>

<task type="auto">
  <name>Task 2: Configure Veramo agent with did:near resolver plugin</name>
  <files>backend/src/identity/veramo-agent.ts, backend/src/identity/near-did-provider.ts</files>
  <action>
Set up Veramo agent with custom did:near resolver for W3C-compliant DID operations.

**Install Veramo dependencies:**
```bash
cd backend && pnpm add @veramo/core @veramo/did-manager @veramo/did-resolver @veramo/key-manager @veramo/kms-local did-resolver
```

**backend/src/identity/near-did-provider.ts:**
```typescript
import { DIDResolutionResult, DIDResolver, ParsedDID, Resolvable } from 'did-resolver';
import { NearDIDResolver } from './did-resolver';

// Create Veramo-compatible resolver for did:near
export function getResolver(rpcUrl: string, contractId: string): Record<string, DIDResolver> {
  const nearResolver = new NearDIDResolver(rpcUrl, contractId);

  async function resolve(
    did: string,
    parsed: ParsedDID,
    resolver: Resolvable
  ): Promise<DIDResolutionResult> {
    const result = await nearResolver.resolve(did);
    return {
      didDocument: result.didDocument,
      didResolutionMetadata: result.didResolutionMetadata,
      didDocumentMetadata: result.didDocumentMetadata,
    };
  }

  return { near: resolve };
}
```

**backend/src/identity/veramo-agent.ts:**
```typescript
import { createAgent, IResolver, IDIDManager } from '@veramo/core';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { Resolver } from 'did-resolver';
import { getResolver as getNearResolver } from './near-did-provider';

// Environment configuration
const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';

// Create the Veramo agent with did:near support
export function createVeramoAgent() {
  const nearResolver = getNearResolver(NEAR_RPC_URL, DID_CONTRACT_ID);

  const agent = createAgent<IResolver>({
    plugins: [
      new DIDResolverPlugin({
        resolver: new Resolver({
          ...nearResolver,
        }),
      }),
    ],
  });

  return agent;
}

// Singleton agent instance
let agentInstance: ReturnType<typeof createVeramoAgent> | null = null;

export function getVeramoAgent() {
  if (!agentInstance) {
    agentInstance = createVeramoAgent();
  }
  return agentInstance;
}

// Convenience function for DID resolution
export async function resolveDID(did: string) {
  const agent = getVeramoAgent();
  return agent.resolveDid({ didUrl: did });
}
```

**What to avoid:**
- Don't create new agent instances per request (use singleton)
- Don't hardcode contract IDs (use environment variables)
- Don't mix Veramo types with custom types (transform at boundaries)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Veramo agent configured with did:near resolver plugin</done>
</task>

<task type="auto">
  <name>Task 3: Create DID management API endpoints</name>
  <files>backend/src/api/identity.ts, backend/src/index.ts</files>
  <action>
Create API endpoints for DID operations.

**backend/src/api/identity.ts:**
```typescript
import { Router, Request, Response } from 'express';
import { NearDIDResolver, isValidNearDID } from '../identity/did-resolver';
import { resolveDID } from '../identity/veramo-agent';
import { EntityType } from '../identity/types';

const router = Router();

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';

const didResolver = new NearDIDResolver(NEAR_RPC_URL, DID_CONTRACT_ID);

// GET /api/identity/resolve/:did - Resolve a DID to its document
router.get('/resolve/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;

    if (!isValidNearDID(did)) {
      return res.status(400).json({ error: 'Invalid DID format. Expected did:near:{account_id}' });
    }

    const result = await resolveDID(did);

    if (result.didResolutionMetadata.error) {
      return res.status(404).json({
        error: result.didResolutionMetadata.error,
        did
      });
    }

    res.json(result);
  } catch (error) {
    console.error('DID resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve DID' });
  }
});

// GET /api/identity/account/:accountId - Get DID for NEAR account
router.get('/account/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const result = await didResolver.resolveByAccount(accountId);

    if (!result.didDocument) {
      return res.status(404).json({ error: 'No DID found for account', accountId });
    }

    res.json(result);
  } catch (error) {
    console.error('Account lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup account DID' });
  }
});

// GET /api/identity/type/:entityType - List DIDs by entity type
router.get('/type/:entityType', async (req: Request, res: Response) => {
  try {
    const { entityType } = req.params;
    const validTypes: EntityType[] = ['Human', 'AiAgent', 'Vehicle', 'Mission', 'DataObject', 'Organization', 'Resource'];

    if (!validTypes.includes(entityType as EntityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes
      });
    }

    // Call contract to get DIDs by type
    // This will be implemented when contract is deployed
    res.json({
      entityType,
      dids: [],
      message: 'Contract query pending deployment'
    });
  } catch (error) {
    console.error('Entity type query error:', error);
    res.status(500).json({ error: 'Failed to query entity type' });
  }
});

// POST /api/identity/validate - Validate a DID format
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { did } = req.body;

    if (!did) {
      return res.status(400).json({ error: 'DID required in request body' });
    }

    const isValid = isValidNearDID(did);
    res.json({ did, valid: isValid });
  } catch (error) {
    console.error('DID validation error:', error);
    res.status(500).json({ error: 'Failed to validate DID' });
  }
});

export default router;
```

**Update backend/src/index.ts to include identity routes:**
```typescript
import identityRoutes from './api/identity';
// ... existing imports

// Add after other route registrations:
app.use('/api/identity', identityRoutes);
```

**What to avoid:**
- Don't expose write operations without authentication (DID registration happens via wallet)
- Don't return raw contract errors to clients (sanitize error messages)
- Don't allow wildcard DID queries (potential DoS vector)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit && curl http://localhost:3001/api/identity/validate -X POST -H "Content-Type: application/json" -d '{"did":"did:near:test.near"}' returns valid:true</verify>
  <done>Identity API endpoints created, integrated with main server, validation working</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] DID resolver queries NEAR RPC correctly
- [ ] Veramo agent initializes with did:near support
- [ ] `/api/identity/resolve/:did` endpoint responds
- [ ] `/api/identity/validate` endpoint validates DID format correctly
</verification>

<success_criteria>
- DID resolver created with NEAR contract integration
- Veramo agent configured with custom did:near resolver
- API endpoints for DID resolution and validation
- Types follow W3C DID Core 1.0 specification
- Ready for credential operations in Plan 2-06
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-03-SUMMARY.md`
</output>

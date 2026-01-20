---
phase: 02-identity-security-framework
plan: 08
type: execute
---

<objective>
Integrate identity system into frontend with automatic DID creation and authentication bridge updates.

Purpose: Enable transparent identity operations where entities get DIDs automatically on registration, and authentication flows (Privy) are connected to the DID system.

Output: Frontend identity integration with automatic DID creation, Privy-to-DID mapping, and event-driven entity registration patterns.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@frontend/src/components/AuthWrapper.tsx
@frontend/src/lib/mpcRecovery.ts

**Tech stack available:** React, Privy.io, @near-js/*, TypeScript
**Established patterns:** AuthWrapper component, MPC recovery service
**Depends on:** Plan 2-01 (DID registry contract deployed for full testing)

**From 2-CONTEXT.md:**
- Automatic DID creation on entity creation
- Event-driven onboarding (system notices and proposes registration)
- Privy → DID mapping for user identity
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create identity service for frontend DID operations</name>
  <files>frontend/src/lib/identity.ts, frontend/src/lib/types/identity.ts</files>
  <action>
Create frontend identity service for DID operations and Privy integration.

**Create types file:**
```bash
mkdir -p frontend/src/lib/types
```

**frontend/src/lib/types/identity.ts:**
```typescript
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
  id: string;
  entityType: EntityType;
  publicKey: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyBase58: string;
  }>;
  authentication: string[];
  controller: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  created: string;
  updated: string;
  deactivated?: boolean;
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didResolutionMetadata: {
    error?: string;
  };
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
  };
}

export interface EntityRegistration {
  entityType: EntityType;
  name: string;
  description?: string;
  attributes?: Record<string, unknown>;
}
```

**frontend/src/lib/identity.ts:**
```typescript
import { EntityType, DIDResolutionResult, EntityRegistration } from './types/identity';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Resolve a DID to its document
 */
export async function resolveDID(did: string): Promise<DIDResolutionResult> {
  const response = await fetch(`${BACKEND_URL}/api/identity/resolve/${encodeURIComponent(did)}`);

  if (!response.ok) {
    const error = await response.json();
    return {
      didDocument: null,
      didResolutionMetadata: { error: error.error || 'Resolution failed' },
      didDocumentMetadata: {}
    };
  }

  return response.json();
}

/**
 * Get DID for a NEAR account
 */
export async function getDIDByAccount(accountId: string): Promise<string | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/identity/account/${encodeURIComponent(accountId)}`);

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.didDocument?.id || null;
  } catch (error) {
    console.error('Failed to get DID for account:', error);
    return null;
  }
}

/**
 * Check if a user has a DID registered
 */
export async function hasUserDID(accountId: string): Promise<boolean> {
  const did = await getDIDByAccount(accountId);
  return did !== null;
}

/**
 * Get all DIDs of a specific entity type
 */
export async function getDIDsByType(entityType: EntityType): Promise<string[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/identity/type/${entityType}`);

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    return result.dids || [];
  } catch (error) {
    console.error('Failed to get DIDs by type:', error);
    return [];
  }
}

/**
 * Validate DID format
 */
export async function validateDID(did: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/identity/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did })
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    console.error('Failed to validate DID:', error);
    return false;
  }
}

/**
 * Format DID for display (truncate middle)
 */
export function formatDID(did: string, maxLength: number = 24): string {
  if (did.length <= maxLength) {
    return did;
  }

  const prefix = did.slice(0, 12);
  const suffix = did.slice(-8);
  return `${prefix}...${suffix}`;
}

/**
 * Parse DID to extract account ID
 */
export function parseDID(did: string): { method: string; account: string } | null {
  const match = did.match(/^did:near:(.+)$/);
  if (!match) return null;
  return { method: 'near', account: match[1] };
}

/**
 * Build DID from NEAR account ID
 */
export function buildDID(accountId: string): string {
  return `did:near:${accountId}`;
}

// Entity registration events for reactive UI
type EntityEventCallback = (entity: EntityRegistration, did: string) => void;
const entityEventListeners: EntityEventCallback[] = [];

/**
 * Subscribe to entity registration events
 */
export function onEntityRegistered(callback: EntityEventCallback): () => void {
  entityEventListeners.push(callback);
  return () => {
    const index = entityEventListeners.indexOf(callback);
    if (index > -1) {
      entityEventListeners.splice(index, 1);
    }
  };
}

/**
 * Emit entity registration event (called after successful registration)
 */
export function emitEntityRegistered(entity: EntityRegistration, did: string): void {
  entityEventListeners.forEach(callback => {
    try {
      callback(entity, did);
    } catch (error) {
      console.error('Entity event callback error:', error);
    }
  });
}
```

**What to avoid:**
- Don't call contract directly from frontend (use backend API)
- Don't cache DID documents without invalidation
- Don't expose internal errors to users
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/frontend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Frontend identity service created with DID resolution, validation, and event system</done>
</task>

<task type="auto">
  <name>Task 2: Update AuthWrapper to create DID on user registration</name>
  <files>frontend/src/components/AuthWrapper.tsx</files>
  <action>
Update AuthWrapper to automatically create a DID for new users after Privy authentication.

**Modifications to AuthWrapper.tsx:**

1. Import identity functions:
```typescript
import { hasUserDID, buildDID, emitEntityRegistered } from '../lib/identity';
import { EntityType } from '../lib/types/identity';
```

2. Add DID creation after NEAR account creation (in the existing flow):

After the MPC account creation succeeds, add DID registration:
```typescript
// After NEAR account is created/recovered, check if DID exists
const userDID = buildDID(nearAccount.accountId);
const hasDID = await hasUserDID(nearAccount.accountId);

if (!hasDID) {
  console.log('Creating DID for new user...');

  // Call backend to register DID (which calls smart contract)
  try {
    const response = await fetch(`${BACKEND_URL}/api/identity/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: nearAccount.accountId,
        entityType: 'Human'
      })
    });

    if (response.ok) {
      console.log('DID created:', userDID);

      // Emit event for UI updates
      emitEntityRegistered(
        { entityType: 'Human', name: user.email || nearAccount.accountId },
        userDID
      );
    }
  } catch (error) {
    // DID creation failure shouldn't block login
    console.warn('DID creation deferred:', error);
  }
}

// Store DID in local state for easy access
setUserDID(userDID);
```

3. Add state for user DID:
```typescript
const [userDID, setUserDID] = useState<string | null>(null);
```

4. Expose DID in context (if using context) or pass to children:
```typescript
// In the authenticated render path
{children && React.cloneElement(children as React.ReactElement, { userDID })}
```

**Key behavior:**
- DID creation is automatic and invisible to user
- Failure doesn't block login (graceful degradation)
- DID is derived deterministically from NEAR account
- Event emitted for other components to react

**What to avoid:**
- Don't block authentication on DID creation failure
- Don't create multiple DIDs for same account (check first)
- Don't expose DID creation errors to user (log only)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/frontend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>AuthWrapper updated to automatically create DIDs for new users</done>
</task>

<task type="auto">
  <name>Task 3: Implement blockchain event listener for NEAR → PostgreSQL sync</name>
  <files>backend/src/lib/blockchain-sync.ts, backend/src/lib/near-events.ts</files>
  <action>
Complete the deferred blockchain event listener that syncs NEAR blockchain events to PostgreSQL. This was noted as "deferred to Phase 2" in Plan 1-03A.

**Create backend/src/lib/near-events.ts:**
```typescript
import { providers } from 'near-api-js';
import { getPool } from './database.js';

interface BlockchainEvent {
  eventType: string;
  aggregateId: string;
  eventData: Record<string, unknown>;
  blockchainTxHash: string;
  blockHeight: number;
  timestamp: number;
}

// Track last processed block to avoid reprocessing
let lastProcessedBlock: number = 0;

/**
 * Parse receipt outcomes for events emitted by our contract
 */
function parseReceiptOutcomes(
  receiptOutcomes: providers.ExecutionOutcomeWithId[],
  txHash: string,
  blockHeight: number,
  timestamp: number
): BlockchainEvent[] {
  const events: BlockchainEvent[] = [];

  for (const outcome of receiptOutcomes) {
    // Look for logs that are JSON events (NEAR event standard)
    for (const log of outcome.outcome.logs) {
      if (log.startsWith('EVENT_JSON:')) {
        try {
          const eventData = JSON.parse(log.substring(11));

          // Map NEAR event to our event structure
          if (eventData.standard === 'nep297' || eventData.event) {
            events.push({
              eventType: eventData.event || eventData.type || 'unknown',
              aggregateId: eventData.data?.id || eventData.data?.document_hash || outcome.id,
              eventData: eventData.data || eventData,
              blockchainTxHash: txHash,
              blockHeight,
              timestamp
            });
          }
        } catch (e) {
          // Not a JSON event, skip
        }
      }
    }
  }

  return events;
}

/**
 * Store blockchain events in PostgreSQL
 */
async function storeBlockchainEvents(events: BlockchainEvent[]): Promise<void> {
  if (events.length === 0) return;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    for (const event of events) {
      // Check if already processed (idempotency)
      const existing = await client.query(
        `SELECT 1 FROM blockchain_events WHERE blockchain_tx_hash = $1 AND aggregate_id = $2`,
        [event.blockchainTxHash, event.aggregateId]
      );

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO blockchain_events (event_type, aggregate_id, event_data, blockchain_tx_hash, created_at)
          VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000000000.0))
        `, [
          event.eventType,
          event.aggregateId,
          JSON.stringify(event.eventData),
          event.blockchainTxHash,
          event.timestamp
        ]);

        console.log(`✓ Synced blockchain event: ${event.eventType} (${event.aggregateId})`);

        // Handle specific event types
        if (event.eventType === 'document_registered') {
          // Sync document if registered externally
          await syncExternalDocument(client, event);
        } else if (event.eventType === 'did_registered') {
          // Sync DID if registered externally
          await syncExternalDID(client, event);
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sync a document that was registered on blockchain but not in PostgreSQL
 */
async function syncExternalDocument(client: any, event: BlockchainEvent): Promise<void> {
  const docHash = event.eventData.document_hash as string;
  if (!docHash) return;

  // Check if we already have this document
  const existing = await client.query(
    `SELECT 1 FROM documents WHERE document_id = $1 OR blockchain_tx_hash = $2`,
    [docHash, event.blockchainTxHash]
  );

  if (existing.rows.length === 0) {
    // Insert placeholder for externally registered document
    await client.query(`
      INSERT INTO documents (document_id, encrypted_cid, owner_account_id, blockchain_tx_hash, blockchain_synced, created_at)
      VALUES ($1, $2, $3, $4, true, to_timestamp($5 / 1000000000.0))
      ON CONFLICT DO NOTHING
    `, [
      docHash,
      event.eventData.cid || 'external',
      event.eventData.owner || 'external',
      event.blockchainTxHash,
      event.timestamp
    ]);
  }
}

/**
 * Sync a DID that was registered on blockchain but not in local cache
 */
async function syncExternalDID(client: any, event: BlockchainEvent): Promise<void> {
  // DIDs are resolved on-demand from blockchain, but we log the event
  console.log(`DID registered on chain: ${event.eventData.did || event.aggregateId}`);
}

/**
 * Poll NEAR RPC for recent blocks and extract events
 */
export async function pollBlockchainEvents(): Promise<void> {
  const rpcUrl = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
  const contractId = process.env.NEAR_CONTRACT_ID || 'bastion.testnet';

  const provider = new providers.JsonRpcProvider({ url: rpcUrl });

  try {
    // Get current block height
    const status = await provider.status();
    const currentBlock = status.sync_info.latest_block_height;

    // Initialize last processed block if needed
    if (lastProcessedBlock === 0) {
      // Start from recent blocks (last 100 blocks on first run)
      lastProcessedBlock = Math.max(0, currentBlock - 100);
      console.log(`Blockchain event sync starting from block ${lastProcessedBlock}`);
    }

    // Process blocks in batches
    const blocksToProcess = Math.min(10, currentBlock - lastProcessedBlock);

    for (let i = 0; i < blocksToProcess; i++) {
      const blockHeight = lastProcessedBlock + i + 1;

      try {
        // Get block by height
        const block = await provider.block({ blockId: blockHeight });

        // Process each chunk in the block
        for (const chunkHeader of block.chunks) {
          if (chunkHeader.tx_root === '11111111111111111111111111111111') {
            continue; // Empty chunk
          }

          try {
            const chunk = await provider.chunk(chunkHeader.chunk_hash);

            // Check transactions for our contract
            for (const tx of chunk.transactions || []) {
              if (tx.receiver_id === contractId) {
                // Get full transaction outcome
                const outcome = await provider.txStatus(
                  tx.hash,
                  tx.signer_id
                );

                const events = parseReceiptOutcomes(
                  outcome.receipts_outcome,
                  tx.hash,
                  blockHeight,
                  block.header.timestamp
                );

                if (events.length > 0) {
                  await storeBlockchainEvents(events);
                }
              }
            }
          } catch (chunkError: any) {
            // Chunk might not be available, skip
            if (!chunkError.message?.includes('UNKNOWN_CHUNK')) {
              console.warn(`Error processing chunk: ${chunkError.message}`);
            }
          }
        }
      } catch (blockError: any) {
        if (!blockError.message?.includes('UNKNOWN_BLOCK')) {
          console.warn(`Error processing block ${blockHeight}: ${blockError.message}`);
        }
      }
    }

    lastProcessedBlock = Math.min(currentBlock, lastProcessedBlock + blocksToProcess);

  } catch (error: any) {
    console.error('Blockchain event polling error:', error.message);
    // Don't throw - let the worker retry
  }
}

/**
 * Get sync status
 */
export function getSyncStatus(): { lastBlock: number; running: boolean } {
  return {
    lastBlock: lastProcessedBlock,
    running: lastProcessedBlock > 0
  };
}
```

**Update backend/src/lib/blockchain-sync.ts to integrate the event listener:**

Add import at top:
```typescript
import { pollBlockchainEvents, getSyncStatus } from './near-events.js';
```

Replace the stub `syncBlockchainEventsWorker` function:
```typescript
/**
 * Listen to NEAR blockchain events and sync to PostgreSQL
 */
async function syncBlockchainEventsWorker() {
  await boss.work('sync-blockchain-events', async (_job: any) => {
    await pollBlockchainEvents();
  });
}
```

In `startSyncWorkers`, add queue creation and scheduling:
```typescript
// Create blockchain events queue
await boss.createQueue('sync-blockchain-events');

// Register the worker
await syncBlockchainEventsWorker();

// Schedule blockchain event sync every 30 seconds
await boss.schedule('sync-blockchain-events', '*/30 * * * * *');
```

Update the console output:
```typescript
console.log('✓ Blockchain sync workers started');
console.log('  - Outbox processor: every 5 seconds');
console.log('  - Blockchain event listener: every 30 seconds');
```

**Key design decisions:**
- Polling-based (not WebSocket) for simplicity and reliability
- 30-second intervals to balance freshness vs RPC load
- Idempotent storage (won't duplicate on re-process)
- Batch processing (10 blocks at a time)
- Graceful error handling (continues on partial failures)

**What to avoid:**
- Don't use WebSocket subscriptions (flaky, reconnect complexity)
- Don't process every block individually (too slow)
- Don't skip idempotency checks (causes duplicates)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors; grep -q "sync-blockchain-events" src/lib/blockchain-sync.ts</verify>
  <done>Blockchain event listener implemented with NEAR RPC polling, event parsing, and PostgreSQL sync</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Identity system integration with automatic DID creation on user login, plus blockchain event listener for NEAR → PostgreSQL sync.

**What was implemented:**
1. Frontend identity service with DID resolution API
2. Entity type definitions matching smart contract
3. Event system for entity registration notifications
4. AuthWrapper integration for automatic DID creation
5. Privy user → NEAR account → DID mapping flow
6. Blockchain event listener polling NEAR RPC every 30 seconds
7. Event parsing for document_registered and did_registered events
8. Idempotent storage of blockchain events to PostgreSQL
  </what-built>
  <how-to-verify>
1. Start the development environment:
   ```bash
   cd /home/vitalpointai/projects/ssr
   docker-compose up -d
   cd frontend && pnpm dev
   ```

2. Open browser to http://localhost:5173

3. Log in with Privy (email or social):
   - Click "Access System" or login button
   - Complete Privy authentication

4. Check browser console for:
   - "Creating DID for new user..." message
   - "DID created: did:near:{account}" confirmation
   - No red errors during the flow

5. Verify backend received the request:
   - Check backend logs for identity registration API call
   - Confirm 200 response (or graceful failure if contract not deployed)

6. Test DID resolution (in browser console):
   ```javascript
   // Import in dev tools won't work, but the API should respond:
   fetch('http://localhost:3001/api/identity/validate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ did: 'did:near:test.near' })
   }).then(r => r.json()).then(console.log)
   ```

7. Verify blockchain event listener is running:
   - Check backend logs for "Blockchain event sync starting from block XXXX"
   - Should see "- Blockchain event listener: every 30 seconds" in startup logs
   - No errors from the sync worker

8. Confirm user experience:
   - Login flow completes normally (not blocked)
   - No visible errors or prompts about identity
   - User lands on authenticated dashboard
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe any issues encountered</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in frontend passes without errors
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] Identity service exports DID resolution and validation functions
- [ ] AuthWrapper creates DID automatically for new users
- [ ] DID creation failure doesn't block authentication
- [ ] Blockchain event listener polls NEAR RPC every 30 seconds
- [ ] Human verification confirms login flow works correctly
</verification>

<success_criteria>
- Frontend identity service created
- Automatic DID creation integrated into AuthWrapper
- Event system for entity registration
- Blockchain event listener syncing NEAR → PostgreSQL
- Login flow verified working end-to-end
- Identity creation is invisible to users
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-08-SUMMARY.md`
</output>

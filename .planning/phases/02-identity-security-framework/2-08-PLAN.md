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

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Identity system integration with automatic DID creation on user login.

**What was implemented:**
1. Frontend identity service with DID resolution API
2. Entity type definitions matching smart contract
3. Event system for entity registration notifications
4. AuthWrapper integration for automatic DID creation
5. Privy user → NEAR account → DID mapping flow
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

7. Confirm user experience:
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
- [ ] Identity service exports DID resolution and validation functions
- [ ] AuthWrapper creates DID automatically for new users
- [ ] DID creation failure doesn't block authentication
- [ ] Human verification confirms login flow works correctly
</verification>

<success_criteria>
- Frontend identity service created
- Automatic DID creation integrated into AuthWrapper
- Event system for entity registration
- Login flow verified working end-to-end
- Identity creation is invisible to users
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-08-SUMMARY.md`
</output>

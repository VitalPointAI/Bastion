---
phase: 02-identity-security-framework
plan: 07
type: execute
---

<objective>
Implement Zero Trust middleware that integrates DID resolution, credential verification, and ABAC enforcement.

Purpose: Create the security layer that transparently validates every request by resolving the caller's DID, fetching their credentials, and evaluating ABAC policies before allowing access to protected resources.

Output: Working Express middleware that enforces zero trust principles with DID-based identity and attribute-based access control.
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
@backend/src/identity/did-resolver.ts
@backend/src/security/abac-enforcer.ts
@backend/src/credentials/credential-service.ts

**Tech stack available:** Express middleware, DID resolver, ABAC enforcer, credential service
**Established patterns:** Express router middleware
**Depends on:** Plan 2-03 (DID resolution), Plan 2-04 (ABAC), Plan 2-06 (credentials)

**From 2-RESEARCH.md:**
- Zero trust request validation pattern
- Continuous verification (not one-time auth)
- DID attributes fed to ABAC enforcer

**From 2-CONTEXT.md:**
- Invisible security - users shouldn't think about policies
- System automatically enforces based on DID attributes
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create attribute provider service to fetch subject attributes from DIDs</name>
  <files>backend/src/security/attribute-provider.ts</files>
  <action>
Create service that fetches subject attributes from DID credentials for ABAC evaluation.

**backend/src/security/attribute-provider.ts:**
```typescript
import { NearDIDResolver } from '../identity/did-resolver';
import { SubjectAttributes, ObjectAttributes } from './abac-enforcer';
import { ClearanceLevel } from '../credentials/schemas';

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';
const CREDENTIAL_CONTRACT_ID = process.env.CREDENTIAL_CONTRACT_ID || 'credential-registry.testnet';

const didResolver = new NearDIDResolver(NEAR_RPC_URL, DID_CONTRACT_ID);

// Cache for subject attributes (TTL-based)
interface CachedAttributes {
  attributes: SubjectAttributes;
  fetchedAt: number;
}

const attributeCache = new Map<string, CachedAttributes>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetch subject attributes from DID credentials
 * In production, this queries the credential registry for active credentials
 */
export async function getSubjectAttributes(did: string): Promise<SubjectAttributes | null> {
  // Check cache first
  const cached = attributeCache.get(did);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.attributes;
  }

  try {
    // Resolve DID document
    const resolution = await didResolver.resolve(did);
    if (!resolution.didDocument) {
      return null;
    }

    // In a full implementation, we would:
    // 1. Query credential registry for credentials where subject = did
    // 2. Verify each credential is still active (not revoked/expired)
    // 3. Extract attributes from credential subjects
    // 4. Merge into unified SubjectAttributes

    // For now, return default attributes from DID document
    // This will be enhanced when credential querying is fully implemented
    const attributes: SubjectAttributes = {
      did,
      clearance: 'UNCLASS',  // Default, updated from SecurityClearanceCredential
      nationality: 'USA',     // Default, updated from credential
      organization: '',
      role: '',
      caveats: {
        releasability: [],
        bilateral: [],
        specialAccess: []
      }
    };

    // Cache the attributes
    attributeCache.set(did, {
      attributes,
      fetchedAt: Date.now()
    });

    return attributes;
  } catch (error) {
    console.error(`Failed to fetch attributes for DID ${did}:`, error);
    return null;
  }
}

/**
 * Extract object attributes from request context
 * Object attributes come from the resource being accessed
 */
export function getObjectAttributes(
  resource: {
    classification?: ClearanceLevel;
    releasability?: string[];
    dissemination?: string[];
    bilateralMarking?: string;
    originator?: string;
    orcon?: boolean;
  }
): ObjectAttributes {
  return {
    classification: resource.classification || 'UNCLASS',
    releasability: resource.releasability || [],
    dissemination: resource.dissemination || [],
    bilateralMarking: resource.bilateralMarking,
    originator: resource.originator || '',
    orcon: resource.orcon || false
  };
}

/**
 * Invalidate cache for a DID (call when credentials change)
 */
export function invalidateAttributeCache(did: string): void {
  attributeCache.delete(did);
}

/**
 * Clear all cached attributes (for testing or credential updates)
 */
export function clearAttributeCache(): void {
  attributeCache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): { size: number; ttlMs: number } {
  return {
    size: attributeCache.size,
    ttlMs: CACHE_TTL_MS
  };
}
```

**What to avoid:**
- Don't cache indefinitely (credentials can be revoked)
- Don't fail open (missing attributes = deny)
- Don't expose detailed attribute errors to clients
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Attribute provider service created with caching and DID credential fetching</done>
</task>

<task type="auto">
  <name>Task 2: Create Zero Trust middleware for Express routes</name>
  <files>backend/src/security/zero-trust-middleware.ts, backend/src/security/index.ts</files>
  <action>
Create Express middleware that enforces zero trust on protected routes.

**backend/src/security/zero-trust-middleware.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { ABACEnforcer } from './abac-enforcer';
import { getSubjectAttributes, getObjectAttributes } from './attribute-provider';
import { isValidNearDID } from '../identity/did-resolver';

// Extend Express Request with zero trust context
declare global {
  namespace Express {
    interface Request {
      zeroTrust?: {
        did: string;
        attributes: import('./abac-enforcer').SubjectAttributes;
        verifiedAt: number;
      };
    }
  }
}

// Initialize ABAC enforcer (singleton)
let enforcerInstance: ABACEnforcer | null = null;

async function getEnforcer(): Promise<ABACEnforcer> {
  if (!enforcerInstance) {
    enforcerInstance = new ABACEnforcer();
    await enforcerInstance.initialize();
  }
  return enforcerInstance;
}

/**
 * Extract DID from request
 * Supports: Authorization header (Bearer token), X-DID header, or query param
 */
function extractDID(req: Request): string | null {
  // 1. Check Authorization header (JWT with DID claim - future)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // In production, decode JWT and extract DID claim
    // For now, treat token as DID directly for testing
    const token = authHeader.slice(7);
    if (isValidNearDID(token)) {
      return token;
    }
  }

  // 2. Check X-DID header (development/testing)
  const didHeader = req.headers['x-did'];
  if (typeof didHeader === 'string' && isValidNearDID(didHeader)) {
    return didHeader;
  }

  // 3. Check query parameter (development only)
  const didQuery = req.query.did;
  if (typeof didQuery === 'string' && isValidNearDID(didQuery)) {
    return didQuery;
  }

  return null;
}

/**
 * Zero Trust authentication middleware
 * Verifies caller identity via DID and attaches attributes to request
 */
export function zeroTrustAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const did = extractDID(req);

    if (!did) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide DID via Authorization header, X-DID header, or query param'
      });
    }

    // Fetch subject attributes
    const attributes = await getSubjectAttributes(did);

    if (!attributes) {
      return res.status(401).json({
        error: 'Identity not found',
        message: 'DID not registered or credentials unavailable'
      });
    }

    // Attach zero trust context to request
    req.zeroTrust = {
      did,
      attributes,
      verifiedAt: Date.now()
    };

    next();
  };
}

/**
 * Zero Trust authorization middleware
 * Checks ABAC policy for specific resource access
 */
export function zeroTrustAuthorize(
  getResourceAttributes: (req: Request) => {
    classification?: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
    releasability?: string[];
    dissemination?: string[];
    bilateralMarking?: string;
    originator?: string;
    orcon?: boolean;
  }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Ensure authentication happened first
    if (!req.zeroTrust) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Apply zeroTrustAuth middleware before zeroTrustAuthorize'
      });
    }

    const enforcer = await getEnforcer();

    // Get object attributes from request context
    const resourceAttrs = getResourceAttributes(req);
    const objectAttributes = getObjectAttributes(resourceAttrs);

    // Map HTTP method to action
    const action = mapMethodToAction(req.method);

    // Evaluate ABAC policy
    const allowed = await enforcer.enforce(
      req.zeroTrust.attributes,
      objectAttributes,
      action
    );

    if (!allowed) {
      // Log denial for audit (without sensitive details)
      console.log(`Access denied: ${req.zeroTrust.did} -> ${req.path} (${action})`);

      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions for this resource'
        // Don't reveal WHY access was denied (security)
      });
    }

    next();
  };
}

/**
 * Map HTTP method to ABAC action
 */
function mapMethodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'read';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'write';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

/**
 * Optional middleware to require specific clearance level
 */
export function requireClearance(minLevel: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET') {
  const levelMap = {
    'UNCLASS': 1,
    'CUI': 2,
    'CONFIDENTIAL': 3,
    'SECRET': 4,
    'TOPSECRET': 5
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.zeroTrust) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subjectLevel = levelMap[req.zeroTrust.attributes.clearance];
    const requiredLevel = levelMap[minLevel];

    if (subjectLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Insufficient clearance',
        message: `This resource requires ${minLevel} clearance`
      });
    }

    next();
  };
}
```

**backend/src/security/index.ts:**
```typescript
export * from './abac-enforcer';
export * from './attribute-provider';
export * from './zero-trust-middleware';
```

**What to avoid:**
- Don't reveal why access was denied (info leakage)
- Don't fail open on errors (deny by default)
- Don't skip auth middleware on protected routes
- Don't cache authorization decisions (policies can change)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Zero Trust middleware created with authentication and authorization layers</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] Attribute provider fetches and caches subject attributes
- [ ] Zero trust auth middleware extracts DID from request
- [ ] Zero trust authorize middleware evaluates ABAC policy
- [ ] Access denials logged for audit
- [ ] No sensitive information leaked in error responses
</verification>

<success_criteria>
- Attribute provider with DID credential fetching
- Zero trust auth middleware extracts and verifies DID
- Zero trust authorize middleware evaluates ABAC
- Clearance level shortcut middleware
- Security module exports cleanly
- Invisible to users (automatic enforcement)
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-07-SUMMARY.md`
</output>

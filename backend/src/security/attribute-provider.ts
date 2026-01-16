import { getDIDService } from '../identity/did-service.js';
import { SubjectAttributes, ObjectAttributes } from './abac-enforcer.js';
import { ClearanceLevel } from '../credentials/schemas.js';

/**
 * Attribute Provider Service
 *
 * Fetches subject attributes from DID credentials for ABAC evaluation.
 * Implements caching to reduce on-chain queries while respecting credential revocation.
 */

// Cache for subject attributes (TTL-based)
interface CachedAttributes {
  attributes: SubjectAttributes;
  fetchedAt: number;
}

const attributeCache = new Map<string, CachedAttributes>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Validate NEAR DID format
 */
export function isValidNearDID(did: string): boolean {
  // NEAR DIDs follow pattern: did:near:<account-id>
  const pattern = /^did:near:[a-zA-Z0-9._-]+$/;
  return pattern.test(did);
}

/**
 * Extract account ID from NEAR DID
 */
export function extractAccountIdFromDID(did: string): string | null {
  if (!isValidNearDID(did)) return null;
  return did.replace('did:near:', '');
}

/**
 * Fetch subject attributes from DID credentials
 * In production, this queries the credential registry for active credentials
 */
export async function getSubjectAttributes(
  did: string,
  userSecret?: Uint8Array
): Promise<SubjectAttributes | null> {
  // Check cache first
  const cached = attributeCache.get(did);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.attributes;
  }

  try {
    // In a full implementation with userSecret, we would:
    // 1. Resolve DID document via DIDService.resolveDID()
    // 2. Query credential registry for credentials where subject = did
    // 3. Verify each credential is still active (not revoked/expired)
    // 4. Extract attributes from credential subjects
    // 5. Merge into unified SubjectAttributes

    // For now, return default attributes from DID
    // This will be enhanced when full credential querying is implemented
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

    // If userSecret provided, try to resolve full DID document
    if (userSecret) {
      const accountId = extractAccountIdFromDID(did);
      if (accountId) {
        const didService = getDIDService();
        const document = await didService.resolveDID(accountId, userSecret);

        if (document) {
          // DID document exists and is valid - use it
          // In production, we'd extract more attributes from credentials
          attributes.did = document.id;
        }
      }
    }

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

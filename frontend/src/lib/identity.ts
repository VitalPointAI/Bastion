import type { EntityType, DIDResolutionResult, EntityRegistration } from './types/identity';

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

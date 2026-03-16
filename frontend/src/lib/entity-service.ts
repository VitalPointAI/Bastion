/**
 * Entity Service
 *
 * Phase 33 Plan 04: API client for entity search, merge, alias, and references.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend) ──────────────────────────────────────────

export type EntityType = 'nation' | 'organization' | 'person' | 'location' | 'equipment' | 'unit';

export interface Entity {
  id: string;
  canonicalName: string;
  entityType: EntityType;
  aliases: string[];
  metadata: Record<string, unknown>;
  // JSON-LD provenance fields (populated after Plan 47 migration)
  jsonldType?: string;
  confidence?: number;
  confidenceTier?: 'high' | 'medium' | 'low';
  assertedVia?: string;
  validFrom?: string;
  validTo?: string | null;
}

export interface EntityReference {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  mentionCount: number;
}

export interface EntitySearchResult {
  entities: Entity[];
  total: number;
}

export interface MergeResult {
  targetId: string;
  mergedCount: number;
  success: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map a SourceMethod value to a human-readable label.
 * Gracefully returns the raw value for unknown methods.
 */
export function formatSourceMethod(method: string): string {
  const labels: Record<string, string> = {
    doc_intelligence: 'Document Intelligence',
    osint: 'OSINT Feed',
    manual_entry: 'Manual Entry',
    vision_pipeline: 'Vision Detection',
    ai_inference: 'AI Inference',
    sigint: 'SIGINT',
  };
  return labels[method] ?? method;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const entityService = {
  /**
   * Search entities by query string with optional type filter.
   */
  async searchEntities(query: string, type?: EntityType): Promise<EntitySearchResult> {
    const params = new URLSearchParams({ q: query });
    if (type) params.set('type', type);
    const res = await fetch(`${API_BASE}/api/jpp/entities/search?${params}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to search entities: ${res.statusText}`);
    return res.json();
  },

  /**
   * Merge multiple entities into a target entity.
   */
  async mergeEntities(sourceIds: string[], targetId: string): Promise<MergeResult> {
    const res = await fetch(`${API_BASE}/api/jpp/entities/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sourceIds, targetId }),
    });
    if (!res.ok) throw new Error(`Failed to merge entities: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create an alias for an entity.
   */
  async createAlias(canonicalId: string, alias: string, source: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/jpp/entities/alias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ canonicalId, alias, source }),
    });
    if (!res.ok) throw new Error(`Failed to create entity alias: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get all references to an entity across the system.
   */
  async getEntityReferences(entityId: string): Promise<EntityReference[]> {
    const res = await fetch(`${API_BASE}/api/jpp/entities/${entityId}/references`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get entity references: ${res.statusText}`);
    return res.json();
  },
};

/**
 * useBrainData - data hook that fetches all four node types and merges them into
 * a single BrainGraphData structure ready for ForceGraph2D rendering.
 *
 * Four source endpoints:
 *   1. GET /api/graph/workspaces/:id/graph        → actor nodes + relationship edges
 *   2. GET /api/graph/actors?workspaceId=:id      → actor details with categories
 *   3. GET /api/graph/validity/objectives?workspaceId=:id → strategic objectives
 *   4. GET /api/doc-intelligence/documents/:id   → strategic documents
 *
 * NOTE: The graph API uses the parameter name "workspaceId" — this equals the
 * problemSetId passed to this hook (BASTION renamed "workspaces" → "problem sets"
 * in the UI, but the REST routes still use the legacy term).
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  BrainNode,
  BrainEdge,
  BrainGraphData,
  ActorCategory,
} from '../types.js';

// ─── API base ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Raw API shapes ────────────────────────────────────────────────────────────

interface RawGraphNode {
  id: string;
  label?: string;
  name?: string;
  type?: string;
}

interface RawGraphEdge {
  source: string;
  target: string;
  type?: string;
  strength?: number;
}

interface RawGraphResponse {
  nodes?: RawGraphNode[];
  edges?: RawGraphEdge[];
  links?: RawGraphEdge[];
}

interface RawActor {
  id: string;
  name?: string;
  actor_category?: string;
  actor_type?: string;
  sourceDocumentIds?: string[];
  relationships?: unknown[];
  validity_score?: number;
}

interface RawActorsResponse {
  actors?: RawActor[];
}

interface RawObjective {
  id: string;
  objective_text?: string;
  midlife_category?: string;
  extraction_confidence?: number;
  created_at?: string;
}

interface RawObjectivesResponse {
  objectives?: RawObjective[];
}

interface RawDocument {
  id: string;
  document_name?: string;
  filename?: string;
  quality_rating?: number;
  created_at?: string;
}

interface RawDocumentsResponse {
  documents?: RawDocument[];
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseBrainDataReturn {
  data: BrainGraphData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map raw actor_category string to strongly-typed ActorCategory */
function toActorCategory(raw?: string): ActorCategory | undefined {
  const map: Record<string, ActorCategory> = {
    ally: 'ally',
    allied: 'ally',
    adversary: 'adversary',
    enemy: 'adversary',
    neutral: 'neutral',
    partner: 'partner',
  };
  if (!raw) return undefined;
  return map[raw.toLowerCase()] ?? 'neutral';
}

/**
 * Compute a proxy confidence score for an actor node.
 *
 * Research pitfall 7: actors don't have a first-class confidence field —
 * so we synthesize one from evidence density:
 *   confidence = min(1, sourceDocCount*0.3 + relationshipCount*0.2 + validityScore*0.5)
 * When there are no source documents, confidence defaults to 0.3 (low).
 */
function actorConfidence(actor: RawActor): number {
  const sourceDocCount = actor.sourceDocumentIds?.length ?? 0;
  const relationshipCount = Array.isArray(actor.relationships) ? actor.relationships.length : 0;
  const validityScore = actor.validity_score ?? 0;

  if (sourceDocCount === 0 && relationshipCount === 0) {
    return 0.3;
  }
  return Math.min(1, sourceDocCount * 0.3 + relationshipCount * 0.2 + validityScore * 0.5);
}

/** Safe JSON fetch — returns null on non-OK or network error */
async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrainData(problemSetId: string): UseBrainDataReturn {
  const [data, setData] = useState<BrainGraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!problemSetId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch all four sources in parallel
    Promise.all([
      safeFetch<RawGraphResponse>(
        `${API_BASE}/api/graph/workspaces/${encodeURIComponent(problemSetId)}/graph`,
      ),
      safeFetch<RawActorsResponse>(
        `${API_BASE}/api/graph/actors?workspaceId=${encodeURIComponent(problemSetId)}`,
      ),
      safeFetch<RawObjectivesResponse>(
        `${API_BASE}/api/graph/validity/objectives?workspaceId=${encodeURIComponent(problemSetId)}`,
      ),
      safeFetch<RawDocumentsResponse>(
        `${API_BASE}/api/doc-intelligence/documents/${encodeURIComponent(problemSetId)}`,
      ),
    ])
      .then(([graphResp, actorsResp, objectivesResp, documentsResp]) => {
        if (cancelled) return;

        const nodes: BrainNode[] = [];
        const nodeIds = new Set<string>();

        // ── Build an actor detail lookup (by id) ──────────────────────────────
        const actorMap = new Map<string, RawActor>();
        for (const a of actorsResp?.actors ?? []) {
          actorMap.set(a.id, a);
        }

        // ── 1. Actor nodes from graph endpoint + detail from actors endpoint ──
        for (const rawNode of graphResp?.nodes ?? []) {
          if (nodeIds.has(rawNode.id)) continue;
          const detail = actorMap.get(rawNode.id);
          const category = toActorCategory(detail?.actor_category ?? rawNode.type);
          nodes.push({
            id: rawNode.id,
            label: detail?.name ?? rawNode.label ?? rawNode.name ?? rawNode.id,
            type: 'entity',
            actorCategory: category,
            confidence: detail ? actorConfidence(detail) : 0.3,
            sourceDocumentIds: detail?.sourceDocumentIds,
            validityScore: detail?.validity_score,
            createdAt: new Date().toISOString(),
          });
          nodeIds.add(rawNode.id);
        }

        // Add any actors from the actors endpoint not already in the graph
        for (const actor of actorsResp?.actors ?? []) {
          if (nodeIds.has(actor.id)) continue;
          nodes.push({
            id: actor.id,
            label: actor.name ?? actor.id,
            type: 'entity',
            actorCategory: toActorCategory(actor.actor_category),
            confidence: actorConfidence(actor),
            sourceDocumentIds: actor.sourceDocumentIds,
            validityScore: actor.validity_score,
            createdAt: new Date().toISOString(),
          });
          nodeIds.add(actor.id);
        }

        // ── 2. Objective nodes ─────────────────────────────────────────────────
        const midlifeCategorySet = new Set<string>();
        for (const obj of objectivesResp?.objectives ?? []) {
          if (!nodeIds.has(obj.id)) {
            nodes.push({
              id: obj.id,
              label: obj.objective_text?.slice(0, 60) ?? obj.id,
              type: 'objective',
              confidence: obj.extraction_confidence ?? 0.5,
              createdAt: obj.created_at ?? new Date().toISOString(),
            });
            nodeIds.add(obj.id);
          }
          // Collect DIME/MIDLIFE categories for concept nodes
          if (obj.midlife_category) {
            midlifeCategorySet.add(obj.midlife_category);
          }
        }

        // ── 3. Document nodes ──────────────────────────────────────────────────
        for (const doc of documentsResp?.documents ?? []) {
          if (nodeIds.has(doc.id)) continue;
          const qualityRating = doc.quality_rating;
          // quality_rating is typically 1-5; normalise to 0-1
          const confidence =
            qualityRating != null ? Math.min(1, qualityRating / 5) : 0.5;
          nodes.push({
            id: doc.id,
            label: doc.document_name ?? doc.filename ?? doc.id,
            type: 'document',
            confidence,
            createdAt: doc.created_at ?? new Date().toISOString(),
          });
          nodeIds.add(doc.id);
        }

        // ── 4. Concept nodes (from DIME/MIDLIFE categories on objectives) ─────
        for (const category of midlifeCategorySet) {
          const conceptId = `concept:${category}`;
          if (nodeIds.has(conceptId)) continue;
          nodes.push({
            id: conceptId,
            label: category,
            type: 'concept',
            confidence: 0.7, // concepts derived from structured data are moderately reliable
            createdAt: new Date().toISOString(),
          });
          nodeIds.add(conceptId);
        }

        // ── Edges from graph endpoint ──────────────────────────────────────────
        // Filter out edges referencing nodes not in the graph to prevent
        // d3-force "node not found" errors at runtime.
        const rawEdges = graphResp?.edges ?? graphResp?.links ?? [];
        const edges: BrainEdge[] = rawEdges
          .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
          .map((e) => ({
            source: e.source,
            target: e.target,
            type: e.type ?? 'related',
            strength: e.strength ?? 0.3,
            isConflict: e.type === 'conflict' || e.type === 'opposes',
          }));

        setData({ nodes, edges });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load brain data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [problemSetId, tick]);

  return { data, loading, error, refetch };
}

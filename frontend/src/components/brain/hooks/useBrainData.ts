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

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  natoSourceReliability?: string | null;
  natoInformationCredibility?: number | null;
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
  aliases?: string[];
  attributes?: Record<string, unknown>;
  sourceDocumentIds?: string[];
  relationships?: unknown[];
  validity_score?: number;
  natoSourceReliability?: string | null;
  natoInformationCredibility?: number | null;
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
  primary_instrument?: string;
  priority?: string;
  assumptions?: string[];
  risks?: string[];
  constraints?: string[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** DIME instrument labels for human-readable objective labels */
const INSTRUMENT_LABELS: Record<string, string> = {
  DIPLOMATIC: 'Diplomatic',
  INFORMATION: 'Information',
  MILITARY: 'Military',
  ECONOMIC: 'Economic',
};

/**
 * Generate a meaningful short label for an objective node.
 * Extracts the first sentence or clause (up to 80 chars) from the description,
 * prefixed with the DIME instrument when available.
 */
function summarizeObjective(
  text?: string,
  instrument?: string,
  priority?: string,
): string {
  if (!text) return 'Unnamed Objective';

  // Extract first sentence or up to first comma/semicolon for a concise label
  const firstSentence = text.split(/[.;]\s/)[0] ?? text;
  const label = firstSentence.length > 80
    ? firstSentence.slice(0, 77) + '...'
    : firstSentence;

  // Prefix with DIME category for quick identification
  const prefix = instrument && INSTRUMENT_LABELS[instrument]
    ? `[${INSTRUMENT_LABELS[instrument]}] `
    : '';
  const suffix = priority && priority !== 'MEDIUM' ? ` (${priority})` : '';

  return `${prefix}${label}${suffix}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute a confidence tier from a 0-1 confidence value.
 * > 0.85 = 'high', 0.5-0.85 = 'medium', < 0.5 = 'low'
 */
function computeConfidenceTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence > 0.85) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/** Default max nodes to show initially. Expand via loadMore(). */
const INITIAL_NODE_LIMIT = 300;

/** How many additional nodes to load per "load more" click */
const LOAD_MORE_BATCH = 200;

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseBrainDataReturn {
  data: BrainGraphData;
  /** Full (untruncated) node/edge counts */
  totalNodes: number;
  totalEdges: number;
  /** Whether the displayed data is truncated */
  isTruncated: boolean;
  /** Load more nodes into the visible set */
  loadMore: () => void;
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
 * Derive DIME category from actor type/description for theme filtering.
 * Maps actor types to Diplomatic, Information, Military, Economic categories.
 */
function toDimeCategory(actorType?: string, description?: string): string | undefined {
  const t = (actorType ?? '').toLowerCase();
  const d = (description ?? '').toLowerCase();
  const combined = `${t} ${d}`;

  if (/military|army|navy|air.force|marine|defense|defence|armed|soldier|battalion|brigade|regiment|division|weapon|tank|missile/.test(combined))
    return 'military';
  if (/diplomat|embassy|ambassador|treaty|foreign.minister|consulate|bilateral|multilateral/.test(combined))
    return 'diplomatic';
  if (/econom|trade|finance|bank|gdp|market|tariff|sanction|commerce|investment|currency/.test(combined))
    return 'economic';
  if (/media|propaganda|cyber|information|news|press|broadcast|social.media/.test(combined))
    return 'information';
  if (/intelligen|sigint|osint|humint|geoint|imint|masint|elint|recon|surveil|espionage/.test(combined))
    return 'intelligence';
  if (/infrastructure|power.grid|transport|port|airport|rail|bridge|road|pipeline|utility|energy/.test(combined))
    return 'infrastructure';
  if (/legal|law|court|tribunal|jurisdiction|prosecution|regulation|treaty.law|convention/.test(combined))
    return 'legal';

  // Infer from actor category
  if (/state|nation|government|regime/.test(t)) return 'diplomatic';
  if (/organization|ngo|igo|un\b/.test(t)) return 'diplomatic';
  if (/non.state|militia|insurgent|terrorist|paramilitary/.test(t)) return 'military';

  return undefined;
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

/**
 * Compute eigenvalue centrality via power iteration on the adjacency matrix.
 *
 * For each node, centrality is proportional to the sum of centralities of its
 * neighbors — high-centrality nodes are connected to other high-centrality nodes.
 * This surfaces outlier actors who bridge distinct clusters or dominate connectivity.
 *
 * Returns a Map<nodeId, normalizedCentrality> with values in [0, 1].
 */
function computeEigenvalueCentrality(
  nodes: { id: string }[],
  edges: { source: string; target: string; strength?: number }[],
  maxIterations = 50,
  tolerance = 1e-6,
): Map<string, number> {
  const n = nodes.length;
  if (n === 0) return new Map();

  // Build index lookup
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) idToIdx.set(nodes[i].id, i);

  // Build adjacency list with weights
  const adj: Array<Array<{ idx: number; weight: number }>> = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const si = idToIdx.get(e.source);
    const ti = idToIdx.get(e.target);
    if (si == null || ti == null) continue;
    const w = e.strength ?? 0.3;
    adj[si].push({ idx: ti, weight: w });
    adj[ti].push({ idx: si, weight: w }); // undirected
  }

  // Power iteration
  let vec = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);

  for (let iter = 0; iter < maxIterations; iter++) {
    next.fill(0);
    for (let i = 0; i < n; i++) {
      for (const { idx, weight } of adj[i]) {
        next[i] += weight * vec[idx];
      }
    }

    // Normalize by L2 norm
    let norm = 0;
    for (let i = 0; i < n; i++) norm += next[i] * next[i];
    norm = Math.sqrt(norm);
    if (norm === 0) break;
    for (let i = 0; i < n; i++) next[i] /= norm;

    // Check convergence
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - vec[i]);
    [vec, next] = [next, vec];
    if (diff < tolerance) break;
  }

  // Normalize to [0, 1] range
  let maxVal = 0;
  for (let i = 0; i < n; i++) if (vec[i] > maxVal) maxVal = vec[i];

  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    result.set(nodes[i].id, maxVal > 0 ? vec[i] / maxVal : 0);
  }
  return result;
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

/**
 * useBrainData
 *
 * Fetches brain graph data from multiple API endpoints and merges into a single
 * BrainGraphData structure. When atTime is provided (ISO string), the hook uses
 * the /api/brain/graph-snapshot endpoint for temporal filtering instead of the
 * live endpoints.
 *
 * @param problemSetId - ID of the problem set to fetch data for
 * @param atTime - Optional ISO timestamp for temporal (historical) queries
 */
export function useBrainData(problemSetId: string, atTime?: string | null): UseBrainDataReturn {
  const [fullData, setFullData] = useState<BrainGraphData>({ nodes: [], edges: [] });
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_NODE_LIMIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setVisibleLimit(INITIAL_NODE_LIMIT);
    setTick((t) => t + 1);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleLimit((prev) => prev + LOAD_MORE_BATCH);
  }, []);

  // Truncate to top N by centrality for progressive loading
  const data = useMemo<BrainGraphData>(() => {
    const allNodes = fullData.nodes;
    if (allNodes.length <= visibleLimit) return fullData;

    // Sort by centrality (highest first), take top N
    const sorted = [...allNodes].sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0));
    const visibleNodes = sorted.slice(0, visibleLimit);
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    // Filter edges to only reference visible nodes
    const visibleEdges = fullData.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );

    return { nodes: visibleNodes, edges: visibleEdges };
  }, [fullData, visibleLimit]);

  const totalNodes = fullData.nodes.length;
  const totalEdges = fullData.edges.length;
  const isTruncated = totalNodes > visibleLimit;

  useEffect(() => {
    if (!problemSetId) return;

    // ── If atTime is set, use the graph-snapshot endpoint for temporal queries ─
    if (atTime) {
      let cancelled = false;
      setLoading(true);
      setError(null);

      const url = `${API_BASE}/api/brain/graph-snapshot?problemSetId=${encodeURIComponent(problemSetId)}&atTime=${encodeURIComponent(atTime)}`;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`graph-snapshot ${res.status}`);
          return res.json() as Promise<{ nodes?: unknown[]; edges?: unknown[] }>;
        })
        .then((raw) => {
          if (cancelled) return;
          // Map snapshot nodes to BrainNode shape with JSON-LD fields
          const snapshotNodes: BrainNode[] = (raw.nodes ?? []).map((n: unknown) => {
            const node = n as Record<string, unknown>;
            const conf = typeof node.confidence === 'number' ? node.confidence : 0.3;
            return {
              id: node.id as string,
              label: (node.label ?? node.name ?? node.id) as string,
              type: (node.type ?? 'entity') as BrainNode['type'],
              actorCategory: node.actorCategory as ActorCategory | undefined,
              confidence: conf,
              confidenceTier: computeConfidenceTier(conf),
              createdAt: (node.createdAt ?? new Date().toISOString()) as string,
              validFrom: node.validFrom as string | undefined,
              validTo: node.validTo as string | null | undefined,
              assertedVia: node.assertedVia as string | undefined,
              assertedBy: node.assertedBy as string | undefined,
              isContradicted: node.isContradicted as boolean | undefined,
              jsonldType: node.jsonldType as string | undefined,
              halfLifeDays: node.halfLifeDays as number | undefined,
              validityScore: node.validityScore as number | undefined,
              sourceDocumentIds: node.sourceDocumentIds as string[] | undefined,
              natoSourceReliability: node.natoSourceReliability as string | null | undefined,
              natoInformationCredibility: node.natoInformationCredibility as number | null | undefined,
            };
          });
          const snapshotEdges: BrainEdge[] = (raw.edges ?? []).map((e: unknown) => {
            const edge = e as Record<string, unknown>;
            return {
              source: edge.source as string,
              target: edge.target as string,
              type: (edge.type ?? 'related') as string,
              strength: edge.strength as number | undefined,
              confidence: edge.confidence as number | undefined,
              isConflict: edge.isConflict as boolean | undefined,
              isContradiction: edge.isContradiction as boolean | undefined,
            };
          });
          setFullData({ nodes: snapshotNodes, edges: snapshotEdges });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load graph snapshot');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => { cancelled = true; };
    }

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
          const conf = detail ? actorConfidence(detail) : 0.3;
          const actorDesc = detail?.actor_type
            ? `${detail.actor_type}${detail.attributes?.role ? ` — ${detail.attributes.role}` : ''}`
            : undefined;
          nodes.push({
            id: rawNode.id,
            label: detail?.name ?? rawNode.label ?? rawNode.name ?? rawNode.id,
            type: 'entity',
            actorCategory: category,
            dimeCategory: toDimeCategory(detail?.actor_type ?? rawNode.type, actorDesc),
            confidence: conf,
            confidenceTier: computeConfidenceTier(conf),
            sourceDocumentIds: detail?.sourceDocumentIds,
            validityScore: detail?.validity_score,
            aliases: detail?.aliases,
            role: detail?.attributes?.role as string | undefined,
            description: actorDesc,
            createdAt: new Date().toISOString(),
            natoSourceReliability: detail?.natoSourceReliability ?? rawNode.natoSourceReliability,
            natoInformationCredibility: detail?.natoInformationCredibility ?? rawNode.natoInformationCredibility,
          });
          nodeIds.add(rawNode.id);
        }

        // Add any actors from the actors endpoint not already in the graph
        for (const actor of actorsResp?.actors ?? []) {
          if (nodeIds.has(actor.id)) continue;
          const conf = actorConfidence(actor);
          const aDesc = actor.actor_type
            ? `${actor.actor_type}${actor.attributes?.role ? ` — ${actor.attributes.role}` : ''}`
            : undefined;
          nodes.push({
            id: actor.id,
            label: actor.name ?? actor.id,
            type: 'entity',
            actorCategory: toActorCategory(actor.actor_category),
            dimeCategory: toDimeCategory(actor.actor_type, aDesc),
            confidence: conf,
            confidenceTier: computeConfidenceTier(conf),
            sourceDocumentIds: actor.sourceDocumentIds,
            validityScore: actor.validity_score,
            aliases: actor.aliases,
            role: actor.attributes?.role as string | undefined,
            description: actor.actor_type
              ? `${actor.actor_type}${actor.attributes?.role ? ` — ${actor.attributes.role}` : ''}`
              : undefined,
            createdAt: new Date().toISOString(),
            natoSourceReliability: actor.natoSourceReliability,
            natoInformationCredibility: actor.natoInformationCredibility,
          });
          nodeIds.add(actor.id);
        }

        // ── 2. Objective nodes ─────────────────────────────────────────────────
        const midlifeCategorySet = new Set<string>();
        for (const obj of objectivesResp?.objectives ?? []) {
          if (!nodeIds.has(obj.id)) {
            // Build a meaningful label: prefer first sentence or clause of description
            const label = summarizeObjective(obj.objective_text, obj.primary_instrument, obj.priority);
            // Build rich description with assumptions, risks, constraints
            const descParts: string[] = [];
            if (obj.objective_text) descParts.push(obj.objective_text);
            if (obj.assumptions && obj.assumptions.length > 0) {
              descParts.push(`\nAssumptions: ${obj.assumptions.join('; ')}`);
            }
            if (obj.risks && obj.risks.length > 0) {
              descParts.push(`\nRisks: ${obj.risks.join('; ')}`);
            }
            if (obj.constraints && obj.constraints.length > 0) {
              descParts.push(`\nConstraints: ${obj.constraints.join('; ')}`);
            }
            const objConf = obj.extraction_confidence ?? 0.5;
            nodes.push({
              id: obj.id,
              label,
              type: 'objective',
              description: descParts.join('') || undefined,
              dimeCategory: obj.midlife_category,
              confidence: objConf,
              confidenceTier: computeConfidenceTier(objConf),
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
          const docConf =
            qualityRating != null ? Math.min(1, qualityRating / 5) : 0.5;
          nodes.push({
            id: doc.id,
            label: doc.document_name ?? doc.filename ?? doc.id,
            type: 'document',
            confidence: docConf,
            confidenceTier: computeConfidenceTier(docConf),
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
            confidenceTier: 'medium',
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

        // ── Eigenvalue centrality ────────────────────────────────────────────
        // Assign centrality scores so the visualization can highlight outlier
        // actors and use semantic zoom to prioritise important labels.
        const centrality = computeEigenvalueCentrality(nodes, edges);
        for (const node of nodes) {
          node.centrality = centrality.get(node.id) ?? 0;
        }

        setFullData({ nodes, edges });
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
  }, [problemSetId, tick, atTime]);

  return { data, totalNodes, totalEdges, isTruncated, loadMore, loading, error, refetch };
}

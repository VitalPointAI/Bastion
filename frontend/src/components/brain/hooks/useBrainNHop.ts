/**
 * useBrainNHop - progressive N-hop neighbor loading hook for focus-and-expand.
 *
 * Each call to expand(focusNodeId) loads one more concentric ring of neighbors
 * from the backend N-hop endpoint. Uses AbortController to cancel superseded
 * requests and a hop-count tag to guard against stale responses overwriting
 * newer state.
 *
 * Backend endpoint:
 *   GET /api/brain/nhop?workspaceId=X&nodeId=Y&hops=N
 *   Response: { nodes: RawGraphNode[], edges: RawGraphEdge[] }
 */

import { useState, useCallback, useRef } from 'react';
import type { BrainNode, BrainEdge, BrainGraphData } from '../types.js';

// ─── API base ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Raw API shapes ─────────────────────────────────────────────────────────────

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

interface NHopResponse {
  nodes?: RawGraphNode[];
  edges?: RawGraphEdge[];
}

// ─── Mapping helpers ────────────────────────────────────────────────────────────

/** Map a raw N-hop node to a BrainNode. */
function mapRawNode(raw: RawGraphNode): BrainNode {
  return {
    id: raw.id,
    label: raw.label ?? raw.name ?? raw.id,
    type: 'entity',
    confidence: 0.3,
    createdAt: new Date().toISOString(),
  };
}

/** Map a raw N-hop edge to a BrainEdge. */
function mapRawEdge(raw: RawGraphEdge): BrainEdge {
  return {
    source: raw.source,
    target: raw.target,
    type: raw.type ?? 'related',
    strength: raw.strength ?? 0.3,
    isConflict: raw.type === 'conflict' || raw.type === 'opposes',
  };
}

// ─── Warning threshold ─────────────────────────────────────────────────────────

/** Number of hops at which a performance warning is surfaced to the user. */
const WARNING_THRESHOLD = 3;

// ─── Hook return type ──────────────────────────────────────────────────────────

export interface UseBrainNHopReturn {
  /** Current expansion depth (0 = no expansion active). */
  expandedHops: number;
  /** Merged graph data for all expanded neighbors, or null when no expansion active. */
  expandedData: BrainGraphData | null;
  /** True while a fetch is in flight. */
  loading: boolean;
  /**
   * True when expandedHops >= WARNING_THRESHOLD. The controller should
   * show a "This may load many nodes" confirmation before calling expand()
   * again, but may choose to surface it on any call at or past this depth.
   */
  showWarning: boolean;
  /**
   * Load the next hop ring for focusNodeId.
   * Increments expandedHops by 1, aborts any in-flight request, and fires
   * a new fetch for the updated depth.
   */
  expand: (focusNodeId: string) => void;
  /** Reset expansion to 0 hops and clear expandedData. Aborts in-flight request. */
  reset: () => void;
  /**
   * Change the focus node. Resets expandedHops to 0 and clears expandedData.
   * Does not trigger an automatic fetch — caller must call expand() next.
   */
  setFocusNode: (nodeId: string | null) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param workspaceId - Problem set / workspace identifier forwarded to the API.
 */
export function useBrainNHop(workspaceId: string): UseBrainNHopReturn {
  const [expandedHops, setExpandedHops] = useState(0);
  const [expandedData, setExpandedData] = useState<BrainGraphData | null>(null);
  const [loading, setLoading] = useState(false);

  // Track the AbortController for the most recent in-flight request so we can
  // cancel superseded requests on rapid successive expand() calls.
  const abortRef = useRef<AbortController | null>(null);

  // Track the hop count that the most recently committed response corresponds
  // to. Used as a guard so an earlier slow response cannot overwrite state
  // that was already set by a faster later response.
  const committedHopsRef = useRef(0);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    committedHopsRef.current = 0;
    setExpandedHops(0);
    setExpandedData(null);
    setLoading(false);
  }, []);

  const setFocusNode = useCallback((_nodeId: string | null) => {
    // Changing focus resets all expansion state.
    abortRef.current?.abort();
    abortRef.current = null;
    committedHopsRef.current = 0;
    setExpandedHops(0);
    setExpandedData(null);
    setLoading(false);
  }, []);

  const expand = useCallback(
    (focusNodeId: string) => {
      if (!workspaceId || !focusNodeId) return;

      // Abort any superseded in-flight request.
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      // The next hop depth this request targets.
      const requestedHops = expandedHops + 1;
      setExpandedHops(requestedHops);
      setLoading(true);

      const url =
        `${API_BASE}/api/brain/nhop` +
        `?workspaceId=${encodeURIComponent(workspaceId)}` +
        `&nodeId=${encodeURIComponent(focusNodeId)}` +
        `&hops=${requestedHops}`;

      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`N-hop fetch failed: ${res.status} ${res.statusText}`);
          }
          return res.json() as Promise<NHopResponse>;
        })
        .then((body) => {
          // Race condition guard: only apply this response if it represents
          // state >= what we have already committed. An earlier slow request
          // arriving after a faster later one would have requestedHops <
          // committedHopsRef.current and should be discarded.
          if (requestedHops < committedHopsRef.current) {
            return;
          }

          committedHopsRef.current = requestedHops;

          const nodes: BrainNode[] = (body.nodes ?? []).map(mapRawNode);
          const edges: BrainEdge[] = (body.edges ?? []).map(mapRawEdge);

          setExpandedData({ nodes, edges });
          setLoading(false);
        })
        .catch((err: unknown) => {
          // Ignore intentional aborts — they are not errors.
          if (err instanceof Error && err.name === 'AbortError') return;

          console.error('[useBrainNHop] fetch error:', err);

          // On error: do NOT advance committedHops or update expandedData.
          // Roll expandedHops back to what was committed so the caller can retry.
          setExpandedHops(committedHopsRef.current);
          setLoading(false);
        });
    },
    [workspaceId, expandedHops],
  );

  return {
    expandedHops,
    expandedData,
    loading,
    showWarning: expandedHops >= WARNING_THRESHOLD,
    expand,
    reset,
    setFocusNode,
  };
}

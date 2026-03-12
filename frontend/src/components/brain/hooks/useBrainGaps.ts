import { useState, useCallback, useEffect, useRef } from 'react';
import type { BrainNode } from '../types.js';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GapInfo {
  /** ID of the node that has insufficient connections */
  nodeId: string;
  /** Human-readable label of the gap node */
  nodeLabel: string;
  /** Connection types that are expected but missing */
  missingConnectionTypes: string[];
  /** Number of connections expected based on node type/category heuristics */
  expectedConnections: number;
  /** Number of connections actually present */
  actualConnections: number;
}

export interface UseBrainGapsReturn {
  /** All detected intelligence gaps for this problem set */
  gaps: GapInfo[];
  /** true while the gap report is being fetched */
  loading: boolean;
  /** Set of node IDs that have detected gaps */
  gapNodeIds: Set<string>;
  /**
   * Returns a new array of nodes with `isGap = true` for any node whose ID
   * is in gapNodeIds. Also appends synthetic "ghost" nodes representing the
   * missing connection types so the renderer shows hollow placeholder nodes.
   */
  markGapNodes: (nodes: BrainNode[]) => BrainNode[];
  /** Total number of gaps detected (for toolbar badge) */
  gapCount: number;
  /** Manually trigger a gap report refresh */
  refetch: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Auto-refetch interval in milliseconds (5 minutes) */
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBrainGaps
 *
 * Fetches the intelligence gap report for a problem set and provides utilities
 * for marking gap nodes in the brain visualization with hollow/dashed rendering.
 *
 * Gaps represent nodes that have fewer connections than expected — the brain
 * highlights these to direct analyst attention toward under-explored areas.
 */
export function useBrainGaps(problemSetId: string): UseBrainGapsReturn {
  const [gaps, setGaps] = useState<GapInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch gap report ───────────────────────────────────────────────────────

  const fetchGaps = useCallback(async () => {
    if (!problemSetId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/brain/gaps?problemSetId=${encodeURIComponent(problemSetId)}`,
      );
      if (!res.ok) throw new Error(`gaps ${res.status}`);
      const data: { gaps: GapInfo[] } = await res.json();
      setGaps(data.gaps ?? []);
    } catch (err) {
      console.error('[useBrainGaps] failed to fetch gap report:', err);
      // Retain existing gaps on error to avoid clearing the UI
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  // Initial fetch and auto-refetch every 5 minutes
  useEffect(() => {
    fetchGaps();

    intervalRef.current = setInterval(fetchGaps, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchGaps]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const gapNodeIds = new Set(gaps.map((g) => g.nodeId));
  const gapCount = gaps.length;

  // ── markGapNodes ───────────────────────────────────────────────────────────

  const markGapNodes = useCallback(
    (nodes: BrainNode[]): BrainNode[] => {
      // Step 1: mark existing nodes that are gaps
      const markedNodes: BrainNode[] = nodes.map((node) => {
        if (gapNodeIds.has(node.id)) {
          return { ...node, isGap: true };
        }
        return node;
      });

      // Step 2: create synthetic ghost nodes for each missing connection type.
      // These represent the conceptual "holes" in the intelligence picture.
      const ghostNodes: BrainNode[] = [];
      let ghostIndex = 0;

      for (const gap of gaps) {
        for (const missingType of gap.missingConnectionTypes) {
          ghostIndex += 1;
          ghostNodes.push({
            id: `__gap_ghost_${gap.nodeId}_${ghostIndex}`,
            label: `Missing: ${missingType}`,
            // Use 'concept' type as a neutral shape for unknown concepts
            type: 'concept',
            confidence: 0,
            isGap: true,
            // Ghost nodes are anchored near the source gap node
            createdAt: new Date().toISOString(),
          });
        }
      }

      return [...markedNodes, ...ghostNodes];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gaps],
  );

  return {
    gaps,
    loading,
    gapNodeIds,
    markGapNodes,
    gapCount,
    refetch: fetchGaps,
  };
}

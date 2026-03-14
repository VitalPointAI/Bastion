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
  /** Actor type (nation, organization, individual, non_state_actor) */
  nodeType?: string;
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

// ─── Gap description helpers ─────────────────────────────────────────────────

/** Human-readable descriptions for connection types */
const CONNECTION_TYPE_DESCRIPTIONS: Record<string, { question: string; remedy: string }> = {
  alliance: {
    question: 'Who are their allies or partners?',
    remedy: 'Review treaties, joint exercises, bilateral agreements, or diplomatic statements of mutual support.',
  },
  conflict: {
    question: 'What adversarial relationships exist?',
    remedy: 'Analyze military posturing, sanctions, proxy conflicts, or hostile diplomatic actions.',
  },
  trade: {
    question: 'What economic/trade relationships are in play?',
    remedy: 'Examine trade agreements, economic dependencies, supply chain data, or sanctions impacts.',
  },
  diplomatic: {
    question: 'What diplomatic engagements or channels exist?',
    remedy: 'Review embassy communications, UN voting records, diplomatic visits, or formal negotiations.',
  },
  member: {
    question: 'What organizations or coalitions are they part of?',
    remedy: 'Check membership rosters for international organizations, coalitions, or multilateral bodies.',
  },
  affiliated: {
    question: 'What affiliations or partnerships exist?',
    remedy: 'Look for MOUs, joint operations, shared infrastructure, or common leadership ties.',
  },
  opposes: {
    question: 'Who or what do they actively oppose?',
    remedy: 'Analyze public statements, military exercises against, economic sanctions, or counter-operations.',
  },
  supports: {
    question: 'Who or what do they actively support?',
    remedy: 'Review aid packages, military support, diplomatic backing, or intelligence sharing arrangements.',
  },
  member_of: {
    question: 'What organization do they belong to?',
    remedy: 'Identify organizational hierarchy, chain of command, or institutional affiliation.',
  },
  commands: {
    question: 'What forces or units do they command?',
    remedy: 'Review order of battle, organizational charts, or command authority documentation.',
  },
  reports_to: {
    question: 'Who is their superior in the chain of command?',
    remedy: 'Examine command structure, reporting chains, or leadership hierarchy documents.',
  },
  controls: {
    question: 'What territory, resources, or assets do they control?',
    remedy: 'Map territorial control, resource holdings, infrastructure control, or financial assets.',
  },
};

/**
 * Generate a human-readable label for a gap ghost node.
 * e.g. "China: Unknown allies" instead of "Missing: alliance"
 */
function formatGapLabel(missingType: string, actorName: string, _actorType?: string): string {
  const typeLabels: Record<string, string> = {
    alliance: 'Unknown allies',
    conflict: 'Unknown adversaries',
    trade: 'Unknown trade ties',
    diplomatic: 'Unknown diplomatic ties',
    member: 'Unknown memberships',
    affiliated: 'Unknown affiliations',
    opposes: 'Unknown oppositions',
    supports: 'Unknown support ties',
    member_of: 'Unknown org membership',
    commands: 'Unknown command authority',
    reports_to: 'Unknown reporting chain',
    controls: 'Unknown controlled assets',
  };
  const readable = typeLabels[missingType] ?? `Unknown: ${missingType}`;
  return `${actorName}: ${readable}`;
}

/**
 * Generate a detailed description explaining the gap and how to address it.
 */
function formatGapDescription(missingType: string, actorName: string, actorType?: string): string {
  const info = CONNECTION_TYPE_DESCRIPTIONS[missingType];
  const typeLabel = actorType ?? 'actor';

  const parts: string[] = [
    `Intelligence gap: No ${missingType} relationships are documented for ${actorName} (${typeLabel}).`,
  ];

  if (info) {
    parts.push(`\nKey question: ${info.question}`);
    parts.push(`\nRecommended action: ${info.remedy}`);
  }

  parts.push(`\nPriority: Filling this gap will improve the completeness of the ${actorName} intelligence picture and may reveal critical dependencies or vulnerabilities.`);

  return parts.join('');
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
      // These represent the conceptual "holes" in the intelligence picture,
      // with human-readable labels explaining the gap and suggested remedies.
      const ghostNodes: BrainNode[] = [];
      let ghostIndex = 0;

      for (const gap of gaps) {
        for (const missingType of gap.missingConnectionTypes) {
          ghostIndex += 1;
          const gapLabel = formatGapLabel(missingType, gap.nodeLabel, gap.nodeType);
          const gapDescription = formatGapDescription(missingType, gap.nodeLabel, gap.nodeType);
          ghostNodes.push({
            id: `__gap_ghost_${gap.nodeId}_${ghostIndex}`,
            label: gapLabel,
            type: 'concept',
            confidence: 0,
            isGap: true,
            description: gapDescription,
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

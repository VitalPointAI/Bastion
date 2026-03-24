/**
 * useBrainLens — manages the active virtual lens and custom lens library.
 *
 * A "lens" is a named configuration that controls:
 *   - Which cluster mode is applied (container | dime | organic)
 *   - Which node types are visible (empty = all)
 *   - Which actor categories are visible (empty = all)
 *   - Whether intelligence gap nodes are visible
 *   - Whether the confidence overlay is shown
 *
 * The hook DOES NOT call useBrainClustering directly. It exposes
 * `activeLens.clusterMode` so the controller can pass it to
 * useBrainClustering — this avoids a hook-in-hook dependency issue.
 *
 * Per RESEARCH.md Pitfall 5: Only trigger force reheat when clusterMode
 * actually changes between lens switches. Pure filter-only changes must
 * NOT reheat the simulation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BrainNode, BrainLens, BrainNodeType, ActorCategory } from '../types.js';
import { BUILTIN_LENS_IDS } from '../types.js';

// ─── Built-in Lens Definitions ────────────────────────────────────────────────

/**
 * The four built-in lenses. These are defined at module level and never
 * persisted — they are always present regardless of problem set.
 */
const BUILTIN_LENSES: BrainLens[] = [
  {
    id: BUILTIN_LENS_IDS.OVERVIEW,
    name: 'Overview',
    isBuiltIn: true,
    clusterMode: 'container',
    nodeTypeFilters: [],        // empty = all visible
    actorCategoryFilters: [],
    dimeCategoryFilters: [],
    showGapNodes: true,
    showConfidenceOverlay: false,
    createdBy: 'system',
    isShared: true,
    problemSetId: '',
  },
  {
    id: BUILTIN_LENS_IDS.J2_INTEL,
    name: 'J2 Intel',
    isBuiltIn: true,
    clusterMode: 'container',
    nodeTypeFilters: ['entity'],
    actorCategoryFilters: ['adversary', 'neutral'],
    dimeCategoryFilters: [],
    showGapNodes: true,
    showConfidenceOverlay: true,
    createdBy: 'system',
    isShared: true,
    problemSetId: '',
  },
  {
    id: BUILTIN_LENS_IDS.J3_OPS,
    name: 'J3 Ops',
    isBuiltIn: true,
    clusterMode: 'container',
    nodeTypeFilters: ['entity'],
    actorCategoryFilters: ['ally', 'partner'],
    dimeCategoryFilters: [],
    showGapNodes: false,
    showConfidenceOverlay: false,
    createdBy: 'system',
    isShared: true,
    problemSetId: '',
  },
  {
    id: BUILTIN_LENS_IDS.J5_PLANS,
    name: 'J5 Plans',
    isBuiltIn: true,
    clusterMode: 'dime',
    nodeTypeFilters: ['objective', 'concept'],
    actorCategoryFilters: [],
    dimeCategoryFilters: [],
    showGapNodes: false,
    showConfidenceOverlay: false,
    createdBy: 'system',
    isShared: true,
    problemSetId: '',
  },
];

// ─── Hook Return Shape ────────────────────────────────────────────────────────

export interface UseBrainLensReturn {
  /** Currently active lens */
  activeLens: BrainLens;
  /** All lenses: built-in + user's custom + shared from problem set */
  allLenses: BrainLens[];
  /** Switch the active lens by ID */
  setActiveLensId: (id: string) => void;
  /**
   * Persist a new custom lens or update an existing one.
   * Omit id/createdBy/isBuiltIn — those are assigned by the server.
   */
  saveLens: (lens: Omit<BrainLens, 'id' | 'createdBy' | 'isBuiltIn'>) => Promise<void>;
  /** Delete a custom lens by ID */
  deleteLens: (id: string) => Promise<void>;
  /** Clone a lens (built-in or custom) into a new user-owned lens */
  cloneLens: (id: string) => Promise<void>;
  /**
   * Filter a node array through the active lens rules.
   * Empty filter arrays mean "show all". Returns only nodes that pass all filters.
   * NOTE: clusterMode change detection is handled here via previousClusterMode ref,
   * but the actual reheat is the responsibility of the controller (not this hook).
   */
  applyLensFilters: (nodes: BrainNode[]) => BrainNode[];
  /**
   * True when the most recent lens switch caused the clusterMode to change.
   * The controller should call d3ReheatSimulation() when this is true.
   */
  clusterModeChanged: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrainLens(problemSetId: string): UseBrainLensReturn {
  const [activeLensId, setActiveLensIdState] = useState<string>(BUILTIN_LENS_IDS.OVERVIEW);
  const [customLenses, setCustomLenses] = useState<BrainLens[]>([]);
  const [clusterModeChanged, setClusterModeChanged] = useState(false);

  // Track the previous clusterMode so we only reheat when it actually changes
  const previousClusterModeRef = useRef<string>('container');

  // ── Derived state ──────────────────────────────────────────────────────────

  const allLenses: BrainLens[] = useMemo(() => [...BUILTIN_LENSES, ...customLenses], [customLenses]);

  const activeLens: BrainLens =
    allLenses.find((l) => l.id === activeLensId) ?? BUILTIN_LENSES[0]!;

  // ── Fetch custom lenses ────────────────────────────────────────────────────

  const fetchCustomLenses = useCallback(async () => {
    if (!problemSetId) return;
    try {
      const res = await fetch(`/api/brain/lenses?problemSetId=${encodeURIComponent(problemSetId)}`);
      if (!res.ok) return;
      const body = (await res.json()) as { lenses?: BrainLens[] } | BrainLens[];
      const lenses = Array.isArray(body) ? body : (body.lenses ?? []);
      setCustomLenses(lenses);
    } catch {
      // Silently ignore network errors — built-in lenses always work
    }
  }, [problemSetId]);

  useEffect(() => {
    void fetchCustomLenses();
  }, [fetchCustomLenses]);

  // ── setActiveLensId ────────────────────────────────────────────────────────

  const setActiveLensId = useCallback(
    (id: string) => {
      const nextLens = allLenses.find((l) => l.id === id);
      if (!nextLens) return;

      // Detect whether the clusterMode is actually changing
      const prevMode = previousClusterModeRef.current;
      const nextMode = nextLens.clusterMode;
      const modeChanged = prevMode !== nextMode;

      previousClusterModeRef.current = nextMode;
      setClusterModeChanged(modeChanged);
      setActiveLensIdState(id);
    },
    [allLenses],
  );

  // ── saveLens ───────────────────────────────────────────────────────────────

  const saveLens = useCallback(
    async (lens: Omit<BrainLens, 'id' | 'createdBy' | 'isBuiltIn'>) => {
      try {
        const res = await fetch('/api/brain/lenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lens),
        });
        if (!res.ok) return;
        await fetchCustomLenses();
      } catch {
        // Silently ignore — UI can show toast errors separately
      }
    },
    [fetchCustomLenses],
  );

  // ── deleteLens ─────────────────────────────────────────────────────────────

  const deleteLens = useCallback(
    async (id: string) => {
      // Never delete built-in lenses
      if (id.startsWith('builtin:')) return;
      try {
        const res = await fetch(`/api/brain/lenses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        // If the deleted lens was active, fall back to Overview
        if (activeLensId === id) {
          setActiveLensIdState(BUILTIN_LENS_IDS.OVERVIEW);
        }
        await fetchCustomLenses();
      } catch {
        // Silently ignore
      }
    },
    [activeLensId, fetchCustomLenses],
  );

  // ── cloneLens ──────────────────────────────────────────────────────────────

  const cloneLens = useCallback(
    async (id: string) => {
      const source = allLenses.find((l) => l.id === id);
      if (!source) return;
      try {
        const res = await fetch('/api/brain/lenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${source.name} (copy)`,
            clusterMode: source.clusterMode,
            nodeTypeFilters: source.nodeTypeFilters,
            actorCategoryFilters: source.actorCategoryFilters,
            dimeCategoryFilters: source.dimeCategoryFilters,
            showGapNodes: source.showGapNodes,
            showConfidenceOverlay: source.showConfidenceOverlay,
            isShared: false,
            problemSetId,
            clonedFrom: id,
          } satisfies Omit<BrainLens, 'id' | 'createdBy' | 'isBuiltIn'>),
        });
        if (!res.ok) return;
        await fetchCustomLenses();
      } catch {
        // Silently ignore
      }
    },
    [allLenses, problemSetId, fetchCustomLenses],
  );

  // ── applyLensFilters ───────────────────────────────────────────────────────

  const applyLensFilters = useCallback(
    (nodes: BrainNode[]): BrainNode[] => {
      const lens = activeLens;

      return nodes.filter((node) => {
        // Filter by node type (empty = show all)
        if (
          lens.nodeTypeFilters.length > 0 &&
          !lens.nodeTypeFilters.includes(node.type as BrainNodeType)
        ) {
          return false;
        }

        // Filter by actor category (empty = show all)
        if (
          lens.actorCategoryFilters.length > 0 &&
          node.actorCategory !== undefined &&
          !lens.actorCategoryFilters.includes(node.actorCategory as ActorCategory)
        ) {
          return false;
        }

        // Filter by DIME category (empty = show all)
        if (
          lens.dimeCategoryFilters.length > 0 &&
          node.dimeCategory !== undefined &&
          !lens.dimeCategoryFilters.includes(node.dimeCategory)
        ) {
          return false;
        }

        // Filter gap nodes
        if (!lens.showGapNodes && node.isGap) {
          return false;
        }

        return true;
      });
    },
    [activeLens],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    activeLens,
    allLenses,
    setActiveLensId,
    saveLens,
    deleteLens,
    cloneLens,
    applyLensFilters,
    clusterModeChanged,
  };
}

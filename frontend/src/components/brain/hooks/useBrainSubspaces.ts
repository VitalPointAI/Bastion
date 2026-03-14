/**
 * useBrainSubspaces — manages container-auto, manual, and smart subspaces.
 *
 * Three subspace types:
 *   - 'container': Auto-detected from BrainNode.containerId. Computed at render,
 *     never persisted. Disappear when containerId data is absent.
 *   - 'manual': User-lasso-selected node sets. Persisted via API.
 *   - 'smart': Query-based living filters. Persisted via API. Membership
 *     re-evaluated every render against current data (never cached).
 *
 * Per RESEARCH.md Pitfall 3: Smart subspace membership is computed from live
 * data, not stored. This ensures filtering reflects data changes in real time.
 *
 * Per RESEARCH.md Pitfall 1: Ghost stub nodes for cross-boundary edges have
 * fx/fy set (fixed position) so they do not distort the force layout.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  BrainSubspace,
  SmartSubspaceQuery,
  BrainGraphData,
  BrainNode,
  BrainEdge,
  GhostStubNode,
  GhostEdge,
} from '../types.js';

// ─── Smart Subspace Evaluation ────────────────────────────────────────────────

/**
 * Compute which node IDs satisfy a smart subspace query.
 * Called every render — never cached, never stored.
 */
function evaluateSmartSubspace(query: SmartSubspaceQuery, nodes: BrainNode[]): string[] {
  return nodes
    .filter((n) => {
      if (query.nodeTypes?.length && !query.nodeTypes.includes(n.type)) return false;
      if (
        query.actorCategories?.length &&
        n.actorCategory &&
        !query.actorCategories.includes(n.actorCategory)
      )
        return false;
      if (query.containerId && n.containerId !== query.containerId) return false;
      if (
        query.dimeCategories?.length &&
        n.dimeCategory &&
        !query.dimeCategories.includes(n.dimeCategory)
      )
        return false;
      if (query.namePattern) {
        const regex = new RegExp(query.namePattern.replace(/\*/g, '.*'), 'i');
        if (!regex.test(n.label)) return false;
      }
      return true;
    })
    .map((n) => n.id);
}

// ─── Ghost Stub Computation ────────────────────────────────────────────────────

/**
 * Build ghost stub nodes and ghost edges for all cross-boundary connections.
 *
 * For each external node (not in the subspace) that has at least one edge
 * connecting it to a subspace node, we create:
 *   - A GhostStubNode with fx/fy pinned at the centroid of its connected
 *     subspace nodes, offset 50 units outward (prevents force distortion).
 *   - A GhostEdge for each cross-boundary edge.
 *
 * Multiple edges from the same external node share one ghost stub.
 */
function buildGhostData(
  subspaceNodeIds: Set<string>,
  allNodes: BrainNode[],
  allEdges: BrainEdge[],
  subspaceId: string,
): { ghostStubs: GhostStubNode[]; ghostEdges: GhostEdge[] } {
  // Map for quick node lookup
  const nodeMap = new Map<string, BrainNode>(allNodes.map((n) => [n.id, n]));

  // For each external node ID, collect the subspace-node IDs it's connected to
  const externalToSubspaceNodes = new Map<string, Set<string>>();
  const crossEdges: BrainEdge[] = [];

  for (const edge of allEdges) {
    const sourceIn = subspaceNodeIds.has(edge.source as string);
    const targetIn = subspaceNodeIds.has(edge.target as string);

    if (sourceIn && !targetIn) {
      // external = target
      const extId = edge.target as string;
      if (!externalToSubspaceNodes.has(extId)) externalToSubspaceNodes.set(extId, new Set());
      externalToSubspaceNodes.get(extId)!.add(edge.source as string);
      crossEdges.push(edge);
    } else if (!sourceIn && targetIn) {
      // external = source
      const extId = edge.source as string;
      if (!externalToSubspaceNodes.has(extId)) externalToSubspaceNodes.set(extId, new Set());
      externalToSubspaceNodes.get(extId)!.add(edge.target as string);
      crossEdges.push(edge);
    }
  }

  const ghostStubs: GhostStubNode[] = [];
  const ghostEdges: GhostEdge[] = [];

  for (const [extId, connectedIds] of externalToSubspaceNodes) {
    const extNode = nodeMap.get(extId);

    // Compute average position of connected subspace nodes
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const spNodeId of connectedIds) {
      const spNode = nodeMap.get(spNodeId);
      if (spNode) {
        sumX += spNode.x ?? 0;
        sumY += spNode.y ?? 0;
        count++;
      }
    }

    const avgX = count > 0 ? sumX / count : 0;
    const avgY = count > 0 ? sumY / count : 0;

    // Offset 50 units outward from the subspace centroid
    const subspaceCentroidX = avgX;
    const subspaceCentroidY = avgY;
    const dx = avgX - subspaceCentroidX;
    const dy = avgY - subspaceCentroidY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ghostX = avgX + (dx / len) * 50;
    const ghostY = avgY + (dy / len) * 50;

    const stub: GhostStubNode = {
      ...(extNode ?? {
        id: extId,
        label: extId,
        type: 'entity' as const,
        confidence: 0.5,
        createdAt: new Date().toISOString(),
      }),
      id: extId,
      isGhostStub: true as const,
      ghostSourceSubspace: subspaceId,
      // Fixed position — prevents force layout distortion (RESEARCH.md Pitfall 1)
      x: ghostX,
      y: ghostY,
    };

    ghostStubs.push(stub);
  }

  // Build ghost edges for all cross-boundary edges
  for (const edge of crossEdges) {
    ghostEdges.push({ ...edge, isGhostLink: true as const });
  }

  return { ghostStubs, ghostEdges };
}

// ─── Hook Return Shape ─────────────────────────────────────────────────────────

export interface UseBrainSubspacesReturn {
  /** All subspaces: container-auto (first, alphabetical) + custom (alphabetical) */
  subspaces: BrainSubspace[];
  /** ID of the currently active subspace, or null for full graph */
  activeSubspaceId: string | null;
  /** Switch the active subspace (null = return to full graph) */
  setActiveSubspaceId: (id: string | null) => void;
  /**
   * Graph data filtered to the active subspace.
   * Includes ghost stub nodes and ghost edges for cross-boundary connections.
   * When activeSubspaceId is null, equals the original data (no filtering).
   */
  subspaceData: BrainGraphData;
  /** Create a manual subspace from an explicit list of node IDs */
  createManualSubspace: (name: string, nodeIds: string[]) => Promise<void>;
  /** Create a smart subspace with a query-based definition */
  createSmartSubspace: (name: string, query: SmartSubspaceQuery) => Promise<void>;
  /** Delete a custom subspace by ID */
  deleteSubspace: (id: string) => Promise<void>;
  /** Rename or toggle sharing for a custom subspace */
  updateSubspace: (id: string, updates: { name?: string; isShared?: boolean }) => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useBrainSubspaces(
  problemSetId: string,
  data: BrainGraphData,
): UseBrainSubspacesReturn {
  const [activeSubspaceId, setActiveSubspaceId] = useState<string | null>(null);
  const [customSubspaces, setCustomSubspaces] = useState<BrainSubspace[]>([]);

  // ── Container-auto subspaces ────────────────────────────────────────────────
  //
  // Scan data.nodes for unique containerId values. Build virtual BrainSubspace
  // entries in memory — these are never stored in the DB.

  const containerSubspaces = useMemo<BrainSubspace[]>(() => {
    const seen = new Map<string, string>(); // containerId → containerLabel
    for (const node of data.nodes) {
      if (node.containerId && !seen.has(node.containerId)) {
        seen.set(node.containerId, node.containerLabel ?? node.containerId);
      }
    }
    return Array.from(seen.entries())
      .map(([id, label]) => ({
        id: `container:${id}`,
        problemSetId,
        name: label,
        subspaceType: 'container' as const,
        nodeIds: data.nodes.filter((n) => n.containerId === id).map((n) => n.id),
        createdBy: 'system',
        isShared: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.nodes, problemSetId]);

  // ── Fetch custom (manual + smart) subspaces ────────────────────────────────

  const fetchCustomSubspaces = useCallback(async () => {
    if (!problemSetId) return;
    try {
      const res = await fetch(
        `/api/brain/subspaces?problemSetId=${encodeURIComponent(problemSetId)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as { subspaces?: BrainSubspace[] } | BrainSubspace[];
      const fetched = Array.isArray(body) ? body : (body.subspaces ?? []);
      setCustomSubspaces(fetched);
    } catch {
      // Silently ignore — container-auto subspaces still work without API
    }
  }, [problemSetId]);

  useEffect(() => {
    void fetchCustomSubspaces();
  }, [fetchCustomSubspaces]);

  // ── Combined subspaces list ────────────────────────────────────────────────
  //
  // container-auto first (alphabetical), then custom (manual + smart) alphabetical.

  const subspaces = useMemo<BrainSubspace[]>(() => {
    const sorted = [...customSubspaces].sort((a, b) => a.name.localeCompare(b.name));
    return [...containerSubspaces, ...sorted];
  }, [containerSubspaces, customSubspaces]);

  // ── Subspace data filtering ────────────────────────────────────────────────
  //
  // When activeSubspaceId is set, filter data.nodes/edges to the subspace
  // and add ghost stubs for cross-boundary connections.

  const subspaceData = useMemo<BrainGraphData>(() => {
    if (activeSubspaceId === null) return data;

    const active = subspaces.find((s) => s.id === activeSubspaceId);
    if (!active) return data;

    // Determine which node IDs belong to this subspace
    let memberNodeIds: string[];
    if (active.subspaceType === 'container') {
      // Extract the actual containerId (strip 'container:' prefix)
      const cid = activeSubspaceId.replace(/^container:/, '');
      memberNodeIds = data.nodes.filter((n) => n.containerId === cid).map((n) => n.id);
    } else if (active.subspaceType === 'smart' && active.queryDefinition) {
      // Smart: re-evaluate at render time (RESEARCH.md Pitfall 3)
      memberNodeIds = evaluateSmartSubspace(active.queryDefinition, data.nodes);
    } else {
      // Manual: use stored nodeIds
      memberNodeIds = active.nodeIds ?? [];
    }

    const memberSet = new Set(memberNodeIds);

    // Subspace nodes
    const subspaceNodes = data.nodes.filter((n) => memberSet.has(n.id));

    // Internal edges (both endpoints in the subspace)
    const internalEdges = data.edges.filter(
      (e) => memberSet.has(e.source as string) && memberSet.has(e.target as string),
    );

    // Ghost stubs + ghost edges for cross-boundary connections
    const { ghostStubs, ghostEdges } = buildGhostData(
      memberSet,
      data.nodes,
      data.edges,
      activeSubspaceId,
    );

    return {
      nodes: [...subspaceNodes, ...ghostStubs],
      edges: [...internalEdges, ...ghostEdges],
    };
  }, [activeSubspaceId, subspaces, data]);

  // ── CRUD operations ────────────────────────────────────────────────────────

  const createManualSubspace = useCallback(
    async (name: string, nodeIds: string[]) => {
      try {
        const res = await fetch('/api/brain/subspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, nodeIds, subspaceType: 'manual', problemSetId }),
        });
        if (!res.ok) return;
        await fetchCustomSubspaces();
      } catch {
        // Silently ignore
      }
    },
    [problemSetId, fetchCustomSubspaces],
  );

  const createSmartSubspace = useCallback(
    async (name: string, query: SmartSubspaceQuery) => {
      try {
        const res = await fetch('/api/brain/subspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, queryDefinition: query, subspaceType: 'smart', problemSetId }),
        });
        if (!res.ok) return;
        await fetchCustomSubspaces();
      } catch {
        // Silently ignore
      }
    },
    [problemSetId, fetchCustomSubspaces],
  );

  const deleteSubspace = useCallback(
    async (id: string) => {
      // Container-auto subspaces are never persisted — nothing to delete
      if (id.startsWith('container:')) return;
      try {
        const res = await fetch(`/api/brain/subspaces/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        // If the deleted subspace was active, return to full graph
        if (activeSubspaceId === id) setActiveSubspaceId(null);
        await fetchCustomSubspaces();
      } catch {
        // Silently ignore
      }
    },
    [activeSubspaceId, fetchCustomSubspaces],
  );

  const updateSubspace = useCallback(
    async (id: string, updates: { name?: string; isShared?: boolean }) => {
      if (id.startsWith('container:')) return; // Container-auto cannot be updated
      try {
        const res = await fetch(`/api/brain/subspaces/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return;
        await fetchCustomSubspaces();
      } catch {
        // Silently ignore
      }
    },
    [fetchCustomSubspaces],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    subspaces,
    activeSubspaceId,
    setActiveSubspaceId,
    subspaceData,
    createManualSubspace,
    createSmartSubspace,
    deleteSubspace,
    updateSubspace,
  };
}

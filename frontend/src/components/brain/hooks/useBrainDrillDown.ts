import { useState, useEffect, useCallback } from 'react';
import {
  DrillLevel,
  BreadcrumbEntry,
  BrainGraphData,
  BrainNode,
} from '../types';

// ─── Return Type ─────────────────────────────────────────────────────────────

export interface UseBrainDrillDownReturn {
  /** The current drill level */
  level: DrillLevel;
  /** Breadcrumb trail — always begins with the "Full Brain" root entry */
  breadcrumbs: BreadcrumbEntry[];
  /** Drill into a subspace */
  drillIntoSubspace: (subspaceId: string, label: string) => void;
  /** Drill into a specific node for 1-hop neighbourhood view */
  drillIntoNode: (nodeId: string) => void;
  /** Drill into the document layer for a focal node */
  drillIntoDocuments: (nodeId: string) => void;
  /**
   * Jump back up to the breadcrumb at the given index.
   * Truncates the drill stack to [0..targetIndex].
   */
  drillUp: (targetIndex: number) => void;
  /** Graph data filtered for the current drill level */
  drillData: BrainGraphData;
  /** The node being focused at Level 3 (node detail) */
  focusNodeId: string | null;
  /**
   * Returns the camera target for the current drill level.
   * Caller applies via fgRef.current.cameraPosition(position, lookAt, duration).
   */
  getCameraTarget: () => {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
    duration: number;
  } | null;
}

// ─── Root breadcrumb factory ──────────────────────────────────────────────────

function makeRootCrumb(nodeCount: number): BreadcrumbEntry {
  return {
    level: 'full',
    id: 'root',
    label: 'Full Brain',
    count: nodeCount,
    icon: '\uD83E\uDDE0', // 🧠
  };
}

// ─── Helper: resolve node from data ──────────────────────────────────────────

function findNode(id: string, nodes: BrainNode[]): BrainNode | undefined {
  return nodes.find((n) => n.id === id);
}

// ─── Helper: compute centroid of a node set ───────────────────────────────────

function computeCentroid(nodes: BrainNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  const sum = nodes.reduce(
    (acc, n) => ({ x: acc.x + (n.x ?? 0), y: acc.y + (n.y ?? 0) }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / nodes.length, y: sum.y / nodes.length };
}

// ─── Helper: build 1-hop neighbourhood subgraph ──────────────────────────────

function buildNodeNeighbourhood(
  nodeId: string,
  graphData: BrainGraphData,
): BrainGraphData {
  const { nodes, edges } = graphData;

  const neighbourEdges = edges.filter(
    (e) =>
      (typeof e.source === 'string' ? e.source : (e.source as BrainNode).id) === nodeId ||
      (typeof e.target === 'string' ? e.target : (e.target as BrainNode).id) === nodeId,
  );

  const neighbourIds = new Set<string>([nodeId]);
  for (const e of neighbourEdges) {
    const src = typeof e.source === 'string' ? e.source : (e.source as BrainNode).id;
    const tgt = typeof e.target === 'string' ? e.target : (e.target as BrainNode).id;
    neighbourIds.add(src);
    neighbourIds.add(tgt);
  }

  return {
    nodes: nodes.filter((n) => neighbourIds.has(n.id)),
    edges: neighbourEdges,
  };
}

// ─── Helper: build document layer subgraph ───────────────────────────────────

function buildDocumentLayer(
  nodeId: string,
  graphData: BrainGraphData,
): BrainGraphData {
  const { nodes, edges } = graphData;

  const focalNode = findNode(nodeId, nodes);
  if (!focalNode) return { nodes: [], edges: [] };

  // IDs from sourceDocumentIds on the focal node
  const docIdsFromProvenance = new Set<string>(focalNode.sourceDocumentIds ?? []);

  // IDs from edges where one side is the focal node and the other is a document
  const connectedDocIds = new Set<string>();
  const docEdges = edges.filter((e) => {
    const src = typeof e.source === 'string' ? e.source : (e.source as BrainNode).id;
    const tgt = typeof e.target === 'string' ? e.target : (e.target as BrainNode).id;
    if (src === nodeId) {
      const targetNode = findNode(tgt, nodes);
      if (targetNode?.type === 'document') {
        connectedDocIds.add(tgt);
        return true;
      }
    }
    if (tgt === nodeId) {
      const sourceNode = findNode(src, nodes);
      if (sourceNode?.type === 'document') {
        connectedDocIds.add(src);
        return true;
      }
    }
    return false;
  });

  // Union of both sources
  const allDocIds = new Set([...docIdsFromProvenance, ...connectedDocIds]);

  const docNodes = nodes.filter(
    (n) => n.id === nodeId || (n.type === 'document' && allDocIds.has(n.id)),
  );

  return { nodes: docNodes, edges: docEdges };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrainDrillDown(
  data: BrainGraphData,
  _activeSubspaceId: string | null,
  subspaceData: BrainGraphData,
): UseBrainDrillDownReturn {
  // Stack always starts with the root (Level 1) crumb
  const [drillStack, setDrillStack] = useState<BreadcrumbEntry[]>([
    makeRootCrumb(data.nodes.length),
  ]);

  // ── Validate stack against current data on every data refresh ──────────────
  useEffect(() => {
    setDrillStack((prev) => {
      // Root crumb always valid — update count
      const updated: BreadcrumbEntry[] = [
        { ...prev[0], count: data.nodes.length },
      ];

      for (let i = 1; i < prev.length; i++) {
        const crumb = prev[i];
        if (crumb.level === 'full') {
          // Shouldn't happen (root is always index 0), but guard anyway
          updated.push({ ...crumb, count: data.nodes.length });
          continue;
        }

        // For subspace, node, and document levels the id must still exist in data
        const stillExists = data.nodes.some((n) => n.id === crumb.id);

        if (!stillExists && crumb.level !== 'subspace') {
          // Stale entry — stop here, truncate
          break;
        }

        // Update count for node/document crumbs
        if (crumb.level === 'node') {
          const neighbourhood = buildNodeNeighbourhood(crumb.id, data);
          updated.push({ ...crumb, count: neighbourhood.nodes.length });
        } else if (crumb.level === 'document') {
          const docLayer = buildDocumentLayer(crumb.id, data);
          const docCount = docLayer.nodes.filter((n) => n.type === 'document').length;
          updated.push({ ...crumb, count: docCount });
        } else {
          // subspace level: count from subspaceData
          updated.push({ ...crumb, count: subspaceData.nodes.length });
        }
      }

      // Only update if something actually changed
      if (updated.length === prev.length) {
        const unchanged = updated.every(
          (c, i) => c.id === prev[i].id && c.count === prev[i].count,
        );
        if (unchanged) return prev;
      }

      return updated;
    });
  }, [data, subspaceData]);

  // ── Current level derived from stack ────────────────────────────────────────
  const currentCrumb = drillStack[drillStack.length - 1];
  const level: DrillLevel = currentCrumb.level;

  // ── focusNodeId — set when at node or document level ─────────────────────
  const focusNodeId: string | null =
    level === 'node' || level === 'document' ? currentCrumb.id : null;

  // ── drillData — graph data filtered for the current level ─────────────────
  let drillData: BrainGraphData;
  switch (level) {
    case 'full':
      drillData = data;
      break;
    case 'subspace':
      drillData = subspaceData;
      break;
    case 'node': {
      const sourceData = drillStack.length >= 3 ? subspaceData : data;
      drillData = buildNodeNeighbourhood(currentCrumb.id, sourceData);
      break;
    }
    case 'document': {
      const sourceData = drillStack.length >= 4 ? subspaceData : data;
      drillData = buildDocumentLayer(currentCrumb.id, sourceData);
      break;
    }
    default:
      drillData = data;
  }

  // ── Drill actions ─────────────────────────────────────────────────────────

  const drillIntoSubspace = useCallback(
    (subspaceId: string, label: string) => {
      setDrillStack((prev) => {
        // If already in this subspace, no-op
        if (prev[prev.length - 1].id === subspaceId) return prev;
        const crumb: BreadcrumbEntry = {
          level: 'subspace',
          id: subspaceId,
          label,
          count: subspaceData.nodes.length,
          icon: '\uD83D\uDCE6', // 📦
        };
        return [prev[0], crumb];
      });
    },
    [subspaceData.nodes.length],
  );

  const drillIntoNode = useCallback(
    (nodeId: string) => {
      setDrillStack((prev) => {
        const currentLevel = prev[prev.length - 1].level;
        if (currentLevel === 'node' || currentLevel === 'document') return prev;

        const sourceData = currentLevel === 'subspace' ? subspaceData : data;
        const node = findNode(nodeId, sourceData.nodes);
        if (!node) return prev;

        const neighbourhood = buildNodeNeighbourhood(nodeId, sourceData);
        const crumb: BreadcrumbEntry = {
          level: 'node',
          id: nodeId,
          label: node.label,
          count: neighbourhood.nodes.length,
          icon: '\uD83D\uDD35', // 🔵
        };
        return [...prev, crumb];
      });
    },
    [data, subspaceData],
  );

  const drillIntoDocuments = useCallback(
    (nodeId: string) => {
      setDrillStack((prev) => {
        const currentLevel = prev[prev.length - 1].level;
        if (currentLevel === 'document') return prev;

        const sourceData = currentLevel === 'subspace' ? subspaceData : data;
        const docLayer = buildDocumentLayer(nodeId, sourceData);
        const docCount = docLayer.nodes.filter((n) => n.type === 'document').length;

        const crumb: BreadcrumbEntry = {
          level: 'document',
          id: nodeId,
          label: 'Documents',
          count: docCount,
          icon: '\uD83D\uDCC4', // 📄
        };
        return [...prev, crumb];
      });
    },
    [data, subspaceData],
  );

  const drillUp = useCallback((targetIndex: number) => {
    setDrillStack((prev) => {
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      return prev.slice(0, targetIndex + 1);
    });
  }, []);

  // ── Camera targets ─────────────────────────────────────────────────────────

  const getCameraTarget = useCallback((): {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
    duration: number;
  } | null => {
    switch (level) {
      case 'full':
        return {
          position: { x: 0, y: 0, z: 500 },
          lookAt: { x: 0, y: 0, z: 0 },
          duration: 800,
        };
      case 'subspace': {
        const centroid = computeCentroid(subspaceData.nodes);
        return {
          position: { x: centroid.x, y: centroid.y, z: 200 },
          lookAt: { x: centroid.x, y: centroid.y, z: 0 },
          duration: 800,
        };
      }
      case 'node': {
        if (!focusNodeId) return null;
        const sourceNodes = drillStack.length >= 3 ? subspaceData.nodes : data.nodes;
        const node = findNode(focusNodeId, sourceNodes);
        if (!node) return null;
        return {
          position: { x: node.x ?? 0, y: node.y ?? 0, z: 60 },
          lookAt: { x: node.x ?? 0, y: node.y ?? 0, z: 0 },
          duration: 1000,
        };
      }
      case 'document': {
        if (!focusNodeId) return null;
        const sourceNodes = drillStack.length >= 4 ? subspaceData.nodes : data.nodes;
        const node = findNode(focusNodeId, sourceNodes);
        if (!node) return null;
        return {
          position: { x: node.x ?? 0, y: node.y ?? 0, z: 40 },
          lookAt: { x: node.x ?? 0, y: node.y ?? 0, z: 0 },
          duration: 800,
        };
      }
      default:
        return null;
    }
  }, [level, focusNodeId, data.nodes, subspaceData.nodes, drillStack.length]);

  return {
    level,
    breadcrumbs: drillStack,
    drillIntoSubspace,
    drillIntoNode,
    drillIntoDocuments,
    drillUp,
    drillData,
    focusNodeId,
    getCameraTarget,
  };
}

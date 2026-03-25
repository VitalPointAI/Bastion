/**
 * useFocusExplosion — Node pull-out / focus explosion for the brain graph.
 *
 * When a node is clicked, this hook:
 *   1. Animates the selected node to the center of view
 *   2. Fans 1-hop neighbors in a ring around it
 *   3. Fades everything else to very low opacity
 *   4. Shows relationship labels between selected node and neighbors
 *   5. ESC or double-click exits focus mode
 *
 * Implementation:
 *   - Stores original positions before pull-out
 *   - Uses manual lerp in animation loop (no TWEEN dependency)
 *   - Temporarily pins pulled-out nodes (fx, fy, fz) then releases on exit
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import type { MutableRefObject } from 'react';
import type { BrainNode, BrainEdge } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OriginalPosition {
  x: number;
  y: number;
  z: number;
}

interface FocusNeighbor {
  node: BrainNode;
  edge: BrainEdge;
  /** Target position in the ring */
  targetX: number;
  targetY: number;
  targetZ: number;
}

export interface FocusExplosionState {
  /** Whether focus mode is active */
  isActive: boolean;
  /** The focused center node ID */
  focusedNodeId: string | null;
  /** IDs of 1-hop neighbor nodes in the ring */
  neighborIds: Set<string>;
  /** Map of original positions before pull-out (nodeId -> pos) */
  originalPositions: Map<string, OriginalPosition>;
  /** Animation progress 0..1 */
  animationProgress: number;
  /** Neighbor ring data (positions + edges) */
  neighbors: FocusNeighbor[];
}

export interface UseFocusExplosionReturn {
  /** Current focus state */
  focusState: FocusExplosionState;
  /** Enter focus mode on a node */
  enterFocus: (nodeId: string) => void;
  /** Exit focus mode */
  exitFocus: () => void;
  /** Check if a given node should be dimmed (not in focus neighborhood) */
  isFocusDimmed: (nodeId: string) => boolean;
  /** Get the target opacity for a node in focus mode */
  getFocusOpacity: (nodeId: string) => number;
  /** Animation tick — call from requestAnimationFrame loop */
  tick: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius of the neighbor ring around the focused node */
const RING_RADIUS = 60;
/** Animation duration in frames (~60fps) */
const ANIMATION_FRAMES = 40;
/** Opacity of non-focused nodes */
const DIMMED_OPACITY = 0.05;
/** Opacity of focused node */
const FOCUSED_OPACITY = 1.0;
/** Opacity of neighbor nodes */
const NEIGHBOR_OPACITY = 0.9;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFocusExplosion(
  nodes: BrainNode[],
  edges: BrainEdge[],
  fgRef: MutableRefObject<ForceGraphMethods | undefined>,
): UseFocusExplosionReturn {
  const [focusState, setFocusState] = useState<FocusExplosionState>({
    isActive: false,
    focusedNodeId: null,
    neighborIds: new Set(),
    originalPositions: new Map(),
    animationProgress: 0,
    neighbors: [],
  });

  const animFrameRef = useRef(0);
  const animatingRef = useRef(false);
  const targetFramesRef = useRef(ANIMATION_FRAMES);

  // Ref mirror of focusState for use in callbacks without stale closures
  const focusStateRef = useRef(focusState);
  useEffect(() => { focusStateRef.current = focusState; }, [focusState]);

  // Build adjacency index for fast neighbor lookup
  const adjacencyRef = useRef(new Map<string, Array<{ neighborId: string; edge: BrainEdge }>>());

  useEffect(() => {
    const adj = new Map<string, Array<{ neighborId: string; edge: BrainEdge }>>();
    for (const edge of edges) {
      const src = typeof edge.source === 'string' ? edge.source : (edge.source as BrainNode).id;
      const tgt = typeof edge.target === 'string' ? edge.target : (edge.target as BrainNode).id;

      if (!adj.has(src)) adj.set(src, []);
      if (!adj.has(tgt)) adj.set(tgt, []);
      adj.get(src)!.push({ neighborId: tgt, edge });
      adj.get(tgt)!.push({ neighborId: src, edge });
    }
    adjacencyRef.current = adj;
  }, [edges]);

  const enterFocus = useCallback((nodeId: string) => {
    const fg = fgRef.current;
    if (!fg) return;

    const centerNode = nodes.find(n => n.id === nodeId);
    if (!centerNode) return;

    // Get 1-hop neighbors
    const adjacency = adjacencyRef.current.get(nodeId) ?? [];
    const neighborIds = new Set<string>();
    const neighborData: FocusNeighbor[] = [];

    for (const { neighborId, edge } of adjacency) {
      if (neighborIds.has(neighborId)) continue;
      const neighborNode = nodes.find(n => n.id === neighborId);
      if (!neighborNode) continue;
      neighborIds.add(neighborId);
      neighborData.push({ node: neighborNode, edge, targetX: 0, targetY: 0, targetZ: 0 });
    }

    // Compute ring positions around center
    const cx = centerNode.x ?? 0;
    const cy = (centerNode as unknown as { y?: number }).y ?? 0;
    const cz = (centerNode as unknown as { z?: number }).z ?? 0;

    const count = neighborData.length;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / Math.max(count, 1);
      neighborData[i].targetX = cx + Math.cos(angle) * RING_RADIUS;
      neighborData[i].targetY = cy + Math.sin(angle) * RING_RADIUS * 0.3; // Flatten Y for readability
      neighborData[i].targetZ = cz + Math.sin(angle) * RING_RADIUS;
    }

    // Store original positions
    const originalPositions = new Map<string, OriginalPosition>();
    for (const n of nodes) {
      originalPositions.set(n.id, {
        x: n.x ?? 0,
        y: (n as unknown as { y?: number }).y ?? 0,
        z: (n as unknown as { z?: number }).z ?? 0,
      });
    }

    setFocusState({
      isActive: true,
      focusedNodeId: nodeId,
      neighborIds,
      originalPositions,
      animationProgress: 0,
      neighbors: neighborData,
    });

    animFrameRef.current = 0;
    animatingRef.current = true;

    // Move camera to face the ego-network
    fg.cameraPosition(
      { x: cx + 100, y: cy + 60, z: cz + 100 },
      { x: cx, y: cy, z: cz },
      800,
    );
  }, [nodes, fgRef]);

  // Keep a ref copy of nodes for mutation in exitFocus/tick without triggering lint
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const exitFocus = useCallback(() => {
    const fg = fgRef.current;

    // Release pinned nodes via ref (mutating force-graph node objects is expected)
    if (fg && focusStateRef.current.isActive) {
      const currentNodes = nodesRef.current;
      for (let i = 0; i < currentNodes.length; i++) {
        const n = currentNodes[i] as unknown as { fx?: number | null; fy?: number | null; fz?: number | null };
        n.fx = undefined;
        n.fy = undefined;
        n.fz = undefined;
      }
      fg.d3ReheatSimulation();
    }

    setFocusState({
      isActive: false,
      focusedNodeId: null,
      neighborIds: new Set(),
      originalPositions: new Map(),
      animationProgress: 0,
      neighbors: [],
    });

    animFrameRef.current = 0;
    animatingRef.current = false;
  }, [fgRef]);

  // ESC key listener
  useEffect(() => {
    if (!focusState.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFocus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusState.isActive, exitFocus]);

  // Animation tick — call each frame while animating.
  // Uses refs to read focus state and nodes to avoid stale closures and lint warnings.
  const tick = useCallback(() => {
    if (!animatingRef.current) return;
    const fs = focusStateRef.current;
    if (!fs.isActive) return;

    animFrameRef.current++;
    const progress = Math.min(animFrameRef.current / targetFramesRef.current, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    // Lerp neighbor nodes toward their ring positions.
    // We find actual node objects from nodesRef (force-graph mutates these freely).
    const currentNodes = nodesRef.current;
    for (const neighbor of fs.neighbors) {
      const orig = fs.originalPositions.get(neighbor.node.id);
      if (!orig) continue;

      const nx = orig.x + (neighbor.targetX - orig.x) * eased;
      const ny = orig.y + (neighbor.targetY - orig.y) * eased;
      const nz = orig.z + (neighbor.targetZ - orig.z) * eased;

      // Find the live node object and pin it
      const liveNode = currentNodes.find(n => n.id === neighbor.node.id);
      if (liveNode) {
        const n = liveNode as unknown as { fx?: number; fy?: number; fz?: number; x?: number; y?: number; z?: number };
        n.fx = nx;
        n.fy = ny;
        n.fz = nz;
        n.x = nx;
        n.y = ny;
        n.z = nz;
      }
    }

    // Pin center node
    if (fs.focusedNodeId) {
      const centerNode = currentNodes.find(n => n.id === fs.focusedNodeId);
      if (centerNode) {
        const orig = fs.originalPositions.get(centerNode.id);
        if (orig) {
          const cn = centerNode as unknown as { fx?: number; fy?: number; fz?: number };
          cn.fx = orig.x;
          cn.fy = orig.y;
          cn.fz = orig.z;
        }
      }
    }

    setFocusState(prev => ({ ...prev, animationProgress: eased }));

    if (progress >= 1) {
      animatingRef.current = false;
    }
  }, []);

  const isFocusDimmed = useCallback((nodeId: string): boolean => {
    if (!focusState.isActive) return false;
    if (nodeId === focusState.focusedNodeId) return false;
    if (focusState.neighborIds.has(nodeId)) return false;
    return true;
  }, [focusState]);

  const getFocusOpacity = useCallback((nodeId: string): number => {
    if (!focusState.isActive) return 1.0;
    if (nodeId === focusState.focusedNodeId) return FOCUSED_OPACITY;
    if (focusState.neighborIds.has(nodeId)) return NEIGHBOR_OPACITY;
    return DIMMED_OPACITY;
  }, [focusState]);

  return {
    focusState,
    enterFocus,
    exitFocus,
    isFocusDimmed,
    getFocusOpacity,
    tick,
  };
}

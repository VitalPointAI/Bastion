/**
 * useBrainClustering — manages cluster layout modes for the brain visualization.
 *
 * Manipulates d3 forces on the ForceGraph2D instance to group nodes by:
 *   - 'container'  : group by containerId (actor/problem-set containers)
 *   - 'dime'       : group by DIME/MIDLIFE category (diplomatic, information, military, economic…)
 *   - 'organic'    : no grouping forces — free simulation
 *
 * The hook exposes cluster labels (centroid positions) so BrainVisualization can
 * optionally render group name overlays.
 *
 * Implementation note: d3-force-3d is a transitive dep of force-graph but is not
 * guaranteed to be directly importable in all bundler configurations. We implement
 * minimal inline d3-force-compatible forceX/forceY factories to avoid the dependency.
 * A d3 force is any callable that accepts (alpha: number) and mutates node velocities,
 * with an optional initialize(nodes) step.
 */

import { useState, useEffect, useMemo, type MutableRefObject } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { BrainNode, ClusterMode } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClusterLabel {
  label: string;
  x: number;
  y: number;
}

export interface UseBrainClusteringReturn {
  clusterMode: ClusterMode;
  setClusterMode: (mode: ClusterMode) => void;
  clusterLabels: ClusterLabel[];
}

// ─── Minimal d3-force-compatible force factories ──────────────────────────────

/**
 * d3 node shape used internally by the simulation.
 * ForceGraph2D injects x/y/vx/vy onto each node object.
 */
interface SimNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  [key: string]: unknown;
}

type PositionAccessor = (node: SimNode) => number;

/**
 * Create a d3-compatible forceX positioning force.
 * Pushes each node toward the target x returned by the accessor.
 * Strength controls how aggressively nodes are pulled (0-1).
 */
function createForceX(accessor: PositionAccessor, strength = 0.1) {
  let nodes: SimNode[] = [];
  let _strength = strength;

  function force(alpha: number) {
    for (const node of nodes) {
      const target = accessor(node);
      const currentX = node.x ?? 0;
      node.vx = (node.vx ?? 0) + (target - currentX) * _strength * alpha;
    }
  }

  force.initialize = (n: SimNode[]) => { nodes = n; };
  force.strength = (s?: number) => {
    if (s === undefined) return _strength;
    _strength = s;
    return force;
  };

  return force;
}

/**
 * Create a d3-compatible forceY positioning force.
 * Pushes each node toward the target y returned by the accessor.
 */
function createForceY(accessor: PositionAccessor, strength = 0.1) {
  let nodes: SimNode[] = [];
  let _strength = strength;

  function force(alpha: number) {
    for (const node of nodes) {
      const target = accessor(node);
      const currentY = node.y ?? 0;
      node.vy = (node.vy ?? 0) + (target - currentY) * _strength * alpha;
    }
  }

  force.initialize = (n: SimNode[]) => { nodes = n; };
  force.strength = (s?: number) => {
    if (s === undefined) return _strength;
    _strength = s;
    return force;
  };

  return force;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius of the circular arrangement used for centroid placement */
const CLUSTER_RADIUS = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Arrange N items in a circle of the given radius, returning {x, y} positions.
 * Items are evenly spaced by angle.
 */
function circularPositions(count: number, radius: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/**
 * Build a Map from groupKey → centroid {x, y} for a list of nodes.
 * Keys come from the provided keyFn; nodes with undefined keys are excluded.
 */
function buildCentroids(
  nodes: BrainNode[],
  keyFn: (n: BrainNode) => string | undefined,
): Map<string, { x: number; y: number }> {
  const keys = new Set<string>();
  for (const n of nodes) {
    const k = keyFn(n);
    if (k) keys.add(k);
  }

  const keyList = Array.from(keys);
  const positions = circularPositions(keyList.length, CLUSTER_RADIUS);

  const map = new Map<string, { x: number; y: number }>();
  keyList.forEach((k, i) => map.set(k, positions[i]!));
  return map;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrainClustering(
  fgRef: MutableRefObject<ForceGraphMethods | undefined>,
  nodes: BrainNode[],
): UseBrainClusteringReturn {
  const [clusterMode, setClusterModeState] = useState<ClusterMode>('container');

  // ── Precomputed centroids (recomputed when nodes change) ───────────────────

  const containerCentroids = useMemo<Map<string, { x: number; y: number }>>(
    () => buildCentroids(nodes, (n) => n.containerId),
    [nodes],
  );

  const dimeCentroids = useMemo<Map<string, { x: number; y: number }>>(
    () => buildCentroids(nodes, (n) => n.dimeCategory),
    [nodes],
  );

  // ── Cluster labels for overlay rendering ──────────────────────────────────

  const clusterLabels = useMemo<ClusterLabel[]>(() => {
    if (clusterMode === 'container') {
      return Array.from(containerCentroids.entries()).map(([label, pos]) => ({
        label,
        ...pos,
      }));
    }
    if (clusterMode === 'dime') {
      return Array.from(dimeCentroids.entries()).map(([label, pos]) => ({
        label,
        ...pos,
      }));
    }
    return [];
  }, [clusterMode, containerCentroids, dimeCentroids]);

  // ── applyClusterMode ───────────────────────────────────────────────────────

  const applyClusterMode = (mode: ClusterMode) => {
    const fg = fgRef.current;
    if (!fg) return;

    if (mode === 'container') {
      const xForce = createForceX(
        (n: SimNode) => containerCentroids.get((n.containerId as string | undefined) ?? '')?.x ?? 0,
        0.3,
      );
      const yForce = createForceY(
        (n: SimNode) => containerCentroids.get((n.containerId as string | undefined) ?? '')?.y ?? 0,
        0.3,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fg.d3Force('x', xForce as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fg.d3Force('y', yForce as any);
      fg.d3ReheatSimulation();
      return;
    }

    if (mode === 'dime') {
      const xForce = createForceX(
        (n: SimNode) => dimeCentroids.get((n.dimeCategory as string | undefined) ?? '')?.x ?? 0,
        0.3,
      );
      const yForce = createForceY(
        (n: SimNode) => dimeCentroids.get((n.dimeCategory as string | undefined) ?? '')?.y ?? 0,
        0.3,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fg.d3Force('x', xForce as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fg.d3Force('y', yForce as any);
      fg.d3ReheatSimulation();
      return;
    }

    // organic: remove group forces
    fg.d3Force('x', null);
    fg.d3Force('y', null);
    fg.d3ReheatSimulation();
  };

  // ── Effect: apply forces when mode changes or centroids update ────────────

  useEffect(() => {
    applyClusterMode(clusterMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterMode, containerCentroids, dimeCentroids]);

  const setClusterMode = (mode: ClusterMode) => {
    setClusterModeState(mode);
  };

  return { clusterMode, setClusterMode, clusterLabels };
}

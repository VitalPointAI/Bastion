/**
 * useBrainHulls — computes convex hull outlines for semantic clusters.
 *
 * For each group of nodes (by actorCategory or dimeCategory), computes
 * a 2D convex hull in the XZ plane (projected) and returns hull points
 * that can be rendered as transparent THREE.ShapeGeometry overlays.
 *
 * Hull positions update on a throttled basis as the force simulation runs.
 */

import { useMemo, useRef, useCallback } from 'react';
import type { BrainNode, ClusterMode } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HullData {
  /** Group key (e.g. 'ally', 'adversary', or 'diplomatic') */
  key: string;
  /** Color for this hull fill */
  color: string;
  /** 2D convex hull points in world XZ space [{x, z}] */
  points: Array<{ x: number; y: number; z: number }>;
  /** Center of the hull for label placement */
  center: { x: number; y: number; z: number };
}

export interface UseBrainHullsReturn {
  /** Current hull data — call computeHulls() to refresh from live positions */
  hulls: HullData[];
  /** Re-compute hulls from current node positions (call from animation loop) */
  computeHulls: () => HullData[];
}

// ─── Hull color maps ─────────────────────────────────────────────────────────

const ACTOR_HULL_COLORS: Record<string, string> = {
  ally: 'rgba(74, 158, 255, 0.06)',
  adversary: 'rgba(255, 68, 68, 0.06)',
  neutral: 'rgba(136, 136, 136, 0.06)',
  partner: 'rgba(68, 204, 102, 0.06)',
};

const DIME_HULL_COLORS: Record<string, string> = {
  diplomatic: 'rgba(147, 130, 255, 0.06)',
  information: 'rgba(255, 200, 50, 0.06)',
  military: 'rgba(255, 80, 80, 0.06)',
  economic: 'rgba(50, 200, 150, 0.06)',
  financial: 'rgba(255, 180, 50, 0.06)',
  intelligence: 'rgba(100, 180, 255, 0.06)',
  legal: 'rgba(200, 150, 255, 0.06)',
  development: 'rgba(100, 220, 100, 0.06)',
};

// ─── Convex Hull (Graham Scan, 2D) ──────────────────────────────────────────

interface Point2D { x: number; z: number }

function cross(O: Point2D, A: Point2D, B: Point2D): number {
  return (A.x - O.x) * (B.z - O.z) - (A.z - O.z) * (B.x - O.x);
}

function convexHull2D(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points.slice();

  const sorted = points.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const n = sorted.length;

  // Build lower hull
  const lower: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  // Build upper hull
  const upper: Point2D[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrainHulls(
  nodes: BrainNode[],
  clusterMode: ClusterMode,
): UseBrainHullsReturn {
  const hullsRef = useRef<HullData[]>([]);

  // Build group membership map (stable across position updates)
  const groupMap = useMemo(() => {
    const map = new Map<string, BrainNode[]>();
    for (const node of nodes) {
      let key: string | undefined;
      if (clusterMode === 'container') {
        key = node.actorCategory;
      } else if (clusterMode === 'dime') {
        key = node.dimeCategory;
      }
      if (!key) continue;
      const group = map.get(key);
      if (group) group.push(node);
      else map.set(key, [node]);
    }
    return map;
  }, [nodes, clusterMode]);

  const computeHulls = useCallback((): HullData[] => {
    if (clusterMode === 'organic') {
      hullsRef.current = [];
      return [];
    }

    const result: HullData[] = [];
    const colorMap = clusterMode === 'dime' ? DIME_HULL_COLORS : ACTOR_HULL_COLORS;

    for (const [key, groupNodes] of groupMap.entries()) {
      // Need at least 3 nodes for a meaningful hull
      if (groupNodes.length < 3) continue;

      // Extract 2D positions (XZ plane)
      const points2D: Point2D[] = [];
      let sumX = 0, sumY = 0, sumZ = 0;
      let validCount = 0;

      for (const n of groupNodes) {
        const x = n.x ?? 0;
        const y = (n as unknown as { y?: number }).y ?? 0;
        const z = (n as unknown as { z?: number }).z ?? 0;
        points2D.push({ x, z });
        sumX += x;
        sumY += y;
        sumZ += z;
        validCount++;
      }

      if (validCount < 3) continue;

      const hull2D = convexHull2D(points2D);
      if (hull2D.length < 3) continue;

      // Expand hull outward by a padding to enclose nodes visually
      const cx = sumX / validCount;
      const cz = sumZ / validCount;
      const padding = 15;

      const hullPoints = hull2D.map(p => {
        const dx = p.x - cx;
        const dz = p.z - cz;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        return {
          x: p.x + (dx / dist) * padding,
          y: sumY / validCount, // Use average Y for the hull plane
          z: p.z + (dz / dist) * padding,
        };
      });

      result.push({
        key,
        color: colorMap[key] ?? 'rgba(128, 128, 128, 0.06)',
        points: hullPoints,
        center: {
          x: sumX / validCount,
          y: sumY / validCount,
          z: sumZ / validCount,
        },
      });
    }

    hullsRef.current = result;
    return result;
  }, [groupMap, clusterMode]);

  // Compute initial hulls
  const hulls = useMemo(() => computeHulls(), [computeHulls]);

  return { hulls, computeHulls };
}

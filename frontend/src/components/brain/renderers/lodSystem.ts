/**
 * lodSystem — Level of Detail system for the brain visualization.
 *
 * Distance-based rendering quality tiers:
 *   - Far (>500 units from camera): render as simple colored points
 *   - Medium (200-500): basic meshes without labels
 *   - Close (<200): full meshes with labels and decorations
 *
 * The LOD system works by adjusting visibility and complexity of existing
 * Three.js objects based on camera distance, checked each frame.
 */

import * as THREE from 'three';
import type { ForceGraphMethods } from 'react-force-graph-3d';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Distance thresholds for LOD tiers */
export const LOD_FAR_DISTANCE = 500;
export const LOD_MEDIUM_DISTANCE = 200;

/** LOD tier enum */
export type LODTier = 'close' | 'medium' | 'far';

// ─── Point cloud for far-distance rendering ──────────────────────────────────

export interface PointCloudData {
  /** The Points object for the scene */
  points: THREE.Points;
  /** Update positions from current node data */
  update: (positions: Array<{ x: number; y: number; z: number; color: string }>) => void;
  /** Dispose GPU resources */
  dispose: () => void;
  /** Show/hide the point cloud */
  setVisible: (visible: boolean) => void;
}

const _tempColor = new THREE.Color();

/**
 * Create a reusable point cloud for far-distance LOD rendering.
 */
export function createPointCloud(maxNodes: number): PointCloudData {
  const positions = new Float32Array(maxNodes * 3);
  const colors = new Float32Array(maxNodes * 3);
  const sizes = new Float32Array(maxNodes);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  function update(nodeData: Array<{ x: number; y: number; z: number; color: string }>): void {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const count = Math.min(nodeData.length, maxNodes);

    for (let i = 0; i < count; i++) {
      const d = nodeData[i];
      posAttr.setXYZ(i, d.x, d.y, d.z);
      _tempColor.set(d.color);
      colAttr.setXYZ(i, _tempColor.r, _tempColor.g, _tempColor.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
  }

  function dispose(): void {
    geometry.dispose();
    material.dispose();
  }

  function setVisible(visible: boolean): void {
    points.visible = visible;
  }

  return { points, update, dispose, setVisible };
}

// ─── LOD tier computation ────────────────────────────────────────────────────

const _cameraPos = new THREE.Vector3();

/**
 * Determine the LOD tier based on camera distance to a point.
 */
export function getLODTier(distance: number): LODTier {
  if (distance > LOD_FAR_DISTANCE) return 'far';
  if (distance > LOD_MEDIUM_DISTANCE) return 'medium';
  return 'close';
}

/**
 * Get camera distance to the graph center (0,0,0) from a ForceGraph ref.
 * Returns Infinity if camera is not available.
 */
export function getCameraDistance(fgRef: { current?: ForceGraphMethods }): number {
  const fg = fgRef.current;
  if (!fg) return Infinity;

  try {
    // Access the Three.js camera via the ForceGraph internal renderer
    const scene = fg.scene?.();
    if (!scene) return Infinity;

    const camera = fg.camera?.();
    if (!camera) return Infinity;

    _cameraPos.copy(camera.position);
    return _cameraPos.length(); // Distance from origin
  } catch {
    return Infinity;
  }
}

/**
 * Compute per-node LOD tier based on camera position.
 * For performance, computes distance from camera to graph center (not per-node).
 */
export function computeGraphLODTier(fgRef: { current?: ForceGraphMethods }): LODTier {
  const distance = getCameraDistance(fgRef);
  return getLODTier(distance);
}

// ─── LOD visibility controller ───────────────────────────────────────────────

export interface LODController {
  /** Current LOD tier */
  tier: LODTier;
  /** Update LOD tier from camera — call each frame */
  update: (fgRef: { current?: ForceGraphMethods }) => LODTier;
  /** Whether labels should be visible at current tier */
  showLabels: boolean;
  /** Whether decorative elements (rings, etc.) should be visible */
  showDecorations: boolean;
  /** Whether to use point cloud instead of meshes */
  usePointCloud: boolean;
}

/**
 * Create a LOD controller that tracks the current tier.
 */
export function createLODController(): LODController {
  const controller: LODController = {
    tier: 'close',
    showLabels: true,
    showDecorations: true,
    usePointCloud: false,

    update(fgRef: { current?: ForceGraphMethods }): LODTier {
      const newTier = computeGraphLODTier(fgRef);
      controller.tier = newTier;
      controller.showLabels = newTier === 'close';
      controller.showDecorations = newTier === 'close';
      controller.usePointCloud = newTier === 'far';
      return newTier;
    },
  };

  return controller;
}

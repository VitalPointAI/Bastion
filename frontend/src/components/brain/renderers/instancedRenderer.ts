/**
 * instancedRenderer — InstancedMesh-based rendering for large brain graphs.
 *
 * Replaces individual THREE.Group-per-node with ONE InstancedMesh per geometry
 * type (sphere, octahedron, box, dodecahedron). Each instance gets per-instance
 * color and scale via InstancedBufferAttribute. This reduces draw calls from
 * O(n) to O(4).
 *
 * Used when node count > INSTANCED_THRESHOLD (200). Below that threshold,
 * the existing nodeThreeObject approach is used as fallback.
 */

import * as THREE from 'three';
import type { BrainNode, BrainNodeType } from '../types.js';
import { CATEGORY_COLORS } from '../types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const INSTANCED_THRESHOLD = 200;
const NODE_SIZE = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstancedNodeData {
  /** Node ID */
  id: string;
  /** Index into the InstancedMesh for this geometry type */
  instanceIndex: number;
  /** Which geometry type group this node belongs to */
  geometryType: BrainNodeType;
}

export interface InstancedMeshGroup {
  /** The four instanced meshes, keyed by BrainNodeType */
  meshes: Map<BrainNodeType, THREE.InstancedMesh>;
  /** Map from nodeId to its instanced data */
  nodeMap: Map<string, InstancedNodeData>;
  /** The parent group containing all meshes */
  group: THREE.Group;
  /** Dispose all GPU resources */
  dispose: () => void;
  /** Update instance transforms and colors from current node positions */
  update: (nodes: BrainNode[], selectedId?: string, selectedIds?: string[], focusDimmedFn?: (id: string) => boolean) => void;
}

// ─── Geometry cache ──────────────────────────────────────────────────────────

const geoCache: Partial<Record<BrainNodeType, THREE.BufferGeometry>> = {};

function getInstancedGeometry(type: BrainNodeType): THREE.BufferGeometry {
  if (!geoCache[type]) {
    switch (type) {
      case 'objective':
        geoCache[type] = new THREE.OctahedronGeometry(NODE_SIZE);
        break;
      case 'document':
        geoCache[type] = new THREE.BoxGeometry(NODE_SIZE * 1.4, NODE_SIZE * 1.4, NODE_SIZE * 1.4);
        break;
      case 'concept':
        geoCache[type] = new THREE.DodecahedronGeometry(NODE_SIZE);
        break;
      default: // entity
        geoCache[type] = new THREE.SphereGeometry(NODE_SIZE, 12, 8);
        break;
    }
  }
  return geoCache[type]!;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function getNodeColorHex(node: BrainNode): string {
  if (node.isGap) return '#ffaa00';
  if (node.isFuturePrediction) return '#aa66ff';
  if (node.actorCategory) return CATEGORY_COLORS[node.actorCategory] ?? '#888888';
  switch (node.type) {
    case 'objective': return '#f59e0b';
    case 'document': return '#06b6d4';
    case 'concept': return '#a78bfa';
    default: return '#888888';
  }
}

// ─── Temporary math objects (reused to avoid GC) ────────────────────────────

const _tempMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an InstancedMeshGroup for a set of brain nodes.
 * Call this once when the graph data changes, then call .update() each frame.
 */
export function createInstancedMeshGroup(nodes: BrainNode[]): InstancedMeshGroup {
  // Group nodes by geometry type
  const byType = new Map<BrainNodeType, BrainNode[]>();
  const nodeTypes: BrainNodeType[] = ['entity', 'objective', 'document', 'concept'];

  for (const type of nodeTypes) {
    byType.set(type, []);
  }

  for (const node of nodes) {
    const type = nodeTypes.includes(node.type) ? node.type : 'entity';
    byType.get(type)!.push(node);
  }

  const meshes = new Map<BrainNodeType, THREE.InstancedMesh>();
  const nodeMap = new Map<string, InstancedNodeData>();
  const group = new THREE.Group();

  for (const [type, typeNodes] of byType.entries()) {
    if (typeNodes.length === 0) continue;

    const geometry = getInstancedGeometry(type);
    const material = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.85,
      // vertexColors needed for per-instance coloring
    });

    const mesh = new THREE.InstancedMesh(geometry, material, typeNodes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Create per-instance color buffer
    const colorArray = new Float32Array(typeNodes.length * 3);
    for (let i = 0; i < typeNodes.length; i++) {
      const node = typeNodes[i];
      _tempColor.set(getNodeColorHex(node));
      colorArray[i * 3 + 0] = _tempColor.r;
      colorArray[i * 3 + 1] = _tempColor.g;
      colorArray[i * 3 + 2] = _tempColor.b;

      nodeMap.set(node.id, {
        id: node.id,
        instanceIndex: i,
        geometryType: type,
      });
    }

    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    // Initialize transforms
    for (let i = 0; i < typeNodes.length; i++) {
      const node = typeNodes[i];
      const scale = 0.6 + (node.confidence ?? 0.5) * 0.6 + (node.centrality ?? 0) * 0.4;
      _tempMatrix.compose(
        _tempPosition.set(node.x ?? 0, (node as unknown as { y?: number }).y ?? 0, (node as unknown as { z?: number }).z ?? 0),
        _tempQuaternion.identity(),
        _tempScale.set(scale, scale, scale),
      );
      mesh.setMatrixAt(i, _tempMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    meshes.set(type, mesh);
    group.add(mesh);
  }

  // ── Update function ──────────────────────────────────────────────────────

  function update(
    currentNodes: BrainNode[],
    selectedId?: string,
    selectedIds?: string[],
    focusDimmedFn?: (id: string) => boolean,
  ): void {
    const selectedSet = new Set(selectedIds ?? []);
    if (selectedId) selectedSet.add(selectedId);

    for (const node of currentNodes) {
      const data = nodeMap.get(node.id);
      if (!data) continue;

      const mesh = meshes.get(data.geometryType);
      if (!mesh) continue;

      const i = data.instanceIndex;

      // Update position from force simulation
      const x = node.x ?? 0;
      const y = (node as unknown as { y?: number }).y ?? 0;
      const z = (node as unknown as { z?: number }).z ?? 0;

      const isSelected = selectedSet.has(node.id);
      const isDimmed = focusDimmedFn ? focusDimmedFn(node.id) : false;

      let scale = 0.6 + (node.confidence ?? 0.5) * 0.6 + (node.centrality ?? 0) * 0.4;
      if (isSelected) scale *= 1.3;
      if (isDimmed) scale *= 0.6;

      _tempMatrix.compose(
        _tempPosition.set(x, y, z),
        _tempQuaternion.identity(),
        _tempScale.set(scale, scale, scale),
      );
      mesh.setMatrixAt(i, _tempMatrix);

      // Update color (dim if needed)
      if (mesh.instanceColor) {
        const baseColor = getNodeColorHex(node);
        _tempColor.set(baseColor);
        if (isDimmed) {
          _tempColor.multiplyScalar(0.2);
        }
        mesh.instanceColor.setXYZ(i, _tempColor.r, _tempColor.g, _tempColor.b);
      }
    }

    // Mark buffers for GPU upload
    for (const mesh of meshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    }
  }

  // ── Dispose function ─────────────────────────────────────────────────────

  function dispose(): void {
    for (const mesh of meshes.values()) {
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      // Don't dispose shared geometries — they're cached
    }
    group.clear();
  }

  return { meshes, nodeMap, group, dispose, update };
}

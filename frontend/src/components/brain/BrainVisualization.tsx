/**
 * BrainVisualization — 3D ForceGraph wrapper with Three.js rendering.
 *
 * Renders shape-coded nodes (entity=sphere, objective=octahedron, document=box,
 * concept=dodecahedron), colored by actor category, with confidence-based opacity.
 * Nodes are draggable in 3D space. Orbit controls for rotation/zoom/pan.
 *
 * Usage:
 *   <BrainVisualization data={brainData} onNodeClick={handleNodeClick} />
 */

import { useRef, useMemo, useCallback, useEffect, useState, type MutableRefObject } from 'react';
import ForceGraph3D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-3d';
import * as THREE from 'three';
import type { BrainNode, BrainGraphData, ClusterMode } from './types.js';
import { CATEGORY_COLORS, BRAIN_BG_COLOR } from './types.js';
import './BrainVisualization.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BrainVisualizationProps {
  data: BrainGraphData;
  selectedNodeId?: string;
  selectedNodeIds?: string[];
  onNodeClick?: (node: BrainNode) => void;
  width?: number;
  height?: number;
  clusterMode?: ClusterMode;
  onLassoSelect?: (nodeIds: string[]) => void;
  /** External ForceGraph ref — allows parent to drive zoom/pan and clustering forces */
  fgRef?: MutableRefObject<ForceGraphMethods | undefined>;
}

// ─── Internal types ────────────────────────────────────────────────────────────

type FGNode = BrainNode & { x?: number; y?: number; z?: number };

interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  type: string;
  strength?: number;
  isConflict?: boolean;
  createdAt?: string;
}

interface GraphPayload {
  nodes: FGNode[];
  links: FGLink[];
}

// ─── 3D geometry helpers ────────────────────────────────────────────────────────

const NODE_SIZE = 5;

const TYPE_GEOMETRY: Record<string, THREE.BufferGeometry> = {};
function getGeometry(type: string): THREE.BufferGeometry {
  if (!TYPE_GEOMETRY[type]) {
    switch (type) {
      case 'objective':
        TYPE_GEOMETRY[type] = new THREE.OctahedronGeometry(NODE_SIZE);
        break;
      case 'document':
        TYPE_GEOMETRY[type] = new THREE.BoxGeometry(NODE_SIZE * 1.4, NODE_SIZE * 1.4, NODE_SIZE * 1.4);
        break;
      case 'concept':
        TYPE_GEOMETRY[type] = new THREE.DodecahedronGeometry(NODE_SIZE);
        break;
      default: // entity
        TYPE_GEOMETRY[type] = new THREE.SphereGeometry(NODE_SIZE, 16, 12);
        break;
    }
  }
  return TYPE_GEOMETRY[type];
}

function getNodeColor(node: BrainNode): string {
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

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainVisualization({
  data,
  selectedNodeId,
  selectedNodeIds,
  onNodeClick,
  width,
  height,
  clusterMode: _clusterMode = 'container',
  onLassoSelect: _onLassoSelect,
  fgRef: externalFgRef,
}: BrainVisualizationProps) {
  void _clusterMode;
  void _onLassoSelect; // Lasso not applicable in 3D — use click selection

  const internalFgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const fgRef = externalFgRef ?? internalFgRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({
    w: width ?? 800,
    h: height ?? 600,
  });

  // Neighborhood set for dimming
  const neighborhoodRef = useRef<Set<string>>(new Set());

  // ── ResizeObserver ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Neighborhood computation ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNodeId) {
      neighborhoodRef.current = new Set();
      return;
    }
    const neighbors = new Set<string>([selectedNodeId]);
    for (const edge of (data.edges ?? [])) {
      const src = typeof edge.source === 'object' ? (edge.source as FGNode).id : edge.source;
      const tgt = typeof edge.target === 'object' ? (edge.target as FGNode).id : edge.target;
      if (src === selectedNodeId) neighbors.add(tgt);
      if (tgt === selectedNodeId) neighbors.add(src);
    }
    neighborhoodRef.current = neighbors;
  }, [selectedNodeId, data.edges]);

  // ── ForceGraph data ────────────────────────────────────────────────────────
  const graphPayload = useMemo<GraphPayload>(() => {
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const nodeIdSet = new Set(nodes.map((n) => n.id));
    return {
      nodes: nodes as FGNode[],
      links: edges
        .filter((e) => {
          const src = typeof e.source === 'object' ? (e.source as FGNode).id : e.source;
          const tgt = typeof e.target === 'object' ? (e.target as FGNode).id : e.target;
          return nodeIdSet.has(src) && nodeIdSet.has(tgt);
        })
        .map((e) => ({ ...e })) as FGLink[],
    };
  }, [data]);

  // ── 3D node rendering ─────────────────────────────────────────────────────
  const nodeThreeObject = useCallback(
    (node: NodeObject) => {
      const brainNode = node as FGNode;
      const isSelected =
        brainNode.id === selectedNodeId || (selectedNodeIds?.includes(brainNode.id) ?? false);
      const isDimmed =
        !!selectedNodeId &&
        !isSelected &&
        neighborhoodRef.current.size > 0 &&
        !neighborhoodRef.current.has(brainNode.id);

      const color = getNodeColor(brainNode);
      const geometry = getGeometry(brainNode.type);

      const material = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: isDimmed ? 0.15 : brainNode.isGap ? 0.5 : brainNode.isFuturePrediction ? 0.4 : 0.85,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Scale by confidence + centrality boost for outlier actors
      const centralityBoost = (brainNode.centrality ?? 0) * 0.4;
      const scale = 0.6 + brainNode.confidence * 0.6 + centralityBoost;
      mesh.scale.set(scale, scale, scale);

      // Selection ring
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(NODE_SIZE * scale * 1.3, NODE_SIZE * scale * 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        mesh.add(ring);
      }

      // Gap nodes: wireframe overlay
      if (brainNode.isGap) {
        const wireGeo = getGeometry(brainNode.type);
        const wireMat = new THREE.MeshBasicMaterial({
          color: '#ffaa00',
          wireframe: true,
          transparent: true,
          opacity: 0.6,
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.scale.set(1.2, 1.2, 1.2);
        mesh.add(wire);
      }

      return mesh;
    },
    [selectedNodeId, selectedNodeIds],
  );

  // ── Link styling ──────────────────────────────────────────────────────────
  const linkColor = useCallback(
    (link: object) => {
      const fgLink = link as FGLink;
      if (fgLink.isConflict) return 'rgba(255, 68, 68, 0.6)';
      const strength = fgLink.strength ?? 0.3;
      const alpha = 0.1 + strength * 0.4;
      return `rgba(100, 160, 255, ${alpha})`;
    },
    [],
  );

  const linkWidth = useCallback(
    (link: object) => {
      const fgLink = link as FGLink;
      return fgLink.isConflict ? 2 : 0.5 + (fgLink.strength ?? 0.3) * 2;
    },
    [],
  );

  // ── Node label ────────────────────────────────────────────────────────────
  const nodeLabel = useCallback(
    (node: object) => {
      const n = node as BrainNode;
      const parts = [n.label];
      if (n.type) parts.push(`[${n.type}]`);
      if (n.actorCategory) parts.push(`(${n.actorCategory})`);
      if (n.centrality != null && n.centrality > 0) parts.push(`centrality: ${(n.centrality * 100).toFixed(0)}%`);
      if (n.description) parts.push(`\n${n.description}`);
      return parts.join(' ');
    },
    [],
  );

  const handleNodeClick = useCallback(
    (node: NodeObject) => {
      onNodeClick?.(node as BrainNode);
      // Aim camera at clicked node
      const fg = fgRef.current;
      if (fg && node.x != null && node.y != null) {
        const n = node as FGNode;
        const distance = 120;
        fg.cameraPosition(
          { x: (n.x ?? 0) + distance, y: (n.y ?? 0) + distance, z: (n.z ?? 0) + distance },
          { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 },
          1000,
        );
      }
    },
    [onNodeClick, fgRef],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const w = width ?? containerSize.w;
  const h = height ?? containerSize.h;

  return (
    <div
      ref={containerRef}
      className="brain-visualization"
      style={{ width: '100%', height: '100%' }}
    >
      <ForceGraph3D
        ref={fgRef as MutableRefObject<ForceGraphMethods | undefined>}
        graphData={graphPayload}
        width={w}
        height={h}
        backgroundColor={BRAIN_BG_COLOR}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeThreeObject={nodeThreeObject}
        nodeLabel={nodeLabel}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.6}
        onNodeClick={handleNodeClick}
        enableNodeDrag={true}
        enableNavigationControls={true}
        warmupTicks={100}
        cooldownTicks={50}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.4}
      />
    </div>
  );
}

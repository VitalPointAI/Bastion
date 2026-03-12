/**
 * BrainVisualization — 3D ForceGraph wrapper with Three.js rendering.
 *
 * Renders shape-coded nodes (entity=sphere, objective=octahedron, document=box,
 * concept=dodecahedron), colored by actor category, with confidence-based opacity.
 * Nodes are draggable in 3D space. Orbit controls for rotation/zoom/pan.
 *
 * Each node displays a persistent text sprite label and a rich HTML tooltip on hover.
 *
 * Performance: geometries and materials are cached to avoid Three.js GC pressure.
 * The force simulation halts after cooldown to prevent ongoing CPU drain.
 *
 * Usage:
 *   <BrainVisualization data={brainData} onNodeClick={handleNodeClick} />
 */

import { useRef, useMemo, useCallback, useEffect, useState, type MutableRefObject } from 'react';
import ForceGraph3D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
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

type FGNode = BrainNode & { x?: number; y?: number; z?: number; __threeObj?: THREE.Object3D };

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

// ─── 3D geometry + material cache ──────────────────────────────────────────────

const NODE_SIZE = 5;

const geometryCache: Record<string, THREE.BufferGeometry> = {};
function getGeometry(type: string): THREE.BufferGeometry {
  if (!geometryCache[type]) {
    switch (type) {
      case 'objective':
        geometryCache[type] = new THREE.OctahedronGeometry(NODE_SIZE);
        break;
      case 'document':
        geometryCache[type] = new THREE.BoxGeometry(NODE_SIZE * 1.4, NODE_SIZE * 1.4, NODE_SIZE * 1.4);
        break;
      case 'concept':
        geometryCache[type] = new THREE.DodecahedronGeometry(NODE_SIZE);
        break;
      default: // entity
        geometryCache[type] = new THREE.SphereGeometry(NODE_SIZE, 16, 12);
        break;
    }
  }
  return geometryCache[type];
}

/** Cache materials by "color|opacity" key to avoid GC pressure */
const materialCache = new Map<string, THREE.MeshLambertMaterial>();
function getMaterial(color: string, opacity: number): THREE.MeshLambertMaterial {
  const key = `${color}|${opacity.toFixed(2)}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity });
    materialCache.set(key, mat);
  }
  return mat;
}

const ringMaterialCache = new Map<string, THREE.MeshBasicMaterial>();
function getRingMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const key = `ring|${color}|${opacity}`;
  let mat = ringMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
    ringMaterialCache.set(key, mat);
  }
  return mat;
}

const wireMaterialCache = new Map<string, THREE.MeshBasicMaterial>();
function getWireMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const key = `wire|${color}|${opacity}`;
  let mat = wireMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity });
    wireMaterialCache.set(key, mat);
  }
  return mat;
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

// ─── Node type display names ──────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  entity: '\u25CF',     // ● filled circle
  objective: '\u25C6',  // ◆ diamond
  document: '\u25A0',   // ■ square
  concept: '\u2B22',    // ⬢ hexagon
};

const TYPE_LABELS: Record<string, string> = {
  entity: 'Actor',
  objective: 'Objective',
  document: 'Document',
  concept: 'Theme',
};

const CATEGORY_DISPLAY: Record<string, string> = {
  ally: 'Ally',
  adversary: 'Adversary',
  neutral: 'Neutral',
  partner: 'Partner',
};

// ─── Label helpers ────────────────────────────────────────────────────────────

/** Build a concise, human-readable display label for the 3D text sprite */
function getDisplayLabel(node: BrainNode): string {
  const name = node.label || node.id || '?';

  switch (node.type) {
    case 'entity': {
      // Show name, and category prefix if it's adversary or ally
      const cat = node.actorCategory;
      if (cat === 'adversary') return `⚠ ${name}`;
      if (cat === 'ally') return `★ ${name}`;
      return name;
    }
    case 'objective':
      // Truncate long objective text
      return name.length > 40 ? name.slice(0, 38) + '…' : name;
    case 'document':
      // Strip common extensions
      return name.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');
    case 'concept':
      return `◈ ${name}`;
    default:
      return name;
  }
}

/** Build rich HTML tooltip for hover */
function buildTooltipHtml(node: BrainNode): string {
  const typeLabel = TYPE_LABELS[node.type] ?? node.type;
  const typeIcon = TYPE_ICONS[node.type] ?? '';
  const color = getNodeColor(node);
  const confidence = Math.round(node.confidence * 100);
  const centrality = node.centrality != null ? Math.round(node.centrality * 100) : null;

  const lines: string[] = [];

  // Header with name and type
  lines.push(`<div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">${node.label || node.id || '?'}</div>`);
  lines.push(`<div style="font-size:11px;color:${color};margin-bottom:6px">${typeIcon} ${typeLabel}`);
  if (node.actorCategory) {
    const catDisplay = CATEGORY_DISPLAY[node.actorCategory] ?? node.actorCategory;
    lines.push(` — <span style="color:${CATEGORY_COLORS[node.actorCategory] ?? '#888'}">${catDisplay}</span>`);
  }
  lines.push(`</div>`);

  // Description
  if (node.description) {
    const desc = node.description.length > 120 ? node.description.slice(0, 118) + '…' : node.description;
    lines.push(`<div style="font-size:11px;color:#ccc;margin-bottom:4px;line-height:1.4">${desc}</div>`);
  }

  // Role
  if (node.role) {
    lines.push(`<div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Role: ${node.role}</div>`);
  }

  // Aliases
  if (node.aliases && node.aliases.length > 0) {
    const aliasText = node.aliases.slice(0, 3).join(', ');
    lines.push(`<div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Also: ${aliasText}</div>`);
  }

  // Stats bar
  const stats: string[] = [];
  stats.push(`<span>Confidence: ${confidence}%</span>`);
  if (centrality != null) stats.push(`<span>Centrality: ${centrality}%</span>`);
  if (node.dimeCategory) stats.push(`<span>DIME: ${node.dimeCategory}</span>`);
  lines.push(`<div style="font-size:10px;color:#6b7280;display:flex;gap:8px;margin-top:2px">${stats.join('')}</div>`);

  // Badges
  if (node.isGap) {
    lines.push(`<div style="font-size:10px;color:#ffaa00;margin-top:4px">⚠ Intelligence Gap</div>`);
  }
  if (node.isFuturePrediction) {
    lines.push(`<div style="font-size:10px;color:#aa66ff;margin-top:4px">🔮 Future Prediction (${Math.round((node.predictionConfidence ?? 0) * 100)}%)</div>`);
  }

  return `<div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:8px 10px;max-width:280px;font-family:system-ui,sans-serif">${lines.join('')}</div>`;
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

  // ── 3D node rendering (cached materials) ────────────────────────────────────
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
      const opacity = isDimmed ? 0.15 : brainNode.isGap ? 0.5 : brainNode.isFuturePrediction ? 0.4 : 0.85;
      const material = getMaterial(color, opacity);

      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, material);

      // Scale by confidence + centrality boost for outlier actors
      const centralityBoost = (brainNode.centrality ?? 0) * 0.4;
      const scale = 0.6 + brainNode.confidence * 0.6 + centralityBoost;
      mesh.scale.set(scale, scale, scale);
      group.add(mesh);

      // Selection ring
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(NODE_SIZE * scale * 1.3, NODE_SIZE * scale * 1.5, 32);
        const ring = new THREE.Mesh(ringGeo, getRingMaterial('#38bdf8', 0.8));
        group.add(ring);
      }

      // Gap nodes: wireframe overlay
      if (brainNode.isGap) {
        const wire = new THREE.Mesh(getGeometry(brainNode.type), getWireMaterial('#ffaa00', 0.6));
        wire.scale.set(scale * 1.2, scale * 1.2, scale * 1.2);
        group.add(wire);
      }

      // Persistent text label sprite above the node
      const displayLabel = getDisplayLabel(brainNode);
      const sprite = new SpriteText(displayLabel);
      sprite.color = isDimmed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';
      sprite.textHeight = 2.5;
      sprite.backgroundColor = isDimmed ? 'transparent' : 'rgba(0,0,0,0.5)';
      sprite.padding = 1;
      sprite.borderRadius = 1;
      sprite.position.set(0, NODE_SIZE * scale + 4, 0);
      group.add(sprite);

      return group;
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

  // ── Link label (relationship type) ──────────────────────────────────────────
  const linkThreeObject = useCallback(
    (link: object) => {
      const fgLink = link as FGLink;
      const label = fgLink.type === 'related' ? '' : fgLink.type;
      if (!label) return new THREE.Group(); // no label for generic "related"
      const sprite = new SpriteText(label);
      sprite.color = fgLink.isConflict ? 'rgba(255,100,100,0.7)' : 'rgba(180,200,255,0.5)';
      sprite.textHeight = 1.5;
      sprite.backgroundColor = 'transparent';
      return sprite;
    },
    [],
  );

  const linkPositionUpdate = useCallback(
    (sprite: THREE.Object3D, _coords: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
      // Position link label at midpoint
      sprite.position.set(
        (_coords.start.x + _coords.end.x) / 2,
        (_coords.start.y + _coords.end.y) / 2,
        (_coords.start.z + _coords.end.z) / 2,
      );
    },
    [],
  );

  // ── Node tooltip (HTML) ────────────────────────────────────────────────────
  const nodeLabel = useCallback(
    (node: object) => buildTooltipHtml(node as BrainNode),
    [],
  );

  const handleNodeClick = (node: NodeObject) => {
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
  };

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
        linkThreeObject={linkThreeObject}
        linkPositionUpdate={linkPositionUpdate as unknown as (obj: object, coords: object, link: object) => void}
        onNodeClick={handleNodeClick}
        enableNodeDrag={true}
        enableNavigationControls={true}
        warmupTicks={80}
        cooldownTicks={100}
        cooldownTime={8000}
        d3AlphaDecay={0.06}
        d3VelocityDecay={0.4}
      />
    </div>
  );
}

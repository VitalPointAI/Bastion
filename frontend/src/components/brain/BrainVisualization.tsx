/**
 * BrainVisualization — 3D ForceGraph wrapper with Three.js rendering.
 *
 * Renders shape-coded nodes (entity=sphere, objective=octahedron, document=box,
 * concept=dodecahedron), colored by actor category, with confidence-based opacity.
 * Nodes are draggable in 3D space. Orbit controls for rotation/zoom/pan.
 *
 * Each node displays a persistent text sprite label and a rich HTML tooltip on hover.
 *
 * Performance optimizations:
 *   - Geometries and materials cached globally (never re-created)
 *   - SpriteText labels cached per node ID, only recreated on label change
 *   - Ring geometry pooled at fixed sizes to avoid per-frame allocation
 *   - Simulation paused after cooldown to eliminate idle CPU drain
 *   - nodeThreeObject returns mutable groups that update in-place via nodeThreeObjectExtend=false
 *
 * Usage:
 *   <BrainVisualization data={brainData} onNodeClick={handleNodeClick} />
 */

import { useRef, useMemo, useCallback, useEffect, useState, type MutableRefObject } from 'react';
import ForceGraph3D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { BrainNode, BrainGraphData, ClusterMode, DrillLevel } from './types.js';
import { CATEGORY_COLORS, BRAIN_BG_COLOR } from './types.js';
import './BrainVisualization.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BrainVisualizationProps {
  data: BrainGraphData;
  selectedNodeId?: string;
  selectedNodeIds?: string[];
  onNodeClick?: (node: BrainNode) => void;
  /** Called on right-click — drives context menu */
  onNodeRightClick?: (node: BrainNode, event: MouseEvent) => void;
  /** Called on right-click background — context menu without node */
  onBackgroundRightClick?: (event: MouseEvent) => void;
  /** Called on double-click — drives Phase 45 drill-down */
  onNodeDoubleClick?: (node: BrainNode) => void;
  width?: number;
  height?: number;
  clusterMode?: ClusterMode;
  onLassoSelect?: (nodeIds: string[]) => void;
  /** External ForceGraph ref — allows parent to drive zoom/pan and clustering forces */
  fgRef?: MutableRefObject<ForceGraphMethods | undefined>;
  /** Current drill level — used to show/hide the N-hop expand button */
  drillLevel?: DrillLevel;
  /** Number of N-hop rings currently expanded (shown on expand button) */
  expandedHops?: number;
  /** If true, shows a "may be slow" warning near the expand button */
  nhopWarning?: boolean;
  /** Called when user clicks the N-hop expand button at Level 3 */
  onExpand?: () => void;
}

// ─── Internal types ────────────────────────────────────────────────────────────

type FGNode = BrainNode & { x?: number; y?: number; z?: number; __threeObj?: THREE.Object3D };

interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  type: string;
  strength?: number;
  isConflict?: boolean;
  isContradiction?: boolean;
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
  // Quantize opacity to 0.05 steps to reduce cache cardinality
  const quantizedOpacity = Math.round(opacity * 20) / 20;
  const key = `${color}|${quantizedOpacity}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: quantizedOpacity });
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

/** Pool ring geometries at discrete scale steps to avoid per-frame allocation */
const ringGeoCache = new Map<string, THREE.RingGeometry>();
function getRingGeometry(scale: number): THREE.RingGeometry {
  // Quantize to 0.1 steps
  const q = Math.round(scale * 10) / 10;
  const key = `${q}`;
  let geo = ringGeoCache.get(key);
  if (!geo) {
    geo = new THREE.RingGeometry(NODE_SIZE * q * 1.3, NODE_SIZE * q * 1.5, 16); // 16 segments instead of 32
    ringGeoCache.set(key, geo);
  }
  return geo;
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

// ─── SpriteText cache ────────────────────────────────────────────────────────
// Avoid creating new SpriteText objects on every nodeThreeObject call.
// Cache by nodeId + label text; only recreate when the label changes.

const spriteLabelCache = new Map<string, { label: string; sprite: SpriteText }>();

function getCachedSprite(nodeId: string, displayLabel: string, isDimmed: boolean): SpriteText {
  const cached = spriteLabelCache.get(nodeId);
  if (cached && cached.label === displayLabel) {
    // Update opacity in-place (cheap)
    cached.sprite.color = isDimmed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';
    cached.sprite.backgroundColor = isDimmed ? 'transparent' : 'rgba(0,0,0,0.5)';
    return cached.sprite;
  }
  // Create new sprite
  const sprite = new SpriteText(displayLabel);
  sprite.color = isDimmed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';
  sprite.textHeight = 2.5;
  sprite.backgroundColor = isDimmed ? 'transparent' : 'rgba(0,0,0,0.5)';
  sprite.padding = 1;
  sprite.borderRadius = 1;
  spriteLabelCache.set(nodeId, { label: displayLabel, sprite });
  return sprite;
}

// Clean up stale cache entries when graph data changes
function cleanSpriteCache(activeIds: Set<string>): void {
  for (const key of spriteLabelCache.keys()) {
    if (!activeIds.has(key)) spriteLabelCache.delete(key);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainVisualization({
  data,
  selectedNodeId,
  selectedNodeIds,
  onNodeClick,
  onNodeRightClick,
  onBackgroundRightClick,
  onNodeDoubleClick,
  width,
  height,
  clusterMode: _clusterMode = 'container',
  onLassoSelect: _onLassoSelect,
  fgRef: externalFgRef,
  drillLevel,
  expandedHops = 0,
  nhopWarning = false,
  onExpand,
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

  // Track simulation halted state to prevent idle CPU drain
  const simulationHaltedRef = useRef(false);

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

  // ── Neighborhood computation + direct opacity update ───────────────────────
  // Instead of relying on ForceGraph3D to re-call nodeThreeObject for ALL nodes
  // (which causes a freeze), we compute the neighborhood and update opacity
  // directly on cached Three.js objects outside the React render cycle.
  useEffect(() => {
    if (!selectedNodeId) {
      neighborhoodRef.current = new Set();
    } else {
      const neighbors = new Set<string>([selectedNodeId]);
      for (const edge of (data.edges ?? [])) {
        const src = typeof edge.source === 'object' ? (edge.source as FGNode).id : edge.source;
        const tgt = typeof edge.target === 'object' ? (edge.target as FGNode).id : edge.target;
        if (src === selectedNodeId) neighbors.add(tgt);
        if (tgt === selectedNodeId) neighbors.add(src);
      }
      neighborhoodRef.current = neighbors;
    }

    // Directly update opacity on all cached node objects — no ForceGraph re-render needed
    requestAnimationFrame(() => {
      const cache = nodeObjCacheRef.current;
      const neighborhood = neighborhoodRef.current;
      const hasSelection = !!selectedNodeId;

      cache.forEach(({ group, key }, nodeId) => {
        if (key === 'ghost') return;
        const isDimmed = hasSelection && nodeId !== selectedNodeId && neighborhood.size > 0 && !neighborhood.has(nodeId);
        const opacity = isDimmed ? 0.15 : 0.85;
        group.traverse((child) => {
          if ((child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat.opacity !== undefined) mat.opacity = opacity;
          }
        });
      });
    });
  }, [selectedNodeId, data.edges]);

  // ── Clean sprite cache when data changes ──────────────────────────────────
  useEffect(() => {
    const activeIds = new Set((data.nodes ?? []).map((n) => n.id));
    cleanSpriteCache(activeIds);
  }, [data.nodes]);

  // ── ForceGraph data ────────────────────────────────────────────────────────
  // ForceGraph3D MUST NOT be mounted with empty data — the d3 force simulation
  // is only created when nodes exist, but the animation loop (requestAnimationFrame)
  // starts immediately in init(). This causes "Cannot read properties of undefined
  // (reading 'tick')" when _animationCycle fires before the simulation exists.
  //
  // Solution: track whether we've ever received data. Once true, keep ForceGraph3D
  // mounted forever (even if data temporarily empties during filter/drill changes).
  // This prevents the mount-with-empty-data crash and avoids unmount/remount cycles
  // that leave orphaned animation frames.
  const [graphReady, setGraphReady] = useState(false);

  const graphPayload = useMemo<GraphPayload>(() => {
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    if (nodes.length === 0) return { nodes: [], links: [] };
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

  // Once data arrives, mark graph as ready. Never goes back to false —
  // ForceGraph3D stays mounted even if data temporarily empties.
  useEffect(() => {
    if (!graphReady && graphPayload.nodes.length > 0) {
      setGraphReady(true);
    }
  }, [graphReady, graphPayload.nodes.length]);

  // Clear object caches when graph data changes
  useEffect(() => {
    nodeObjCacheRef.current.clear();
    linkSpriteCacheRef.current.clear();
  }, [data]);

  // ── 3D node rendering (with per-node object caching) ────────────────────────
  //
  // react-force-graph-3d calls nodeThreeObject for every node on every render
  // cycle. To avoid GC pressure and GPU thrashing, we cache the THREE.Group
  // per node ID and only rebuild when selection/dimming state actually changes.
  const nodeObjCacheRef = useRef(new Map<string, { group: THREE.Group; key: string }>());
  const selectedIdRef = useRef(selectedNodeId);
  const selectedIdsRef = useRef(selectedNodeIds);

  // Sync selection refs in effect (not during render) per react-hooks/refs rule
  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
    selectedIdsRef.current = selectedNodeIds;
  }, [selectedNodeId, selectedNodeIds]);

  const nodeThreeObject = useCallback(
    (node: NodeObject) => {
      if (!node) return new THREE.Group();
      const brainNode = node as FGNode;
      if (!brainNode.id) return new THREE.Group();
      const cache = nodeObjCacheRef.current;

      // ── Ghost stub rendering (Phase 45)
      if ((brainNode as { isGhostStub?: boolean }).isGhostStub) {
        const cached = cache.get(brainNode.id);
        if (cached && cached.key === 'ghost') return cached.group;
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(getGeometry(brainNode.type ?? 'entity'), getMaterial('#6490ff', 0.15));
        mesh.scale.set(0.4, 0.4, 0.4);
        group.add(mesh);
        cache.set(brainNode.id, { group, key: 'ghost' });
        return group;
      }

      const color = getNodeColor(brainNode);

      // Compute selection state (dimming is handled by the neighborhood effect)
      const selId = selectedIdRef.current;
      const selIds = selectedIdsRef.current;
      const isSelected = brainNode.id === selId || (selIds?.includes(brainNode.id) ?? false);
      const isDimmed = false; // Dimming applied asynchronously via neighborhood effect
      const targetOpacity = brainNode.isGap ? 0.5 : brainNode.isFuturePrediction ? 0.4 : 0.85;

      const cacheKey = `${color}|${isSelected ? 1 : 0}|${brainNode.isGap ? 1 : 0}|${brainNode.confidence}|${brainNode.centrality ?? 0}|${brainNode.confidenceTier ?? ''}`;
      const cached = cache.get(brainNode.id);

      if (cached && cached.key === cacheKey) {
        return cached.group;
      }

      // Rebuild the THREE.Group only when node data actually changes
      const geometry = getGeometry(brainNode.type);
      const material = getMaterial(color, targetOpacity);
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, material);

      const centralityBoost = (brainNode.centrality ?? 0) * 0.4;
      const scale = 0.6 + brainNode.confidence * 0.6 + centralityBoost;
      mesh.scale.set(scale, scale, scale);
      group.add(mesh);

      if (isSelected) {
        const ring = new THREE.Mesh(getRingGeometry(scale), getRingMaterial('#38bdf8', 0.8));
        group.add(ring);
      }

      // Confidence-tier stroke ring: high=solid cyan, medium=dashed amber, low=dotted red
      if (!isSelected && brainNode.confidenceTier) {
        const tierColors: Record<string, string> = { high: '#34d399', medium: '#fbbf24', low: '#f87171' };
        const tierColor = tierColors[brainNode.confidenceTier] ?? '#888888';
        const tierOpacity = brainNode.confidenceTier === 'high' ? 0.5 : brainNode.confidenceTier === 'medium' ? 0.65 : 0.8;
        const tierRing = new THREE.Mesh(getRingGeometry(scale * 1.1), getRingMaterial(tierColor, tierOpacity));
        group.add(tierRing);
      }

      if (brainNode.isGap) {
        const wire = new THREE.Mesh(getGeometry(brainNode.type), getWireMaterial('#ffaa00', 0.6));
        wire.scale.set(scale * 1.2, scale * 1.2, scale * 1.2);
        group.add(wire);
      }

      const displayLabel = getDisplayLabel(brainNode);
      const sprite = getCachedSprite(brainNode.id, displayLabel, isDimmed);
      sprite.position.set(0, NODE_SIZE * scale + 4, 0);
      group.add(sprite);

      cache.set(brainNode.id, { group, key: cacheKey });
      return group;
    },
    [], // Stable callback — uses refs for selection state
  );

  // Selection changes are handled by the cacheKey in nodeThreeObject —
  // nodes whose visual state changed (selected/dimmed) will cache-miss
  // and rebuild automatically. No need to clear the entire cache, which
  // causes a full rebuild of all THREE.Group objects and GC spikes.

  // ── Link styling ──────────────────────────────────────────────────────────
  const linkColor = useCallback(
    (link: object) => {
      if (!link) return 'rgba(100, 160, 255, 0.3)';
      const fgLink = link as FGLink;
      // Ghost links (Phase 45 — cross-boundary edges to ghost stub nodes)
      if ((fgLink as { isGhostLink?: boolean }).isGhostLink) return 'rgba(100, 160, 255, 0.1)';
      if (fgLink.isConflict || fgLink.isContradiction) return 'rgba(255, 68, 68, 0.8)';
      const strength = fgLink.strength ?? 0.3;
      const alpha = 0.1 + strength * 0.4;
      return `rgba(100, 160, 255, ${alpha})`;
    },
    [],
  );

  const linkWidth = useCallback(
    (link: object) => {
      if (!link) return 0.5;
      const fgLink = link as FGLink;
      // Ghost links render thin
      if ((fgLink as { isGhostLink?: boolean }).isGhostLink) return 0.3;
      return (fgLink.isConflict || fgLink.isContradiction) ? 2.5 : 0.5 + (fgLink.strength ?? 0.3) * 2;
    },
    [],
  );

  // NOTE: react-force-graph-3d's linkOpacity only accepts a scalar number.
  // Ghost link opacity is handled via the alpha channel in linkColor (0.1 for ghosts).
  // This constant is used as the baseline opacity for non-ghost links.
  const LINK_OPACITY = 0.6;

  // ── Link labels — skip for performance when graph is large ────────────────
  const nodeCount = graphPayload.nodes.length;
  const linkCount = graphPayload.links.length;
  const showLinkLabels = linkCount < 100; // Only show link labels for small graphs

  const linkSpriteCacheRef = useRef(new Map<string, THREE.Object3D>());

  const linkThreeObject = useCallback(
    (link: object) => {
      // Must return a unique THREE.Object3D per link — shared instances cause
      // Three.js reparenting which corrupts the force graph scene graph
      if (!link || !showLinkLabels) return new THREE.Group();
      const fgLink = link as FGLink;
      const label = fgLink.type === 'related' ? '' : fgLink.type;
      if (!label) return new THREE.Group();

      const linkKey = `${fgLink.source}-${fgLink.target}-${fgLink.type}`;
      const cached = linkSpriteCacheRef.current.get(linkKey);
      if (cached) return cached;

      const sprite = new SpriteText(label);
      sprite.color = (fgLink.isConflict || fgLink.isContradiction) ? 'rgba(255,100,100,0.7)' : 'rgba(180,200,255,0.5)';
      sprite.textHeight = 1.5;
      sprite.backgroundColor = 'transparent';
      linkSpriteCacheRef.current.set(linkKey, sprite);
      return sprite;
    },
    [showLinkLabels],
  );

  const linkPositionUpdate = useCallback(
    (sprite: THREE.Object3D, _coords: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
      if (!sprite || !_coords?.start || !_coords?.end) return;
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

  // ── Double-click detection via click timing ────────────────────────────────
  // react-force-graph-3d has no onNodeDoubleClick — detect via two rapid clicks.
  const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null);
  const DOUBLE_CLICK_MS = 300;

  const handleNodeDoubleClick = (node: NodeObject) => {
    // Skip double-click on ghost stubs — they are boundary hints, not drillable
    if ((node as { isGhostStub?: boolean }).isGhostStub) return;
    onNodeDoubleClick?.(node as BrainNode);
  };

  const handleNodeClickWithDoubleDetect = (node: NodeObject) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.nodeId === (node as FGNode).id && now - last.time < DOUBLE_CLICK_MS) {
      // Double-click detected
      lastClickRef.current = null;
      handleNodeDoubleClick(node);
      return;
    }
    lastClickRef.current = { nodeId: (node as FGNode).id, time: now };
    handleNodeClick(node);
  };

  // ── Simulation halt callback — stop CPU drain after layout stabilizes ──────
  const handleEngineStop = useCallback(() => {
    simulationHaltedRef.current = true;
  }, []);

  // ── Pause animation on unmount to prevent stale _animationCycle ticks ──────
  useEffect(() => {
    const fg = fgRef.current;
    return () => {
      if (fg) {
        try { fg.pauseAnimation(); } catch { /* already destroyed */ }
      }
    };
  }, [fgRef]);

  // ── Adaptive simulation parameters based on graph size ─────────────────────
  const simParams = useMemo(() => {
    if (nodeCount > 200) {
      return { warmupTicks: 40, cooldownTicks: 50, cooldownTime: 4000, alphaDecay: 0.08, velocityDecay: 0.5 };
    }
    if (nodeCount > 100) {
      return { warmupTicks: 60, cooldownTicks: 80, cooldownTime: 6000, alphaDecay: 0.07, velocityDecay: 0.45 };
    }
    return { warmupTicks: 80, cooldownTicks: 100, cooldownTime: 8000, alphaDecay: 0.06, velocityDecay: 0.4 };
  }, [nodeCount]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const w = width ?? containerSize.w;
  const h = height ?? containerSize.h;

  // Performance info for debugging (visible in DevTools)
  useEffect(() => {
    if (nodeCount > 0) {
      console.log(`[BrainViz] ${nodeCount} nodes, ${linkCount} links. Link labels: ${showLinkLabels ? 'ON' : 'OFF (>100 links)'}. Sim params:`, simParams);
    }
  }, [nodeCount, linkCount, showLinkLabels, simParams]);

  // ── Show Level 3 at node detail
  const showExpandButton = drillLevel === 'node' && onExpand !== undefined;

  return (
    <div
      ref={containerRef}
      className="brain-visualization"
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onContextMenu={(e) => {
        e.preventDefault();
        onBackgroundRightClick?.(e.nativeEvent);
      }}
    >
      {graphReady ? (
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
          linkOpacity={LINK_OPACITY}
          linkThreeObject={linkThreeObject}
          linkThreeObjectExtend={true}
          linkPositionUpdate={linkPositionUpdate as unknown as (obj: object, coords: object, link: object) => void}
          onNodeClick={handleNodeClickWithDoubleDetect}
          onNodeRightClick={(node: NodeObject | undefined, event: MouseEvent) => {
            event.preventDefault();
            if (node) onNodeRightClick?.(node as BrainNode, event);
            else onBackgroundRightClick?.(event);
          }}
          onBackgroundClick={(_event: MouseEvent) => {
            // No-op — let BrainController handle background clicks if needed
          }}
          onEngineStop={handleEngineStop}
          enableNodeDrag={true}
          enableNavigationControls={true}
          warmupTicks={simParams.warmupTicks}
          cooldownTicks={simParams.cooldownTicks}
          cooldownTime={simParams.cooldownTime}
          d3AlphaDecay={simParams.alphaDecay}
          d3VelocityDecay={simParams.velocityDecay}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
          Loading graph...
        </div>
      )}

      {/* Phase 45 — N-hop expand button at Level 3 (node detail) */}
      {showExpandButton && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            zIndex: 20,
          }}
        >
          {nhopWarning && (
            <span
              style={{
                fontSize: '11px',
                color: '#f59e0b',
                background: 'rgba(0,0,0,0.7)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Loading may be slow at this depth
            </span>
          )}
          <button
            type="button"
            onClick={onExpand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '20px',
              color: '#38bdf8',
              fontSize: '13px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
            title="Load next hop ring of neighbors"
          >
            <span style={{ fontSize: '16px' }}>&#9711;</span>
            Expand
            {expandedHops > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  padding: '1px 6px',
                  borderRadius: '8px',
                }}
              >
                Hop {expandedHops}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

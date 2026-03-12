/**
 * BrainVisualization — core ForceGraph2D wrapper with custom Canvas 2D renderers.
 *
 * Renders shape-coded nodes (entity=circle, objective=diamond, document=square,
 * concept=hexagon), confidence glow, weighted edges, pulse animation, semantic zoom,
 * and neighborhood dimming. Lasso multi-select via Alt-drag.
 *
 * Usage:
 *   <BrainVisualization data={brainData} onNodeClick={handleNodeClick} />
 */

import { useRef, useMemo, useCallback, useEffect, useState, type MutableRefObject } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';
import type { BrainNode, BrainEdge, BrainGraphData, ClusterMode } from './types.js';
import { BRAIN_BG_COLOR } from './types.js';
import { drawBrainNode } from './renderers/nodeRenderer.js';
import { drawBrainEdge } from './renderers/edgeRenderer.js';
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
  /** External ForceGraph ref — allows parent (e.g. BrainController) to drive zoom/pan and clustering forces */
  fgRef?: MutableRefObject<ForceGraphMethods | undefined>;
}

// ─── Internal types ────────────────────────────────────────────────────────────

/** ForceGraph2D injects x/y onto every node during simulation */
type FGNode = BrainNode & { x?: number; y?: number };

/** ForceGraph2D mutates source/target from string IDs to node objects during simulation */
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

// ─── Lasso point-in-polygon (ray casting) ─────────────────────────────────────

function pointInPolygon(
  px: number,
  py: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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
  onLassoSelect,
  fgRef: externalFgRef,
}: BrainVisualizationProps) {
  void _clusterMode; // Future: drive force grouping

  const internalFgRef = useRef<ForceGraphMethods | undefined>(undefined);
  // Use external ref if provided, otherwise fall back to internal ref
  const fgRef = externalFgRef ?? internalFgRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const lassoCanvasRef = useRef<HTMLCanvasElement>(null);

  // Animation frame counter — lives in a ref (not state) to avoid re-renders
  const animFrameRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Responsive dimensions
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({
    w: width ?? 800,
    h: height ?? 600,
  });

  // Lasso state
  const [isLassoing, setIsLassoing] = useState(false);
  const [isAltDown, setIsAltDown] = useState(false);
  const lassoPathRef = useRef<Array<{ x: number; y: number }>>([]);

  // Neighborhood set for dimming — recomputed when selection changes
  const neighborhoodRef = useRef<Set<string>>(new Set());

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    function loop() {
      animFrameRef.current += 1;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── ResizeObserver for responsive width ────────────────────────────────────
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
    for (const edge of data.edges) {
      const src = typeof edge.source === 'object' ? (edge.source as FGNode).id : edge.source;
      const tgt = typeof edge.target === 'object' ? (edge.target as FGNode).id : edge.target;
      if (src === selectedNodeId) neighbors.add(tgt);
      if (tgt === selectedNodeId) neighbors.add(src);
    }
    neighborhoodRef.current = neighbors;
  }, [selectedNodeId, data.edges]);

  // ── ForceGraph2D data (nodes → nodes, edges → links) ──────────────────────
  const graphPayload = useMemo<GraphPayload>(() => {
    const nodeIdSet = new Set(data.nodes.map((n) => n.id));
    return {
      nodes: data.nodes as FGNode[],
      // ForceGraph2D will mutate source/target from string IDs to node objects;
      // the cast makes TypeScript accept both the initial string form and the
      // post-simulation object form.
      // Filter out links referencing missing nodes to prevent d3-force crashes.
      links: (data.edges ?? [])
        .filter((e) => {
          const src = typeof e.source === 'object' ? (e.source as FGNode).id : e.source;
          const tgt = typeof e.target === 'object' ? (e.target as FGNode).id : e.target;
          return nodeIdSet.has(src) && nodeIdSet.has(tgt);
        })
        .map((e) => ({ ...e })) as FGLink[],
    };
  }, [data]);

  // ── Canvas renderers ───────────────────────────────────────────────────────

  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const brainNode = node as FGNode;
      const isSelected =
        brainNode.id === selectedNodeId || (selectedNodeIds?.includes(brainNode.id) ?? false);
      // Dim nodes that are not in the neighborhood of the selected node
      const isDimmed =
        !!selectedNodeId &&
        !isSelected &&
        neighborhoodRef.current.size > 0 &&
        !neighborhoodRef.current.has(brainNode.id);

      drawBrainNode(brainNode, ctx, globalScale, isSelected, isDimmed, animFrameRef.current);
    },
    [selectedNodeId, selectedNodeIds],
  );

  const nodeCanvasObjectMode = useCallback(() => 'replace' as const, []);

  const linkCanvasObject = useCallback(
    (link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const brainEdge = link as FGLink;

      const sourceNode = typeof brainEdge.source === 'object'
        ? brainEdge.source as FGNode
        : { x: 0, y: 0 };
      const targetNode = typeof brainEdge.target === 'object'
        ? brainEdge.target as FGNode
        : { x: 0, y: 0 };

      if (sourceNode.x == null || targetNode.x == null) return;

      // Dim edges where neither endpoint is in the selection neighborhood
      const srcId = typeof brainEdge.source === 'object'
        ? (brainEdge.source as FGNode).id
        : brainEdge.source;
      const tgtId = typeof brainEdge.target === 'object'
        ? (brainEdge.target as FGNode).id
        : brainEdge.target;

      const isDimmed =
        !!selectedNodeId &&
        neighborhoodRef.current.size > 0 &&
        !neighborhoodRef.current.has(srcId) &&
        !neighborhoodRef.current.has(tgtId);

      // Build a plain BrainEdge with string source/target for the renderer
      const edgeForRenderer: BrainEdge = {
        source: srcId,
        target: tgtId,
        type: brainEdge.type,
        strength: brainEdge.strength,
        isConflict: brainEdge.isConflict,
        createdAt: brainEdge.createdAt,
      };

      drawBrainEdge(
        edgeForRenderer,
        ctx,
        globalScale,
        sourceNode,
        targetNode,
        isDimmed,
        animFrameRef.current,
      );
    },
    [selectedNodeId],
  );

  const linkCanvasObjectMode = useCallback(() => 'replace' as const, []);

  /** Circular hit area covering the node's bounding box */
  const nodePointerAreaPaint = useCallback(
    (node: NodeObject, color: string, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      void _globalScale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, Math.PI * 2);
      ctx.fill();
    },
    [],
  );

  const handleNodeClick = useCallback(
    (node: NodeObject, _event: MouseEvent) => {
      void _event;
      onNodeClick?.(node as BrainNode);
    },
    [onNodeClick],
  );

  // ── Alt key listener (lasso mode toggle) ──────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltDown(false);
        setIsLassoing(false);
        lassoPathRef.current = [];
        // Clear lasso canvas
        const lc = lassoCanvasRef.current;
        if (lc) {
          const c = lc.getContext('2d');
          c?.clearRect(0, 0, lc.width, lc.height);
        }
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ── Lasso mouse handlers ───────────────────────────────────────────────────

  const handleLassoMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!isAltDown) return;
      setIsLassoing(true);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      lassoPathRef.current = [pt];
    },
    [isAltDown],
  );

  const handleLassoMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!isLassoing) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      lassoPathRef.current.push(pt);

      // Redraw lasso polygon on the overlay canvas
      const lc = lassoCanvasRef.current;
      if (!lc) return;
      lc.width = lc.offsetWidth;
      lc.height = lc.offsetHeight;
      const ctx = lc.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, lc.width, lc.height);
      ctx.beginPath();
      const path = lassoPathRef.current;
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(100, 180, 255, 0.08)';
      ctx.fill();
    },
    [isLassoing],
  );

  const handleLassoMouseUp = useCallback(() => {
    if (!isLassoing) return;
    setIsLassoing(false);

    const polygon = lassoPathRef.current;
    lassoPathRef.current = [];

    // Clear overlay canvas
    const lc = lassoCanvasRef.current;
    if (lc) {
      const c = lc.getContext('2d');
      c?.clearRect(0, 0, lc.width, lc.height);
    }

    if (polygon.length < 3 || !fgRef.current) {
      return;
    }

    // Hit-test all visible nodes in screen space
    const matchingIds: string[] = [];
    for (const node of data.nodes) {
      if (node.x == null || node.y == null) continue;
      const screenCoords = fgRef.current.graph2ScreenCoords(node.x, node.y);
      if (pointInPolygon(screenCoords.x, screenCoords.y, polygon)) {
        matchingIds.push(node.id);
      }
    }

    if (matchingIds.length > 0) {
      onLassoSelect?.(matchingIds);
    }
  }, [isLassoing, data.nodes, onLassoSelect, fgRef]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const w = width ?? containerSize.w;
  const h = height ?? containerSize.h;

  return (
    <div
      ref={containerRef}
      className="brain-visualization"
      style={{ width: '100%', height: '100%' }}
    >
      <ForceGraph2D
        ref={fgRef as MutableRefObject<ForceGraphMethods | undefined>}
        graphData={graphPayload}
        width={w}
        height={h}
        backgroundColor={BRAIN_BG_COLOR}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={nodeCanvasObjectMode}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={linkCanvasObjectMode}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onNodeClick={handleNodeClick}
        enableZoomInteraction={true}
        enablePanInteraction={!isLassoing}
        enableNodeDrag={false}
        warmupTicks={200}
        cooldownTicks={50}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.4}
      />

      {/* Lasso overlay */}
      <div
        className={`brain-lasso-overlay${isAltDown ? ' active' : ''}`}
        onMouseDown={handleLassoMouseDown}
        onMouseMove={handleLassoMouseMove}
        onMouseUp={handleLassoMouseUp}
      >
        <canvas ref={lassoCanvasRef} />
      </div>
    </div>
  );
}

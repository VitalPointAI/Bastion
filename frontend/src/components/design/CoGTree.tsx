/**
 * CoGTree
 *
 * Interactive pan/zoom tree diagram for one CoG analysis (friendly or adversary).
 * Top-down layout using Strange's CG-CC-CR-CV model.
 *
 * Controls:
 * - Click + drag: pan the canvas
 * - Mouse wheel: zoom in/out
 * - Click node: highlight ancestor + descendant path
 * - "Fit" button: auto-zoom to fit entire tree in view
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { CoGNode, CoGTree as CoGTreeType } from '../../lib/design-service.ts';
import { CoGNodeEditor } from './CoGNodeEditor.tsx';

// ─── Layout Constants ────────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const LEVEL_SPACING = 100;
const NODE_SPACING = 20;
const PADDING = 40;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;

// ─── Node Type Colors ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<CoGNode['type'], string> = {
  'cog': '#ef4444',
  'critical-capability': '#f59e0b',
  'critical-requirement': '#3b82f6',
  'critical-vulnerability': '#10b981',
};

const TYPE_ABBREV: Record<CoGNode['type'], string> = {
  'cog': 'CG',
  'critical-capability': 'CC',
  'critical-requirement': 'CR',
  'critical-vulnerability': 'CV',
};

const CHILD_TYPE: Record<string, CoGNode['type'] | null> = {
  'cog': 'critical-capability',
  'critical-capability': 'critical-requirement',
  'critical-requirement': 'critical-vulnerability',
  'critical-vulnerability': null,
};

// ─── Tree Mutation Helpers (pure) ────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function safeChildren(node: CoGNode): CoGNode[] {
  return Array.isArray(node.children) ? node.children : [];
}

function addChildNode(tree: CoGTreeType, parentId: string, childType: CoGNode['type']): CoGTreeType {
  if (!tree.root) return tree;

  function addToNode(node: CoGNode): CoGNode {
    if (node.id === parentId) {
      return {
        ...node,
        children: [
          ...safeChildren(node),
          {
            id: generateId(),
            type: childType,
            label: `New ${TYPE_ABBREV[childType]}`,
            description: '',
            children: [],
          },
        ],
      };
    }
    return { ...node, children: safeChildren(node).map(addToNode) };
  }

  return { root: addToNode(tree.root) };
}

function updateNode(tree: CoGTreeType, nodeId: string, updates: { label: string; description: string }): CoGTreeType {
  if (!tree.root) return tree;

  function update(node: CoGNode): CoGNode {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    return { ...node, children: safeChildren(node).map(update) };
  }

  return { root: update(tree.root) };
}

function deleteNode(tree: CoGTreeType, nodeId: string): CoGTreeType {
  if (!tree.root) return tree;
  if (tree.root.id === nodeId) return tree;

  function remove(node: CoGNode): CoGNode {
    return {
      ...node,
      children: safeChildren(node).filter((c) => c.id !== nodeId).map(remove),
    };
  }

  return { root: remove(tree.root) };
}

function findNode(root: CoGNode | null, nodeId: string): CoGNode | null {
  if (!root) return null;
  if (root.id === nodeId) return root;
  for (const child of safeChildren(root)) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function getDescendantIds(root: CoGNode | null, nodeId: string): Set<string> {
  const ids = new Set<string>();
  const node = root ? findNode(root, nodeId) : null;
  if (!node) return ids;
  function walk(n: CoGNode) {
    ids.add(n.id);
    for (const c of safeChildren(n)) walk(c);
  }
  walk(node);
  return ids;
}

function getAncestorIds(root: CoGNode | null, nodeId: string): Set<string> {
  const ids = new Set<string>();
  if (!root) return ids;
  function walk(n: CoGNode): boolean {
    if (n.id === nodeId) { ids.add(n.id); return true; }
    for (const c of safeChildren(n)) {
      if (walk(c)) { ids.add(n.id); return true; }
    }
    return false;
  }
  walk(root);
  return ids;
}

// ─── Layout Helpers ──────────────────────────────────────────────────────────

interface PositionedNode {
  node: CoGNode;
  x: number;
  y: number;
  level: number;
  parentId: string | null;
}

function flattenTree(root: CoGNode): PositionedNode[] {
  const result: PositionedNode[] = [];

  function walk(node: CoGNode, level: number, parentId: string | null) {
    result.push({ node, x: 0, y: 0, level, parentId });
    for (const child of safeChildren(node)) {
      walk(child, level + 1, node.id);
    }
  }

  walk(root, 0, null);
  return result;
}

function computePositions(root: CoGNode): Map<string, { x: number; y: number }> {
  const flat = flattenTree(root);
  const positions = new Map<string, { x: number; y: number }>();

  const levels: PositionedNode[][] = [];
  for (const item of flat) {
    if (!levels[item.level]) levels[item.level] = [];
    levels[item.level].push(item);
  }

  let maxLevelWidth = 0;
  for (const level of levels) {
    if (!level) continue;
    const w = level.length * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
    if (w > maxLevelWidth) maxLevelWidth = w;
  }

  const svgCenterX = Math.max(maxLevelWidth, NODE_WIDTH) / 2 + PADDING;

  for (const level of levels) {
    if (!level) continue;
    const levelWidth = level.length * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
    const startX = svgCenterX - levelWidth / 2;

    level.forEach((item, idx) => {
      positions.set(item.node.id, {
        x: startX + idx * (NODE_WIDTH + NODE_SPACING),
        y: item.level * LEVEL_SPACING + PADDING,
      });
    });
  }

  return positions;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CoGTreeProps {
  tree: CoGTreeType;
  side: 'friendly' | 'adversary';
  onTreeChange: (tree: CoGTreeType) => void;
  readOnly?: boolean;
}

export function CoGTree({ tree, side, onTreeChange, readOnly }: CoGTreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Pan/zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Compute layout
  const { positions, svgWidth, svgHeight, flatNodes } = useMemo(() => {
    if (!tree.root) {
      return { positions: new Map<string, { x: number; y: number }>(), svgWidth: 0, svgHeight: 0, flatNodes: [] as PositionedNode[] };
    }
    const pos = computePositions(tree.root);
    const flat = flattenTree(tree.root);

    let maxX = 0;
    let maxY = 0;
    for (const [, p] of pos) {
      if (p.x + NODE_WIDTH > maxX) maxX = p.x + NODE_WIDTH;
      if (p.y + NODE_HEIGHT > maxY) maxY = p.y + NODE_HEIGHT;
    }

    return {
      positions: pos,
      svgWidth: maxX + PADDING,
      svgHeight: maxY + PADDING + 40,
      flatNodes: flat,
    };
  }, [tree]);

  const selectedNode = selectedNodeId ? findNode(tree.root, selectedNodeId) : null;
  const selectedPos = selectedNodeId ? positions.get(selectedNodeId) : null;

  const highlightedIds = useMemo(() => {
    if (!selectedNodeId || !tree.root) return null;
    const ancestors = getAncestorIds(tree.root, selectedNodeId);
    const descendants = getDescendantIds(tree.root, selectedNodeId);
    return new Set([...ancestors, ...descendants]);
  }, [selectedNodeId, tree.root]);

  // Fit-to-view: calculate zoom and pan to fit the entire tree in the container
  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || svgWidth === 0 || svgHeight === 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scaleX = cw / svgWidth;
    const scaleY = ch / svgHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% to add margin

    const fitPanX = (cw - svgWidth * fitZoom) / 2;
    const fitPanY = (ch - svgHeight * fitZoom) / 2;

    setZoom(fitZoom);
    setPan({ x: fitPanX, y: fitPanY });
  }, [svgWidth, svgHeight]);

  // Auto-fit on first render and when tree changes
  useEffect(() => {
    fitToView();
  }, [fitToView]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on background click (not on nodes)
    if ((e.target as HTMLElement).closest('[data-cog-node]')) return;
    isPanning.current = true;
    setDragging(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.preventDefault();
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setDragging(false);
  }, []);

  // Zoom handler — zoom toward cursor position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));

    // Adjust pan to keep cursor position stable
    const scale = newZoom / zoom;
    setPan({
      x: cursorX - (cursorX - pan.x) * scale,
      y: cursorY - (cursorY - pan.y) * scale,
    });
    setZoom(newZoom);
  }, [zoom, pan]);

  // Handlers
  const handleAddRoot = () => {
    onTreeChange({
      root: {
        id: generateId(),
        type: 'cog',
        label: side === 'friendly' ? 'Friendly CoG' : 'Adversary CoG',
        description: '',
        children: [],
      },
    });
  };

  const handleAddChild = (parentId: string) => {
    const parent = findNode(tree.root, parentId);
    if (!parent) return;
    const childType = CHILD_TYPE[parent.type];
    if (!childType) return;
    onTreeChange(addChildNode(tree, parentId, childType));
  };

  const handleUpdateNode = (nodeId: string, updates: { label: string; description: string }) => {
    onTreeChange(updateNode(tree, nodeId, updates));
    setSelectedNodeId(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    onTreeChange(deleteNode(tree, nodeId));
    setSelectedNodeId(null);
  };

  // Empty state
  if (!tree.root) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
        <p className="text-sm">No Center of Gravity defined</p>
        {!readOnly && (
          <button
            onClick={handleAddRoot}
            className="flex items-center gap-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded border border-gray-600"
          >
            <span className="text-lg leading-none">+</span>
            <span>Add Center of Gravity</span>
          </button>
        )}
      </div>
    );
  }

  // Build edges
  const edges: Array<{ fromId: string; toId: string }> = [];
  for (const item of flatNodes) {
    if (item.parentId) {
      edges.push({ fromId: item.parentId, toId: item.node.id });
    }
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
  }

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-gray-800/80 rounded-lg border border-gray-700 px-1.5 py-1">
        <button
          onClick={() => { setZoom(z => Math.max(MIN_ZOOM, z * 0.8)); }}
          className="text-gray-400 hover:text-white px-1.5 py-0.5 text-sm font-mono"
          title="Zoom out"
        >
          −
        </button>
        <span className="text-[10px] text-gray-400 min-w-8 text-center">{zoomPercent}%</span>
        <button
          onClick={() => { setZoom(z => Math.min(MAX_ZOOM, z * 1.25)); }}
          className="text-gray-400 hover:text-white px-1.5 py-0.5 text-sm font-mono"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-4 bg-gray-600 mx-0.5" />
        <button
          onClick={fitToView}
          className="text-gray-400 hover:text-white px-1.5 py-0.5 text-[10px]"
          title="Fit tree to view"
        >
          Fit
        </button>
      </div>

      {/* Transformed canvas */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: svgWidth,
          height: svgHeight,
          position: 'absolute',
        }}
      >
        {/* SVG layer for edges */}
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id={`arrowhead-${side}`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>

          {edges.map(({ fromId, toId }) => {
            const fromPos = positions.get(fromId);
            const toPos = positions.get(toId);
            if (!fromPos || !toPos) return null;

            const x1 = fromPos.x + NODE_WIDTH / 2;
            const y1 = fromPos.y + NODE_HEIGHT;
            const x2 = toPos.x + NODE_WIDTH / 2;
            const y2 = toPos.y;
            const midY = (y1 + y2) / 2;

            const edgeHighlighted = highlightedIds ? highlightedIds.has(fromId) && highlightedIds.has(toId) : false;
            const edgeDimmed = highlightedIds ? !edgeHighlighted : false;

            return (
              <path
                key={`${fromId}-${toId}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                stroke={edgeHighlighted ? '#60a5fa' : '#4b5563'}
                strokeWidth={edgeHighlighted ? 3 : 2}
                fill="none"
                opacity={edgeDimmed ? 0.15 : 1}
                markerEnd={`url(#arrowhead-${side})`}
                style={{ transition: 'stroke 0.2s, opacity 0.2s, stroke-width 0.2s' }}
              />
            );
          })}
        </svg>

        {/* HTML node overlays */}
        {flatNodes.map(({ node: n }) => {
          const pos = positions.get(n.id);
          if (!pos) return null;

          const color = TYPE_COLORS[n.type];
          const isSelected = selectedNodeId === n.id;
          const isHovered = hoveredNodeId === n.id;
          const canAddChild = CHILD_TYPE[n.type] !== null;
          const nodeHighlighted = highlightedIds ? highlightedIds.has(n.id) : false;
          const nodeDimmed = highlightedIds ? !nodeHighlighted : false;

          return (
            <div key={n.id}>
              {/* Node */}
              <div
                data-cog-node
                className="absolute cursor-pointer select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  backgroundColor: nodeHighlighted ? '#1e3a5f' : '#1f2937',
                  border: `2px solid ${isSelected ? '#fff' : isHovered ? color : nodeHighlighted ? '#60a5fa' : '#374151'}`,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: color,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '4px 8px',
                  opacity: nodeDimmed ? 0.25 : 1,
                  transition: 'border-color 0.2s, opacity 0.2s, background-color 0.2s',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(isSelected ? null : n.id);
                }}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold px-1 py-px rounded shrink-0"
                    style={{ backgroundColor: color, color: '#fff' }}
                  >
                    {TYPE_ABBREV[n.type]}
                  </span>
                  <span className="text-xs text-gray-200 truncate font-medium">
                    {truncate(n.label, 18)}
                  </span>
                </div>
                {n.description && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {truncate(n.description, 30)}
                  </p>
                )}
              </div>

              {/* Add child button (shown on hover) */}
              {!readOnly && canAddChild && (isHovered || isSelected) && (
                <button
                  data-cog-node
                  className="absolute flex items-center justify-center w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-full text-gray-300 text-xs leading-none z-10"
                  style={{
                    left: pos.x + NODE_WIDTH / 2 - 10,
                    top: pos.y + NODE_HEIGHT + 2,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddChild(n.id);
                  }}
                  title="Add child node"
                >
                  +
                </button>
              )}
            </div>
          );
        })}

        {/* Node editor popover */}
        {selectedNode && selectedPos && !readOnly && (
          <CoGNodeEditor
            node={selectedNode}
            onSave={(updates) => handleUpdateNode(selectedNode.id, updates)}
            onClose={() => setSelectedNodeId(null)}
            onDelete={() => handleDeleteNode(selectedNode.id)}
            isRoot={selectedNode.type === 'cog'}
            style={{
              left: selectedPos.x + NODE_WIDTH + 12,
              top: selectedPos.y,
            }}
          />
        )}
      </div>
    </div>
  );
}

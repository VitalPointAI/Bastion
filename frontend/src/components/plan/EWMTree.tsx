/**
 * EWMTree
 *
 * Phase 33 Plan 08: Interactive hierarchical tree for E-W-M visualization.
 * 3-level vertical layout: Ends (top) -> Ways (middle) -> Means (bottom).
 * Adapts CoGTree's SVG+HTML hybrid approach for E-W-M domain.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import type { EWMLinkage, EWMGap } from '../../lib/ewm-service.ts';

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface EWMEnd {
  id: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EWMWay {
  id: string;
  name: string;
  type: 'loe' | 'coa';
}

export interface EWMMean {
  id: string;
  name: string;
  type: 'force' | 'capability' | 'resource';
  totalAllocationPct?: number;
}

// ─── Layout Constants ────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;
const LEVEL_SPACING = 140;
const NODE_SPACING = 24;
const PADDING = 40;

// ─── Color Scheme ────────────────────────────────────────────────────────────

const LEVEL_COLORS = {
  end: '#ef4444',
  way_loe: '#3b82f6',
  way_coa: '#6366f1',
  mean: '#10b981',
} as const;

const PRIORITY_COLORS: Record<EWMEnd['priority'], string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#6b7280',
};

// ─── Props ───────────────────────────────────────────────────────────────────

export interface EWMTreeProps {
  jppInstanceId: string;
  problemSetId: string;
  ends: EWMEnd[];
  ways: EWMWay[];
  means: EWMMean[];
  linkages: EWMLinkage[];
  gaps: EWMGap[];
  onCreateLinkage: (endId: string, wayId: string, wayType: string) => void;
  onDeleteLinkage: (linkageId: string) => void;
  onUpdateAllocation: (linkageId: string, pct: number) => void;
  readOnly?: boolean;
}

// ─── Node Types for Layout ──────────────────────────────────────────────────

interface TreeNode {
  id: string;
  label: string;
  level: 0 | 1 | 2; // 0=End, 1=Way, 2=Mean
  color: string;
  badge?: { text: string; color: string };
  allocationPct?: number;
  hasGap: boolean;
  gapDetails?: string;
}

interface PositionedNode extends TreeNode {
  x: number;
  y: number;
}

interface Edge {
  id: string;
  linkageId: string;
  fromId: string;
  toId: string;
  allocationPct: number;
  isDashed: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

function computeLayout(nodes: TreeNode[]): { positioned: PositionedNode[]; width: number; height: number } {
  const levels: TreeNode[][] = [[], [], []];
  for (const n of nodes) {
    levels[n.level].push(n);
  }

  // Compute max level width
  let maxLevelWidth = 0;
  for (const level of levels) {
    const w = level.length * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
    if (w > maxLevelWidth) maxLevelWidth = w;
  }

  const svgCenterX = Math.max(maxLevelWidth, NODE_WIDTH) / 2 + PADDING;
  const positioned: PositionedNode[] = [];

  for (let lvl = 0; lvl < 3; lvl++) {
    const level = levels[lvl];
    const levelWidth = level.length * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
    const startX = svgCenterX - levelWidth / 2;

    level.forEach((node, idx) => {
      positioned.push({
        ...node,
        x: startX + idx * (NODE_WIDTH + NODE_SPACING),
        y: lvl * LEVEL_SPACING + PADDING,
      });
    });
  }

  const width = Math.max(maxLevelWidth + PADDING * 2, 400);
  const height = 2 * LEVEL_SPACING + NODE_HEIGHT + PADDING * 2;

  return { positioned, width, height };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EWMTree({
  ends,
  ways,
  means,
  linkages,
  gaps,
  onCreateLinkage,
  onDeleteLinkage,
  onUpdateAllocation,
  readOnly,
}: EWMTreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<{ linkageId: string; value: string } | null>(null);
  const [dragState, setDragState] = useState<{ fromId: string; fromLevel: number; mouseX: number; mouseY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build gap lookup
  const gapMap = useMemo(() => {
    const m = new Map<string, EWMGap>();
    for (const g of gaps) {
      m.set(g.entityId, g);
    }
    return m;
  }, [gaps]);

  // Build tree nodes
  const treeNodes = useMemo<TreeNode[]>(() => {
    const nodes: TreeNode[] = [];

    for (const e of ends) {
      const gap = gapMap.get(e.id);
      nodes.push({
        id: e.id,
        label: e.description,
        level: 0,
        color: LEVEL_COLORS.end,
        badge: { text: e.priority, color: PRIORITY_COLORS[e.priority] },
        hasGap: !!gap,
        gapDetails: gap?.details,
      });
    }

    for (const w of ways) {
      const gap = gapMap.get(w.id);
      nodes.push({
        id: w.id,
        label: w.name,
        level: 1,
        color: w.type === 'loe' ? LEVEL_COLORS.way_loe : LEVEL_COLORS.way_coa,
        badge: { text: w.type.toUpperCase(), color: w.type === 'loe' ? LEVEL_COLORS.way_loe : LEVEL_COLORS.way_coa },
        hasGap: !!gap,
        gapDetails: gap?.details,
      });
    }

    for (const m of means) {
      const gap = gapMap.get(m.id);
      // Compute total allocation from linkages
      const totalAlloc = linkages
        .filter((l) => l.meanId === m.id)
        .reduce((sum, l) => sum + (l.allocationPct || 0), 0);
      nodes.push({
        id: m.id,
        label: m.name,
        level: 2,
        color: LEVEL_COLORS.mean,
        allocationPct: totalAlloc,
        hasGap: !!gap,
        gapDetails: gap?.details,
      });
    }

    return nodes;
  }, [ends, ways, means, linkages, gapMap]);

  // Build edges from linkages
  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    const nodeIds = new Set(treeNodes.map((n) => n.id));

    for (const l of linkages) {
      // End -> Way edge
      if (nodeIds.has(l.endObjectiveId) && nodeIds.has(l.wayId)) {
        result.push({
          id: `${l.id}-ew`,
          linkageId: l.id,
          fromId: l.endObjectiveId,
          toId: l.wayId,
          allocationPct: 100,
          isDashed: false,
        });
      }
      // Way -> Mean edge
      if (l.meanId && nodeIds.has(l.wayId) && nodeIds.has(l.meanId)) {
        result.push({
          id: `${l.id}-wm`,
          linkageId: l.id,
          fromId: l.wayId,
          toId: l.meanId,
          allocationPct: l.allocationPct || 0,
          isDashed: false,
        });
      }
    }

    return result;
  }, [linkages, treeNodes]);

  // Compute layout
  const { positioned, width, height } = useMemo(() => computeLayout(treeNodes), [treeNodes]);

  // Position lookup
  const posMap = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const p of positioned) {
      m.set(p.id, p);
    }
    return m;
  }, [positioned]);

  // ─── Drag to create linkage ───────────────────────────────────────────────

  const handleDragStart = useCallback(
    (nodeId: string, level: number, e: React.MouseEvent) => {
      if (readOnly) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragState({
        fromId: nodeId,
        fromLevel: level,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top,
      });
    },
    [readOnly],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragState((prev) =>
        prev ? { ...prev, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top } : null,
      );
    },
    [dragState],
  );

  const handleDragEnd = useCallback(
    (targetId: string, targetLevel: number) => {
      if (!dragState) return;
      // Only allow End->Way connections via drag
      if (dragState.fromLevel === 0 && targetLevel === 1) {
        const wayNode = ways.find((w) => w.id === targetId);
        if (wayNode) {
          onCreateLinkage(dragState.fromId, targetId, wayNode.type);
        }
      } else if (dragState.fromLevel === 1 && targetLevel === 0) {
        const wayNode = ways.find((w) => w.id === dragState.fromId);
        if (wayNode) {
          onCreateLinkage(targetId, dragState.fromId, wayNode.type);
        }
      }
      setDragState(null);
    },
    [dragState, ways, onCreateLinkage],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // ─── Allocation editing ───────────────────────────────────────────────────

  const handleAllocationSubmit = useCallback(() => {
    if (!editingAllocation) return;
    const pct = parseInt(editingAllocation.value, 10);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      onUpdateAllocation(editingAllocation.linkageId, pct);
    }
    setEditingAllocation(null);
  }, [editingAllocation, onUpdateAllocation]);

  // ─── Edge deletion ────────────────────────────────────────────────────────

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, linkageId: string) => {
      if (readOnly) return;
      e.preventDefault();
      onDeleteLinkage(linkageId);
    },
    [readOnly, onDeleteLinkage],
  );

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (ends.length === 0 && ways.length === 0 && means.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <p className="text-sm">No E-W-M entities defined yet</p>
        <p className="text-xs">Define strategic objectives, LOEs/COAs, and forces to visualize linkages</p>
      </div>
    );
  }

  // ─── Build drag line ──────────────────────────────────────────────────────

  const dragLine = dragState
    ? (() => {
        const fromNode = posMap.get(dragState.fromId);
        if (!fromNode) return null;
        const x1 = fromNode.x + NODE_WIDTH / 2;
        const y1 = fromNode.y + NODE_HEIGHT / 2;
        return { x1, y1, x2: dragState.mouseX, y2: dragState.mouseY };
      })()
    : null;

  // ─── Level labels ─────────────────────────────────────────────────────────

  const levelLabels = [
    { label: 'ENDS (Strategic Objectives)', y: PADDING - 18, color: LEVEL_COLORS.end },
    { label: 'WAYS (LOEs / COAs)', y: LEVEL_SPACING + PADDING - 18, color: LEVEL_COLORS.way_loe },
    { label: 'MEANS (Forces / Resources)', y: 2 * LEVEL_SPACING + PADDING - 18, color: LEVEL_COLORS.mean },
  ];

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ overflowX: 'auto' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="relative" style={{ width, height: height + 20, minWidth: '100%' }}>
        {/* SVG layer for edges and drag line */}
        <svg
          width={width}
          height={height + 20}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <marker id="ewm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>

          {/* Level labels */}
          {levelLabels.map((ll) => (
            <text key={ll.label} x={12} y={ll.y} fill={ll.color} fontSize={11} fontWeight={600} opacity={0.7}>
              {ll.label}
            </text>
          ))}

          {/* Edges */}
          {edges.map((edge) => {
            const fromPos = posMap.get(edge.fromId);
            const toPos = posMap.get(edge.toId);
            if (!fromPos || !toPos) return null;

            const x1 = fromPos.x + NODE_WIDTH / 2;
            const y1 = fromPos.y + NODE_HEIGHT;
            const x2 = toPos.x + NODE_WIDTH / 2;
            const y2 = toPos.y;
            const midY = (y1 + y2) / 2;

            // Wider stroke for higher allocation
            const strokeWidth = edge.allocationPct > 0 ? Math.max(1.5, (edge.allocationPct / 100) * 5) : 2;
            const isHovered = hoveredEdgeId === edge.id;

            return (
              <g key={edge.id}>
                {/* Invisible wider path for click target */}
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  style={{ pointerEvents: 'stroke', cursor: readOnly ? 'default' : 'pointer' }}
                  onContextMenu={(e) => handleEdgeContextMenu(e, edge.linkageId)}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                />
                {/* Visible edge */}
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke={isHovered ? '#f59e0b' : '#4b5563'}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.isDashed ? '6 4' : undefined}
                  fill="none"
                  markerEnd="url(#ewm-arrow)"
                  style={{ pointerEvents: 'none', transition: 'stroke 0.15s' }}
                />
                {/* Allocation label on Way->Mean edges */}
                {edge.allocationPct > 0 && toPos.level === 2 && (
                  <g
                    style={{ pointerEvents: 'all', cursor: readOnly ? 'default' : 'pointer' }}
                    onClick={() => {
                      if (!readOnly) {
                        setEditingAllocation({ linkageId: edge.linkageId, value: String(edge.allocationPct) });
                      }
                    }}
                  >
                    <rect
                      x={(x1 + x2) / 2 - 16}
                      y={midY - 8}
                      width={32}
                      height={16}
                      rx={4}
                      fill={isHovered ? '#f59e0b' : '#374151'}
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={midY + 4}
                      textAnchor="middle"
                      fill="#e5e7eb"
                      fontSize={10}
                      fontWeight={500}
                    >
                      {edge.allocationPct}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Drag line */}
          {dragLine && (
            <line
              x1={dragLine.x1}
              y1={dragLine.y1}
              x2={dragLine.x2}
              y2={dragLine.y2}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
        </svg>

        {/* HTML node overlays */}
        {positioned.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const isDragTarget = dragState && dragState.fromId !== node.id && Math.abs(node.level - dragState.fromLevel) === 1;

          return (
            <div
              key={node.id}
              className="absolute select-none"
              style={{
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                backgroundColor: '#1f2937',
                border: `2px solid ${isSelected ? '#fff' : isHovered ? node.color : isDragTarget ? '#f59e0b' : '#374151'}`,
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: node.color,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4px 8px',
                cursor: readOnly ? 'default' : 'grab',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: node.hasGap
                  ? '0 0 8px 2px rgba(245, 158, 11, 0.5)'
                  : isSelected
                    ? '0 0 6px 1px rgba(255,255,255,0.2)'
                    : 'none',
                animation: node.hasGap ? 'ewm-gap-pulse 2s ease-in-out infinite' : undefined,
              }}
              onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onMouseDown={(e) => handleDragStart(node.id, node.level, e)}
              onMouseUp={() => isDragTarget && handleDragEnd(node.id, node.level)}
            >
              {/* Top row: badge + label */}
              <div className="flex items-center gap-1.5">
                {node.badge && (
                  <span
                    className="text-[9px] font-bold px-1 py-px rounded shrink-0"
                    style={{ backgroundColor: node.badge.color, color: '#fff' }}
                  >
                    {node.badge.text}
                  </span>
                )}
                <span className="text-xs text-gray-200 truncate font-medium">
                  {truncate(node.label, 40)}
                </span>
              </div>

              {/* Allocation bar for means */}
              {node.level === 2 && node.allocationPct !== undefined && (
                <div className="mt-1">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(node.allocationPct, 100)}%`,
                          backgroundColor:
                            node.allocationPct > 100 ? '#ef4444' : node.allocationPct > 80 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400 w-7 text-right">{node.allocationPct}%</span>
                  </div>
                </div>
              )}

              {/* Gap indicator tooltip */}
              {node.hasGap && node.gapDetails && isHovered && (
                <div
                  className="absolute z-20 p-2 bg-amber-900/90 border border-amber-600 rounded text-xs text-amber-200 max-w-[200px] whitespace-normal"
                  style={{ top: NODE_HEIGHT + 4, left: 0 }}
                >
                  {node.gapDetails}
                </div>
              )}
            </div>
          );
        })}

        {/* Allocation editing popover */}
        {editingAllocation && (
          <div
            className="absolute z-30 p-2 bg-gray-800 border border-gray-600 rounded shadow-lg"
            style={{ top: LEVEL_SPACING + PADDING + NODE_HEIGHT + 10, left: width / 2 - 80 }}
          >
            <label className="text-xs text-gray-300 block mb-1">Allocation %</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={editingAllocation.value}
                onChange={(e) => setEditingAllocation({ ...editingAllocation, value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAllocationSubmit()}
                className="w-16 px-1.5 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200"
                autoFocus
              />
              <button
                onClick={handleAllocationSubmit}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
              >
                Set
              </button>
              <button
                onClick={() => setEditingAllocation(null)}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSS animation for gap pulse */}
      <style>{`
        @keyframes ewm-gap-pulse {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 14px 4px rgba(245, 158, 11, 0.6); }
        }
      `}</style>
    </div>
  );
}

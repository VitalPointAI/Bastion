/**
 * CoGTree
 *
 * Phase 25 Plan 03: Interactive SVG tree diagram for one CoG analysis
 * (friendly or adversary). Top-down layout using Strange's CG-CC-CR-CV model.
 * Follows EffectChainDiagram pattern: manual position calculation, SVG paths
 * for edges, HTML overlays for interactive nodes.
 */

import { useState, useMemo } from 'react';
import type { CoGNode, CoGTree as CoGTreeType } from '../../lib/design-service.ts';
import { CoGNodeEditor } from './CoGNodeEditor.tsx';

// ─── Layout Constants ────────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const LEVEL_SPACING = 100;
const NODE_SPACING = 20;
const PADDING = 40;

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

function addChildNode(tree: CoGTreeType, parentId: string, childType: CoGNode['type']): CoGTreeType {
  if (!tree.root) return tree;

  function addToNode(node: CoGNode): CoGNode {
    if (node.id === parentId) {
      return {
        ...node,
        children: [
          ...node.children,
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
    return { ...node, children: node.children.map(addToNode) };
  }

  return { root: addToNode(tree.root) };
}

function updateNode(tree: CoGTreeType, nodeId: string, updates: { label: string; description: string }): CoGTreeType {
  if (!tree.root) return tree;

  function update(node: CoGNode): CoGNode {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    return { ...node, children: node.children.map(update) };
  }

  return { root: update(tree.root) };
}

function deleteNode(tree: CoGTreeType, nodeId: string): CoGTreeType {
  if (!tree.root) return tree;
  if (tree.root.id === nodeId) return tree; // Cannot delete root

  function remove(node: CoGNode): CoGNode {
    return {
      ...node,
      children: node.children.filter((c) => c.id !== nodeId).map(remove),
    };
  }

  return { root: remove(tree.root) };
}

function findNode(root: CoGNode | null, nodeId: string): CoGNode | null {
  if (!root) return null;
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
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
    for (const child of node.children) {
      walk(child, level + 1, node.id);
    }
  }

  walk(root, 0, null);
  return result;
}

function computePositions(root: CoGNode): Map<string, { x: number; y: number }> {
  const flat = flattenTree(root);
  const positions = new Map<string, { x: number; y: number }>();

  // Group by level
  const levels: PositionedNode[][] = [];
  for (const item of flat) {
    if (!levels[item.level]) levels[item.level] = [];
    levels[item.level].push(item);
  }

  // Find max level width for centering
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
      svgHeight: maxY + PADDING + 40, // extra space for add buttons
      flatNodes: flat,
    };
  }, [tree]);

  const selectedNode = selectedNodeId ? findNode(tree.root, selectedNodeId) : null;
  const selectedPos = selectedNodeId ? positions.get(selectedNodeId) : null;

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

  return (
    <div className="relative" style={{ overflowX: 'auto' }}>
      <div className="relative" style={{ width: svgWidth, height: svgHeight, minWidth: '100%' }}>
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

            return (
              <path
                key={`${fromId}-${toId}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                stroke="#4b5563"
                strokeWidth={2}
                fill="none"
                markerEnd={`url(#arrowhead-${side})`}
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

          return (
            <div key={n.id}>
              {/* Node */}
              <div
                className="absolute cursor-pointer select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  backgroundColor: '#1f2937',
                  border: `2px solid ${isSelected ? '#fff' : isHovered ? color : '#374151'}`,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: color,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '4px 8px',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => setSelectedNodeId(isSelected ? null : n.id)}
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

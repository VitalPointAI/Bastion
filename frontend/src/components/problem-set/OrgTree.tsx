/**
 * OrgTree
 *
 * Interactive org tree visualization using react-d3-tree.
 * Renders the full problem set hierarchy from root, highlighting
 * the current user's problem set and showing member counts with
 * type/classification badges on each node.
 *
 * Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import Tree from 'react-d3-tree';
import type { RawNodeDatum, CustomNodeElementProps } from 'react-d3-tree';
import { problemSetService, type HierarchyNode } from '../../lib/problem-set-service';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrgTreeNode extends RawNodeDatum {
  name: string;
  attributes?: Record<string, string>;
  children?: OrgTreeNode[];
  /** Original problem set ID stored alongside react-d3-tree structure */
  _problemSetId?: string;
  _echelon?: string;
  _parentId?: string;
}


// ─── Props ─────────────────────────────────────────────────────────────────────

interface OrgTreeProps {
  rootProblemSetId: string;
  /** Problem Set ID to highlight as the current user's problem set */
  currentUserProblemSetId?: string;
  /** Called when user clicks a node to navigate to that problem set */
  onNavigate?: (problemSetId: string) => void;
}

// ─── Echelon symbols (doctrinal military unit size indicators) ───────────────

const ECHELON_SYMBOLS: Record<string, string> = {
  strategic: 'XX',    // Division-level indicator
  operational: 'III', // Regiment-level indicator
  tactical: 'II',     // Battalion-level indicator
};

const HIGHLIGHT_COLOR = '#d97706'; // amber-600 — current user's problem set border

// ─── Transform helpers ───────────────────────────────────────────────────────────

/**
 * Build a tree from a flat array of HierarchyNode records.
 * The API returns a flat list ordered by depth; each node has a
 * parentProblemSetId linking it to its parent.  We index by id,
 * attach children, then return the root.
 */
function transformHierarchy(nodes: HierarchyNode[]): OrgTreeNode | null {
  if (!nodes || nodes.length === 0) return null;

  // Build OrgTreeNode for each flat record (no children yet)
  const nodeMap = new Map<string, OrgTreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, {
      name: node.name,
      _problemSetId: node.id,
      _echelon: node.echelon,
      _parentId: node.parentProblemSetId ?? undefined,
      attributes: {
        type: node.echelon,
        members: String(node.memberCount),
      },
      children: [],
    });
  }

  // Wire children to parents
  let root: OrgTreeNode | null = null;
  for (const treeNode of nodeMap.values()) {
    if (treeNode._parentId && nodeMap.has(treeNode._parentId)) {
      nodeMap.get(treeNode._parentId)!.children!.push(treeNode);
    } else if (!root) {
      root = treeNode; // first node without a parent in this set is root
    }
  }

  return root ?? nodeMap.values().next().value ?? null;
}

// ─── Custom Node Element ────────────────────────────────────────────────────────

/**
 * Renders a custom SVG node for the org tree.
 * Shows: problem set name, type badge, member count, classification.
 * Highlights the current user's problem set with amber border.
 */
function buildCustomNode(
  currentUserProblemSetId: string | undefined,
  onNavigate?: (problemSetId: string) => void,
) {
  return function CustomNode({ nodeDatum, toggleNode }: CustomNodeElementProps) {
    const nd = nodeDatum as OrgTreeNode;
    const isCurrentUser = nd._problemSetId === currentUserProblemSetId;

    const nodeWidth = 200;
    const nodeHeight = 80;
    const rx = 8; // border radius

    const bgColor = isCurrentUser ? '#1c1917' : '#111827'; // stone-900 vs gray-900
    const borderColor = isCurrentUser ? HIGHLIGHT_COLOR : '#374151'; // amber or gray-700
    const borderWidth = isCurrentUser ? 2 : 1;

    function handleClick() {
      if (nd._problemSetId && onNavigate) {
        onNavigate(nd._problemSetId);
      } else {
        toggleNode();
      }
    }

    return (
      <g
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
        role="button"
        aria-label={`Problem Set: ${nd.name}`}
      >
        {/* Echelon symbol above node */}
        <text
          x={0}
          y={-nodeHeight / 2 - 8}
          textAnchor="middle"
          className="org-tree-node-meta"
          style={{ fontSize: '13px', fontWeight: 700, fill: '#d1d5db', fontFamily: 'monospace' }}
        >
          {ECHELON_SYMBOLS[nd._echelon ?? ''] ?? ''}
        </text>

        {/* Node background */}
        <rect
          x={-nodeWidth / 2}
          y={-nodeHeight / 2}
          width={nodeWidth}
          height={nodeHeight}
          rx={rx}
          ry={rx}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />

        {/* Problem Set name */}
        <text
          x={0}
          y={-nodeHeight / 2 + 20}
          textAnchor="middle"
          className="org-tree-node-title"
          style={{
            fontSize: '14px',
            fontWeight: 700,
            fill: isCurrentUser ? '#fbbf24' : '#e5e7eb',
            dominantBaseline: 'middle',
            paintOrder: 'stroke',
            stroke: '#000',
            strokeWidth: '3px',
            strokeLinejoin: 'round',
          }}
        >
          {nd.name.length > 18 ? `${nd.name.slice(0, 16)}...` : nd.name}
        </text>

        {/* Member count */}
        <text
          x={0}
          y={-nodeHeight / 2 + 40}
          textAnchor="middle"
          className="org-tree-node-meta"
          style={{
            fontSize: '12px',
            fill: '#93c5fd',
            dominantBaseline: 'middle',
            paintOrder: 'stroke',
            stroke: '#000',
            strokeWidth: '2px',
            strokeLinejoin: 'round',
          }}
        >
          {nd.attributes?.members ?? '0'} members
        </text>

        {/* "YOU" indicator for current user's problem set */}
        {isCurrentUser && (
          <>
            <rect
              x={-nodeWidth / 2 + 8}
              y={-nodeHeight / 2 + 50}
              width={30}
              height={14}
              rx={3}
              fill={HIGHLIGHT_COLOR}
            />
            <text
              x={-nodeWidth / 2 + 23}
              y={-nodeHeight / 2 + 57}
              textAnchor="middle"
              style={{
                fontSize: '9px',
                fontWeight: 700,
                fill: '#fff',
                dominantBaseline: 'middle',
              }}
            >
              YOU
            </text>
          </>
        )}

        {/* Children indicator dot */}
        {(nodeDatum.children?.length ?? 0) > 0 && (
          <circle
            cx={nodeWidth / 2 - 10}
            cy={nodeHeight / 2 - 8}
            r={4}
            fill="#6b7280"
          />
        )}
      </g>
    );
  };
}

// ─── OrgTree Component ──────────────────────────────────────────────────────────

export function OrgTree({ rootProblemSetId, currentUserProblemSetId, onNavigate }: OrgTreeProps) {
  const { userDID } = useUser();
  const { setActiveProblemSet } = useProblemSet();

  const [treeData, setTreeData] = useState<OrgTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translate, setTranslate] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Center tree using ResizeObserver so translate updates when container is laid out.
  // Re-run when treeData changes because the container isn't mounted during loading.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) {
          setTranslate({ x: width / 2, y: Math.max(60, height * 0.15) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [treeData]);

  useEffect(() => {
    if (!rootProblemSetId || !userDID) return;
    let cancelled = false;

    const fetchHierarchy = async () => {
      setLoading(true);
      setError(null);
      try {
        const nodes = await problemSetService.getHierarchy(rootProblemSetId, userDID);
        if (cancelled) return;
        const transformed = transformHierarchy(nodes);
        setTreeData(transformed);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchHierarchy();
    return () => { cancelled = true; };
  }, [rootProblemSetId, userDID]);

  const handleNavigate = useCallback(
    (problemSetId: string) => {
      setActiveProblemSet(problemSetId);
      onNavigate?.(problemSetId);
    },
    [setActiveProblemSet, onNavigate],
  );

  const customNode = buildCustomNode(currentUserProblemSetId, handleNavigate);

  // ─── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4 animate-pulse">
        <div className="h-16 w-40 bg-gray-800 rounded-lg mx-auto" />
        <div className="flex justify-center gap-8">
          <div className="h-16 w-36 bg-gray-800 rounded-lg" />
          <div className="h-16 w-36 bg-gray-800 rounded-lg" />
        </div>
        <div className="flex justify-center gap-4">
          <div className="h-16 w-32 bg-gray-800 rounded-lg" />
          <div className="h-16 w-32 bg-gray-800 rounded-lg" />
          <div className="h-16 w-32 bg-gray-800 rounded-lg" />
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-red-400 text-sm">
        Failed to load problem set hierarchy: {error}
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No problem set hierarchy to display.
      </div>
    );
  }

  // ─── Tree render ──────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{ height: 400, width: '100%' }}
      className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden"
    >
      {translate && (
      <Tree
        data={treeData}
        orientation="vertical"
        pathFunc="step"
        collapsible={true}
        translate={translate}
        nodeSize={{ x: 240, y: 130 }}
        separation={{ siblings: 1.2, nonSiblings: 1.5 }}
        renderCustomNodeElement={customNode}
        zoom={1}
        scaleExtent={{ min: 0.3, max: 2 }}
        pathClassFunc={() => 'stroke-gray-600 stroke-1 fill-none'}
      />
      )}
    </div>
  );
}

export default OrgTree;

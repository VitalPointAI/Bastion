/**
 * OrgTree
 *
 * Interactive org tree visualization using react-d3-tree.
 * Renders the full workspace hierarchy from root, highlighting
 * the current user's workspace and showing member counts with
 * type/classification badges on each node.
 *
 * Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import Tree from 'react-d3-tree';
import type { RawNodeDatum, CustomNodeElementProps } from 'react-d3-tree';
import { workspaceService, type HierarchyNode } from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrgTreeNode extends RawNodeDatum {
  name: string;
  attributes?: Record<string, string>;
  children?: OrgTreeNode[];
  /** Original workspace ID stored alongside react-d3-tree structure */
  _workspaceId?: string;
  _workspaceType?: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface OrgTreeProps {
  rootWorkspaceId: string;
  /** Workspace ID to highlight as the current user's workspace */
  currentUserWorkspaceId?: string;
  /** Called when user clicks a node to navigate to that workspace */
  onNavigate?: (workspaceId: string) => void;
}

// ─── Color map for workspace type badges ────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Organization: { bg: '#1e40af', text: '#dbeafe' },  // blue-800 / blue-100
  Unit:          { bg: '#7c3aed', text: '#ede9fe' },  // violet-700 / violet-100
  Team:          { bg: '#065f46', text: '#d1fae5' },  // emerald-800 / emerald-100
};

const HIGHLIGHT_COLOR = '#d97706'; // amber-600 — current user's workspace border

// ─── Transform helpers ───────────────────────────────────────────────────────────

/**
 * Recursively convert HierarchyNode[] into react-d3-tree RawNodeDatum.
 * The first element is treated as the root node.
 */
function transformHierarchy(nodes: HierarchyNode[]): OrgTreeNode | null {
  if (!nodes || nodes.length === 0) return null;

  function mapNode(node: HierarchyNode): OrgTreeNode {
    return {
      name: node.name,
      _workspaceId: node.id,
      _workspaceType: node.workspaceType,
      attributes: {
        type: node.workspaceType,
        members: String(node.memberCount),
      },
      children: node.children?.map(mapNode) ?? [],
    };
  }

  // The API returns a flat array where first element is root; treat it as the root
  return mapNode(nodes[0]);
}

// ─── Custom Node Element ────────────────────────────────────────────────────────

/**
 * Renders a custom SVG node for the org tree.
 * Shows: workspace name, type badge, member count, classification.
 * Highlights the current user's workspace with amber border.
 */
function buildCustomNode(
  currentUserWorkspaceId: string | undefined,
  onNavigate?: (workspaceId: string) => void,
) {
  return function CustomNode({ nodeDatum, toggleNode }: CustomNodeElementProps) {
    const nd = nodeDatum as OrgTreeNode;
    const isCurrentUser = nd._workspaceId === currentUserWorkspaceId;
    const typeColors = TYPE_COLORS[nd._workspaceType ?? ''] ?? { bg: '#374151', text: '#f3f4f6' };

    const nodeWidth = 160;
    const nodeHeight = 80;
    const rx = 8; // border radius

    const bgColor = isCurrentUser ? '#1c1917' : '#111827'; // stone-900 vs gray-900
    const borderColor = isCurrentUser ? HIGHLIGHT_COLOR : '#374151'; // amber or gray-700
    const borderWidth = isCurrentUser ? 2 : 1;

    function handleClick() {
      if (nd._workspaceId && onNavigate) {
        onNavigate(nd._workspaceId);
      } else {
        toggleNode();
      }
    }

    return (
      <g
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
        role="button"
        aria-label={`Workspace: ${nd.name}`}
      >
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

        {/* Workspace name */}
        <text
          x={0}
          y={-nodeHeight / 2 + 18}
          textAnchor="middle"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            fill: isCurrentUser ? '#fef3c7' : '#f9fafb',
            dominantBaseline: 'middle',
          }}
        >
          {nd.name.length > 18 ? `${nd.name.slice(0, 16)}…` : nd.name}
        </text>

        {/* Type badge */}
        <rect
          x={-nodeWidth / 2 + 8}
          y={-nodeHeight / 2 + 30}
          width={nd._workspaceType ? nd._workspaceType.length * 7 + 8 : 50}
          height={16}
          rx={4}
          fill={typeColors.bg}
        />
        <text
          x={-nodeWidth / 2 + 12}
          y={-nodeHeight / 2 + 38}
          style={{
            fontSize: '9px',
            fill: typeColors.text,
            dominantBaseline: 'middle',
          }}
        >
          {nd._workspaceType ?? ''}
        </text>

        {/* Member count */}
        <text
          x={nodeWidth / 2 - 8}
          y={-nodeHeight / 2 + 38}
          textAnchor="end"
          style={{
            fontSize: '10px',
            fill: '#9ca3af',
            dominantBaseline: 'middle',
          }}
        >
          {nd.attributes?.members ?? '0'} mbr
        </text>

        {/* "YOU" indicator for current user's workspace */}
        {isCurrentUser && (
          <>
            <rect
              x={-nodeWidth / 2 + 8}
              y={-nodeHeight / 2 + 52}
              width={30}
              height={14}
              rx={3}
              fill={HIGHLIGHT_COLOR}
            />
            <text
              x={-nodeWidth / 2 + 23}
              y={-nodeHeight / 2 + 59}
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

export function OrgTree({ rootWorkspaceId, currentUserWorkspaceId, onNavigate }: OrgTreeProps) {
  const { userDID } = useUser();
  const { setActiveWorkspace } = useWorkspace();

  const [treeData, setTreeData] = useState<OrgTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Center tree on mount
  const updateTranslate = useCallback(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTranslate({ x: width / 2, y: 40 });
    }
  }, []);

  useEffect(() => {
    updateTranslate();
  }, [updateTranslate]);

  useEffect(() => {
    if (!rootWorkspaceId || !userDID) return;
    setLoading(true);
    setError(null);

    workspaceService
      .getHierarchy(rootWorkspaceId, userDID)
      .then((nodes) => {
        const transformed = transformHierarchy(nodes);
        setTreeData(transformed);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [rootWorkspaceId, userDID]);

  const handleNavigate = useCallback(
    (workspaceId: string) => {
      setActiveWorkspace(workspaceId);
      onNavigate?.(workspaceId);
    },
    [setActiveWorkspace, onNavigate],
  );

  const customNode = buildCustomNode(currentUserWorkspaceId, handleNavigate);

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
        Failed to load workspace hierarchy: {error}
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No workspace hierarchy to display.
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
      <Tree
        data={treeData}
        orientation="vertical"
        pathFunc="step"
        collapsible={true}
        translate={translate}
        nodeSize={{ x: 200, y: 120 }}
        separation={{ siblings: 1, nonSiblings: 1.5 }}
        renderCustomNodeElement={customNode}
        zoom={0.8}
        scaleExtent={{ min: 0.3, max: 2 }}
        pathClassFunc={() => 'stroke-gray-600 stroke-1 fill-none'}
      />
    </div>
  );
}

export default OrgTree;

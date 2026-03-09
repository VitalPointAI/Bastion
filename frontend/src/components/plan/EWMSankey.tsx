/**
 * EWMSankey
 *
 * Phase 33 Plan 08: Read-only Sankey flow diagram for E-W-M analytical view.
 * Shows resource flow from Ends (objectives) through Ways (LOEs/COAs) to Means (forces).
 * Uses recharts Sankey component with custom node and link rendering.
 */

import { useMemo, useState, useCallback } from 'react';
import { Sankey, Tooltip } from 'recharts';
import type { NodeProps, LinkProps } from 'recharts/types/chart/Sankey';
import type { EWMLinkage } from '../../lib/ewm-service.ts';
import type { EWMEnd, EWMWay, EWMMean } from './EWMTree.tsx';

// ─── Color Scheme ────────────────────────────────────────────────────────────

const LEVEL_COLORS = ['#ef4444', '#3b82f6', '#10b981'] as const; // ends, ways, means

// ─── Props ───────────────────────────────────────────────────────────────────

export interface EWMSankeyProps {
  ends: EWMEnd[];
  ways: EWMWay[];
  means: EWMMean[];
  linkages: EWMLinkage[];
}

// ─── Custom Node Component ──────────────────────────────────────────────────

function CustomSankeyNode(props: NodeProps) {
  const { x, y, width, height, payload } = props;
  // Determine color from the node's depth (0=ends, 1=ways, 2=means)
  const depth = (payload as unknown as Record<string, unknown>).depth as number;
  const color = LEVEL_COLORS[depth] ?? '#6b7280';
  const name = (payload as unknown as Record<string, unknown>).name as string;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={2} opacity={0.9} />
      <text
        x={x + width + 6}
        y={y + height / 2}
        dy={4}
        fill="#d1d5db"
        fontSize={11}
        fontWeight={500}
        textAnchor="start"
      >
        {name && name.length > 28 ? name.slice(0, 27) + '\u2026' : name}
      </text>
    </g>
  );
}

// ─── Custom Link Component ──────────────────────────────────────────────────

function CustomSankeyLink(props: LinkProps) {
  const {
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    index,
  } = props;

  const [isHovered, setIsHovered] = useState(false);

  const gradientId = `ewm-link-gradient-${index}`;
  // Source and target depths for color
  const sourceDepth = ((props.payload?.source as unknown as Record<string, unknown>)?.depth as number | undefined) ?? 0;
  const targetDepth = ((props.payload?.target as unknown as Record<string, unknown>)?.depth as number | undefined) ?? 1;
  const sourceColor = LEVEL_COLORS[sourceDepth] ?? '#6b7280';
  const targetColor = LEVEL_COLORS[targetDepth] ?? '#6b7280';

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={isHovered ? 0.7 : 0.3} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={isHovered ? 0.7 : 0.3} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
          L${targetX},${targetY + linkWidth}
          C${targetControlX},${targetY + linkWidth} ${sourceControlX},${sourceY + linkWidth} ${sourceX},${sourceY + linkWidth}
          Z
        `}
        fill={`url(#${gradientId})`}
        stroke="none"
        style={{ transition: 'opacity 0.15s', cursor: 'pointer' }}
      />
    </g>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: {
    name?: string;
    value?: number;
    source?: { name?: string };
    target?: { name?: string };
  };
}

function EWMTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  // Node tooltip
  if (data.name && !data.source) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 shadow-lg text-xs text-gray-200">
        <div className="font-medium">{data.name}</div>
      </div>
    );
  }

  // Link tooltip
  if (data.source && data.target) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 shadow-lg text-xs text-gray-200">
        <div className="font-medium">
          {data.source.name} &rarr; {data.target.name}
        </div>
        {data.value !== undefined && (
          <div className="text-gray-400 mt-0.5">Allocation: {data.value}%</div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EWMSankey({ ends, ways, means, linkages }: EWMSankeyProps) {
  const [, setHoveredIndex] = useState<number | null>(null);

  const sankeyData = useMemo(() => {
    // Build nodes: ends first, then ways, then means (order matters for indices)
    const nodes: Array<{ name: string }> = [];
    const endOffset = 0;
    const wayOffset = ends.length;
    const meanOffset = ends.length + ways.length;

    for (const e of ends) {
      nodes.push({ name: e.description });
    }
    for (const w of ways) {
      nodes.push({ name: w.name });
    }
    for (const m of means) {
      nodes.push({ name: m.name });
    }

    // Build links using NUMERIC INDICES
    const links: Array<{ source: number; target: number; value: number }> = [];
    const endIdxMap = new Map<string, number>();
    const wayIdxMap = new Map<string, number>();
    const meanIdxMap = new Map<string, number>();

    ends.forEach((e, i) => endIdxMap.set(e.id, endOffset + i));
    ways.forEach((w, i) => wayIdxMap.set(w.id, wayOffset + i));
    means.forEach((m, i) => meanIdxMap.set(m.id, meanOffset + i));

    // Track unique End->Way pairs to avoid duplicate links
    const endWayPairs = new Set<string>();

    for (const l of linkages) {
      const endIdx = endIdxMap.get(l.endObjectiveId);
      const wayIdx = wayIdxMap.get(l.wayId);

      // End -> Way link (deduplicate since multiple linkages can share same end->way)
      if (endIdx !== undefined && wayIdx !== undefined) {
        const pairKey = `${endIdx}-${wayIdx}`;
        if (!endWayPairs.has(pairKey)) {
          endWayPairs.add(pairKey);
          links.push({ source: endIdx, target: wayIdx, value: 1 });
        }
      }

      // Way -> Mean link
      if (l.meanId && wayIdx !== undefined) {
        const meanIdx = meanIdxMap.get(l.meanId);
        if (meanIdx !== undefined) {
          links.push({ source: wayIdx, target: meanIdx, value: l.allocationPct || 1 });
        }
      }
    }

    return { nodes, links };
  }, [ends, ways, means, linkages]);

  const handleMouseEnter = useCallback(
    (_item: NodeProps | LinkProps, _type: string, _e: React.MouseEvent) => {
      if ('index' in _item && typeof _item.index === 'number') {
        setHoveredIndex(_item.index);
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(
    (_item: NodeProps | LinkProps, _type: string, _e: React.MouseEvent) => {
      setHoveredIndex(null);
    },
    [],
  );

  // Empty state
  if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <p className="text-sm">No E-W-M linkages to visualize</p>
        <p className="text-xs">Create linkages in Tree View to see the Sankey flow diagram</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LEVEL_COLORS[0] }} />
          <span className="text-xs text-gray-400">Ends (Objectives)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LEVEL_COLORS[1] }} />
          <span className="text-xs text-gray-400">Ways (LOEs/COAs)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LEVEL_COLORS[2] }} />
          <span className="text-xs text-gray-400">Means (Forces)</span>
        </div>
      </div>

      <Sankey
        data={sankeyData}
        width={960}
        height={Math.max(300, sankeyData.nodes.length * 40)}
        nodeWidth={12}
        nodePadding={24}
        margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
        node={CustomSankeyNode}
        link={CustomSankeyLink}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Tooltip content={<EWMTooltip />} />
      </Sankey>
    </div>
  );
}

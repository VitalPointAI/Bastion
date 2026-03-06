import { useState, useRef, useEffect } from 'react';
import './EffectChainDiagram.css';

// ==========================================================================
// Frontend Types (mirror backend effect-cascader.ts)
// ==========================================================================

export const DIMEDomain = {
  Diplomatic: 'Diplomatic',
  Information: 'Information',
  Military: 'Military',
  Economic: 'Economic',
} as const;

export type DIMEDomain = (typeof DIMEDomain)[keyof typeof DIMEDomain];

export type EffectOrder = 'first' | 'second' | 'third';

export interface EffectNodeData {
  id: string;
  description: string;
  domain: DIMEDomain;
  order: EffectOrder;
  intended: boolean;
  sentiment: 'positive' | 'negative' | 'neutral';
  affectedPopulation: string;
  duration: 'temporary' | 'persistent' | 'permanent';
  probability: number;
  probabilityBounds: { lower: number; upper: number };
  reversible: boolean;
}

export interface EffectEdgeData {
  fromId: string;
  toId: string;
  mechanism: string;
  timeDelay: 'immediate' | 'hours' | 'days' | 'weeks' | 'months';
  strength: number;
}

export interface EffectChainData {
  rootAction: {
    id: string;
    description: string;
    coaId: string;
    domain: DIMEDomain;
  };
  nodes: EffectNodeData[];
  edges: EffectEdgeData[];
}

// ==========================================================================
// Component
// ==========================================================================

interface EffectChainDiagramProps {
  chains: EffectChainData[];
  selectedChainId?: string;
  onNodeClick?: (node: EffectNodeData) => void;
}

export function EffectChainDiagram({
  chains,
  selectedChainId,
  onNodeClick,
}: EffectChainDiagramProps) {
  const [selectedNode, setSelectedNode] = useState<EffectNodeData | null>(null);
  const [visibleChainIds, setVisibleChainIds] = useState<Set<string>>(
    new Set(chains.map((c) => c.rootAction.id))
  );
  const svgRef = useRef<SVGSVGElement>(null);

  // Auto-select first chain if none selected
  useEffect(() => {
    if (chains.length > 0 && !selectedChainId) {
       
      setVisibleChainIds(new Set([chains[0].rootAction.id]));
    }
  }, [chains, selectedChainId]);

  const handleNodeClick = (node: EffectNodeData) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const toggleChainVisibility = (chainId: string) => {
    const newVisible = new Set(visibleChainIds);
    if (newVisible.has(chainId)) {
      newVisible.delete(chainId);
    } else {
      newVisible.add(chainId);
    }
    setVisibleChainIds(newVisible);
  };

  const getSentimentClass = (sentiment: string): string => {
    return `node-sentiment-${sentiment}`;
  };

  const getDomainColor = (domain: DIMEDomain): string => {
    const colors: Record<DIMEDomain, string> = {
      [DIMEDomain.Diplomatic]: '#3b82f6',
      [DIMEDomain.Information]: '#8b5cf6',
      [DIMEDomain.Military]: '#ef4444',
      [DIMEDomain.Economic]: '#10b981',
    };
    return colors[domain];
  };

  const getOrderPosition = (order: EffectOrder): number => {
    const positions: Record<EffectOrder, number> = {
      first: 1,
      second: 2,
      third: 3,
    };
    return positions[order];
  };

  const getDomainRow = (domain: DIMEDomain): number => {
    const rows: Record<DIMEDomain, number> = {
      [DIMEDomain.Diplomatic]: 0,
      [DIMEDomain.Information]: 1,
      [DIMEDomain.Military]: 2,
      [DIMEDomain.Economic]: 3,
    };
    return rows[domain];
  };

  // Layout constants
  const swimLaneHeight = 140;
  const swimLaneGap = 20;
  const nodeWidth = 180;
  const nodeHeight = 80;
  const columnSpacing = 250;
  const leftMargin = 200;
  const topMargin = 40;

  // Build node positions
  const nodePositions = new Map<string, { x: number; y: number }>();
  const visibleChains = chains.filter((chain) => visibleChainIds.has(chain.rootAction.id));

  visibleChains.forEach((chain) => {
    // Position root action
    const rootRow = getDomainRow(chain.rootAction.domain);
    const rootX = leftMargin;
    const rootY = topMargin + rootRow * (swimLaneHeight + swimLaneGap) + swimLaneHeight / 2;
    nodePositions.set(chain.rootAction.id, { x: rootX, y: rootY });

    // Position effect nodes by order
    chain.nodes.forEach((node) => {
      const orderPos = getOrderPosition(node.order);
      const row = getDomainRow(node.domain);
      const x = leftMargin + orderPos * columnSpacing;
      const y = topMargin + row * (swimLaneHeight + swimLaneGap) + swimLaneHeight / 2;
      nodePositions.set(node.id, { x, y });
    });
  });

  // Calculate SVG dimensions
  const totalHeight = topMargin + 4 * (swimLaneHeight + swimLaneGap);
  const totalWidth = leftMargin + 4 * columnSpacing + nodeWidth;

  // Build edges for visible chains
  const allEdges: Array<{ edge: EffectEdgeData; chain: EffectChainData }> = [];
  visibleChains.forEach((chain) => {
    chain.edges.forEach((edge) => {
      allEdges.push({ edge, chain });
    });
  });

  return (
    <div className="effect-chain-diagram-container">
      <div className="effect-chain-diagram-header">
        <h3>Effect Chain Diagram</h3>
        <div className="chain-toggles">
          {chains.map((chain) => (
            <label key={chain.rootAction.id} className="chain-toggle">
              <input
                type="checkbox"
                checked={visibleChainIds.has(chain.rootAction.id)}
                onChange={() => toggleChainVisibility(chain.rootAction.id)}
              />
              <span>COA {chain.rootAction.coaId}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="effect-chain-diagram-scroll">
        <div className="effect-chain-diagram" style={{ minWidth: totalWidth, height: totalHeight }}>
          {/* Swim lane backgrounds */}
          <div className="swim-lanes">
            {Object.values(DIMEDomain).map((domain, idx) => (
              <div
                key={domain}
                className={`swim-lane swim-lane-${idx % 2 === 0 ? 'even' : 'odd'}`}
                style={{
                  top: topMargin + idx * (swimLaneHeight + swimLaneGap),
                  height: swimLaneHeight,
                }}
              >
                <div className="swim-lane-label" style={{ color: getDomainColor(domain) }}>
                  {domain}
                </div>
              </div>
            ))}
          </div>

          {/* SVG for arrows */}
          <svg
            ref={svgRef}
            className="effect-arrows-svg"
            width={totalWidth}
            height={totalHeight}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
              </marker>
            </defs>

            {allEdges.map(({ edge, chain }, idx) => {
              const fromPos = nodePositions.get(edge.fromId);
              const toPos = nodePositions.get(edge.toId);
              if (!fromPos || !toPos) return null;

              const strokeWidth = 1 + edge.strength * 3;
              const midX = (fromPos.x + toPos.x) / 2;
              const midY = (fromPos.y + toPos.y) / 2;

              return (
                <g key={`${chain.rootAction.id}-${edge.fromId}-${edge.toId}-${idx}`}>
                  <path
                    d={`M ${fromPos.x + nodeWidth / 2} ${fromPos.y} L ${toPos.x - nodeWidth / 2} ${toPos.y}`}
                    stroke="#6b7280"
                    strokeWidth={strokeWidth}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    opacity={0.7}
                  />
                  <text
                    x={midX}
                    y={midY - 5}
                    fontSize="11"
                    fill="#4b5563"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.mechanism}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Root actions as nodes */}
          {visibleChains.map((chain) => {
            const pos = nodePositions.get(chain.rootAction.id);
            if (!pos) return null;

            return (
              <div
                key={chain.rootAction.id}
                className="effect-node root-action"
                style={{
                  left: pos.x,
                  top: pos.y - nodeHeight / 2,
                  width: nodeWidth,
                  height: nodeHeight,
                  borderColor: getDomainColor(chain.rootAction.domain),
                }}
              >
                <div className="effect-node-header">
                  <span className="effect-node-badge">Root Action</span>
                </div>
                <div className="effect-node-content">
                  <div className="effect-node-description">{chain.rootAction.description}</div>
                </div>
              </div>
            );
          })}

          {/* Effect nodes */}
          {visibleChains.flatMap((chain) =>
            chain.nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const sentimentClass = getSentimentClass(node.sentiment);
              const isSelected = selectedNode?.id === node.id;
              const borderStyle = node.intended ? 'solid' : 'dashed';

              return (
                <div
                  key={node.id}
                  className={`effect-node ${sentimentClass} ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y - nodeHeight / 2,
                    width: nodeWidth,
                    height: nodeHeight,
                    borderStyle,
                  }}
                  onClick={() => handleNodeClick(node)}
                >
                  <div className="effect-node-header">
                    <span className="effect-node-badge">{node.order}</span>
                    {!node.intended && <span className="unintended-badge">Unintended</span>}
                  </div>
                  <div className="effect-node-content">
                    <div className="effect-node-description">{node.description}</div>
                  </div>
                </div>
              );
            })
          )}

          {/* Detail popover */}
          {selectedNode && (() => {
            const pos = nodePositions.get(selectedNode.id);
            if (!pos) return null;

            return (
              <div
                className="effect-node-popover"
                style={{
                  left: pos.x + nodeWidth + 20,
                  top: pos.y - nodeHeight / 2,
                }}
              >
                <div className="popover-header">
                  <h4>Effect Details</h4>
                  <button className="popover-close" onClick={() => setSelectedNode(null)}>
                    ×
                  </button>
                </div>
                <div className="popover-content">
                  <div className="popover-field">
                    <span className="popover-label">Description:</span>
                    <span>{selectedNode.description}</span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Domain:</span>
                    <span style={{ color: getDomainColor(selectedNode.domain) }}>
                      {selectedNode.domain}
                    </span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Probability:</span>
                    <span>
                      {Math.round(selectedNode.probability * 100)}% (
                      {Math.round(selectedNode.probabilityBounds.lower * 100)}-
                      {Math.round(selectedNode.probabilityBounds.upper * 100)}%)
                    </span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Duration:</span>
                    <span>{selectedNode.duration}</span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Affected Population:</span>
                    <span>{selectedNode.affectedPopulation}</span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Reversible:</span>
                    <span>{selectedNode.reversible ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="popover-field">
                    <span className="popover-label">Intended:</span>
                    <span>{selectedNode.intended ? 'Yes' : 'No (unintended)'}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="effect-chain-legend">
        <div className="legend-item">
          <span className="legend-node node-sentiment-positive"></span>
          <span>Positive effect</span>
        </div>
        <div className="legend-item">
          <span className="legend-node node-sentiment-negative"></span>
          <span>Negative effect</span>
        </div>
        <div className="legend-item">
          <span className="legend-node node-sentiment-neutral"></span>
          <span>Neutral effect</span>
        </div>
        <div className="legend-item">
          <span className="legend-node" style={{ borderStyle: 'dashed' }}></span>
          <span>Unintended effect</span>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';
import './GraphExplorer.css';

export interface GraphNode {
  id: string;
  label: string;
  type: 'nation' | 'organization' | 'individual' | 'non_state_actor' | 'tension';
  problemSetId?: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strength?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphExplorerProps {
  data: GraphData;
  problemSetId?: string;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  selectedNodeId?: string;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  nation: '#4a9eff',           // Blue
  organization: '#50c878',      // Green
  individual: '#ffa500',        // Orange
  non_state_actor: '#ff6b6b',   // Red
  tension: '#ff00ff',           // Magenta
};

const EDGE_COLORS: Record<string, string> = {
  alliance: '#50c878',
  cooperation: '#4a9eff',
  dependency: '#ffa500',
  competition: '#ffcc00',
  conflict: '#ff6b6b',
};

export function GraphExplorer({
  data,
  problemSetId: _problemSetId,
  onNodeClick,
  onEdgeClick: _onEdgeClick,
  selectedNodeId,
  height = 600,
}: GraphExplorerProps) {
  void _problemSetId; // Reserved for future use
  void _onEdgeClick; // Reserved for future use
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRelType, setFilterRelType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter data based on selections — memoized to prevent re-render jitter
  const graphData = useMemo(() => {
    let nodes = data.nodes;
    let edges = data.edges;

    if (filterType !== 'all') {
      nodes = nodes.filter(n => n.type === filterType);
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    if (filterRelType !== 'all') {
      edges = edges.filter(e => e.type === filterRelType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(query));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    return { nodes, links: edges };
  }, [data, filterType, filterRelType, searchQuery]);

  // Node rendering
  const nodeCanvasObject = useCallback((node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const gNode = node as NodeObject & GraphNode;
    const label = gNode.label || gNode.id;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;

    // Node circle
    const isSelected = gNode.id === selectedNodeId;
    const isHovered = hoveredNode?.id === gNode.id;
    const radius = isSelected ? 8 : isHovered ? 7 : 5;

    ctx.beginPath();
    ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = NODE_COLORS[gNode.type] || '#888';
    ctx.fill();

    // Selection/hover ring
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(label, node.x!, node.y! + radius + 2);
  }, [selectedNodeId, hoveredNode]);

  // Link rendering
  const linkCanvasObject = useCallback((link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const gLink = link as LinkObject & GraphEdge;
    const source = link.source as NodeObject;
    const target = link.target as NodeObject;

    if (!source.x || !source.y || !target.x || !target.y) return;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    const color = EDGE_COLORS[gLink.type] || '#666';
    const strength = gLink.strength ?? 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = (1 + Math.abs(strength) * 2) / globalScale;

    // Dashed line for negative relationships
    if (strength < 0) {
      ctx.setLineDash([5 / globalScale, 5 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node: NodeObject) => {
    const gNode = node as NodeObject & GraphNode;
    onNodeClick?.(gNode);
  }, [onNodeClick]);

  // Zoom to fit after simulation settles
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(400, 50), 500);
    return () => clearTimeout(t);
  }, [data]);

  // Pin all nodes in place once the simulation finishes
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 50);
  }, []);

  const handleRecenter = useCallback(() => {
    fgRef.current?.zoomToFit(400, 50);
  }, []);

  return (
    <div className="graph-explorer">
      <div className="graph-controls">
        <div className="control-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search actors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="graph-search"
          />
        </div>

        <div className="control-group">
          <label>Actor Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="nation">Nations</option>
            <option value="organization">Organizations</option>
            <option value="individual">Individuals</option>
            <option value="non_state_actor">Non-State Actors</option>
          </select>
        </div>

        <div className="control-group">
          <label>Relationship</label>
          <select value={filterRelType} onChange={e => setFilterRelType(e.target.value)}>
            <option value="all">All Relationships</option>
            <option value="alliance">Alliances</option>
            <option value="cooperation">Cooperation</option>
            <option value="conflict">Conflicts</option>
            <option value="competition">Competition</option>
            <option value="dependency">Dependencies</option>
          </select>
        </div>

        <div className="graph-stats">
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.links.length} edges</span>
        </div>

        <button className="recenter-btn" onClick={handleRecenter} title="Re-center graph">
          Re-center
        </button>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          linkCanvasObject={linkCanvasObject}
          onNodeClick={handleNodeClick}
          onNodeHover={node => setHoveredNode(node as GraphNode | null)}
          onEngineStop={handleEngineStop}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          width={undefined}
          height={height}
          backgroundColor="transparent"
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={false}
          warmupTicks={200}
          cooldownTicks={50}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.4}
        />

        {/* Legend overlays the graph canvas */}
        <div className="graph-legend">
          <div className="legend-title">Legend</div>
          <div className="legend-section">
            <div className="legend-subtitle">Actors</div>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: color }} />
                <span className="legend-label">{type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          <div className="legend-section">
            <div className="legend-subtitle">Relationships</div>
            {Object.entries(EDGE_COLORS).map(([type, color]) => (
              <div key={type} className="legend-item">
                <span className="legend-line" style={{ backgroundColor: color }} />
                <span className="legend-label">{type}</span>
              </div>
            ))}
          </div>
          <div className="legend-section">
            <div className="legend-subtitle">Line Style</div>
            <div className="legend-item">
              <span className="legend-line legend-line-solid" />
              <span className="legend-label">Positive</span>
            </div>
            <div className="legend-item">
              <span className="legend-line legend-line-dashed" />
              <span className="legend-label">Negative</span>
            </div>
          </div>
        </div>
      </div>

      {hoveredNode && (
        <div className="node-tooltip">
          <div className="tooltip-header">
            <span className={`node-type-badge ${hoveredNode.type}`}>{hoveredNode.type}</span>
            <span className="node-name">{hoveredNode.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

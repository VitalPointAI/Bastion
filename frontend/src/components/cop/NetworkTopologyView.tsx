/**
 * NetworkTopologyView
 *
 * Phase 32 Plan 09: Force-directed network topology graph visualization.
 * Shows Bastion at center with device/network nodes, edges with hop counts,
 * scanner controls, and path highlighting.
 *
 * Uses SVG + requestAnimationFrame for lightweight force-directed layout
 * (no heavyweight graph library needed for <100 nodes).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  TopologyGraph,
  TopologyNode,
  TopologyEdge,
  DiscoveryStatus,
} from '../../lib/discovery-service.ts';
import { discoveryService } from '../../lib/discovery-service.ts';

// ---- Constants ------------------------------------------------------------

const NODE_RADIUS = 18;
const BASTION_RADIUS = 24;
const REPULSION = 8000;
const ATTRACTION = 0.005;
const DAMPING = 0.85;
const MIN_VELOCITY = 0.1;
const MAX_ITERATIONS = 300;

const TRUST_COLORS: Record<string, string> = {
  observer: '#6b7280',
  participant: '#3b82f6',
  autonomous: '#22c55e',
};

const TRANSPORT_LABELS: Record<string, string> = {
  ble: 'BLE',
  wifi: 'WiFi',
  usb: 'USB',
  tak: 'TAK',
};

// ---- Force layout types ---------------------------------------------------

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data: TopologyNode;
}

// ---- Props ----------------------------------------------------------------

interface NetworkTopologyViewProps {
  visible: boolean;
  scannerStatus: DiscoveryStatus | null;
  deviceCount: number;
  connectedCount: number;
}

// ---- Component ------------------------------------------------------------

export function NetworkTopologyView({
  visible,
  scannerStatus,
  deviceCount,
  connectedCount,
}: NetworkTopologyViewProps) {
  const [topology, setTopology] = useState<TopologyGraph | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [hoppingEnabled, setHoppingEnabled] = useState(false);
  const [hopDepth, setHopDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // ---- Load topology data ------------------------------------------------

  const loadTopology = useCallback(async () => {
    try {
      setLoading(true);
      const graph = await discoveryService.getTopology();
      if (mountedRef.current) {
        setTopology(graph);
        setEdges(graph.edges);
        setHoppingEnabled(graph.hoppingEnabled);
        initializeLayout(graph);
      }
    } catch (err) {
      console.error('[NetworkTopologyView] load failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // ---- Initialize force layout --------------------------------------------

  const initializeLayout = useCallback((graph: TopologyGraph) => {
    const width = containerRef.current?.clientWidth || 600;
    const height = containerRef.current?.clientHeight || 400;
    const cx = width / 2;
    const cy = height / 2;

    const nodes: LayoutNode[] = graph.nodes.map((node, i) => {
      if (node.type === 'bastion') {
        return { id: node.id, x: cx, y: cy, vx: 0, vy: 0, data: node };
      }
      // Spread initial positions in a circle
      const angle = (2 * Math.PI * i) / Math.max(graph.nodes.length, 1);
      const radius = 120 + Math.random() * 60;
      return {
        id: node.id,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        data: node,
      };
    });

    // Run force simulation
    runForceSimulation(nodes, graph.edges, cx, cy);
  }, []);

  const runForceSimulation = useCallback(
    (nodes: LayoutNode[], edgeList: TopologyEdge[], cx: number, cy: number) => {
      let iterations = 0;

      function step() {
        if (!mountedRef.current || iterations >= MAX_ITERATIONS) {
          setLayoutNodes([...nodes]);
          return;
        }

        // Repulsion between all pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const distSq = Math.max(dx * dx + dy * dy, 100);
            const force = REPULSION / distSq;
            const fx = (dx / Math.sqrt(distSq)) * force;
            const fy = (dy / Math.sqrt(distSq)) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // Attraction along edges
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        for (const edge of edgeList) {
          const source = nodeMap.get(edge.sourceId);
          const target = nodeMap.get(edge.targetId);
          if (!source || !target) continue;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const force = dist * ATTRACTION;
          const fx = (dx / Math.max(dist, 1)) * force;
          const fy = (dy / Math.max(dist, 1)) * force;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }

        // Center gravity for bastion node
        for (const node of nodes) {
          if (node.data.type === 'bastion') {
            node.vx += (cx - node.x) * 0.05;
            node.vy += (cy - node.y) * 0.05;
          }
          // Apply damping and update position
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          if (Math.abs(node.vx) < MIN_VELOCITY) node.vx = 0;
          if (Math.abs(node.vy) < MIN_VELOCITY) node.vy = 0;
          node.x += node.vx;
          node.y += node.vy;
        }

        iterations++;
        if (iterations % 10 === 0) {
          setLayoutNodes([...nodes]);
        }

        animFrameRef.current = requestAnimationFrame(step);
      }

      step();
    },
    [],
  );

  // ---- Lifecycle -----------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    if (visible) {
      loadTopology();
    }
    return () => {
      mountedRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [visible, loadTopology]);

  // ---- Path highlighting --------------------------------------------------

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (nodeId === 'bastion') {
        setSelectedPath([]);
        return;
      }
      try {
        const result = await discoveryService.getTopologyPath('bastion', nodeId);
        setSelectedPath(result.path);
      } catch {
        setSelectedPath([]);
      }
    },
    [],
  );

  // ---- Scanner controls ---------------------------------------------------

  const handleStart = useCallback(async () => {
    try { await discoveryService.startScanning(); } catch (e) { console.error(e); }
  }, []);

  const handleStop = useCallback(async () => {
    try { await discoveryService.stopScanning(); } catch (e) { console.error(e); }
  }, []);

  const handlePause = useCallback(async () => {
    try { await discoveryService.pauseScanning(); } catch (e) { console.error(e); }
  }, []);

  const handleResume = useCallback(async () => {
    try { await discoveryService.resumeScanning(); } catch (e) { console.error(e); }
  }, []);

  // ---- Render --------------------------------------------------------------

  if (!visible) return null;

  const isPathEdge = (edge: TopologyEdge): boolean => {
    if (selectedPath.length < 2) return false;
    for (let i = 0; i < selectedPath.length - 1; i++) {
      if (
        (edge.sourceId === selectedPath[i] && edge.targetId === selectedPath[i + 1]) ||
        (edge.targetId === selectedPath[i] && edge.sourceId === selectedPath[i + 1])
      ) {
        return true;
      }
    }
    return false;
  };

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
  const scanState = scannerStatus?.state || 'idle';
  const activeScanners = scannerStatus?.activeScanners?.length || 0;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900 flex flex-col font-mono text-xs">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-slate-800 border-b border-slate-700 text-slate-300">
        <span>
          Scanning:{' '}
          <span className={scanState === 'scanning' ? 'text-green-400' : scanState === 'paused' ? 'text-yellow-400' : 'text-slate-500'}>
            {scanState.charAt(0).toUpperCase() + scanState.slice(1)}
          </span>
        </span>
        <span className="text-slate-600">|</span>
        <span>{activeScanners} scanner{activeScanners !== 1 ? 's' : ''}</span>
        <span className="text-slate-600">|</span>
        <span>{deviceCount} discovered</span>
        <span className="text-slate-600">|</span>
        <span>{connectedCount} onboarded</span>
        {loading && <span className="ml-auto text-slate-500">Loading...</span>}
      </div>

      {/* SVG graph */}
      <div className="flex-1 overflow-hidden relative">
        <svg ref={svgRef} width="100%" height="100%" className="bg-slate-900">
          {/* Edges */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.sourceId);
            const target = nodeMap.get(edge.targetId);
            if (!source || !target) return null;

            const highlighted = isPathEdge(edge);
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={highlighted ? '#38bdf8' : '#334155'}
                  strokeWidth={highlighted ? 2.5 : 1}
                  strokeDasharray={edge.connectionType === 'discovered' ? '4 2' : undefined}
                />
                {edge.hopCount > 0 && (
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="'Fira Code', monospace"
                  >
                    hop {edge.hopCount}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const isBastion = node.data.type === 'bastion';
            const isNetwork = node.data.type === 'network';
            const r = isBastion ? BASTION_RADIUS : NODE_RADIUS;
            const fill = isBastion
              ? '#0ea5e9'
              : isNetwork
                ? 'transparent'
                : TRUST_COLORS[node.data.trustTier || ''] || '#6b7280';
            const isOnPath = selectedPath.includes(node.id);

            return (
              <g
                key={`node-${node.id}`}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {isNetwork ? (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 4}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={fill}
                    stroke={isOnPath ? '#38bdf8' : isBastion ? '#0284c7' : '#475569'}
                    strokeWidth={isOnPath ? 3 : 1.5}
                    opacity={0.9}
                  />
                )}

                {/* Node label */}
                {isBastion ? (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="'Fira Code', monospace"
                  >
                    BASTN
                  </text>
                ) : (
                  <>
                    <text
                      x={node.x}
                      y={node.y + 3}
                      textAnchor="middle"
                      fill="white"
                      fontSize="9"
                      fontFamily="'Fira Code', monospace"
                    >
                      {node.data.displayName.length > 6
                        ? node.data.displayName.slice(0, 6)
                        : node.data.displayName}
                    </text>
                    {node.data.transportType && (
                      <text
                        x={node.x}
                        y={node.y + r + 12}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8"
                        fontFamily="'Fira Code', monospace"
                      >
                        {TRANSPORT_LABELS[node.data.transportType] || node.data.transportType}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scanner control strip */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-t border-slate-700">
        {/* Start/Stop/Pause/Resume */}
        <button
          onClick={handleStart}
          disabled={scanState === 'scanning'}
          className="px-2 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs"
        >
          Start
        </button>
        <button
          onClick={handleStop}
          disabled={scanState === 'idle'}
          className="px-2 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs"
        >
          Stop
        </button>
        <button
          onClick={handlePause}
          disabled={scanState !== 'scanning'}
          className="px-2 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs"
        >
          Pause
        </button>
        <button
          onClick={handleResume}
          disabled={scanState !== 'paused'}
          className="px-2 py-1 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs"
        >
          Resume
        </button>

        <span className="text-slate-700 mx-1">|</span>

        {/* Network hopping toggle */}
        <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hoppingEnabled}
            onChange={(e) => setHoppingEnabled(e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
          />
          Hopping
        </label>

        {/* Hop depth slider */}
        {hoppingEnabled && (
          <label className="flex items-center gap-1.5 text-slate-400">
            Depth:
            <input
              type="range"
              min={1}
              max={5}
              value={hopDepth}
              onChange={(e) => setHopDepth(Number(e.target.value))}
              className="w-16 h-1 accent-sky-500"
            />
            <span className="text-slate-300 w-3">{hopDepth}</span>
          </label>
        )}

        {/* Refresh button */}
        <button
          onClick={loadTopology}
          className="ml-auto px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

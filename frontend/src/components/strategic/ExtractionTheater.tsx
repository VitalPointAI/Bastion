/**
 * ExtractionTheater
 *
 * Full-screen modal showing document extraction and live knowledge graph building.
 * Left panel: document info + extraction progress feed
 * Center: animated flow particles
 * Right panel: live knowledge graph visualization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GraphExplorer } from '../graph/GraphExplorer.tsx';
import type { GraphData, GraphNode, GraphEdge } from '../graph/GraphExplorer.tsx';
import './ExtractionTheater.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ExtractionTheaterProps {
  documentId: string;
  documentTitle: string;
  problemSetId: string;
  userDID: string;
  onClose: () => void;
  onComplete: () => void;
}

interface ExtractionProgress {
  phase: string;
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  objectiveCount: number;
  latestObjectivePreview?: string;
}

interface ObjectivePreview {
  id: string;
  description: string;
  dimeCategory?: string;
  priority?: string;
}

interface GraphEntityEvent {
  type: 'actor' | 'relationship' | 'tension';
  data: {
    id?: string;
    name?: string;
    actorType?: string;
    source?: string;
    target?: string;
    relationshipType?: string;
    strength?: number;
    description?: string;
    intensity?: string;
    domain?: string;
    actors?: string[];
  };
}

interface FeedItem {
  id: string;
  type: 'objective' | 'actor' | 'relationship' | 'tension';
  label: string;
  detail?: string;
  timestamp: number;
}

// Actor name to node ID mapping for building edges
const actorNameToNodeId = new Map<string, string>();

function entityToGraphNode(entity: GraphEntityEvent): GraphNode | null {
  if (entity.type === 'actor' && entity.data.id && entity.data.name) {
    actorNameToNodeId.set(entity.data.name.toLowerCase(), entity.data.id);
    return {
      id: entity.data.id,
      label: entity.data.name,
      type: (entity.data.actorType as GraphNode['type']) || 'organization',
    };
  }
  return null;
}

function entityToGraphEdge(entity: GraphEntityEvent): GraphEdge | null {
  if (entity.type === 'relationship' && entity.data.source && entity.data.target) {
    const sourceId = actorNameToNodeId.get(entity.data.source.toLowerCase());
    const targetId = actorNameToNodeId.get(entity.data.target.toLowerCase());
    if (sourceId && targetId) {
      return {
        source: sourceId,
        target: targetId,
        type: entity.data.relationshipType || 'cooperation',
        strength: entity.data.strength,
      };
    }
  }
  return null;
}

type TheaterPhase = 'connecting' | 'extracting' | 'building_graph' | 'complete' | 'error';

export function ExtractionTheater({
  documentId,
  documentTitle,
  problemSetId,
  userDID,
  onClose,
  onComplete,
}: ExtractionTheaterProps) {
  const [phase, setPhase] = useState<TheaterPhase>('connecting');
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [objectives, setObjectives] = useState<ObjectivePreview[]>([]);
  const [graphStats, setGraphStats] = useState({ actors: 0, relationships: 0, tensions: 0 });
  const [error, setError] = useState<string | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; type: string }>>([]);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const particleCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const addFeedItem = useCallback((item: Omit<FeedItem, 'id' | 'timestamp'>) => {
    const newItem: FeedItem = {
      ...item,
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setFeed(prev => [...prev, newItem]);
  }, []);

  const spawnParticle = useCallback((type: string) => {
    const id = particleCounter.current++;
    setParticles(prev => [...prev, { id, type }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  // Load existing graph data for this problem set
  useEffect(() => {
    async function loadExistingGraph() {
      try {
        const res = await fetch(`${API_BASE}/api/graph?workspaceId=${problemSetId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.nodes?.length > 0) {
            setGraphData({ nodes: data.nodes, edges: data.edges || [] });
          }
        }
      } catch {
        // Existing graph not available — start empty
      }
    }
    loadExistingGraph();
  }, [problemSetId]);

  // Run extraction via SSE
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function runExtraction() {
      try {
        setPhase('extracting');

        const url = `${API_BASE}/api/strategic/documents/${documentId}/extract/stream?did=${encodeURIComponent(userDID)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream', 'X-DID': userDID },
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `Extraction failed (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(currentEvent, data);
              } catch {
                // Skip unparseable events
              }
              currentEvent = '';
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Extraction failed');
        setPhase('error');
      }
    }

    runExtraction();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, userDID]);

  // Auto-scroll feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  function handleSSEEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case 'progress': {
        const prog = data as unknown as ExtractionProgress;
        setProgress(prog);
        if (prog.latestObjectivePreview) {
          addFeedItem({
            type: 'objective',
            label: prog.latestObjectivePreview.slice(0, 120),
            detail: `Chunk ${prog.currentChunk}/${prog.totalChunks}`,
          });
        }
        break;
      }

      case 'extraction_complete': {
        setPhase('building_graph');
        const objs = (data.objectives || []) as ObjectivePreview[];
        setObjectives(objs);
        addFeedItem({
          type: 'objective',
          label: `Extraction complete: ${data.objectiveCount} objectives found`,
          detail: `Confidence: ${Math.round((data.extractionConfidence as number) * 100)}%`,
        });
        break;
      }

      case 'graph_entity': {
        const entity = data as unknown as GraphEntityEvent;

        if (entity.type === 'actor') {
          const node = entityToGraphNode(entity);
          if (node) {
            setGraphData(prev => ({
              ...prev,
              nodes: prev.nodes.some(n => n.id === node.id) ? prev.nodes : [...prev.nodes, node],
            }));
            setGraphStats(prev => ({ ...prev, actors: prev.actors + 1 }));
            addFeedItem({
              type: 'actor',
              label: entity.data.name || 'Unknown actor',
              detail: entity.data.actorType,
            });
            spawnParticle('actor');
          }
        } else if (entity.type === 'relationship') {
          const edge = entityToGraphEdge(entity);
          if (edge) {
            setGraphData(prev => ({
              ...prev,
              edges: [...prev.edges, edge],
            }));
            setGraphStats(prev => ({ ...prev, relationships: prev.relationships + 1 }));
            addFeedItem({
              type: 'relationship',
              label: `${entity.data.source} \u2192 ${entity.data.target}`,
              detail: entity.data.relationshipType,
            });
            spawnParticle('relationship');
          }
        } else if (entity.type === 'tension') {
          setGraphStats(prev => ({ ...prev, tensions: prev.tensions + 1 }));
          addFeedItem({
            type: 'tension',
            label: entity.data.description?.slice(0, 100) || 'Tension detected',
            detail: `${entity.data.intensity} - ${entity.data.domain}`,
          });
          spawnParticle('tension');
        }
        break;
      }

      case 'graph_progress':
        // Running totals — update stats display
        setGraphStats({
          actors: (data.actorsCreated as number) || 0,
          relationships: (data.relationshipsCreated as number) || 0,
          tensions: (data.tensionsCreated as number) || 0,
        });
        break;

      case 'complete':
        setPhase('complete');
        break;

      case 'error':
        setError((data.error as string) || 'Extraction failed');
        setPhase('error');
        break;
    }
  }

  const handleClose = () => {
    abortRef.current?.abort();
    if (phase === 'complete') onComplete();
    onClose();
  };

  const phaseLabel = {
    connecting: 'Connecting...',
    extracting: `Extracting objectives${progress ? ` (${progress.percentComplete}%)` : ''}`,
    building_graph: 'Building knowledge graph...',
    complete: 'Extraction complete',
    error: 'Extraction failed',
  }[phase];

  const overallPercent = phase === 'complete' ? 100
    : phase === 'building_graph' ? 95
    : progress?.percentComplete ?? 0;

  const typeColors: Record<string, string> = {
    objective: '#818cf8',
    actor: '#4a9eff',
    relationship: '#50c878',
    tension: '#ff00ff',
  };

  return (
    <div className="extraction-theater-overlay" onClick={handleClose}>
      <div className="extraction-theater" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="theater-header">
          <div className="theater-header-left">
            <h2 className="theater-title">Knowledge Extraction</h2>
            <span className="theater-doc-name">{documentTitle}</span>
          </div>
          <div className="theater-header-center">
            <span className="theater-phase-label">{phaseLabel}</span>
            <div className="theater-progress-bar">
              <div
                className="theater-progress-fill"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
          <button className="theater-close-btn" onClick={handleClose}>
            {phase === 'complete' ? 'Done' : 'Close'}
          </button>
        </div>

        {/* Main content: 3 columns */}
        <div className="theater-body">
          {/* LEFT: Extraction Feed */}
          <div className="theater-left">
            <div className="theater-stats-row">
              <div className="theater-stat">
                <span className="stat-count">{objectives.length}</span>
                <span className="stat-label">Objectives</span>
              </div>
              <div className="theater-stat">
                <span className="stat-count" style={{ color: '#4a9eff' }}>{graphStats.actors}</span>
                <span className="stat-label">Actors</span>
              </div>
              <div className="theater-stat">
                <span className="stat-count" style={{ color: '#50c878' }}>{graphStats.relationships}</span>
                <span className="stat-label">Relations</span>
              </div>
              <div className="theater-stat">
                <span className="stat-count" style={{ color: '#ff00ff' }}>{graphStats.tensions}</span>
                <span className="stat-label">Tensions</span>
              </div>
            </div>

            <div className="theater-feed">
              {feed.map(item => (
                <div key={item.id} className="feed-item" style={{ borderLeftColor: typeColors[item.type] || '#666' }}>
                  <span className="feed-type-badge" style={{ background: typeColors[item.type] || '#666' }}>
                    {item.type}
                  </span>
                  <span className="feed-label">{item.label}</span>
                  {item.detail && <span className="feed-detail">{item.detail}</span>}
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>

            {error && (
              <div className="theater-error">{error}</div>
            )}
          </div>

          {/* CENTER: Flow Animation */}
          <div className="theater-center">
            <div className="flow-track">
              {particles.map(p => (
                <div
                  key={p.id}
                  className="flow-particle"
                  style={{ background: typeColors[p.type] || '#4a9eff' }}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: Live Graph */}
          <div className="theater-right">
            {graphData.nodes.length === 0 ? (
              <div className="theater-graph-empty">
                {phase === 'extracting'
                  ? 'Extracting objectives... graph will appear when entities are discovered'
                  : phase === 'building_graph'
                    ? 'Analyzing text for actors, relationships, and tensions...'
                    : 'No graph entities found'}
              </div>
            ) : (
              <GraphExplorer
                data={graphData}
                problemSetId={problemSetId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

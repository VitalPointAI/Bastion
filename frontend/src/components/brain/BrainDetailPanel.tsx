/**
 * BrainDetailPanel — right slide-in panel for node detail, comparison, and annotations.
 *
 * Single-node view: identity, confidence meter, connections, source documents,
 * metadata, and annotations via NodeAnnotationPanel.
 *
 * Multi-node comparison view: shared connections, unique connections per node,
 * attribute differences table, and bulk annotation.
 */

import React, { useState } from 'react';
import type { BrainNode, BrainEdge, BrainGraphData, BrainAnnotation } from './types.js';
import { CATEGORY_COLORS, NODE_TYPE_SHAPES } from './types.js';
import { NodeAnnotationPanel } from './NodeAnnotationPanel.js';
import './BrainDetailPanel.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BrainDetailPanelProps {
  /** Single selected node (single-node view) */
  selectedNode?: BrainNode;
  /** Multiple selected nodes (comparison view — length > 1 triggers comparison) */
  selectedNodes?: BrainNode[];
  /** Full graph data used to look up connections */
  graphData: BrainGraphData;
  /** All annotations for the problem set */
  annotations: BrainAnnotation[];
  /** Close button handler */
  onClose: () => void;
  /** Create annotation callback */
  onCreateAnnotation: (input: {
    nodeId: string;
    nodeType: BrainNode['type'];
    annotationType: 'flag' | 'note' | 'questionable';
    content?: string;
    isShared?: boolean;
  }) => void;
  /** Update annotation callback */
  onUpdateAnnotation: (id: string, input: { content?: string; isShared?: boolean }) => void;
  /** Delete annotation callback */
  onDeleteAnnotation: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function getConfidenceColor(confidence: number): string {
  // 0 → red, 0.5 → yellow, 1 → green
  if (confidence <= 0.5) {
    const r = 255;
    const g = Math.round(confidence * 2 * 200);
    return `rgb(${r}, ${g}, 60)`;
  }
  const g = 200;
  const r = Math.round((1 - confidence) * 2 * 255);
  return `rgb(${r}, ${g}, 60)`;
}

/**
 * Resolve an edge endpoint to a string ID.
 * react-force-graph-2d mutates source/target from string → object at runtime,
 * but BrainEdge types them as string. We handle both here with a type-safe check.
 */
function resolveEndpoint(endpoint: string): string {
  if (typeof endpoint === 'string') return endpoint;
  // At runtime force-graph may replace the string with a node object
  const obj = endpoint as unknown as { id?: string };
  return obj.id ?? '';
}

/** Get all edges connected to a node (either as source or target) */
function getNodeEdges(nodeId: string, edges: BrainEdge[]): BrainEdge[] {
  return edges.filter((e) => {
    const src = resolveEndpoint(e.source);
    const tgt = resolveEndpoint(e.target);
    return src === nodeId || tgt === nodeId;
  });
}

/** Get the "other" node id from an edge */
function getOtherNodeId(edge: BrainEdge, selfId: string): string {
  const src = resolveEndpoint(edge.source);
  const tgt = resolveEndpoint(edge.target);
  return src === selfId ? tgt : src;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NodeTypeBadge({ type }: { type: BrainNode['type'] }): React.ReactElement {
  const shape = NODE_TYPE_SHAPES[type];
  return (
    <span className="brain-detail-type-badge">
      <span className="brain-detail-type-shape" data-shape={shape} />
      {type}
    </span>
  );
}

function CategoryBadge({ category }: { category?: BrainNode['actorCategory'] }): React.ReactElement | null {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? '#888';
  return (
    <span className="brain-detail-category-badge" style={{ borderColor: color, color }}>
      {category}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }): React.ReactElement {
  const pct = Math.round(value * 100);
  const color = getConfidenceColor(value);
  return (
    <div>
      <div className="confidence-bar">
        <div
          className="confidence-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem', display: 'block' }}>
        {pct}% confidence
      </span>
    </div>
  );
}

// ─── Single Node View ─────────────────────────────────────────────────────────

interface SingleNodeViewProps {
  node: BrainNode;
  graphData: BrainGraphData;
  annotations: BrainAnnotation[];
  onCreateAnnotation: BrainDetailPanelProps['onCreateAnnotation'];
  onUpdateAnnotation: BrainDetailPanelProps['onUpdateAnnotation'];
  onDeleteAnnotation: BrainDetailPanelProps['onDeleteAnnotation'];
}

function SingleNodeView({
  node,
  graphData,
  annotations,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: SingleNodeViewProps): React.ReactElement {
  const nodeEdges = getNodeEdges(node.id, graphData.edges);
  const nodeAnnotations = annotations.filter((a) => a.nodeId === node.id);

  return (
    <>
      {/* Identity section */}
      <div className="brain-detail-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <NodeTypeBadge type={node.type} />
          {node.actorCategory && <CategoryBadge category={node.actorCategory} />}
          {node.isGap && (
            <span className="brain-detail-gap-badge">INTELLIGENCE GAP</span>
          )}
          {node.isFuturePrediction && (
            <span className="brain-detail-prediction-badge">PREDICTION</span>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Confidence</div>
        <ConfidenceMeter value={node.confidence} />
      </div>

      {/* Connections */}
      {nodeEdges.length > 0 && (
        <div className="brain-detail-section">
          <div className="brain-detail-section-title">
            Connections ({nodeEdges.length})
          </div>
          <div className="brain-detail-connections">
            {nodeEdges.map((edge, i) => {
              const otherId = getOtherNodeId(edge, node.id);
              const otherNode = graphData.nodes.find((n) => n.id === otherId);
              const strength = edge.strength ?? 0.5;
              return (
                <div key={`${edge.source}-${edge.target}-${i}`} className="connection-item">
                  <div style={{ flex: 1 }}>
                    <span className="connection-type">{edge.type}</span>
                    <span style={{ margin: '0 0.35rem', color: 'rgba(255,255,255,0.25)' }}>→</span>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                      {otherNode?.label ?? otherId}
                    </span>
                    {otherNode && (
                      <span
                        style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginLeft: '0.3rem' }}
                      >
                        ({otherNode.type})
                      </span>
                    )}
                  </div>
                  <div
                    className="connection-strength"
                    title={`Strength: ${Math.round(strength * 100)}%`}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${strength * 100}%`,
                        background: getConfidenceColor(strength),
                        borderRadius: '1.5px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Source documents */}
      {node.sourceDocumentIds && node.sourceDocumentIds.length > 0 && (
        <div className="brain-detail-section">
          <div className="brain-detail-section-title">
            Source Documents ({node.sourceDocumentIds.length})
          </div>
          <div>
            {node.sourceDocumentIds.map((docId) => (
              <div key={docId} className="brain-detail-source-doc">
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>&#128196;</span>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>{docId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Metadata</div>
        <div className="brain-detail-meta-grid">
          <span className="brain-detail-meta-key">Created</span>
          <span className="brain-detail-meta-val">{formatDate(node.createdAt)}</span>

          {node.containerLabel && (
            <>
              <span className="brain-detail-meta-key">Container</span>
              <span className="brain-detail-meta-val">{node.containerLabel}</span>
            </>
          )}

          {node.dimeCategory && (
            <>
              <span className="brain-detail-meta-key">DIME</span>
              <span className="brain-detail-meta-val">{node.dimeCategory}</span>
            </>
          )}

          {node.validityScore !== undefined && (
            <>
              <span className="brain-detail-meta-key">Validity</span>
              <span className="brain-detail-meta-val">{Math.round(node.validityScore * 100)}%</span>
            </>
          )}
        </div>
      </div>

      {/* Annotations */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Annotations</div>
        <NodeAnnotationPanel
          nodeId={node.id}
          nodeType={node.type}
          annotations={nodeAnnotations}
          onCreate={(input) =>
            onCreateAnnotation({ nodeId: node.id, nodeType: node.type, ...input })
          }
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
        />
      </div>
    </>
  );
}

// ─── Comparison View ──────────────────────────────────────────────────────────

interface ComparisonViewProps {
  nodes: BrainNode[];
  graphData: BrainGraphData;
  onCreateAnnotation: BrainDetailPanelProps['onCreateAnnotation'];
}

function ComparisonView({
  nodes,
  graphData,
  onCreateAnnotation,
}: ComparisonViewProps): React.ReactElement {
  const [bulkNoteExpanded, setBulkNoteExpanded] = useState(false);
  const [bulkNoteContent, setBulkNoteContent] = useState('');

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build connection map: connectedNodeId -> how many selected nodes it connects to
  const connectionCount = new Map<string, { edge: BrainEdge; connectedTo: string[] }>();
  for (const node of nodes) {
    const edges = getNodeEdges(node.id, graphData.edges);
    for (const edge of edges) {
      const otherId = getOtherNodeId(edge, node.id);
      if (nodeIds.has(otherId)) continue; // skip intra-selection connections
      if (!connectionCount.has(otherId)) {
        connectionCount.set(otherId, { edge, connectedTo: [] });
      }
      connectionCount.get(otherId)!.connectedTo.push(node.id);
    }
  }

  const sharedConnections = [...connectionCount.entries()].filter(
    ([, v]) => v.connectedTo.length >= 2,
  );
  const uniqueConnectionsByNode = nodes.map((node) => {
    const unique = [...connectionCount.entries()].filter(
      ([, v]) => v.connectedTo.length === 1 && v.connectedTo[0] === node.id,
    );
    return { node, unique };
  });

  function handleBulkAnnotate(): void {
    for (const node of nodes) {
      onCreateAnnotation({
        nodeId: node.id,
        nodeType: node.type,
        annotationType: 'note',
        content: bulkNoteContent.trim() || undefined,
      });
    }
    setBulkNoteContent('');
    setBulkNoteExpanded(false);
  }

  return (
    <>
      {/* Selected node badges */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Selected Nodes</div>
        <div className="comparison-badges">
          {nodes.map((node) => {
            const color = node.actorCategory ? (CATEGORY_COLORS[node.actorCategory] ?? '#888') : '#888';
            return (
              <span
                key={node.id}
                className="comparison-badge"
                style={{ borderColor: color, color }}
              >
                {node.label}
                <span style={{ marginLeft: '0.3rem', opacity: 0.6, fontSize: '0.65rem' }}>
                  {node.type}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Shared connections */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">
          Shared Connections ({sharedConnections.length})
        </div>
        {sharedConnections.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>No shared connections</p>
        ) : (
          <div>
            {sharedConnections.map(([otherId, v]) => {
              const otherNode = graphData.nodes.find((n) => n.id === otherId);
              return (
                <div key={otherId} className="connection-item">
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>
                      {otherNode?.label ?? otherId}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginLeft: '0.3rem' }}>
                      ({v.edge.type})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                    shared by {v.connectedTo.length}/{nodes.length}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unique connections per node */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Unique Connections</div>
        {uniqueConnectionsByNode.map(({ node, unique }) => (
          <div key={node.id} style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.2rem' }}>
              {node.label}
            </div>
            {unique.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', paddingLeft: '0.5rem' }}>
                None
              </div>
            ) : (
              unique.map(([otherId, v]) => {
                const otherNode = graphData.nodes.find((n) => n.id === otherId);
                return (
                  <div key={otherId} className="connection-item" style={{ paddingLeft: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
                      {otherNode?.label ?? otherId}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.3rem' }}>
                      ({v.edge.type})
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      {/* Differences table */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Attribute Differences</div>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Attribute</th>
              {nodes.map((n) => (
                <th key={n.id} title={n.label}>{n.label.length > 10 ? n.label.slice(0, 10) + '…' : n.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Type</td>
              {nodes.map((n) => <td key={n.id}>{n.type}</td>)}
            </tr>
            <tr>
              <td>Category</td>
              {nodes.map((n) => <td key={n.id}>{n.actorCategory ?? '—'}</td>)}
            </tr>
            <tr>
              <td>Confidence</td>
              {nodes.map((n) => <td key={n.id}>{Math.round(n.confidence * 100)}%</td>)}
            </tr>
            <tr>
              <td>DIME</td>
              {nodes.map((n) => <td key={n.id}>{n.dimeCategory ?? '—'}</td>)}
            </tr>
            <tr>
              <td>Connections</td>
              {nodes.map((n) => <td key={n.id}>{getNodeEdges(n.id, graphData.edges).length}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bulk annotation */}
      <div className="brain-detail-section">
        <div className="brain-detail-section-title">Bulk Annotation</div>
        {!bulkNoteExpanded ? (
          <button
            type="button"
            className="brain-detail-annotate-all-btn"
            onClick={() => setBulkNoteExpanded(true)}
          >
            Annotate All ({nodes.length} nodes)
          </button>
        ) : (
          <div>
            <textarea
              className="bulk-note-input"
              placeholder="Note to add to all selected nodes..."
              value={bulkNoteContent}
              onChange={(e) => setBulkNoteContent(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="brain-detail-annotate-all-btn"
                onClick={handleBulkAnnotate}
              >
                Apply to All
              </button>
              <button
                type="button"
                className="brain-detail-cancel-btn"
                onClick={() => {
                  setBulkNoteExpanded(false);
                  setBulkNoteContent('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BrainDetailPanel({
  selectedNode,
  selectedNodes,
  graphData,
  annotations,
  onClose,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: BrainDetailPanelProps): React.ReactElement {
  const multiNodes = selectedNodes && selectedNodes.length > 1 ? selectedNodes : null;
  const singleNode = multiNodes ? undefined : (selectedNode ?? (selectedNodes?.[0]));

  // Panel title
  const title = multiNodes
    ? `Compare ${multiNodes.length} Nodes`
    : (singleNode?.label ?? 'Node Details');

  return (
    <div className="brain-detail-panel">
      {/* Header */}
      <div className="brain-detail-header">
        <span
          className="brain-detail-title"
          title={title}
        >
          {title}
        </span>
        <button
          type="button"
          className="brain-detail-close"
          onClick={onClose}
          title="Close panel"
          aria-label="Close detail panel"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="brain-detail-content">
        {multiNodes ? (
          <ComparisonView
            nodes={multiNodes}
            graphData={graphData}
            onCreateAnnotation={onCreateAnnotation}
          />
        ) : singleNode ? (
          <SingleNodeView
            node={singleNode}
            graphData={graphData}
            annotations={annotations}
            onCreateAnnotation={onCreateAnnotation}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
          />
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', paddingTop: '1rem' }}>
            Select a node to view details
          </p>
        )}
      </div>
    </div>
  );
}

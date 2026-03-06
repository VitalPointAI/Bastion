/**
 * StrategicContextPreview Component
 *
 * Phase 25.3 Plan 05: Displays a preview of what AI agents know about the
 * strategic environment. Shows graph summaries, document summaries, and
 * token budget usage for a given problem set.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchStrategicContextPreview,
  type StrategicContextPreviewData,
  type GraphSummaryData,
} from '../../lib/strategic-context-service.js';
import './StrategicContextPreview.css';

interface StrategicContextPreviewProps {
  problemSetId: string;
}

export function StrategicContextPreview({ problemSetId }: StrategicContextPreviewProps) {
  const [data, setData] = useState<StrategicContextPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStrategicContextPreview(problemSetId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  if (loading) {
    return (
      <div className="strategic-context-preview">
        <div className="scp-loading">
          <div className="scp-spinner" />
          <span>Loading strategic context...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="strategic-context-preview">
        <div className="scp-error">
          <span>Failed to load strategic context</span>
          <button className="scp-refresh-btn" onClick={loadPreview}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="strategic-context-preview">
        <div className="scp-header">
          <h2>AI Context Preview</h2>
        </div>
        <div className="scp-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>No strategic context available</span>
          <span style={{ fontSize: '0.75rem' }}>
            Subscribe to problem sets with strategic documents, or add documents
            to containers to build AI context.
          </span>
        </div>
      </div>
    );
  }

  const tokenPercent = data.tokenBudget > 0
    ? Math.round((data.tokensUsed / data.tokenBudget) * 100)
    : 0;
  const tokenBarClass = tokenPercent >= 90 ? 'critical' : tokenPercent >= 70 ? 'warning' : '';
  const graphEntries = Object.entries(data.graphSummaries);
  const docCount = data.documentSummaries.length;

  return (
    <div className="strategic-context-preview">
      {/* Header */}
      <div className="scp-header">
        <h2>AI Context Preview</h2>
        <button className="scp-refresh-btn" onClick={loadPreview} disabled={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Token Budget */}
      <div className="scp-token-budget">
        <div className="scp-token-label">
          <span>Token Budget</span>
          <span className="scp-token-value">
            {data.tokensUsed.toLocaleString()} / {data.tokenBudget.toLocaleString()} ({tokenPercent}%)
          </span>
        </div>
        <div className="scp-token-bar-track">
          <div
            className={`scp-token-bar-fill ${tokenBarClass}`}
            style={{ width: `${Math.min(tokenPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Graph Summaries */}
      {graphEntries.length > 0 && (
        <div className="scp-section">
          <div className="scp-section-header">
            Knowledge Graph Summaries
            <span className="section-count">({graphEntries.length})</span>
          </div>
          {graphEntries.map(([containerName, summary]) => (
            <GraphSummaryCard key={containerName} name={containerName} summary={summary} />
          ))}
        </div>
      )}

      {/* Document Summaries */}
      {docCount > 0 && (
        <div className="scp-section">
          <div className="scp-section-header">
            Document Summaries
            <span className="section-count">({docCount})</span>
          </div>
          {data.documentSummaries.map((doc, i) => (
            <DocumentSummaryItem key={`${doc.title}-${i}`} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function GraphSummaryCard({ name, summary }: { name: string; summary: GraphSummaryData }) {
  return (
    <div className="scp-graph-card">
      <h4 className="scp-graph-card-name">{name}</h4>

      {/* Summary text */}
      {summary.summary && (
        <div className="scp-graph-summary-text">{summary.summary}</div>
      )}

      {/* Top Actors */}
      {summary.topActors.length > 0 && (
        <div className="scp-sub-section">
          <div className="scp-sub-label">Top Actors</div>
          <ul className="scp-actor-list">
            {summary.topActors.map((actor) => (
              <li key={actor.name} className="scp-actor-item">
                <span className="scp-actor-name">{actor.name}</span>
                <span className="scp-actor-type">{actor.type}</span>
                {actor.temporalRelevance && (
                  <span className="scp-temporal-badge">{actor.temporalRelevance}</span>
                )}
                <span className="scp-actor-centrality">{actor.centrality.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Relationships */}
      {summary.keyRelationships.length > 0 && (
        <div className="scp-sub-section">
          <div className="scp-sub-label">Key Relationships</div>
          <ul className="scp-rel-list">
            {summary.keyRelationships.map((rel, i) => (
              <li key={`${rel.source}-${rel.target}-${i}`} className="scp-rel-item">
                <span>{rel.source}</span>
                <span className="scp-rel-arrow">&rarr;</span>
                <span>{rel.target}</span>
                <span className="scp-actor-type">{rel.type}</span>
                <span className="scp-actor-centrality">{rel.strength.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Tensions */}
      {summary.activeTensions.length > 0 && (
        <div className="scp-sub-section">
          <div className="scp-sub-label">Active Tensions</div>
          <ul className="scp-tension-list">
            {summary.activeTensions.map((tension, i) => (
              <li key={`tension-${i}`} className="scp-tension-item">
                <span className={`scp-intensity-badge ${tension.intensity.toLowerCase()}`}>
                  {tension.intensity}
                </span>
                <span>{tension.description}</span>
                <span className="scp-actor-type">{tension.domain}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocumentSummaryItem({
  doc,
}: {
  doc: { title: string; docType: string; extractedData?: unknown; textContent?: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = doc.extractedData || doc.textContent;

  const contentText = doc.extractedData
    ? JSON.stringify(doc.extractedData, null, 2)
    : doc.textContent || '';

  return (
    <div className="scp-doc-item">
      <div className="scp-doc-header" onClick={() => hasContent && setExpanded(!expanded)}>
        <div>
          <span className="scp-doc-title">{doc.title}</span>
          <span className="scp-doc-type">{doc.docType}</span>
        </div>
        {hasContent && (
          <button className="scp-doc-expand-btn" title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '\u25B2' : '\u25BC'}
          </button>
        )}
      </div>
      {expanded && contentText && (
        <div className="scp-doc-content">{contentText}</div>
      )}
    </div>
  );
}

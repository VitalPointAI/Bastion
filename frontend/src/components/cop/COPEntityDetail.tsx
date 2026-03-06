/**
 * COPEntityDetail Component
 *
 * Full detail panel for a COP entity. Slides in from the right.
 * Shows entity header, position, classification, movement path,
 * linkages, source documents, and audit trail.
 */

import { useState, useEffect, useCallback } from 'react';
import type { COPSymbolSpec, AuditEntry, COPLayer } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import type { EntityLinkage } from '../../lib/cop-service.js';

interface COPEntityDetailProps {
  symbol: COPSymbolSpec;
  layerId: string;
  /** The layer object, for accessing audit trail and metadata */
  layer?: COPLayer;
  onClose: () => void;
}

/** Affiliation display config */
const AFFILIATION_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  friendly: { color: '#3b82f6', label: 'FRIENDLY' },
  enemy: { color: '#ef4444', label: 'ENEMY' },
  neutral: { color: '#22c55e', label: 'NEUTRAL' },
  unknown: { color: '#eab308', label: 'UNKNOWN' },
};

/** Discovery method badge colors */
const METHOD_COLORS: Record<string, string> = {
  graph_traversal: '#8b5cf6',
  embedding_similarity: '#06b6d4',
  manual: '#6b7280',
};

/** Discovery method display labels */
const METHOD_LABELS: Record<string, string> = {
  graph_traversal: 'Graph',
  embedding_similarity: 'Embedding',
  manual: 'Manual',
};

function getConfidenceColor(c: number): string {
  if (c >= 0.85) return '#22c55e';
  if (c >= 0.7) return '#eab308';
  return '#ef4444';
}

export function COPEntityDetail({
  symbol,
  layerId: _layerId,
  layer,
  onClose,
}: COPEntityDetailProps) {
  const [linkages, setLinkages] = useState<EntityLinkage[]>([]);
  const [loadingLinkages, setLoadingLinkages] = useState(true);
  const [prevEntityId, setPrevEntityId] = useState(symbol.entityId);

  // Reset loading state when entityId changes (React-endorsed setState during render)
  if (symbol.entityId !== prevEntityId) {
    setPrevEntityId(symbol.entityId);
    setLoadingLinkages(true);
    setLinkages([]);
  }

  // Fetch linkages
  useEffect(() => {
    let cancelled = false;
    copService.getEntityLinkages(symbol.entityId).then((result) => {
      if (!cancelled) {
        setLinkages(result);
        setLoadingLinkages(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingLinkages(false);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol.entityId]);

  // Keyboard escape handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const aff = AFFILIATION_CONFIG[symbol.affiliation] ?? {
    color: '#6b7280',
    label: 'UNKNOWN',
  };

  // Extract source docs from layer metadata
  const sourceDocs = layer?.spec?.metadata?.sourceDocumentIds ?? [];

  // Extract audit entries related to this entity
  const auditEntries: AuditEntry[] = (layer?.auditTrail ?? []).filter(
    (entry) =>
      entry.details &&
      typeof entry.details === 'object' &&
      'entityId' in entry.details &&
      entry.details.entityId === symbol.entityId
  );

  return (
    <div className="cop-entity-detail-overlay" onClick={onClose}>
      <div
        className="cop-entity-detail-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Entity detail: ${symbol.designation}`}
      >
        {/* Close button */}
        <button
          className="detail-close-btn"
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          X
        </button>

        {/* 1. Entity Header */}
        <section className="detail-section detail-header-section">
          <div className="detail-entity-name">{symbol.designation}</div>
          <span
            className="detail-affiliation-badge"
            style={{ backgroundColor: aff.color }}
          >
            {aff.label}
          </span>
          <code className="detail-sidc">{symbol.sidc}</code>
        </section>

        {/* 2. Position */}
        <section className="detail-section">
          <h4 className="detail-section-title">Position</h4>
          <div className="detail-kv">
            <span className="detail-key">Latitude</span>
            <span className="detail-value">
              {symbol.position.lat.toFixed(6)}
            </span>
          </div>
          <div className="detail-kv">
            <span className="detail-key">Longitude</span>
            <span className="detail-value">
              {symbol.position.lng.toFixed(6)}
            </span>
          </div>
        </section>

        {/* 3. Classification */}
        <section className="detail-section">
          <h4 className="detail-section-title">Classification</h4>
          <div className="detail-kv">
            <span className="detail-key">CCO Class</span>
            <span className="detail-value">{symbol.ccoClass}</span>
          </div>
          <div className="detail-kv">
            <span className="detail-key">Source Authority</span>
            <span className="detail-value">{symbol.sourceAuthority}</span>
          </div>
          <div className="detail-kv">
            <span className="detail-key">Confidence</span>
            <span className="detail-value">
              <span
                style={{
                  color: getConfidenceColor(symbol.confidence),
                  fontWeight: 600,
                }}
              >
                {Math.round(symbol.confidence * 100)}%
              </span>
            </span>
          </div>
        </section>

        {/* 4. Movement */}
        {symbol.movementPath && symbol.movementPath.length > 0 && (
          <section className="detail-section">
            <h4 className="detail-section-title">Movement Path</h4>
            <table className="detail-movement-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Lat</th>
                  <th>Lng</th>
                </tr>
              </thead>
              <tbody>
                {symbol.movementPath.map((mp) => (
                  <tr key={mp.phase}>
                    <td>{mp.phase}</td>
                    <td>{mp.position.lat.toFixed(6)}</td>
                    <td>{mp.position.lng.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 5. Linkages */}
        <section className="detail-section">
          <h4 className="detail-section-title">Linked Entities</h4>
          {loadingLinkages ? (
            <span className="detail-loading">Loading linkages...</span>
          ) : linkages.length === 0 ? (
            <span className="detail-empty">No linked entities</span>
          ) : (
            <ul className="detail-linkage-list">
              {linkages.map((link) => (
                <li key={link.id} className="detail-linkage-item">
                  <div className="linkage-item-header">
                    <span className="linkage-item-name">
                      {link.entityId}
                    </span>
                    <span
                      className="linkage-method-badge"
                      style={{
                        backgroundColor:
                          METHOD_COLORS[link.discoveryMethod] ?? '#6b7280',
                      }}
                    >
                      {METHOD_LABELS[link.discoveryMethod] ?? link.discoveryMethod}
                    </span>
                  </div>
                  <div className="linkage-item-meta">
                    <span className="linkage-item-confidence"
                      style={{
                        color: getConfidenceColor(link.confidence),
                      }}
                    >
                      {Math.round(link.confidence * 100)}% confidence
                    </span>
                    {link.autoCommitted && (
                      <span className="linkage-auto-badge">Auto</span>
                    )}
                    {link.reviewedBy && (
                      <span className="linkage-reviewed-badge">Reviewed</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 6. Source Documents */}
        {sourceDocs.length > 0 && (
          <section className="detail-section">
            <h4 className="detail-section-title">Source Documents</h4>
            <ul className="detail-source-list">
              {sourceDocs.map((docId) => (
                <li key={docId} className="detail-source-item">
                  <code>{docId}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 7. Audit Trail */}
        {auditEntries.length > 0 && (
          <section className="detail-section">
            <h4 className="detail-section-title">Audit Trail</h4>
            <ul className="detail-audit-list">
              {auditEntries.map((entry) => (
                <li key={entry.id} className="detail-audit-item">
                  <span className="audit-action">{entry.action}</span>
                  <span className="audit-by">{entry.performedBy}</span>
                  <span className="audit-time">
                    {new Date(entry.performedAt).toLocaleString()}
                  </span>
                  {entry.reason && (
                    <span className="audit-reason">{entry.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

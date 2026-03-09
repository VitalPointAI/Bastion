/**
 * InheritedItemCard
 *
 * Phase 26 Plan 02: Summary card for a single inherited document or graph
 * item with echelon color coding, source labels, and annotation support.
 */

import type {
  InheritedDocument,
  InheritedGraphSummary,
  InheritanceAnnotation,
} from '../../lib/inheritance-service.ts';
import { ECHELON_COLORS } from '../../lib/inheritance-service.ts';
import './InheritedItemCard.css';

type Echelon = 'strategic' | 'operational' | 'tactical';

function isDocument(
  item: InheritedDocument | InheritedGraphSummary,
): item is InheritedDocument {
  return 'title' in item && 'docType' in item;
}

interface InheritedItemCardProps {
  item: InheritedDocument | InheritedGraphSummary;
  echelon: Echelon;
  onAnnotate?: (itemId: string) => void;
  onRequestInfo?: (itemId: string) => void;
  onRequestModification?: (itemId: string) => void;
  onRequestGuidance?: (itemId: string) => void;
  annotations?: InheritanceAnnotation[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function InheritedItemCard({
  item,
  echelon,
  onAnnotate,
  onRequestInfo,
  onRequestModification,
  onRequestGuidance,
  annotations,
  isExpanded,
  onToggleExpand,
}: InheritedItemCardProps) {
  const colors = ECHELON_COLORS[echelon];
  const doc = isDocument(item) ? item : null;
  const graph = !doc ? (item as InheritedGraphSummary) : null;

  const itemId = doc ? doc.id : graph!.containerName;
  const title = doc ? doc.title : graph!.containerName;
  const summary = doc
    ? doc.summary
    : typeof graph!.summary === 'string'
      ? graph!.summary
      : JSON.stringify(graph!.summary, null, 2);
  const lastUpdated = doc ? doc.lastUpdated : graph!.lastUpdated;
  const sourceName = doc
    ? doc.sourceProblemSetName
    : graph!.sourceProblemSetName;

  const hasStaleAnnotations =
    annotations?.some((a) => a.isStale) ?? false;

  const annotationCount = annotations?.length ?? 0;

  return (
    <div
      className={`inherited-item-card${isExpanded ? ' expanded' : ''}`}
      style={{
        borderLeftColor: colors.border,
        backgroundColor: colors.bg,
      }}
      onClick={onToggleExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggleExpand?.();
      }}
    >
      {/* Read-only indicator */}
      <div className="inherited-readonly-indicator">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.5">
          <rect x="3" y="8" width="10" height="7" rx="1" />
          <path d="M5 8V5a3 3 0 016 0v3" />
        </svg>
        <span className="inherited-readonly-label">Inherited -- Read Only</span>
      </div>

      {/* Header */}
      <div className="inherited-item-header">
        <span
          className="echelon-badge"
          style={{ backgroundColor: colors.border }}
        >
          {colors.label}
        </span>

        {doc?.docType && (
          <span className="doc-type-badge">{doc.docType}</span>
        )}

        {doc?.isNew && <span className="status-badge new-badge">New</span>}
        {doc?.isUpdated && (
          <span className="status-badge updated-badge">Updated</span>
        )}

        <span className="source-label">
          From: {sourceName} ({colors.label})
        </span>
      </div>

      {/* Title */}
      <h4 className="inherited-item-title">{title}</h4>

      {/* Summary */}
      <p
        className={`inherited-item-summary${!isExpanded ? ' truncated' : ''}`}
      >
        {summary}
      </p>

      {/* Last updated */}
      <span className="inherited-item-timestamp">
        Updated: {new Date(lastUpdated).toLocaleString()}
      </span>

      {/* Stale annotation warning */}
      {hasStaleAnnotations && (
        <div className="stale-annotation-warning">
          Based on previous version -- annotations may need review
        </div>
      )}

      {/* Annotations inline list */}
      {annotationCount > 0 && (
        <div className="inherited-item-annotations">
          <span className="annotation-count-badge">
            {annotationCount} annotation{annotationCount !== 1 ? 's' : ''}
          </span>
          {isExpanded &&
            annotations!.map((ann) => (
              <div
                key={ann.id}
                className={`annotation-inline${ann.isStale ? ' stale' : ''}`}
              >
                <span className="annotation-author">{ann.createdBy}</span>
                <span className="annotation-text">{ann.content}</span>
                {ann.isStale && (
                  <span className="stale-tag">Previous version</span>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="inherited-item-actions">
        {onAnnotate && (
          <button
            className="action-btn annotate-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAnnotate(itemId);
            }}
            title="Add annotation"
          >
            Annotate
          </button>
        )}
        {onRequestInfo && (
          <button
            className="action-btn rfi-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRequestInfo(itemId);
            }}
            title="Request information"
          >
            Request Info
          </button>
        )}
        {onRequestModification && (
          <button
            className="action-btn mod-request-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRequestModification(itemId);
            }}
            title="Request modification to this inherited item"
          >
            Request Modification
          </button>
        )}
        {onRequestGuidance && (
          <button
            className="action-btn guidance-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRequestGuidance(itemId);
            }}
            title="Request guidance from parent echelon"
          >
            Request Guidance
          </button>
        )}
      </div>
    </div>
  );
}

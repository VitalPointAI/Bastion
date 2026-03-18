/**
 * IngestItemStatus — Per-item inline status chip for the UniversalInputZone
 *
 * Phase 50 Plan 03. Shows the current status of a single ingest item with
 * appropriate icon, progress bar, and action buttons (retry/dismiss).
 */

import React from 'react';
import type { IngestItem } from './hooks/useUniversalIngest.js';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IngestItemStatusProps {
  item: IngestItem;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

// ─── Status icons (text-based, no icon library dep) ──────────────────────────

function StatusIcon({ status }: { status: IngestItem['status'] }) {
  switch (status) {
    case 'queued':
      return <span aria-hidden="true">○</span>;
    case 'classifying':
    case 'processing':
      return <span aria-hidden="true" className="ingest-item-status__spinner">◌</span>;
    case 'routing':
      return <span aria-hidden="true">→</span>;
    case 'complete':
      return <span aria-hidden="true">✓</span>;
    case 'error':
      return <span aria-hidden="true">✕</span>;
    default:
      return null;
  }
}

function statusLabel(status: IngestItem['status']): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'classifying': return 'Classifying';
    case 'routing': return 'Routing';
    case 'processing': return 'Processing';
    case 'complete': return 'Complete';
    case 'error': return 'Error';
    default: return status;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IngestItemStatus({ item, onRetry, onDismiss }: IngestItemStatusProps) {
  const { id, label, status, progress, error, retryCount } = item;

  // Truncate label to ~40 chars for display
  const displayLabel = label.length > 40 ? `${label.slice(0, 40)}…` : label;

  const showRetry = status === 'error' && retryCount < 3;
  const showDismiss = status === 'complete' || status === 'error';

  return (
    <div className={`ingest-item-status ingest-item-status--${status}`}>
      {/* Status icon + label */}
      <div className="ingest-item-status__content">
        <StatusIcon status={status} />
        <span className="ingest-item-status__label" title={label}>
          {displayLabel}
        </span>
        {/* Status text — screen reader readable */}
        <span
          role="status"
          aria-live="polite"
          className="ingest-item-status__status-text"
        >
          {statusLabel(status)}
          {status === 'processing' && progress > 0 && ` ${Math.round(progress * 100)}%`}
        </span>
        {/* Error message */}
        {error && status === 'error' && (
          <span className="ingest-item-status__error">{error}</span>
        )}
      </div>

      {/* Progress bar for processing state */}
      {status === 'processing' && (
        <div className="ingest-process-bar-track ingest-item-status__progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="ingest-process-bar-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Action buttons */}
      {(showRetry || showDismiss) && (
        <div className="ingest-item-status__actions">
          {showRetry && (
            <button
              type="button"
              className="ingest-item-status__btn ingest-item-status__btn--retry"
              aria-label="Retry"
              onClick={() => onRetry(id)}
            >
              ↺
            </button>
          )}
          {showDismiss && (
            <button
              type="button"
              className="ingest-item-status__btn ingest-item-status__btn--dismiss"
              aria-label="Dismiss"
              onClick={() => onDismiss(id)}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

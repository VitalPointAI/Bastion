/**
 * ChannelEvent
 *
 * Phase 16 Plan 05: Single AI channel event renderer with type-specific visual treatment.
 * Each event type has a distinct icon, color coding, and layout.
 *
 * The `review_required` event type is the most prominent — rendered as an amber card
 * with a "Review Now" CTA button that calls onReviewAction(event.runId!).
 */

import './ChannelEvent.css';
import type { AIChannelEvent } from '../../types/exercise';

interface ChannelEventProps {
  event: AIChannelEvent;
  onReviewAction?: (runId: string) => void;
}

function getEventIcon(eventType: AIChannelEvent['eventType']): string {
  switch (eventType) {
    case 'task_started':      return '▶';
    case 'task_progress':     return '◌';
    case 'draft_ready':       return '✓';
    case 'review_required':   return '⚑';
    case 'revision_requested': return '↺';
    case 'approved':          return '✔';
    case 'rejected':          return '✗';
    case 'waiting_on_role':   return '⏳';
    case 'ai_to_ai_request':  return '→';
    case 'ai_to_ai_response': return '←';
    case 'error':             return '⚠';
    case 'paused':            return '⏸';
    case 'resumed':           return '▶';
    default:                  return '•';
  }
}

function renderEventBody(
  event: AIChannelEvent,
  onReviewAction?: (runId: string) => void,
): React.ReactNode {
  const p = event.payload;

  switch (event.eventType) {
    case 'task_started':
      return (
        <div className="ce-content">
          <span className="ce-primary">Started: {String(p.taskName ?? 'task')}</span>
          {event.agentName && (
            <span className="ce-sub">{event.agentName}</span>
          )}
        </div>
      );

    case 'task_progress':
      return (
        <div className="ce-content">
          <span className="ce-primary">
            {event.agentName ? `${event.agentName}: ` : ''}
            {String(p.description ?? '')}
          </span>
        </div>
      );

    case 'draft_ready':
      return (
        <div className="ce-content">
          <span className="ce-primary">Draft ready for review</span>
          {!!p.productType && (
            <span className="ce-sub">{String(p.productType)}</span>
          )}
        </div>
      );

    case 'review_required': {
      const isEscalated = p.escalated === true;
      return (
        <div className="ce-review-card">
          <div className="ce-review-header">
            <span className="ce-review-title">
              Review Required
              {p.productType ? ` — ${String(p.productType)}` : ''}
            </span>
            {isEscalated && (
              <span className="ce-escalated-badge">Escalated — max iterations reached</span>
            )}
          </div>
          {onReviewAction && event.runId && (
            <button
              className="ce-review-btn"
              onClick={() => onReviewAction(event.runId!)}
              aria-label="Open product review panel"
            >
              Review Now
            </button>
          )}
        </div>
      );
    }

    case 'revision_requested': {
      const notes = p.notes ? String(p.notes) : '';
      const truncated = notes.length > 120 ? notes.slice(0, 117) + '...' : notes;
      return (
        <div className="ce-content">
          <span className="ce-primary">Revision requested</span>
          {truncated && <span className="ce-sub">{truncated}</span>}
        </div>
      );
    }

    case 'approved':
      return (
        <div className="ce-content">
          <span className="ce-primary">Approved and published</span>
          {!!p.productType && (
            <span className="ce-sub">{String(p.productType)}</span>
          )}
        </div>
      );

    case 'rejected':
      return (
        <div className="ce-content">
          <span className="ce-primary">Rejected</span>
          {!!p.reason && <span className="ce-sub">{String(p.reason)}</span>}
        </div>
      );

    case 'waiting_on_role':
      return (
        <div className="ce-content">
          <span className="ce-primary">
            Waiting on {String(p.waitingFor ?? 'role')}: {String(p.whatNeeded ?? '')}
          </span>
        </div>
      );

    case 'ai_to_ai_request':
      return (
        <div className="ce-content">
          <span className="ce-primary">
            → {String(p.targetRole ?? '')}: {String(p.requestType ?? '')}
          </span>
        </div>
      );

    case 'ai_to_ai_response':
      return (
        <div className="ce-content">
          <span className="ce-primary">
            ← {String(p.sourceRole ?? '')}: responded
          </span>
        </div>
      );

    case 'error':
      return (
        <div className="ce-content">
          <span className="ce-primary">Error: {String(p.message ?? 'unknown error')}</span>
        </div>
      );

    case 'paused':
      return (
        <div className="ce-content">
          <span className="ce-primary">Execution paused</span>
        </div>
      );

    case 'resumed':
      return (
        <div className="ce-content">
          <span className="ce-primary">Execution resumed</span>
        </div>
      );

    default:
      return (
        <div className="ce-content">
          <span className="ce-primary">{event.eventType}</span>
        </div>
      );
  }
}

export function ChannelEvent({ event, onReviewAction }: ChannelEventProps) {
  const timestamp = new Date(event.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={`channel-event ce-${event.eventType}`}>
      <div className="ce-meta">
        <span className="ce-icon" aria-hidden="true">{getEventIcon(event.eventType)}</span>
        <span className="ce-time">{timestamp}</span>
        {event.agentName && event.eventType !== 'task_started' && (
          <span className="ce-agent">{event.agentName}</span>
        )}
      </div>
      <div className="ce-body">
        {renderEventBody(event, onReviewAction)}
      </div>
    </div>
  );
}

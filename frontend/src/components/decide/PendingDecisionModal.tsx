/**
 * PendingDecisionModal
 *
 * Modal overlay for acting on a decision: approve, reject, defer, or request more info.
 * Shows decision title, description, context key-value pairs, and RACI role info.
 *
 * Phase 53 Plan 05.
 */

import { useState } from 'react';
import type { Decision, ActOnDecisionParams } from '../../lib/decision-service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingDecisionModalProps {
  decision: Decision;
  /** Pre-selected action (opened from a specific action button) */
  initialAction?: ActOnDecisionParams['action'];
  /** Called when user confirms an action */
  onConfirm: (comment?: string) => Promise<void>;
  onClose: () => void;
}

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  ActOnDecisionParams['action'],
  { label: string; color: string; bg: string; border: string; requiresComment?: boolean }
> = {
  approve: {
    label: 'Approve',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.4)',
  },
  reject: {
    label: 'Reject',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    requiresComment: false,
  },
  defer: {
    label: 'Defer',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.4)',
    requiresComment: false,
  },
  info: {
    label: 'Request More Info',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.15)',
    border: 'rgba(96, 165, 250, 0.4)',
    requiresComment: false,
  },
};

// ─── PendingDecisionModal ─────────────────────────────────────────────────────

export function PendingDecisionModal({
  decision,
  initialAction,
  onConfirm,
  onClose,
}: PendingDecisionModalProps) {
  const [selectedAction, setSelectedAction] = useState<ActOnDecisionParams['action']>(
    initialAction ?? 'approve',
  );
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const actionCfg = ACTION_CONFIG[selectedAction];

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm(comment || undefined);
    } finally {
      setSubmitting(false);
    }
  }

  // Render context as key-value pairs
  const contextEntries = decision.context
    ? Object.entries(decision.context).filter(([, v]) => v !== null && v !== undefined)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, 95vw)',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--surface-primary, #0f172a)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '0.75rem',
          zIndex: 1001,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem' }}>
              Decision Required
            </div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
              {decision.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #94a3b8)',
              padding: '0.25rem',
              fontSize: '1.25rem',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Type badge */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--text-secondary, #94a3b8)',
            background: 'var(--surface-secondary, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '9999px',
            padding: '0.125rem 0.625rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {decision.decision_type.replace(/_/g, ' ')}
          </span>
          {decision.requested_by && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', alignSelf: 'center' }}>
              Requested by {decision.requested_by}
            </span>
          )}
        </div>

        {/* Description */}
        {decision.description && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-primary, #e2e8f0)', lineHeight: 1.6 }}>
            {decision.description}
          </div>
        )}

        {/* Context key-value pairs */}
        {contextEntries.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.5rem' }}>
              Context
            </div>
            <div
              style={{
                background: 'var(--surface-secondary, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              {contextEntries.map(([key, value], idx) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderTop: idx > 0 ? '1px solid var(--border-color, #334155)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', minWidth: '120px', textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary, #e2e8f0)' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action selection */}
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.5rem' }}>
            Action
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(Object.keys(ACTION_CONFIG) as ActOnDecisionParams['action'][]).map((action) => {
              const cfg = ACTION_CONFIG[action];
              const isSelected = selectedAction === action;
              return (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  style={{
                    padding: '0.375rem 0.875rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: isSelected ? cfg.bg : 'transparent',
                    color: isSelected ? cfg.color : 'var(--text-secondary, #94a3b8)',
                    border: `1px solid ${isSelected ? cfg.border : 'var(--border-color, #334155)'}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment field */}
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.5rem' }}>
            Comment {selectedAction !== 'approve' ? '(recommended)' : '(optional)'}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              selectedAction === 'reject'
                ? 'Reason for rejection...'
                : selectedAction === 'defer'
                ? 'Reason for deferral...'
                : selectedAction === 'info'
                ? 'What additional information is needed?'
                : 'Any notes for this approval...'
            }
            rows={3}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              fontSize: '0.875rem',
              background: 'var(--surface-secondary, #1e293b)',
              color: 'var(--text-primary, #e2e8f0)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '0.375rem',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Confirm / Cancel */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: 'var(--text-secondary, #94a3b8)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: actionCfg.bg,
              color: actionCfg.color,
              border: `1px solid ${actionCfg.border}`,
              borderRadius: '0.5rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting...' : `Confirm ${actionCfg.label}`}
          </button>
        </div>
      </div>
    </>
  );
}

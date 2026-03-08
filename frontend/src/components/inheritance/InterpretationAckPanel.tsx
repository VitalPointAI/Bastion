/**
 * InterpretationAckPanel
 *
 * Phase 38 Plan 05: Parent view of child interpretations with 3-action response
 * (acknowledge, clarify, correct). Allows parent problem set commanders to
 * review child interpretations of inherited context and respond.
 */

import { useState, useCallback } from 'react';
import type { InheritanceAnnotation } from '../../lib/inheritance-service.ts';
import { inheritanceApi } from '../../lib/inheritance-service.ts';

interface InterpretationAckPanelProps {
  parentProblemSetId: string;
  childAnnotations: InheritanceAnnotation[];
  onActionComplete: () => void;
}

type AckAction = 'acknowledge' | 'clarify' | 'correct';

interface ActionRecord {
  action: AckAction;
  comment?: string;
  timestamp: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ACTION_LABELS: Record<AckAction, string> = {
  acknowledge: 'Acknowledged',
  clarify: 'Clarification Sent',
  correct: 'Correction Sent',
};

const ACTION_COLORS: Record<AckAction, { bg: string; text: string; border: string }> = {
  acknowledge: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.4)' },
  clarify: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.4)' },
  correct: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' },
};

export function InterpretationAckPanel({
  parentProblemSetId,
  childAnnotations,
  onActionComplete,
}: InterpretationAckPanelProps) {
  const [completedActions, setCompletedActions] = useState<Record<string, ActionRecord>>({});
  const [activeInput, setActiveInput] = useState<{ id: string; action: AckAction } | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = useCallback(async (annotationId: string, action: AckAction, actionComment?: string) => {
    try {
      setSubmitting(true);
      setError(null);
      await inheritanceApi.acknowledgeAnnotation(parentProblemSetId, annotationId, action, actionComment);
      setCompletedActions(prev => ({
        ...prev,
        [annotationId]: {
          action,
          comment: actionComment,
          timestamp: new Date().toISOString(),
        },
      }));
      setActiveInput(null);
      setComment('');
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  }, [parentProblemSetId, onActionComplete]);

  if (childAnnotations.length === 0) {
    return (
      <div style={{
        padding: '24px 16px',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.85rem',
        fontStyle: 'italic',
        fontFamily: 'monospace',
      }}>
        No child interpretations pending review
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        fontSize: '13px',
        fontWeight: 600,
        color: '#e5e7eb',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Child Interpretations ({childAnnotations.length})
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          margin: '8px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #7f1d1d',
          borderRadius: '4px',
          color: '#fca5a5',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {childAnnotations.map((annotation) => {
          const completed = completedActions[annotation.id];
          const isInputOpen = activeInput?.id === annotation.id;

          return (
            <div
              key={annotation.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(100, 100, 100, 0.2)',
                backgroundColor: completed ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
              }}
            >
              {/* Header: child PS name + date */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <span style={{
                  fontSize: '11px',
                  color: '#999',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(100, 100, 100, 0.2)',
                }}>
                  {annotation.problemSetId.slice(0, 12)}...
                </span>
                <span style={{ fontSize: '10px', color: '#666' }}>
                  {relativeTime(annotation.createdAt)}
                </span>
              </div>

              {/* Target item */}
              <div style={{
                fontSize: '11px',
                color: '#777',
                marginBottom: '4px',
              }}>
                Re: {annotation.targetItemType?.replace('_', ' ')} | {annotation.targetItemId.slice(0, 20)}
              </div>

              {/* Interpretation content */}
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#ddd',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                marginBottom: '8px',
              }}>
                {annotation.content}
              </div>

              {/* Action area */}
              {completed ? (
                /* Already responded */
                <div style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: ACTION_COLORS[completed.action].bg,
                  border: `1px solid ${ACTION_COLORS[completed.action].border}`,
                  fontSize: '11px',
                }}>
                  <span style={{ color: ACTION_COLORS[completed.action].text, fontWeight: 600 }}>
                    {ACTION_LABELS[completed.action]}
                  </span>
                  <span style={{ color: '#777', marginLeft: '8px' }}>
                    {relativeTime(completed.timestamp)}
                  </span>
                  {completed.comment && (
                    <div style={{ color: '#bbb', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                      {completed.comment}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleAction(annotation.id, 'acknowledge')}
                      disabled={submitting}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        borderRadius: '3px',
                        color: '#4ade80',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => {
                        setActiveInput({ id: annotation.id, action: 'clarify' });
                        setComment('');
                      }}
                      disabled={submitting}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        backgroundColor: isInputOpen && activeInput?.action === 'clarify'
                          ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        borderRadius: '3px',
                        color: '#eab308',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      Clarify
                    </button>
                    <button
                      onClick={() => {
                        setActiveInput({ id: annotation.id, action: 'correct' });
                        setComment('');
                      }}
                      disabled={submitting}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        backgroundColor: isInputOpen && activeInput?.action === 'correct'
                          ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '3px',
                        color: '#f87171',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      Correct
                    </button>
                  </div>

                  {/* Inline comment input for clarify/correct */}
                  {isInputOpen && (
                    <div style={{ marginTop: '8px' }}>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={
                          activeInput.action === 'clarify'
                            ? 'Provide clarification...'
                            : 'Provide correction guidance...'
                        }
                        rows={3}
                        style={{
                          width: '100%',
                          backgroundColor: '#0d0d1a',
                          border: `1px solid ${ACTION_COLORS[activeInput.action].border}`,
                          borderRadius: '3px',
                          color: '#e0e0e0',
                          padding: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                          onClick={() => handleAction(annotation.id, activeInput.action, comment.trim())}
                          disabled={submitting || !comment.trim()}
                          style={{
                            padding: '4px 14px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            backgroundColor: submitting || !comment.trim()
                              ? '#333' : ACTION_COLORS[activeInput.action].bg,
                            border: `1px solid ${submitting || !comment.trim()
                              ? '#444' : ACTION_COLORS[activeInput.action].border}`,
                            borderRadius: '3px',
                            color: submitting || !comment.trim()
                              ? '#666' : ACTION_COLORS[activeInput.action].text,
                            cursor: submitting || !comment.trim() ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {submitting ? 'Submitting...' : `Send ${activeInput.action === 'clarify' ? 'Clarification' : 'Correction'}`}
                        </button>
                        <button
                          onClick={() => {
                            setActiveInput(null);
                            setComment('');
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            color: '#888',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

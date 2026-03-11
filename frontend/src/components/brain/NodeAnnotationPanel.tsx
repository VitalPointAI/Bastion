/**
 * NodeAnnotationPanel — annotation CRUD UI for a single brain node.
 *
 * Renders three quick-action buttons (flag / note / questionable) and a list
 * of existing annotations with audit trail, share toggle, and delete.
 *
 * Designed to live inside BrainDetailPanel's right panel.
 */

import React, { useState } from 'react';
import type { BrainAnnotation, BrainNodeType } from './types.js';
import './NodeAnnotationPanel.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NodeAnnotationPanelProps {
  nodeId: string;
  nodeType: BrainNodeType;
  annotations: BrainAnnotation[];
  onCreate: (input: { annotationType: string; content?: string; isShared?: boolean }) => void;
  onUpdate: (id: string, input: { content?: string; isShared?: boolean }) => void;
  onDelete: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAuditTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function AnnotationTypeIcon({ type }: { type: BrainAnnotation['annotationType'] }): React.ReactElement {
  if (type === 'flag') return <span title="Flag" aria-label="flag">&#9873;</span>;
  if (type === 'note') return <span title="Note" aria-label="note">&#9998;</span>;
  // questionable
  return <span title="Questionable" aria-label="questionable">&#63;</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NodeAnnotationPanel({
  nodeId: _nodeId,
  nodeType: _nodeType,
  annotations,
  onCreate,
  onUpdate,
  onDelete,
}: NodeAnnotationPanelProps): React.ReactElement {
  // "note" quick-action — expand a text input
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  // "questionable" quick-action — expand optional note input
  const [questionableExpanded, setQuestionableExpanded] = useState(false);
  const [questionableContent, setQuestionableContent] = useState('');

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFlag(): void {
    onCreate({ annotationType: 'flag' });
  }

  function handleNoteSubmit(): void {
    if (noteContent.trim()) {
      onCreate({ annotationType: 'note', content: noteContent.trim() });
      setNoteContent('');
      setNoteExpanded(false);
    }
  }

  function handleQuestionableSubmit(): void {
    onCreate({
      annotationType: 'questionable',
      content: questionableContent.trim() || undefined,
    });
    setQuestionableContent('');
    setQuestionableExpanded(false);
  }

  function handleShareToggle(annotation: BrainAnnotation): void {
    onUpdate(annotation.id, { isShared: !annotation.isShared });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="annotation-panel">
      {/* Quick-action buttons */}
      <div className="annotation-actions">
        <button
          type="button"
          className="annotation-action-btn"
          onClick={handleFlag}
          title="Add flag annotation"
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#9873;</span>
          Flag
        </button>

        <button
          type="button"
          className="annotation-action-btn"
          onClick={() => {
            setNoteExpanded((v) => !v);
            setQuestionableExpanded(false);
          }}
          title="Add note annotation"
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#9998;</span>
          Note
        </button>

        <button
          type="button"
          className="annotation-action-btn"
          onClick={() => {
            setQuestionableExpanded((v) => !v);
            setNoteExpanded(false);
          }}
          title="Mark as questionable"
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#63;</span>
          Questionable
        </button>
      </div>

      {/* Note input expansion */}
      {noteExpanded && (
        <div style={{ marginBottom: '0.5rem' }}>
          <textarea
            className="annotation-note-input"
            placeholder="Enter note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="annotation-action-btn"
              onClick={handleNoteSubmit}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Save Note
            </button>
            <button
              type="button"
              className="annotation-action-btn"
              onClick={() => { setNoteExpanded(false); setNoteContent(''); }}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Questionable input expansion */}
      {questionableExpanded && (
        <div style={{ marginBottom: '0.5rem' }}>
          <textarea
            className="annotation-note-input"
            placeholder="Optional: describe why this is questionable..."
            value={questionableContent}
            onChange={(e) => setQuestionableContent(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="annotation-action-btn"
              onClick={handleQuestionableSubmit}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Mark Questionable
            </button>
            <button
              type="button"
              className="annotation-action-btn"
              onClick={() => { setQuestionableExpanded(false); setQuestionableContent(''); }}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing annotations list */}
      {annotations.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
          No annotations on this node
        </p>
      ) : (
        <div className="annotation-list">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`annotation-item annotation-item--${annotation.annotationType}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <AnnotationTypeIcon type={annotation.annotationType} />
                  {annotation.content && (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>
                      {annotation.content}
                    </span>
                  )}
                  {!annotation.content && (
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                      {annotation.annotationType === 'flag' ? 'Flagged' : annotation.annotationType === 'questionable' ? 'Marked questionable' : ''}
                    </span>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => onDelete(annotation.id)}
                  title="Delete annotation"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,100,100,0.6)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '0 0.25rem',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  &#10005;
                </button>
              </div>

              {/* Audit trail */}
              <div className="annotation-meta">
                Created by {annotation.createdBy} &middot; {formatAuditTime(annotation.createdAt)}
              </div>

              {/* Share toggle */}
              <label className="annotation-share-toggle">
                <input
                  type="checkbox"
                  checked={annotation.isShared}
                  onChange={() => handleShareToggle(annotation)}
                  style={{ accentColor: '#4a9eff' }}
                />
                Share with problem set
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AnnotationPanel
 *
 * Phase 26 Plan 04: Slide-out panel for managing annotations on inherited
 * context items. Supports inline annotations and Commander's Interpretation
 * documents. Shows stale warnings when source content has been updated.
 */

import { useState, useEffect, useCallback } from 'react';
import type { InheritanceAnnotation } from '../../lib/inheritance-service.ts';
import { inheritanceApi, ECHELON_COLORS } from '../../lib/inheritance-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Echelon = 'strategic' | 'operational' | 'tactical';

interface AnnotationPanelProps {
  problemSetId: string;
  sourceProblemSetId: string;
  targetItemId: string;
  targetItemType: 'strategic_document' | 'graph_summary';
  /** Display title for the target item */
  itemTitle?: string;
  /** Echelon of the source problem set */
  sourceEchelon?: Echelon;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abbreviateDid(did: string): string {
  if (!did) return 'Unknown';
  if (did.length <= 16) return did;
  return `${did.slice(0, 8)}...${did.slice(-6)}`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnotationPanel({
  problemSetId,
  sourceProblemSetId,
  targetItemId,
  targetItemType,
  itemTitle,
  sourceEchelon = 'strategic',
  onClose,
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<InheritanceAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New inline annotation form
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Editing state: annotationId -> draft content
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Commander's Interpretation
  const [interpretationDraft, setInterpretationDraft] = useState('');
  const [editingInterpretation, setEditingInterpretation] = useState(false);
  const [submittingInterpretation, setSubmittingInterpretation] = useState(false);

  const colors = ECHELON_COLORS[sourceEchelon];

  // -------------------------------------------------------------------------
  // Fetch annotations
  // -------------------------------------------------------------------------

  const fetchAnnotations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inheritanceApi.getAnnotations(problemSetId, targetItemId);
      setAnnotations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load annotations');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, targetItemId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  // -------------------------------------------------------------------------
  // Derived: split annotations into inline vs interpretation
  // We use a convention: annotations whose content starts with
  // "[INTERPRETATION]" are Commander's Interpretations. This allows us to
  // work within the existing API which has no annotationType field.
  // -------------------------------------------------------------------------

  const INTERPRETATION_PREFIX = '[INTERPRETATION] ';

  const inlineAnnotations = annotations.filter(
    (a) => !a.content.startsWith(INTERPRETATION_PREFIX),
  );
  const interpretation = annotations.find((a) =>
    a.content.startsWith(INTERPRETATION_PREFIX),
  );

  // -------------------------------------------------------------------------
  // Add inline annotation
  // -------------------------------------------------------------------------

  async function handleAddAnnotation() {
    if (!newContent.trim()) return;
    try {
      setSubmitting(true);
      await inheritanceApi.createAnnotation(problemSetId, {
        targetItemId,
        targetItemType,
        content: newContent.trim(),
      });
      setNewContent('');
      await fetchAnnotations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add annotation');
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Edit annotation
  // -------------------------------------------------------------------------

  function startEditing(ann: InheritanceAnnotation) {
    setEditingId(ann.id);
    setEditContent(ann.content);
  }

  async function handleSaveEdit() {
    if (!editingId || !editContent.trim()) return;
    try {
      await inheritanceApi.updateAnnotation(problemSetId, editingId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      await fetchAnnotations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update annotation');
    }
  }

  function cancelEditing() {
    setEditingId(null);
    setEditContent('');
  }

  // -------------------------------------------------------------------------
  // Commander's Interpretation CRUD
  // -------------------------------------------------------------------------

  async function handleCreateInterpretation() {
    if (!interpretationDraft.trim()) return;
    try {
      setSubmittingInterpretation(true);
      await inheritanceApi.createAnnotation(problemSetId, {
        targetItemId,
        targetItemType,
        content: INTERPRETATION_PREFIX + interpretationDraft.trim(),
      });
      setInterpretationDraft('');
      setEditingInterpretation(false);
      await fetchAnnotations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save interpretation');
    } finally {
      setSubmittingInterpretation(false);
    }
  }

  async function handleUpdateInterpretation() {
    if (!interpretation || !interpretationDraft.trim()) return;
    try {
      setSubmittingInterpretation(true);
      await inheritanceApi.updateAnnotation(
        problemSetId,
        interpretation.id,
        INTERPRETATION_PREFIX + interpretationDraft.trim(),
      );
      setEditingInterpretation(false);
      setInterpretationDraft('');
      await fetchAnnotations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update interpretation');
    } finally {
      setSubmittingInterpretation(false);
    }
  }

  function startEditingInterpretation() {
    if (interpretation) {
      setInterpretationDraft(
        interpretation.content.replace(INTERPRETATION_PREFIX, ''),
      );
    }
    setEditingInterpretation(true);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '440px',
        height: '100vh',
        backgroundColor: '#1a1a2e',
        borderLeft: `3px solid ${colors.border}`,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          backgroundColor: colors.bg,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            Annotations
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0 4px',
              }}
              title="Close panel"
            >
              x
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '6px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: colors.border,
              color: '#000',
              marginRight: '6px',
            }}
          >
            {colors.label}
          </span>
          {itemTitle || targetItemId}
        </div>
        <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
          Source: {sourceProblemSetId.slice(0, 12)}... | Type: {targetItemType.replace('_', ' ')}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Loading / Error */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Loading annotations...
          </div>
        )}
        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(239,68,68,0.15)',
              border: '1px solid #7f1d1d',
              borderRadius: '4px',
              color: '#fca5a5',
              fontSize: '12px',
              marginBottom: '12px',
            }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '8px',
                background: 'none',
                border: 'none',
                color: '#fca5a5',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '12px',
              }}
            >
              dismiss
            </button>
          </div>
        )}

        {!loading && (
          <>
            {/* ============================================================= */}
            {/* Section 1: Inline Annotations                                  */}
            {/* ============================================================= */}
            <div style={{ marginBottom: '24px' }}>
              <h4
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#888',
                  marginBottom: '10px',
                  letterSpacing: '0.5px',
                }}
              >
                Inline Annotations ({inlineAnnotations.length})
              </h4>

              {/* Annotation list */}
              {inlineAnnotations.length === 0 && (
                <div style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
                  No annotations yet. Add one below.
                </div>
              )}

              {inlineAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: ann.isStale
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ann.isStale ? '#92400e' : '#333'}`,
                    borderRadius: '4px',
                  }}
                >
                  {/* Stale warning */}
                  {ann.isStale && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}
                    >
                      Based on previous version -- review and update or dismiss
                    </div>
                  )}

                  {/* Author and timestamp */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#777',
                      marginBottom: '4px',
                    }}
                  >
                    <span>{abbreviateDid(ann.createdBy)}</span>
                    <span>{formatTimestamp(ann.createdAt)}</span>
                  </div>

                  {/* Content or edit form */}
                  {editingId === ann.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          backgroundColor: '#0d0d1a',
                          border: '1px solid #444',
                          borderRadius: '3px',
                          color: '#e0e0e0',
                          padding: '6px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            padding: '3px 10px',
                            fontSize: '11px',
                            backgroundColor: '#2563eb',
                            border: 'none',
                            borderRadius: '3px',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          style={{
                            padding: '3px 10px',
                            fontSize: '11px',
                            backgroundColor: 'transparent',
                            border: '1px solid #555',
                            borderRadius: '3px',
                            color: '#aaa',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#ddd',
                          lineHeight: '1.5',
                          flex: 1,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {ann.content}
                      </div>
                      <button
                        onClick={() => startEditing(ann)}
                        title="Edit annotation"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#666',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '0 4px',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}
                      >
                        edit
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Quick-add form */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid #333',
                  borderRadius: '4px',
                }}
              >
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Add an annotation..."
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: '#0d0d1a',
                    border: '1px solid #444',
                    borderRadius: '3px',
                    color: '#e0e0e0',
                    padding: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={handleAddAnnotation}
                  disabled={submitting || !newContent.trim()}
                  style={{
                    marginTop: '6px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    backgroundColor: submitting || !newContent.trim() ? '#333' : '#2563eb',
                    border: 'none',
                    borderRadius: '3px',
                    color: submitting || !newContent.trim() ? '#666' : '#fff',
                    cursor: submitting || !newContent.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  {submitting ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* ============================================================= */}
            {/* Section 2: Commander's Interpretation                           */}
            {/* ============================================================= */}
            <div>
              <h4
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#888',
                  marginBottom: '10px',
                  letterSpacing: '0.5px',
                  borderTop: '1px solid #333',
                  paddingTop: '16px',
                }}
              >
                Commander's Interpretation
              </h4>

              {interpretation ? (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: interpretation.isStale
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(59,130,246,0.06)',
                    border: `1px solid ${interpretation.isStale ? '#92400e' : '#1e40af'}`,
                    borderRadius: '4px',
                  }}
                >
                  {/* Stale warning */}
                  {interpretation.isStale && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        marginBottom: '8px',
                        fontWeight: 500,
                      }}
                    >
                      Based on previous version -- review and update or dismiss
                    </div>
                  )}

                  {editingInterpretation ? (
                    <div>
                      <textarea
                        value={interpretationDraft}
                        onChange={(e) => setInterpretationDraft(e.target.value)}
                        rows={6}
                        style={{
                          width: '100%',
                          backgroundColor: '#0d0d1a',
                          border: '1px solid #444',
                          borderRadius: '3px',
                          color: '#e0e0e0',
                          padding: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                          onClick={handleUpdateInterpretation}
                          disabled={submittingInterpretation}
                          style={{
                            padding: '5px 14px',
                            fontSize: '12px',
                            backgroundColor: '#2563eb',
                            border: 'none',
                            borderRadius: '3px',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {submittingInterpretation ? 'Saving...' : 'Save Interpretation'}
                        </button>
                        <button
                          onClick={() => setEditingInterpretation(false)}
                          style={{
                            padding: '5px 14px',
                            fontSize: '12px',
                            backgroundColor: 'transparent',
                            border: '1px solid #555',
                            borderRadius: '3px',
                            color: '#aaa',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '11px', color: '#777', marginBottom: '6px' }}>
                        {abbreviateDid(interpretation.createdBy)} | {formatTimestamp(interpretation.updatedAt || interpretation.createdAt)}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#ddd',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {interpretation.content.replace(INTERPRETATION_PREFIX, '')}
                      </div>
                      <button
                        onClick={startEditingInterpretation}
                        style={{
                          marginTop: '8px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          backgroundColor: 'transparent',
                          border: '1px solid #555',
                          borderRadius: '3px',
                          color: '#aaa',
                          cursor: 'pointer',
                        }}
                      >
                        Edit Interpretation
                      </button>
                    </div>
                  )}
                </div>
              ) : editingInterpretation ? (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(59,130,246,0.06)',
                    border: '1px solid #1e40af',
                    borderRadius: '4px',
                  }}
                >
                  <textarea
                    value={interpretationDraft}
                    onChange={(e) => setInterpretationDraft(e.target.value)}
                    placeholder="Write the Commander's Interpretation of this inherited item..."
                    rows={6}
                    style={{
                      width: '100%',
                      backgroundColor: '#0d0d1a',
                      border: '1px solid #444',
                      borderRadius: '3px',
                      color: '#e0e0e0',
                      padding: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      onClick={handleCreateInterpretation}
                      disabled={submittingInterpretation || !interpretationDraft.trim()}
                      style={{
                        padding: '5px 14px',
                        fontSize: '12px',
                        backgroundColor:
                          submittingInterpretation || !interpretationDraft.trim()
                            ? '#333'
                            : '#2563eb',
                        border: 'none',
                        borderRadius: '3px',
                        color:
                          submittingInterpretation || !interpretationDraft.trim()
                            ? '#666'
                            : '#fff',
                        cursor:
                          submittingInterpretation || !interpretationDraft.trim()
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      {submittingInterpretation ? 'Saving...' : 'Save Interpretation'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingInterpretation(false);
                        setInterpretationDraft('');
                      }}
                      style={{
                        padding: '5px 14px',
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        color: '#aaa',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startEditingInterpretation}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    border: '1px dashed #1e40af',
                    borderRadius: '4px',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    width: '100%',
                    fontFamily: 'monospace',
                  }}
                >
                  + Add Commander's Interpretation
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

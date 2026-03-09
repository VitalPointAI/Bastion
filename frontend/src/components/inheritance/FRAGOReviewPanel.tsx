/**
 * FRAGOReviewPanel
 *
 * Phase 38 Plan 06: Commander FRAGO review and child acknowledgment panel.
 *
 * Parent view: Review AI-drafted FRAGOs, edit, approve, distribute.
 * Child view: View received FRAGOs, acknowledge receipt.
 *
 * Uses inline styles per project convention.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  inheritanceApiService,
  type FRAGODraft,
} from '../../services/inheritance-service.js';

// ============================================================================
// Types
// ============================================================================

interface FRAGOReviewPanelProps {
  problemSetId: string;
  isParent: boolean;
}

// ============================================================================
// Status ordering for sort
// ============================================================================

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  approved: 1,
  distributed: 2,
  acknowledged: 3,
};

// ============================================================================
// Severity badge colors
// ============================================================================

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  significant: { bg: '#92400e', text: '#fbbf24' },
  minor: { bg: '#1e3a5f', text: '#60a5fa' },
};

// ============================================================================
// Component
// ============================================================================

export function FRAGOReviewPanel({ problemSetId, isParent }: FRAGOReviewPanelProps) {
  const [fragos, setFragos] = useState<FRAGODraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Fetch FRAGOs
  // --------------------------------------------------------------------------

  const fetchFragos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = isParent
        ? await inheritanceApiService.getFRAGODrafts(problemSetId)
        : await inheritanceApiService.getReceivedFRAGOs(problemSetId);

      // Sort: draft first, then approved, distributed, acknowledged
      data.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
      setFragos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FRAGOs');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, isParent]);

  useEffect(() => {
    fetchFragos();
  }, [fetchFragos]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleApprove = async (fragoId: string, edited?: string) => {
    setActionInProgress(fragoId);
    try {
      await inheritanceApiService.approveFRAGO(problemSetId, fragoId, edited);
      setEditingId(null);
      await fetchFragos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleApproveAndDistribute = async (fragoId: string, edited?: string) => {
    setActionInProgress(fragoId);
    try {
      await inheritanceApiService.approveFRAGO(problemSetId, fragoId, edited);
      await inheritanceApiService.distributeFRAGO(problemSetId, fragoId);
      setEditingId(null);
      await fetchFragos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve & distribute failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDistribute = async (fragoId: string) => {
    setActionInProgress(fragoId);
    try {
      await inheritanceApiService.distributeFRAGO(problemSetId, fragoId);
      await fetchFragos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Distribute failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAcknowledge = async (fragoId: string) => {
    setActionInProgress(fragoId);
    try {
      await inheritanceApiService.acknowledgeFRAGO(problemSetId, fragoId);
      await fetchFragos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acknowledge failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const startEditing = (frago: FRAGODraft) => {
    setEditingId(frago.id);
    setEditContent(frago.editedContent || frago.aiDraftContent);
  };

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  const renderStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: '#92400e', text: '#fbbf24', label: 'Draft' },
      approved: { bg: '#1e3a5f', text: '#60a5fa', label: 'Approved' },
      distributed: { bg: '#4c1d95', text: '#a78bfa', label: 'Awaiting Acknowledgment' },
      acknowledged: { bg: '#064e3b', text: '#34d399', label: 'Acknowledged' },
    };
    const s = styles[status] ?? styles.draft;
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: s.bg,
          color: s.text,
        }}
      >
        {s.label}
      </span>
    );
  };

  const renderParentCard = (frago: FRAGODraft) => {
    const isEditing = editingId === frago.id;
    const isBusy = actionInProgress === frago.id;
    const isDraft = frago.status === 'draft';
    const isApproved = frago.status === 'approved';
    const isDistributed = frago.status === 'distributed';
    const isAcknowledged = frago.status === 'acknowledged';

    const bgColor = isDraft ? '#451a03' : isAcknowledged ? '#022c22' : '#1f2937';

    return (
      <div
        key={frago.id}
        style={{
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
          backgroundColor: bgColor,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>
            Child Mission: {frago.childProblemSetId.slice(0, 12)}...
          </div>
          {renderStatusBadge(frago.status)}
        </div>

        {/* Changed paragraphs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {frago.changedParagraphs.map((p) => {
            const names: Record<number, string> = {
              1: 'Situation',
              2: 'Mission',
              3: 'Execution',
              4: 'Sustainment',
              5: 'Command/Signal',
            };
            const severity = p === 2 || p === 3 || p === 4 ? 'significant' : 'minor';
            const colors = SEVERITY_COLORS[severity];
            return (
              <span
                key={p}
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 500,
                  backgroundColor: colors.bg,
                  color: colors.text,
                }}
              >
                Para {p}: {names[p] ?? `Unknown`}
              </span>
            );
          })}
        </div>

        {/* FRAGO content */}
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '150px',
              backgroundColor: '#111827',
              color: '#d1d5db',
              border: '1px solid #4b5563',
              borderRadius: '6px',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />
        ) : (
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '8px',
              fontSize: '12px',
              color: '#d1d5db',
              whiteSpace: 'pre-wrap',
              maxHeight: '200px',
              overflowY: 'auto',
              fontFamily: 'monospace',
            }}
          >
            {frago.editedContent || frago.aiDraftContent}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isDraft && !isEditing && (
            <>
              <button
                onClick={() => startEditing(frago)}
                disabled={isBusy}
                style={buttonStyle('#374151', '#9ca3af')}
              >
                Edit
              </button>
              <button
                onClick={() => handleApprove(frago.id)}
                disabled={isBusy}
                style={buttonStyle('#1e40af', '#93c5fd')}
              >
                {isBusy ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => handleApproveAndDistribute(frago.id)}
                disabled={isBusy}
                style={buttonStyle('#065f46', '#6ee7b7')}
              >
                {isBusy ? 'Processing...' : 'Approve & Distribute'}
              </button>
            </>
          )}

          {isDraft && isEditing && (
            <>
              <button
                onClick={() => setEditingId(null)}
                disabled={isBusy}
                style={buttonStyle('#374151', '#9ca3af')}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(frago.id, editContent)}
                disabled={isBusy}
                style={buttonStyle('#1e40af', '#93c5fd')}
              >
                {isBusy ? 'Approving...' : 'Approve (Edited)'}
              </button>
              <button
                onClick={() => handleApproveAndDistribute(frago.id, editContent)}
                disabled={isBusy}
                style={buttonStyle('#065f46', '#6ee7b7')}
              >
                {isBusy ? 'Processing...' : 'Approve & Distribute (Edited)'}
              </button>
            </>
          )}

          {isApproved && (
            <button
              onClick={() => handleDistribute(frago.id)}
              disabled={isBusy}
              style={buttonStyle('#065f46', '#6ee7b7')}
            >
              {isBusy ? 'Distributing...' : 'Distribute'}
            </button>
          )}

          {isDistributed && (
            <span style={{ fontSize: '12px', color: '#a78bfa', fontStyle: 'italic' }}>
              Awaiting child acknowledgment...
            </span>
          )}

          {isAcknowledged && (
            <span style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px' }}>&#10003;</span>
              Acknowledged
              {frago.acknowledgedAt && (
                <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>
                  ({new Date(frago.acknowledgedAt).toLocaleString()})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderChildCard = (frago: FRAGODraft) => {
    const isBusy = actionInProgress === frago.id;
    const isDistributed = frago.status === 'distributed';
    const isAcknowledged = frago.status === 'acknowledged';

    return (
      <div
        key={frago.id}
        style={{
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
          backgroundColor: isAcknowledged ? '#022c22' : '#1f2937',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>
            FRAGO from Parent
          </div>
          {renderStatusBadge(frago.status)}
        </div>

        {/* Changed paragraphs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {frago.changedParagraphs.map((p) => {
            const names: Record<number, string> = {
              1: 'Situation', 2: 'Mission', 3: 'Execution', 4: 'Sustainment', 5: 'Command/Signal',
            };
            return (
              <span
                key={p}
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 500,
                  backgroundColor: '#1e3a5f',
                  color: '#60a5fa',
                }}
              >
                Para {p}: {names[p] ?? `Unknown`}
              </span>
            );
          })}
        </div>

        {/* FRAGO content */}
        <div
          style={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#d1d5db',
            whiteSpace: 'pre-wrap',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
          }}
        >
          {frago.editedContent || frago.aiDraftContent}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isDistributed && (
            <button
              onClick={() => handleAcknowledge(frago.id)}
              disabled={isBusy}
              style={buttonStyle('#065f46', '#6ee7b7')}
            >
              {isBusy ? 'Acknowledging...' : 'Acknowledge'}
            </button>
          )}

          {isAcknowledged && (
            <span style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px' }}>&#10003;</span>
              Acknowledged
              {frago.acknowledgedAt && (
                <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>
                  ({new Date(frago.acknowledgedAt).toLocaleString()})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // Main render
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
        Loading FRAGOs...
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e5e7eb', marginBottom: '4px' }}>
        {isParent ? 'FRAGO Review' : 'Received FRAGOs'}
      </h3>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
        {isParent
          ? 'Review AI-drafted fragmentary orders before distribution to subordinate missions.'
          : 'Fragmentary orders received from higher headquarters requiring acknowledgment.'}
      </p>

      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          borderRadius: '6px',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {fragos.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: '#6b7280',
          border: '1px dashed #374151',
          borderRadius: '8px',
        }}>
          No {isParent ? 'FRAGO drafts' : 'received FRAGOs'} at this time.
        </div>
      ) : (
        fragos.map((frago) =>
          isParent ? renderParentCard(frago) : renderChildCard(frago),
        )
      )}
    </div>
  );
}

// ============================================================================
// Shared button style helper
// ============================================================================

function buttonStyle(bg: string, text: string): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: bg,
    color: text,
    cursor: 'pointer',
    opacity: 1,
  };
}

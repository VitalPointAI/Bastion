/**
 * GateProposalModal
 *
 * Contextual proposal creation modal for decision gates.
 * Follows MissionWizard modal overlay pattern (fixed overlay, centered card,
 * header/body/footer sections).
 *
 * Pre-populates form fields from item context so users review/edit before submitting.
 */

import { useState, useCallback } from 'react';
import type { GateProposalContext } from '../../lib/gate-service';
import './GateProposalModal.css';

// ============================================================================
// Gate Type Label Map
// ============================================================================

const GATE_TYPE_LABELS: Record<string, string> = {
  objective_approval: 'Objective Approval',
  operational_approach: 'Operational Approach Approval',
  coa_selection: 'COA Selection',
  order_release: 'Order Release',
  reframing: 'Reframing Decision',
};

// ============================================================================
// Props
// ============================================================================

interface GateProposalModalProps {
  /** The gate type being submitted */
  gateType: string;
  /** Tab where the gate lives */
  tabId: string;
  /** Pre-filled context from the item being submitted */
  prefillContext: {
    title: string;
    description: string;
    metadata: Record<string, unknown>;
  };
  /** DAO ID for the problem set */
  daoId: string;
  /** Called with edited proposal context on submit */
  onSubmit: (proposal: GateProposalContext) => Promise<void>;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function GateProposalModal({
  gateType,
  tabId,
  prefillContext,
  daoId,
  onSubmit,
  onClose,
}: GateProposalModalProps) {
  const [title, setTitle] = useState(prefillContext.title);
  const [description, setDescription] = useState(prefillContext.description);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gateTypeLabel = GATE_TYPE_LABELS[gateType] || gateType;
  const metadataEntries = Object.entries(prefillContext.metadata);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!justification.trim()) {
      setError('Justification is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        metadata: {
          ...prefillContext.metadata,
          justification: justification.trim(),
          gate_type: gateType,
          tab: tabId,
          dao_id: daoId,
        },
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [title, description, justification, prefillContext.metadata, gateType, tabId, daoId, onSubmit, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div className="gate-proposal-overlay" onClick={handleOverlayClick}>
      <div className="gate-proposal-modal">
        {/* Header */}
        <div className="gate-proposal-header">
          <h2>Submit for Approval</h2>
          <span className="gate-type-label">{gateTypeLabel}</span>
          <button
            className="gate-proposal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="gate-proposal-body">
          {error && <div className="gate-proposal-error">{error}</div>}

          <div className="gate-proposal-field">
            <label htmlFor="gate-proposal-title">Title</label>
            <input
              id="gate-proposal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder="Proposal title"
            />
          </div>

          <div className="gate-proposal-field">
            <label htmlFor="gate-proposal-description">Description</label>
            <textarea
              id="gate-proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={4}
              placeholder="Describe what is being proposed"
            />
          </div>

          <div className="gate-proposal-field">
            <label htmlFor="gate-proposal-justification">Justification</label>
            <textarea
              id="gate-proposal-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Provide reasoning for this submission"
            />
          </div>

          {metadataEntries.length > 0 && (
            <div className="gate-proposal-metadata">
              <label>Context</label>
              <div className="metadata-grid">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="metadata-row">
                    <span className="metadata-key">{key}</span>
                    <span className="metadata-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="gate-proposal-footer">
          <button
            className="gate-proposal-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="gate-proposal-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

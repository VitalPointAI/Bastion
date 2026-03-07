/**
 * GateSubmitButton
 *
 * Contextual "Submit for Approval" button placed next to decidable items.
 * Adapts its rendering based on existing gate status:
 * - No gate / pending: shows "Submit for Approval" button
 * - Submitted: shows GateStatusBadge (pending approval)
 * - Approved: shows green checkmark badge
 * - Rejected: shows "Resubmit" button variant
 * - Escalated: shows escalated badge
 *
 * On click, creates a gate (if needed) then opens GateProposalModal
 * pre-populated with item context.
 */

import { useState, useMemo, useCallback } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import { useProblemSet } from '../../context/ProblemSetContext';
import { GateStatus } from '../../lib/gate-service';
import { GateStatusBadge } from './GateStatusBadge';
import { GateProposalModal } from './GateProposalModal';
import './GateSubmitButton.css';

// ============================================================================
// Props
// ============================================================================

interface GateSubmitButtonProps {
  /** Gate type (e.g., 'objective_approval') */
  gateType: string;
  /** ID of the item being submitted */
  itemId: string;
  /** Title of the item (pre-fills proposal title) */
  itemTitle: string;
  /** Description of the item (pre-fills proposal description) */
  itemDescription: string;
  /** Tab where this button lives */
  tabId: string;
  /** Additional metadata to include in proposal context */
  metadata?: Record<string, unknown>;
  /** Optional CSS class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function GateSubmitButton({
  gateType,
  itemId,
  itemTitle,
  itemDescription,
  tabId,
  metadata = {},
  className = '',
}: GateSubmitButtonProps) {
  const { gates, createGate, submitForApproval } = useDecisionGates(tabId);
  const { activeProblemSet } = useProblemSet();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const problemSetId = activeProblemSet?.id || '';
  const daoId = activeProblemSet?.dao_id || '';

  // Find existing gate for this item
  const existingGate = useMemo(() => {
    return gates.find(
      (g) => g.target_item_id === itemId && g.gate_type === gateType
    );
  }, [gates, itemId, gateType]);

  const status = existingGate?.status;

  const handleClick = useCallback(async () => {
    if (!problemSetId) return;

    setCreating(true);
    try {
      // Create gate if none exists
      if (!existingGate) {
        await createGate({
          problem_set_id: problemSetId,
          gate_type: gateType,
          tab: tabId,
          target_item_id: itemId,
          target_item_type: gateType,
          target_item_title: itemTitle,
          mode: 'operational',
        });
      }
      setModalOpen(true);
    } catch {
      // Gate creation failed — modal won't open
    } finally {
      setCreating(false);
    }
  }, [problemSetId, existingGate, createGate, gateType, tabId, itemId, itemTitle]);

  const handleModalSubmit = useCallback(
    async (proposal: { title: string; description: string; metadata: Record<string, unknown> }) => {
      // Re-check gate after potential creation
      const gateId = existingGate?.id;
      if (!gateId) return;
      await submitForApproval(gateId, proposal);
    },
    [existingGate, submitForApproval]
  );

  // Render based on gate status
  if (status === GateStatus.submitted) {
    return <GateStatusBadge status={GateStatus.submitted} />;
  }

  if (status === GateStatus.approved) {
    return (
      <span className={`gate-submit-approved ${className}`} title="Approved">
        <GateStatusBadge status={GateStatus.approved} />
      </span>
    );
  }

  if (status === GateStatus.escalated) {
    return <GateStatusBadge status={GateStatus.escalated} />;
  }

  if (status === GateStatus.overridden) {
    return <GateStatusBadge status={GateStatus.overridden} />;
  }

  const isResubmit = status === GateStatus.rejected;

  return (
    <>
      <button
        className={`gate-submit-btn ${isResubmit ? 'resubmit' : ''} ${className}`}
        onClick={handleClick}
        disabled={creating}
        title={isResubmit ? 'Resubmit for approval' : 'Submit for approval'}
      >
        {creating
          ? 'Preparing...'
          : isResubmit
            ? 'Resubmit'
            : 'Submit for Approval'}
      </button>

      {modalOpen && (
        <GateProposalModal
          gateType={gateType}
          tabId={tabId}
          prefillContext={{
            title: itemTitle,
            description: itemDescription,
            metadata,
          }}
          daoId={daoId}
          onSubmit={handleModalSubmit}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

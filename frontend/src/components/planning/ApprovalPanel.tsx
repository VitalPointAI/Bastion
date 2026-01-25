/**
 * ApprovalPanel Component
 *
 * Phase 05 Plan 13: Commander approval interface for COA and plan approval checkpoints
 * Displays checkpoint status and enables commander approve/reject actions
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { WorkflowState, COA } from './types';
import { sendWorkflowEvent, getCOAs } from '../../lib/planning-service';
import './ApprovalPanel.css';

interface ApprovalPanelProps {
  planId: string;
  workflowState: WorkflowState;
  userDID: string;
  isCommander: boolean;
  onApprovalComplete: () => void;
}

export function ApprovalPanel({
  planId,
  workflowState,
  userDID,
  isCommander,
  onApprovalComplete,
}: ApprovalPanelProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCOA, setSelectedCOA] = useState<COA | null>(null);

  const { atCheckpoint, checkpoint } = workflowState;
  const isCOAApproval = checkpoint === 'coa_approval';
  const isPlanApproval = checkpoint === 'plan_approval';

  // Load selected COA details for COA approval
  useEffect(() => {
    if (isCOAApproval && workflowState.context.selectedCoaId) {
      getCOAs(planId).then((coas) => {
        const selected = coas.find((c) => c.id === workflowState.context.selectedCoaId);
        setSelectedCOA(selected || null);
      });
    }
  }, [isCOAApproval, workflowState.context.selectedCoaId, planId]);

  const handleApprove = useCallback(async () => {
    if (!isCommander) {
      setError('Only the mission commander can approve');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const eventType = isCOAApproval
        ? 'COMMANDER_APPROVE_COA'
        : 'COMMANDER_APPROVE_PLAN';

      await sendWorkflowEvent(planId, {
        type: eventType,
        commanderDID: userDID,
      });

      onApprovalComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  }, [isCommander, isCOAApproval, planId, userDID, onApprovalComplete]);

  const handleReject = useCallback(async () => {
    if (!isCommander) {
      setError('Only the mission commander can reject');
      return;
    }

    if (!rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const eventType = isCOAApproval
        ? 'COMMANDER_REJECT_COA'
        : 'COMMANDER_REJECT_PLAN';

      await sendWorkflowEvent(planId, {
        type: eventType,
        commanderDID: userDID,
        reason: rejectionReason,
      });

      onApprovalComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setLoading(false);
    }
  }, [isCommander, isCOAApproval, planId, userDID, rejectionReason, onApprovalComplete]);

  if (!atCheckpoint) {
    return null;
  }

  return (
    <div className="approval-panel">
      <div className="approval-header">
        <span className="approval-icon">!</span>
        <h3>
          {isCOAApproval
            ? 'COA Selection Awaiting Approval'
            : 'Final Plan Awaiting Approval'}
        </h3>
      </div>

      {isCOAApproval && selectedCOA && (
        <div className="approval-coa-summary">
          <h4>Selected Course of Action</h4>
          <div className="coa-summary-card">
            <span className="coa-name">{selectedCOA.name}</span>
            {selectedCOA.comparisonScore && (
              <span className="coa-score">
                Score: {selectedCOA.comparisonScore.overallScore}/100
              </span>
            )}
          </div>
          <p className="coa-description">{selectedCOA.description}</p>
          <p className="coa-scheme">
            <strong>Scheme:</strong> {selectedCOA.scheme}
          </p>
        </div>
      )}

      {isPlanApproval && (
        <div className="approval-plan-summary">
          <h4>Plan Ready for Approval</h4>
          <ul className="approval-checklist">
            <li className="complete">COA selected and approved</li>
            <li className="complete">Plan development complete</li>
            <li className="complete">OPLAN/OPORD generated</li>
          </ul>
        </div>
      )}

      {error && <div className="approval-error">{error}</div>}

      {isCommander ? (
        <div className="approval-actions">
          <div className="rejection-input">
            <input
              type="text"
              placeholder="Rejection reason (required if rejecting)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <div className="action-buttons">
            <button
              className="reject-btn"
              onClick={handleReject}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Reject'}
            </button>
            <button
              className="approve-btn"
              onClick={handleApprove}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      ) : (
        <div className="approval-waiting">
          <span className="waiting-icon" />
          Awaiting commander decision...
        </div>
      )}
    </div>
  );
}

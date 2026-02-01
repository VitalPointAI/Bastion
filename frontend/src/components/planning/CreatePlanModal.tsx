/**
 * CreatePlanModal Component
 *
 * Modal form for creating new operational plans.
 * Allows user to enter plan name and select plan type.
 */

import { useState, useCallback, useEffect } from 'react';
import './CreatePlanModal.css';

type PlanType = 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD';

interface CreatePlanModalProps {
  onSubmit: (name: string, planType: PlanType) => void;
  onCancel: () => void;
}

export function CreatePlanModal({ onSubmit, onCancel }: CreatePlanModalProps) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<PlanType>('OPLAN');

  const isValid = name.trim().length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid) {
        onSubmit(name.trim(), planType);
      }
    },
    [name, planType, isValid, onSubmit]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="create-plan-modal-overlay" onClick={handleBackdropClick}>
      <div className="create-plan-modal">
        <div className="modal-header">
          <h3>Create Operational Plan</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onCancel}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="plan-name">Plan Name</label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., OPLAN THUNDER STRIKE"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="plan-type">Plan Type</label>
            <select
              id="plan-type"
              value={planType}
              onChange={(e) => setPlanType(e.target.value as PlanType)}
            >
              <option value="OPLAN">OPLAN - Operation Plan</option>
              <option value="OPORD">OPORD - Operation Order</option>
              <option value="CONPLAN">CONPLAN - Concept Plan</option>
              <option value="FRAGORD">FRAGORD - Fragmentary Order</option>
            </select>
          </div>

          <div className="plan-type-description">
            {planType === 'OPLAN' && (
              <p>
                A complete and detailed joint plan containing a full description
                of the concept of operations, all annexes applicable to the plan,
                and a time-phased force deployment data.
              </p>
            )}
            {planType === 'OPORD' && (
              <p>
                A directive issued by a commander to subordinate commanders for
                the purpose of effecting the coordinated execution of an operation.
              </p>
            )}
            {planType === 'CONPLAN' && (
              <p>
                An operation plan in an abbreviated format that would require
                considerable expansion or alteration to convert it into an OPLAN.
              </p>
            )}
            {planType === 'FRAGORD' && (
              <p>
                An abbreviated form of an operation order used to make changes
                to an OPORD that was previously issued and still in effect.
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid}
            >
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

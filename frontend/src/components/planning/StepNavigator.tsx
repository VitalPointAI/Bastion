/**
 * StepNavigator Component
 *
 * Displays JP 5-0 planning process steps with status indicators.
 * Allows navigation to any step and actions for current step.
 */

import { JP50_STEPS, JP50Step, StepStatus, WorkflowState } from './types';
import './PlanningDashboard.css';

interface StepNavigatorProps {
  workflowState: WorkflowState | null;
  onStepClick: (step: JP50Step) => void;
  onStartStep: (step: JP50Step) => void;
  onMarkReady: (step: JP50Step) => void;
}

const STATUS_COLORS: Record<StepStatus, string> = {
  not_started: 'var(--text-muted, #666678)',
  in_progress: 'var(--accent-orange, #ffa500)',
  ready: 'var(--accent-green, #22c55e)',
  approved: 'var(--accent-blue, #4a90d9)',
  rejected: 'var(--accent-red, #ff4444)',
};

const STATUS_LABELS: Record<StepStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  ready: 'Ready',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function StepNavigator({
  workflowState,
  onStepClick,
  onStartStep,
  onMarkReady,
}: StepNavigatorProps) {
  const steps = workflowState?.context.steps || {};
  const currentStep = workflowState?.context.currentStep;
  const coaApproved = workflowState?.context.commanderApproval.coaApproved;
  const planApproved = workflowState?.context.commanderApproval.planApproved;

  return (
    <div className="step-navigator">
      <h3>JP 5-0 Planning Process</h3>

      <div className="step-list">
        {JP50_STEPS.map((step) => {
          const status = steps[step.key] || 'not_started';
          const isCurrent = currentStep === step.key;
          const isCheckpoint = step.key === 'coa_approval' || step.key === 'plan_approval';

          return (
            <div
              key={step.key}
              className={`step-item ${isCurrent ? 'current' : ''} ${isCheckpoint ? 'checkpoint' : ''}`}
              onClick={() => onStepClick(step.key)}
            >
              <div className="step-header">
                <span className="step-label">{step.label}</span>
                <span
                  className="step-status"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                >
                  {STATUS_LABELS[status]}
                </span>
              </div>

              <div className="step-description">{step.description}</div>

              {isCurrent && status === 'not_started' && (
                <button
                  className="step-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartStep(step.key);
                  }}
                >
                  Start Step
                </button>
              )}

              {isCurrent && status === 'in_progress' && !isCheckpoint && (
                <button
                  className="step-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkReady(step.key);
                  }}
                >
                  Mark Ready
                </button>
              )}

              {isCheckpoint && (
                <div className="checkpoint-indicator">
                  {step.key === 'coa_approval' && coaApproved && (
                    <span className="approved-badge">Commander Approved</span>
                  )}
                  {step.key === 'plan_approval' && planApproved && (
                    <span className="approved-badge">Plan Approved</span>
                  )}
                  {((step.key === 'coa_approval' && !coaApproved) ||
                    (step.key === 'plan_approval' && !planApproved)) && (
                    <span className="awaiting-badge">Awaiting Commander</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

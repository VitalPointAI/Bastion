/**
 * PlanList Component
 *
 * Displays list of operational plans with selection and creation.
 * Shows plan progress based on step statuses.
 */

import type { OperationalPlan } from './types';
import './PlanningDashboard.css';

interface PlanListProps {
  plans: OperationalPlan[];
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
  onCreatePlan: () => void;
}

export function PlanList({
  plans,
  selectedPlanId,
  onSelectPlan,
  onCreatePlan,
}: PlanListProps) {
  return (
    <div className="plan-list">
      <div className="plan-list-header">
        <h3>Operational Plans</h3>
        <button className="create-plan-btn" onClick={onCreatePlan}>
          + New Plan
        </button>
      </div>

      <div className="plan-items">
        {plans.length === 0 ? (
          <div className="no-plans">
            No operational plans yet.
            <br />
            Create one to get started.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-item ${selectedPlanId === plan.id ? 'selected' : ''}`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <div className="plan-item-header">
                <span className="plan-name">{plan.name}</span>
                <span className={`plan-type ${plan.planType.toLowerCase()}`}>
                  {plan.planType}
                </span>
              </div>

              <div className="plan-item-meta">
                <span className={`classification ${plan.classification.toLowerCase()}`}>
                  {plan.classification}
                </span>
                <span className="plan-date">
                  {new Date(plan.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="plan-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${calculateProgress(plan)}%`,
                    }}
                  />
                </div>
                <span className="progress-text">{calculateProgress(plan)}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function calculateProgress(plan: OperationalPlan): number {
  const statuses = Object.values(plan.stepStatuses);
  const completed = statuses.filter(
    (s) => s === 'ready' || s === 'approved'
  ).length;
  return Math.round((completed / statuses.length) * 100);
}

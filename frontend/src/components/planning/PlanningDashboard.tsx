/**
 * PlanningDashboard Component
 *
 * Main operational planning dashboard with JP 5-0 step navigation.
 * Combines plan list, step navigator, and checkpoint awareness.
 */

import { useState, useEffect, useCallback } from 'react';
import { StepNavigator } from './StepNavigator';
import { PlanList } from './PlanList';
import type {
  OperationalPlan,
  WorkflowState,
  JP50Step,
} from './types';
import {
  getPlansByMission,
  getWorkflowState,
  navigateToStep,
  startStep,
  markStepReady,
  createPlan,
} from '../../lib/planning-service';
import './PlanningDashboard.css';

interface PlanningDashboardProps {
  missionId: string;
  userDID: string;
}

export function PlanningDashboard({ missionId, userDID }: PlanningDashboardProps) {
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load plans
  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        const loadedPlans = await getPlansByMission(missionId);
        setPlans(loadedPlans);

        // Select first plan if none selected
        if (loadedPlans.length > 0 && !selectedPlanId) {
          setSelectedPlanId(loadedPlans[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, [missionId]);

  // Load workflow state when plan selected
  useEffect(() => {
    async function loadWorkflow() {
      if (!selectedPlanId) {
        setWorkflowState(null);
        return;
      }

      try {
        const state = await getWorkflowState(selectedPlanId);
        setWorkflowState(state);
      } catch (err) {
        console.error('Failed to load workflow:', err);
      }
    }

    loadWorkflow();
  }, [selectedPlanId]);

  const handleStepClick = useCallback(async (step: JP50Step) => {
    if (!selectedPlanId) return;

    try {
      const state = await navigateToStep(selectedPlanId, step);
      setWorkflowState(state);
    } catch (err) {
      console.error('Failed to navigate:', err);
    }
  }, [selectedPlanId]);

  const handleStartStep = useCallback(async (step: JP50Step) => {
    if (!selectedPlanId) return;

    try {
      const state = await startStep(selectedPlanId, step, userDID);
      setWorkflowState(state);
    } catch (err) {
      console.error('Failed to start step:', err);
    }
  }, [selectedPlanId, userDID]);

  const handleMarkReady = useCallback(async (step: JP50Step) => {
    if (!selectedPlanId) return;

    try {
      const state = await markStepReady(selectedPlanId, step, userDID);
      setWorkflowState(state);
    } catch (err) {
      console.error('Failed to mark ready:', err);
    }
  }, [selectedPlanId, userDID]);

  const handleCreatePlan = useCallback(async () => {
    try {
      const newPlan = await createPlan({
        missionId,
        name: `OPLAN ${new Date().toISOString().slice(0, 10)}`,
        planType: 'OPLAN',
        classification: 'UNCLASSIFIED',
        objectiveIds: [],
      });

      setPlans((prev) => [...prev, newPlan]);
      setSelectedPlanId(newPlan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    }
  }, [missionId]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  if (loading) {
    return <div className="planning-loading">Loading operational plans...</div>;
  }

  if (error) {
    return <div className="planning-error">{error}</div>;
  }

  return (
    <div className="planning-dashboard">
      <div className="planning-header">
        <h2>Operational Planning</h2>
        {selectedPlan && (
          <div className="selected-plan-info">
            <span className="plan-title">{selectedPlan.name}</span>
            <span className={`plan-classification ${selectedPlan.classification.toLowerCase()}`}>
              {selectedPlan.classification}
            </span>
          </div>
        )}
      </div>

      <div className="planning-content">
        <div className="planning-sidebar">
          <PlanList
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
            onCreatePlan={handleCreatePlan}
          />
        </div>

        <div className="planning-main">
          {selectedPlan ? (
            <>
              <StepNavigator
                workflowState={workflowState}
                onStepClick={handleStepClick}
                onStartStep={handleStartStep}
                onMarkReady={handleMarkReady}
              />

              {workflowState?.atCheckpoint && (
                <div className="checkpoint-banner">
                  <span className="checkpoint-icon">!</span>
                  <span className="checkpoint-message">
                    Awaiting commander approval for{' '}
                    {workflowState.checkpoint === 'coa_approval'
                      ? 'COA Selection'
                      : 'Final Plan'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="no-plan-selected">
              Select a plan or create a new one to begin planning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

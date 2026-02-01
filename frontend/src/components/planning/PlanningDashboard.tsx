/**
 * PlanningDashboard Component
 *
 * Main operational planning dashboard with JP 5-0 step navigation.
 * Combines plan list, step navigator, and checkpoint awareness.
 */

import { useState, useEffect, useCallback } from 'react';
import { StepNavigator } from './StepNavigator';
import { PlanList } from './PlanList';
import { CreatePlanModal } from './CreatePlanModal';
import { COAList } from './COAList';
import { COAEditor } from './COAEditor';
import { ApprovalPanel } from './ApprovalPanel';
import { ROEPanel } from './ROEPanel';
import { DocumentExport } from './DocumentExport';
import type {
  OperationalPlan,
  WorkflowState,
  JP50Step,
  COA,
  ROECheckResult,
} from './types';
import {
  getPlansByMission,
  getWorkflowState,
  navigateToStep,
  startStep,
  markStepReady,
  createPlan,
  getCOAs,
  checkROE,
  requestROEOverride,
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [coas, setCoas] = useState<COA[]>([]);
  const [editingCOA, setEditingCOA] = useState<COA | null | undefined>(undefined);
  const [roeCheckResult, setRoeCheckResult] = useState<ROECheckResult | null>(null);

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

  // Load COAs when plan selected
  useEffect(() => {
    async function loadCOAs() {
      if (!selectedPlanId) {
        setCoas([]);
        return;
      }
      try {
        const loadedCOAs = await getCOAs(selectedPlanId);
        setCoas(loadedCOAs);
      } catch (err) {
        console.error('Failed to load COAs:', err);
      }
    }
    loadCOAs();
  }, [selectedPlanId]);

  // Load ROE check result when entering plan_development step
  useEffect(() => {
    async function loadROECheck() {
      if (!selectedPlanId || workflowState?.context.currentStep !== 'plan_development') {
        return;
      }
      try {
        const result = await checkROE(selectedPlanId);
        setRoeCheckResult(result);
      } catch (err) {
        console.error('Failed to load ROE check:', err);
      }
    }
    loadROECheck();
  }, [selectedPlanId, workflowState?.context.currentStep]);

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

  const handleCOAsChange = useCallback((newCOAs: COA[]) => {
    setCoas(newCOAs);
  }, []);

  const handleEditCOA = useCallback((coa: COA | null) => {
    setEditingCOA(coa);
  }, []);

  const handleApprovalComplete = useCallback(async () => {
    if (selectedPlanId) {
      const state = await getWorkflowState(selectedPlanId);
      setWorkflowState(state);
    }
  }, [selectedPlanId]);

  const handleROEOverride = useCallback(async (justification: string) => {
    if (!selectedPlanId) return;
    await requestROEOverride(selectedPlanId, justification, userDID);
    // Refresh ROE check
    const result = await checkROE(selectedPlanId);
    setRoeCheckResult(result);
  }, [selectedPlanId, userDID]);

  const handleCreatePlan = useCallback(
    async (name: string, planType: 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD') => {
      try {
        const newPlan = await createPlan({
          missionId,
          name,
          planType,
          classification: 'UNCLASSIFIED',
          objectiveIds: [],
        });

        setPlans((prev) => [...prev, newPlan]);
        setSelectedPlanId(newPlan.id);
        setShowCreateModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create plan');
      }
    },
    [missionId]
  );

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
            onCreatePlan={() => setShowCreateModal(true)}
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

      {showCreateModal && (
        <CreatePlanModal
          onSubmit={handleCreatePlan}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

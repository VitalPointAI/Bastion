/**
 * MDMPPlanView
 *
 * Phase 34 Plan 02: Full MDMP tactical plan view with sidebar steps,
 * AI agent panels, governance gates, and Missions section.
 * Replaces the temporary tactical placeholder from Plan 01.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.tsx';
import { DecisionGateTimeline } from '../governance/index.ts';
import { EchelonBadge } from './EchelonBadge.tsx';
import { PlanEmptyState } from './PlanEmptyState.tsx';
import { MDMPStepLayout } from './MDMPStepLayout.tsx';
import {
  MDMP_STEPS,
  MDMPStepConfig,
  deriveStepStatuses,
  type MDMPStepId,
} from './MDMPStepConfig.ts';
import * as mdmpService from '../../lib/mdmp-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MDMPSelectedItem = MDMPStepId | 'missions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build sidebar items from MDMP step config + derived statuses */
function buildMDMPSidebarItems(
  currentPhase: string | undefined,
): SidebarItem[] {
  const statuses = currentPhase ? deriveStepStatuses(currentPhase) : null;

  const stepItems: SidebarItem[] = MDMP_STEPS.map((stepId, index) => ({
    id: stepId,
    label: `${index + 1}. ${MDMPStepConfig[stepId].label}`,
    status: statuses ? statuses[stepId] : ('not-started' as const),
  }));

  // Missions section as final sidebar item (no status badge)
  const missionsItem: SidebarItem = {
    id: 'missions',
    label: 'Missions',
  };

  return [...stepItems, missionsItem];
}

// ---------------------------------------------------------------------------
// MDMPPlanView Component
// ---------------------------------------------------------------------------

interface MDMPPlanViewProps {
  problemSetId: string;
  daoId?: string;
}

export function MDMPPlanView({ problemSetId, daoId }: MDMPPlanViewProps) {
  const [selectedStep, setSelectedStep] = useState<MDMPSelectedItem>('receipt_of_mission');
  const [workflowData, setWorkflowData] = useState<Awaited<ReturnType<typeof mdmpService.getWorkflow>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Load MDMP workflow
  const loadWorkflow = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await mdmpService.getWorkflow(problemSetId);
      setWorkflowData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MDMP workflow';
      setError(message);
      console.error('[MDMPPlanView] Failed to load workflow:', message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const echelonBadge = <EchelonBadge echelon="tactical" />;

  // Loading state
  if (loading) {
    return (
      <>
        {echelonBadge}
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading MDMP workflow...
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        {echelonBadge}
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <p className="text-red-400">Error: {error}</p>
          <button
            onClick={loadWorkflow}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  // No workflow — show empty state with Start Planning CTA
  if (!workflowData) {
    const handleStartPlanning = async () => {
      try {
        setCreating(true);
        await mdmpService.createWorkflow({
          missionId: problemSetId,
          daoId: daoId ?? '',
          createdBy: '',
        });
        await loadWorkflow();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create MDMP workflow';
        setError(message);
      } finally {
        setCreating(false);
      }
    };

    return (
      <>
        {echelonBadge}
        <PlanEmptyState
          workflowName="MDMP"
          onStartPlanning={handleStartPlanning}
          loading={creating}
        />
      </>
    );
  }

  // Workflow exists — build sidebar and render step content
  const workflow = workflowData.workflow;
  const workflowId = workflow.missionId;
  const sidebarItems = buildMDMPSidebarItems(workflow.currentPhase);
  const stepStatuses = deriveStepStatuses(workflow.currentPhase);

  return (
    <TabLayout
      items={sidebarItems}
      selectedItem={selectedStep}
      onSelectItem={(id) => setSelectedStep(id as MDMPSelectedItem)}
      header={echelonBadge}
      decisionHistory={<DecisionGateTimeline tabId="plan" />}
    >
      {/* MDMP step content */}
      {MDMP_STEPS.map((stepId) => {
        if (selectedStep !== stepId) return null;
        const config = MDMPStepConfig[stepId];
        const stepNumber = MDMP_STEPS.indexOf(stepId) + 1;

        return (
          <MDMPStepLayout
            key={stepId}
            stepId={stepId}
            stepLabel={config.label}
            stepNumber={stepNumber}
            problemSetId={problemSetId}
            workflowId={workflowId}
            status={stepStatuses[stepId]}
            aiAgentId={config.aiAgentId}
            governanceGate={config.governanceGate}
          >
            <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: '#d1d5db' }}>{config.description}</p>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                Step content will be implemented in future phases.
              </p>
            </div>
          </MDMPStepLayout>
        );
      })}

      {/* Missions section */}
      {selectedStep === 'missions' && (
        <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', fontWeight: 600, color: '#e5e7eb' }}>
            Missions
          </h2>
          <p style={{ margin: 0, fontStyle: 'italic' }}>
            Mission management view. Existing mission components (MissionList, MissionDetail, MissionWizard) will be wired here.
          </p>
        </div>
      )}
    </TabLayout>
  );
}

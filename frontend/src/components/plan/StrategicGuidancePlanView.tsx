/**
 * StrategicGuidancePlanView
 *
 * Phase 36 Plan 02: Full strategic guidance plan view with 3-step sidebar,
 * AI agent panels, governance gates, and free navigation.
 * Replaces DoctrinalPlaceholder for strategic-echelon problem sets.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.tsx';
import { DecisionGateTimeline } from '../governance/index.ts';
import { EchelonBadge } from './EchelonBadge.tsx';
import { PlanEmptyState } from './PlanEmptyState.tsx';
import { StrategicGuidanceStepLayout } from './StrategicGuidanceStepLayout.tsx';
import {
  SG_STEPS,
  SGStepConfig,
  type SGStepId,
} from './StrategicGuidanceStepConfig.ts';
import { sgService, type SGInstance } from '../../lib/strategic-guidance-service.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map backend step status to sidebar badge status */
function mapStepStatus(
  backendStatus: string | undefined,
): 'not-started' | 'in-progress' | 'complete' {
  if (!backendStatus) return 'not-started';
  switch (backendStatus) {
    case 'ready':
    case 'approved':
      return 'complete';
    case 'in_progress':
      return 'in-progress';
    default:
      return 'not-started';
  }
}

/** Build sidebar items from SG step config + instance statuses */
function buildSGSidebarItems(
  instance: SGInstance | null,
): SidebarItem[] {
  return SG_STEPS.map((stepId, index) => ({
    id: stepId,
    label: `${index + 1}. ${SGStepConfig[stepId].label}`,
    status: mapStepStatus(instance?.stepStatuses?.[stepId]),
  }));
}

// ---------------------------------------------------------------------------
// StrategicGuidancePlanView Component
// ---------------------------------------------------------------------------

interface StrategicGuidancePlanViewProps {
  problemSetId: string;
  daoId?: string;
}

export function StrategicGuidancePlanView({
  problemSetId,
  daoId: _daoId,
}: StrategicGuidancePlanViewProps) {
  const [selectedStep, setSelectedStep] = useState<SGStepId>('strategic_assessment');
  const [instance, setInstance] = useState<SGInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Load strategic guidance instance
  const loadInstance = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await sgService.getInstance(problemSetId);
      setInstance(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load strategic guidance instance';
      setError(message);
      console.error('[StrategicGuidancePlanView] Failed to load instance:', message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const echelonBadge = <EchelonBadge echelon="strategic" />;

  // Loading state
  if (loading) {
    return (
      <>
        {echelonBadge}
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading strategic guidance workflow...
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
            onClick={loadInstance}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  // No instance — show empty state with Start Planning CTA
  if (!instance) {
    const handleStartPlanning = async () => {
      try {
        setCreating(true);
        await sgService.createInstance(problemSetId);
        await loadInstance();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create strategic guidance instance';
        setError(message);
      } finally {
        setCreating(false);
      }
    };

    return (
      <>
        {echelonBadge}
        <PlanEmptyState
          workflowName="Strategic Guidance"
          onStartPlanning={handleStartPlanning}
          loading={creating}
        />
      </>
    );
  }

  // Instance exists — build sidebar and render step content
  const sidebarItems = buildSGSidebarItems(instance);

  return (
    <TabLayout
      items={sidebarItems}
      selectedItem={selectedStep}
      onSelectItem={(id) => setSelectedStep(id as SGStepId)}
      header={echelonBadge}
      decisionHistory={<DecisionGateTimeline tabId="plan" />}
    >
      {/* Strategic guidance step content */}
      {SG_STEPS.map((stepId) => {
        if (selectedStep !== stepId) return null;
        const config = SGStepConfig[stepId];
        const stepNumber = SG_STEPS.indexOf(stepId) + 1;

        return (
          <StrategicGuidanceStepLayout
            key={stepId}
            stepId={stepId}
            stepLabel={config.label}
            stepNumber={stepNumber}
            problemSetId={problemSetId}
            instanceId={instance.id}
            status={mapStepStatus(instance.stepStatuses?.[stepId])}
            aiAgentId={config.aiAgentId}
            governanceGate={config.governanceGate}
          >
            <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: '#d1d5db' }}>{config.description}</p>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                Step content will be implemented in Plan 03/04.
              </p>
            </div>
          </StrategicGuidanceStepLayout>
        );
      })}
    </TabLayout>
  );
}

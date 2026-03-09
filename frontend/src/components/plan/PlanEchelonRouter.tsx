/**
 * PlanEchelonRouter
 *
 * Phase 34 Plan 01: Echelon-based routing for the Plan tab.
 * Reads echelon from ProblemSetContext and renders:
 *   - operational: JPPPlanView (existing JPP sidebar workflow)
 *   - tactical: Placeholder (replaced by Plan 02 with MDMPPlanView)
 *   - strategic: StrategicGuidancePlanView (Phase 36)
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.js';
import { DecisionGateTimeline } from '../governance/index.js';
import { jppService, type JPPInstance, type StepStatus } from '../../lib/jpp-service.ts';
import type { DecisionGate } from '../../lib/gate-service';
import { useProblemSet } from '../../context/ProblemSetContext.tsx';
import { EchelonBadge } from './EchelonBadge.tsx';
import { PlanEmptyState } from './PlanEmptyState.tsx';
import { MDMPPlanView } from './MDMPPlanView.tsx';
import { StrategicGuidancePlanView } from './StrategicGuidancePlanView.tsx';

// Step components (Plans 06-08)
import { PlanningInitiation } from './PlanningInitiation.tsx';
import { MissionAnalysis } from './MissionAnalysis.tsx';
import { COADevelopment } from './COADevelopment.tsx';
import { COAAnalysis } from './COAAnalysis.tsx';
import { COAComparison } from './COAComparison.tsx';
import { COAApproval } from './COAApproval.tsx';
import { PlanOrderDevelopment } from './PlanOrderDevelopment.tsx';
import { EWMOverview } from './EWMOverview.tsx';

// Entity resolution panel (Plan 09)
import { EntityResolutionPanel } from './EntityResolutionPanel.tsx';

type JPPView =
  | 'planning-initiation'
  | 'mission-analysis'
  | 'coa-development'
  | 'coa-analysis'
  | 'coa-comparison'
  | 'coa-approval'
  | 'plan-development'
  | 'ewm-overview';

/** Map JPP StepStatus to SidebarItem status for badge display */
function mapStatusToBadge(status?: StepStatus): SidebarItem['status'] {
  if (!status) return 'not-started';
  switch (status) {
    case 'not_started':
      return 'not-started';
    case 'in_progress':
      return 'in-progress';
    case 'ready':
    case 'approved':
      return 'complete';
    case 'rejected':
      return 'in-progress';
    default:
      return 'not-started';
  }
}

/** Build the 8 JPP sidebar items with current step statuses */
function buildJPPItems(instance: JPPInstance | null): SidebarItem[] {
  const s = instance?.stepStatuses;
  return [
    {
      id: 'planning-initiation',
      label: '1. Planning Initiation',
      status: mapStatusToBadge(s?.planning_initiation),
    },
    {
      id: 'mission-analysis',
      label: '2. Mission Analysis',
      status: mapStatusToBadge(s?.mission_analysis),
    },
    {
      id: 'coa-development',
      label: '3. COA Development',
      status: mapStatusToBadge(s?.coa_development),
    },
    {
      id: 'coa-analysis',
      label: '4. COA Analysis (Wargame)',
      status: mapStatusToBadge(s?.coa_analysis),
    },
    {
      id: 'coa-comparison',
      label: '5. COA Comparison',
      status: mapStatusToBadge(s?.coa_comparison),
    },
    {
      id: 'coa-approval',
      label: '6. COA Approval',
      status: mapStatusToBadge(s?.coa_approval),
    },
    {
      id: 'plan-development',
      label: '7. Plan/Order Dev',
      status: mapStatusToBadge(s?.plan_development),
    },
    {
      id: 'ewm-overview',
      label: 'E-W-M Overview',
    },
  ];
}

// ---------------------------------------------------------------------------
// JPPPlanView — operational echelon planning workflow
// ---------------------------------------------------------------------------

interface JPPPlanViewProps {
  problemSetId: string;
}

function JPPPlanView({ problemSetId }: JPPPlanViewProps) {
  const [selectedView, setSelectedView] = useState<JPPView>('planning-initiation');
  const [jppInstance, setJppInstance] = useState<JPPInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  // Get the user's role in the active problem set
  const { userRoleInActive } = useProblemSet();
  const currentRole = userRoleInActive ?? 'observer';

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[PlanTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  // Fetch JPP instance on mount
  const loadJPPInstance = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const instance = await jppService.getInstance(problemSetId);
      setJppInstance(instance);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load JPP instance';
      setError(message);
      console.error('[PlanTab] Failed to load JPP instance:', message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadJPPInstance();
  }, [loadJPPInstance]);

  const echelonBadge = <EchelonBadge echelon="operational" />;

  if (loading) {
    return (
      <>
        {echelonBadge}
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading JPP instance...
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {echelonBadge}
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <p className="text-red-400">Error: {error}</p>
          <button
            onClick={loadJPPInstance}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  // No instance loaded — show empty state with Start Planning CTA
  if (!jppInstance) {
    return (
      <>
        {echelonBadge}
        <PlanEmptyState
          workflowName="JPP"
          onStartPlanning={() => {
            jppService.getInstance(problemSetId).then(loadJPPInstance);
          }}
        />
      </>
    );
  }

  const sidebarItems = buildJPPItems(jppInstance);
  const instanceId = jppInstance.id;

  return (
    <>
      <TabLayout
        items={sidebarItems}
        selectedItem={selectedView}
        onSelectItem={(id) => setSelectedView(id as JPPView)}
        header={echelonBadge}
        decisionHistory={
          <DecisionGateTimeline tabId="plan" onEntryClick={handleGateDetailClick} />
        }
      >
        {/* Step 1: Planning Initiation */}
        {selectedView === 'planning-initiation' && (
          <PlanningInitiation problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 2: Mission Analysis */}
        {selectedView === 'mission-analysis' && (
          <MissionAnalysis problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 3: COA Development */}
        {selectedView === 'coa-development' && (
          <COADevelopment problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 4: COA Analysis (Wargame) */}
        {selectedView === 'coa-analysis' && (
          <COAAnalysis problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 5: COA Comparison */}
        {selectedView === 'coa-comparison' && (
          <COAComparison problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 6: COA Approval */}
        {selectedView === 'coa-approval' && (
          <COAApproval problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* Step 7: Plan/Order Development */}
        {selectedView === 'plan-development' && (
          <PlanOrderDevelopment problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}

        {/* E-W-M Overview */}
        {selectedView === 'ewm-overview' && (
          <EWMOverview problemSetId={problemSetId} jppInstanceId={instanceId} currentRole={currentRole} />
        )}
      </TabLayout>

      {/* Floating entity resolution panel */}
      <EntityResolutionPanel problemSetId={problemSetId} />
    </>
  );
}

// ---------------------------------------------------------------------------
// PlanEchelonRouter — top-level echelon-based routing
// ---------------------------------------------------------------------------

interface PlanEchelonRouterProps {
  problemSetId: string;
  daoId?: string;
}

export function PlanEchelonRouter({ problemSetId, daoId }: PlanEchelonRouterProps) {
  const { activeProblemSet } = useProblemSet();
  const echelon = activeProblemSet?.echelon ?? 'operational';

  switch (echelon) {
    case 'operational':
      return <JPPPlanView problemSetId={problemSetId} />;

    case 'tactical':
      return <MDMPPlanView problemSetId={problemSetId} daoId={daoId} />;

    case 'strategic':
      return <StrategicGuidancePlanView problemSetId={problemSetId} daoId={daoId} />;

    default:
      return <JPPPlanView problemSetId={problemSetId} />;
  }
}

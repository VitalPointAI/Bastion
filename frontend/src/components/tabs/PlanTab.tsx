/**
 * PlanTab
 *
 * Phase 33 Plan 05/09: Restructured Plan tab with 8 JPP sidebar items
 * (7 JP 5-0 steps + E-W-M Overview). All items always enabled (free-flow).
 * Status badges update from JPP instance step statuses.
 *
 * Plan 09: Replaced all placeholder divs with actual step components,
 * wired EntityResolutionPanel as floating slide-out, and added currentRole
 * from ProblemSetContext.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DecisionGateTimeline } from '../governance/index.js';
import { jppService, type JPPInstance, type StepStatus } from '../../lib/jpp-service.ts';
import type { DecisionGate } from '../../lib/gate-service';
import { useProblemSet } from '../../context/ProblemSetContext.tsx';

// Step components (Plans 06-08)
import { PlanningInitiation } from '../plan/PlanningInitiation.tsx';
import { MissionAnalysis } from '../plan/MissionAnalysis.tsx';
import { COADevelopment } from '../plan/COADevelopment.tsx';
import { COAAnalysis } from '../plan/COAAnalysis.tsx';
import { COAComparison } from '../plan/COAComparison.tsx';
import { COAApproval } from '../plan/COAApproval.tsx';
import { PlanOrderDevelopment } from '../plan/PlanOrderDevelopment.tsx';
import { EWMOverview } from '../plan/EWMOverview.tsx';

// Entity resolution panel (Plan 09)
import { EntityResolutionPanel } from '../plan/EntityResolutionPanel.tsx';

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

interface PlanTabProps {
  problemSetId: string;
  daoId?: string;
}

export function PlanTab({ problemSetId, daoId: _daoId }: PlanTabProps) {
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

  const sidebarItems = buildJPPItems(jppInstance);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading JPP instance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={loadJPPInstance}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const instanceId = jppInstance?.id ?? '';

  return (
    <>
      <TabLayout
        items={sidebarItems}
        selectedItem={selectedView}
        onSelectItem={(id) => setSelectedView(id as JPPView)}
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

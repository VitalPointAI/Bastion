/**
 * PlanTab
 *
 * Phase 33 Plan 05: Restructured Plan tab with 8 JPP sidebar items
 * (7 JP 5-0 steps + E-W-M Overview). All items always enabled (free-flow).
 * Status badges update from JPP instance step statuses.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DecisionGateTimeline } from '../governance/index.js';
import { jppService, type JPPInstance, type StepStatus } from '../../lib/jpp-service.ts';
import type { DecisionGate } from '../../lib/gate-service';

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

  return (
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
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>1. Planning Initiation</h3>
          <p>JPP Step 1 component (Plan 06): Receipt of mission, initial guidance, staff estimates, and planning timeline.</p>
        </div>
      )}

      {/* Step 2: Mission Analysis */}
      {selectedView === 'mission-analysis' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>2. Mission Analysis</h3>
          <p>JPP Step 2 component (Plan 06): Task analysis, specified/implied tasks, facts/assumptions, and restated mission.</p>
        </div>
      )}

      {/* Step 3: COA Development */}
      {selectedView === 'coa-development' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>3. COA Development</h3>
          <p>JPP Step 3 component (Plan 06): Course of action generation with force allocation and concept of operations.</p>
        </div>
      )}

      {/* Step 4: COA Analysis (Wargame) */}
      {selectedView === 'coa-analysis' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>4. COA Analysis (Wargame)</h3>
          <p>JPP Step 4 component (Plan 07): Wargaming each COA against threat COAs, identifying strengths/weaknesses.</p>
        </div>
      )}

      {/* Step 5: COA Comparison */}
      {selectedView === 'coa-comparison' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>5. COA Comparison</h3>
          <p>JPP Step 5 component (Plan 07): Weighted criteria comparison matrix for COA evaluation.</p>
        </div>
      )}

      {/* Step 6: COA Approval */}
      {selectedView === 'coa-approval' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>6. COA Approval</h3>
          <p>JPP Step 6 component (Plan 07): Commander decision briefing and COA selection with governance gate.</p>
        </div>
      )}

      {/* Step 7: Plan/Order Development */}
      {selectedView === 'plan-development' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>7. Plan/Order Development</h3>
          <p>JPP Step 7 component (Plan 07): OPORD/OPLAN development with annexes and synchronization matrix.</p>
        </div>
      )}

      {/* E-W-M Overview */}
      {selectedView === 'ewm-overview' && (
        <div style={{ padding: '1rem', color: '#9ca3af' }}>
          <h3 style={{ color: '#e5e7eb', marginTop: 0 }}>Ends-Ways-Means Overview</h3>
          <p>E-W-M linkage visualization component (Plan 08): Strategic objectives to tactical tasks traceability with gap analysis.</p>
        </div>
      )}
    </TabLayout>
  );
}

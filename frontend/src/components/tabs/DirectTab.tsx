import { useState, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DAODashboard } from '../dao/index.js';
import { EscalationPanel } from '../problem-set/EscalationPanel.js';
import {
  DecisionGateBanner,
  GateSubmitButton,
  DecisionGateTimeline,
  GateStatusBadge,
} from '../governance/index.js';
import { useDecisionGates } from '../../context/DecisionGateContext.js';
import type { DecisionGate } from '../../lib/gate-service';
import { RobotMissionTrigger } from '../direct/RobotMissionTrigger.js';

type DirectView = 'governance' | 'proposals' | 'escalation' | 'all-gates' | 'robot-missions';

const DIRECT_ITEMS: SidebarItem[] = [
  { id: 'governance', label: 'Governance Overview' },
  {
    id: 'proposals',
    label: 'Proposals & Voting',
    tooltip: 'Active proposals requiring action',
  },
  {
    id: 'escalation',
    label: 'Escalation',
    tooltip: 'Escalate decisions to parent problem set',
  },
  {
    id: 'all-gates',
    label: 'All Decision Gates',
    tooltip: 'Cross-tab overview of all decision gates',
  },
  {
    id: 'robot-missions',
    label: 'Robot Missions',
    tooltip: 'Trigger and monitor autonomous vehicle missions',
  },
];

const DAO_VIEWS = new Set<DirectView>(['governance', 'proposals']);

const VIEW_TO_INITIAL: Record<'governance' | 'proposals', 'governance' | 'proposals'> = {
  governance: 'governance',
  proposals: 'proposals',
};

// ============================================================================
// Gate Type Label Map
// ============================================================================

const GATE_TYPE_LABELS: Record<string, string> = {
  objective_approval: 'Objective Approval',
  operational_approach: 'Operational Approach',
  coa_selection: 'COA Selection',
  order_release: 'Order Release',
  reframing: 'Reframing Decision',
  robot_action_auth: 'Robot Action Auth',
  design_revision: 'Design Revision',
};

const TAB_LABELS: Record<string, string> = {
  understand: 'Understand',
  design: 'Design',
  plan: 'Plan',
  direct: 'Direct',
  assess: 'Assess',
};

// ============================================================================
// AllGatesOverview — Cross-tab gate summary
// ============================================================================

function AllGatesOverview() {
  const { gates, loading, error } = useDecisionGates(); // no tabId = all gates

  if (loading) {
    return <div className="all-gates-loading">Loading decision gates...</div>;
  }

  if (error) {
    return <div className="all-gates-error">Error loading gates: {error}</div>;
  }

  if (gates.length === 0) {
    return (
      <div className="all-gates-empty">
        <h2>All Decision Gates</h2>
        <p style={{ color: 'var(--text-secondary, #94a3b8)', marginTop: '1rem' }}>
          No decision gates have been created yet. Gates are created when staff submit items for commander approval in each tab.
        </p>
      </div>
    );
  }

  // Filter out internal robot gates stuck in pending (no user action possible)
  const filteredGates = gates.filter(
    (g) => !(g.status === 'pending' && g.gate_type === 'robot_action_auth'),
  );

  // Sort: pending/submitted first, then by updated_at descending
  const statusOrder: Record<string, number> = {
    submitted: 0,
    pending: 1,
    rejected: 2,
    escalated: 3,
    approved: 4,
    overridden: 5,
  };
  const sorted = [...filteredGates].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 99;
    const orderB = statusOrder[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Group by tab
  const byTab: Record<string, DecisionGate[]> = {};
  for (const gate of sorted) {
    if (!byTab[gate.tab]) byTab[gate.tab] = [];
    byTab[gate.tab].push(gate);
  }

  const tabOrder = ['understand', 'design', 'plan', 'direct', 'assess'];

  return (
    <div className="all-gates-overview">
      <h2>All Decision Gates</h2>
      <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: '0.5rem 0 1rem' }}>
        Cross-tab overview of all doctrinal decision gates across the planning process.
      </p>
      {tabOrder.map((tab) => {
        const tabGates = byTab[tab];
        if (!tabGates || tabGates.length === 0) return null;
        return (
          <div key={tab} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.5rem' }}>
              {TAB_LABELS[tab] || tab}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tabGates.map((gate) => (
                <div
                  key={gate.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.75rem',
                    background: 'var(--surface-secondary, #1e293b)',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-color, #334155)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {gate.target_item_title || GATE_TYPE_LABELS[gate.gate_type] || gate.gate_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.125rem' }}>
                      {GATE_TYPE_LABELS[gate.gate_type] || gate.gate_type}
                      {gate.submitted_at && ` | Submitted ${formatDate(gate.submitted_at)}`}
                      {gate.decided_at && ` | Decided ${formatDate(gate.decided_at)}`}
                    </div>
                  </div>
                  <GateStatusBadge status={gate.status} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// DirectTab
// ============================================================================

interface DirectTabProps {
  problemSetId: string;
  daoId?: string;
}

export function DirectTab({ problemSetId, daoId }: DirectTabProps) {
  const [selectedView, setSelectedView] = useState<DirectView>('governance');
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[DirectTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  return (
    <TabLayout
      items={DIRECT_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DirectView)}
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="direct" />

      {DAO_VIEWS.has(selectedView) && (
        <DAODashboard
          key={selectedView}
          daoId={daoId}
          initialView={VIEW_TO_INITIAL[selectedView as 'governance' | 'proposals']}
        />
      )}

      {selectedView === 'governance' && (
        <>
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--surface-secondary, rgba(30, 41, 59, 0.5))',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color, #334155)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary, #e2e8f0)' }}>
                Order Release Gate
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.125rem' }}>
                Submit order for commander release authorization
              </div>
            </div>
            <GateSubmitButton
              gateType="order_release"
              itemId={`${problemSetId}-order-release`}
              itemTitle="Order Release"
              itemDescription="Submit order for commander release authorization"
              tabId="direct"
            />
          </div>

          {/* Decision History — inline collapsible panel */}
          <div style={{ marginTop: '1.5rem' }}>
            <DecisionGateTimeline tabId="direct" onEntryClick={handleGateDetailClick} />
          </div>
        </>
      )}

      {selectedView === 'escalation' && (
        <EscalationPanel problemSetId={problemSetId} />
      )}

      {selectedView === 'all-gates' && (
        <AllGatesOverview />
      )}

      {selectedView === 'robot-missions' && (
        <RobotMissionTrigger problemSetId={problemSetId} />
      )}
    </TabLayout>
  );
}

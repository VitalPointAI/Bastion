/**
 * AssessTab
 *
 * Assessment tab with overview and reframing decision gate.
 * Replaces DoctrinalPlaceholder with functional tab structure.
 *
 * JP 5-0: "Assessment measures progress toward accomplishing objectives
 * and determines the effectiveness of ongoing operations."
 */

import { useState, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import {
  DecisionGateBanner,
  GateSubmitButton,
  DecisionGateTimeline,
  GateStatusBadge,
} from '../governance/index.js';
import { useDecisionGates } from '../../context/DecisionGateContext.js';
import type { DecisionGate } from '../../lib/gate-service';
import './AssessTab.css';

// ============================================================================
// Types
// ============================================================================

type AssessView = 'overview' | 'reframing';

// ============================================================================
// Sidebar Configuration
// ============================================================================

const ASSESS_ITEMS: SidebarItem[] = [
  { id: 'overview', label: 'Assessment Overview' },
  { id: 'reframing', label: 'Reframing' },
];

// ============================================================================
// Component
// ============================================================================

interface AssessTabProps {
  problemSetId: string;
  daoId?: string;
}

export function AssessTab({ problemSetId }: AssessTabProps) {
  const [selectedView, setSelectedView] = useState<AssessView>('overview');
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  const { gates } = useDecisionGates('assess');

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[AssessTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  // Collect approved gates for the decision record
  const approvedGates = gates.filter(
    (g) => g.status === 'approved' || g.status === 'overridden'
  );

  return (
    <TabLayout
      items={ASSESS_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as AssessView)}
      decisionHistory={
        <DecisionGateTimeline tabId="assess" onEntryClick={handleGateDetailClick} />
      }
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="assess" />

      {selectedView === 'overview' && (
        <div className="assess-overview">
          <h2>Assessment</h2>
          <p className="assess-description">
            Assessment measures progress toward accomplishing objectives and determines
            the effectiveness of ongoing operations. It enables adaptation of plans and
            operations through continuous monitoring, evaluation, and recommendation.
          </p>

          {/* MOE Section */}
          <section className="assess-section">
            <h3>Measures of Effectiveness (MOEs)</h3>
            <p className="assess-section-note">
              MOEs measure changes in system behavior, capability, or operational environment.
              Full MOE tracking will be available in a future update.
            </p>
            <div className="assess-placeholder-card">
              <span className="placeholder-label">Coming soon</span>
            </div>
          </section>

          {/* MOP Section */}
          <section className="assess-section">
            <h3>Measures of Performance (MOPs)</h3>
            <p className="assess-section-note">
              MOPs measure task accomplishment and whether tasks are completed to standard.
              Full MOP tracking will be available in a future update.
            </p>
            <div className="assess-placeholder-card">
              <span className="placeholder-label">Coming soon</span>
            </div>
          </section>

          {/* Decision Record */}
          <section className="assess-section">
            <h3>Decision Record</h3>
            <p className="assess-section-note">
              Governance decisions approved for this problem set.
            </p>
            {approvedGates.length > 0 ? (
              <div className="decision-record-list">
                {approvedGates.map((gate) => (
                  <div key={gate.id} className="decision-record-item">
                    <div className="decision-record-title">
                      {gate.target_item_title || gate.gate_type}
                    </div>
                    <div className="decision-record-meta">
                      <GateStatusBadge status={gate.status} />
                      {gate.decided_at && (
                        <span className="decision-record-date">
                          {new Date(gate.decided_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="assess-placeholder-card">
                <span className="placeholder-label">No approved decisions yet</span>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedView === 'reframing' && (
        <div className="assess-reframing">
          <h2>Reframing Decision</h2>
          <p className="assess-description">
            Reframing occurs when the current operational approach is assessed as inadequate
            to achieve objectives. Submit a reframing recommendation for commander approval.
          </p>

          <div className="reframing-submit-section">
            <GateSubmitButton
              gateType="reframing"
              itemId={problemSetId}
              itemTitle="Reframing Recommendation"
              itemDescription="Assessment-driven recommendation to reframe the operational approach"
              tabId="assess"
            />
          </div>

          <section className="assess-section reframing-post-actions">
            <h3>Post-Reframing Actions</h3>
            <p className="assess-section-note">
              When reframing is approved, updated guidance and directives will be generated.
              This section will display post-reframing actions in a future update.
            </p>
            <div className="assess-placeholder-card">
              <span className="placeholder-label">Available after reframing approval</span>
            </div>
          </section>
        </div>
      )}
    </TabLayout>
  );
}

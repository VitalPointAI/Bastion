/**
 * AssessTab
 *
 * Assessment tab with overview and reframing decision gate.
 * Replaces DoctrinalPlaceholder with functional tab structure.
 *
 * JP 5-0: "Assessment measures progress toward accomplishing objectives
 * and determines the effectiveness of ongoing operations."
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import {
  DecisionGateBanner,
  GateSubmitButton,
  DecisionGateTimeline,
  GateStatusBadge,
} from '../governance/index.js';
import { useDecisionGates } from '../../context/DecisionGateContext.js';
import type { DecisionGate } from '../../lib/gate-service';
import { inheritanceApiService, type CampaignAssessment } from '../../services/inheritance-service.js';
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
  const [campaignAssessment, setCampaignAssessment] = useState<CampaignAssessment | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { gates } = useDecisionGates('assess');

  // Fetch campaign assessment from child missions (Phase 38)
  useEffect(() => {
    let mounted = true;

    async function fetchAssessment() {
      try {
        const data = await inheritanceApiService.getCampaignAssessment(problemSetId);
        if (mounted && data.missionCount > 0) {
          setCampaignAssessment(data);
        }
      } catch {
        // No child missions or endpoint not available
      }
    }

    fetchAssessment();

    // Refresh every 60 seconds
    refreshTimerRef.current = setInterval(fetchAssessment, 60000);

    return () => {
      mounted = false;
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [problemSetId]);

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

          {/* Campaign Objective Progress (Phase 38) */}
          {campaignAssessment && (
            <section className="assess-section">
              <h3>Campaign Objective Progress</h3>
              <p className="assess-section-note">
                Aggregated progress across {campaignAssessment.missionCount} subordinate missions.
              </p>

              {/* Overall progress bar */}
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                border: '1px solid #374151',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>
                    Overall Campaign Progress
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>
                    {campaignAssessment.overallProgress}%
                  </span>
                </div>
                <div style={{
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: '#374151',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '5px',
                    backgroundColor: campaignAssessment.overallProgress >= 100 ? '#34d399' : '#3b82f6',
                    width: `${Math.min(100, campaignAssessment.overallProgress)}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                  <span>Total: {campaignAssessment.missionCount}</span>
                  <span style={{ color: '#34d399' }}>Complete: {campaignAssessment.completedMissions}</span>
                  <span style={{ color: '#60a5fa' }}>Active: {campaignAssessment.missionCount - campaignAssessment.completedMissions}</span>
                </div>
              </div>

              {/* Objective summaries */}
              {campaignAssessment.objectiveSummaries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {campaignAssessment.objectiveSummaries.map((obj) => {
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      not_started: { bg: '#374151', text: '#9ca3af' },
                      in_progress: { bg: '#1e3a5f', text: '#60a5fa' },
                      achieved: { bg: '#064e3b', text: '#34d399' },
                      failed: { bg: '#7f1d1d', text: '#fca5a5' },
                    };
                    const sc = statusColors[obj.overallStatus] ?? statusColors.not_started;
                    const achieved = obj.childStatuses.filter((c) => c.status === 'achieved').length;
                    const inProgress = obj.childStatuses.filter((c) => c.status === 'in_progress').length;
                    const notStarted = obj.childStatuses.filter((c) => c.status === 'not_started').length;

                    return (
                      <div key={obj.name} style={{
                        padding: '10px 12px',
                        backgroundColor: '#1f2937',
                        borderRadius: '6px',
                        border: '1px solid #374151',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#e5e7eb' }}>{obj.name}</span>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor: sc.bg,
                            color: sc.text,
                          }}>
                            {obj.overallStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9ca3af' }}>
                          <span style={{ color: '#34d399' }}>Achieved: {achieved}</span>
                          <span style={{ color: '#60a5fa' }}>In Progress: {inProgress}</span>
                          <span>Not Started: {notStarted}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

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

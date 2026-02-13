import { useState } from 'react';
import './BranchSequelTimeline.css';

// Frontend types mirroring backend branch-sequel.ts

interface DecisionPointFE {
  id: string;
  timelinePosition: number;
  phase: number;
  description: string;
  triggerConditions: Array<{
    condition: string;
    type: 'observable' | 'intelligence' | 'time_based' | 'force_ratio';
    threshold?: string;
  }>;
  options: Array<{
    id: string;
    description: string;
    branchPlanId?: string;
  }>;
  priority: 'critical' | 'important' | 'routine';
  decisionAuthority: string;
  wargamingSourceId?: string;
  timeAvailable: string;
}

type ContingencyTypeFE = 'branch' | 'sequel';

interface BranchPlanFE {
  id: string;
  parentCoaId: string;
  type: ContingencyTypeFE;
  name: string;
  description: string;
  triggeredByDecisionPointId: string;
  activationCondition: string;
  keyTasks: string[];
  additionalResources: Array<{ type: string; quantity: number; description: string }>;
  timelineImpact: string;
  riskAssessment: string;
  planningStatus: 'identified' | 'outlined' | 'fully_planned';
  planningPriority: 'high' | 'medium' | 'low';
}

interface BranchSequelSetFE {
  coaId: string;
  decisionPoints: DecisionPointFE[];
  branches: BranchPlanFE[];
  sequels: BranchPlanFE[];
  coverageSummary: string;
  coverageGaps: string[];
}

interface BranchSequelTimelineProps {
  branchSequelSet: BranchSequelSetFE;
  phases: Array<{ number: number; name: string }>;
  onBranchSelect?: (branch: BranchPlanFE) => void;
}

export function BranchSequelTimeline({
  branchSequelSet,
  phases,
  onBranchSelect,
}: BranchSequelTimelineProps) {
  const [expandedDecisionPointId, setExpandedDecisionPointId] = useState<string | null>(null);
  const [sidePanelBranch, setSidePanelBranch] = useState<BranchPlanFE | null>(null);

  const handleDiamondClick = (dpId: string) => {
    setExpandedDecisionPointId((prev) => (prev === dpId ? null : dpId));
  };

  const handleBranchCardClick = (branch: BranchPlanFE) => {
    setSidePanelBranch(branch);
    if (onBranchSelect) {
      onBranchSelect(branch);
    }
  };

  const closeSidePanel = () => {
    setSidePanelBranch(null);
  };

  const getBranchesForDecisionPoint = (dpId: string): BranchPlanFE[] => {
    return branchSequelSet.branches.filter((b) => b.triggeredByDecisionPointId === dpId);
  };

  const getSequelsForDecisionPoint = (dpId: string): BranchPlanFE[] => {
    return branchSequelSet.sequels.filter((s) => s.triggeredByDecisionPointId === dpId);
  };

  return (
    <div className="branch-sequel-timeline">
      <div className="timeline-header">
        <h3>Execution Timeline with Decision Points</h3>
        <div className="coverage-summary">{branchSequelSet.coverageSummary}</div>
        {branchSequelSet.coverageGaps.length > 0 && (
          <div className="coverage-gaps">
            <strong>Coverage Gaps:</strong>
            <ul>
              {branchSequelSet.coverageGaps.map((gap, idx) => (
                <li key={idx}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="timeline-container">
        {/* Phase blocks */}
        <div className="phase-blocks">
          {phases.map((phase) => (
            <div key={phase.number} className="phase-block">
              <div className="phase-number">Phase {phase.number}</div>
              <div className="phase-name">{phase.name}</div>
            </div>
          ))}
        </div>

        {/* Decision points as diamonds */}
        <div className="decision-points-layer">
          {branchSequelSet.decisionPoints.map((dp) => {
            const isExpanded = expandedDecisionPointId === dp.id;
            const branches = getBranchesForDecisionPoint(dp.id);
            const sequels = getSequelsForDecisionPoint(dp.id);

            // Position diamond based on timeline position
            const leftPercent = (dp.timelinePosition / phases.length) * 100;

            return (
              <div
                key={dp.id}
                className="decision-point-container"
                style={{ left: `${leftPercent}%` }}
              >
                <div
                  className={`decision-point-diamond priority-${dp.priority}`}
                  onClick={() => handleDiamondClick(dp.id)}
                  title={dp.description}
                >
                  <div className="diamond-inner">{branches.length + sequels.length}</div>
                </div>

                {/* Inline expansion panel */}
                {isExpanded && (
                  <div className="inline-expansion-panel">
                    <div className="expansion-header">
                      <h4>{dp.description}</h4>
                    </div>

                    <div className="expansion-section">
                      <strong>Trigger Conditions:</strong>
                      <ul>
                        {dp.triggerConditions.map((tc, idx) => (
                          <li key={idx}>
                            [{tc.type}] {tc.condition}
                            {tc.threshold && ` (threshold: ${tc.threshold})`}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="expansion-section">
                      <strong>Decision Authority:</strong> {dp.decisionAuthority}
                    </div>

                    <div className="expansion-section">
                      <strong>Time Available:</strong> {dp.timeAvailable}
                    </div>

                    {branches.length > 0 && (
                      <div className="expansion-section">
                        <strong>Branch Plans:</strong>
                        <div className="branch-option-cards">
                          {branches.map((branch) => (
                            <div
                              key={branch.id}
                              className={`branch-option-card branch-type-${branch.type}`}
                              onClick={() => handleBranchCardClick(branch)}
                            >
                              <div className="branch-card-name">{branch.name}</div>
                              <div className="branch-card-condition">
                                {branch.activationCondition}
                              </div>
                              <div
                                className={`planning-status-badge status-${branch.planningStatus}`}
                              >
                                {branch.planningStatus}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sequels.length > 0 && (
                      <div className="expansion-section">
                        <strong>Sequel Plans:</strong>
                        <div className="branch-option-cards">
                          {sequels.map((sequel) => (
                            <div
                              key={sequel.id}
                              className={`branch-option-card branch-type-${sequel.type}`}
                              onClick={() => handleBranchCardClick(sequel)}
                            >
                              <div className="branch-card-name">{sequel.name}</div>
                              <div className="branch-card-condition">
                                {sequel.activationCondition}
                              </div>
                              <div
                                className={`planning-status-badge status-${sequel.planningStatus}`}
                              >
                                {sequel.planningStatus}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Connection lines from diamond to branch cards */}
                    <svg className="connection-lines" width="100%" height="100">
                      {[...branches, ...sequels].map((_, idx) => (
                        <line
                          key={idx}
                          x1="50%"
                          y1="0"
                          x2={`${20 + idx * 30}%`}
                          y2="90"
                          stroke="var(--primary-blue)"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                      ))}
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sequel lines from end of timeline */}
        {branchSequelSet.sequels.length > 0 && (
          <div className="sequel-indicator">
            <div className="sequel-line" />
            <div className="sequel-label">
              {branchSequelSet.sequels.length} sequel(s) extend beyond current operation
            </div>
          </div>
        )}
      </div>

      {/* Side panel for detailed branch/sequel view */}
      {sidePanelBranch && (
        <div className="side-panel-overlay" onClick={closeSidePanel}>
          <div className="side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="side-panel-header">
              <h3>{sidePanelBranch.name}</h3>
              <button className="close-btn" onClick={closeSidePanel}>
                ✕
              </button>
            </div>

            <div className="side-panel-content">
              <div className="side-panel-section">
                <div className="section-label">Type</div>
                <div className={`branch-type-badge type-${sidePanelBranch.type}`}>
                  {sidePanelBranch.type === 'branch' ? 'Branch Plan' : 'Sequel Plan'}
                </div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Description</div>
                <div className="section-content">{sidePanelBranch.description}</div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Activation Condition</div>
                <div className="section-content">{sidePanelBranch.activationCondition}</div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Key Tasks</div>
                {sidePanelBranch.keyTasks.length > 0 ? (
                  <ul>
                    {sidePanelBranch.keyTasks.map((task, idx) => (
                      <li key={idx}>{task}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="section-content-empty">No tasks defined yet</div>
                )}
              </div>

              <div className="side-panel-section">
                <div className="section-label">Additional Resources</div>
                {sidePanelBranch.additionalResources.length > 0 ? (
                  <ul>
                    {sidePanelBranch.additionalResources.map((res, idx) => (
                      <li key={idx}>
                        {res.type}: {res.quantity} - {res.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="section-content-empty">No additional resources identified</div>
                )}
              </div>

              <div className="side-panel-section">
                <div className="section-label">Timeline Impact</div>
                <div className="section-content">{sidePanelBranch.timelineImpact}</div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Risk Assessment</div>
                <div className="section-content">{sidePanelBranch.riskAssessment}</div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Planning Status</div>
                <div className={`planning-status-badge status-${sidePanelBranch.planningStatus}`}>
                  {sidePanelBranch.planningStatus}
                </div>
              </div>

              <div className="side-panel-section">
                <div className="section-label">Planning Priority</div>
                <div className={`priority-badge priority-${sidePanelBranch.planningPriority}`}>
                  {sidePanelBranch.planningPriority}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

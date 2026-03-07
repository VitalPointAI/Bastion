/**
 * GovernanceGateDashboard Component
 *
 * Generalized gate status dashboard for any gate type.
 * Shows all governance gates with status, enforcement mode, and action buttons.
 * Supports both legacy MDMP GateDisplayData and new DecisionGate from context.
 */

import { useState, useMemo } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import { GateStatusBadge } from './GateStatusBadge';
import { PhaseProgressionBar } from './PhaseProgressionBar';
import type { PhaseProgressionData } from './PhaseProgressionBar';
import type { DecisionGate } from '../../lib/gate-service';
import './GovernanceGateDashboard.css';

// Legacy MDMP-specific interface (preserved for backward compatibility)
export interface GateDisplayData {
  gateId: string;
  gateType: string;
  phase: string;
  satisfied: boolean;
  satisfiedBy?: string;
  satisfiedAt?: string;
  proposalId?: number;
  description: string;
}

// Gate type labels for display
const GATE_TYPE_LABELS: Record<string, string> = {
  mdmp: 'MDMP',
  jpp: 'JPP',
  targeting: 'Targeting',
  assessment: 'Assessment',
  resource: 'Resource',
};

interface GovernanceGateDashboardProps {
  /** Legacy: mission ID */
  missionId?: string;
  /** Legacy: current MDMP phase */
  currentPhase?: string;
  /** Legacy: MDMP gate data */
  gates?: GateDisplayData[];
  /** Legacy: callback for MDMP gate satisfaction */
  onSatisfyGate?: (gateId: string) => void;
  /** New: filter by gate_type (e.g. 'mdmp', 'jpp') */
  gateFilter?: string;
  /** New: filter by tab */
  tabFilter?: string;
  /** New: callback when a DecisionGate is selected */
  onGateSelect?: (gate: DecisionGate) => void;
}

export function GovernanceGateDashboard({
  missionId,
  currentPhase,
  gates: legacyGates,
  onSatisfyGate,
  gateFilter,
  tabFilter,
  onGateSelect,
}: GovernanceGateDashboardProps) {
  const { gates: contextGates, loading, error, submitForApproval } = useDecisionGates(tabFilter);

  // Determine rendering mode: legacy MDMP vs new DecisionGate
  const useLegacyMode = legacyGates && legacyGates.length > 0;

  // === Legacy MDMP state ===
  const [selectedPhase, setSelectedPhase] = useState<string>(currentPhase || '');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // === New DecisionGate filtering ===
  const filteredContextGates = useMemo(() => {
    let filtered = contextGates;
    if (gateFilter) {
      filtered = filtered.filter((g) => g.gate_type === gateFilter);
    }
    if (filterStatus === 'approved') {
      filtered = filtered.filter((g) => g.status === 'approved');
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter((g) => g.status === 'pending' || g.status === 'submitted');
    } else if (filterStatus === 'rejected') {
      filtered = filtered.filter((g) => g.status === 'rejected');
    } else if (filterStatus === 'escalated') {
      filtered = filtered.filter((g) => g.status === 'escalated');
    }
    if (filterType !== 'all') {
      filtered = filtered.filter((g) => g.gate_type === filterType);
    }
    return filtered;
  }, [contextGates, gateFilter, filterType, filterStatus]);

  // Gate types from context gates for filter dropdown
  const contextGateTypes = useMemo(() => {
    const types = new Set(contextGates.map((g) => g.gate_type));
    return Array.from(types).sort();
  }, [contextGates]);

  // Build progression data from context gates (grouped by tab)
  const contextProgressionData = useMemo((): PhaseProgressionData[] => {
    if (useLegacyMode) return [];
    const tabGroups: Record<string, DecisionGate[]> = {};
    for (const gate of contextGates) {
      if (!tabGroups[gate.tab]) tabGroups[gate.tab] = [];
      tabGroups[gate.tab].push(gate);
    }
    return Object.entries(tabGroups).map(([tab, gates]) => ({
      phase: tab,
      label: tab.charAt(0).toUpperCase() + tab.slice(1),
      gatesTotal: gates.length,
      gatesSatisfied: gates.filter((g) => g.status === 'approved').length,
    }));
  }, [contextGates, useLegacyMode]);

  // === Legacy MDMP helpers ===
  const legacyPhaseProgressionData = useMemo((): PhaseProgressionData[] => {
    if (!legacyGates) return [];
    const phases = [
      { phase: 'phase_0_continuous', label: 'Phase 0: Continuous' },
      { phase: 'phase_1_receipt_of_mission', label: 'Phase 1: Receipt' },
      { phase: 'phase_2_mission_analysis', label: 'Phase 2: Analysis' },
      { phase: 'phase_3_coa_development', label: 'Phase 3: COA Dev' },
      { phase: 'phase_4_coa_analysis', label: 'Phase 4: COA Analysis' },
      { phase: 'phase_5_coa_comparison', label: 'Phase 5: COA Compare' },
      { phase: 'phase_6_coa_approval', label: 'Phase 6: COA Approval' },
      { phase: 'phase_7_orders_production', label: 'Phase 7: Orders' },
      { phase: 'phase_8_assessment', label: 'Phase 8: Assessment' },
    ];
    return phases.map((phase) => {
      const phaseGates = legacyGates.filter((g) => g.phase === phase.phase);
      return {
        phase: phase.phase,
        label: phase.label,
        gatesTotal: phaseGates.length,
        gatesSatisfied: phaseGates.filter((g) => g.satisfied).length,
      };
    });
  }, [legacyGates]);

  const filteredLegacyGates = useMemo(() => {
    if (!legacyGates) return [];
    let filtered = legacyGates.filter((gate) => gate.phase === selectedPhase);
    if (filterType !== 'all') {
      filtered = filtered.filter((gate) => gate.gateType === filterType);
    }
    if (filterStatus === 'satisfied') {
      filtered = filtered.filter((gate) => gate.satisfied);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter((gate) => !gate.satisfied);
    }
    return filtered;
  }, [legacyGates, selectedPhase, filterType, filterStatus]);

  const legacyGateTypes = useMemo(() => {
    if (!legacyGates) return [];
    const types = new Set(legacyGates.map((g) => g.gateType));
    return Array.from(types).sort();
  }, [legacyGates]);

  const getGateTypeBadgeClass = (gateType: string): string => {
    const typeMap: Record<string, string> = {
      RedTeam: 'red-team',
      Commander: 'commander',
      Legal: 'legal',
      Coalition: 'coalition',
      Resource: 'resource',
      Temporal: 'temporal',
      mdmp: 'mdmp',
      jpp: 'jpp',
      targeting: 'targeting',
      assessment: 'assessment',
    };
    return typeMap[gateType] || 'default';
  };

  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(parseInt(timestamp) / 1_000_000);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatISOTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handlePhaseClick = (phase: string) => {
    setSelectedPhase(phase);
  };

  // === Render: Legacy MDMP mode ===
  if (useLegacyMode) {
    const selectedPhaseData = legacyPhaseProgressionData.find((p) => p.phase === selectedPhase);
    return (
      <div className="governance-gate-dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <h2>MDMP Governance Gates</h2>
            <div className="mission-info">
              <span className="mission-label">Mission:</span>
              <span className="mission-id">{missionId}</span>
            </div>
          </div>
        </header>

        <PhaseProgressionBar
          currentPhase={currentPhase || ''}
          phases={legacyPhaseProgressionData}
          onPhaseClick={handlePhaseClick}
        />

        <div className="selected-phase-info">
          <h3>{selectedPhaseData?.label || selectedPhase}</h3>
          <div className="phase-stats">
            <div className="stat">
              <span className="stat-value">{filteredLegacyGates.length}</span>
              <span className="stat-label">Total Gates</span>
            </div>
            <div className="stat success">
              <span className="stat-value">
                {filteredLegacyGates.filter((g) => g.satisfied).length}
              </span>
              <span className="stat-label">Satisfied</span>
            </div>
            <div className="stat warning">
              <span className="stat-value">
                {filteredLegacyGates.filter((g) => !g.satisfied).length}
              </span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        </div>

        <div className="gate-filters">
          <div className="filter-group">
            <label htmlFor="type-filter">Gate Type:</label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              {legacyGateTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="satisfied">Satisfied</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="gate-cards-grid">
          {filteredLegacyGates.length === 0 ? (
            <div className="no-gates">
              <p>No gates found for the selected filters.</p>
            </div>
          ) : (
            filteredLegacyGates.map((gate) => (
              <div
                key={gate.gateId}
                className={`gate-card ${gate.satisfied ? 'satisfied' : 'pending'}`}
              >
                <div className="gate-card-header">
                  <span className={`gate-type-badge ${getGateTypeBadgeClass(gate.gateType)}`}>
                    {gate.gateType}
                  </span>
                  <span className={`gate-status-indicator ${gate.satisfied ? 'satisfied' : 'pending'}`}>
                    {gate.satisfied ? 'Satisfied' : 'Pending'}
                  </span>
                </div>
                <div className="gate-card-body">
                  <p className="gate-description">{gate.description}</p>
                  {gate.satisfied && gate.satisfiedBy && (
                    <div className="gate-satisfaction-info">
                      <div className="info-row">
                        <span className="info-label">Satisfied by:</span>
                        <span className="info-value">{gate.satisfiedBy}</span>
                      </div>
                      {gate.satisfiedAt && (
                        <div className="info-row">
                          <span className="info-label">Satisfied at:</span>
                          <span className="info-value">{formatTimestamp(gate.satisfiedAt)}</span>
                        </div>
                      )}
                      {gate.proposalId !== undefined && (
                        <div className="info-row">
                          <span className="info-label">Proposal ID:</span>
                          <span className="info-value proposal-link">#{gate.proposalId}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!gate.satisfied && onSatisfyGate && (
                  <div className="gate-card-footer">
                    <button
                      className="satisfy-gate-btn"
                      onClick={() => onSatisfyGate(gate.gateId)}
                    >
                      Initiate Satisfaction Proposal
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // === Render: New generalized DecisionGate mode ===
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'escalated', label: 'Escalated' },
  ];

  const totalGates = filteredContextGates.length;
  const approvedCount = filteredContextGates.filter((g) => g.status === 'approved').length;
  const pendingCount = filteredContextGates.filter(
    (g) => g.status === 'pending' || g.status === 'submitted'
  ).length;
  const rejectedCount = filteredContextGates.filter((g) => g.status === 'rejected').length;

  return (
    <div className="governance-gate-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h2>Governance Gates{gateFilter ? `: ${GATE_TYPE_LABELS[gateFilter] || gateFilter}` : ''}</h2>
          {tabFilter && (
            <div className="mission-info">
              <span className="mission-label">Tab:</span>
              <span className="mission-id">{tabFilter}</span>
            </div>
          )}
        </div>
        {loading && <span className="loading-indicator">Loading...</span>}
      </header>

      {error && (
        <div className="dashboard-error">
          <p>Failed to load gates: {error}</p>
        </div>
      )}

      {/* Progression bar for context gates (grouped by tab) */}
      {contextProgressionData.length > 0 && (
        <PhaseProgressionBar
          currentPhase={contextProgressionData[0]?.phase || ''}
          phases={contextProgressionData}
          onPhaseClick={handlePhaseClick}
        />
      )}

      {/* Stats summary */}
      <div className="selected-phase-info">
        <h3>Gate Summary</h3>
        <div className="phase-stats">
          <div className="stat">
            <span className="stat-value">{totalGates}</span>
            <span className="stat-label">Total Gates</span>
          </div>
          <div className="stat success">
            <span className="stat-value">{approvedCount}</span>
            <span className="stat-label">Approved</span>
          </div>
          <div className="stat warning">
            <span className="stat-value">{pendingCount}</span>
            <span className="stat-label">Pending</span>
          </div>
          {rejectedCount > 0 && (
            <div className="stat danger">
              <span className="stat-value">{rejectedCount}</span>
              <span className="stat-label">Rejected</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="gate-filters">
        {!gateFilter && contextGateTypes.length > 1 && (
          <div className="filter-group">
            <label htmlFor="type-filter">Gate Type:</label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              {contextGateTypes.map((type) => (
                <option key={type} value={type}>
                  {GATE_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gate Cards Grid */}
      <div className="gate-cards-grid">
        {filteredContextGates.length === 0 ? (
          <div className="no-gates">
            <p>{loading ? 'Loading gates...' : 'No gates found for the selected filters.'}</p>
          </div>
        ) : (
          filteredContextGates.map((gate) => (
            <div
              key={gate.id}
              className={`gate-card gate-card--${gate.status}`}
              onClick={() => onGateSelect?.(gate)}
              role={onGateSelect ? 'button' : undefined}
              tabIndex={onGateSelect ? 0 : undefined}
            >
              <div className="gate-card-header">
                <span className={`gate-type-badge ${getGateTypeBadgeClass(gate.gate_type)}`}>
                  {GATE_TYPE_LABELS[gate.gate_type] || gate.gate_type}
                </span>
                <GateStatusBadge status={gate.status} />
              </div>

              <div className="gate-card-body">
                <div className="gate-card-meta">
                  <span className="meta-tag">{gate.tab}</span>
                  <span className={`enforcement-badge enforcement-${gate.enforcement}`}>
                    {gate.enforcement}
                  </span>
                  {gate.mode === 'training' && (
                    <span className="training-badge">TRAINING</span>
                  )}
                </div>

                {gate.target_item_title && (
                  <p className="gate-description">{gate.target_item_title}</p>
                )}

                {gate.deadline_at && (
                  <div className="info-row">
                    <span className="info-label">Deadline:</span>
                    <span className="info-value">{formatISOTimestamp(gate.deadline_at)}</span>
                  </div>
                )}

                {gate.decided_by && (
                  <div className="gate-satisfaction-info">
                    <div className="info-row">
                      <span className="info-label">Decided by:</span>
                      <span className="info-value">{gate.decided_by}</span>
                    </div>
                    {gate.decided_at && (
                      <div className="info-row">
                        <span className="info-label">Decided at:</span>
                        <span className="info-value">{formatISOTimestamp(gate.decided_at)}</span>
                      </div>
                    )}
                  </div>
                )}

                {gate.proposal_id !== null && (
                  <div className="info-row">
                    <span className="info-label">Proposal:</span>
                    <span className="info-value proposal-link">#{gate.proposal_id}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

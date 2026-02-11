/**
 * GovernanceGateDashboard Component
 *
 * Gate status dashboard for MDMP phases.
 * Shows all governance gates for a mission with satisfaction status and action buttons.
 */

import { useState, useMemo } from 'react';
import { PhaseProgressionBar, PhaseProgressionData } from './PhaseProgressionBar';
import './GovernanceGateDashboard.css';

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

interface GovernanceGateDashboardProps {
  missionId: string;
  currentPhase: string;
  gates: GateDisplayData[];
  onSatisfyGate: (gateId: string) => void;
}

export function GovernanceGateDashboard({
  missionId,
  currentPhase,
  gates,
  onSatisfyGate,
}: GovernanceGateDashboardProps) {
  const [selectedPhase, setSelectedPhase] = useState<string>(currentPhase);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Calculate phase progression data
  const phaseProgressionData = useMemo((): PhaseProgressionData[] => {
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
      const phaseGates = gates.filter((g) => g.phase === phase.phase);
      return {
        phase: phase.phase,
        label: phase.label,
        gatesTotal: phaseGates.length,
        gatesSatisfied: phaseGates.filter((g) => g.satisfied).length,
      };
    });
  }, [gates]);

  // Filter gates by selected phase and filters
  const filteredGates = useMemo(() => {
    let filtered = gates.filter((gate) => gate.phase === selectedPhase);

    if (filterType !== 'all') {
      filtered = filtered.filter((gate) => gate.gateType === filterType);
    }

    if (filterStatus === 'satisfied') {
      filtered = filtered.filter((gate) => gate.satisfied);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter((gate) => !gate.satisfied);
    }

    return filtered;
  }, [gates, selectedPhase, filterType, filterStatus]);

  // Get unique gate types for filter
  const gateTypes = useMemo(() => {
    const types = new Set(gates.map((g) => g.gateType));
    return Array.from(types).sort();
  }, [gates]);

  // Gate type styling
  const getGateTypeBadgeClass = (gateType: string): string => {
    const typeMap: Record<string, string> = {
      RedTeam: 'red-team',
      Commander: 'commander',
      Legal: 'legal',
      Coalition: 'coalition',
      Resource: 'resource',
      Temporal: 'temporal',
    };
    return typeMap[gateType] || 'default';
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(parseInt(timestamp) / 1_000_000); // Convert nanoseconds to milliseconds
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handlePhaseClick = (phase: string) => {
    setSelectedPhase(phase);
  };

  const selectedPhaseData = phaseProgressionData.find((p) => p.phase === selectedPhase);

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

      {/* Phase Progression Bar */}
      <PhaseProgressionBar
        currentPhase={currentPhase}
        phases={phaseProgressionData}
        onPhaseClick={handlePhaseClick}
      />

      {/* Selected Phase Info */}
      <div className="selected-phase-info">
        <h3>{selectedPhaseData?.label || selectedPhase}</h3>
        <div className="phase-stats">
          <div className="stat">
            <span className="stat-value">{filteredGates.length}</span>
            <span className="stat-label">Total Gates</span>
          </div>
          <div className="stat success">
            <span className="stat-value">
              {filteredGates.filter((g) => g.satisfied).length}
            </span>
            <span className="stat-label">Satisfied</span>
          </div>
          <div className="stat warning">
            <span className="stat-value">
              {filteredGates.filter((g) => !g.satisfied).length}
            </span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="gate-filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Gate Type:</label>
          <select
            id="type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {gateTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
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

      {/* Gate Cards Grid */}
      <div className="gate-cards-grid">
        {filteredGates.length === 0 ? (
          <div className="no-gates">
            <p>No gates found for the selected filters.</p>
          </div>
        ) : (
          filteredGates.map((gate) => (
            <div
              key={gate.gateId}
              className={`gate-card ${gate.satisfied ? 'satisfied' : 'pending'}`}
            >
              <div className="gate-card-header">
                <span className={`gate-type-badge ${getGateTypeBadgeClass(gate.gateType)}`}>
                  {gate.gateType}
                </span>
                <span className={`gate-status-badge ${gate.satisfied ? 'satisfied' : 'pending'}`}>
                  {gate.satisfied ? '✓ Satisfied' : '✗ Pending'}
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

              {!gate.satisfied && (
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

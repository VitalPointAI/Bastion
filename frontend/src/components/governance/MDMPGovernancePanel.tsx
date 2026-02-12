/**
 * MDMPGovernancePanel Component
 *
 * Container component for MDMP governance UI.
 * Wires service layer to presentational components with tab-based navigation.
 */

import { useState, useEffect, useCallback } from 'react';
import { AssumptionTracker } from './AssumptionTracker';
import type { AssumptionDisplayData } from './AssumptionTracker';
import { GovernanceGateDashboard } from './GovernanceGateDashboard';
import type { GateDisplayData } from './GovernanceGateDashboard';
import { PhaseProgressionBar } from './PhaseProgressionBar';
import type { PhaseProgressionData } from './PhaseProgressionBar';
import { CommanderGuidanceForm } from './CommanderGuidanceForm';
import * as mdmpService from '../../lib/mdmp-service';
import type { CommanderGuidanceData } from '../../types/dao';
import './MDMPGovernancePanel.css';

interface MDMPGovernancePanelProps {
  missionId: string;
  daoId: string;
  userDID: string;
}

type TabView = 'phase-overview' | 'assumptions' | 'commander-guidance' | 'decision-brief';

export function MDMPGovernancePanel({
  missionId,
  daoId,
  userDID,
}: MDMPGovernancePanelProps) {
  const [activeTab, setActiveTab] = useState<TabView>('phase-overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow state
  const [workflowExists, setWorkflowExists] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('phase_0_continuous');
  const [gates, setGates] = useState<GateDisplayData[]>([]);
  const [assumptions, setAssumptions] = useState<AssumptionDisplayData[]>([]);
  const [phaseProgression, setPhaseProgression] = useState<PhaseProgressionData[]>([]);

  // Load workflow state
  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workflow = await mdmpService.getWorkflow(missionId);

      if (workflow) {
        setWorkflowExists(true);
        setCurrentPhase(workflow.workflow.currentPhase);
        setGates(workflow.gates);
        setAssumptions(workflow.assumptions);
        setPhaseProgression(workflow.phaseProgression);
      } else {
        setWorkflowExists(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
      setWorkflowExists(false);
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  // Create workflow handler
  const handleCreateWorkflow = async () => {
    try {
      setLoading(true);
      setError(null);
      await mdmpService.createWorkflow({
        missionId,
        daoId,
        createdBy: userDID,
      });
      await loadWorkflow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  // Assumption handlers
  const handleAcceptAssumption = async (assumptionId: string) => {
    try {
      await mdmpService.acceptAssumption(missionId, assumptionId, userDID, userDID);
      await loadWorkflow(); // Refresh
    } catch (err) {
      console.error('Failed to accept assumption:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept assumption');
    }
  };

  const handleRejectAssumption = async (assumptionId: string) => {
    try {
      // Note: Backend doesn't have reject endpoint yet
      console.log('Reject assumption:', assumptionId);
      // TODO: Implement reject endpoint in backend
      alert('Assumption rejection not yet implemented in backend API');
    } catch (err) {
      console.error('Failed to reject assumption:', err);
    }
  };

  const handleInvalidateAssumption = async (assumptionId: string, evidence: string) => {
    try {
      // Note: Backend doesn't have invalidate endpoint yet
      console.log('Invalidate assumption:', assumptionId, evidence);
      // TODO: Implement invalidate endpoint in backend
      alert('Assumption invalidation not yet implemented in backend API');
    } catch (err) {
      console.error('Failed to invalidate assumption:', err);
    }
  };

  // Gate handler
  const handleSatisfyGate = async (gateId: string) => {
    try {
      // Gate satisfaction creates a proposal through the DAO system
      // For now, just log the action
      console.log('Satisfy gate:', gateId);
      alert(`Gate satisfaction would create a proposal in the DAO system.\n\nGate ID: ${gateId}\nThis feature requires DAO proposal integration.`);

      // In production, this would:
      // 1. Create a GateSatisfaction proposal in the DAO
      // 2. After approval, call mdmpService.satisfyGate(missionId, gateId, userDID, proposalId)
    } catch (err) {
      console.error('Failed to satisfy gate:', err);
    }
  };

  // Commander guidance handler
  const handleCommanderGuidanceSubmit = async (guidance: CommanderGuidanceData) => {
    try {
      console.log('Submit commander guidance:', guidance);
      alert(`Commander guidance would create a CommanderGuidance proposal in the DAO system.\n\nGuidance: ${guidance.guidance_text.substring(0, 100)}...\n\nThis feature requires DAO proposal integration.`);

      // In production, this would:
      // 1. Create a CommanderGuidance proposal via governance-service
      // 2. Link proposal to MDMP workflow
    } catch (err) {
      console.error('Failed to submit commander guidance:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit guidance');
    }
  };

  // Phase click handler for PhaseProgressionBar navigation
  const handlePhaseClick = (phase: string) => {
    console.log('Navigate to phase:', phase);
    // Phase navigation would reload workflow for the selected phase
    // For now, just log the action
  };

  // Render loading state
  if (loading && !workflowExists) {
    return (
      <div className="mdmp-governance-panel loading">
        <div className="loading-content">Loading MDMP workflow...</div>
      </div>
    );
  }

  // Render no workflow state
  if (!workflowExists) {
    return (
      <div className="mdmp-governance-panel no-workflow">
        <header className="panel-header">
          <h2>MDMP Workflow</h2>
          <div className="mission-info">
            <span className="mission-label">Mission:</span>
            <span className="mission-id">{missionId}</span>
          </div>
        </header>
        <div className="no-workflow-content">
          <div className="no-workflow-message">
            <h3>No MDMP Workflow Found</h3>
            <p>This mission does not have an active MDMP workflow yet.</p>
            <button className="create-workflow-btn" onClick={handleCreateWorkflow}>
              Create MDMP Workflow
            </button>
          </div>
        </div>
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // Render workflow view with tabs
  return (
    <div className="mdmp-governance-panel">
      <header className="panel-header">
        <h2>MDMP Workflow</h2>
        <div className="mission-info">
          <span className="mission-label">Mission:</span>
          <span className="mission-id">{missionId}</span>
          <span className="phase-label">Current Phase:</span>
          <span className="phase-value">{currentPhase}</span>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'phase-overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('phase-overview')}
        >
          Phase Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'assumptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('assumptions')}
        >
          Assumptions
        </button>
        <button
          className={`tab-btn ${activeTab === 'commander-guidance' ? 'active' : ''}`}
          onClick={() => setActiveTab('commander-guidance')}
        >
          Commander Guidance
        </button>
        <button
          className={`tab-btn ${activeTab === 'decision-brief' ? 'active' : ''}`}
          onClick={() => setActiveTab('decision-brief')}
        >
          Decision Brief
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'phase-overview' && (
          <div className="phase-overview-tab">
            <PhaseProgressionBar
              phases={phaseProgression}
              currentPhase={currentPhase}
              onPhaseClick={handlePhaseClick}
            />
            <GovernanceGateDashboard
              missionId={missionId}
              currentPhase={currentPhase}
              gates={gates}
              onSatisfyGate={handleSatisfyGate}
            />
          </div>
        )}

        {activeTab === 'assumptions' && (
          <div className="assumptions-tab">
            <AssumptionTracker
              missionId={missionId}
              assumptions={assumptions}
              onAccept={handleAcceptAssumption}
              onReject={handleRejectAssumption}
              onInvalidate={handleInvalidateAssumption}
            />
          </div>
        )}

        {activeTab === 'commander-guidance' && (
          <div className="commander-guidance-tab">
            <CommanderGuidanceForm
              daoId={daoId}
              missionId={missionId}
              existingAssumptions={assumptions.map(a => ({ id: a.id, description: a.description }))}
              onSubmit={handleCommanderGuidanceSubmit}
            />
          </div>
        )}

        {activeTab === 'decision-brief' && (
          <div className="decision-brief-tab">
            <div className="decision-brief-placeholder">
              <div className="placeholder-icon">📋</div>
              <h3>Decision Brief Unavailable</h3>
              <p>
                The Decision Brief will be available after the Phase 6 COA Approval gate is satisfied.
              </p>
              <p className="placeholder-note">
                <strong>Note:</strong> There is currently no GET /decision-brief endpoint in the backend API.
                The Decision Brief Generator produces briefing data when COAs are ready for approval.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button className="dismiss-btn" onClick={() => setError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

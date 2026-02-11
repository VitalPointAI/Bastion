/**
 * MDMP Service Module
 *
 * Client for MDMP governance API endpoints.
 * Provides typed methods for workflow management, gate operations, phase transitions, and assumptions.
 */

import type { AssumptionDisplayData } from '../components/governance/AssumptionTracker';
import type { GateDisplayData } from '../components/governance/GovernanceGateDashboard';
import type { PhaseProgressionData } from '../components/governance/PhaseProgressionBar';

const API_BASE = '/api/mdmp';

// Helper for fetch with error handling
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// ============================================================================
// Workflow Management
// ============================================================================

export interface CreateWorkflowParams {
  missionId: string;
  daoId: string;
  createdBy: string;
}

export interface WorkflowState {
  missionId: string;
  daoId: string;
  currentPhase: string;
  createdAt: number;
  createdBy: string;
  phaseGates: Record<string, any>;
  assumptions: any[];
  phaseTransitions: any[];
}

export async function createWorkflow(params: CreateWorkflowParams): Promise<WorkflowState> {
  const response = await fetchJson<{ success: boolean; workflow: any }>(`${API_BASE}/workflows`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return response.workflow;
}

export async function getWorkflow(missionId: string): Promise<{
  workflow: WorkflowState;
  gates: GateDisplayData[];
  assumptions: AssumptionDisplayData[];
  phaseProgression: PhaseProgressionData[];
} | null> {
  try {
    const response = await fetchJson<{ success: boolean; workflow: any }>(
      `${API_BASE}/workflows/${encodeURIComponent(missionId)}`
    );

    const workflow = response.workflow;

    // Transform phaseGates object to GateDisplayData array
    const gates: GateDisplayData[] = Object.entries(workflow.phaseGates || {}).map(
      ([gateId, gate]: [string, any]) => transformGate(gateId, gate)
    );

    // Transform assumptions to AssumptionDisplayData array
    const assumptions: AssumptionDisplayData[] = (workflow.assumptions || []).map(
      (assumption: any) => transformAssumption(assumption)
    );

    // Build phase progression data
    const phaseProgression: PhaseProgressionData[] = transformWorkflowToPhaseProgression(workflow, gates);

    return {
      workflow,
      gates,
      assumptions,
      phaseProgression,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Gate Management
// ============================================================================

export async function registerPhaseGates(missionId: string, phase: string): Promise<void> {
  await fetchJson(`${API_BASE}/workflows/${encodeURIComponent(missionId)}/gates`, {
    method: 'POST',
    body: JSON.stringify({ phase }),
  });
}

export async function satisfyGate(
  missionId: string,
  gateId: string,
  satisfiedBy: string,
  proposalId?: number
): Promise<void> {
  await fetchJson(`${API_BASE}/workflows/${encodeURIComponent(missionId)}/gates/${encodeURIComponent(gateId)}`, {
    method: 'PUT',
    body: JSON.stringify({ satisfiedBy, proposalId }),
  });
}

// ============================================================================
// Phase Transitions
// ============================================================================

export async function requestPhaseTransition(
  missionId: string,
  toPhase: string,
  requestedBy: string,
  proposalId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetchJson(`${API_BASE}/workflows/${encodeURIComponent(missionId)}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ toPhase, requestedBy, proposalId }),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Phase transition failed',
    };
  }
}

// ============================================================================
// Assumption Management
// ============================================================================

export async function getAssumptions(missionId: string): Promise<AssumptionDisplayData[]> {
  const response = await fetchJson<{ success: boolean; assumptions: any[] }>(
    `${API_BASE}/workflows/${encodeURIComponent(missionId)}/assumptions`
  );
  return response.assumptions.map(transformAssumption);
}

export async function registerAssumption(
  missionId: string,
  description: string,
  source: string
): Promise<AssumptionDisplayData> {
  const response = await fetchJson<{ success: boolean; assumption: any }>(
    `${API_BASE}/workflows/${encodeURIComponent(missionId)}/assumptions`,
    {
      method: 'POST',
      body: JSON.stringify({ description, source }),
    }
  );
  return transformAssumption(response.assumption);
}

export async function acceptAssumption(
  missionId: string,
  assumptionId: string,
  acceptedBy: string,
  riskOwner: string
): Promise<void> {
  await fetchJson(
    `${API_BASE}/workflows/${encodeURIComponent(missionId)}/assumptions/${encodeURIComponent(assumptionId)}/accept`,
    {
      method: 'PUT',
      body: JSON.stringify({ acceptedBy, riskOwner }),
    }
  );
}

// ============================================================================
// Activity Registry
// ============================================================================

export interface MDMPActivity {
  id: string;
  phase: string;
  name: string;
  description: string;
  category: string;
  defaultAuthority: string;
  outputs: string[];
}

export async function getAllActivities(): Promise<MDMPActivity[]> {
  const response = await fetchJson<{ success: boolean; activities: MDMPActivity[]; total: number }>(
    `${API_BASE}/activities`
  );
  return response.activities;
}

export async function getActivityById(id: string): Promise<MDMPActivity | null> {
  try {
    const response = await fetchJson<{ success: boolean; activity: MDMPActivity }>(
      `${API_BASE}/activities/${encodeURIComponent(id)}`
    );
    return response.activity;
  } catch {
    return null;
  }
}

export interface PhaseStatistics {
  phase: string;
  totalActivities: number;
  byCategory: Record<string, number>;
  byAuthority: Record<string, number>;
}

export async function getPhaseStatistics(phase: string): Promise<PhaseStatistics> {
  const response = await fetchJson<{ success: boolean; phase: string; statistics: PhaseStatistics }>(
    `${API_BASE}/phases/${encodeURIComponent(phase)}/statistics`
  );
  return response.statistics;
}

// ============================================================================
// Transform Functions (Backend → Frontend)
// ============================================================================

function transformAssumption(raw: any): AssumptionDisplayData {
  return {
    id: raw.id || raw.assumptionId || '',
    description: raw.description || '',
    sensitivity: raw.sensitivity || 'Low',
    validationMethod: raw.validationMethod || raw.validation_method || 'Not specified',
    acceptedBy: raw.acceptedBy || raw.accepted_by || undefined,
    status: raw.status || 'Pending',
    sourcePhase: raw.sourcePhase || raw.source_phase || 'Unknown',
  };
}

function transformGate(gateId: string, raw: any): GateDisplayData {
  return {
    gateId,
    gateType: raw.gateType || raw.gate_type || 'Unknown',
    phase: raw.phase || 'Unknown',
    satisfied: raw.satisfied || false,
    satisfiedBy: raw.satisfiedBy || raw.satisfied_by || undefined,
    satisfiedAt: raw.satisfiedAt || raw.satisfied_at || undefined,
    proposalId: raw.proposalId || raw.proposal_id || undefined,
    description: raw.description || '',
  };
}

function transformWorkflowToPhaseProgression(workflow: WorkflowState, gates: GateDisplayData[]): PhaseProgressionData[] {
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
}

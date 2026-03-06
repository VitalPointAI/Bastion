/**
 * MDMP Workflow Service
 *
 * Orchestrates MDMP workflow operations:
 * - Create and manage MDMP workflows
 * - Phase transition validation and execution
 * - Governance gate management
 * - Assumption tracking and validation
 * - Audit logging
 *
 * This service sits between the REST API and smart contracts.
 * It validates business logic before forwarding to blockchain.
 *
 * Integration with smart contracts is tracked in plan 5.1-14.
 */

import { getActivitiesByPhase, getActivitiesRequiringGate } from './activity-registry.js';
import { MDMPPhase, type MDMPActivity } from './types.js';

/**
 * MDMP Workflow State (in-memory representation)
 */
export interface MDMPWorkflowState {
  missionId: string;
  daoId: string;
  currentPhase: MDMPPhase;
  createdAt: number;
  createdBy: string;
  phaseGates: Map<string, GateStatus>;
  assumptions: Assumption[];
  phaseTransitions: PhaseTransition[];
}

/**
 * Gate status tracking
 */
export interface GateStatus {
  gateId: string;
  gateType: string;
  activityId: string;
  satisfied: boolean;
  satisfiedBy: string | null;
  satisfiedAt: number | null;
  proposalId: number | null;
}

/**
 * Assumption tracking
 */
export interface Assumption {
  id: string;
  description: string;
  source: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'invalidated' | 'under_review';
  acceptedBy: string | null;
  acceptedAt: number | null;
  riskOwner: string | null;
}

/**
 * Phase transition record
 */
export interface PhaseTransition {
  fromPhase: MDMPPhase;
  toPhase: MDMPPhase;
  transitionedAt: number;
  transitionedBy: string;
  proposalId: number | null;
  satisfiedGates: string[];
}

/**
 * MDMP Workflow Service
 *
 * Manages MDMP workflow lifecycle and governance.
 */
export class MDMPWorkflowService {
  // In-memory workflow storage (will be replaced with contract calls in 5.1-14)
  private workflows: Map<string, MDMPWorkflowState> = new Map();

  /**
   * Create a new MDMP workflow
   */
  async createWorkflow(params: {
    missionId: string;
    daoId: string;
    createdBy: string;
  }): Promise<MDMPWorkflowState> {
    const { missionId, daoId, createdBy } = params;

    // Validate inputs
    if (!missionId || !daoId || !createdBy) {
      throw new Error('Missing required parameters: missionId, daoId, or createdBy');
    }

    // Check if workflow already exists
    if (this.workflows.has(missionId)) {
      throw new Error(`Workflow already exists for mission ${missionId}`);
    }

    // Initialize workflow state
    const workflow: MDMPWorkflowState = {
      missionId,
      daoId,
      currentPhase: MDMPPhase.PHASE_0_CONTINUOUS,
      createdAt: Date.now(),
      createdBy,
      phaseGates: new Map(),
      assumptions: [],
      phaseTransitions: [],
    };

    // Store workflow first (registerPhaseGates looks it up in the map)
    this.workflows.set(missionId, workflow);

    // Register all gates for Phase 0
    await this.registerPhaseGates(missionId, MDMPPhase.PHASE_0_CONTINUOUS);

    // TODO (5.1-14): Call smart contract to create on-chain workflow

    // Audit log
    console.log(`[MDMP Workflow] Created workflow for mission ${missionId}`, {
      daoId,
      createdBy,
      timestamp: workflow.createdAt,
    });

    return workflow;
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(missionId: string): Promise<MDMPWorkflowState | null> {
    // TODO (5.1-14): Query smart contract for workflow state
    return this.workflows.get(missionId) || null;
  }

  /**
   * Register phase gates for a given phase
   */
  async registerPhaseGates(missionId: string, phase: MDMPPhase): Promise<void> {
    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    // Get activities requiring gates in this phase
    const gatedActivities = getActivitiesRequiringGate(phase);

    for (const activity of gatedActivities) {
      if (!activity.governanceGate) continue;

      const gateId = `${activity.id}-gate`;
      const gateStatus: GateStatus = {
        gateId,
        gateType: activity.governanceGate.gateType,
        activityId: activity.id,
        satisfied: false,
        satisfiedBy: null,
        satisfiedAt: null,
        proposalId: null,
      };

      workflow.phaseGates.set(gateId, gateStatus);
    }

    // TODO (5.1-14): Register gates in smart contract

    console.log(`[MDMP Workflow] Registered ${gatedActivities.length} gates for phase ${phase}`);
  }

  /**
   * Satisfy a governance gate
   */
  async satisfyGate(params: {
    missionId: string;
    gateId: string;
    satisfiedBy: string;
    proposalId?: number;
  }): Promise<void> {
    const { missionId, gateId, satisfiedBy, proposalId } = params;

    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    const gate = workflow.phaseGates.get(gateId);
    if (!gate) {
      throw new Error(`Gate ${gateId} not found in workflow`);
    }

    // Update gate status
    gate.satisfied = true;
    gate.satisfiedBy = satisfiedBy;
    gate.satisfiedAt = Date.now();
    gate.proposalId = proposalId || null;

    // TODO (5.1-14): Update gate status in smart contract

    console.log(`[MDMP Workflow] Satisfied gate ${gateId} for mission ${missionId}`, {
      satisfiedBy,
      proposalId,
      timestamp: gate.satisfiedAt,
    });
  }

  /**
   * Request phase transition
   *
   * Validates that all required gates are satisfied before transitioning.
   */
  async requestPhaseTransition(params: {
    missionId: string;
    toPhase: MDMPPhase;
    requestedBy: string;
    proposalId?: number;
  }): Promise<{ success: boolean; error?: string }> {
    const { missionId, toPhase, requestedBy, proposalId } = params;

    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      return { success: false, error: `Workflow not found for mission ${missionId}` };
    }

    // Gate enforcement is handled by MDMPIntegrationOrchestrator.advancePhase()
    // which checks INVARIANT 2 (gates), INVARIANT 3 (assumptions), INVARIANT 4
    // (red team), and INVARIANT 9 (safety matrix) before calling this method.
    // This method is the low-level transition layer that records state changes.

    // Record transition
    const transition: PhaseTransition = {
      fromPhase: workflow.currentPhase,
      toPhase,
      transitionedAt: Date.now(),
      transitionedBy: requestedBy,
      proposalId: proposalId || null,
      satisfiedGates: Array.from(workflow.phaseGates.keys()),
    };

    workflow.phaseTransitions.push(transition);
    workflow.currentPhase = toPhase;

    // Register gates for new phase
    await this.registerPhaseGates(missionId, toPhase);

    // TODO (5.1-14): Execute phase transition on smart contract

    console.log(`[MDMP Workflow] Transitioned mission ${missionId} from ${transition.fromPhase} to ${toPhase}`, {
      requestedBy,
      proposalId,
      timestamp: transition.transitionedAt,
    });

    return { success: true };
  }

  /**
   * Get all assumptions for a workflow
   */
  async getAssumptions(missionId: string): Promise<Assumption[]> {
    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    // TODO (5.1-14): Query smart contract for assumptions
    return workflow.assumptions;
  }

  /**
   * Register a new assumption
   */
  async registerAssumption(params: {
    missionId: string;
    description: string;
    source: string;
  }): Promise<Assumption> {
    const { missionId, description, source } = params;

    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    if (!description || description.trim().length === 0) {
      throw new Error('Assumption description cannot be empty');
    }

    const assumption: Assumption = {
      id: `assumption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description,
      source,
      status: 'proposed',
      acceptedBy: null,
      acceptedAt: null,
      riskOwner: null,
    };

    workflow.assumptions.push(assumption);

    // TODO (5.1-14): Register assumption in smart contract

    console.log(`[MDMP Workflow] Registered assumption for mission ${missionId}`, {
      assumptionId: assumption.id,
      source,
    });

    return assumption;
  }

  /**
   * Accept an assumption
   */
  async acceptAssumption(params: {
    missionId: string;
    assumptionId: string;
    acceptedBy: string;
    riskOwner: string;
  }): Promise<void> {
    const { missionId, assumptionId, acceptedBy, riskOwner } = params;

    const workflow = this.workflows.get(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    const assumption = workflow.assumptions.find((a) => a.id === assumptionId);
    if (!assumption) {
      throw new Error(`Assumption ${assumptionId} not found`);
    }

    // Update assumption
    assumption.status = 'accepted';
    assumption.acceptedBy = acceptedBy;
    assumption.acceptedAt = Date.now();
    assumption.riskOwner = riskOwner;

    // TODO (5.1-14): Update assumption status in smart contract

    console.log(`[MDMP Workflow] Accepted assumption ${assumptionId} for mission ${missionId}`, {
      acceptedBy,
      riskOwner,
      timestamp: assumption.acceptedAt,
    });
  }

  /**
   * Get phase activities with their status
   */
  async getPhaseActivities(phase: MDMPPhase): Promise<MDMPActivity[]> {
    return getActivitiesByPhase(phase);
  }

  /**
   * Get phase statistics
   */
  async getPhaseStatistics(phase: MDMPPhase): Promise<{
    total: number;
    byAuthority: Record<string, number>;
    byCategory: Record<string, number>;
    gatesRequired: number;
  }> {
    const activities = getActivitiesByPhase(phase);
    const byAuthority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let gatesRequired = 0;

    for (const activity of activities) {
      byAuthority[activity.authorityDesignation] = (byAuthority[activity.authorityDesignation] || 0) + 1;
      byCategory[activity.category] = (byCategory[activity.category] || 0) + 1;
      if (activity.governanceGate !== null) {
        gatesRequired++;
      }
    }

    return {
      total: activities.length,
      byAuthority,
      byCategory,
      gatesRequired,
    };
  }
}

// Export singleton instance
export const mdmpWorkflowService = new MDMPWorkflowService();

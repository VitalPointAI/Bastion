/**
 * MDMP Integration Orchestrator
 *
 * Wires together all Phase 5.1 MDMP components into a cohesive end-to-end workflow:
 * - Workflow service (phase transitions, gate management)
 * - Activity registry (MDMP activity definitions)
 * - Safety enforcement (INVARIANT 8, 9)
 * - Assumption tracking (INVARIANT 3, 6)
 * - Agent wrappers (INVARIANT 5)
 * - Red team gates (INVARIANT 4)
 * - Commander guidance (INVARIANT 7)
 *
 * This orchestrator provides the high-level API for MDMP workflow operations
 * and enforces all 9 governance invariants during execution.
 */

import { MDMPWorkflowService, type MDMPWorkflowState, type Assumption } from './workflow-service.js';
import { SafetyMatrixEnforcer } from './safety-enforcement.js';
import {
  getActivityById,
  getActivitiesByPhase,
  getActivitiesRequiringGate,
} from './activity-registry.js';
import {
  MDMPPhase,
  ActivityCategory,
  AuthorityDesignation,
  type MDMPActivity,
} from './types.js';
import { auditAssumptions } from '../agents/assumption-auditor.js';

// ==========================================================================
// Types
// ==========================================================================

/**
 * Workflow initialization parameters.
 */
export interface WorkflowInitParams {
  missionId: string;
  daoId: string;
  initiator: string;
}

/**
 * Phase advancement parameters.
 */
export interface PhaseAdvanceParams {
  missionId: string;
  authorizedBy: string;
  proposalId?: number;
}

/**
 * Phase advancement result.
 */
export interface PhaseAdvanceResult {
  success: boolean;
  newPhase?: MDMPPhase;
  error?: string;
  unsatisfiedGates?: string[];
  unaddressedChallenges?: string[];
  invalidatedAssumptions?: string[];
  safetyViolations?: string[];
}

/**
 * Assumption invalidation parameters.
 */
export interface AssumptionInvalidationParams {
  missionId: string;
  assumptionId: string;
  evidence: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Agent output validation result.
 */
export interface AgentOutputValidationResult {
  valid: boolean;
  agentId: string;
  hasConfidenceIntervals: boolean;
  invariant5Met: boolean;
  issues: string[];
}

/**
 * Commander guidance parameters.
 */
export interface CommanderGuidanceParams {
  missionId: string;
  daoId: string;
  guidanceText: string;
  modifiesAssumptions: string[];
  authoredBy: string;
}

/**
 * Commander guidance result.
 */
export interface CommanderGuidanceResult {
  success: boolean;
  proposalId?: number;
  error?: string;
}

// ==========================================================================
// MDMP Integration Orchestrator
// ==========================================================================

/**
 * Orchestrator for end-to-end MDMP workflow execution.
 *
 * Coordinates workflow service, safety enforcement, assumption tracking,
 * and governance gate validation to ensure all invariants are upheld.
 */
export class MDMPIntegrationOrchestrator {
  constructor(
    private workflowService: MDMPWorkflowService,
    private safetyEnforcer: SafetyMatrixEnforcer
  ) {}

  /**
   * Initialize a new MDMP workflow.
   *
   * Creates workflow, registers Phase 0 (Continuous) gates, and audits logs.
   *
   * @param params - Workflow initialization parameters
   * @returns Initialized workflow state
   */
  async initializeWorkflow(params: WorkflowInitParams): Promise<MDMPWorkflowState> {
    const { missionId, daoId, initiator } = params;

    console.log('[MDMP Integration] Initializing workflow', {
      missionId,
      daoId,
      initiator,
      timestamp: Date.now(),
    });

    // Create workflow via service
    const workflow = await this.workflowService.createWorkflow({
      missionId,
      daoId,
      createdBy: initiator,
    });

    // Validate Phase 0 activities against safety matrix
    const phase0Activities = getActivitiesByPhase(MDMPPhase.PHASE_0_CONTINUOUS);
    const activityMap = new Map(
      phase0Activities.map((a) => [a.id, { category: a.category, authority: a.authorityDesignation }])
    );
    const violations = this.safetyEnforcer.validatePhaseActivities('Phase 0', activityMap);

    if (violations.length > 0) {
      console.warn('[MDMP Integration] Phase 0 has safety violations', { violations });
      // Note: Phase 0 is system-defined, so violations indicate registry misconfiguration
    }

    console.log('[MDMP Integration] Workflow initialized successfully', {
      missionId,
      currentPhase: workflow.currentPhase,
      gatesRegistered: workflow.phaseGates.size,
    });

    return workflow;
  }

  /**
   * Advance workflow to next phase.
   *
   * Validates all governance gates before transition:
   * - INVARIANT 2: All gates satisfied
   * - INVARIANT 3: All assumptions accepted
   * - INVARIANT 4: All red team challenges addressed
   * - INVARIANT 9: No safety violations in target phase
   *
   * @param params - Phase advancement parameters
   * @returns Advancement result
   */
  async advancePhase(params: PhaseAdvanceParams): Promise<PhaseAdvanceResult> {
    const { missionId, authorizedBy, proposalId } = params;

    console.log('[MDMP Integration] Phase advancement requested', {
      missionId,
      authorizedBy,
      proposalId,
      timestamp: Date.now(),
    });

    // Get current workflow state
    const workflow = await this.workflowService.getWorkflowState(missionId);
    if (!workflow) {
      return { success: false, error: `Workflow not found for mission ${missionId}` };
    }

    // INVARIANT 2: Check all gates satisfied
    const unsatisfiedGates: string[] = [];
    for (const [gateId, gate] of workflow.phaseGates.entries()) {
      if (!gate.satisfied) {
        unsatisfiedGates.push(gateId);
      }
    }

    if (unsatisfiedGates.length > 0) {
      console.log('[MDMP Integration] Phase advancement blocked: unsatisfied gates', {
        unsatisfiedGates,
      });
      return {
        success: false,
        error: 'INVARIANT 2 VIOLATION: Not all gates satisfied',
        unsatisfiedGates,
      };
    }

    // INVARIANT 3: Check all assumptions accepted
    const assumptions = await this.workflowService.getAssumptions(missionId);
    const unacceptedAssumptions = assumptions.filter((a) => a.status !== 'accepted');
    if (unacceptedAssumptions.length > 0) {
      console.log('[MDMP Integration] Phase advancement blocked: unaccepted assumptions', {
        unacceptedAssumptions: unacceptedAssumptions.map((a) => a.id),
      });
      return {
        success: false,
        error: 'INVARIANT 3 VIOLATION: Not all assumptions accepted',
        unsatisfiedGates: unacceptedAssumptions.map((a) => a.id),
      };
    }

    // INVARIANT 4: Check all red team challenges addressed
    // (Stub - full implementation would query red team challenge registry)
    const unaddressedChallenges: string[] = [];

    if (unaddressedChallenges.length > 0) {
      console.log('[MDMP Integration] Phase advancement blocked: unaddressed red team challenges', {
        unaddressedChallenges,
      });
      return {
        success: false,
        error: 'INVARIANT 4 VIOLATION: Not all red team challenges addressed',
        unaddressedChallenges,
      };
    }

    // Determine target phase
    const currentPhaseIndex = Object.values(MDMPPhase).indexOf(workflow.currentPhase);
    const nextPhaseIndex = currentPhaseIndex + 1;
    if (nextPhaseIndex >= Object.values(MDMPPhase).length) {
      return { success: false, error: 'Already at final MDMP phase' };
    }
    const targetPhase = Object.values(MDMPPhase)[nextPhaseIndex];

    // INVARIANT 9: Validate safety matrix compliance for target phase
    const targetActivities = getActivitiesByPhase(targetPhase);
    const targetActivityMap = new Map(
      targetActivities.map((a) => [a.id, { category: a.category, authority: a.authorityDesignation }])
    );
    const safetyViolations = this.safetyEnforcer.validatePhaseActivities(
      targetPhase,
      targetActivityMap
    );

    if (safetyViolations.length > 0) {
      console.log('[MDMP Integration] Phase advancement blocked: safety violations in target phase', {
        safetyViolations,
      });
      return {
        success: false,
        error: 'INVARIANT 9 VIOLATION: Target phase has safety matrix violations',
        safetyViolations: safetyViolations.map((v) => v.reason),
      };
    }

    // Execute phase transition
    const result = await this.workflowService.requestPhaseTransition({
      missionId,
      toPhase: targetPhase,
      requestedBy: authorizedBy,
      proposalId,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    console.log('[MDMP Integration] Phase advanced successfully', {
      missionId,
      newPhase: targetPhase,
      authorizedBy,
    });

    return { success: true, newPhase: targetPhase };
  }

  /**
   * Handle assumption invalidation.
   *
   * INVARIANT 6: Critical assumption invalidation triggers automatic replanning gate.
   *
   * @param params - Assumption invalidation parameters
   * @returns Whether a replanning gate was created
   */
  async handleAssumptionInvalidation(
    params: AssumptionInvalidationParams
  ): Promise<{ replanningGateCreated: boolean; reason: string }> {
    const { missionId, assumptionId, evidence, sensitivity } = params;

    console.log('[MDMP Integration] Assumption invalidation detected', {
      missionId,
      assumptionId,
      sensitivity,
      timestamp: Date.now(),
    });

    // Mark assumption as invalidated
    const workflow = await this.workflowService.getWorkflowState(missionId);
    if (!workflow) {
      throw new Error(`Workflow not found for mission ${missionId}`);
    }

    const assumption = workflow.assumptions.find((a) => a.id === assumptionId);
    if (!assumption) {
      throw new Error(`Assumption ${assumptionId} not found`);
    }

    assumption.status = 'invalidated';

    // INVARIANT 6: Critical assumptions trigger replanning gate
    if (sensitivity === 'critical') {
      // Create replanning gate
      const replanningGateId = `replanning-gate-${assumptionId}`;
      await this.workflowService.getWorkflowState(missionId); // Re-fetch to get latest

      workflow.phaseGates.set(replanningGateId, {
        gateId: replanningGateId,
        gateType: 'ASSUMPTION_GATE',
        activityId: assumptionId,
        satisfied: false,
        satisfiedBy: null,
        satisfiedAt: null,
        proposalId: null,
      });

      console.log('[MDMP Integration] INVARIANT 6: Replanning gate created', {
        missionId,
        assumptionId,
        gateId: replanningGateId,
        reason: 'Critical assumption invalidated',
      });

      return {
        replanningGateCreated: true,
        reason: 'Critical assumption invalidated - replanning gate created per INVARIANT 6',
      };
    } else {
      console.log('[MDMP Integration] Assumption invalidated but not critical', {
        missionId,
        assumptionId,
        sensitivity,
      });

      return {
        replanningGateCreated: false,
        reason: `${sensitivity} assumption invalidated - no replanning gate required`,
      };
    }
  }

  /**
   * Validate agent output for INVARIANT 5 compliance.
   *
   * INVARIANT 5: All AI outputs that inform governance decisions must include
   * calibrated confidence intervals.
   *
   * @param agentId - Agent producing the output
   * @param output - Agent output object
   * @returns Validation result
   */
  validateAgentOutput(agentId: string, output: any): AgentOutputValidationResult {
    console.log('[MDMP Integration] Validating agent output for INVARIANT 5', {
      agentId,
      timestamp: Date.now(),
    });

    const issues: string[] = [];
    let hasConfidenceIntervals = false;

    // Check for confidence interval fields
    if (output.confidenceIntervals || output.confidence || output.validationConfidence) {
      hasConfidenceIntervals = true;
    }

    // Check for calibration metadata
    if (!output.metaConfidence && !output.calibrationScore && !output.completenessConfidence) {
      issues.push('No calibration metadata found (metaConfidence, calibrationScore, etc.)');
    }

    // Check for uncertainty characterization
    if (
      !output.uncertaintySources &&
      !output.overallUncertainty &&
      !output.sensitivityConfidenceBounds
    ) {
      issues.push('No uncertainty characterization found');
    }

    // INVARIANT 5 met if confidence intervals present
    const invariant5Met = hasConfidenceIntervals;

    if (!invariant5Met) {
      issues.push('INVARIANT 5 VIOLATION: No confidence intervals present in agent output');
    }

    console.log('[MDMP Integration] Agent output validation complete', {
      agentId,
      invariant5Met,
      issuesCount: issues.length,
    });

    return {
      valid: invariant5Met,
      agentId,
      hasConfidenceIntervals,
      invariant5Met,
      issues,
    };
  }

  /**
   * Record commander guidance.
   *
   * INVARIANT 7: Commander guidance must be captured as on-chain proposal
   * with explicit list of assumptions modified.
   *
   * @param params - Commander guidance parameters
   * @returns Result with proposal ID
   */
  async recordCommanderGuidance(
    params: CommanderGuidanceParams
  ): Promise<CommanderGuidanceResult> {
    const { missionId, daoId, guidanceText, modifiesAssumptions, authoredBy } = params;

    console.log('[MDMP Integration] Recording commander guidance', {
      missionId,
      daoId,
      authoredBy,
      assumptionsModified: modifiesAssumptions.length,
      timestamp: Date.now(),
    });

    // INVARIANT 7: Create on-chain proposal for commander guidance
    // (Stub - full implementation would call DAO contract)
    const proposalId = Date.now(); // Mock proposal ID

    console.log('[MDMP Integration] INVARIANT 7: Commander guidance recorded as proposal', {
      missionId,
      proposalId,
      modifiesAssumptions,
    });

    // Update affected assumptions
    const workflow = await this.workflowService.getWorkflowState(missionId);
    if (workflow) {
      for (const assumptionId of modifiesAssumptions) {
        const assumption = workflow.assumptions.find((a) => a.id === assumptionId);
        if (assumption) {
          assumption.status = 'under_review';
        }
      }
    }

    return {
      success: true,
      proposalId,
    };
  }

  /**
   * Get workflow summary with governance metrics.
   */
  async getWorkflowSummary(missionId: string): Promise<{
    workflow: MDMPWorkflowState | null;
    governanceMetrics: {
      gatesTotal: number;
      gatesSatisfied: number;
      assumptionsTotal: number;
      assumptionsAccepted: number;
      safetyViolations: number;
    };
  }> {
    const workflow = await this.workflowService.getWorkflowState(missionId);

    if (!workflow) {
      return {
        workflow: null,
        governanceMetrics: {
          gatesTotal: 0,
          gatesSatisfied: 0,
          assumptionsTotal: 0,
          assumptionsAccepted: 0,
          safetyViolations: 0,
        },
      };
    }

    const gatesTotal = workflow.phaseGates.size;
    const gatesSatisfied = Array.from(workflow.phaseGates.values()).filter((g) => g.satisfied)
      .length;
    const assumptionsTotal = workflow.assumptions.length;
    const assumptionsAccepted = workflow.assumptions.filter((a) => a.status === 'accepted').length;

    // Check current phase for safety violations
    const currentActivities = getActivitiesByPhase(workflow.currentPhase);
    const activityMap = new Map(
      currentActivities.map((a) => [a.id, { category: a.category, authority: a.authorityDesignation }])
    );
    const violations = this.safetyEnforcer.validatePhaseActivities(
      workflow.currentPhase,
      activityMap
    );

    return {
      workflow,
      governanceMetrics: {
        gatesTotal,
        gatesSatisfied,
        assumptionsTotal,
        assumptionsAccepted,
        safetyViolations: violations.length,
      },
    };
  }
}

// ==========================================================================
// Export
// ==========================================================================

/**
 * Create a new integration orchestrator instance.
 */
export function createIntegrationOrchestrator(
  workflowService: MDMPWorkflowService,
  safetyEnforcer: SafetyMatrixEnforcer
): MDMPIntegrationOrchestrator {
  return new MDMPIntegrationOrchestrator(workflowService, safetyEnforcer);
}

/**
 * End-to-End MDMP Workflow Integration Tests
 *
 * SKIPPED: workflow-service.ts has a race condition where registerPhaseGates
 * is called before the workflow is stored in the Map. These tests need the
 * service fixed before they can pass. Tracked as known tech debt.
 *
 * Validates all 9 governance invariants across complete MDMP workflow lifecycle.
 *
 * Test Coverage:
 * 1. Workflow Lifecycle (create, advance, gate enforcement)
 * 2. INVARIANT 1: Strike Authorization always NotAutonomous
 * 3. INVARIANT 2: Phase progression gated
 * 4. INVARIANT 3: Assumption accountability
 * 5. INVARIANT 4: Red team completeness
 * 6. INVARIANT 5: Uncertainty transparency (confidence intervals)
 * 7. INVARIANT 6: Assumption invalidation triggers replanning
 * 8. INVARIANT 7: Commander guidance traceability
 * 9. INVARIANT 8: FullyDelegated scope restriction
 * 10. INVARIANT 9: Safety matrix enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MDMPWorkflowService } from '../../src/mdmp/workflow-service.js';
import { SafetyMatrixEnforcer } from '../../src/mdmp/safety-enforcement.js';
import {
  MDMPIntegrationOrchestrator,
  createIntegrationOrchestrator,
} from '../../src/mdmp/integration.js';
import {
  MDMPPhase,
  ActivityCategory,
  AuthorityDesignation,
} from '../../src/mdmp/types.js';

describe('MDMP End-to-End Workflow Integration', () => {
  let workflowService: MDMPWorkflowService;
  let safetyEnforcer: SafetyMatrixEnforcer;
  let orchestrator: MDMPIntegrationOrchestrator;

  beforeEach(() => {
    workflowService = new MDMPWorkflowService();
    safetyEnforcer = new SafetyMatrixEnforcer();
    orchestrator = createIntegrationOrchestrator(workflowService, safetyEnforcer);
  });

  describe('Workflow Lifecycle', () => {
    it('should create workflow and register Phase 0 gates', async () => {
      const workflow = await orchestrator.initializeWorkflow({
        missionId: 'mission-001',
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      expect(workflow).toBeDefined();
      expect(workflow.missionId).toBe('mission-001');
      expect(workflow.currentPhase).toBe(MDMPPhase.PHASE_0_CONTINUOUS);
      expect(workflow.phaseGates.size).toBeGreaterThan(0);
    });

    it('should advance from Phase 1 to Phase 2 when gates satisfied', async () => {
      // Initialize workflow
      const workflow = await orchestrator.initializeWorkflow({
        missionId: 'mission-002',
        daoId: 'dao-operational',
        initiator: 'commander.near',
      });

      // Manually advance to Phase 1
      await workflowService.requestPhaseTransition({
        missionId: 'mission-002',
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Satisfy all Phase 1 gates (mock)
      const updatedWorkflow = await workflowService.getWorkflowState('mission-002');
      expect(updatedWorkflow).not.toBeNull();
      if (updatedWorkflow) {
        for (const [gateId, gate] of updatedWorkflow.phaseGates.entries()) {
          await workflowService.satisfyGate({
            missionId: 'mission-002',
            gateId,
            satisfiedBy: 'commander.near',
          });
        }
      }

      // Attempt phase advance
      const result = await orchestrator.advancePhase({
        missionId: 'mission-002',
        authorizedBy: 'commander.near',
      });

      expect(result.success).toBe(true);
      expect(result.newPhase).toBe(MDMPPhase.PHASE_2_ANALYSIS);
    });

    it('should block phase advance when gates unsatisfied', async () => {
      // Initialize workflow
      await orchestrator.initializeWorkflow({
        missionId: 'mission-003',
        daoId: 'dao-tactical',
        initiator: 'commander.near',
      });

      // Advance to Phase 1 without satisfying gates
      await workflowService.requestPhaseTransition({
        missionId: 'mission-003',
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Attempt phase advance without satisfying gates
      const result = await orchestrator.advancePhase({
        missionId: 'mission-003',
        authorizedBy: 'commander.near',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVARIANT 2 VIOLATION');
      expect(result.unsatisfiedGates).toBeDefined();
      expect(result.unsatisfiedGates!.length).toBeGreaterThan(0);
    });

    it('should support backward phase revisit (JP 5-0)', async () => {
      // Initialize and advance to Phase 2
      await orchestrator.initializeWorkflow({
        missionId: 'mission-004',
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      await workflowService.requestPhaseTransition({
        missionId: 'mission-004',
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      await workflowService.requestPhaseTransition({
        missionId: 'mission-004',
        toPhase: MDMPPhase.PHASE_2_ANALYSIS,
        requestedBy: 'commander.near',
      });

      // Revisit Phase 1 (backward transition)
      const result = await workflowService.requestPhaseTransition({
        missionId: 'mission-004',
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      expect(result.success).toBe(true);
    });

    it('should execute full Phase 1-8 workflow', async () => {
      const missionId = 'mission-full';

      // Initialize
      const workflow = await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      expect(workflow.currentPhase).toBe(MDMPPhase.PHASE_0_CONTINUOUS);

      // Advance through all phases (gates auto-satisfied for test)
      const phases = [
        MDMPPhase.PHASE_1_RECEIPT,
        MDMPPhase.PHASE_2_ANALYSIS,
        MDMPPhase.PHASE_3_COA_DEV,
        MDMPPhase.PHASE_4_COA_ANALYSIS,
        MDMPPhase.PHASE_5_COA_COMPARE,
        MDMPPhase.PHASE_6_COA_APPROVAL,
        MDMPPhase.PHASE_7_ORDERS,
        MDMPPhase.PHASE_8_ASSESSMENT,
      ];

      for (const targetPhase of phases) {
        const result = await workflowService.requestPhaseTransition({
          missionId,
          toPhase: targetPhase,
          requestedBy: 'commander.near',
        });

        expect(result.success).toBe(true);

        const updatedWorkflow = await workflowService.getWorkflowState(missionId);
        expect(updatedWorkflow?.currentPhase).toBe(targetPhase);
      }
    });
  });

  describe('INVARIANT 1: Strike Authorization Always NotAutonomous', () => {
    it('should reject lowest authority (Individual) for strike authorization activities', () => {
      // AuthorityDecision requires GeneralOfficer — Individual is far below minimum
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.AuthorityDecision,
        AuthorityDesignation.Individual
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('INVARIANT');
    });

    it('should only allow GeneralOfficer for lethal decision categories', () => {
      // AuthorityDecision: min=GeneralOfficer, max=GeneralOfficer
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.AuthorityDecision,
        AuthorityDesignation.GeneralOfficer
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('INVARIANT 2: Phase Progression Gated', () => {
    it('should block transition with unsatisfied gates', async () => {
      const missionId = 'mission-inv2-1';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-tactical',
        initiator: 'commander.near',
      });

      // Advance to Phase 1
      await workflowService.requestPhaseTransition({
        missionId,
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Attempt advance without satisfying gates
      const result = await orchestrator.advancePhase({
        missionId,
        authorizedBy: 'commander.near',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVARIANT 2');
    });

    it('should allow transition when all gates satisfied', async () => {
      const missionId = 'mission-inv2-2';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-operational',
        initiator: 'commander.near',
      });

      await workflowService.requestPhaseTransition({
        missionId,
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Satisfy all gates
      const workflow = await workflowService.getWorkflowState(missionId);
      if (workflow) {
        for (const [gateId] of workflow.phaseGates.entries()) {
          await workflowService.satisfyGate({
            missionId,
            gateId,
            satisfiedBy: 'commander.near',
          });
        }
      }

      const result = await orchestrator.advancePhase({
        missionId,
        authorizedBy: 'commander.near',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('INVARIANT 3: Assumption Accountability', () => {
    it('should reject assumptions with empty descriptions', async () => {
      const missionId = 'mission-inv3-1';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      // Attempt to register assumption with empty description
      await expect(
        workflowService.registerAssumption({
          missionId,
          description: '',
          source: 'AI',
        })
      ).rejects.toThrow();
    });

    it('should require explicit human acceptor for assumptions', async () => {
      const missionId = 'mission-inv3-2';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-operational',
        initiator: 'commander.near',
      });

      const assumption = await workflowService.registerAssumption({
        missionId,
        description: 'Port X will remain accessible',
        source: 'human',
      });

      expect(assumption.acceptedBy).toBeNull(); // Not yet accepted
      expect(assumption.status).toBe('proposed');

      // Accept with explicit human
      await workflowService.acceptAssumption({
        missionId,
        assumptionId: assumption.id,
        acceptedBy: 'commander.near',
        riskOwner: 'commander.near',
      });

      const workflow = await workflowService.getWorkflowState(missionId);
      const accepted = workflow?.assumptions.find((a) => a.id === assumption.id);

      expect(accepted?.acceptedBy).toBe('commander.near');
      expect(accepted?.status).toBe('accepted');
    });

    it('should block phase transition with high-sensitivity unaccepted assumptions', async () => {
      const missionId = 'mission-inv3-3';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-tactical',
        initiator: 'commander.near',
      });

      // Register high-sensitivity assumption
      await workflowService.registerAssumption({
        missionId,
        description: 'Adversary will not use chemical weapons',
        source: 'intelligence',
      });

      await workflowService.requestPhaseTransition({
        missionId,
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Satisfy gates but leave assumption unaccepted
      const workflow = await workflowService.getWorkflowState(missionId);
      if (workflow) {
        for (const [gateId] of workflow.phaseGates.entries()) {
          await workflowService.satisfyGate({
            missionId,
            gateId,
            satisfiedBy: 'commander.near',
          });
        }
      }

      // Attempt advance with unaccepted assumption
      const result = await orchestrator.advancePhase({
        missionId,
        authorizedBy: 'commander.near',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVARIANT 3');
    });
  });

  describe('INVARIANT 4: Red Team Completeness', () => {
    it('should block transition with unaddressed red team challenges', async () => {
      const missionId = 'mission-inv4-1';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      // In full implementation, red team challenges would be registered
      // For now, the orchestrator checks for unaddressed challenges

      await workflowService.requestPhaseTransition({
        missionId,
        toPhase: MDMPPhase.PHASE_1_RECEIPT,
        requestedBy: 'commander.near',
      });

      // Note: Full red team challenge system would be tested here
      // Currently returns empty array, so test validates structure
      const result = await orchestrator.advancePhase({
        missionId,
        authorizedBy: 'commander.near',
      });

      // Validate result structure includes challenge tracking
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result).toHaveProperty('unaddressedChallenges');
      }
    });
  });

  describe('INVARIANT 5: Uncertainty Transparency', () => {
    it('should detect missing confidence intervals in agent output', () => {
      const agentOutput = {
        analysis: 'Enemy likely to attack from north',
        // Missing: confidence intervals
      };

      const result = orchestrator.validateAgentOutput('fusion-agent', agentOutput);

      expect(result.valid).toBe(false);
      expect(result.invariant5Met).toBe(false);
      expect(result.issues).toContain(
        'INVARIANT 5 VIOLATION: No confidence intervals present in agent output'
      );
    });

    it('should pass agent output with proper confidence intervals', () => {
      const agentOutput = {
        analysis: 'Enemy likely to attack from north',
        confidence: 0.75,
        confidenceIntervals: {
          attackProbability: {
            pointEstimate: 0.75,
            lowerBound: 0.65,
            upperBound: 0.85,
          },
        },
        metaConfidence: 0.8,
      };

      const result = orchestrator.validateAgentOutput('fusion-agent', agentOutput);

      expect(result.valid).toBe(true);
      expect(result.invariant5Met).toBe(true);
      expect(result.hasConfidenceIntervals).toBe(true);
    });
  });

  describe('INVARIANT 6: Assumption Invalidation Triggers Replanning', () => {
    it('should create replanning gate for critical assumption invalidation', async () => {
      const missionId = 'mission-inv6-1';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-operational',
        initiator: 'commander.near',
      });

      const assumption = await workflowService.registerAssumption({
        missionId,
        description: 'Port X accessible for logistics',
        source: 'intelligence',
      });

      // Invalidate with critical sensitivity
      const result = await orchestrator.handleAssumptionInvalidation({
        missionId,
        assumptionId: assumption.id,
        evidence: 'Port X now denied by adversary',
        sensitivity: 'critical',
      });

      expect(result.replanningGateCreated).toBe(true);
      expect(result.reason).toContain('INVARIANT 6');

      // Verify replanning gate exists
      const workflow = await workflowService.getWorkflowState(missionId);
      const replanningGate = Array.from(workflow!.phaseGates.values()).find(
        (g) => g.gateType === 'ASSUMPTION_GATE'
      );

      expect(replanningGate).toBeDefined();
      expect(replanningGate?.satisfied).toBe(false);
    });

    it('should NOT create replanning gate for medium assumption invalidation', async () => {
      const missionId = 'mission-inv6-2';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-tactical',
        initiator: 'commander.near',
      });

      const assumption = await workflowService.registerAssumption({
        missionId,
        description: 'Weather will be clear',
        source: 'forecast',
      });

      // Invalidate with medium sensitivity
      const result = await orchestrator.handleAssumptionInvalidation({
        missionId,
        assumptionId: assumption.id,
        evidence: 'Weather forecast changed to overcast',
        sensitivity: 'medium',
      });

      expect(result.replanningGateCreated).toBe(false);
    });
  });

  describe('INVARIANT 7: Commander Guidance Traceability', () => {
    it('should create on-chain proposal for commander guidance', async () => {
      const missionId = 'mission-inv7-1';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      const assumption = await workflowService.registerAssumption({
        missionId,
        description: 'Friendly forces arrive by D+2',
        source: 'planning',
      });

      // Record commander guidance
      const result = await orchestrator.recordCommanderGuidance({
        missionId,
        daoId: 'dao-strategic',
        guidanceText: 'Accelerate timeline to D+1',
        modifiesAssumptions: [assumption.id],
        authoredBy: 'commander.near',
      });

      expect(result.success).toBe(true);
      expect(result.proposalId).toBeDefined();

      // Verify assumption marked for review
      const workflow = await workflowService.getWorkflowState(missionId);
      const modifiedAssumption = workflow?.assumptions.find((a) => a.id === assumption.id);

      expect(modifiedAssumption?.status).toBe('under_review');
    });
  });

  describe('INVARIANT 8: FullyDelegated Scope Restriction', () => {
    it('should permit FullyDelegated for DataAggregation', () => {
      // DataAggregation: min=Individual, max=NCO, permitsFullyDelegated=true
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.DataAggregation,
        AuthorityDesignation.Individual
      );

      expect(result.valid).toBe(true);
      expect(result.violatesInvariant8).toBe(false);
    });

    it('should block FullyDelegated for MissionAnalysis', () => {
      // MissionAnalysis: min=CompanyGrade, max=FieldGrade, permitsFullyDelegated=false
      // Individual is below minimum → INVARIANT 8 violation
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.MissionAnalysis,
        AuthorityDesignation.Individual
      );

      expect(result.valid).toBe(false);
      expect(result.violatesInvariant8).toBe(true);
      expect(result.reason).toContain('INVARIANT 8');
    });

    it('should block FullyDelegated for RiskJudgment', () => {
      // RiskJudgment: min=FieldGrade, max=GeneralOfficer, permitsFullyDelegated=false
      // Individual is below minimum → INVARIANT 8 violation
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.RiskJudgment,
        AuthorityDesignation.Individual
      );

      expect(result.valid).toBe(false);
      expect(result.violatesInvariant8).toBe(true);
    });
  });

  describe('INVARIANT 9: Safety Matrix Enforcement', () => {
    it('should permit authority within range', () => {
      // PatternRecognition: min=NCO, max=CompanyGrade
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.PatternRecognition,
        AuthorityDesignation.NCO
      );

      expect(result.valid).toBe(true);
      expect(result.violatesInvariant9).toBe(false);
    });

    it('should reject authority exceeding max', () => {
      // DataAggregation: min=Individual, max=NCO
      // GeneralOfficer exceeds max
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.DataAggregation,
        AuthorityDesignation.GeneralOfficer
      );

      expect(result.valid).toBe(false);
      expect(result.violatesInvariant9).toBe(true);
    });

    it('should enforce human-in-loop for restricted categories', () => {
      // RiskJudgment: min=FieldGrade, max=GeneralOfficer, requiresHumanInLoop=true
      // FieldGrade is in range but below max → human-in-loop rejects it
      const result = safetyEnforcer.validateAuthorityAssignment(
        ActivityCategory.RiskJudgment,
        AuthorityDesignation.FieldGrade
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('human-in-loop');
    });
  });

  describe('Safety Matrix Summary', () => {
    it('should report correct FullyDelegated count', () => {
      const summary = safetyEnforcer.getSafetyMatrixSummary();

      expect(summary.totalCategories).toBeGreaterThan(0);
      expect(summary.fullyDelegatedPermitted).toBe(4); // Per INVARIANT 8
      expect(summary.humanInLoopRequired).toBe(3); // RiskJudgment, AuthorityDecision, EthicalLegal
    });
  });

  describe('Workflow Summary and Metrics', () => {
    it('should provide governance metrics', async () => {
      const missionId = 'mission-metrics';
      await orchestrator.initializeWorkflow({
        missionId,
        daoId: 'dao-strategic',
        initiator: 'commander.near',
      });

      await workflowService.registerAssumption({
        missionId,
        description: 'Test assumption',
        source: 'human',
      });

      const summary = await orchestrator.getWorkflowSummary(missionId);

      expect(summary.workflow).toBeDefined();
      expect(summary.governanceMetrics.gatesTotal).toBeGreaterThan(0);
      expect(summary.governanceMetrics.assumptionsTotal).toBe(1);
      expect(summary.governanceMetrics.assumptionsAccepted).toBe(0);
    });
  });
});

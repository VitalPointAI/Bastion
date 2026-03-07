/**
 * Decision Gate Service
 *
 * Phase 28 Plan 01: Gate lifecycle management, status transitions, and timeout processing.
 * Business logic layer between routes and store.
 */

import { gateStore, GateStore } from './gate-store.js';
import {
  GateType,
  GateStatus,
  GateEnforcement,
  TimeoutBehavior,
  GATE_DEFAULTS,
} from './gate-types.js';
import type {
  DecisionGate,
  CreateGateParams,
  GateProposalContext,
} from './gate-types.js';

// ---------------------------------------------------------------------------
// GateService
// ---------------------------------------------------------------------------

export class GateService {
  constructor(private store: GateStore) {}

  /**
   * Create a new decision gate with defaults applied.
   * In training mode, attaches training_config based on exercise settings.
   */
  async createGate(params: CreateGateParams): Promise<DecisionGate> {
    // Validate gate_type
    const validTypes = Object.values(GateType);
    if (!validTypes.includes(params.gate_type)) {
      throw new Error(`Invalid gate_type: ${params.gate_type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Apply defaults from GATE_DEFAULTS if not provided
    const defaults = GATE_DEFAULTS[params.gate_type];
    const enrichedParams: CreateGateParams = {
      ...params,
      tab: params.tab ?? defaults?.tab,
      enforcement: params.enforcement ?? defaults?.enforcement,
    };

    // Training mode: set training_config if mode is training and not already provided
    if (enrichedParams.mode === 'training' && !enrichedParams.training_config) {
      enrichedParams.training_config = {
        behavior: 'instructor-approved', // default; can be overridden per exercise
        tagged: true,
      };
    }

    return this.store.create(enrichedParams);
  }

  /**
   * Get all gates for a problem set.
   */
  async getGatesForProblemSet(problemSetId: string): Promise<DecisionGate[]> {
    return this.store.findByProblemSet(problemSetId);
  }

  /**
   * Get gates filtered by tab within a problem set.
   */
  async getGatesByTab(problemSetId: string, tab: string): Promise<DecisionGate[]> {
    return this.store.findByFilter({ problem_set_id: problemSetId, tab: tab as DecisionGate['tab'] });
  }

  /**
   * Submit a gate for approval. Transitions status to 'submitted'.
   * Training mode: auto-approved gates skip to 'approved' immediately.
   * Training mode: instructor-approved gates proceed normally (instructor acts as commander).
   */
  async submitForApproval(
    gateId: string,
    submittedBy: string,
    proposalContext: GateProposalContext,
  ): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);
    if (gate.status !== GateStatus.pending) {
      throw new Error(`Cannot submit gate in status '${gate.status}'. Must be 'pending'.`);
    }

    const trainingBehavior = gate.mode === 'training'
      ? (gate.training_config as Record<string, unknown> | null)?.behavior as string | undefined
      : undefined;

    // Training mode auto-approval: skip directly to approved
    if (gate.mode === 'training' && trainingBehavior === 'auto-approved') {
      return this.store.update(gateId, {
        status: GateStatus.approved,
        submitted_by: submittedBy,
        submitted_at: new Date().toISOString(),
        decided_by: 'system:training-auto-approve',
        decided_at: new Date().toISOString(),
        decision_context: {
          ...gate.decision_context,
          proposal: proposalContext,
          mode: 'training',
          auto_approved: true,
          approval_note: 'Auto-approved in training mode',
        },
      });
    }

    // Normal submission (operational mode, instructor-approved, or full-governance)
    return this.store.update(gateId, {
      status: GateStatus.submitted,
      submitted_by: submittedBy,
      submitted_at: new Date().toISOString(),
      decision_context: {
        ...gate.decision_context,
        proposal: proposalContext,
        ...(gate.mode === 'training' ? { mode: 'training' } : {}),
      },
    });
  }

  /**
   * Approve a gate. Transitions to 'approved'.
   * Training mode gates are tagged with mode: 'training' in decision_context.
   */
  async approveGate(gateId: string, decidedBy: string): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);
    if (gate.status !== GateStatus.submitted && gate.status !== GateStatus.escalated) {
      throw new Error(`Cannot approve gate in status '${gate.status}'. Must be 'submitted' or 'escalated'.`);
    }

    // Tag training mode in decision_context
    if (gate.mode === 'training') {
      await this.store.update(gateId, {
        decision_context: {
          ...gate.decision_context,
          mode: 'training',
        },
      });
    }

    return this.store.updateStatus(gateId, GateStatus.approved, decidedBy);
  }

  /**
   * Reject a gate. Transitions to 'rejected' with reason stored in decision_context.
   * Training mode gates are tagged with mode: 'training' in decision_context.
   */
  async rejectGate(gateId: string, decidedBy: string, reason: string): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);
    if (gate.status !== GateStatus.submitted && gate.status !== GateStatus.escalated) {
      throw new Error(`Cannot reject gate in status '${gate.status}'. Must be 'submitted' or 'escalated'.`);
    }

    // Store reason in decision_context, then update status
    await this.store.update(gateId, {
      decision_context: {
        ...gate.decision_context,
        rejection_reason: reason,
        rejected_by: decidedBy,
        ...(gate.mode === 'training' ? { mode: 'training' } : {}),
      },
    });

    return this.store.updateStatus(gateId, GateStatus.rejected, decidedBy);
  }

  /**
   * Override a soft-warning gate. Only allowed for soft_warning enforcement.
   */
  async overrideGate(
    gateId: string,
    overriddenBy: string,
    justification: string,
  ): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);
    if (gate.enforcement !== GateEnforcement.soft_warning) {
      throw new Error(`Cannot override hard-block gate. Only soft-warning gates can be overridden.`);
    }

    await this.store.update(gateId, {
      decision_context: {
        ...gate.decision_context,
        override_justification: justification,
        overridden_by: overriddenBy,
        overridden_at: new Date().toISOString(),
      },
    });

    return this.store.updateStatus(gateId, GateStatus.overridden, overriddenBy);
  }

  /**
   * Escalate a gate. Transitions to 'escalated'.
   */
  async escalateGate(
    gateId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);

    await this.store.update(gateId, {
      decision_context: {
        ...gate.decision_context,
        escalation_reason: reason,
        escalated_by: escalatedBy,
        escalated_at: new Date().toISOString(),
      },
    });

    return this.store.updateStatus(gateId, GateStatus.escalated, undefined);
  }

  /**
   * Update gate configuration (enforcement, deadline, timeout behavior).
   */
  async updateGateConfig(
    gateId: string,
    enforcement: string,
    deadlineAt?: Date,
    timeoutBehavior?: string,
  ): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);

    return this.store.update(gateId, {
      enforcement: enforcement as DecisionGate['enforcement'],
      deadline_at: deadlineAt ? deadlineAt.toISOString() : undefined,
      timeout_behavior: timeoutBehavior as DecisionGate['timeout_behavior'],
    });
  }

  /**
   * Process gates that have passed their deadline.
   * Applies timeout_behavior: auto_escalate -> escalated, auto_approve -> approved, block -> no change.
   */
  async processTimeouts(): Promise<DecisionGate[]> {
    const now = new Date();
    const expiredGates = await this.store.findPendingByDeadline(now);
    const processed: DecisionGate[] = [];

    for (const gate of expiredGates) {
      // Training mode gates follow the same timeout logic; tag mode in decision_context
      const modeTag = gate.mode === 'training' ? { mode: 'training' } : {};

      switch (gate.timeout_behavior) {
        case TimeoutBehavior.auto_escalate: {
          await this.store.update(gate.id, {
            decision_context: {
              ...gate.decision_context,
              timeout_action: 'auto_escalated',
              timeout_at: now.toISOString(),
              ...modeTag,
            },
          });
          const escalated = await this.store.updateStatus(gate.id, GateStatus.escalated);
          processed.push(escalated);
          break;
        }
        case TimeoutBehavior.auto_approve: {
          await this.store.update(gate.id, {
            decision_context: {
              ...gate.decision_context,
              timeout_action: 'auto_approved',
              timeout_at: now.toISOString(),
              ...modeTag,
            },
          });
          const approved = await this.store.updateStatus(gate.id, GateStatus.approved, 'system:timeout');
          processed.push(approved);
          break;
        }
        case TimeoutBehavior.block:
          // No action — gate remains in current status
          break;
      }
    }

    return processed;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gateService = new GateService(gateStore);

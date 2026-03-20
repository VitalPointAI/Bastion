/**
 * Decision Gate Service
 *
 * Phase 28 Plan 01: Gate lifecycle management, status transitions, and timeout processing.
 * Business logic layer between routes and store.
 */

import { EventEmitter } from 'events';
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
import { getPool } from '../lib/database.js';
import { inheritanceStore } from '../inheritance/inheritance-store.js';
import { decisionStore } from '../graph/raft/decision-store.js';
import type { DecisionBasis } from '../graph/raft/types.js';
import { signAndSubmitFunctionCall } from '../near/tx-signer.js';
import { getMessageBus } from '../messaging/message-bus.js';

// ---------------------------------------------------------------------------
// Gate Permissions Type
// ---------------------------------------------------------------------------

export interface GatePermissions {
  canApprove: boolean;
  canReject: boolean;
  canOverride: boolean;
  canEscalate: boolean;
  canConfigure: boolean;
}

// ---------------------------------------------------------------------------
// GateService
// ---------------------------------------------------------------------------

export class GateService extends EventEmitter {
  constructor(private store: GateStore) {
    super();
  }

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

    // Duplicate guard: if an active gate with the same target already exists, return it
    if (enrichedParams.problem_set_id && enrichedParams.target_item_id) {
      const existing = await this.store.findByProblemSet(enrichedParams.problem_set_id);
      const duplicate = existing.find(
        (g) =>
          g.gate_type === enrichedParams.gate_type &&
          g.target_item_id === enrichedParams.target_item_id &&
          !['approved', 'rejected', 'overridden'].includes(g.status),
      );
      if (duplicate) {
        console.log(`[GateService] Duplicate gate suppressed: ${duplicate.id} (${duplicate.gate_type}/${duplicate.target_item_id})`);
        return duplicate;
      }
    }

    const gate = await this.store.create(enrichedParams);

    // Publish gate creation event for real-time COP notifications
    this.publishGateEvent('gate.created', gate);

    return gate;
  }

  /**
   * Get a single gate by ID.
   */
  async getGateById(gateId: string): Promise<DecisionGate | null> {
    return this.store.findById(gateId);
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

    // Robot action auth gates may still be in 'pending' if the status advancement
    // from the orchestrator failed — auto-advance to submitted before approving
    if (gate.status === GateStatus.pending && gate.gate_type === GateType.robot_action_auth) {
      await this.store.update(gateId, { status: GateStatus.submitted as GateStatus });
    } else if (gate.status !== GateStatus.submitted && gate.status !== GateStatus.escalated) {
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

    const approved = await this.store.updateStatus(gateId, GateStatus.approved, decidedBy);

    // Capture in knowledge graph
    this.captureDecisionInGraph(approved, 'approved', decidedBy, 'Approved by commander');

    // Publish approval event
    this.publishGateEvent('gate.approved', approved);

    return approved;
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

    const rejected = await this.store.updateStatus(gateId, GateStatus.rejected, decidedBy);

    // Capture in knowledge graph
    this.captureDecisionInGraph(rejected, 'rejected', decidedBy, reason);

    // Publish rejection event
    this.publishGateEvent('gate.rejected', rejected);

    return rejected;
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

    const overridden = await this.store.updateStatus(gateId, GateStatus.overridden, overriddenBy);

    // Capture in knowledge graph — overrides are explicitly intuition-based
    this.captureDecisionInGraph(overridden, 'overridden', overriddenBy, justification);

    return overridden;
  }

  /**
   * Escalate a gate. Transitions to 'escalated'.
   * Looks up the parent problem set via the problem_sets table and tags
   * escalation metadata including parent ID and originating tab.
   */
  async escalateGate(
    gateId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<DecisionGate> {
    const gate = await this.store.findById(gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);

    // Look up parent problem set for escalation target
    const pool = getPool();
    const parentResult = await pool.query(
      `SELECT parent_problem_set_id FROM problem_sets WHERE id = $1`,
      [gate.problem_set_id],
    );
    const parentProblemSetId = parentResult.rows.length > 0
      ? (parentResult.rows[0] as { parent_problem_set_id: string | null }).parent_problem_set_id
      : null;

    await this.store.update(gateId, {
      decision_context: {
        ...gate.decision_context,
        escalation_reason: reason,
        escalated_by: escalatedBy,
        escalated_at: new Date().toISOString(),
        ...(parentProblemSetId ? {
          escalatedToParent: parentProblemSetId,
          escalatedFromTab: gate.tab,
        } : {}),
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
          // Use escalateGate to tag parent escalation metadata
          const escalated = await this.escalateGate(
            gate.id,
            'system:timeout',
            'Auto-escalated: deadline exceeded',
          );
          // Add timeout-specific metadata
          await this.store.update(gate.id, {
            decision_context: {
              ...escalated.decision_context,
              timeout_action: 'auto_escalated',
              timeout_at: now.toISOString(),
              ...modeTag,
            },
          });
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

  // =========================================================================
  // Escalation Queries
  // =========================================================================

  /**
   * Get all gates escalated TO a parent problem set from its children.
   * Queries decision_gates where status='escalated' and
   * decision_context->>'escalatedToParent' matches the parent ID.
   */
  async getEscalatedGatesForParent(parentProblemSetId: string): Promise<DecisionGate[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM decision_gates
       WHERE status = 'escalated'
         AND decision_context->>'escalatedToParent' = $1
       ORDER BY updated_at DESC`,
      [parentProblemSetId],
    );
    // Re-fetch through store to get properly mapped DecisionGate objects
    const gates: DecisionGate[] = [];
    for (const row of result.rows) {
      const gate = await this.store.findById((row as { id: string }).id);
      if (gate) gates.push(gate);
    }
    return gates;
  }

  // =========================================================================
  // Hierarchical Visibility
  // =========================================================================

  /**
   * Get own gates plus gates from child problem sets.
   * Enables parent commanders to see child problem set gates.
   */
  async getGatesWithChildVisibility(
    problemSetId: string,
  ): Promise<{ ownGates: DecisionGate[]; childGates: DecisionGate[] }> {
    const ownGates = await this.store.findByProblemSet(problemSetId);

    // Get child problem set IDs via inheritance store
    let childIds: string[] = [];
    try {
      childIds = await inheritanceStore.getDescendantProblemSetIds(problemSetId);
    } catch {
      // Graceful degradation: if inheritance not available, return own gates only
    }

    const childGates: DecisionGate[] = [];
    for (const childId of childIds) {
      const gates = await this.store.findByProblemSet(childId);
      childGates.push(...gates);
    }

    return { ownGates, childGates };
  }

  // =========================================================================
  // Role-Based Permissions
  // =========================================================================

  /**
   * Derive gate permissions from a user's DAO membership role.
   *
   * - commander/xo: full permissions (approve, reject, override, configure, escalate)
   * - member/planner/analyst: can escalate rejected or stalled gates
   * - All roles: canEscalate on rejected or stalled (pending past deadline) gates
   */
  canActOnGate(
    userRole: string,
    gate: DecisionGate,
  ): GatePermissions {
    const normalizedRole = userRole.toLowerCase();
    const isCommanderRole = normalizedRole === 'commander' || normalizedRole === 'xo';

    // Escalation allowed for all roles on rejected/escalated/stalled gates
    const isEscalatable = gate.status === GateStatus.rejected
      || gate.status === GateStatus.escalated
      || (gate.status === GateStatus.pending && !!gate.deadline_at && new Date(gate.deadline_at) < new Date());

    return {
      canApprove: isCommanderRole,
      canReject: isCommanderRole,
      canOverride: isCommanderRole,
      canEscalate: isEscalatable,
      canConfigure: isCommanderRole,
    };
  }

  /**
   * Configure parent authority: whether parent has direct action capability
   * on child gates or requires formal escalation.
   * Stores config in problem set metadata via decision_context convention.
   */
  async configureParentAuthority(
    problemSetId: string,
    config: { directAction: boolean },
  ): Promise<void> {
    const pool = getPool();
    // Store in problem_sets metadata column or a dedicated config
    // Using a simple approach: store in a gate-config record
    await pool.query(
      `INSERT INTO decision_gates (
        problem_set_id, gate_type, tab, target_item_id, target_item_type,
        target_item_title, enforcement, status, decision_context, mode
      ) VALUES ($1, 'parent_authority_config', 'direct', 'config', 'config',
        'Parent Authority Configuration', 'soft_warning', 'approved',
        $2, 'operational')
       ON CONFLICT DO NOTHING`,
      [problemSetId, JSON.stringify({ parentAuthority: config })],
    );
  }

  // =========================================================================
  // Decision Graph Capture
  // =========================================================================

  /**
   * Record a gate decision in the knowledge graph.
   * Non-blocking: errors are logged but never propagated.
   */
  private captureDecisionInGraph(
    gate: DecisionGate,
    outcome: string,
    decidedBy: string,
    rationale: string,
  ): void {
    // Determine decision basis from the evidence available
    const context = gate.decision_context as Record<string, unknown>;
    const proposal = context.proposal as Record<string, unknown> | undefined;
    const hasDocEvidence = !!proposal?.metadata;
    const basis: DecisionBasis = context.auto_approved
      ? 'analysis_based'
      : hasDocEvidence ? 'document_based' : 'intuition_based';

    // Identify knowledge gaps for intuition-based decisions
    const knowledgeGaps: string[] = [];
    if (basis === 'intuition_based') {
      knowledgeGaps.push(
        `Decision on "${gate.target_item_title}" (${gate.gate_type}) made without linked document evidence`,
      );
    }

    decisionStore.createDecision({
      gateId: gate.id,
      decisionType: gate.gate_type,
      title: `${gate.gate_type}: ${gate.target_item_title}`,
      description: (proposal?.description as string) || gate.target_item_title,
      outcome,
      rationale,
      basis,
      supportingDocumentIds: [],
      linkedObjectiveIds: [],
      predecessorDecisionIds: [],
      knowledgeGaps,
      decidedBy,
      problemSetId: gate.problem_set_id,
    }).then((decision) => {
      console.log(`[GateService] Decision captured in graph: ${decision.id} (${outcome})`);
    }).catch((err) => {
      console.error('[GateService] Failed to capture decision in graph (non-fatal):', err);
    });
  }

  /**
   * Publish gate lifecycle event to message bus for real-time COP notifications.
   * Critical gates (robot_action_auth with lethal context) are tagged as urgent.
   */
  private publishGateEvent(eventType: string, gate: DecisionGate): void {
    try {
      const context = gate.decision_context as Record<string, unknown> | null;
      const isLethal = context?.escalation_type === 'lethal_force';
      const isResourceAllocation = gate.target_item_type === 'resource_allocation';

      // Emit directly for WebSocket bridge (bypasses message bus ABAC)
      this.emit('gate:event', {
        type: eventType,
        gate_id: gate.id,
        gate_type: gate.gate_type,
        status: gate.status,
        urgency: isLethal ? 'critical' : isResourceAllocation ? 'high' : 'standard',
        is_lethal: isLethal,
        title: gate.target_item_title,
        problem_set_id: gate.problem_set_id,
        target_item_id: gate.target_item_id,
        target_item_type: gate.target_item_type,
        enforcement: gate.enforcement,
      });

      // Determine urgency: lethal > resource_allocation > standard
      const urgency = isLethal ? 'critical' : isResourceAllocation ? 'high' : 'standard';

      const messageBus = getMessageBus();
      messageBus.publish({
        sourceDid: 'system:gate-service',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'gate:lifecycle',
        messageType: eventType,
        payload: {
          gate_id: gate.id,
          gate_type: gate.gate_type,
          status: gate.status,
          urgency,
          is_lethal: isLethal,
          title: gate.target_item_title,
          problem_set_id: gate.problem_set_id,
          target_item_id: gate.target_item_id,
          target_item_type: gate.target_item_type,
          enforcement: gate.enforcement,
          // Include location context for map zoom (from decision_context)
          threat_entity: context?.threat_entity,
          threat_designation: context?.threat_designation,
          swarm_id: context?.swarm_id,
          mission_id: context?.mission_id,
          decided_by: gate.decided_by,
          decided_at: gate.decided_at,
        },
      }).catch((err) => {
        console.warn('[GateService] Failed to publish gate event (non-fatal):', err);
      });
    } catch {
      // Non-fatal — don't break gate operations if message bus is unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// Expedited Authorization — single-signer blockchain-anchored decision
// ---------------------------------------------------------------------------

/**
 * Expedited single-signer authorization for robot action gates.
 *
 * Records the decision on the NEAR blockchain via tx-signer, then updates
 * the gate status locally. If the blockchain call fails, the gate status is
 * still updated locally and the failure is logged — the demo does not stall
 * on NEAR testnet issues.
 *
 * @param gateId  - The gate to authorize
 * @param decision - 'approve' or 'deny'
 * @param missionContext - Contextual data to anchor on-chain
 * @param commanderSecret - Commander's derived signing secret (32 bytes).
 *   Pass a zero-filled buffer in environments without a live NEAR key.
 * @returns { txHash, gateStatus, blockchainStatus }
 */
export async function expeditedAuthorize(
  gateId: string,
  decision: 'approve' | 'deny',
  missionContext: Record<string, unknown>,
  commanderSecret?: Uint8Array,
): Promise<{ txHash: string; gateStatus: string; blockchainStatus: 'recorded' | 'pending' }> {
  const contractId = process.env.DID_CONTRACT_ID || 'did.bastion.testnet';

  let txHash = '';
  let blockchainStatus: 'recorded' | 'pending' = 'pending';

  // Attempt blockchain recording — non-fatal if it fails
  if (commanderSecret && commanderSecret.length >= 32) {
    try {
      const result = await signAndSubmitFunctionCall(
        commanderSecret,
        contractId,
        'record_authorization',
        {
          gate_id: gateId,
          decision,
          context: missionContext,
          timestamp: new Date().toISOString(),
        },
      );

      if (result.success && result.txHash) {
        txHash = result.txHash;
        blockchainStatus = 'recorded';
        console.log(
          `[GateService] expeditedAuthorize: blockchain recorded gate=${gateId} tx=${txHash}`,
        );
      } else {
        // Contract may not expose record_authorization — log and proceed locally
        console.warn(
          `[GateService] expeditedAuthorize: blockchain call returned non-success (gate=${gateId}): ${result.error ?? 'unknown'}. Falling back to local record.`,
        );
      }
    } catch (err) {
      console.warn(
        `[GateService] expeditedAuthorize: blockchain error (non-fatal, gate=${gateId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    // No commander secret provided (dev/demo environment without NEAR key)
    txHash = `local-${Date.now()}`;
    console.log(
      `[GateService] expeditedAuthorize: no commander secret — recording locally (gate=${gateId}, decision=${decision})`,
    );
  }

  // Update gate status locally regardless of blockchain outcome
  const newStatus = decision === 'approve' ? GateStatus.approved : GateStatus.rejected;
  await gateStore.update(gateId, {
    status: newStatus,
    proposal_id: txHash || `local-${Date.now()}`,
    decided_at: new Date().toISOString(),
    decision_context: {
      ...missionContext,
      expedited: true,
      blockchain_status: blockchainStatus,
      dao_tx_hash: txHash,
    },
  });

  return { txHash, gateStatus: newStatus, blockchainStatus };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gateService = new GateService(gateStore);

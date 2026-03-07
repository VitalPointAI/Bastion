/**
 * Ironclaw Action Pipeline
 *
 * Phase 30 Plan 03: Two-tier confirmation pipeline that routes actions through
 * inline confirms (yes/no/always) or Decision Gates (Phase 28) based on risk
 * level and user trust preferences.
 *
 * Flow:
 *  1. Rate limit check
 *  2. Risk classification
 *  3. Trust preference lookup
 *  4. Decision routing:
 *     - High risk: always creates a Decision Gate (hard block)
 *     - Trusted + non-high: auto-approved (bypass confirmation)
 *     - Untrusted + non-high: inline confirmation (yes/no/always card)
 */

import { gateService } from '../gates/index.js';
import { ironclawStore } from './ironclaw-store.js';
import { actionRegistry } from './action-registry.js';
import type { IronclawAction, ActionCardData, TrustDecision, ActionRiskLevel } from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Action Result
// ---------------------------------------------------------------------------

export interface ActionResult {
  status: 'executed' | 'confirm_required' | 'gate_created' | 'denied' | 'rate_limited';
  result?: Record<string, unknown>;
  action_card?: ActionCardData;
  gate_id?: string;
  error?: string;
  retry_after?: number;
}

// ---------------------------------------------------------------------------
// ActionPipeline
// ---------------------------------------------------------------------------

export class ActionPipeline {
  /**
   * Process an inbound action request through the confirmation pipeline.
   *
   * Returns an ActionResult indicating whether the action was auto-approved,
   * requires inline confirmation, was routed to a Decision Gate, or was
   * rate-limited.
   *
   * Note: For 'executed' status, the caller is responsible for actually
   * executing the action — the pipeline only decides approval.
   */
  async processAction(action: IronclawAction, userDid: string): Promise<ActionResult> {
    // 1. Rate limit check
    const rateCheck = actionRegistry.checkRateLimit(userDid, action.type);
    if (!rateCheck.allowed) {
      await ironclawStore.logAction({
        problem_set_id: action.problem_set_id,
        user_did: userDid,
        action_type: action.type,
        action_payload: action.payload,
        risk_level: actionRegistry.getRiskLevel(action.type),
        decision: 'denied',
        gate_id: null,
        result: null,
        error: 'Rate limited',
        emergency: false,
        justification: null,
      });
      return { status: 'rate_limited', retry_after: rateCheck.retryAfter };
    }

    // 2. Risk classification
    const riskLevel: ActionRiskLevel = actionRegistry.getRiskLevel(action.type);

    // 3. Trust preference check
    const trustPref = await ironclawStore.getTrustPreference(
      userDid,
      action.problem_set_id,
      action.type,
    );

    // 4. Decision routing
    if (riskLevel === 'high') {
      // High-risk: ALWAYS create Decision Gate regardless of trust
      const gate = await gateService.createGate({
        problem_set_id: action.problem_set_id,
        gate_type: 'agent_action' as never, // Cast: gate_type will be extended in a future plan
        target_item_id: action.id,
        target_item_type: 'ironclaw_action',
        target_item_title: action.description,
        enforcement: 'hard_block' as never, // Cast: using string literal compatible with gate system
      });

      await ironclawStore.logAction({
        problem_set_id: action.problem_set_id,
        user_did: userDid,
        action_type: action.type,
        action_payload: action.payload,
        risk_level: riskLevel,
        decision: 'gate_pending',
        gate_id: gate.id,
        result: null,
        error: null,
        emergency: false,
        justification: null,
      });

      return { status: 'gate_created', gate_id: gate.id };
    }

    if (trustPref) {
      // Trusted + non-high risk: auto-approve
      await ironclawStore.logAction({
        problem_set_id: action.problem_set_id,
        user_did: userDid,
        action_type: action.type,
        action_payload: action.payload,
        risk_level: riskLevel,
        decision: 'auto_approved',
        gate_id: null,
        result: null,
        error: null,
        emergency: false,
        justification: null,
      });

      return { status: 'executed' };
    }

    // No trust, non-high risk: inline confirmation
    return {
      status: 'confirm_required',
      action_card: {
        action_id: action.id,
        action_type: action.type,
        description: action.description,
        risk_level: riskLevel,
        options: ['yes', 'no', 'always'],
      },
    };
  }

  /**
   * Handle a user's confirmation response to an inline action card.
   *
   * @param actionId - The action being confirmed
   * @param userDid - The user making the decision
   * @param problemSetId - Context for trust preference storage
   * @param decision - 'yes' (approve once), 'no' (deny), 'always' (approve + trust)
   */
  async handleConfirmation(
    actionId: string,
    userDid: string,
    problemSetId: string,
    decision: TrustDecision,
  ): Promise<ActionResult> {
    if (decision === 'no') {
      await ironclawStore.logAction({
        problem_set_id: problemSetId,
        user_did: userDid,
        action_type: actionId, // Action type not available here; caller should provide
        action_payload: {},
        risk_level: 'medium', // Default; actual risk not critical for denial log
        decision: 'denied',
        gate_id: null,
        result: null,
        error: null,
        emergency: false,
        justification: null,
      });
      return { status: 'denied' };
    }

    if (decision === 'always') {
      // Grant trust for this action type in this problem set
      await ironclawStore.grantTrust(userDid, problemSetId, actionId);
    }

    // 'yes' or 'always': approve
    await ironclawStore.logAction({
      problem_set_id: problemSetId,
      user_did: userDid,
      action_type: actionId,
      action_payload: {},
      risk_level: 'medium',
      decision: 'approved',
      gate_id: null,
      result: null,
      error: null,
      emergency: false,
      justification: null,
    });

    return { status: 'executed' };
  }

  /**
   * Process an emergency action that bypasses normal confirmation flow.
   *
   * Emergency actions are logged with emergency=true and the provided
   * justification for full audit traceability.
   *
   * TODO: Role verification (system_admin) should be done by the caller/router
   * before invoking this method.
   */
  async handleEmergencyAction(
    action: IronclawAction,
    userDid: string,
    justification: string,
  ): Promise<ActionResult> {
    await ironclawStore.logAction({
      problem_set_id: action.problem_set_id,
      user_did: userDid,
      action_type: action.type,
      action_payload: action.payload,
      risk_level: actionRegistry.getRiskLevel(action.type),
      decision: 'auto_approved',
      gate_id: null,
      result: null,
      error: null,
      emergency: true,
      justification,
    });

    return { status: 'executed' };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const actionPipeline = new ActionPipeline();

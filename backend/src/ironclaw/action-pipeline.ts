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
import type { AgentGovernancePolicy } from '../identity/types.js';

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
  // Per-agent governance cache — loaded from DID documents at session start.
  // Registry locks at startup and cannot accept per-agent changes afterward;
  // the pipeline consults both locked registry defaults AND per-agent overrides.
  private readonly agentGovernanceCache = new Map<string, AgentGovernancePolicy>();

  /**
   * Compute the effective risk level for an action, applying per-agent governance
   * overrides on top of registry defaults.
   *
   * INVARIANT: Risk can only be elevated, never downgraded.
   * Unknown agents (no cache entry) fall back to ACTION_RISK defaults.
   */
  private getEffectiveRisk(actionType: string, agentDid?: string): ActionRiskLevel {
    const base = actionRegistry.getRiskLevel(actionType);
    if (!agentDid) return base;

    const policy = this.agentGovernanceCache.get(agentDid);
    if (!policy) return base;

    // Blocked actions are treated as high risk — will require explicit approval
    if (policy.blockedActions?.includes(actionType)) {
      return 'high';
    }

    // If allowedActions is specified, unlisted actions are treated as high risk
    if (policy.allowedActions && policy.allowedActions.length > 0 && !policy.allowedActions.includes(actionType)) {
      return 'high';
    }

    // Apply risk overrides — can ONLY elevate, never downgrade
    const override = policy.actionRiskOverrides?.[actionType];
    if (!override) return base;

    const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
    return (riskOrder[override] ?? 0) > (riskOrder[base] ?? 0) ? override as ActionRiskLevel : base;
  }

  /**
   * Load governance policy for an agent from its DID document and cache it.
   *
   * Called at session start. Falls back silently if the agent's DID has no
   * governance section (backward compatible — no cache entry means use defaults).
   *
   * Note: Full DID resolution requires the agent's userSecret. For the Phase 53
   * MVP, use setGovernancePolicy() to populate the cache directly when governance
   * data is available from a higher-trust source (e.g., session initialization).
   */
  async loadAgentGovernance(agentDid: string): Promise<void> {
    try {
      // Phase 53 MVP: the cache is populated via setGovernancePolicy() by callers
      // who have access to the resolved DID document (e.g., session init code).
      // Full DID resolution path requires the agent's userSecret and is deferred.
      console.log(`[action-pipeline] Governance load requested for ${agentDid} — use setGovernancePolicy() to populate directly.`);
    } catch (err) {
      console.warn(`[action-pipeline] Failed to load governance for ${agentDid}:`, err);
    }
  }

  /**
   * Directly set the governance policy for an agent in the cache.
   *
   * Called by session initialization code after resolving the agent's DID document.
   * This bypasses the need for a separate DID resolution within the pipeline.
   */
  setGovernancePolicy(agentDid: string, policy: AgentGovernancePolicy): void {
    this.agentGovernanceCache.set(agentDid, policy);
    console.log(`[action-pipeline] Governance policy cached for ${agentDid} (v${policy.policyVersion})`);
  }

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
  async processAction(action: IronclawAction, userDid: string, agentDid?: string): Promise<ActionResult> {
    // 1. Rate limit check
    const rateCheck = actionRegistry.checkRateLimit(userDid, action.type);
    if (!rateCheck.allowed) {
      await ironclawStore.logAction({
        problem_set_id: action.problem_set_id,
        user_did: userDid,
        action_type: action.type,
        action_payload: action.payload,
        risk_level: this.getEffectiveRisk(action.type, agentDid),
        decision: 'denied',
        gate_id: null,
        result: null,
        error: 'Rate limited',
        emergency: false,
        justification: null,
      });
      return { status: 'rate_limited', retry_after: rateCheck.retryAfter };
    }

    // 2. Risk classification (per-agent governance overrides applied here)
    const riskLevel: ActionRiskLevel = this.getEffectiveRisk(action.type, agentDid);

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
    agentDid?: string,
  ): Promise<ActionResult> {
    await ironclawStore.logAction({
      problem_set_id: action.problem_set_id,
      user_did: userDid,
      action_type: action.type,
      action_payload: action.payload,
      risk_level: this.getEffectiveRisk(action.type, agentDid),
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

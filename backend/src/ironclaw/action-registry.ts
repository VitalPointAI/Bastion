/**
 * Ironclaw Action Registry
 *
 * Phase 30 Plan 03: Registers action types with risk levels, provides risk
 * classification lookup, and enforces per-user per-risk-level rate limiting
 * via an in-memory sliding window.
 *
 * Unknown action types default to 'high' risk (safe default per the
 * "always confirm by default" design decision).
 */

import {
  ActionRiskLevel,
  ACTION_RISK,
  RATE_LIMITS,
} from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Rate Limit Check Result
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

// ---------------------------------------------------------------------------
// ActionRegistry
// ---------------------------------------------------------------------------

export class ActionRegistry {
  /** Registered action types mapped to their risk level. */
  private readonly actions = new Map<string, ActionRiskLevel>();

  /** Sliding-window timestamps: key = `${userDid}:${riskBucket}`, value = timestamps (ms). */
  private readonly rateLimitMap = new Map<string, number[]>();

  constructor() {
    // Pre-populate from the canonical ACTION_RISK map in ironclaw-types.
    for (const [type, risk] of Object.entries(ACTION_RISK)) {
      this.actions.set(type, risk);
    }
  }

  // =========================================================================
  // Action Type Registration
  // =========================================================================

  /**
   * Return the risk level for a given action type.
   * Unknown types default to 'high' (safe default).
   */
  getRiskLevel(actionType: string): ActionRiskLevel {
    return this.actions.get(actionType) ?? ActionRiskLevel.high;
  }

  /** Whether the action type has been explicitly registered. */
  isRegistered(actionType: string): boolean {
    return this.actions.has(actionType);
  }

  /**
   * Register or override an action type's risk level.
   * Allows MCP tools to register their risk levels dynamically.
   */
  registerAction(actionType: string, riskLevel: ActionRiskLevel): void {
    this.actions.set(actionType, riskLevel);
  }

  /** List all registered actions with their risk levels. */
  getAllActions(): Array<{ type: string; riskLevel: ActionRiskLevel }> {
    return Array.from(this.actions.entries()).map(([type, riskLevel]) => ({
      type,
      riskLevel,
    }));
  }

  // =========================================================================
  // Rate Limiting (in-memory sliding window)
  // =========================================================================

  /**
   * Check whether a user is within the rate limit for the given action type.
   *
   * Rate limit buckets:
   *  - Actions starting with 'code.' use the dedicated `code_pr` window (5/hour).
   *  - All other actions use their risk level window (low 60/min, medium 10/min, high 3/min).
   */
  checkRateLimit(userDid: string, actionType: string): RateLimitResult {
    const isCodeAction = actionType.startsWith('code.');
    const riskLevel = this.getRiskLevel(actionType);
    const bucket = isCodeAction ? 'code_pr' : riskLevel;
    const config = RATE_LIMITS[bucket];

    const key = `${userDid}:${bucket}`;
    const now = Date.now();
    const windowMs = config.window_seconds * 1000;
    const cutoff = now - windowMs;

    // Get and clean up old entries
    const timestamps = this.rateLimitMap.get(key) ?? [];
    const active = timestamps.filter((ts) => ts > cutoff);

    if (active.length >= config.max) {
      // Find when the earliest active entry will expire
      const earliest = active[0]!;
      const retryAfter = Math.ceil((earliest + windowMs - now) / 1000);
      this.rateLimitMap.set(key, active);
      return { allowed: false, retryAfter };
    }

    // Record this check as a new entry (caller records when action proceeds)
    active.push(now);
    this.rateLimitMap.set(key, active);
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const actionRegistry = new ActionRegistry();

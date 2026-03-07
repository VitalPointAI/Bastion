/**
 * Circuit Breaker
 *
 * Phase 31 Plan 03: Evaluates agent validation scores against thresholds,
 * disables agents when critical, activates fallbacks, posts critical alerts,
 * and handles reinstatement (standard re-test or admin override).
 */

import type {
  ValidationCategory,
  CircuitState,
  CircuitBreakerEventRow,
  CircuitEventType,
  ValidationAgentScoreRow,
} from './validation-types.js';
import { validationStore } from './validation-store.js';
import { getThresholdForAgent, type ResolvedThreshold } from './threshold-config.js';
import { getAgentRegistry } from '../agents/registry.js';
import { aiStaffStore } from '../ai-staff/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluateResult {
  state: CircuitState;
  action: 'none' | 'warn' | 'disable';
}

export interface ReinstateResult {
  reinstated: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  /**
   * Evaluate an agent's score against thresholds for a category.
   * Returns the resulting circuit state and required action.
   */
  async evaluate(
    agentId: string,
    category: ValidationCategory,
    score: number,
  ): Promise<EvaluateResult> {
    const threshold = await getThresholdForAgent(agentId, category);

    // Above warning threshold => closed / passing
    if (score >= threshold.warningThreshold) {
      return { state: 'closed' as CircuitState, action: 'none' };
    }

    // Below critical threshold => check for immediate disable or grace period
    if (score < threshold.criticalThreshold) {
      if (threshold.immediateDisable) {
        return { state: 'open' as CircuitState, action: 'disable' };
      }

      // Check grace period - count consecutive failures
      const consecutiveFailures = await this.countConsecutiveFailures(
        agentId,
        category,
        threshold.criticalThreshold,
      );

      if (consecutiveFailures + 1 >= threshold.gracePeriodRuns) {
        return { state: 'open' as CircuitState, action: 'disable' };
      }

      return { state: 'warning' as CircuitState, action: 'warn' };
    }

    // Between critical and warning => warning state
    return { state: 'warning' as CircuitState, action: 'warn' };
  }

  /**
   * Disable an agent due to critical validation failure.
   * Deactivates in registry, inserts circuit event, activates fallback,
   * posts critical alert, and sends webhook.
   */
  async disableAgent(
    agentId: string,
    category: string,
    runId: string,
    triggeredBy: string,
  ): Promise<void> {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Deactivate in registry
    try {
      registry.deactivateAgent(agentId);
    } catch (err) {
      console.error(`[CircuitBreaker] Failed to deactivate ${agentId}:`, err);
    }

    // Get current scores for details
    const latestScores = await validationStore.getLatestAgentScores(agentId);
    const categoryScore = latestScores.find((s) => s.category === category);

    // Insert circuit event
    const event: Omit<CircuitBreakerEventRow, 'id' | 'created_at'> = {
      agent_id: agentId,
      category,
      event_type: 'disabled' as CircuitEventType,
      previous_state: 'warning',
      new_state: 'open',
      triggered_by: triggeredBy,
      justification: null,
      run_id: runId,
      details: {
        score: categoryScore?.avg_score ?? null,
        action: 'agent_disabled',
      },
    };
    await validationStore.insertCircuitEvent(event);

    // Activate fallback
    const fallbackId = await this.activateFallback(agentId);
    if (fallbackId) {
      console.log(
        `[CircuitBreaker] Fallback activated: ${fallbackId} replacing ${agentId}`,
      );
    } else {
      console.warn(
        `[CircuitBreaker] No fallback available for disabled agent ${agentId}`,
      );
    }

    // Post critical alert to AI staff feed
    const threshold = await getThresholdForAgent(
      agentId,
      category as ValidationCategory,
    );
    await this.postCriticalAlert(
      agentId,
      category,
      categoryScore?.avg_score ?? 0,
      threshold.criticalThreshold,
    );

    // Send webhook (fire-and-forget)
    this.sendWebhook({
      ...event,
      id: '',
      created_at: new Date().toISOString(),
    }).catch((err) => {
      console.error('[CircuitBreaker] Webhook failed:', err);
    });
  }

  /**
   * Reinstate a disabled agent.
   *
   * Standard path (no justification): triggers re-test, only reactivates
   * if ALL category scores pass warning thresholds.
   *
   * Admin override (with justification): force-reactivates without re-test,
   * logged for audit.
   */
  async reinstateAgent(
    agentId: string,
    triggeredBy: string,
    justification?: string,
  ): Promise<ReinstateResult> {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    if (justification) {
      // Admin override path - force reactivate without re-test
      const agent = registry.getAgent(agentId);
      if (agent) {
        agent.active = true;
      }

      await validationStore.insertCircuitEvent({
        agent_id: agentId,
        category: 'all',
        event_type: 'override' as CircuitEventType,
        previous_state: 'open',
        new_state: 'closed',
        triggered_by: triggeredBy,
        justification,
        run_id: null,
        details: { method: 'admin_override', justification },
      });

      return { reinstated: true };
    }

    // Standard path - trigger re-test
    // Lazy import to avoid circular dependency
    const { validationRunner } = await import('./validation-runner.js');
    const fixture = await validationRunner.loadFixtureForAgent(agentId);

    if (!fixture) {
      return {
        reinstated: false,
        reason: `No test fixture found for agent ${agentId}`,
      };
    }

    // Create a dedicated run for reinstatement
    const run = await validationStore.createRun(`reinstatement:${triggeredBy}`);

    try {
      await validationRunner.executeAgentTests(fixture, run.id);
    } catch (err) {
      await validationStore.completeRun(run.id, 'failed', 1, 0);
      return {
        reinstated: false,
        reason: `Re-test execution failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    await validationStore.completeRun(
      run.id,
      'completed',
      1,
      fixture.scenarios.length + fixture.adversarialScenarios.length,
    );

    // Check if all scores pass warning thresholds
    const scores = await validationStore.getLatestAgentScores(agentId);
    const categories = ['determinism', 'reliability', 'authority'] as const;
    const failures: string[] = [];

    for (const cat of categories) {
      const catScore = scores.find((s) => s.category === cat);
      if (!catScore) continue;

      const threshold = await getThresholdForAgent(
        agentId,
        cat as ValidationCategory,
      );
      if (catScore.avg_score < threshold.warningThreshold) {
        failures.push(
          `${cat}: ${catScore.avg_score.toFixed(3)} < ${threshold.warningThreshold}`,
        );
      }
    }

    if (failures.length > 0) {
      await validationStore.insertCircuitEvent({
        agent_id: agentId,
        category: 'all',
        event_type: 'reinstated' as CircuitEventType,
        previous_state: 'open',
        new_state: 'open',
        triggered_by: triggeredBy,
        justification: null,
        run_id: run.id,
        details: {
          method: 'standard_retest',
          result: 'failed',
          failures,
        },
      });
      return {
        reinstated: false,
        reason: `Re-test failed: ${failures.join('; ')}`,
      };
    }

    // All passed - reactivate
    const agent = registry.getAgent(agentId);
    if (agent) {
      agent.active = true;
    }

    await validationStore.insertCircuitEvent({
      agent_id: agentId,
      category: 'all',
      event_type: 'reinstated' as CircuitEventType,
      previous_state: 'open',
      new_state: 'closed',
      triggered_by: triggeredBy,
      justification: null,
      run_id: run.id,
      details: {
        method: 'standard_retest',
        result: 'passed',
      },
    });

    return { reinstated: true };
  }

  /**
   * Activate a fallback agent with the same role as the disabled agent.
   * Picks the active agent with the highest recent validation score.
   */
  async activateFallback(agentId: string): Promise<string | null> {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const disabledAgent = registry.getAgent(agentId);
    if (!disabledAgent) return null;

    // Find agents with overlapping capabilities (same role proxy)
    const allAgents = registry.listAgents();
    const candidates = allAgents.filter(
      (a) =>
        a.agentId !== agentId &&
        a.active &&
        a.capabilities.some((c) => disabledAgent.capabilities.includes(c)),
    );

    if (candidates.length === 0) return null;

    // Pick the one with highest recent average score
    let bestCandidate = candidates[0];
    let bestScore = -1;

    for (const candidate of candidates) {
      const scores = await validationStore.getLatestAgentScores(
        candidate.agentId,
      );
      const avgAll =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.avg_score, 0) / scores.length
          : 0.5; // default for unscored agents
      if (avgAll > bestScore) {
        bestScore = avgAll;
        bestCandidate = candidate;
      }
    }

    // Log fallback activation
    await validationStore.insertCircuitEvent({
      agent_id: agentId,
      category: 'all',
      event_type: 'fallback_activated' as CircuitEventType,
      previous_state: 'open',
      new_state: 'open',
      triggered_by: 'circuit_breaker',
      justification: null,
      run_id: null,
      details: {
        fallbackAgentId: bestCandidate.agentId,
        fallbackAgentName: bestCandidate.name,
        fallbackScore: bestScore,
      },
    });

    return bestCandidate.agentId;
  }

  /**
   * Post a critical alert to the AI staff feed about a validation failure.
   */
  async postCriticalAlert(
    agentId: string,
    category: string,
    score: number,
    threshold: number,
  ): Promise<void> {
    try {
      await aiStaffStore.createFeedItem({
        problem_set_id: 'system',
        agent_id: 'validation-system',
        agent_display_name: 'Validation System',
        agent_role: 'system',
        team_id: null,
        team_name: null,
        source_tab: 'validation',
        priority: 'critical',
        urgency: 'action_required',
        content: `AGENT DISABLED: ${agentId} failed ${category} validation. Score: ${score.toFixed(3)} (threshold: ${threshold.toFixed(3)}). Agent has been automatically disabled and fallback activated if available. Review in Validation Dashboard.`,
        content_type: 'text',
        confidence: 'confirmed',
        is_auto_applied: false,
        inline_target: null,
        actions: [
          {
            label: 'View Validation Dashboard',
            action: 'navigate',
            target: '/validation',
          },
          {
            label: 'Reinstate Agent',
            action: 'api_call',
            target: `/api/validation/agents/${agentId}/reinstate`,
          },
        ],
      });
    } catch (err) {
      console.error('[CircuitBreaker] Failed to post critical alert:', err);
    }
  }

  /**
   * Send webhook notification for circuit breaker events.
   * Fire-and-forget with 5s timeout.
   */
  async sendWebhook(event: CircuitBreakerEventRow): Promise<void> {
    const webhookUrl = process.env.VALIDATION_WEBHOOK_URL;
    if (!webhookUrl) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: event.agent_id,
          category: event.category,
          event_type: event.event_type,
          previous_state: event.previous_state,
          new_state: event.new_state,
          triggered_by: event.triggered_by,
          details: event.details,
          timestamp: event.created_at,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      console.error('[CircuitBreaker] Webhook delivery failed:', err);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Count consecutive recent failures (scores below threshold) for an agent/category.
   */
  private async countConsecutiveFailures(
    agentId: string,
    category: string,
    criticalThreshold: number,
  ): Promise<number> {
    const history = await validationStore.getAgentScoreHistory(
      agentId,
      category,
      10,
    );

    let count = 0;
    for (const score of history) {
      if (score.avg_score < criticalThreshold) {
        count++;
      } else {
        break; // stop at first passing score
      }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const circuitBreaker = new CircuitBreaker();

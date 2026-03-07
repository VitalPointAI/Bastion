/**
 * Ironclaw API Service
 *
 * REST API client for all Ironclaw endpoints.
 * Follows the AIStaffService pattern with authenticated fetch,
 * JSON content-type, credentials: 'include' for cookie auth, and singleton export.
 *
 * Covers: message send, history, confirm, trust preferences, health (6 endpoints).
 */

import type {
  IronclawChatMessage,
  TrustDecision,
  TrustPreference,
} from '../types/ironclaw.ts';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result from action confirmation endpoint */
export interface ActionResult {
  status: 'executed' | 'confirm_required' | 'gate_created' | 'denied' | 'rate_limited';
  result?: Record<string, unknown>;
  action_card?: {
    actionId: string;
    actionType: string;
    description: string;
    riskLevel: string;
    options: TrustDecision[];
  };
  gate_id?: string;
  error?: string;
  retry_after?: number;
}

// ─── Snake-to-Camel Helpers ──────────────────────────────────────────────────

/**
 * Transform a snake_case DB row to a camelCase IronclawChatMessage.
 */
function snakeToCamelMessage(row: Record<string, unknown>): IronclawChatMessage {
  return {
    id: row.id as string,
    problemSetId: (row.problem_set_id ?? row.problemSetId) as string,
    content: (row.content ?? '') as string,
    sender: (row.sender ?? 'ironclaw') as IronclawChatMessage['sender'],
    specialistId: (row.specialist_id ?? row.specialistId) as string | undefined,
    specialistDisplayName: (row.specialist_display_name ?? row.specialistDisplayName) as string | undefined,
    delegatedBy: (row.delegated_by ?? row.delegatedBy) as string | undefined,
    actionCard: row.action_card
      ? (row.action_card as IronclawChatMessage['actionCard'])
      : (row.actionCard as IronclawChatMessage['actionCard']),
    stepProgress: row.step_progress
      ? (row.step_progress as IronclawChatMessage['stepProgress'])
      : (row.stepProgress as IronclawChatMessage['stepProgress']),
    suggestion: row.suggestion
      ? (row.suggestion as IronclawChatMessage['suggestion'])
      : undefined,
    createdAt: (row.created_at ?? row.createdAt ?? new Date().toISOString()) as string,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

class IronclawApi {
  /**
   * Make authenticated API request.
   * Authentication is via HttpOnly cookie sent automatically with credentials: 'include'.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // 202 or 204 have no body
    if (response.status === 202 || response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ==========================================================================
  // Message Operations
  // ==========================================================================

  /**
   * Send a chat message to Ironclaw. Response is 202 (streaming via WebSocket).
   */
  async sendMessage(
    problemSetId: string,
    content: string,
    mentionedAgent?: string,
  ): Promise<void> {
    await this.fetch<void>(
      `/api/ironclaw/${encodeURIComponent(problemSetId)}/message`,
      {
        method: 'POST',
        body: JSON.stringify({ content, mentionedAgent }),
      },
    );
  }

  /**
   * Get chat history for a problem set.
   */
  async getHistory(
    problemSetId: string,
    limit?: number,
  ): Promise<IronclawChatMessage[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', String(limit));
    const qs = params.toString();

    const rows = await this.fetch<Record<string, unknown>[]>(
      `/api/ironclaw/${encodeURIComponent(problemSetId)}/history${qs ? `?${qs}` : ''}`,
    );

    return rows.map(snakeToCamelMessage);
  }

  // ==========================================================================
  // Action Confirmation
  // ==========================================================================

  /**
   * Confirm or deny an action. Returns ActionResult with execution status.
   */
  async confirmAction(
    problemSetId: string,
    actionId: string,
    decision: TrustDecision,
  ): Promise<ActionResult> {
    return this.fetch<ActionResult>(
      `/api/ironclaw/${encodeURIComponent(problemSetId)}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ actionId, decision }),
      },
    );
  }

  // ==========================================================================
  // Trust Preferences
  // ==========================================================================

  /**
   * Get trust preferences (always-allow) for a problem set.
   */
  async getTrustPreferences(problemSetId: string): Promise<TrustPreference[]> {
    return this.fetch<TrustPreference[]>(
      `/api/ironclaw/trust-preferences?problemSetId=${encodeURIComponent(problemSetId)}`,
    );
  }

  /**
   * Revoke a trust preference (always-allow) by ID.
   */
  async revokeTrust(preferenceId: string): Promise<void> {
    await this.fetch<void>(
      `/api/ironclaw/trust-preferences/${encodeURIComponent(preferenceId)}`,
      { method: 'DELETE' },
    );
  }

  // ==========================================================================
  // Health
  // ==========================================================================

  /**
   * Check Ironclaw sidecar health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.fetch<{ healthy: boolean }>('/api/ironclaw/health');
      return result.healthy;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance of the Ironclaw API service.
 */
export const ironclawApi = new IronclawApi();

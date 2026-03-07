/**
 * AI Staff Service
 *
 * REST API client for all AI staff endpoints.
 * Follows the COPService / StrategicService pattern with authenticated fetch,
 * JSON content-type, and singleton export.
 *
 * Covers: feed, annotations, chat, routing (11 endpoints total).
 */

import type {
  AIFeedItem,
  AIAnnotation,
  ChatMessage,
  FeedItemAction,
  TabAgentConfig,
} from '../types/ai-staff.ts';

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Response shape for routing endpoint */
interface RoutingConfig {
  configs: TabAgentConfig[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

class AIStaffService {
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

    return response.json();
  }

  // ==========================================================================
  // Feed Operations
  // ==========================================================================

  /**
   * Get feed items for a problem set.
   */
  async getFeed(
    problemSetId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<AIFeedItem[]> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    if (opts?.offset !== undefined) params.append('offset', String(opts.offset));
    const qs = params.toString();
    return this.fetch<AIFeedItem[]>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/feed${qs ? `?${qs}` : ''}`,
    );
  }

  /**
   * Create a new feed item.
   */
  async createFeedItem(
    problemSetId: string,
    item: Omit<AIFeedItem, 'id' | 'timestamp' | 'isRead'>,
  ): Promise<AIFeedItem> {
    return this.fetch<AIFeedItem>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/feed`,
      {
        method: 'POST',
        body: JSON.stringify(item),
      },
    );
  }

  /**
   * Mark a single feed item as read.
   */
  async markRead(problemSetId: string, itemId: string): Promise<void> {
    await this.fetch<void>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/feed/${encodeURIComponent(itemId)}/read`,
      { method: 'PATCH' },
    );
  }

  /**
   * Mark all feed items as read.
   */
  async markAllRead(problemSetId: string): Promise<void> {
    await this.fetch<void>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/feed/read-all`,
      { method: 'POST' },
    );
  }

  // ==========================================================================
  // Annotation Operations
  // ==========================================================================

  /**
   * Get annotations for a problem set.
   */
  async getAnnotations(problemSetId: string): Promise<AIAnnotation[]> {
    return this.fetch<AIAnnotation[]>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/annotations`,
    );
  }

  /**
   * Create a new inline annotation.
   */
  async createAnnotation(
    problemSetId: string,
    annotation: Omit<AIAnnotation, 'annotationId' | 'status'>,
  ): Promise<AIAnnotation> {
    return this.fetch<AIAnnotation>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/annotations`,
      {
        method: 'POST',
        body: JSON.stringify(annotation),
      },
    );
  }

  /**
   * Update an annotation's status (accept, dismiss, modify, escalate).
   */
  async updateAnnotation(
    problemSetId: string,
    annotationId: string,
    status: FeedItemAction,
  ): Promise<AIAnnotation> {
    return this.fetch<AIAnnotation>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/annotations/${encodeURIComponent(annotationId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
  }

  // ==========================================================================
  // Chat Operations
  // ==========================================================================

  /**
   * Get chat history for a problem set.
   */
  async getChatHistory(problemSetId: string, limit?: number): Promise<ChatMessage[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', String(limit));
    const qs = params.toString();
    return this.fetch<ChatMessage[]>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/chat${qs ? `?${qs}` : ''}`,
    );
  }

  /**
   * Send a chat message to AI staff. Response arrives via WebSocket as a feed item.
   */
  async sendChat(
    problemSetId: string,
    message: { content: string; sender: 'user' },
  ): Promise<ChatMessage> {
    return this.fetch<ChatMessage>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/chat`,
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
    );
  }

  // ==========================================================================
  // Routing Operations
  // ==========================================================================

  /**
   * Get agent routing configuration for a problem set.
   */
  async getRouting(problemSetId: string): Promise<RoutingConfig> {
    return this.fetch<RoutingConfig>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/routing`,
    );
  }

  /**
   * Update agent routing for a specific tab.
   */
  async updateRouting(
    problemSetId: string,
    tabId: string,
    agentIds: string[],
  ): Promise<TabAgentConfig> {
    return this.fetch<TabAgentConfig>(
      `/api/ai-staff/${encodeURIComponent(problemSetId)}/routing`,
      {
        method: 'PUT',
        body: JSON.stringify({ tabId, agentIds }),
      },
    );
  }
}

/**
 * Singleton instance of the AI staff service.
 */
export const aiStaffService = new AIStaffService();

/**
 * OSINT Service
 *
 * API client for OSINT feed configuration and events.
 * Manages problem-set-scoped OSINT connections (RSS, API, webhook, simulated).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeedSourceType = 'argus_webhook' | 'rss' | 'api' | 'simulated';
export type RelevanceMode = 'entity_objective' | 'ai_semantic';

export interface OSINTFeedConfig {
  id: string;
  problemSetId: string;
  sourceName: string;
  sourceType: FeedSourceType;
  endpointUrl: string | null;
  pollingIntervalMs: number;
  relevanceMode: RelevanceMode;
  active: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface CreateFeedInput {
  problemSetId: string;
  sourceName: string;
  sourceType: FeedSourceType;
  endpointUrl?: string;
  pollingIntervalMs?: number;
  relevanceMode?: RelevanceMode;
  config?: Record<string, unknown>;
}

export interface UpdateFeedInput {
  sourceName?: string;
  sourceType?: FeedSourceType;
  endpointUrl?: string | null;
  pollingIntervalMs?: number;
  relevanceMode?: RelevanceMode;
  active?: boolean;
  config?: Record<string, unknown>;
}

export interface OSINTEvent {
  id: string;
  feedConfigId: string;
  title: string;
  content: string;
  sourceUrl: string;
  publishedAt: string;
  entities: Array<{ entityId: string; entityName: string; confidence: number }>;
  relevanceScore: number;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sourceTypeLabel(type: FeedSourceType): string {
  switch (type) {
    case 'rss': return 'RSS Feed';
    case 'api': return 'API';
    case 'argus_webhook': return 'Argus Webhook';
    case 'simulated': return 'Simulated';
    default: return type;
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export const osintService = {
  sourceTypeLabel,

  /** Get feed configurations for a problem set. */
  async getFeeds(problemSetId: string): Promise<OSINTFeedConfig[]> {
    const res = await fetch(`${API_BASE}/api/osint/feeds/${encodeURIComponent(problemSetId)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get OSINT feeds: ${res.statusText}`);
    const body = await res.json() as { feeds?: OSINTFeedConfig[] } | OSINTFeedConfig[];
    return Array.isArray(body) ? body : (body.feeds ?? []);
  },

  /** Create a new feed configuration. */
  async createFeed(data: CreateFeedInput): Promise<OSINTFeedConfig> {
    const res = await fetch(`${API_BASE}/api/osint/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create OSINT feed: ${res.statusText}`);
    const body = await res.json() as { feed?: OSINTFeedConfig };
    return body.feed ?? body as unknown as OSINTFeedConfig;
  },

  /** Update a feed configuration. */
  async updateFeed(feedId: string, updates: UpdateFeedInput): Promise<OSINTFeedConfig> {
    const res = await fetch(`${API_BASE}/api/osint/feeds/${encodeURIComponent(feedId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update OSINT feed: ${res.statusText}`);
    const body = await res.json() as { feed?: OSINTFeedConfig };
    return body.feed ?? body as unknown as OSINTFeedConfig;
  },

  /** Delete a feed configuration. */
  async deleteFeed(feedId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/osint/feeds/${encodeURIComponent(feedId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to delete OSINT feed: ${res.statusText}`);
  },

  /** Toggle a feed active/inactive. */
  async toggleFeed(feedId: string, active: boolean): Promise<OSINTFeedConfig> {
    return osintService.updateFeed(feedId, { active });
  },

  /** Get recent OSINT events for a problem set. */
  async getRecentEvents(problemSetId: string, limit = 20): Promise<OSINTEvent[]> {
    const res = await fetch(
      `${API_BASE}/api/osint/events?problemSetId=${encodeURIComponent(problemSetId)}&limit=${limit}`,
      { credentials: 'include' },
    );
    if (!res.ok) throw new Error(`Failed to get OSINT events: ${res.statusText}`);
    return res.json();
  },

  /** Trigger immediate poll of all active feeds. */
  async pollNow(): Promise<{ feedsPolled: number; itemsStored: number }> {
    const res = await fetch(`${API_BASE}/api/osint/feeds/poll-now`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to poll feeds: ${res.statusText}`);
    return res.json();
  },

  /** Get OSINT events relevant to specific objectives. */
  async getEventsByRelevance(
    problemSetId: string,
    objectiveIds: string[],
  ): Promise<OSINTEvent[]> {
    const params = new URLSearchParams({ problemSetId });
    objectiveIds.forEach((id) => params.append('objectiveId', id));
    const res = await fetch(`${API_BASE}/api/osint/events/relevant?${params}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get relevant OSINT events: ${res.statusText}`);
    return res.json();
  },
};

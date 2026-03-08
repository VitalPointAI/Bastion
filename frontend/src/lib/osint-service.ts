/**
 * OSINT Service
 *
 * Phase 33 Plan 04: API client for OSINT feed configuration and events.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend) ──────────────────────────────────────────

export interface OSINTFeedConfig {
  id: string;
  problemSetId: string;
  feedUrl: string;
  feedType: 'rss' | 'webhook';
  name: string;
  active: boolean;
  filterKeywords: string[];
  webhookSecret: string | null;
  createdAt: string;
  updatedAt: string;
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

// ─── Service ────────────────────────────────────────────────────────────────

export const osintService = {
  /**
   * Get feed configurations for a problem set.
   */
  async getFeeds(problemSetId: string): Promise<OSINTFeedConfig[]> {
    const res = await fetch(`${API_BASE}/api/osint/feeds/${problemSetId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get OSINT feeds: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create a new feed configuration.
   */
  async createFeed(data: {
    problemSetId: string;
    feedUrl: string;
    feedType: 'rss' | 'webhook';
    name: string;
    filterKeywords?: string[];
  }): Promise<OSINTFeedConfig> {
    const res = await fetch(`${API_BASE}/api/osint/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create OSINT feed: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get recent OSINT events for a problem set.
   */
  async getRecentEvents(problemSetId: string, limit = 20): Promise<OSINTEvent[]> {
    const res = await fetch(
      `${API_BASE}/api/osint/events?problemSetId=${problemSetId}&limit=${limit}`,
      { credentials: 'include' },
    );
    if (!res.ok) throw new Error(`Failed to get OSINT events: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get OSINT events relevant to specific objectives.
   */
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

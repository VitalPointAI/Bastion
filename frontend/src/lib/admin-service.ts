/**
 * Admin Service
 *
 * Client for admin configuration API endpoints.
 * Provides typed methods for LLM, agents, workflow, and OSINT source management.
 */

import type {
  LLMProviderConfig,
  LLMProviderConfigUpdate,
  AgentConfig,
  AgentConfigUpdate,
  WorkflowConfig,
  WorkflowConfigUpdate,
  OSINTSourceConfig,
  OSINTSourceConfigInput,
  OSINTSourceConfigUpdate,
  OSINTSourcesResponse,
  AuditLogResponse,
  CacheInvalidationResponse,
} from '../types/admin';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Admin Service class.
 * Manages system configuration for LLM providers, agents, workflows, and OSINT sources.
 */
class AdminService {
  private token: string | null = null;
  private userDID: string | null = null;

  /**
   * Set authentication token for API requests.
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Set user DID for admin authorization.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request with X-DID header.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // Admin Access Check
  // ============================================================================

  /**
   * Check if current user has admin access.
   * Attempts to fetch LLM config; 403 means not admin.
   */
  async isAdmin(): Promise<boolean> {
    try {
      await this.fetch<LLMProviderConfig>('/api/admin/config/llm');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        return false;
      }
      // Other errors (network, etc.) - assume not admin to be safe
      return false;
    }
  }

  // ============================================================================
  // LLM Provider Configuration
  // ============================================================================

  /**
   * Get current LLM provider configuration.
   * Note: apiKey will be masked (last 4 chars only).
   */
  async getLLMConfig(): Promise<LLMProviderConfig> {
    return this.fetch<LLMProviderConfig>('/api/admin/config/llm');
  }

  /**
   * Update LLM provider configuration.
   * @param config - Partial config to update
   * @param reason - Optional reason for audit log
   */
  async updateLLMConfig(
    config: LLMProviderConfigUpdate,
    reason?: string
  ): Promise<LLMProviderConfig> {
    const body = reason ? { ...config, reason } : config;
    return this.fetch<LLMProviderConfig>('/api/admin/config/llm', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ============================================================================
  // Agent Configuration
  // ============================================================================

  /**
   * Get current agent configuration.
   */
  async getAgentConfig(): Promise<AgentConfig> {
    return this.fetch<AgentConfig>('/api/admin/config/agents');
  }

  /**
   * Update agent configuration.
   * @param config - Partial config to update
   * @param reason - Optional reason for audit log
   */
  async updateAgentConfig(
    config: AgentConfigUpdate,
    reason?: string
  ): Promise<AgentConfig> {
    const body = reason ? { ...config, reason } : config;
    return this.fetch<AgentConfig>('/api/admin/config/agents', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ============================================================================
  // Workflow Configuration
  // ============================================================================

  /**
   * Get current workflow configuration.
   */
  async getWorkflowConfig(): Promise<WorkflowConfig> {
    return this.fetch<WorkflowConfig>('/api/admin/config/workflow');
  }

  /**
   * Update workflow configuration.
   * @param config - Partial config to update
   * @param reason - Optional reason for audit log
   */
  async updateWorkflowConfig(
    config: WorkflowConfigUpdate,
    reason?: string
  ): Promise<WorkflowConfig> {
    const body = reason ? { ...config, reason } : config;
    return this.fetch<WorkflowConfig>('/api/admin/config/workflow', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ============================================================================
  // OSINT Source Configuration
  // ============================================================================

  /**
   * Get all OSINT sources.
   */
  async getOSINTSources(): Promise<OSINTSourcesResponse> {
    return this.fetch<OSINTSourcesResponse>('/api/admin/osint-sources');
  }

  /**
   * Add a new OSINT source.
   * @param source - Source configuration (without id)
   */
  async addOSINTSource(source: OSINTSourceConfigInput): Promise<OSINTSourceConfig> {
    return this.fetch<OSINTSourceConfig>('/api/admin/osint-sources', {
      method: 'POST',
      body: JSON.stringify(source),
    });
  }

  /**
   * Update an existing OSINT source.
   * @param id - Source ID to update
   * @param updates - Partial updates to apply
   */
  async updateOSINTSource(
    id: string,
    updates: OSINTSourceConfigUpdate
  ): Promise<OSINTSourceConfig> {
    return this.fetch<OSINTSourceConfig>(
      `/api/admin/osint-sources/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  /**
   * Delete an OSINT source.
   * @param id - Source ID to delete
   * @param reason - Optional reason for audit log
   */
  async deleteOSINTSource(id: string, reason?: string): Promise<void> {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await this.fetch<void>(
      `/api/admin/osint-sources/${encodeURIComponent(id)}${params}`,
      { method: 'DELETE' }
    );
  }

  // ============================================================================
  // Audit Log
  // ============================================================================

  /**
   * Get configuration audit log.
   * @param params - Optional filters (category, limit)
   */
  async getAuditLog(params?: {
    category?: string;
    limit?: number;
  }): Promise<AuditLogResponse> {
    const searchParams = new URLSearchParams();
    if (params?.category) {
      searchParams.append('category', params.category);
    }
    if (params?.limit) {
      searchParams.append('limit', String(params.limit));
    }

    const queryString = searchParams.toString();
    const path = queryString
      ? `/api/admin/config/audit?${queryString}`
      : '/api/admin/config/audit';

    return this.fetch<AuditLogResponse>(path);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate configuration cache.
   * Forces reload of all cached configuration values.
   */
  async invalidateCache(): Promise<CacheInvalidationResponse> {
    return this.fetch<CacheInvalidationResponse>('/api/admin/cache/invalidate', {
      method: 'POST',
    });
  }
}

/**
 * Singleton instance of the admin service.
 */
export const adminService = new AdminService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display name for LLM provider.
 */
export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    'azure-openai': 'Azure OpenAI',
    'near-ai': 'NEAR AI',
    local: 'Local Model',
  };
  return names[provider] || provider;
}

/**
 * Get display name for OSINT source type.
 */
export function getSourceTypeDisplayName(type: string): string {
  const names: Record<string, string> = {
    RSS: 'RSS Feed',
    API: 'API',
    SCRAPE: 'Web Scraper',
    MANUAL: 'Manual Entry',
  };
  return names[type] || type;
}

/**
 * Get display name for agent.
 */
export function getAgentDisplayName(agent: string): string {
  const names: Record<string, string> = {
    osintCollector: 'OSINT Collector',
    documentProcessor: 'Document Processor',
    threatMonitor: 'Threat Monitor',
    fusionAgent: 'Fusion Agent',
    extractionAgent: 'Extraction Agent',
    assessmentAgent: 'Assessment Agent',
    redTeamAgent: 'Red Team Agent',
    devilsAdvocate: "Devil's Advocate",
    coaGenerator: 'COA Generator',
  };
  return names[agent] || agent;
}

/**
 * Get display name for risk level.
 */
export function getRiskLevelDisplayName(level: string): string {
  const names: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    EXTREME: 'Extreme',
  };
  return names[level] || level;
}

/**
 * Format credibility rating as percentage.
 */
export function formatCredibilityRating(rating: number): string {
  return `${Math.round(rating * 100)}%`;
}

/**
 * Format timestamp for audit log display.
 */
export function formatAuditTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

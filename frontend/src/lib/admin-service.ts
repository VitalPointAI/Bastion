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
  AgentWithConfig,
  AgentDefinition,
  AgentModelConfig,
  MCPTool,
  MCPToolInput,
  MCPToolUpdate,
  ToolCategory,
  AgentTeam,
  AgentTeamInput,
  AgentTeamUpdate,
  TeamMember,
  AgentCharacter,
} from '../types/admin';

// ============================================================================
// Funding Contract Types
// ============================================================================

/**
 * Funding contract status response from backend.
 */
export interface FundingStatus {
  enabled: boolean;
  contractId?: string;
  balance?: string;
  availableBalance?: string;
  fundingAmountPerAccount?: string;
  totalAccountsFunded?: number;
  accountsRemaining?: number;
  message?: string;
}

/**
 * Single funding history item.
 */
export interface FundingHistoryItem {
  accountId: string;
  amount: string;
  timestamp: string;
  blockHeight: number;
}

/**
 * Funding history response from backend.
 */
export interface FundingHistory {
  enabled: boolean;
  history: FundingHistoryItem[];
}

/**
 * Account funding check response.
 */
export interface AccountFundingCheck {
  enabled: boolean;
  accountId?: string;
  funded: boolean;
}

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

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

  /**
   * Fetch available models from a provider via backend proxy.
   * Uses backend proxy to avoid CORS issues with external APIs.
   */
  async fetchProviderModels(
    provider: string,
    apiKey?: string,
    baseUrl?: string
  ): Promise<{ id: string; name: string }[]> {
    try {
      // Build query params for backend proxy
      const params = new URLSearchParams({ provider });
      if (apiKey) params.append('apiKey', apiKey);
      if (baseUrl) params.append('baseUrl', baseUrl);

      const response = await this.fetch<{ models: { id: string; name: string }[] }>(
        `/api/admin/llm-models?${params.toString()}`
      );

      return response.models || [];
    } catch (error) {
      console.warn(`Error fetching models from ${provider}:`, error);
      return [];
    }
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
  // Agent Management (Per-Agent Model Configuration)
  // ============================================================================

  /**
   * List all agents with their configurations.
   */
  async listAgents(): Promise<AgentWithConfig[]> {
    const response = await this.fetch<{ agents: AgentWithConfig[] }>('/api/admin/agents');
    return response.agents;
  }

  /**
   * Create a new agent.
   * @param definition - Agent definition
   * @returns Created agent ID and DID
   */
  async createAgent(definition: AgentDefinition): Promise<{ agentId: string; agentDID: string }> {
    return this.fetch<{ agentId: string; agentDID: string }>('/api/admin/agents', {
      method: 'POST',
      body: JSON.stringify(definition),
    });
  }

  /**
   * Update an existing agent.
   * @param agentId - Agent ID to update
   * @param updates - Partial updates to apply
   */
  async updateAgent(agentId: string, updates: Partial<AgentDefinition>): Promise<void> {
    await this.fetch<void>(`/api/admin/agents/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete an agent.
   * @param agentId - Agent ID to delete
   */
  async deleteAgent(agentId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get per-agent model configuration.
   * @param agentId - Agent ID
   * @returns Agent model config or null if using global default
   */
  async getAgentModelConfig(agentId: string): Promise<AgentModelConfig | null> {
    try {
      return await this.fetch<AgentModelConfig>(`/api/admin/config/agents/${encodeURIComponent(agentId)}/model`);
    } catch (error) {
      // 404 means no custom config - using global default
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set per-agent model configuration.
   * @param agentId - Agent ID
   * @param config - Model configuration to set
   */
  async setAgentModelConfig(agentId: string, config: AgentModelConfig): Promise<void> {
    await this.fetch<void>(`/api/admin/config/agents/${encodeURIComponent(agentId)}/model`, {
      method: 'PUT',
      body: JSON.stringify({ config, reason: 'Updated via Admin UI' }),
    });
  }

  /**
   * Clear per-agent model configuration (revert to global default).
   * @param agentId - Agent ID
   */
  async clearAgentModelConfig(agentId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/config/agents/${encodeURIComponent(agentId)}/model`, {
      method: 'DELETE',
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

  // ============================================================================
  // Tool Management
  // ============================================================================

  /**
   * List all tools, optionally filtered by category.
   */
  async listTools(category?: ToolCategory): Promise<MCPTool[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await this.fetch<{ tools: MCPTool[] }>(`/api/admin/tools${params}`);
    return response.tools;
  }

  /**
   * Get a tool by ID.
   */
  async getTool(toolId: string): Promise<MCPTool & { assignedAgents: string[] }> {
    return this.fetch<MCPTool & { assignedAgents: string[] }>(`/api/admin/tools/${encodeURIComponent(toolId)}`);
  }

  /**
   * Create a new tool.
   */
  async createTool(input: MCPToolInput): Promise<{ toolId: string; toolDID: string }> {
    return this.fetch<{ toolId: string; toolDID: string }>('/api/admin/tools', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Update a tool.
   */
  async updateTool(toolId: string, updates: MCPToolUpdate): Promise<MCPTool> {
    const response = await this.fetch<{ updated: boolean; tool: MCPTool }>(`/api/admin/tools/${encodeURIComponent(toolId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.tool;
  }

  /**
   * Delete a tool.
   */
  async deleteTool(toolId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/tools/${encodeURIComponent(toolId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Assign a tool to an agent.
   */
  async assignToolToAgent(toolId: string, agentId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/tools/${encodeURIComponent(toolId)}/assign/${encodeURIComponent(agentId)}`, {
      method: 'POST',
    });
  }

  /**
   * Unassign a tool from an agent.
   */
  async unassignToolFromAgent(toolId: string, agentId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/tools/${encodeURIComponent(toolId)}/assign/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get tools for an agent.
   */
  async getToolsForAgent(agentId: string): Promise<MCPTool[]> {
    const response = await this.fetch<{ agentId: string; tools: MCPTool[] }>(`/api/admin/agents/${encodeURIComponent(agentId)}/tools`);
    return response.tools;
  }

  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * List all teams.
   */
  async listTeams(): Promise<AgentTeam[]> {
    const response = await this.fetch<{ teams: AgentTeam[] }>('/api/admin/teams');
    return response.teams;
  }

  /**
   * Get a team by ID.
   */
  async getTeam(teamId: string): Promise<AgentTeam> {
    return this.fetch<AgentTeam>(`/api/admin/teams/${encodeURIComponent(teamId)}`);
  }

  /**
   * Create a new team.
   */
  async createTeam(input: AgentTeamInput): Promise<{ teamId: string; teamDID: string }> {
    return this.fetch<{ teamId: string; teamDID: string }>('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Update a team.
   */
  async updateTeam(teamId: string, updates: AgentTeamUpdate): Promise<AgentTeam> {
    const response = await this.fetch<{ updated: boolean; team: AgentTeam }>(`/api/admin/teams/${encodeURIComponent(teamId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.team;
  }

  /**
   * Delete a team.
   */
  async deleteTeam(teamId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/teams/${encodeURIComponent(teamId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Add a member to a team.
   */
  async addTeamMember(teamId: string, member: TeamMember): Promise<AgentTeam> {
    const response = await this.fetch<{ added: boolean; team: AgentTeam }>(`/api/admin/teams/${encodeURIComponent(teamId)}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
    return response.team;
  }

  /**
   * Remove a member from a team.
   */
  async removeTeamMember(teamId: string, agentId: string): Promise<AgentTeam> {
    const response = await this.fetch<{ removed: boolean; team: AgentTeam }>(`/api/admin/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
    return response.team;
  }

  /**
   * Get teams for an agent.
   */
  async getTeamsForAgent(agentId: string): Promise<AgentTeam[]> {
    const response = await this.fetch<{ agentId: string; teams: AgentTeam[] }>(`/api/admin/agents/${encodeURIComponent(agentId)}/teams`);
    return response.teams;
  }

  // ============================================================================
  // Character Management
  // ============================================================================

  /**
   * Get an agent's character definition.
   */
  async getAgentCharacter(agentId: string): Promise<AgentCharacter | null> {
    try {
      const response = await this.fetch<{ agentId: string; character: AgentCharacter }>(`/api/admin/agents/${encodeURIComponent(agentId)}/character`);
      return response.character;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update an agent's character definition.
   */
  async updateAgentCharacter(agentId: string, character: AgentCharacter): Promise<AgentCharacter> {
    const response = await this.fetch<{ updated: boolean; agentId: string; character: AgentCharacter }>(`/api/admin/agents/${encodeURIComponent(agentId)}/character`, {
      method: 'PUT',
      body: JSON.stringify(character),
    });
    return response.character;
  }

  /**
   * Remove an agent's character definition.
   */
  async removeAgentCharacter(agentId: string): Promise<void> {
    await this.fetch<void>(`/api/admin/agents/${encodeURIComponent(agentId)}/character`, {
      method: 'DELETE',
    });
  }
}

/**
 * Singleton instance of the admin service.
 */
// ============================================================================
  // Funding Contract Management
  // ============================================================================

  /**
   * Get funding contract status.
   * Returns balance, total funded accounts, and remaining capacity.
   */
  async getFundingStatus(): Promise<FundingStatus> {
    return this.fetch<FundingStatus>('/api/admin/funding/status');
  }

  /**
   * Get funding activity history.
   * @param fromIndex - Starting index for pagination
   * @param limit - Maximum number of items to return
   */
  async getFundingHistory(fromIndex: number = 0, limit: number = 20): Promise<FundingHistory> {
    const params = new URLSearchParams({
      from: String(fromIndex),
      limit: String(limit),
    });
    return this.fetch<FundingHistory>(`/api/admin/funding/history?${params.toString()}`);
  }

  /**
   * Check if a specific account has been funded.
   * @param accountId - 64-character hex implicit account ID
   */
  async checkAccountFunding(accountId: string): Promise<AccountFundingCheck> {
    return this.fetch<AccountFundingCheck>(`/api/admin/funding/check/${encodeURIComponent(accountId)}`);
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

/**
 * Configuration Service
 * High-level service for managing system configuration with caching
 */

import { randomUUID } from 'crypto';
import { configStore } from './store.js';
import {
  type LLMProviderConfig,
  type LLMProviderConfigUpdate,
  type AgentConfig,
  type AgentConfigUpdate,
  type WorkflowConfig,
  type WorkflowConfigUpdate,
  type OSINTSourceConfig,
  type OSINTSourceConfigInput,
  type OSINTSourceConfigUpdate,
  type ConfigAuditEntry,
  type AgentModelConfig,
  CONFIG_CATEGORIES,
  CONFIG_KEYS,
  DEFAULT_LLM_CONFIG,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_WORKFLOW_CONFIG,
  LLMProviderConfigSchema,
  AgentConfigSchema,
  WorkflowConfigSchema,
  OSINTSourceConfigSchema,
  AgentModelConfigSchema,
} from './types.js';

// Cache entry with TTL
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Configuration Service
 * Provides caching layer and domain-specific methods for config management
 */
export class ConfigService {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get value from cache if valid
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.value as T;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set value in cache
   */
  private setCache<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Invalidate cache for a specific key or all keys
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // ==========================================================================
  // LLM Configuration
  // ==========================================================================

  /**
   * Get LLM provider configuration
   */
  async getLLMConfig(): Promise<LLMProviderConfig> {
    // Check cache
    const cached = this.getCached<LLMProviderConfig>(CONFIG_KEYS.LLM_PROVIDER);
    if (cached) {
      return cached;
    }

    // Get from store
    const config = await configStore.getConfig<LLMProviderConfig>(CONFIG_KEYS.LLM_PROVIDER);

    // Return stored config or default
    const result = config || { ...DEFAULT_LLM_CONFIG };
    this.setCache(CONFIG_KEYS.LLM_PROVIDER, result);
    return result;
  }

  /**
   * Update LLM provider configuration
   */
  async updateLLMConfig(
    updates: LLMProviderConfigUpdate,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    // Get current config
    const current = await this.getLLMConfig();

    // Merge updates
    const updated: LLMProviderConfig = {
      ...current,
      ...updates,
      models: updates.models ? { ...current.models, ...updates.models } : current.models,
      oauth: updates.oauth ? { ...current.oauth, ...updates.oauth } : current.oauth,
    };

    // Validate
    LLMProviderConfigSchema.parse(updated);

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.LLM_PROVIDER,
      CONFIG_CATEGORIES.LLM,
      updated,
      updatedBy,
      reason
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.LLM_PROVIDER);
  }

  // ==========================================================================
  // Agent Configuration
  // ==========================================================================

  /**
   * Get agent configuration
   */
  async getAgentConfig(): Promise<AgentConfig> {
    // Check cache
    const cached = this.getCached<AgentConfig>(CONFIG_KEYS.AGENT_CONFIG);
    if (cached) {
      return cached;
    }

    // Get from store
    const config = await configStore.getConfig<AgentConfig>(CONFIG_KEYS.AGENT_CONFIG);

    // Return stored config or default
    const result = config || { ...DEFAULT_AGENT_CONFIG };
    this.setCache(CONFIG_KEYS.AGENT_CONFIG, result);
    return result;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(
    updates: AgentConfigUpdate,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    // Get current config
    const current = await this.getAgentConfig();

    // Merge updates
    const updated: AgentConfig = {
      ...current,
      ...updates,
      enabledAgents: updates.enabledAgents
        ? { ...current.enabledAgents, ...updates.enabledAgents }
        : current.enabledAgents,
    };

    // Validate
    AgentConfigSchema.parse(updated);

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.AGENT_CONFIG,
      CONFIG_CATEGORIES.AGENTS,
      updated,
      updatedBy,
      reason
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.AGENT_CONFIG);
  }

  // ==========================================================================
  // Workflow Configuration
  // ==========================================================================

  /**
   * Get workflow configuration
   */
  async getWorkflowConfig(): Promise<WorkflowConfig> {
    // Check cache
    const cached = this.getCached<WorkflowConfig>(CONFIG_KEYS.WORKFLOW_CONFIG);
    if (cached) {
      return cached;
    }

    // Get from store
    const config = await configStore.getConfig<WorkflowConfig>(CONFIG_KEYS.WORKFLOW_CONFIG);

    // Return stored config or default
    const result = config || { ...DEFAULT_WORKFLOW_CONFIG };
    this.setCache(CONFIG_KEYS.WORKFLOW_CONFIG, result);
    return result;
  }

  /**
   * Update workflow configuration
   */
  async updateWorkflowConfig(
    updates: WorkflowConfigUpdate,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    // Get current config
    const current = await this.getWorkflowConfig();

    // Merge updates
    const updated: WorkflowConfig = {
      ...current,
      escalationTimeouts: updates.escalationTimeouts
        ? { ...current.escalationTimeouts, ...updates.escalationTimeouts }
        : current.escalationTimeouts,
      approvalAuthority: updates.approvalAuthority || current.approvalAuthority,
      notifications: updates.notifications
        ? { ...current.notifications, ...updates.notifications }
        : current.notifications,
    };

    // Validate
    WorkflowConfigSchema.parse(updated);

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.WORKFLOW_CONFIG,
      CONFIG_CATEGORIES.WORKFLOW,
      updated,
      updatedBy,
      reason
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.WORKFLOW_CONFIG);
  }

  // ==========================================================================
  // OSINT Source Configuration
  // ==========================================================================

  /**
   * Get all OSINT sources
   */
  async getOSINTSources(): Promise<OSINTSourceConfig[]> {
    // Check cache
    const cached = this.getCached<OSINTSourceConfig[]>(CONFIG_KEYS.OSINT_SOURCES);
    if (cached) {
      return cached;
    }

    // Get from store
    const sources = await configStore.getConfig<OSINTSourceConfig[]>(CONFIG_KEYS.OSINT_SOURCES);

    // Return stored sources or empty array
    const result = sources || [];
    this.setCache(CONFIG_KEYS.OSINT_SOURCES, result);
    return result;
  }

  /**
   * Get a single OSINT source by ID
   */
  async getOSINTSource(id: string): Promise<OSINTSourceConfig | null> {
    const sources = await this.getOSINTSources();
    return sources.find(s => s.id === id) || null;
  }

  /**
   * Add a new OSINT source
   */
  async addOSINTSource(
    input: OSINTSourceConfigInput,
    addedBy: string,
    reason?: string
  ): Promise<string> {
    // Get current sources
    const sources = await this.getOSINTSources();

    // Generate ID
    const id = `OSINT-${randomUUID().slice(0, 8)}`;

    // Create new source
    const newSource: OSINTSourceConfig = {
      ...input,
      id,
    };

    // Validate
    OSINTSourceConfigSchema.parse(newSource);

    // Add to sources
    const updated = [...sources, newSource];

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.OSINT_SOURCES,
      CONFIG_CATEGORIES.OSINT,
      updated,
      addedBy,
      reason || `Added OSINT source: ${input.name}`
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.OSINT_SOURCES);

    return id;
  }

  /**
   * Update an OSINT source
   */
  async updateOSINTSource(
    id: string,
    updates: OSINTSourceConfigUpdate,
    updatedBy: string,
    reason?: string
  ): Promise<boolean> {
    // Get current sources
    const sources = await this.getOSINTSources();

    // Find source index
    const index = sources.findIndex(s => s.id === id);
    if (index === -1) {
      return false;
    }

    // Merge updates
    const updated: OSINTSourceConfig = {
      ...sources[index],
      ...updates,
      id, // Preserve ID
    };

    // Validate
    OSINTSourceConfigSchema.parse(updated);

    // Update sources array
    const newSources = [...sources];
    newSources[index] = updated;

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.OSINT_SOURCES,
      CONFIG_CATEGORIES.OSINT,
      newSources,
      updatedBy,
      reason || `Updated OSINT source: ${updated.name}`
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.OSINT_SOURCES);

    return true;
  }

  /**
   * Delete an OSINT source
   */
  async deleteOSINTSource(
    id: string,
    deletedBy: string,
    reason?: string
  ): Promise<boolean> {
    // Get current sources
    const sources = await this.getOSINTSources();

    // Find source
    const source = sources.find(s => s.id === id);
    if (!source) {
      return false;
    }

    // Remove source
    const updated = sources.filter(s => s.id !== id);

    // Save to store
    await configStore.setConfig(
      CONFIG_KEYS.OSINT_SOURCES,
      CONFIG_CATEGORIES.OSINT,
      updated,
      deletedBy,
      reason || `Deleted OSINT source: ${source.name}`
    );

    // Invalidate cache
    this.invalidateCache(CONFIG_KEYS.OSINT_SOURCES);

    return true;
  }

  // ==========================================================================
  // Audit
  // ==========================================================================

  /**
   * Get configuration audit history
   */
  async getAuditHistory(options?: {
    category?: string;
    limit?: number;
    since?: Date;
  }): Promise<ConfigAuditEntry[]> {
    return configStore.getAuditHistory(options);
  }

  // ==========================================================================
  // Per-Agent Model Configuration
  // ==========================================================================

  /**
   * Get per-agent model configuration
   * @param agentId - The agent's unique identifier
   * @returns The agent's model config or null if not set
   */
  async getAgentModelConfig(agentId: string): Promise<AgentModelConfig | null> {
    const key = `agents.${agentId}.model`;

    // Check cache first
    const cached = this.getCached<AgentModelConfig>(key);
    if (cached) {
      return cached;
    }

    // Get from store
    const config = await configStore.getConfig<AgentModelConfig>(key);
    if (config) {
      try {
        const validated = AgentModelConfigSchema.parse(config);
        this.setCache(key, validated);
        return validated;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Set per-agent model configuration
   * @param agentId - The agent's unique identifier
   * @param config - The model configuration
   * @param updatedBy - DID of the user making the change
   * @param reason - Reason for the change (for audit)
   */
  async setAgentModelConfig(
    agentId: string,
    config: AgentModelConfig,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    const key = `agents.${agentId}.model`;

    // Validate config
    const validated = AgentModelConfigSchema.parse(config);

    // Store using configStore (includes audit trail)
    await configStore.setConfig(
      key,
      CONFIG_CATEGORIES.AGENTS,
      validated,
      updatedBy,
      reason || `Updated model config for agent: ${agentId}`
    );

    // Invalidate cache
    this.invalidateCache(key);
  }

  /**
   * List all per-agent model configurations
   * @returns Array of all agent model configs
   */
  async listAgentModelConfigs(): Promise<AgentModelConfig[]> {
    // Get all configs in the agents category
    const allConfigs = await configStore.getAllConfigs(CONFIG_CATEGORIES.AGENTS);

    // Filter for agent model configs (key pattern: agents.{agentId}.model)
    const agentModelConfigs: AgentModelConfig[] = [];

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.match(/^agents\.[^.]+\.model$/)) {
        try {
          const validated = AgentModelConfigSchema.parse(value);
          agentModelConfigs.push(validated);
        } catch {
          // Skip invalid entries
          continue;
        }
      }
    }

    return agentModelConfigs;
  }

  /**
   * Delete per-agent model configuration
   * @param agentId - The agent's unique identifier
   * @param deletedBy - DID of the user making the change
   * @param reason - Reason for the deletion (for audit)
   * @returns true if deleted, false if not found
   */
  async deleteAgentModelConfig(
    agentId: string,
    deletedBy: string,
    reason?: string
  ): Promise<boolean> {
    const key = `agents.${agentId}.model`;

    // Delete from store (includes audit trail)
    const deleted = await configStore.deleteConfig(
      key,
      deletedBy,
      reason || `Deleted model config for agent: ${agentId}`
    );

    if (deleted) {
      // Invalidate cache
      this.invalidateCache(key);
    }

    return deleted;
  }
}

// Export singleton instance
export const configService = new ConfigService();

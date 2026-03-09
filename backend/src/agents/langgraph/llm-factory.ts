/**
 * LLM Factory - Dynamic LLM Instantiation per Agent
 *
 * Creates the correct ChatModel instance based on agent's configuration.
 * Supports Anthropic, OpenAI, Azure OpenAI, NEAR AI, and local (Ollama).
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { configService } from '../../strategic/config/service.js';
import type { LLMProvider } from '../../strategic/config/types.js';

/**
 * Options for creating an LLM instance.
 */
export interface CreateLLMOptions {
  /** Agent ID to fetch config for */
  agentId: string;
  /** Override temperature from agent config */
  overrides?: {
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Resolved LLM configuration after merging agent and global config.
 */
export interface ResolvedLLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
  baseUrl?: string;
}

/**
 * Cache for LLM instances keyed by config hash.
 * Prevents recreation overhead for same configuration.
 */
const llmCache = new Map<string, { llm: BaseChatModel; createdAt: number }>();

/** Cache TTL in milliseconds (10 minutes) */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Generate a cache key from resolved config.
 */
function getCacheKey(config: ResolvedLLMConfig): string {
  return `${config.provider}:${config.model}:${config.temperature}:${config.maxTokens}`;
}

/**
 * Clean expired cache entries.
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of llmCache.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      llmCache.delete(key);
    }
  }
}

/**
 * Resolve LLM configuration for an agent.
 * Merges agent-specific config with global defaults.
 */
export async function resolveLLMConfig(
  agentId: string,
  overrides?: CreateLLMOptions['overrides']
): Promise<ResolvedLLMConfig> {
  // Get agent-specific config
  const agentConfig = await configService.getAgentModelConfig(agentId);

  // Get global LLM config for fallback
  const globalConfig = await configService.getLLMConfig();

  // Determine provider and model
  const provider: LLMProvider = agentConfig?.provider || globalConfig.provider;
  const model = agentConfig?.model || globalConfig.models.analysis;

  // Determine temperature and max tokens
  const temperature =
    overrides?.temperature ??
    agentConfig?.temperature ??
    0.3;
  const maxTokens =
    overrides?.maxTokens ??
    agentConfig?.maxTokens ??
    4096;

  // Get API key — prefer OAuth token over static API key for Anthropic
  let apiKey = globalConfig.apiKey;
  if (provider === 'anthropic' && globalConfig.oauth?.connected && globalConfig.oauth?.accessToken) {
    const { getValidOAuthToken } = await import('../../auth/oauth-token-refresh.js');
    const oauthToken = await getValidOAuthToken();
    if (oauthToken) apiKey = oauthToken;
  }
  const baseUrl = globalConfig.baseUrl;

  return {
    provider,
    model,
    temperature,
    maxTokens,
    apiKey,
    baseUrl,
  };
}

/**
 * Create a ChatModel instance for the specified provider.
 */
function createChatModel(config: ResolvedLLMConfig): BaseChatModel {
  const { provider, model, temperature, maxTokens, apiKey, baseUrl } = config;

  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({
        model,
        temperature,
        maxTokens,
        apiKey,
      });

    case 'openai':
      return new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        apiKey,
      });

    case 'azure-openai':
      return new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        apiKey,
        configuration: {
          baseURL: baseUrl,
        },
      });

    case 'near-ai':
      return new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        apiKey,
        configuration: {
          baseURL: baseUrl || 'https://api.near.ai/v1',
        },
      });

    case 'local':
      // Ollama uses OpenAI-compatible API
      return new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        configuration: {
          baseURL: baseUrl || 'http://localhost:11434/v1',
        },
        // No API key needed for local
        apiKey: 'ollama',
      });

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Create an LLM instance for a specific agent.
 *
 * Uses the agent's configured model from AgentModelConfig,
 * falling back to global LLMProviderConfig defaults.
 *
 * @param options - Agent ID and optional overrides
 * @returns Configured ChatModel instance
 */
export async function createLLMForAgent(
  options: CreateLLMOptions
): Promise<BaseChatModel> {
  const { agentId, overrides } = options;

  // Resolve configuration
  const config = await resolveLLMConfig(agentId, overrides);

  // Check cache
  const cacheKey = getCacheKey(config);
  const cached = llmCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.llm;
  }

  // Clean expired entries periodically
  if (llmCache.size > 10) {
    cleanCache();
  }

  // Create new LLM instance
  const llm = createChatModel(config);

  // Cache the instance
  llmCache.set(cacheKey, { llm, createdAt: Date.now() });

  console.log(
    `[LLM Factory] Created ${config.provider}/${config.model} for agent ${agentId} ` +
    `(temp: ${config.temperature}, maxTokens: ${config.maxTokens})`
  );

  return llm;
}

/**
 * Clear the LLM cache.
 * Call when agent configurations change.
 */
export function clearLLMCache(): void {
  llmCache.clear();
  console.log('[LLM Factory] Cache cleared');
}

/**
 * Get cache statistics for monitoring.
 */
export function getLLMCacheStats(): { size: number; keys: string[] } {
  return {
    size: llmCache.size,
    keys: Array.from(llmCache.keys()),
  };
}

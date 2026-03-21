/**
 * LLM Provider Registry
 * Factory and default configurations for all supported LLM providers
 */

import type { LLMProvider, ProviderConfig, ProviderType } from './types.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAICompatibleProvider } from './openai-provider.js';

export * from './types.js';
export { AnthropicProvider } from './anthropic-provider.js';
export { OpenAICompatibleProvider } from './openai-provider.js';

/**
 * Create LLM provider from configuration
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(config);

    case 'openai':
    case 'near-ai':
    case 'ollama':
    case 'localai':
    case 'vllm':
    case 'azure-openai':
    case 'bedrock':
      return new OpenAICompatibleProvider(config);

    default:
      throw new Error(`Unknown provider type: ${(config as ProviderConfig).type}`);
  }
}

/**
 * Default provider configs for common setups
 */
export const DEFAULT_CONFIGS: Record<ProviderType, Partial<ProviderConfig>> = {
  anthropic: {
    type: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
  },
  openai: {
    type: 'openai',
    model: 'gpt-4o',
  },
  'near-ai': {
    type: 'near-ai',
    model: 'qwen2.5-72b-instruct',
    baseUrl: 'https://api.near.ai/v1',
  },
  ollama: {
    type: 'ollama',
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
  },
  localai: {
    type: 'localai',
    model: 'gpt-4',
    baseUrl: 'http://localhost:8080/v1',
  },
  vllm: {
    type: 'vllm',
    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
    baseUrl: 'http://localhost:8000/v1',
  },
  'azure-openai': {
    type: 'azure-openai',
    model: 'gpt-4o',
  },
  bedrock: {
    type: 'bedrock',
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
};

/**
 * Get default config for a provider type
 */
export function getDefaultConfig(type: ProviderType): ProviderConfig {
  const defaultConfig = DEFAULT_CONFIGS[type];
  if (!defaultConfig) {
    throw new Error(`No default config for provider: ${type}`);
  }
  return { ...defaultConfig, type, model: defaultConfig.model! } as ProviderConfig;
}

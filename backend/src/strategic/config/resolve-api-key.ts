/**
 * Resolve API Key with OAuth Preference
 *
 * Shared utility that resolves the correct API key for LLM providers.
 * When an Anthropic OAuth token is configured, it takes priority over
 * the static API key. This ensures all code paths (LangChain agents,
 * extraction services, etc.) use the same auth logic.
 */

import { configService } from './service.js';
import type { ProviderConfig } from '../extraction/providers/types.js';

/**
 * Build a ProviderConfig from admin LLM settings, resolving OAuth tokens
 * for Anthropic when configured. This is the single source of truth for
 * "which API key should I use?"
 *
 * @param modelKey - Which model config to use ('extraction' | 'analysis')
 * @returns ProviderConfig ready for AnthropicProvider / OpenAICompatibleProvider
 */
export async function resolveProviderConfig(
  modelKey: 'extraction' | 'analysis' = 'extraction',
): Promise<ProviderConfig> {
  const llmConfig = await configService.getLLMConfig();
  const providerType = llmConfig.provider === 'local' ? 'ollama' : llmConfig.provider;

  let apiKey = llmConfig.apiKey || undefined;

  // For Anthropic, prefer OAuth token over static API key
  if (providerType === 'anthropic' && llmConfig.oauth?.connected && llmConfig.oauth?.accessToken) {
    try {
      const { getValidOAuthToken } = await import('../../auth/oauth-token-refresh.js');
      const oauthToken = await getValidOAuthToken();
      if (oauthToken) {
        apiKey = oauthToken;
      }
    } catch (err) {
      console.warn('[resolveProviderConfig] OAuth token refresh failed, falling back to apiKey:', err);
    }
  }

  return {
    type: providerType as ProviderConfig['type'],
    model: llmConfig.models[modelKey],
    apiKey,
    baseUrl: llmConfig.baseUrl,
  };
}

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

  // For Anthropic, resolve OAuth token from credential file > env > config store
  if (providerType === 'anthropic') {
    let oauthToken: string | undefined;

    // 1. Claude Code credential file
    try {
      const { readFileSync } = await import('fs');
      const { homedir } = await import('os');
      const creds = JSON.parse(readFileSync(`${homedir()}/.claude/.credentials.json`, 'utf-8'));
      if (creds?.claudeAiOauth?.accessToken?.startsWith('sk-ant-oat')) {
        oauthToken = creds.claudeAiOauth.accessToken;
      }
    } catch { /* not available */ }

    // 2. Env var
    if (!oauthToken) {
      const envToken = process.env.ANTHROPIC_OAUTH_TOKEN;
      if (envToken?.startsWith('sk-ant-oat')) oauthToken = envToken;
    }

    // 3. Config store
    if (!oauthToken && llmConfig.oauth?.connected && llmConfig.oauth?.accessToken) {
      try {
        const { getValidOAuthToken } = await import('../../auth/oauth-token-refresh.js');
        const configToken = await getValidOAuthToken();
        if (configToken?.startsWith('sk-ant-oat')) oauthToken = configToken;
      } catch { /* fallback */ }
    }

    if (oauthToken) apiKey = oauthToken;
  }

  return {
    type: providerType as ProviderConfig['type'],
    model: llmConfig.models[modelKey],
    apiKey,
    baseUrl: llmConfig.baseUrl,
  };
}

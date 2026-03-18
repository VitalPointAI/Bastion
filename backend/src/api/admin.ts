/**
 * Admin Configuration API
 * Admin-only endpoints for managing system configuration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  configService,
  initConfigTables,
  type OSINTSourceConfig,
  LLMProviderConfigUpdateSchema,
  AgentConfigUpdateSchema,
  WorkflowConfigUpdateSchema,
  OSINTSourceConfigInputSchema,
  OSINTSourceConfigUpdateSchema,
} from '../strategic/config/index.js';
import { getPlatformSettingsStore } from '../auth/platform-settings-store.js';
import { getAgentRegistry } from '../agents/registry.js';
import { AgentDefinitionSchema } from '../agents/definition-schema.js';
import { createAgentDID } from '../agents/agent-did.js';
import { AgentPhase, AgentCapability, AutonomyLevel, ProposalKind } from '../agents/types.js';
import { getToolRegistry } from '../agents/tool-registry.js';
import { getTeamRegistry } from '../agents/team-registry.js';
import { getTeamStore } from '../agents/team-store.js';
import { MCPToolInputSchema, MCPToolUpdateSchema, AgentTeamInputSchema, AgentTeamUpdateSchema, TeamMemberSchema, CharacterSchema } from '../agents/character-schema.js';
import { AgentModelConfigSchema } from '../strategic/config/types.js';
import { clearLLMCache } from '../agents/langgraph/llm-factory.js';
import { getFundingService } from '../auth/funding-service.js';
import { requireAuth } from '../auth/auth-instance.js';
import { agentAdminRouter } from './agent-admin.js';
import { getAgentStore } from '../agents/agent-store.js';
import { getPool } from '../lib/database.js';
import { getActivityStore } from '../agents/activity-store.js';
import type { ActivityFilter } from '../agents/activity-store.js';

const router = Router();

// ============================================================================
// Initialization
// ============================================================================

let tableInitialized = false;
async function ensureTableExists(): Promise<void> {
  if (!tableInitialized) {
    await initConfigTables();
    tableInitialized = true;
  }
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Middleware to check SYSTEM_ADMIN role
 * requireAuth must run first (via router.use(requireAuth, requireSystemAdmin))
 * so req.anonUser is guaranteed to be populated when this runs.
 */
async function requireSystemAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Derive DID from authenticated user's NEAR account
  const nearAccountId = req.anonUser!.nearAccountId;
  const did = `did:near:${nearAccountId}`;

  // Check for SYSTEM_ADMIN role via env-based allowlist
  // In production, this would integrate with credential service / ABAC
  const adminDids = (process.env.ADMIN_DIDS || '').split(',').map(d => d.trim()).filter(Boolean);

  if (adminDids.length === 0) {
    // If no admin DIDs configured, reject all requests
    res.status(403).json({
      error: 'System admin access required. No admin DIDs configured.',
    });
    return;
  }

  if (!adminDids.includes(did)) {
    console.warn(`[admin] Access denied for DID: ${did} (allowed: ${adminDids.join(', ')})`);
    res.status(403).json({ error: 'System admin access required' });
    return;
  }

  // Attach DID to request for downstream use
  (req as Request & { adminDid: string }).adminDid = did;
  next();
}

/**
 * Mask API key - show only last 4 characters
 */
function maskApiKey(key: string | undefined): string {
  if (!key || key.length <= 4) {
    return '****';
  }
  return '*'.repeat(key.length - 4) + key.slice(-4);
}

/**
 * Mask sensitive fields in config object
 */
function maskSensitiveFields<T extends Record<string, unknown>>(obj: T): T {
  const masked = { ...obj };
  for (const [key, value] of Object.entries(masked)) {
    if (key.toLowerCase().includes('apikey') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token')) {
      if (typeof value === 'string') {
        (masked as Record<string, unknown>)[key] = maskApiKey(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      (masked as Record<string, unknown>)[key] = maskSensitiveFields(value as Record<string, unknown>);
    }
  }
  return masked;
}

/**
 * Handle Zod validation errors
 */
function handleValidationError(error: z.ZodError, res: Response): void {
  const errors = error.issues.map((e: z.ZodIssue) => ({
    path: e.path.join('.'),
    message: e.message,
  }));
  res.status(400).json({
    error: 'Validation failed',
    details: errors,
  });
}

// Apply requireAuth then SYSTEM_ADMIN requirement to all routes
// requireAuth ensures req.anonUser is populated (401 if not authenticated)
// requireSystemAdmin checks the authenticated user's DID against ADMIN_DIDS env
router.use(requireAuth, requireSystemAdmin);

// ============================================================================
// LLM Configuration Endpoints
// ============================================================================

/**
 * GET /api/admin/config/llm - Get LLM provider configuration
 */
router.get('/config/llm', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();
    const config = await configService.getLLMConfig();
    res.json(maskSensitiveFields(config));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get LLM config failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/config/llm - Update LLM configuration
 */
router.put('/config/llm', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const parseResult = LLMProviderConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const { reason } = req.body;

    await configService.updateLLMConfig(parseResult.data, adminDid, reason);

    const updated = await configService.getLLMConfig();
    res.json(maskSensitiveFields(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update LLM config failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Agent Configuration Endpoints
// ============================================================================

/**
 * GET /api/admin/config/agents - Get agent configuration
 */
router.get('/config/agents', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();
    const config = await configService.getAgentConfig();
    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent config failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/config/agents - Update agent configuration
 */
router.put('/config/agents', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const parseResult = AgentConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const { reason } = req.body;

    await configService.updateAgentConfig(parseResult.data, adminDid, reason);

    const updated = await configService.getAgentConfig();
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update agent config failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Workflow Configuration Endpoints
// ============================================================================

/**
 * GET /api/admin/config/workflow - Get workflow configuration
 */
router.get('/config/workflow', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();
    const config = await configService.getWorkflowConfig();
    res.json(maskSensitiveFields(config));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get workflow config failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/config/workflow - Update workflow configuration
 */
router.put('/config/workflow', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const parseResult = WorkflowConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const { reason } = req.body;

    await configService.updateWorkflowConfig(parseResult.data, adminDid, reason);

    const updated = await configService.getWorkflowConfig();
    res.json(maskSensitiveFields(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update workflow config failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// OSINT Source Endpoints
// ============================================================================

/**
 * GET /api/admin/osint-sources - List all OSINT sources
 */
router.get('/osint-sources', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();
    const sources = await configService.getOSINTSources();

    // Mask API keys in all sources
    const maskedSources = sources.map(s => maskSensitiveFields(s));

    res.json({
      count: maskedSources.length,
      sources: maskedSources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get OSINT sources failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/admin/osint-sources - Add new OSINT source
 */
router.post('/osint-sources', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const parseResult = OSINTSourceConfigInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const { reason } = req.body;

    const id = await configService.addOSINTSource(parseResult.data, adminDid, reason);
    const source = await configService.getOSINTSource(id);

    res.status(201).json(maskSensitiveFields(source as OSINTSourceConfig));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Add OSINT source failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/osint-sources/:id - Get single OSINT source
 */
router.get('/osint-sources/:id', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const id = req.params.id as string;
    const source = await configService.getOSINTSource(id);
    if (!source) {
      res.status(404).json({ error: 'OSINT source not found' });
      return;
    }

    res.json(maskSensitiveFields(source));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get OSINT source failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/osint-sources/:id - Update OSINT source
 */
router.put('/osint-sources/:id', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const id = req.params.id as string;
    const parseResult = OSINTSourceConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const { reason } = req.body;

    const updated = await configService.updateOSINTSource(
      id,
      parseResult.data,
      adminDid,
      reason
    );

    if (!updated) {
      res.status(404).json({ error: 'OSINT source not found' });
      return;
    }

    const source = await configService.getOSINTSource(id);
    res.json(maskSensitiveFields(source as OSINTSourceConfig));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update OSINT source failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/admin/osint-sources/:id - Delete OSINT source
 */
router.delete('/osint-sources/:id', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const id = req.params.id as string;
    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const reason = req.body?.reason;

    const deleted = await configService.deleteOSINTSource(
      id,
      adminDid,
      reason
    );

    if (!deleted) {
      res.status(404).json({ error: 'OSINT source not found' });
      return;
    }

    res.json({ deleted: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete OSINT source failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Audit Log Endpoint
// ============================================================================

/**
 * GET /api/admin/config/audit - Get configuration change audit log
 */
router.get('/config/audit', async (req: Request, res: Response) => {
  try {
    await ensureTableExists();

    const category = req.query.category as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    const entries = await configService.getAuditHistory({
      category,
      limit,
      since,
    });

    res.json({
      count: entries.length,
      entries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get audit log failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// LLM Models Proxy Endpoint
// ============================================================================

/**
 * GET /api/admin/llm-models - Proxy for fetching available models from LLM providers
 * Avoids CORS issues by making the request from the backend
 */
router.get('/llm-models', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, baseUrl } = req.query;

    if (!provider || typeof provider !== 'string') {
      res.status(400).json({ error: 'Provider is required' });
      return;
    }

    const providerUrls: Record<string, string> = {
      'anthropic': 'https://api.anthropic.com/v1',
      'openai': 'https://api.openai.com/v1',
      'near-ai': 'https://api.near.ai/v1',
      'azure-openai': (baseUrl as string) || '',
      'local': (baseUrl as string) || 'http://localhost:11434/v1',
    };

    const url = (baseUrl as string) || providerUrls[provider];
    if (!url) {
      res.json({ models: getDefaultModelsForProvider(provider) });
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Provider-specific auth headers
    const key = apiKey as string | undefined;
    if (key) {
      if (provider === 'anthropic') {
        const isOAuth = key.startsWith('sk-ant-oat');
        if (isOAuth) {
          headers['Authorization'] = `Bearer ${key}`;
          headers['anthropic-beta'] = 'oauth-2025-04-20';
        } else {
          headers['x-api-key'] = key;
        }
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${key}`;
      }
    }

    const response = await fetch(`${url}/models`, { headers });

    if (!response.ok) {
      console.warn(`Failed to fetch models from ${provider}: ${response.status}`);
      res.json({ models: getDefaultModelsForProvider(provider) });
      return;
    }

    const data = await response.json() as { data?: { id: string }[] } | { id?: string; name?: string }[];

    // OpenAI-compatible response format
    if ('data' in data && Array.isArray(data.data)) {
      const models = data.data.map((model) => ({
        id: model.id,
        name: model.id,
      }));
      res.json({ models });
      return;
    }

    // Anthropic response format
    if (Array.isArray(data)) {
      const models = data.map((model) => ({
        id: model.id || model.name || '',
        name: model.name || model.id || '',
      }));
      res.json({ models });
      return;
    }

    res.json({ models: getDefaultModelsForProvider(provider) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Fetch LLM models failed:', message);

    // Return defaults on error
    const provider = req.query.provider as string;
    res.json({ models: getDefaultModelsForProvider(provider || 'anthropic') });
  }
});

/**
 * Get default models for a provider when API fetch fails.
 */
function getDefaultModelsForProvider(provider: string): { id: string; name: string }[] {
  const defaults: Record<string, { id: string; name: string }[]> = {
    'anthropic': [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
    'openai': [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    'near-ai': [
      { id: 'deepseek-ai/DeepSeek-V3.1', name: 'DeepSeek V3.1' },
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' },
      { id: 'Qwen/Qwen3-30B-A3B-Instruct-2507', name: 'Qwen3 30B Instruct' },
      { id: 'zai-org/GLM-4.7', name: 'GLM 4.7' },
      { id: 'zai-org/GLM-4.6', name: 'GLM 4.6' },
    ],
    'azure-openai': [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo' },
    ],
    'local': [
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'llama3.1', name: 'Llama 3.1' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'codellama', name: 'Code Llama' },
    ],
  };

  return defaults[provider] || [];
}

// ============================================================================
// OAuth Endpoints
// ============================================================================

/**
 * GET /api/admin/oauth/authorize - Initiate OAuth flow for a provider.
 * Returns the authorization URL the frontend should redirect/open.
 */
router.get('/oauth/authorize', async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;
    if (provider !== 'anthropic') {
      res.status(400).json({ error: 'OAuth is currently only supported for Anthropic' });
      return;
    }

    const config = await configService.getLLMConfig();
    const clientId = config.oauth?.clientId;
    if (!clientId) {
      res.status(400).json({ error: 'OAuth Client ID not configured. Set it in LLM settings first.' });
      return;
    }

    // Build the OAuth state parameter (CSRF protection)
    const state = `bastion_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Anthropic OAuth authorize URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: `${req.protocol}://${req.get('host')}/api/admin/oauth/callback`,
      state,
    });

    const authorizeUrl = `https://console.anthropic.com/oauth/authorize?${params.toString()}`;

    res.json({ authorizeUrl, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/oauth/callback - OAuth callback handler.
 * Exchanges the authorization code for access/refresh tokens.
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      // Redirect to admin panel with error
      res.redirect(`/admin?oauth_error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect('/admin?oauth_error=missing_code');
      return;
    }

    const config = await configService.getLLMConfig();
    const clientId = config.oauth?.clientId;
    const clientSecret = config.oauth?.clientSecret;

    if (!clientId || !clientSecret) {
      res.redirect('/admin?oauth_error=missing_client_credentials');
      return;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/admin/oauth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', tokenResponse.status, errorBody);
      res.redirect(`/admin?oauth_error=token_exchange_failed`);
      return;
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    // Store tokens in config (encrypted)
    const updatedOAuth = {
      ...config.oauth,
      clientId,
      clientSecret,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || config.oauth?.refreshToken,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : undefined,
      scopes: tokens.scope ? tokens.scope.split(' ') : config.oauth?.scopes,
      connected: true,
    };

    await configService.updateLLMConfig(
      { oauth: updatedOAuth },
      'system',
      'Anthropic OAuth tokens stored via OAuth callback',
    );

    res.redirect('/admin?oauth_success=true');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OAuth] Callback error:', message);
    res.redirect(`/admin?oauth_error=server_error`);
  }
});

/**
 * POST /api/admin/oauth/disconnect - Revoke OAuth tokens and clear config.
 */
router.post('/oauth/disconnect', async (req: Request, res: Response) => {
  try {
    await configService.updateLLMConfig(
      {
        oauth: {
          clientId: undefined,
          clientSecret: undefined,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          scopes: undefined,
          connected: false,
        },
      },
      'system',
      'OAuth disconnected via Admin UI',
    );

    res.json({ success: true, message: 'OAuth disconnected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/oauth/status - Get current OAuth connection status.
 */
router.get('/oauth/status', async (req: Request, res: Response) => {
  try {
    const config = await configService.getLLMConfig();
    const oauth = config.oauth;

    res.json({
      connected: oauth?.connected === true && !!oauth?.accessToken,
      hasClientId: !!oauth?.clientId,
      hasClientSecret: !!oauth?.clientSecret,
      tokenExpiresAt: oauth?.tokenExpiresAt || null,
      scopes: oauth?.scopes || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/admin/oauth/token - Save a manually pasted OAuth token.
 * Use this when you don't have OAuth client credentials (client_id/secret)
 * but have a token from `claude login` or `claude setup-token`.
 */
router.post('/oauth/token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token?: string };

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    await configService.updateLLMConfig(
      {
        oauth: {
          accessToken: token.trim(),
          connected: true,
          // No refresh token or expiry — manual tokens don't auto-renew.
          // User will be notified when it stops working.
        },
      },
      'system',
      'OAuth token saved manually via Admin UI',
    );

    // Also sync to shared volume for Ironclaw
    try {
      const { syncTokenToFile } = await import('../auth/oauth-token-refresh.js');
      await syncTokenToFile(token.trim());
    } catch { /* shared volume not mounted */ }

    res.json({ success: true, message: 'OAuth token saved' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Cache Invalidation Endpoint
// ============================================================================

/**
 * POST /api/admin/cache/invalidate - Force invalidate config cache
 */
router.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { key } = req.body;

    configService.invalidateCache(key);

    res.json({
      invalidated: true,
      key: key || 'all',
      message: key ? `Cache invalidated for key: ${key}` : 'All config cache invalidated',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Invalidate cache failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Email Domain Restriction Endpoints
// ============================================================================

/**
 * GET /api/admin/config/email-domains - Get allowed email domains for registration
 */
router.get('/config/email-domains', async (req: Request, res: Response) => {
  try {
    const platformSettings = getPlatformSettingsStore();
    const domains = await platformSettings.getAllowedEmailDomains();

    res.json({
      domains,
      restricted: domains.length > 0,
      message: domains.length > 0
        ? `Registration restricted to ${domains.length} domain(s)`
        : 'No domain restriction (all domains allowed)',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get email domains failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/config/email-domains - Set allowed email domains for registration
 * Body: { domains: ["example.com", "company.org"] }
 */
router.put('/config/email-domains', async (req: Request, res: Response) => {
  try {
    const { domains } = req.body;

    if (!Array.isArray(domains)) {
      res.status(400).json({ error: 'domains must be an array of strings' });
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
    const invalidDomains = domains.filter(d => typeof d !== 'string' || !domainRegex.test(d.trim()));

    if (invalidDomains.length > 0) {
      res.status(400).json({
        error: 'Invalid domain format',
        invalidDomains,
      });
      return;
    }

    const platformSettings = getPlatformSettingsStore();
    await platformSettings.setAllowedEmailDomains(domains);

    const updated = await platformSettings.getAllowedEmailDomains();
    res.json({
      domains: updated,
      restricted: updated.length > 0,
      message: updated.length > 0
        ? `Registration now restricted to ${updated.length} domain(s)`
        : 'Domain restriction cleared',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set email domains failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/admin/config/email-domains - Clear domain restriction (allow all)
 */
router.delete('/config/email-domains', async (req: Request, res: Response) => {
  try {
    const platformSettings = getPlatformSettingsStore();
    await platformSettings.setAllowedEmailDomains([]);

    res.json({
      domains: [],
      restricted: false,
      message: 'Domain restriction cleared - all domains now allowed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Clear email domains failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Blocked Email Endpoints
// ============================================================================

/**
 * GET /api/admin/config/blocked-emails - Get blocked email addresses
 */
router.get('/config/blocked-emails', async (req: Request, res: Response) => {
  try {
    const platformSettings = getPlatformSettingsStore();
    const emails = await platformSettings.getBlockedEmails();
    res.json({ emails, count: emails.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get blocked emails failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/config/blocked-emails - Set blocked email addresses
 * Body: { emails: ["user@example.com", ...] }
 */
router.put('/config/blocked-emails', async (req: Request, res: Response) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) {
      res.status(400).json({ error: 'emails must be an array of strings' });
      return;
    }

    const invalid = emails.find((e: unknown) => typeof e !== 'string' || !String(e).includes('@'));
    if (invalid) {
      res.status(400).json({ error: `Invalid email address: ${invalid}` });
      return;
    }

    const platformSettings = getPlatformSettingsStore();
    await platformSettings.setBlockedEmails(emails);
    const updated = await platformSettings.getBlockedEmails();

    res.json({
      emails: updated,
      count: updated.length,
      message: updated.length > 0
        ? `${updated.length} email(s) blocked`
        : 'Email blacklist cleared',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set blocked emails failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/admin/config/blocked-emails - Clear all blocked emails
 */
router.delete('/config/blocked-emails', async (req: Request, res: Response) => {
  try {
    const platformSettings = getPlatformSettingsStore();
    await platformSettings.setBlockedEmails([]);
    res.json({ emails: [], count: 0, message: 'Email blacklist cleared' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Clear blocked emails failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Agent Management Endpoints
// ============================================================================

/**
 * GET /api/admin/agents - List all agents with their configs and health metrics (Phase 51)
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    // Phase 51: fetch from agents_v2 table for health metrics alongside agent data
    const pool = getPool();
    const result = await pool.query<{
      agent_id: string;
      status: string;
      last_invocation: Date | null;
      success_rate: string | null;
      avg_response_time_ms: string | null;
      validation_score: string | null;
      agent_data: Record<string, unknown>;
    }>(
      `SELECT agent_id, status, last_invocation, success_rate, avg_response_time_ms,
              validation_score, agent_data
       FROM agents_v2
       ORDER BY created_at`
    );

    // Also get model configs for backward compat
    const modelConfigs = await configService.listAgentModelConfigs();

    const data = result.rows.map((r) => ({
      ...r.agent_data,
      // Health metric columns (typed floats from NUMERIC columns)
      status: r.status,
      lastInvocation: r.last_invocation ?? null,
      successRate: r.success_rate !== null ? parseFloat(r.success_rate) : null,
      avgResponseTimeMs: r.avg_response_time_ms !== null ? parseFloat(r.avg_response_time_ms) : null,
      validationScore: r.validation_score !== null ? parseFloat(r.validation_score) : null,
      // Legacy compat fields
      customModelConfig: modelConfigs.find((c) => c.agentId === r.agent_id) || null,
    }));

    res.setHeader('Cache-Control', 'no-cache');
    // Return both shapes: new `data` array + legacy `agents` array for backward compat
    res.json({ success: true, data, agents: data, count: data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List agents failed:', message);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

/**
 * POST /api/admin/agents - Create new agent
 */
router.post('/agents', async (req: Request, res: Response) => {
  try {
    const parseResult = AgentDefinitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const definition = parseResult.data;
    const agentId = definition.id || randomUUID();
    const adminDid = (req as Request & { adminDid: string }).adminDid;

    // Create DID for agent
    const didResult = await createAgentDID(agentId);

    // Map capabilities to enum values (filter out invalid ones)
    const validCapabilities = definition.capabilities
      .filter(c => Object.values(AgentCapability).includes(c as AgentCapability))
      .map(c => c as AgentCapability);

    // All proposal kinds except strike authorization
    const safeProposalKinds = [
      ProposalKind.ConfigChange,
      ProposalKind.AddMember,
      ProposalKind.RemoveMember,
      ProposalKind.Transfer,
      ProposalKind.FunctionCall,
      ProposalKind.MissionOrder,
      ProposalKind.Custom,
    ];

    // Build manifest
    const manifest = {
      agentId,
      name: definition.name,
      description: definition.description,
      phase: AgentPhase[definition.phase as keyof typeof AgentPhase] || AgentPhase.Support,
      capabilities: validCapabilities,
      maxAutonomy: AutonomyLevel[definition.maxAutonomy as keyof typeof AutonomyLevel] || AutonomyLevel.NotAutonomous,
      allowedProposalKinds: safeProposalKinds,
      requiresHumanApproval: [ProposalKind.StrikeAuthorization],
      createdAt: new Date(),
      createdBy: adminDid,
      active: definition.isEnabled,
      agentDID: didResult.did,
      agentBlindedKey: didResult.blindedKey,
      agentPublicKey: didResult.publicKey,
      modelConfig: definition.modelConfig,
    };

    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    await registry.registerAgent(manifest);

    // Phase 51: persist StandardAgent extras (systemPrompt, clearance, skills, tools)
    const store = getAgentStore();
    const phase51Extras: Record<string, unknown> = {};
    if (req.body.systemPrompt) phase51Extras.systemPrompt = req.body.systemPrompt;
    if (req.body.clearance) phase51Extras.clearance = req.body.clearance;
    if (req.body.skills) phase51Extras.skills = req.body.skills;
    if (req.body.tools) phase51Extras.tools = req.body.tools;
    if (Object.keys(phase51Extras).length > 0) {
      await store.updateAgent(agentId, phase51Extras as unknown as import('../agents/standard-agent.js').StandardAgent);
    }

    res.status(201).json({
      success: true,
      agentId,
      agentDID: didResult.did,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create agent failed:', message);
    if (message.includes('already registered')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create agent' });
    }
  }
});

/**
 * GET /api/admin/agents/:agentId - Get single agent (Phase 51: uses AgentStore)
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    // Phase 51: use AgentStore for full StandardAgent data including systemPrompt, clearance, etc.
    const store = getAgentStore();
    const agent = await store.getAgent(agentId);
    if (!agent) {
      // Fall back to registry for agents not yet in agents_v2
      const registry = getAgentRegistry();
      await registry.ensureInitialized();
      const regAgent = registry.getAgent(agentId);
      if (!regAgent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(regAgent);
      return;
    }
    res.json(agent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent failed:', message);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * PUT /api/admin/agents/:agentId - Update agent (Phase 51: persists via AgentStore)
 */
router.put('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const store = getAgentStore();

    const existing = await store.getAgent(agentId);
    if (!existing) {
      // Fall back to registry for legacy agents
      const registry = getAgentRegistry();
      await registry.ensureInitialized();
      const regAgent = registry.getAgent(agentId);
      if (!regAgent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      // Apply legacy in-memory updates
      if (req.body.isEnabled !== undefined) regAgent.active = req.body.isEnabled;
      if (req.body.modelConfig) regAgent.modelConfig = req.body.modelConfig;
      if (req.body.name) regAgent.name = req.body.name;
      if (req.body.description) regAgent.description = req.body.description;
      res.json({ updated: true, agent: regAgent });
      return;
    }

    // Build updates object from request body (supports both legacy and Phase 51 field names)
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.modelConfig !== undefined) updates.modelConfig = req.body.modelConfig;
    if (req.body.isEnabled !== undefined) {
      updates.active = req.body.isEnabled;
      updates.status = req.body.isEnabled ? 'active' : 'inactive';
    }
    // Phase 51 fields
    if (req.body.systemPrompt !== undefined) updates.systemPrompt = req.body.systemPrompt;
    if (req.body.clearance !== undefined) updates.clearance = req.body.clearance;
    if (req.body.skills !== undefined) updates.skills = req.body.skills;
    if (req.body.tools !== undefined) updates.tools = req.body.tools;
    if (req.body.status !== undefined) {
      updates.status = req.body.status;
      updates.active = req.body.status === 'active';
    }
    if (req.body.capabilities !== undefined) updates.capabilities = req.body.capabilities;
    if (req.body.maxAutonomy !== undefined) updates.maxAutonomy = req.body.maxAutonomy;

    await store.updateAgent(agentId, updates as Partial<import('../agents/standard-agent.js').StandardAgent>);

    // Sync registry cache
    const updated = await store.getAgent(agentId);
    if (updated) {
      const registry = getAgentRegistry();
      (registry as unknown as { agents: Map<string, import('../agents/standard-agent.js').StandardAgent> }).agents.set(agentId, updated);
    }

    res.json({ success: true, updated: true, message: `Agent ${agentId} updated` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update agent failed:', message);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/admin/agents/:agentId - Delete agent (Phase 51: true delete via AgentStore)
 */
router.delete('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const store = getAgentStore();

    const existing = await store.getAgent(agentId);
    if (existing) {
      // Phase 51: true delete from DB (cascades to agent_memory)
      await store.deleteAgent(agentId);
      // Remove from registry cache
      const registry = getAgentRegistry();
      (registry as unknown as { agents: Map<string, unknown> }).agents.delete(agentId);
      res.json({ success: true, deleted: true });
    } else {
      // Legacy: deactivate only
      const registry = getAgentRegistry();
      await registry.ensureInitialized();
      registry.deactivateAgent(agentId);
      res.json({ success: true, deactivated: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete/deactivate agent failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: 'Agent not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  }
});

/**
 * GET /api/admin/agents/:agentId/did - Get agent DID info
 */
router.get('/agents/:agentId/did', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agent = registry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({
      agentId: agent.agentId,
      agentDID: agent.agentDID || null,
      agentPublicKey: agent.agentPublicKey || null,
      hasDID: !!agent.agentDID,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent DID failed:', message);
    res.status(500).json({ error: 'Failed to get agent DID info' });
  }
});

/**
 * GET /api/admin/agents/:agentId/character - Get agent character
 */
router.get('/agents/:agentId/character', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const character = registry.getAgentCharacter(agentId);
    if (!character) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }

    res.json({ agentId, character });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent character failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to get agent character' });
    }
  }
});

/**
 * PUT /api/admin/agents/:agentId/character - Update agent character
 */
router.put('/agents/:agentId/character', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;

    const parseResult = CharacterSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const agent = registry.updateAgentCharacter(agentId, parseResult.data);
    res.json({ updated: true, agentId, character: agent.character });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update agent character failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else if (message.includes('Invalid character')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to update agent character' });
    }
  }
});

/**
 * DELETE /api/admin/agents/:agentId/character - Remove agent character
 */
router.delete('/agents/:agentId/character', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;

    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    registry.removeAgentCharacter(agentId);
    res.json({ removed: true, agentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove agent character failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to remove agent character' });
    }
  }
});

// ============================================================================
// Tool Management Endpoints
// ============================================================================

/**
 * GET /api/admin/tools - List all tools
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const category = req.query.category as string | undefined;
    const tools = registry.listTools(category as 'data' | 'action' | 'integration' | 'analysis' | undefined);

    // Add assignment count to each tool
    const toolsWithCounts = tools.map(tool => ({
      ...tool,
      assignedAgentsCount: registry.getAssignmentCount(tool.toolId),
    }));

    res.json({ tools: toolsWithCounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List tools failed:', message);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

/**
 * POST /api/admin/tools - Create a new tool
 */
router.post('/tools', async (req: Request, res: Response) => {
  try {
    const parseResult = MCPToolInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const tool = await registry.registerTool(parseResult.data, adminDid);

    res.status(201).json({
      toolId: tool.toolId,
      toolDID: tool.toolDID,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create tool failed:', message);
    if (message.includes('already registered')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create tool' });
    }
  }
});

/**
 * GET /api/admin/tools/:toolId - Get a tool by ID
 */
router.get('/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const tool = registry.getTool(toolId);
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    res.json({
      ...tool,
      assignedAgents: registry.getAgentsForTool(toolId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get tool failed:', message);
    res.status(500).json({ error: 'Failed to get tool' });
  }
});

/**
 * PUT /api/admin/tools/:toolId - Update a tool
 */
router.put('/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;

    const parseResult = MCPToolUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const tool = registry.updateTool(toolId, parseResult.data);
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    res.json({ updated: true, tool });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update tool failed:', message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

/**
 * DELETE /api/admin/tools/:toolId - Delete a tool
 */
router.delete('/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const deleted = registry.deleteTool(toolId);
    if (!deleted) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    res.json({ deleted: true, toolId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete tool failed:', message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

/**
 * POST /api/admin/tools/:toolId/assign/:agentId - Assign a tool to an agent
 */
router.post('/tools/:toolId/assign/:agentId', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const agentId = req.params.agentId as string;
    const adminDid = (req as Request & { adminDid: string }).adminDid;

    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const assignment = toolRegistry.assignToolToAgent(toolId, agentId, adminDid);
    res.status(201).json({ assigned: true, assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assign tool failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else if (message.includes('already assigned')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to assign tool' });
    }
  }
});

/**
 * DELETE /api/admin/tools/:toolId/assign/:agentId - Unassign a tool from an agent
 */
router.delete('/tools/:toolId/assign/:agentId', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId as string;
    const agentId = req.params.agentId as string;

    const registry = getToolRegistry();
    await registry.ensureInitialized();

    const unassigned = registry.unassignToolFromAgent(toolId, agentId);
    if (!unassigned) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    res.json({ unassigned: true, toolId, agentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unassign tool failed:', message);
    res.status(500).json({ error: 'Failed to unassign tool' });
  }
});

/**
 * GET /api/admin/agents/:agentId/tools - Get tools assigned to an agent
 */
router.get('/agents/:agentId/tools', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    const tools = toolRegistry.getToolsForAgent(agentId);
    res.json({ agentId, tools });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent tools failed:', message);
    res.status(500).json({ error: 'Failed to get agent tools' });
  }
});

// ============================================================================
// Team Management Endpoints
// ============================================================================

/**
 * GET /api/admin/teams - List all teams
 */
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const teams = registry.listTeams();

    // Add member count to each team
    const teamsWithCounts = teams.map(team => ({
      ...team,
      memberCount: team.members.length,
    }));

    res.json({ teams: teamsWithCounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List teams failed:', message);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

/**
 * POST /api/admin/teams - Create a new team
 */
router.post('/teams', async (req: Request, res: Response) => {
  try {
    const parseResult = AgentTeamInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.createTeam(parseResult.data, adminDid);

    res.status(201).json({
      teamId: team.teamId,
      teamDID: team.teamDID,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create team failed:', message);
    if (message.includes('already exists')) {
      res.status(409).json({ error: message });
    } else if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
});

/**
 * GET /api/admin/teams/:teamId - Get a team by ID
 */
router.get('/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = registry.getTeam(teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get team failed:', message);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

/**
 * PUT /api/admin/teams/:teamId - Update a team
 */
router.put('/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;

    const parseResult = AgentTeamUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.updateTeam(teamId, parseResult.data);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json({ updated: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update team failed:', message);
    if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to update team' });
    }
  }
});

/**
 * DELETE /api/admin/teams/:teamId - Delete a team
 */
router.delete('/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const deleted = registry.deleteTeam(teamId);
    if (!deleted) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json({ deleted: true, teamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete team failed:', message);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

/**
 * POST /api/admin/teams/:teamId/members - Add a member to a team
 */
router.post('/teams/:teamId/members', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;

    const parseResult = TeamMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = await registry.addMember(teamId, parseResult.data);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.status(201).json({ added: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Add team member failed:', message);
    if (message.includes('not found')) {
      res.status(400).json({ error: message });
    } else if (message.includes('already a member')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to add team member' });
    }
  }
});

/**
 * DELETE /api/admin/teams/:teamId/members/:agentId - Remove a member from a team
 */
router.delete('/teams/:teamId/members/:agentId', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const agentId = req.params.agentId as string;

    const registry = getTeamRegistry();
    await registry.ensureInitialized();

    const team = registry.removeMember(teamId, agentId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json({ removed: true, team });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove team member failed:', message);
    if (message.includes('not a member')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to remove team member' });
    }
  }
});

/**
 * GET /api/admin/agents/:agentId/model-config - Get agent's model configuration
 */
router.get('/agents/:agentId/model-config', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const modelConfig = await configService.getAgentModelConfig(agentId);

    res.json({
      agentId,
      modelConfig: modelConfig || null,
      usingGlobalDefaults: !modelConfig || modelConfig.useGlobalDefault,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent model config failed:', message);
    res.status(500).json({ error: 'Failed to get agent model config' });
  }
});

/**
 * PUT /api/admin/agents/:agentId/model-config - Set agent's model configuration
 */
router.put('/agents/:agentId/model-config', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const adminDid = (req as Request & { adminDid: string }).adminDid;

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Validate input
    const input = { ...req.body, agentId };
    const parseResult = AgentModelConfigSchema.safeParse(input);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { reason } = req.body;

    await configService.setAgentModelConfig(agentId, parseResult.data, adminDid, reason);

    // Clear LLM cache since config changed
    clearLLMCache();

    res.json({
      updated: true,
      agentId,
      modelConfig: parseResult.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set agent model config failed:', message);
    res.status(500).json({ error: 'Failed to set agent model config' });
  }
});

/**
 * DELETE /api/admin/agents/:agentId/model-config - Remove agent's model configuration (use global defaults)
 */
router.delete('/agents/:agentId/model-config', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const adminDid = (req as Request & { adminDid: string }).adminDid;
    const reason = req.body?.reason;

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const deleted = await configService.deleteAgentModelConfig(agentId, adminDid, reason);

    if (!deleted) {
      res.status(404).json({ error: 'No model config found for agent' });
      return;
    }

    // Clear LLM cache since config changed
    clearLLMCache();

    res.json({ deleted: true, agentId, message: 'Agent will now use global default model config' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete agent model config failed:', message);
    res.status(500).json({ error: 'Failed to delete agent model config' });
  }
});

/**
 * GET /api/admin/agents/:agentId/teams - Get teams an agent belongs to
 */
router.get('/agents/:agentId/teams', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;

    // Verify agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const teamRegistry = getTeamRegistry();
    await teamRegistry.ensureInitialized();

    const teams = teamRegistry.getTeamsForAgent(agentId);
    res.json({ agentId, teams });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent teams failed:', message);
    res.status(500).json({ error: 'Failed to get agent teams' });
  }
});

// ============================================================================
// Agent Builder Wizard Endpoints
// ============================================================================

/**
 * GET /api/admin/agent-builder/templates - Get available agent templates
 */
router.get('/agent-builder/templates', async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'document-reviewer',
        name: 'Document Reviewer',
        description: 'Reviews documents for quality, consistency, and strategic alignment',
        phase: 'Analysis',
        suggestedCapabilities: ['DOCUMENT_PROCESSING', 'STRATEGIC_ANALYSIS'],
        defaultTools: ['categorize-midlife', 'prioritize-domain'],
        characterPreset: {
          name: 'Document Reviewer',
          personality: ['analytical', 'methodical', 'thorough'],
          expertise: ['document analysis', 'strategic review'],
          communication_style: 'professional and precise',
        },
      },
      {
        id: 'threat-analyst',
        name: 'Threat Analyst',
        description: 'Analyzes and monitors potential security threats',
        phase: 'Collection',
        suggestedCapabilities: ['THREAT_MONITORING', 'OSINT_COLLECTION'],
        defaultTools: [],
        characterPreset: {
          name: 'Threat Analyst',
          personality: ['vigilant', 'detail-oriented', 'cautious'],
          expertise: ['threat intelligence', 'risk assessment'],
          communication_style: 'clear and actionable',
        },
      },
      {
        id: 'fusion-agent',
        name: 'Fusion Agent',
        description: 'Synthesizes information from multiple sources into unified assessments',
        phase: 'Processing',
        suggestedCapabilities: ['DATA_FUSION', 'ASSESSMENT_GENERATION'],
        defaultTools: [],
        characterPreset: {
          name: 'Fusion Analyst',
          personality: ['integrative', 'comprehensive', 'balanced'],
          expertise: ['data synthesis', 'multi-source analysis'],
          communication_style: 'holistic and nuanced',
        },
      },
      {
        id: 'coa-generator',
        name: 'Course of Action Generator',
        description: 'Generates and evaluates courses of action for strategic scenarios',
        phase: 'Execution',
        suggestedCapabilities: ['COA_GENERATION', 'SCENARIO_ANALYSIS'],
        defaultTools: [],
        characterPreset: {
          name: 'COA Planner',
          personality: ['strategic', 'creative', 'pragmatic'],
          expertise: ['strategic planning', 'option generation'],
          communication_style: 'structured and option-focused',
        },
      },
      {
        id: 'custom',
        name: 'Custom Agent',
        description: 'Build a completely custom agent from scratch',
        phase: 'Support',
        suggestedCapabilities: [],
        defaultTools: [],
        characterPreset: null,
      },
    ];

    res.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get agent templates failed:', message);
    res.status(500).json({ error: 'Failed to get agent templates' });
  }
});

/**
 * GET /api/admin/agent-builder/capabilities - Get available capabilities
 */
router.get('/agent-builder/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = Object.values(AgentCapability).map(cap => ({
      id: cap,
      name: cap.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      description: getCapabilityDescription(cap),
    }));

    res.json({ capabilities });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get capabilities failed:', message);
    res.status(500).json({ error: 'Failed to get capabilities' });
  }
});

/**
 * GET /api/admin/agent-builder/phases - Get available agent phases
 */
router.get('/agent-builder/phases', async (req: Request, res: Response) => {
  try {
    const phases = Object.values(AgentPhase).map(phase => ({
      id: phase,
      name: phase,
      description: getPhaseDescription(phase),
    }));

    res.json({ phases });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get phases failed:', message);
    res.status(500).json({ error: 'Failed to get phases' });
  }
});

/**
 * GET /api/admin/agent-builder/autonomy-levels - Get available autonomy levels
 */
router.get('/agent-builder/autonomy-levels', async (req: Request, res: Response) => {
  try {
    const levels = Object.values(AutonomyLevel).map(level => ({
      id: level,
      name: getAutonomyLevelName(level),
      description: getAutonomyLevelDescription(level),
      numericValue: level,
    }));

    res.json({ levels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get autonomy levels failed:', message);
    res.status(500).json({ error: 'Failed to get autonomy levels' });
  }
});

/**
 * POST /api/admin/agent-builder/validate - Validate agent definition before creation
 */
router.post('/agent-builder/validate', async (req: Request, res: Response) => {
  try {
    const parseResult = AgentDefinitionSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.json({
        valid: false,
        errors: parseResult.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    // Check for ID conflicts
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const existing = registry.getAgent(parseResult.data.id || '');

    if (existing) {
      res.json({
        valid: false,
        errors: [{ path: 'id', message: 'Agent ID already exists' }],
      });
      return;
    }

    res.json({ valid: true, errors: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Validate agent failed:', message);
    res.status(500).json({ error: 'Failed to validate agent definition' });
  }
});

/**
 * POST /api/admin/agent-builder/preview-prompt - Preview generated system prompt
 */
router.post('/agent-builder/preview-prompt', async (req: Request, res: Response) => {
  try {
    const { character, capabilities, phase } = req.body;

    if (!character) {
      res.status(400).json({ error: 'Character definition required' });
      return;
    }

    // Generate system prompt from character definition
    const prompt = generateSystemPromptFromCharacter(
      character,
      capabilities || [],
      phase || 'Support'
    );

    res.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Preview prompt failed:', message);
    res.status(500).json({ error: 'Failed to generate prompt preview' });
  }
});

// Helper functions for descriptions

function getCapabilityDescription(cap: AgentCapability): string {
  const descriptions: Record<AgentCapability, string> = {
    [AgentCapability.ProposalSummary]: 'Summarize proposals for human review',
    [AgentCapability.ProposalScreening]: 'Screen proposals for issues/spam',
    [AgentCapability.ContextAnalysis]: 'Analyze context and related information',
    [AgentCapability.FeasibilityAssessment]: 'Assess feasibility of proposals',
    [AgentCapability.SecurityMonitoring]: 'Monitor for security concerns',
    [AgentCapability.VotingGuidance]: 'Provide voting guidance',
    [AgentCapability.PreferenceModeling]: 'Model user preferences for recommendations',
    [AgentCapability.DelegatedVoting]: 'Cast votes on behalf of delegator',
    [AgentCapability.ConsensusBuilding]: 'Build consensus among stakeholders',
    [AgentCapability.CommitteeCoordination]: 'Coordinate committee activities',
    // MDMP Agent Capabilities (Phase 5.1)
    [AgentCapability.AssumptionAuditing]: 'Surface, classify, and track planning assumptions',
    [AgentCapability.DataBiasDetection]: 'Detect statistical bias, data staleness, and coverage gaps',
    [AgentCapability.OrdersValidation]: 'Validate orders format, consistency, and intent traceability',
    [AgentCapability.ProblemFraming]: 'Generate alternative problem framings from multiple perspectives',
    [AgentCapability.ROECompliance]: 'Parse ROE, map authorities to tasks, and validate compliance',
    [AgentCapability.UncertaintyQuantification]: 'Produce calibrated confidence intervals and detect false precision',
    // Phase 5.2 Agent Capabilities (Escalation & Competition Modeling)
    [AgentCapability.AdversaryModeling]: 'Synthesize adversary capability models and generate MLCOA/MDCOA',
    [AgentCapability.EffectCascading]: 'Model cascading effects across operational domains',
    [AgentCapability.EscalationModeling]: 'Model escalation dynamics and thresholds',
    [AgentCapability.DeceptionDetection]: 'Detect potential deception in adversary actions and intelligence',
    // New Agent Capabilities (Deception, Exploitation, De-escalation)
    [AgentCapability.DeceptionPlanning]: 'Plan military deception operations (MILDEC) per JP 3-13.4',
    [AgentCapability.ExploitationAnalysis]: 'Identify and recommend exploitation of opportunities and vulnerabilities',
    [AgentCapability.DeescalationManagement]: 'Analyze and recommend de-escalation pathways and tension reduction',
  };
  return descriptions[cap] || 'No description available';
}

function getPhaseDescription(phase: AgentPhase): string {
  const descriptions: Record<AgentPhase, string> = {
    [AgentPhase.Support]: 'AI Assistants - support human decisions',
    [AgentPhase.Represent]: 'AI Proxies - proxy human decisions',
    [AgentPhase.Organize]: 'AI Leaders - make decisions and coordinate',
  };
  return descriptions[phase] || 'No description available';
}

function getAutonomyLevelName(level: AutonomyLevel): string {
  const names: Record<AutonomyLevel, string> = {
    [AutonomyLevel.NotAutonomous]: 'Not Autonomous',
    [AutonomyLevel.SemiAutonomous]: 'Semi Autonomous',
    [AutonomyLevel.Autonomous]: 'Autonomous',
    [AutonomyLevel.FullyDelegated]: 'Fully Delegated',
  };
  return names[level] || 'Unknown';
}

function getAutonomyLevelDescription(level: AutonomyLevel): string {
  const descriptions: Record<AutonomyLevel, string> = {
    [AutonomyLevel.NotAutonomous]: 'Human-in-the-loop: requires explicit human approval',
    [AutonomyLevel.SemiAutonomous]: 'Human-on-the-loop: AI can approve, human monitors with veto',
    [AutonomyLevel.Autonomous]: 'Human-out-of-the-loop: AI can approve and execute',
    [AutonomyLevel.FullyDelegated]: 'Fully delegated to AI with no human oversight - restricted to safe categories',
  };
  return descriptions[level] || 'No description available';
}

/**
 * Generate a system prompt from character definition.
 */
function generateSystemPromptFromCharacter(
  character: {
    name: string;
    personality?: string[];
    expertise?: string[];
    communication_style?: string;
    background?: string;
    goals?: string[];
    constraints?: string[];
  },
  capabilities: string[],
  phase: string
): string {
  const sections: string[] = [];

  // Identity section
  sections.push(`You are ${character.name}, an AI agent in the ${phase} phase of operations.`);

  // Background
  if (character.background) {
    sections.push(`\nBackground:\n${character.background}`);
  }

  // Personality
  if (character.personality && character.personality.length > 0) {
    sections.push(
      `\nPersonality Traits:\n${character.personality.map(p => `- ${p}`).join('\n')}`
    );
  }

  // Expertise
  if (character.expertise && character.expertise.length > 0) {
    sections.push(
      `\nAreas of Expertise:\n${character.expertise.map(e => `- ${e}`).join('\n')}`
    );
  }

  // Communication style
  if (character.communication_style) {
    sections.push(`\nCommunication Style:\n${character.communication_style}`);
  }

  // Capabilities
  if (capabilities.length > 0) {
    const capabilityList = capabilities.map(c =>
      c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())
    );
    sections.push(
      `\nCapabilities:\n${capabilityList.map(c => `- ${c}`).join('\n')}`
    );
  }

  // Goals
  if (character.goals && character.goals.length > 0) {
    sections.push(
      `\nPrimary Goals:\n${character.goals.map(g => `- ${g}`).join('\n')}`
    );
  }

  // Constraints
  if (character.constraints && character.constraints.length > 0) {
    sections.push(
      `\nOperational Constraints:\n${character.constraints.map(c => `- ${c}`).join('\n')}`
    );
  }

  // Standard closing
  sections.push(
    `\nAlways maintain professional standards and ensure your outputs are accurate, ` +
    `well-reasoned, and aligned with organizational objectives.`
  );

  return sections.join('\n');
}

// ============================================================================
// Funder Account Management
// ============================================================================

/**
 * GET /api/admin/funding/status
 * Get funder account balance and stats
 */
router.get('/funding/status', async (req: Request, res: Response) => {
  try {
    const fundingService = getFundingService();

    if (!fundingService.isEnabled()) {
      res.json({
        enabled: false,
        message: 'Funder account not configured. Set NEAR_FUNDER_ACCOUNT_ID and NEAR_FUNDER_PRIVATE_KEY.',
      });
      return;
    }

    const status = await fundingService.getFunderStatus();

    if (!status) {
      res.status(500).json({ error: 'Failed to query funder account' });
      return;
    }

    // Convert yoctoNEAR to NEAR for display
    const yoctoToNear = (yocto: string) => {
      const value = BigInt(yocto);
      return (Number(value) / 1e24).toFixed(4);
    };

    const fundingAmount = BigInt(status.fundingAmountPerAccount);
    const available = BigInt(status.availableBalance);
    const accountsRemaining = fundingAmount > 0n
      ? Number(available / fundingAmount)
      : 0;

    res.json({
      enabled: true,
      funderAccountId: fundingService.getFunderAccountId(),
      balance: yoctoToNear(status.balance),
      availableBalance: yoctoToNear(status.availableBalance),
      fundingAmountPerAccount: yoctoToNear(status.fundingAmountPerAccount),
      totalFundedThisSession: status.totalFundedThisSession,
      accountsRemaining,
    });
  } catch (error) {
    console.error('[admin] Funding status error:', error);
    res.status(500).json({ error: 'Failed to get funding status' });
  }
});

/**
 * GET /api/admin/funding/history
 * Get recent funding activity (in-memory log from this server process)
 */
router.get('/funding/history', async (req: Request, res: Response) => {
  try {
    const fundingService = getFundingService();

    if (!fundingService.isEnabled()) {
      res.json({ enabled: false, history: [] });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const activity = fundingService.getRecentActivity(limit);

    const yoctoToNear = (yocto: string) => (Number(BigInt(yocto)) / 1e24).toFixed(4);
    const fundingAmount = '100000000000000000000000'; // 0.1 NEAR

    res.json({
      enabled: true,
      history: activity.map(item => ({
        accountId: item.accountId,
        amount: yoctoToNear(fundingAmount) + ' NEAR',
        timestamp: new Date(item.timestamp).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[admin] Funding history error:', error);
    res.status(500).json({ error: 'Failed to get funding history' });
  }
});

/**
 * GET /api/admin/funding/check/:accountId
 * Check if a specific implicit account exists on-chain
 */
router.get('/funding/check/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId as string;

    if (!accountId || accountId.length !== 64) {
      res.status(400).json({ error: 'Invalid account ID format (must be 64-character hex)' });
      return;
    }

    const fundingService = getFundingService();

    if (!fundingService.isEnabled()) {
      res.json({ enabled: false, funded: false });
      return;
    }

    const exists = await fundingService.checkAccountExists(accountId);

    res.json({
      enabled: true,
      accountId,
      funded: exists,
    });
  } catch (error) {
    console.error('[admin] Funding check error:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});

// ============================================================================
// Team Assignment & Test Endpoints (Phase 51-05)
// ============================================================================

const TeamAssignSchema = z.object({
  problemSetId: z.string().min(1, 'problemSetId is required'),
});

const TeamTestSchema = z.object({
  scenario: z.string().optional(),
  prompt: z.string().min(1, 'prompt is required'),
});

/**
 * POST /api/admin/teams/:teamId/assign
 * Assign team to a problem set. Stores problemSetId inside team_data JSONB.
 */
router.post('/teams/:teamId/assign', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;

    const parseResult = TeamAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { problemSetId } = parseResult.data;
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const existing: string[] = (team as unknown as Record<string, unknown>).assignedProblemSets as string[] ?? [];
    const updated = Array.from(new Set([...existing, problemSetId]));

    await store.updateTeam(teamId, { assignedProblemSets: updated } as unknown as Partial<typeof team>);

    res.json({ assigned: true, teamId, problemSetId, assignedProblemSets: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Assign failed:', message);
    res.status(500).json({ error: 'Failed to assign team to problem set' });
  }
});

/**
 * POST /api/admin/teams/:teamId/unassign
 * Remove a team's assignment from a problem set.
 */
router.post('/teams/:teamId/unassign', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;

    const parseResult = TeamAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { problemSetId } = parseResult.data;
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const existing: string[] = (team as unknown as Record<string, unknown>).assignedProblemSets as string[] ?? [];
    const updated = existing.filter((id) => id !== problemSetId);

    await store.updateTeam(teamId, { assignedProblemSets: updated } as unknown as Partial<typeof team>);

    res.json({ unassigned: true, teamId, problemSetId, assignedProblemSets: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Unassign failed:', message);
    res.status(500).json({ error: 'Failed to unassign team from problem set' });
  }
});

/**
 * POST /api/admin/teams/:teamId/test
 * Execute the team workflow against a test prompt.
 * Returns per-agent output trace + total execution time.
 * Workflow types: sequential, parallel, pipeline, supervised.
 */
router.post('/teams/:teamId/test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const teamId = req.params.teamId as string;

    const parseResult = TeamTestSchema.safeParse(req.body);
    if (!parseResult.success) {
      handleValidationError(parseResult.error, res);
      return;
    }

    const { scenario, prompt } = parseResult.data;
    const store = getTeamStore();
    const team = await store.getTeam(teamId);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const workflowType: string = team.workflow?.type ?? 'sequential';
    const members = team.members ?? [];

    if (members.length === 0) {
      res.status(400).json({ error: 'Team has no members to test' });
      return;
    }

    interface AgentTrace {
      agentId: string;
      role: string;
      input: string;
      output: string;
      durationMs: number;
      success: boolean;
    }

    const agentTraces: AgentTrace[] = [];
    let previousOutput = '';
    const systemContext = scenario ? `[Scenario: ${scenario}] ` : '';

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const agentStart = Date.now();

      let agentInput: string;
      if (workflowType === 'pipeline' && i > 0) {
        agentInput = previousOutput || `${systemContext}${prompt}`;
      } else if (workflowType === 'supervised') {
        const isLeader = i === 0;
        agentInput = isLeader
          ? `${systemContext}[LEADER] Analyze and delegate: ${prompt}`
          : `${systemContext}[SPECIALIST] Address assigned subtask: ${prompt}`;
      } else {
        agentInput = `${systemContext}${prompt}`;
      }

      // Simulated trace — replaced with real LangGraph executor when supervisor is wired
      const simulatedOutput = `[Agent: ${member.agentId}] [Role: ${member.role}] Processed step ${i + 1}/${members.length} via ${workflowType} workflow`;
      const agentDuration = Date.now() - agentStart;

      agentTraces.push({
        agentId: member.agentId,
        role: member.role,
        input: agentInput,
        output: simulatedOutput,
        durationMs: agentDuration,
        success: true,
      });

      previousOutput = workflowType === 'parallel' ? '' : simulatedOutput;
    }

    const totalDurationMs = Date.now() - startTime;
    const successCount = agentTraces.filter((t) => t.success).length;

    res.json({
      teamId,
      prompt,
      scenario: scenario ?? null,
      workflowType,
      agentTraces,
      summary: {
        totalAgents: members.length,
        successfulAgents: successCount,
        failedAgents: members.length - successCount,
        totalDurationMs,
      },
      success: successCount === members.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams] Test failed:', message);
    res.status(500).json({ error: 'Team test execution failed', details: message });
  }
});

// ============================================================================
// Agent Admin Sub-Router (Phase 51)
// ============================================================================

// Mount agent admin routes — protected by requireAuth + requireSystemAdmin already applied above
router.use('/agents', agentAdminRouter);

// GET /api/admin/tools — list all available tools (must be distinct from /agents routes)
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();
    const tools = toolRegistry.listTools();
    const data = tools.map((t) => ({
      toolId: t.toolId,
      name: t.name,
      description: t.description,
      category: t.category,
      schema: t.inputSchema,
    }));
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// Agent Activity Log Endpoints (Phase 51 Plan 08)
// ============================================================================

/**
 * GET /api/admin/activity
 * Query agent activity log with optional filters and pagination.
 *
 * Query params:
 *   agentId, teamId, type (action_type), problemSetId, status,
 *   startDate, endDate, limit (default 50), offset (default 0)
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const filter: ActivityFilter = {
      agentId: req.query.agentId as string | undefined,
      teamId: req.query.teamId as string | undefined,
      actionType: req.query.type as string | undefined,
      problemSetId: req.query.problemSetId as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await getActivityStore().query(filter);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin] Activity query failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/activity/stats
 * Get aggregated activity statistics.
 *
 * Query params: agentId, teamId
 */
router.get('/activity/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getActivityStore().getStats({
      agentId: req.query.agentId as string | undefined,
      teamId: req.query.teamId as string | undefined,
    });
    res.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin] Activity stats failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;

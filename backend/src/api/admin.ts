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
  type LLMProviderConfig,
  type AgentConfig,
  type WorkflowConfig,
  type OSINTSourceConfig,
  LLMProviderConfigUpdateSchema,
  AgentConfigUpdateSchema,
  WorkflowConfigUpdateSchema,
  OSINTSourceConfigInputSchema,
  OSINTSourceConfigUpdateSchema,
} from '../strategic/config/index.js';
import { getAgentRegistry } from '../agents/registry.js';
import { AgentDefinitionSchema } from '../agents/definition-schema.js';
import { createAgentDID } from '../agents/agent-did.js';
import { AgentPhase, AgentCapability, AutonomyLevel, ProposalKind } from '../agents/types.js';
import { getToolRegistry } from '../agents/tool-registry.js';
import { MCPToolInputSchema, MCPToolUpdateSchema } from '../agents/character-schema.js';

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
 * Extract user DID from request headers
 */
function getUserDID(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-DID header
  const xDid = req.headers['x-did'];
  if (typeof xDid === 'string') {
    return xDid;
  }

  return null;
}

/**
 * Middleware to check SYSTEM_ADMIN role
 * For now, checks against allowed DIDs in env: ADMIN_DIDS
 */
async function requireSystemAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const did = getUserDID(req);
  if (!did) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

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

// Apply SYSTEM_ADMIN requirement to all routes
router.use(requireSystemAdmin);

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
        headers['x-api-key'] = key;
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
// Agent Management Endpoints
// ============================================================================

/**
 * GET /api/admin/agents - List all agents with their configs
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agents = registry.listAgents();

    // Get model configs from config service
    const modelConfigs = await configService.listAgentModelConfigs();

    // Merge model configs with agent data
    const agentsWithConfigs = agents.map(agent => ({
      ...agent,
      customModelConfig: modelConfigs.find(c => c.agentId === agent.agentId) || null,
    }));

    res.json({ agents: agentsWithConfigs });
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

    res.status(201).json({
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
 * GET /api/admin/agents/:agentId - Get single agent
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agent = registry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
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
 * PUT /api/admin/agents/:agentId - Update agent
 */
router.put('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agent = registry.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Update allowed fields
    if (req.body.isEnabled !== undefined) {
      agent.active = req.body.isEnabled;
    }
    if (req.body.modelConfig) {
      agent.modelConfig = req.body.modelConfig;
    }
    if (req.body.name) {
      agent.name = req.body.name;
    }
    if (req.body.description) {
      agent.description = req.body.description;
    }

    res.json({ updated: true, agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update agent failed:', message);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/admin/agents/:agentId - Deactivate agent
 */
router.delete('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    registry.deactivateAgent(agentId);
    res.json({ deactivated: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Deactivate agent failed:', message);
    if (message.includes('not found')) {
      res.status(404).json({ error: 'Agent not found' });
    } else {
      res.status(500).json({ error: 'Failed to deactivate agent' });
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
    const { toolId, agentId } = req.params;
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
    const { toolId, agentId } = req.params;

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

export default router;

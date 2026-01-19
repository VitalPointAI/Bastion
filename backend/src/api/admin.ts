/**
 * Admin Configuration API
 * Admin-only endpoints for managing system configuration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
    const { reason } = req.body;

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

export default router;

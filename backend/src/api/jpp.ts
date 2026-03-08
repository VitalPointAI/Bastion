/**
 * JPP REST API
 *
 * Phase 33 Plan 04: Express routes for /api/jpp/*
 * JPP instance management, step product CRUD, E-W-M linkage operations,
 * and entity resolution endpoints.
 *
 * Static routes registered BEFORE parametric routes to prevent Express shadowing.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { jppStore } from '../jpp/jpp-store.js';
import { ewmStore } from '../jpp/ewm-store.js';
import { entityToolHandlers } from '../graph/tools/entity-tools.js';
import type { JPPStepId, StepStatus } from '../jpp/types.js';

const router = Router();

// =============================================================================
// Entity Resolution endpoints (static paths -- must come BEFORE parametric)
// =============================================================================

/**
 * GET /api/jpp/entities/search?q=term&type=nation
 */
router.get('/entities/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Missing required query parameter: q' });
      return;
    }
    const entityType = req.query.type as string | undefined;
    const result = await entityToolHandlers.search_entities({
      query,
      entityType: entityType as Parameters<typeof entityToolHandlers.search_entities>[0]['entityType'],
      fuzzy: true,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[jpp] GET /entities/search failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jpp/entities/merge
 */
router.post('/entities/merge', async (req: Request, res: Response) => {
  try {
    const { sourceIds, targetId } = req.body;
    if (!sourceIds || !targetId) {
      res.status(400).json({ error: 'Missing required fields: sourceIds, targetId' });
      return;
    }
    const result = await entityToolHandlers.merge_entities({ sourceIds, targetId });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[jpp] POST /entities/merge failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jpp/entities/alias
 */
router.post('/entities/alias', async (req: Request, res: Response) => {
  try {
    const { canonicalId, alias, source } = req.body;
    if (!canonicalId || !alias || !source) {
      res.status(400).json({ error: 'Missing required fields: canonicalId, alias, source' });
      return;
    }
    const result = await entityToolHandlers.create_entity_alias({ canonicalId, alias, source });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[jpp] POST /entities/alias failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/jpp/entities/:entityId/references
 */
router.get('/entities/:entityId/references', async (req: Request, res: Response) => {
  try {
    const result = await entityToolHandlers.get_entity_references({
      entityId: req.params.entityId,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /entities/${req.params.entityId}/references failed:`, message);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// JPP Instance endpoints (parametric)
// =============================================================================

/**
 * GET /api/jpp/:problemSetId
 * Get or auto-create JPP instance for a problem set.
 */
router.get('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const instance = await jppStore.getInstanceByProblemSet(req.params.problemSetId);
    res.json(instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.problemSetId} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/jpp/:instanceId/step-status
 * Update step status. Body: { step: JPPStepId, status: StepStatus }
 */
router.put('/:instanceId/step-status', async (req: Request, res: Response) => {
  try {
    const { step, status } = req.body as { step: JPPStepId; status: StepStatus };
    if (!step || !status) {
      res.status(400).json({ error: 'Missing required fields: step, status' });
      return;
    }
    const updated = await jppStore.updateStepStatus(req.params.instanceId, step, status);
    if (!updated) {
      res.status(404).json({ error: 'JPP instance not found' });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] PUT /${req.params.instanceId}/step-status failed:`, message);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Step Product endpoints
// =============================================================================

/**
 * GET /api/jpp/:instanceId/steps/:step/products
 */
router.get('/:instanceId/steps/:step/products', async (req: Request, res: Response) => {
  try {
    const products = await jppStore.getStepProducts(
      req.params.instanceId,
      req.params.step as JPPStepId,
    );
    res.json(products);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.instanceId}/steps/${req.params.step}/products failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jpp/:instanceId/steps/:step/products
 * Save a step product. Body: step product data.
 */
router.post('/:instanceId/steps/:step/products', async (req: Request, res: Response) => {
  try {
    const product = await jppStore.saveStepProduct({
      id: req.body.id,
      jppInstanceId: req.params.instanceId,
      step: req.params.step as JPPStepId,
      roleId: req.body.roleId ?? 'unknown',
      content: req.body.content ?? {},
      aiDraftedBy: req.body.aiDraftedBy,
      reviewedBy: req.body.reviewedBy,
      status: req.body.status,
    });
    res.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] POST /${req.params.instanceId}/steps/${req.params.step}/products failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/jpp/:instanceId/parent-products
 * Get parent JPP products for inheritance.
 */
router.get('/:instanceId/parent-products', async (req: Request, res: Response) => {
  try {
    const instance = await jppStore.getInstance(req.params.instanceId);
    if (!instance) {
      res.status(404).json({ error: 'JPP instance not found' });
      return;
    }

    if (!instance.parentJppId) {
      res.json({ products: [], parentJppId: null });
      return;
    }

    // Gather products from all steps of parent instance
    const { JPP_STEPS } = await import('../jpp/types.js');
    const products: Record<string, unknown[]> = {};
    for (const step of JPP_STEPS) {
      const stepProducts = await jppStore.getStepProducts(instance.parentJppId, step);
      if (stepProducts.length > 0) {
        products[step] = stepProducts;
      }
    }

    res.json({ products, parentJppId: instance.parentJppId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.instanceId}/parent-products failed:`, message);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// E-W-M Linkage endpoints
// =============================================================================

/**
 * GET /api/jpp/:instanceId/ewm
 */
router.get('/:instanceId/ewm', async (req: Request, res: Response) => {
  try {
    const linkages = await ewmStore.getLinkagesByInstance(req.params.instanceId);
    res.json(linkages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.instanceId}/ewm failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/jpp/:instanceId/ewm
 */
router.post('/:instanceId/ewm', async (req: Request, res: Response) => {
  try {
    const linkage = await ewmStore.createLinkage({
      jppInstanceId: req.params.instanceId,
      endObjectiveId: req.body.endObjectiveId,
      wayId: req.body.wayId,
      wayType: req.body.wayType,
      meanId: req.body.meanId,
      meanType: req.body.meanType,
      allocationPct: req.body.allocationPct,
    });
    res.status(201).json(linkage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] POST /${req.params.instanceId}/ewm failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/jpp/:instanceId/ewm/:linkageId
 */
router.delete('/:instanceId/ewm/:linkageId', async (req: Request, res: Response) => {
  try {
    await ewmStore.deleteLinkage(req.params.linkageId);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] DELETE /${req.params.instanceId}/ewm/${req.params.linkageId} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/jpp/:instanceId/ewm/:linkageId/allocation
 * Body: { allocationPct: number }
 */
router.put('/:instanceId/ewm/:linkageId/allocation', async (req: Request, res: Response) => {
  try {
    const { allocationPct } = req.body;
    if (allocationPct === undefined || typeof allocationPct !== 'number') {
      res.status(400).json({ error: 'Missing or invalid field: allocationPct (number)' });
      return;
    }
    await ewmStore.updateAllocation(req.params.linkageId, allocationPct);
    res.json({ success: true, allocationPct });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] PUT /${req.params.instanceId}/ewm/${req.params.linkageId}/allocation failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/jpp/:instanceId/ewm/gaps
 */
router.get('/:instanceId/ewm/gaps', async (req: Request, res: Response) => {
  try {
    const gaps = await ewmStore.findGaps(req.params.instanceId);
    res.json(gaps);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.instanceId}/ewm/gaps failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/jpp/:instanceId/ewm/summary
 * Returns E-W-M summary counts.
 */
router.get('/:instanceId/ewm/summary', async (req: Request, res: Response) => {
  try {
    const [ends, ways, means] = await Promise.all([
      ewmStore.getEnds(req.params.instanceId),
      ewmStore.getWays(req.params.instanceId),
      ewmStore.getMeans(req.params.instanceId),
    ]);
    res.json({
      ends: { count: ends.length, items: ends },
      ways: { count: ways.length, items: ways },
      means: { count: means.length, items: means },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[jpp] GET /${req.params.instanceId}/ewm/summary failed:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;

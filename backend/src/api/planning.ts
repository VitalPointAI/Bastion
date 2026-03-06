/**
 * Planning REST API
 *
 * Phase 05 Plan 10: Comprehensive REST API for operational planning features
 * - CRUD for plans, COAs, ROE
 * - Workflow state and event management
 * - AI agent endpoints
 * - Document generation
 * - Graphics generation
 * - Version history
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { isTrainingMode } from '../middleware/exercise-watermark.js';
import { modeMiddleware } from '../middleware/mode-context.js';
import { planStore, coaStore, versionStore, roeStore } from '../planning/index.js';
import { jp50WorkflowEngine } from '../planning/workflow/index.js';
import { roeEngine, roeOverrideWorkflow, roeAuditLog } from '../planning/roe/index.js';
import { generateCOAs, simulateAdversary, compareCOAs } from '../planning/agents/index.js';
import {
  generateOPORDDocx,
  generateOPORDPdf,
  generateBriefingSlides,
  generateSyncMatrix,
  generateDST,
  generateCCIR,
} from '../planning/documents/index.js';
import { generateOperationalGraphics, graphicsToGeoJSON } from '../planning/graphics/index.js';
import {
  createOperationalPlanSchema,
  updateOperationalPlanSchema,
  createCOASchema,
  createROERuleSchema,
} from '../planning/schemas.js';
import type { ROEOverrideRequest } from '../planning/roe/types.js';

export const planningRouter = Router();

// ============ OPERATIONAL PLANS ============

// Create operational plan
planningRouter.post('/plans', async (req: Request, res: Response) => {
  try {
    const parsed = createOperationalPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    // Auto-generate yjsDocumentId if not provided
    const planData = {
      ...parsed.data,
      yjsDocumentId: parsed.data.yjsDocumentId || `yjs-${randomUUID()}`,
    };

    const plan = await planStore.create(
      planData,
      (req.headers['x-did'] as string) || 'anonymous'
    );

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create plan' });
  }
});

// List all plans (with optional ?limit= and ?offset= query params)
planningRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit < 0)) {
      res.status(400).json({ error: 'Invalid limit parameter: must be a non-negative integer' });
      return;
    }
    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      res.status(400).json({ error: 'Invalid offset parameter: must be a non-negative integer' });
      return;
    }

    const plans = await planStore.findAll(limit, offset);
    res.json({ plans, total: plans.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list plans' });
  }
});

// Get plan by ID
planningRouter.get('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await planStore.findById(req.params.id as string);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get plan' });
  }
});

// Get plans by mission
planningRouter.get('/missions/:missionId/plans', async (req: Request, res: Response) => {
  try {
    const plans = await planStore.findByMission(req.params.missionId as string);
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get plans' });
  }
});

// Update plan
planningRouter.patch('/plans/:id', async (req: Request, res: Response) => {
  try {
    const parsed = updateOperationalPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    // Type assertion for Zod output compatibility with store interface
    const plan = await planStore.update(req.params.id as string, parsed.data as any);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update plan' });
  }
});

// Delete plan
planningRouter.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    await planStore.delete(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete plan' });
  }
});

// ============ WORKFLOW ============

// Get workflow state
planningRouter.get('/plans/:id/workflow', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id as string;
    const state = await jp50WorkflowEngine.getState(planId);
    const { atCheckpoint, checkpoint } = await jp50WorkflowEngine.isAtCheckpoint(planId);

    res.json({
      value: state.value,
      context: state.context,
      atCheckpoint,
      checkpoint,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get workflow' });
  }
});

// Send workflow event
planningRouter.post('/plans/:id/workflow/events', async (req: Request, res: Response) => {
  try {
    const { type, ...eventData } = req.body;
    const event = { type, ...eventData };

    const state = await jp50WorkflowEngine.send(req.params.id as string, event);

    res.json({
      value: state.value,
      context: state.context,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to process event' });
  }
});

// Get workflow history
planningRouter.get('/plans/:id/workflow/history', async (req: Request, res: Response) => {
  try {
    const history = await jp50WorkflowEngine.getHistory(req.params.id as string);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get history' });
  }
});

// ============ COAs ============

// Create COA
planningRouter.post('/plans/:planId/coas', async (req: Request, res: Response) => {
  try {
    const planId = req.params.planId as string;
    const parsed = createCOASchema.safeParse({ ...req.body, planId });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const coa = await coaStore.create(
      parsed.data,
      (req.headers['x-did'] as string) || 'anonymous'
    );

    // Update workflow COA count
    const count = await coaStore.countByPlan(planId);
    await jp50WorkflowEngine.send(planId, { type: 'UPDATE_COA_COUNT', count });

    res.status(201).json(coa);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create COA' });
  }
});

// Get COAs for plan
planningRouter.get('/plans/:planId/coas', async (req: Request, res: Response) => {
  try {
    const coas = await coaStore.findByPlan(req.params.planId as string);
    res.json(coas);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get COAs' });
  }
});

// Select COA
planningRouter.post('/plans/:planId/coas/:coaId/select', async (req: Request, res: Response) => {
  try {
    const planId = req.params.planId as string;
    const coaId = req.params.coaId as string;

    await coaStore.selectCOA(planId, coaId);

    // Update workflow
    await jp50WorkflowEngine.send(planId, {
      type: 'SELECT_COA',
      coaId,
      actorDID: (req.headers['x-did'] as string) || 'anonymous',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to select COA' });
  }
});

// ============ AI AGENTS ============

// Generate COAs via AI
planningRouter.post('/plans/:planId/coas/generate', async (req: Request, res: Response) => {
  try {
    const { targetCount } = req.body;
    const result = await generateCOAs(req.params.planId as string, targetCount);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate COAs' });
  }
});

// Run red team simulation
planningRouter.post('/plans/:planId/red-team', async (req: Request, res: Response) => {
  try {
    const { coaIds } = req.body;
    const result = await simulateAdversary(req.params.planId as string, coaIds);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run simulation' });
  }
});

// Compare COAs via AI
planningRouter.post('/plans/:planId/coas/compare', async (req: Request, res: Response) => {
  try {
    const result = await compareCOAs(req.params.planId as string);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to compare COAs' });
  }
});

// ============ ROE ============

// Get ROE rules for mission
planningRouter.get('/missions/:missionId/roe', async (req: Request, res: Response) => {
  try {
    const rules = await roeStore.findRulesByMission(req.params.missionId as string);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get ROE' });
  }
});

// Create ROE rule
planningRouter.post('/missions/:missionId/roe', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId as string;
    const parsed = createROERuleSchema.safeParse({ ...req.body, missionId });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    // Type assertion for Zod output compatibility with store interface
    const rule = await roeStore.createRule(
      parsed.data as any,
      (req.headers['x-did'] as string) || 'anonymous'
    );

    // Invalidate engine cache
    roeEngine.invalidateCache(missionId);

    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create ROE rule' });
  }
});

// Check action against ROE
planningRouter.post('/roe/check', async (req: Request, res: Response) => {
  try {
    const result = await roeEngine.checkAction(req.body);

    // Log the check
    await roeAuditLog.recordCheck({
      action: req.body,
      result,
      timestamp: new Date(),
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check ROE' });
  }
});

// Request ROE override
planningRouter.post('/roe/override', async (req: Request, res: Response) => {
  try {
    // Validate required fields
    const { actionId, planId, violations, justification, commanderDID } = req.body;

    if (!actionId || !planId || !violations || !justification || !commanderDID) {
      res.status(400).json({ error: 'Missing required fields: actionId, planId, violations, justification, commanderDID' });
      return;
    }

    const overrideRequest: ROEOverrideRequest = {
      actionId,
      planId,
      violations,
      justification,
      commanderDID,
    };

    const override = await roeOverrideWorkflow.requestOverride(overrideRequest);

    res.status(201).json(override);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create override' });
  }
});

// ============ DOCUMENTS ============

// Generate OPORD DOCX
planningRouter.get('/plans/:id/documents/opord.docx', modeMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await generateOPORDDocx(req.params.id as string, {
      classification: (req.query.classification as string) || 'UNCLASSIFIED',
      unit: (req.query.unit as string) || 'TBD',
      orderNumber: (req.query.orderNumber as string) || '001',
      dtg: new Date().toISOString(),
      references: [],
      timeZone: 'ZULU',
    }, { exerciseMode: isTrainingMode(req) });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate DOCX' });
  }
});

// Generate OPORD PDF
planningRouter.get('/plans/:id/documents/opord.pdf', modeMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await generateOPORDPdf(req.params.id as string, {
      classification: (req.query.classification as string) || 'UNCLASSIFIED',
      unit: (req.query.unit as string) || 'TBD',
      orderNumber: (req.query.orderNumber as string) || '001',
      dtg: new Date().toISOString(),
      references: [],
      timeZone: 'ZULU',
    }, { exerciseMode: isTrainingMode(req) });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate PDF' });
  }
});

// Generate briefing slides
planningRouter.get('/plans/:id/documents/briefing.pptx', async (req: Request, res: Response) => {
  try {
    const briefType = (req.query.type as string) || 'commander';
    const doc = await generateBriefingSlides(req.params.id as string, {
      type: briefType as 'commander' | 'staff' | 'rehearsal',
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate briefing' });
  }
});

// Generate sync matrix
planningRouter.get('/plans/:id/documents/sync-matrix', async (req: Request, res: Response) => {
  try {
    const matrix = await generateSyncMatrix(req.params.id as string);
    res.json(matrix);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate sync matrix' });
  }
});

// Generate DST
planningRouter.get('/plans/:id/documents/dst', async (req: Request, res: Response) => {
  try {
    const dst = await generateDST(req.params.id as string);
    res.json(dst);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate DST' });
  }
});

// Generate CCIR
planningRouter.get('/plans/:id/documents/ccir', async (req: Request, res: Response) => {
  try {
    const ccir = await generateCCIR(req.params.id as string);
    res.json(ccir);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate CCIR' });
  }
});

// ============ GRAPHICS ============

// Get operational graphics
planningRouter.get('/plans/:id/graphics', async (req: Request, res: Response) => {
  try {
    const overlay = await generateOperationalGraphics(req.params.id as string);
    res.json(overlay);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate graphics' });
  }
});

// Get graphics as GeoJSON
planningRouter.get('/plans/:id/graphics/geojson', async (req: Request, res: Response) => {
  try {
    const overlay = await generateOperationalGraphics(req.params.id as string);
    const geojson = graphicsToGeoJSON(overlay);
    res.json(geojson);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate GeoJSON' });
  }
});

// ============ VERSIONS ============

// Get plan versions
planningRouter.get('/plans/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await versionStore.findByPlan(req.params.id as string);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get versions' });
  }
});

export default planningRouter;

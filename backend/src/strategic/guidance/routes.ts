/**
 * Strategic Guidance REST API Routes
 *
 * Phase 36 Plan 01: Express router for strategic guidance instance lifecycle,
 * step content CRUD, force allocation management, and directive versions.
 *
 * Mounted at /api/strategic-guidance (wired in a later plan).
 */

import { Router } from 'express';
import { strategicGuidanceService } from './service.js';
import type { SGStepId } from './types.js';
import { SG_STEPS } from './types.js';

export const strategicGuidanceRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidStep(step: string): step is SGStepId {
  return (SG_STEPS as readonly string[]).includes(step);
}

// ---------------------------------------------------------------------------
// POST /instances — create instance
// ---------------------------------------------------------------------------
strategicGuidanceRouter.post('/instances', async (req, res) => {
  try {
    const { problemSetId, createdBy } = req.body;
    if (!problemSetId || !createdBy) {
      res.status(400).json({ error: 'problemSetId and createdBy are required' });
      return;
    }
    const instance = await strategicGuidanceService.createInstance(problemSetId, createdBy);
    res.status(201).json(instance);
  } catch (error) {
    console.error('[strategic-guidance] Error creating instance:', error);
    res.status(500).json({ error: 'Failed to create strategic guidance instance' });
  }
});

// ---------------------------------------------------------------------------
// GET /instances/:problemSetId — get instance by problem set ID
// ---------------------------------------------------------------------------
strategicGuidanceRouter.get('/instances/:problemSetId', async (req, res) => {
  try {
    const instance = await strategicGuidanceService.getInstance(req.params.problemSetId);
    res.json(instance ?? null);
  } catch (error) {
    console.error('[strategic-guidance] Error fetching instance:', error);
    res.status(500).json({ error: 'Failed to fetch strategic guidance instance' });
  }
});

// ---------------------------------------------------------------------------
// GET /instances/:instanceId/steps/:stepId — get step content
// ---------------------------------------------------------------------------
strategicGuidanceRouter.get('/instances/:instanceId/steps/:stepId', async (req, res) => {
  try {
    const { instanceId, stepId } = req.params;
    if (!isValidStep(stepId)) {
      res.status(400).json({ error: `Invalid step: ${stepId}` });
      return;
    }
    const content = await strategicGuidanceService.getStepContent(instanceId, stepId);
    res.json(content ?? {});
  } catch (error) {
    console.error('[strategic-guidance] Error fetching step content:', error);
    res.status(500).json({ error: 'Failed to fetch step content' });
  }
});

// ---------------------------------------------------------------------------
// PUT /instances/:instanceId/steps/:stepId — save step content
// ---------------------------------------------------------------------------
strategicGuidanceRouter.put('/instances/:instanceId/steps/:stepId', async (req, res) => {
  try {
    const { instanceId, stepId } = req.params;
    const { content, updatedBy } = req.body;
    if (!isValidStep(stepId)) {
      res.status(400).json({ error: `Invalid step: ${stepId}` });
      return;
    }
    if (!content || !updatedBy) {
      res.status(400).json({ error: 'content and updatedBy are required' });
      return;
    }
    const product = await strategicGuidanceService.saveStepContent(instanceId, stepId, content, updatedBy);
    res.json(product);
  } catch (error) {
    console.error('[strategic-guidance] Error saving step content:', error);
    res.status(500).json({ error: 'Failed to save step content' });
  }
});

// ---------------------------------------------------------------------------
// PUT /instances/:instanceId/steps/:stepId/status — update step status
// ---------------------------------------------------------------------------
strategicGuidanceRouter.put('/instances/:instanceId/steps/:stepId/status', async (req, res) => {
  try {
    const { instanceId, stepId } = req.params;
    const { status } = req.body;
    if (!isValidStep(stepId)) {
      res.status(400).json({ error: `Invalid step: ${stepId}` });
      return;
    }
    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }
    const instance = await strategicGuidanceService.updateStepStatus(instanceId, stepId, status);
    res.json(instance);
  } catch (error) {
    console.error('[strategic-guidance] Error updating step status:', error);
    res.status(500).json({ error: 'Failed to update step status' });
  }
});

// ---------------------------------------------------------------------------
// GET /instances/:instanceId/forces — get force allocations
// ---------------------------------------------------------------------------
strategicGuidanceRouter.get('/instances/:instanceId/forces', async (req, res) => {
  try {
    const allocations = await strategicGuidanceService.getForceAllocations(req.params.instanceId);
    res.json(allocations);
  } catch (error) {
    console.error('[strategic-guidance] Error fetching force allocations:', error);
    res.status(500).json({ error: 'Failed to fetch force allocations' });
  }
});

// ---------------------------------------------------------------------------
// GET /instances/:instanceId/forces/summary — force allocation summary
// ---------------------------------------------------------------------------
strategicGuidanceRouter.get('/instances/:instanceId/forces/summary', async (req, res) => {
  try {
    const summary = await strategicGuidanceService.getForceAllocationSummary(req.params.instanceId);
    res.json(summary);
  } catch (error) {
    console.error('[strategic-guidance] Error fetching force allocation summary:', error);
    res.status(500).json({ error: 'Failed to fetch force allocation summary' });
  }
});

// ---------------------------------------------------------------------------
// POST /instances/:instanceId/forces — create/update force allocation
// ---------------------------------------------------------------------------
strategicGuidanceRouter.post('/instances/:instanceId/forces', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { forceName, forceType, lineOfEffortId, priority } = req.body;
    if (!forceName || !forceType || !lineOfEffortId || !priority) {
      res.status(400).json({ error: 'forceName, forceType, lineOfEffortId, and priority are required' });
      return;
    }
    const allocation = await strategicGuidanceService.saveForceAllocation(instanceId, req.body);
    res.status(201).json(allocation);
  } catch (error) {
    console.error('[strategic-guidance] Error saving force allocation:', error);
    res.status(500).json({ error: 'Failed to save force allocation' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /instances/:instanceId/forces/:allocationId — delete force allocation
// ---------------------------------------------------------------------------
strategicGuidanceRouter.delete('/instances/:instanceId/forces/:allocationId', async (req, res) => {
  try {
    const { instanceId, allocationId } = req.params;
    const deleted = await strategicGuidanceService.deleteForceAllocation(instanceId, allocationId);
    res.json({ deleted });
  } catch (error) {
    console.error('[strategic-guidance] Error deleting force allocation:', error);
    res.status(500).json({ error: 'Failed to delete force allocation' });
  }
});

// ---------------------------------------------------------------------------
// GET /instances/:instanceId/directives — get directive versions
// ---------------------------------------------------------------------------
strategicGuidanceRouter.get('/instances/:instanceId/directives', async (req, res) => {
  try {
    const versions = await strategicGuidanceService.getDirectiveVersions(req.params.instanceId);
    res.json(versions);
  } catch (error) {
    console.error('[strategic-guidance] Error fetching directive versions:', error);
    res.status(500).json({ error: 'Failed to fetch directive versions' });
  }
});

// ---------------------------------------------------------------------------
// POST /instances/:instanceId/directives/finalize — finalize directive
// Placeholder for Plan 04 service extension
// ---------------------------------------------------------------------------
strategicGuidanceRouter.post('/instances/:instanceId/directives/finalize', async (_req, res) => {
  try {
    // Placeholder: will be implemented in Plan 04
    res.status(501).json({ error: 'Directive finalization not yet implemented' });
  } catch (error) {
    console.error('[strategic-guidance] Error finalizing directive:', error);
    res.status(500).json({ error: 'Failed to finalize directive' });
  }
});

/**
 * Operational Design REST API
 *
 * Phase 25 Plan 01: Express routes for /api/design/*
 * CRUD operations for operational design data per problem set.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { designStore } from '../design/design-store.js';

const router = Router();

const VALID_SECTIONS = ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'];

/**
 * GET /api/design/:problemSetId
 * Returns full OperationalDesign (auto-creates if none exists).
 */
router.get('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const design = await designStore.getByProblemSetId(problemSetId);
    res.json(design);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/status
 * Returns just section statuses.
 */
router.get('/:problemSetId/status', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const status = await designStore.getStatus(problemSetId);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/status failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/:section
 * Updates one section. Body = section data.
 * Section must be: problem-framing, cog-analysis, lines-of-effort, operational-approach.
 */
router.patch('/:problemSetId/:section', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const section = req.params.section as string;

    if (!VALID_SECTIONS.includes(section)) {
      res.status(400).json({
        error: `Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`,
      });
      return;
    }

    const updated = await designStore.updateSection(problemSetId, section, req.body);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] PATCH /${req.params.problemSetId}/${req.params.section} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/handoff
 * Returns DesignHandoffPayload for Plan tab consumption.
 */
router.get('/:problemSetId/handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const payload = await designStore.getHandoffPayload(problemSetId);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;

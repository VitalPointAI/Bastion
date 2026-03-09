/**
 * Operational Design REST API
 *
 * Phase 25 Plan 01: Express routes for /api/design/*
 * CRUD operations for operational design data per problem set.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { designStore } from '../design/design-store.js';
import type { CoGAnalysis, LineOfEffort, OperationalApproach } from '../design/types.js';

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

/**
 * POST /api/design/:problemSetId/push-handoff
 * Packages handoff payload and persists it in the database.
 */
router.post('/:problemSetId/push-handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const result = await designStore.pushHandoff(problemSetId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/push-handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/design/:problemSetId/analyze
 * AI analysis for a design section. Body = { section: string, context: object }.
 */
router.post('/:problemSetId/analyze', async (req: Request, res: Response) => {
  try {
    const section = req.body.section as string;
    const context = req.body.context as Record<string, unknown>;

    if (!section) {
      res.status(400).json({ error: 'Missing required field: section' });
      return;
    }

    if (section === 'problem-framing') {
      const { generateFramings } = await import('../agents/problem-framing.js');
      const output = await generateFramings(
        (context?.currentState as string) || '',
        (context?.problemStatement as string) || '',
        (context?.desiredEndState as string) || '',
        (context?.assumptions as string[]) || []
      );
      // Return default + alternative framings as a flat array
      const framings = [output.defaultFraming, ...output.alternativeFramings];
      res.json({ framings });
    } else if (section === 'cog-analysis') {
      const { analyzeCenterOfGravity } = await import('../agents/cog-analysis.js');
      const cogData = context as unknown as CoGAnalysis;
      const output = await analyzeCenterOfGravity(cogData);
      res.json(output);
    } else if (section === 'lines-of-effort') {
      const { analyzeLOEGaps } = await import('../agents/loe-gap-analysis.js');
      const loeData = ((context as Record<string, unknown>)?.loes as LineOfEffort[]) || [];
      const cogData = ((context as Record<string, unknown>)?.cogAnalysis as CoGAnalysis) || { friendly: { root: null }, adversary: { root: null } };
      const output = await analyzeLOEGaps(loeData, cogData);
      res.json(output);
    } else if (section === 'operational-approach') {
      const { synthesizeNarrative } = await import('../agents/narrative-synthesis.js');
      // Need full design data for synthesis -- fetch from store
      const design = await designStore.getByProblemSetId(req.params.problemSetId as string);
      const output = await synthesizeNarrative({
        problemFraming: design.problemFraming,
        cogAnalysis: design.cogAnalysis,
        linesOfEffort: design.linesOfEffort,
        operationalApproach: design.operationalApproach,
      });
      res.json(output);
    } else {
      res.status(400).json({ error: `Unsupported analysis section: ${section}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/analyze failed:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;

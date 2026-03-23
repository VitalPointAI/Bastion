/**
 * Design Interview REST API
 *
 * Phase 55 Plan 03: Express routes for /api/design-interview/*
 * Exposes the design interview service to the frontend for guided
 * operational approach development via Ironclaw.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { DesignInterviewService } from '../design-interview/design-interview-service.js';

const router = Router();
const designInterviewService = new DesignInterviewService();

/**
 * POST /:problemSetId/start — Start a new design interview
 */
router.post('/:problemSetId/start', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { mode } = req.body as { mode?: 'new' | 'revision' };

    const result = await designInterviewService.startInterview(problemSetId, mode);

    res.json({
      message: typeof result.message.content === 'string'
        ? result.message.content
        : JSON.stringify(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] start error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /:problemSetId/continue — Continue interview with user message
 */
router.post('/:problemSetId/continue', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { message } = req.body as { message: string };

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const result = await designInterviewService.continueInterview(problemSetId, message);

    res.json({
      message: typeof result.message.content === 'string'
        ? result.message.content
        : JSON.stringify(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] continue error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /:problemSetId/confirm-section — Confirm current section review gate
 */
router.post('/:problemSetId/confirm-section', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    const result = await designInterviewService.confirmSection(problemSetId);

    res.json({
      message: typeof result.message.content === 'string'
        ? result.message.content
        : JSON.stringify(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] confirm-section error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /:problemSetId/state — Get current interview state (for resume)
 */
router.get('/:problemSetId/state', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    const result = await designInterviewService.getInterviewState(problemSetId);

    res.json({ state: result?.meta ?? null });
  } catch (err) {
    console.error('[design-interview] state error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /:problemSetId — Reset interview for fresh start
 */
router.delete('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    await designInterviewService.resetInterview(problemSetId);

    res.status(204).send();
  } catch (err) {
    console.error('[design-interview] reset error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

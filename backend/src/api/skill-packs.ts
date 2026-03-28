/**
 * Skill Packs REST API
 *
 * Phase 60 Plan 05: GET /api/skill-packs
 *
 * Serves the Ironclaw skill pack catalog. No authentication required — the
 * skill catalog is not sensitive and must be accessible to the agent config
 * UI before the user is fully authenticated.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { SKILL_PACKS } from '../ironclaw/skill-packs.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/skill-packs
// ---------------------------------------------------------------------------

/**
 * Return the full skill pack catalog as JSON.
 * No auth required — skill metadata is not sensitive.
 */
router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json(SKILL_PACKS);
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const skillPacksRouter = router;

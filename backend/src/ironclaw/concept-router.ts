/**
 * Concept REST API Router
 *
 * Phase 66 Plan 01: Express router for ironclaw concept CRUD.
 *
 * Mounted in ironclaw-router.ts at /api/ironclaw.
 * All routes extract userDid from the authenticated request context.
 *
 * Routes:
 *   GET  /:problemSetId/concepts                  — list active concepts
 *   GET  /:problemSetId/concepts/:conceptKey/history — version chain
 *   POST /:problemSetId/concepts                  — create/upsert concept
 *   POST /:problemSetId/concepts/:conceptId/retract — retract a concept
 *   GET  /global/concepts                         — list global concepts (problemSetId = null)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { conceptStore, generateConceptEmbedding } from './concept-store.js';
import type { ConceptType } from './concept-types.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Extract user DID from request — same pattern as ironclaw-router.ts.
 */
function getUserDid(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (anyReq.zeroTrust?.did) return anyReq.zeroTrust.did as string;
  if (anyReq.user?.did) return anyReq.user.did as string;
  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const conceptRouter = Router();

/**
 * GET /global/concepts
 * List active concepts that are not scoped to any problem set (global = null).
 */
conceptRouter.get('/global/concepts', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  try {
    const concepts = await conceptStore.getActive(userDid, null);
    res.json(concepts);
  } catch (err) {
    console.error('[concept-router] GET /global/concepts error:', err);
    res.status(500).json({ error: 'Failed to fetch global concepts' });
  }
});

/**
 * GET /:problemSetId/concepts
 * List all active concepts for the authenticated user in a problem set.
 */
conceptRouter.get('/:problemSetId/concepts', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const problemSetId = req.params.problemSetId as string;
  try {
    const concepts = await conceptStore.getActive(userDid, problemSetId);
    res.json(concepts);
  } catch (err) {
    console.error('[concept-router] GET /:problemSetId/concepts error:', err);
    res.status(500).json({ error: 'Failed to fetch concepts' });
  }
});

/**
 * GET /:problemSetId/concepts/:conceptKey/history
 * Return the full version chain for a concept_key, ordered by version ASC.
 */
conceptRouter.get(
  '/:problemSetId/concepts/:conceptKey/history',
  async (req: Request, res: Response) => {
    const userDid = getUserDid(req);
    const problemSetId = req.params.problemSetId as string;
    const conceptKey = req.params.conceptKey as string;
    try {
      const chain = await conceptStore.getVersionChain(
        userDid,
        decodeURIComponent(conceptKey),
        problemSetId,
      );
      res.json(chain);
    } catch (err) {
      console.error('[concept-router] GET history error:', err);
      res.status(500).json({ error: 'Failed to fetch concept history' });
    }
  },
);

/**
 * POST /:problemSetId/concepts/:conceptId/retract
 * Retract a single concept by its UUID.
 */
conceptRouter.post(
  '/:problemSetId/concepts/:conceptId/retract',
  async (req: Request, res: Response) => {
    const conceptId = req.params.conceptId as string;
    try {
      await conceptStore.retractById(conceptId);
      res.json({ success: true });
    } catch (err) {
      console.error('[concept-router] POST retract error:', err);
      res.status(500).json({ error: 'Failed to retract concept' });
    }
  },
);

/**
 * POST /:problemSetId/concepts
 * Create or update (version) a concept for the authenticated user.
 * Body: { conceptKey, conceptType, value, confidence }
 */
conceptRouter.post('/:problemSetId/concepts', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const problemSetId = req.params.problemSetId as string;

  const body = req.body as {
    conceptKey?: string;
    conceptType?: ConceptType;
    value?: Record<string, unknown>;
    confidence?: number;
  };

  const { conceptKey, conceptType, value, confidence } = body;

  if (!conceptKey || !conceptType || value === undefined) {
    res.status(400).json({ error: 'conceptKey, conceptType, and value are required' });
    return;
  }

  try {
    // Generate embedding for semantic retrieval
    const embedding = await generateConceptEmbedding(JSON.stringify(value));

    const entry = await conceptStore.upsertConcept({
      problemSetId,
      userDid,
      conceptKey,
      conceptType,
      value,
      confidence: typeof confidence === 'number' ? confidence : 0.7,
      sourceThreadId: null,
      embedding,
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error('[concept-router] POST /:problemSetId/concepts error:', err);
    res.status(500).json({ error: 'Failed to create concept' });
  }
});

/**
 * Design Revision API
 *
 * Phase 49 Plan 03: Express router for fork-and-merge revision endpoints.
 * Plan tab staff propose changes to Design artifacts via POST. DAO governance
 * updates status via PATCH /status. Approved revisions are merged via PATCH /merge.
 *
 * Mounted at: /api/design/:problemSetId/revisions
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { revisionStore } from '../design/revision-store.js';
import type { ArtifactType, RevisionStatus } from '../design/revision-store.js';

const router = Router({ mergeParams: true }); // mergeParams to inherit :problemSetId from parent

const VALID_ARTIFACT_TYPES: ArtifactType[] = [
  'problem-framing',
  'cog-analysis',
  'lines-of-effort',
  'operational-approach',
];

const VALID_STATUSES: RevisionStatus[] = ['pending', 'approved', 'rejected', 'merged'];

/** Extract authenticated user's DID from request headers. */
function getRequestDid(req: Request): string {
  return (req.headers['x-did'] as string) || 'anonymous';
}

/**
 * POST /api/design/:problemSetId/revisions
 * Create a new revision proposal for a Design artifact.
 * Body: { artifact_type, proposed_data, original_data, rationale? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { problemSetId } = req.params;
    const { artifact_type, proposed_data, original_data, rationale } = req.body;

    if (!artifact_type || !VALID_ARTIFACT_TYPES.includes(artifact_type)) {
      res.status(400).json({
        error: `Invalid artifact_type: ${artifact_type}. Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      });
      return;
    }

    if (proposed_data === undefined || proposed_data === null) {
      res.status(400).json({ error: 'proposed_data is required' });
      return;
    }

    if (original_data === undefined || original_data === null) {
      res.status(400).json({ error: 'original_data is required' });
      return;
    }

    const proposedBy = getRequestDid(req);

    const revision = await revisionStore.create({
      problemSetId: problemSetId as string,
      artifactType: artifact_type as ArtifactType,
      proposedBy,
      originalData: original_data,
      proposedData: proposed_data,
      rationale: rationale ?? undefined,
    });

    res.status(201).json({ revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design-revisions] POST /${req.params.problemSetId}/revisions failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/revisions
 * List revisions for a problem set.
 * Query: ?status=pending (optional filter)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { status } = req.query;

    const revisions = await revisionStore.findByProblemSet(
      problemSetId,
      status as string | undefined
    );

    res.json({ revisions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design-revisions] GET /${req.params.problemSetId}/revisions failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/revisions/:id
 * Get a single revision by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const revision = await revisionStore.findById(req.params.id as string);
    if (!revision) {
      res.status(404).json({ error: 'Revision not found' });
      return;
    }
    res.json({ revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design-revisions] GET revision/${req.params.id} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/revisions/:id/merge
 * Merge an approved revision into the operational_designs table.
 * Called after DAO governance gate approves the revision.
 */
router.patch('/:id/merge', async (req: Request, res: Response) => {
  try {
    const revisionId = req.params.id as string;
    const revision = await revisionStore.findById(revisionId);
    if (!revision) {
      res.status(404).json({ error: 'Revision not found' });
      return;
    }
    if (revision.status !== 'approved') {
      res.status(400).json({ error: 'Revision must be approved before merging' });
      return;
    }

    const merged = await revisionStore.merge(revisionId);
    res.json({ revision: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design-revisions] PATCH revision/${req.params.id}/merge failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/revisions/:id/status
 * Update the status of a revision.
 * Body: { status, reviewed_by? }
 * Used by DAO governance callbacks to move revisions through their lifecycle.
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, reviewed_by } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    const reviewedBy = reviewed_by ?? getRequestDid(req);
    const updated = await revisionStore.updateStatus(
      req.params.id as string,
      status as RevisionStatus,
      reviewedBy
    );

    res.json({ revision: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design-revisions] PATCH revision/${req.params.id}/status failed:`, message);
    res.status(500).json({ error: message });
  }
});

export { router };

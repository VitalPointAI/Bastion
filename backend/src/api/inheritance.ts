/**
 * Inheritance API Routes
 *
 * Phase 26: Strategic Environment Inheritance
 *
 * Express routes for inherited context, acknowledgments, annotations, and RFIs.
 * All routes are nested under /api/problem-sets/:id/... and use zod validation.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { inheritanceService } from '../inheritance/inheritance-service.js';
import { inheritanceStore } from '../inheritance/inheritance-store.js';

const router = Router();

// ============================================================================
// Zod Schemas
// ============================================================================

const acknowledgeSchema = z.object({
  sourceProblemSetId: z.string().min(1),
});

const createAnnotationSchema = z.object({
  sourceProblemSetId: z.string().min(1),
  targetItemId: z.string().min(1),
  targetItemType: z.enum(['strategic_document', 'graph_summary']),
  annotationType: z.enum(['inline', 'interpretation']),
  content: z.string().min(1),
  visibility: z.enum(['upward', 'local_only']).default('upward'),
});

const updateAnnotationSchema = z.object({
  content: z.string().min(1),
});

const createRFISchema = z.object({
  targetProblemSetId: z.string().min(1),
  targetItemId: z.string().min(1),
  targetItemType: z.string().min(1),
  subject: z.string().min(1),
  initialMessage: z.string().min(1),
});

const addRFIMessageSchema = z.object({
  content: z.string().min(1),
});

const updateRFIStatusSchema = z.object({
  status: z.enum(['open', 'responded', 'closed']),
});

// ============================================================================
// Inherited Context Routes
// ============================================================================

/**
 * GET /api/problem-sets/:id/inherited-context
 * Returns the full InheritedContextResponse for a problem set.
 */
router.get('/:id/inherited-context', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const context = await inheritanceService.getInheritedContext(problemSetId);
    res.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get inherited context failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/inherited-context/acknowledge
 * Commander acknowledges updated strategic context from a source PS.
 */
router.post('/:id/inherited-context/acknowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = acknowledgeSchema.parse(req.body);
    const problemSetId = req.params.id as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    await inheritanceService.acknowledgeContext(
      problemSetId,
      body.sourceProblemSetId,
      userDid,
    );

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Acknowledge context failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/inherited-context/changelog
 * Returns changelog entries for all ancestor problem sets.
 */
router.get('/:id/inherited-context/changelog', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const ancestors = await inheritanceStore.getAncestorChain(problemSetId);
    const ancestorIds = ancestors.map(a => a.problemSetId);

    const allEntries = [];
    for (const ancestorId of ancestorIds) {
      const entries = await inheritanceStore.getChangelog(ancestorId, 50);
      const ancestor = ancestors.find(a => a.problemSetId === ancestorId);
      for (const entry of entries) {
        allEntries.push({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          sourceProblemSetName: ancestor?.name ?? 'Unknown',
        });
      }
    }

    // Sort by date descending
    allEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(allEntries.slice(0, 100));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get changelog failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Annotation Routes
// ============================================================================

/**
 * POST /api/problem-sets/:id/annotations
 * Create an annotation on an inherited item.
 */
router.post('/:id/annotations', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = createAnnotationSchema.parse(req.body);
    const problemSetId = req.params.id as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    const annotation = await inheritanceStore.createAnnotation({
      problemSetId,
      sourceProblemSetId: body.sourceProblemSetId,
      targetItemId: body.targetItemId,
      targetItemType: body.targetItemType,
      annotationType: body.annotationType,
      content: body.content,
      basedOnVersion: null, // Will be enriched when cache version is available
      visibility: body.visibility,
      createdBy: userDid,
    });

    res.status(201).json(annotation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create annotation failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/annotations
 * List annotations for a problem set, optional ?targetItemId filter.
 */
router.get('/:id/annotations', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const targetItemId = req.query.targetItemId as string | undefined;
    const annotations = await inheritanceStore.getAnnotations(problemSetId, targetItemId);
    res.json(annotations);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get annotations failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/problem-sets/:id/annotations/:annotationId
 * Update annotation content.
 */
router.put('/:id/annotations/:annotationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = updateAnnotationSchema.parse(req.body);
    const annotationId = req.params.annotationId as string;
    const annotation = await inheritanceStore.updateAnnotation(annotationId, body.content);
    res.json(annotation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update annotation failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/annotations/parent-view
 * Annotations visible to parent (upward visibility).
 */
router.get('/:id/annotations/parent-view', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const visibility = req.query.visibility as 'upward' | 'local_only' | undefined;
    const annotations = await inheritanceStore.getAnnotationsForParentView(problemSetId, visibility);
    res.json(annotations);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get parent-view annotations failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// RFI Routes
// ============================================================================

/**
 * POST /api/problem-sets/:id/rfis
 * Create an RFI thread to a target problem set.
 */
router.post('/:id/rfis', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = createRFISchema.parse(req.body);
    const problemSetId = req.params.id as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    const rfi = await inheritanceStore.createRFI({
      requestingProblemSetId: problemSetId,
      targetProblemSetId: body.targetProblemSetId,
      targetItemId: body.targetItemId,
      targetItemType: body.targetItemType,
      subject: body.subject,
      createdBy: userDid,
    });

    // Add the initial message to the thread
    await inheritanceStore.addRFIMessage(
      rfi.id,
      userDid,
      problemSetId,
      body.initialMessage,
    );

    res.status(201).json(rfi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create RFI failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/rfis
 * List RFIs with ?direction=sent|received.
 */
router.get('/:id/rfis', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const direction = (req.query.direction as string) === 'received' ? 'received' as const : 'sent' as const;
    const rfis = await inheritanceStore.getRFIs(problemSetId, direction);
    res.json(rfis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get RFIs failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/rfis/:rfiId/messages
 * Add a message to an RFI thread.
 */
router.post('/:id/rfis/:rfiId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = addRFIMessageSchema.parse(req.body);
    const problemSetId = req.params.id as string;
    const rfiId = req.params.rfiId as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    const rfiMessage = await inheritanceStore.addRFIMessage(
      rfiId,
      userDid,
      problemSetId,
      body.content,
    );

    res.status(201).json(rfiMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Add RFI message failed:', msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/problem-sets/:id/rfis/:rfiId/messages
 * Get all messages for an RFI thread.
 */
router.get('/:id/rfis/:rfiId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const rfiId = req.params.rfiId as string;
    const messages = await inheritanceStore.getRFIMessages(rfiId);
    res.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get RFI messages failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/problem-sets/:id/rfis/:rfiId/status
 * Update RFI status (open -> responded -> closed).
 */
router.put('/:id/rfis/:rfiId/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = updateRFIStatusSchema.parse(req.body);
    const rfiId = req.params.rfiId as string;
    const rfi = await inheritanceStore.updateRFIStatus(rfiId, body.status);
    res.json(rfi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update RFI status failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Admin: Backfill
// ============================================================================

/**
 * POST /api/inheritance/backfill
 * One-time admin operation: create inheritance subscriptions for all existing
 * parent-child problem set relationships that were created before Phase 26.
 */
router.post('/backfill', requireAuth, async (_req: Request, res: Response) => {
  try {
    console.log('[inheritance] Starting backfill of existing relationships...');
    const result = await inheritanceService.backfillExistingRelationships();
    console.log(`[inheritance] Backfill complete: ${result.processed} processed, ${result.created} created`);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backfill failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;

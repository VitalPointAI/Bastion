/**
 * Inheritance API Routes
 *
 * Phase 26: Strategic Environment Inheritance
 * Phase 38: Inheritance Deepening — FRAGO lifecycle, mission status, and campaign assessment routes
 *
 * Express routes for inherited context, acknowledgments, annotations, RFIs,
 * FRAGO trigger/approve/distribute/acknowledge, mission status reporting,
 * and campaign assessment.
 * All routes are nested under /api/problem-sets/:id/... and use zod validation.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { inheritanceService } from '../inheritance/inheritance-service.js';
import { inheritanceStore } from '../inheritance/inheritance-store.js';
import { fragoService } from '../inheritance/frago-service.js';
import { statusAggregationService } from '../inheritance/status-aggregation-service.js';
import { broadcastStatusUpdate } from '../inheritance/inheritance-ws.js';
import type { MissionStatusSnapshot, StatusUpdateMessage, FRAGOStatus } from '../inheritance/inheritance-types.js';
import type { OPORDStructure } from '../planning/documents/templates/opord-template.js';

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

// Phase 38-02: Interpretation ack, modification request, guidance request schemas
const interpretationAckSchema = z.object({
  action: z.enum(['acknowledge', 'clarify', 'correct']),
  comment: z.string().nullable().optional(),
});

const modificationRequestSchema = z.object({
  targetProblemSetId: z.string().min(1),
  targetItemId: z.string().min(1),
  targetItemType: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().min(1),
});

const resolveModificationRequestSchema = z.object({
  resolution: z.enum(['approved', 'denied']),
  comment: z.string().min(1),
});

const guidanceRequestSchema = z.object({
  targetProblemSetId: z.string().min(1),
  subject: z.string().min(1),
  situationDescription: z.string().min(1),
});

const fragoTriggerSchema = z.object({
  previousOpord: z.record(z.unknown()),
  currentOpord: z.record(z.unknown()),
  opordVersion: z.string().min(1),
  previousVersion: z.string().min(1),
});

const fragoApproveSchema = z.object({
  editedContent: z.string().optional(),
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
// FRAGO Routes
// ============================================================================

/**
 * POST /api/problem-sets/:id/frago/trigger
 * Manually trigger FRAGO generation for an OPORD update.
 * Called by the OPORD save handler when an OPORD is updated.
 */
router.post('/:id/frago/trigger', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = fragoTriggerSchema.parse(req.body);
    const parentPsId = req.params.id as string;

    const drafts = await fragoService.onOpordUpdated(
      parentPsId,
      body.previousOpord as unknown as OPORDStructure,
      body.currentOpord as unknown as OPORDStructure,
      body.opordVersion,
      body.previousVersion,
    );

    res.json(drafts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('FRAGO trigger failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/fragos
 * List all FRAGO drafts where :id is the parent PS.
 * Optional ?status=draft|approved|distributed|acknowledged filter.
 */
router.get('/:id/fragos', requireAuth, async (req: Request, res: Response) => {
  try {
    const parentPsId = req.params.id as string;
    const statusFilter = req.query.status as FRAGOStatus | undefined;

    let drafts = await inheritanceStore.getFRAGODraftsForParent(parentPsId);

    if (statusFilter) {
      drafts = drafts.filter((d) => d.status === statusFilter);
    }

    res.json(drafts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get FRAGOs failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/fragos/received
 * List all FRAGOs received by child PS :id.
 */
router.get('/:id/fragos/received', requireAuth, async (req: Request, res: Response) => {
  try {
    const childPsId = req.params.id as string;
    const drafts = await inheritanceStore.getFRAGODraftsForChild(childPsId);
    res.json(drafts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get received FRAGOs failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/problem-sets/:id/fragos/:fragoId
 * Get a single FRAGO draft by ID.
 */
router.get('/:id/fragos/:fragoId', requireAuth, async (req: Request, res: Response) => {
  try {
    const fragoId = req.params.fragoId as string;
    const draft = await inheritanceStore.getFRAGODraft(fragoId);

    if (!draft) {
      return res.status(404).json({ error: 'FRAGO not found' });
    }

    res.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get FRAGO failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/problem-sets/:id/fragos/:fragoId/approve
 * Commander approves a FRAGO draft, optionally with edited content.
 */
router.put('/:id/fragos/:fragoId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = fragoApproveSchema.parse(req.body);
    const fragoId = req.params.fragoId as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    await fragoService.approveFRAGO(fragoId, userDid, body.editedContent);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as z.ZodError).issues });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Approve FRAGO failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/fragos/:fragoId/distribute
 * Distribute an approved FRAGO to the child problem set.
 */
router.post('/:id/fragos/:fragoId/distribute', requireAuth, async (req: Request, res: Response) => {
  try {
    const fragoId = req.params.fragoId as string;
    await fragoService.distributeFRAGO(fragoId);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Distribute FRAGO failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/problem-sets/:id/fragos/:fragoId/acknowledge
 * Child commander acknowledges receipt of a distributed FRAGO.
 */
router.post('/:id/fragos/:fragoId/acknowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const fragoId = req.params.fragoId as string;
    const userDid = (req as unknown as { userDid: string }).userDid;

    await fragoService.acknowledgeFRAGO(fragoId, userDid);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Acknowledge FRAGO failed:', message);
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

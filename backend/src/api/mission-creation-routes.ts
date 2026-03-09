/**
 * Mission Creation API Routes
 *
 * Phase 35 Plan 02: REST endpoints for mission creation from OPORD
 * and CCIR request lifecycle.
 *
 * Mounted at /api/problem-sets/:problemSetId/missions
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { missionCreationService } from '../mission-creation/mission-creation-service.js';
import { missionCreationStore } from '../mission-creation/mission-creation-store.js';
import { ccirRequestStore } from '../mission-creation/ccir-request-store.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import type { CreateMissionInput } from '../mission-creation/mission-creation-types.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function buildDID(nearAccountId: string): string {
  return `did:near:${nearAccountId}`;
}

// ─── Zod Schemas (Zod v4 API: z.record requires key+value schemas) ─────────

const createMissionSchema = z.object({
  missionName: z.string().min(3).max(100),
  missionStatement: z.string().min(1),
  taskIds: z.array(z.string()).min(1),
  taskStatement: z.string(),
  purpose: z.string(),
  commandersIntent: z.record(z.string(), z.unknown()).optional(),
  taskOrganization: z.record(z.string(), z.unknown()).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  ccirs: z.record(z.string(), z.unknown()).optional(),
  roeReferences: z.array(z.string()).optional().default([]),
  areaOfOperations: z.object({
    type: z.string(),
    coordinates: z.array(z.unknown()),
  }).nullable().optional(),
  timeline: z.record(z.string(), z.unknown()).optional(),
  roleAssignments: z.array(z.object({
    did: z.string(),
    displayName: z.string(),
    role: z.string(),
    daoRole: z.string(),
    isAgent: z.boolean(),
  })),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).default('UNCLASSIFIED'),
  mode: z.string().default('training'),
});

const createCcirRequestSchema = z.object({
  requestType: z.enum(['ccir', 'pir']),
  description: z.string().min(1),
  targetPsId: z.string(),
});

const resolveCcirRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
  responseData: z.record(z.string(), z.unknown()).optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────

// mergeParams: true so we can access :problemSetId from parent mount
const missionCreationRouter = Router({ mergeParams: true });

/**
 * POST /api/problem-sets/:problemSetId/missions
 * Create a mission from OPORD task assignment
 */
missionCreationRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const userDid = buildDID(req.anonUser!.nearAccountId);

    const parsed = createMissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const body = parsed.data;

    // If commandersIntent not provided, auto-resolve 2 levels up
    let commandersIntent: Record<string, unknown> | undefined = body.commandersIntent;
    if (!commandersIntent) {
      commandersIntent = await missionCreationService.resolveCommandersIntent2Up(
        problemSetId,
      ) as unknown as Record<string, unknown>;
    }

    const input: CreateMissionInput = {
      missionName: body.missionName,
      missionStatement: body.missionStatement,
      parentProblemSetId: problemSetId,
      classification: body.classification as CreateMissionInput['classification'],
      mode: body.mode,
      taskIds: body.taskIds,
      taskStatement: body.taskStatement,
      purpose: body.purpose,
      commandersIntent: commandersIntent as unknown as CreateMissionInput['commandersIntent'],
      taskOrganization: body.taskOrganization ?? {},
      constraints: body.constraints ?? {},
      ccirs: body.ccirs ?? {},
      roeReferences: body.roeReferences,
      areaOfOperations: (body.areaOfOperations ?? null) as CreateMissionInput['areaOfOperations'],
      timeline: body.timeline ?? {},
      roleAssignments: body.roleAssignments,
    };

    const result = await missionCreationService.createMissionFromOPORD(input, userDid);

    return res.status(201).json(result);
  } catch (err) {
    console.error('[MissionCreation] POST / error:', err);
    return res.status(500).json({ error: 'Failed to create mission' });
  }
});

/**
 * GET /api/problem-sets/:problemSetId/missions
 * List missions created from this OPORD
 */
missionCreationRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const assignments = await missionCreationStore.getAssignmentsBySource(problemSetId);
    return res.status(200).json(assignments);
  } catch (err) {
    console.error('[MissionCreation] GET / error:', err);
    return res.status(500).json({ error: 'Failed to list missions' });
  }
});

/**
 * POST /api/problem-sets/:problemSetId/missions/ccir-requests
 * Create CCIR/PIR request from child to parent
 */
missionCreationRouter.post('/ccir-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const userDid = buildDID(req.anonUser!.nearAccountId);

    const parsed = createCcirRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { requestType, description, targetPsId } = parsed.data;

    const request = await ccirRequestStore.createRequest({
      requestingPsId: problemSetId,
      targetPsId,
      requestType,
      description,
      createdBy: userDid,
    });

    // Log activity on target PS
    try {
      await problemSetActivityStore.log(
        targetPsId,
        'ccir_request_received',
        userDid,
        null,
        { requestId: request.id, requestType },
      );
    } catch (logErr) {
      console.error('[MissionCreation] Failed to log ccir_request_received:', logErr);
    }

    return res.status(201).json(request);
  } catch (err) {
    console.error('[MissionCreation] POST /ccir-requests error:', err);
    return res.status(500).json({ error: 'Failed to create CCIR request' });
  }
});

/**
 * GET /api/problem-sets/:problemSetId/missions/ccir-requests
 * List outgoing CCIR requests for this PS
 */
missionCreationRouter.get('/ccir-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const requests = await ccirRequestStore.getRequestsByRequester(problemSetId);
    return res.status(200).json(requests);
  } catch (err) {
    console.error('[MissionCreation] GET /ccir-requests error:', err);
    return res.status(500).json({ error: 'Failed to list CCIR requests' });
  }
});

/**
 * GET /api/problem-sets/:problemSetId/missions/ccir-requests/incoming
 * List incoming CCIR requests targeting this PS
 */
missionCreationRouter.get('/ccir-requests/incoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const requests = await ccirRequestStore.getRequestsByTarget(problemSetId);
    return res.status(200).json(requests);
  } catch (err) {
    console.error('[MissionCreation] GET /ccir-requests/incoming error:', err);
    return res.status(500).json({ error: 'Failed to list incoming CCIR requests' });
  }
});

/**
 * PATCH /api/problem-sets/:problemSetId/missions/ccir-requests/:requestId
 * Resolve a CCIR request (approve/deny)
 */
missionCreationRouter.patch('/ccir-requests/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const requestId = req.params.requestId as string;
    const userDid = buildDID(req.anonUser!.nearAccountId);

    const parsed = resolveCcirRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { status, responseData } = parsed.data;

    const resolved = await ccirRequestStore.resolveRequest(
      requestId,
      status,
      userDid,
      responseData,
    );

    // Log activity on the requesting PS (the child that made the request)
    try {
      await problemSetActivityStore.log(
        resolved.requestingPsId,
        'ccir_request_resolved',
        userDid,
        null,
        {
          requestId,
          status,
          resolvedByPsId: problemSetId,
        },
      );
    } catch (logErr) {
      console.error('[MissionCreation] Failed to log ccir_request_resolved:', logErr);
    }

    return res.status(200).json(resolved);
  } catch (err) {
    console.error('[MissionCreation] PATCH /ccir-requests/:requestId error:', err);
    return res.status(500).json({ error: 'Failed to resolve CCIR request' });
  }
});

export { missionCreationRouter };

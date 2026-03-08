/**
 * Assessment REST API Routes
 *
 * Phase 37 Plan 02: Express routes for /api/assessment/*
 * CRUD operations for structured AARs, METL tasks/assessments,
 * MOE/MOP measures, and reframing trigger checks.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { aarStructuredStore } from '../assessment/aar-structured-store.js';
import { metlStore } from '../assessment/metl-store.js';
import { moeStore } from '../assessment/moe-store.js';
import { mopStore } from '../assessment/mop-store.js';
import { aggregationService } from '../assessment/aggregation-service.js';
import { decayService } from '../assessment/decay-service.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateAARSchema = z.object({
  problemSetId: z.string().min(1),
  trainingEventName: z.string().min(1),
  initiatedBy: z.string().min(1),
});

const UpdateAARSchema = z.object({
  whatWasPlanned: z.string().optional(),
  whatHappened: z.string().optional(),
  why: z.string().optional(),
  status: z.enum(['draft', 'in_review', 'finalized']).optional(),
});

const FinalizeAARSchema = z.object({
  finalizedBy: z.string().min(1),
});

const CreateObservationSchema = z.object({
  observationType: z.enum(['sustain', 'improve']),
  content: z.string().min(1),
  metlTaskId: z.string().optional(),
  suggestedByAi: z.boolean().optional(),
  createdBy: z.string().min(1),
});

const UpdateObservationSchema = z.object({
  aiAccepted: z.boolean().optional(),
  content: z.string().optional(),
});

const CreateMETLTaskSchema = z.object({
  problemSetId: z.string().min(1),
  sourceProblemSetId: z.string().optional(),
  taskName: z.string().min(1),
  taskDescription: z.string().optional(),
  competencyArea: z.string().optional(),
  isSupplemental: z.boolean().optional(),
  decayDays: z.number().int().positive().optional(),
});

const CreateMETLAssessmentSchema = z.object({
  metlTaskId: z.string().min(1),
  problemSetId: z.string().min(1),
  aarId: z.string().optional(),
  rating: z.enum(['T', 'P', 'U']),
  assessedBy: z.string().min(1),
  aiSuggestedRating: z.string().optional(),
  commanderOverride: z.boolean().optional(),
  notes: z.string().optional(),
});

const CreateMOESchema = z.object({
  problemSetId: z.string().min(1),
  objectiveId: z.string().optional(),
  objectiveSnapshot: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  createdBy: z.string().min(1),
});

const CreateMOPSchema = z.object({
  problemSetId: z.string().min(1),
  taskId: z.string().optional(),
  taskSnapshot: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  standard: z.string().optional(),
  createdBy: z.string().min(1),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['green', 'yellow', 'red']),
  trend: z.enum(['improving', 'stable', 'declining']),
});

const CreateAssessmentObservationSchema = z.object({
  content: z.string().min(1),
  source: z.enum(['manual', 'ai_suggestion', 'osint']).optional(),
  statusUpdate: z.enum(['green', 'yellow', 'red']).optional(),
  trendUpdate: z.enum(['improving', 'stable', 'declining']).optional(),
  createdBy: z.string().min(1),
});

const ApproveObservationSchema = z.object({
  approvedBy: z.string().min(1),
});

// ============================================================================
// AAR Endpoints
// ============================================================================

/** POST /aars -- create new AAR */
router.post('/aars', async (req: Request, res: Response) => {
  try {
    const input = CreateAARSchema.parse(req.body);
    const aar = await aarStructuredStore.create(input);
    res.status(201).json(aar);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /aars/problem-set/:problemSetId -- list AARs for a problem set */
router.get('/aars/problem-set/:problemSetId', async (req: Request, res: Response) => {
  try {
    const aars = await aarStructuredStore.listByProblemSet(req.params.problemSetId as string);
    res.json(aars);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /aars/:id -- get single AAR */
router.get('/aars/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const aar = await aarStructuredStore.getById(id);
    if (!aar) {
      res.status(404).json({ error: 'AAR not found' });
      return;
    }
    const observations = await aarStructuredStore.listObservations(id);
    res.json({ ...aar, observations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** PATCH /aars/:id -- update AAR text sections (only if not finalized) */
router.patch('/aars/:id', async (req: Request, res: Response) => {
  try {
    const input = UpdateAARSchema.parse(req.body);
    const aar = await aarStructuredStore.update(req.params.id as string, input);
    res.json(aar);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** POST /aars/:id/finalize -- finalize AAR, triggers aggregation */
router.post('/aars/:id/finalize', async (req: Request, res: Response) => {
  try {
    const input = FinalizeAARSchema.parse(req.body);
    const aar = await aarStructuredStore.finalize(req.params.id as string, input.finalizedBy);

    // Trigger upward aggregation after finalization
    await aggregationService.propagateRatings(aar.id);

    res.json(aar);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** POST /aars/:id/observations -- add observation */
router.post('/aars/:id/observations', async (req: Request, res: Response) => {
  try {
    const input = CreateObservationSchema.parse(req.body);
    const observation = await aarStructuredStore.addObservation({
      aarId: req.params.id as string,
      ...input,
    });
    res.status(201).json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** PATCH /aars/observations/:id -- update observation */
router.patch('/aars/observations/:id', async (req: Request, res: Response) => {
  try {
    const input = UpdateObservationSchema.parse(req.body);
    const observation = await aarStructuredStore.updateObservation(req.params.id as string, input);
    res.json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

// ============================================================================
// METL Endpoints
// ============================================================================

/** POST /metl/tasks -- create METL task */
router.post('/metl/tasks', async (req: Request, res: Response) => {
  try {
    const input = CreateMETLTaskSchema.parse(req.body);
    const task = await metlStore.createTask(input);
    res.status(201).json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /metl/tasks/problem-set/:problemSetId -- list tasks */
router.get('/metl/tasks/problem-set/:problemSetId', async (req: Request, res: Response) => {
  try {
    const tasks = await metlStore.getTasksByProblemSet(req.params.problemSetId as string);
    res.json(tasks);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /metl/tasks/inherited/:problemSetId/:sourceProblemSetId -- inherited tasks */
router.get('/metl/tasks/inherited/:problemSetId/:sourceProblemSetId', async (req: Request, res: Response) => {
  try {
    const tasks = await metlStore.getInheritedTasks(
      req.params.problemSetId as string,
      req.params.sourceProblemSetId as string,
    );
    res.json(tasks);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /metl/tasks/:id/promote -- promote supplemental task */
router.post('/metl/tasks/:id/promote', async (req: Request, res: Response) => {
  try {
    const task = await metlStore.promoteTask(req.params.id as string);
    res.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /metl/assessments -- create assessment */
router.post('/metl/assessments', async (req: Request, res: Response) => {
  try {
    const input = CreateMETLAssessmentSchema.parse(req.body);
    const assessment = await metlStore.createAssessment(input);
    res.status(201).json(assessment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /metl/assessments/aar/:aarId -- assessments by AAR */
router.get('/metl/assessments/aar/:aarId', async (req: Request, res: Response) => {
  try {
    const assessments = await metlStore.getAssessmentsByAAR(req.params.aarId as string);
    res.json(assessments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /metl/proficiency/:sourceProblemSetId -- latest proficiency summary */
router.get('/metl/proficiency/:sourceProblemSetId', async (req: Request, res: Response) => {
  try {
    const srcPsId = req.params.sourceProblemSetId as string;
    const proficiency = await metlStore.getLatestProficiency(srcPsId);

    // Enrich with decay report
    const decayReport = await decayService.getDecayReport(srcPsId);

    res.json({ proficiency, decayReport });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /metl/history/:metlTaskId -- assessment history for a task */
router.get('/metl/history/:metlTaskId', async (req: Request, res: Response) => {
  try {
    const history = await metlStore.getAssessmentHistory(req.params.metlTaskId as string);
    res.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// MOE Endpoints
// ============================================================================

/** POST /moes -- create MOE */
router.post('/moes', async (req: Request, res: Response) => {
  try {
    const input = CreateMOESchema.parse(req.body);
    const moe = await moeStore.create(input);
    res.status(201).json(moe);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /moes/problem-set/:problemSetId -- list MOEs */
router.get('/moes/problem-set/:problemSetId', async (req: Request, res: Response) => {
  try {
    const moes = await moeStore.listByProblemSet(req.params.problemSetId as string);
    res.json(moes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** PATCH /moes/:id/status -- update MOE status/trend */
router.patch('/moes/:id/status', async (req: Request, res: Response) => {
  try {
    const input = UpdateStatusSchema.parse(req.body);
    const moe = await moeStore.updateStatus(req.params.id as string, input.status, input.trend);
    res.json(moe);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** POST /moes/:id/observations -- add observation */
router.post('/moes/:id/observations', async (req: Request, res: Response) => {
  try {
    const input = CreateAssessmentObservationSchema.parse(req.body);
    const observation = await moeStore.addObservation({
      targetType: 'moe',
      targetId: req.params.id as string,
      ...input,
    });
    res.status(201).json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /moes/:id/observations -- list observations */
router.get('/moes/:id/observations', async (req: Request, res: Response) => {
  try {
    const observations = await moeStore.listObservations(req.params.id as string);
    res.json(observations);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /moes/observations/:id/approve -- approve observation */
router.post('/moes/observations/:id/approve', async (req: Request, res: Response) => {
  try {
    const input = ApproveObservationSchema.parse(req.body);
    const observation = await moeStore.approveObservation(req.params.id as string, input.approvedBy);
    res.json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

// ============================================================================
// MOP Endpoints
// ============================================================================

/** POST /mops -- create MOP */
router.post('/mops', async (req: Request, res: Response) => {
  try {
    const input = CreateMOPSchema.parse(req.body);
    const mop = await mopStore.create(input);
    res.status(201).json(mop);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /mops/problem-set/:problemSetId -- list MOPs */
router.get('/mops/problem-set/:problemSetId', async (req: Request, res: Response) => {
  try {
    const mops = await mopStore.listByProblemSet(req.params.problemSetId as string);
    res.json(mops);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** PATCH /mops/:id/status -- update MOP status/trend */
router.patch('/mops/:id/status', async (req: Request, res: Response) => {
  try {
    const input = UpdateStatusSchema.parse(req.body);
    const mop = await mopStore.updateStatus(req.params.id as string, input.status, input.trend);
    res.json(mop);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** POST /mops/:id/observations -- add observation */
router.post('/mops/:id/observations', async (req: Request, res: Response) => {
  try {
    const input = CreateAssessmentObservationSchema.parse(req.body);
    const observation = await mopStore.addObservation({
      targetType: 'mop',
      targetId: req.params.id as string,
      ...input,
    });
    res.status(201).json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

/** GET /mops/:id/observations -- list observations */
router.get('/mops/:id/observations', async (req: Request, res: Response) => {
  try {
    const observations = await mopStore.listObservations(req.params.id as string);
    res.json(observations);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /mops/observations/:id/approve -- approve observation */
router.post('/mops/observations/:id/approve', async (req: Request, res: Response) => {
  try {
    const input = ApproveObservationSchema.parse(req.body);
    const observation = await mopStore.approveObservation(req.params.id as string, input.approvedBy);
    res.json(observation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  }
});

// ============================================================================
// Reframing Trigger
// ============================================================================

/** GET /reframing-check/:problemSetId -- check reframing trigger */
router.get('/reframing-check/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    // Get MOEs and MOPs to return counts alongside trigger result
    const moes = await moeStore.listByProblemSet(problemSetId);
    const mops = await mopStore.listByProblemSet(problemSetId);

    const decliningMOEs = moes.filter((m) => m.trend === 'declining').length;
    const redMOPs = mops.filter((m) => m.status === 'red').length;

    const shouldTrigger = await aggregationService.checkReframingTrigger(problemSetId);

    res.json({ shouldTrigger, decliningMOEs, redMOPs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

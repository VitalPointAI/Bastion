/**
 * Exercise REST API
 *
 * Phase 14 Plan 05: Complete REST API for all exercise operations —
 * scenarios, documents, IPB, COAs, orders, tasks, and gates.
 *
 * Every route applies the withExerciseBarrier middleware which sets
 * req.visibleTeams and req.exerciseRole for downstream information
 * barrier enforcement.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getPool } from '../lib/database.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { withExerciseBarrier } from '../exercise/information-barrier.js';
import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import { ScenarioStore } from '../exercise/scenario-store.js';
import { ScenarioDocumentStore } from '../exercise/document-store.js';
import { IPBStore } from '../exercise/ipb-store.js';
import { COAStore } from '../exercise/coa-store.js';
import { OrderStore } from '../exercise/order-store.js';
import { TaskStore } from '../exercise/task-store.js';
import { GateStore } from '../exercise/gate-store.js';
import { ExerciseExtractionService } from '../exercise/extraction-service.js';
import { IPBService } from '../exercise/ipb-service.js';
import { COAScoringService } from '../exercise/coa-scoring-service.js';
import { ExerciseOrderGenerator } from '../exercise/order-generator.js';
import { PlanningBoardService } from '../exercise/planning-board-service.js';
import { inferTagsFromPath } from '../exercise/package-parser.js';
// ─── Multer Setup ─────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

// ─── Store / Service Singletons ───────────────────────────────────────────────

const scenarioStore = new ScenarioStore();
const documentStore = new ScenarioDocumentStore();
const ipbStore = new IPBStore();
const coaStore = new COAStore();
const orderStore = new OrderStore();
const taskStore = new TaskStore();
const gateStore = new GateStore();

/**
 * Build an LLM ProviderConfig for exercise services.
 * Uses OPENAI_API_KEY / OPENAI_MODEL env vars when set, otherwise falls back
 * to the Anthropic provider (which picks up ANTHROPIC_API_KEY).
 */
function getLLMConfig(): import('../strategic/extraction/providers/types.js').ProviderConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      baseUrl: process.env.OPENAI_BASE_URL,
    };
  }
  return {
    type: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
  };
}

function getExtractionService(): ExerciseExtractionService {
  return new ExerciseExtractionService(documentStore);
}

function getIPBService(): IPBService {
  const pool = getPool();
  const llmConfig = getLLMConfig();
  return new IPBService(pool, ipbStore, documentStore, llmConfig);
}

function getCOAScoringService(): COAScoringService {
  const pool = getPool();
  const llmConfig = getLLMConfig();
  return new COAScoringService(pool, coaStore, llmConfig);
}

function getOrderGenerator(): ExerciseOrderGenerator {
  const pool = getPool();
  const llmConfig = getLLMConfig();
  return new ExerciseOrderGenerator(
    pool,
    orderStore,
    documentStore,
    ipbStore,
    coaStore,
    scenarioStore,
    { config: llmConfig }
  );
}

function getPlanningBoardService(): PlanningBoardService {
  const pool = getPool();
  const bus = getMessageBus();
  return new PlanningBoardService(pool, orderStore, taskStore, bus);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Safely extract a single string value from express query params.
 * req.query values are typed as `string | string[] | ParsedQs | undefined`.
 */
function qstr(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] as string | undefined;
  return undefined;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const exerciseRouter = Router();

// Apply information barrier middleware to ALL routes
exerciseRouter.use(withExerciseBarrier);

// ============ SCENARIO ROUTES ============

/**
 * POST /api/exercise/scenarios
 * Create a new exercise scenario.
 */
exerciseRouter.post('/scenarios', async (req: Request, res: Response) => {
  try {
    const { name, designation, exercisePhases } = req.body as {
      name?: string;
      designation?: string;
      exercisePhases?: string[];
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const scenario = await scenarioStore.create({
      name,
      designation: (designation as 'training/exercise' | 'operational') ?? 'training/exercise',
      exercisePhases: exercisePhases ?? [],
      currentPhaseIndex: 0,
      status: 'draft',
      createdBy: (req.headers['x-did'] as string) || 'anonymous',
    });

    res.status(201).json(scenario);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create scenario' });
  }
});

/**
 * GET /api/exercise/scenarios
 * List all exercise scenarios.
 */
exerciseRouter.get('/scenarios', async (_req: Request, res: Response) => {
  try {
    const scenarios = await scenarioStore.findAll();
    res.json({ scenarios });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list scenarios' });
  }
});

/**
 * GET /api/exercise/scenarios/:id
 * Get a scenario by ID.
 */
exerciseRouter.get('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const scenario = await scenarioStore.findById(req.params.id as string);
    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }
    res.json(scenario);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get scenario' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id
 * Update a scenario.
 */
exerciseRouter.put('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const updated = await scenarioStore.update(req.params.id as string, req.body as Partial<import('../exercise/types.js').ExerciseScenario>);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update scenario' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/advance-phase
 * Advance to the next exercise phase.
 */
exerciseRouter.post('/scenarios/:id/advance-phase', async (req: Request, res: Response) => {
  try {
    const scenario = await scenarioStore.advancePhase(req.params.id as string);
    res.json(scenario);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to advance phase' });
  }
});

/**
 * DELETE /api/exercise/scenarios/:id
 * Delete a scenario and all child records (cascades in DB).
 */
exerciseRouter.delete('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    await scenarioStore.delete(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete scenario' });
  }
});

// ============ DOCUMENT ROUTES ============

/**
 * POST /api/exercise/scenarios/:id/upload
 * Multi-file upload. Parses each file, infers tags, creates document records,
 * and queues extraction. Returns 202 with created document IDs.
 */
exerciseRouter.post(
  '/scenarios/:id/upload',
  upload.array('files'),
  async (req: Request, res: Response) => {
    try {
      const scenarioId = req.params.id as string;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const documentParser = new DocumentParser();
      const extractionService = getExtractionService();
      const createdDocs: import('../exercise/types.js').ScenarioDocument[] = [];

      for (const file of files) {
        // Infer tags from the original filename / relative path
        const tags = inferTagsFromPath(file.originalname);

        // Parse file content to text
        let textContent = '';
        try {
          const parsed = await documentParser.parse(file.buffer, file.mimetype);
          textContent = parsed.text;
        } catch (parseErr) {
          console.warn(`[exercise-upload] Failed to parse ${file.originalname}:`, parseErr);
          textContent = '';
        }

        // Create the document record
        const doc = await documentStore.create({
          scenarioId,
          team: tags.team,
          exercisePhase: tags.exercisePhase,
          documentType: tags.documentType,
          filename: file.originalname,
          mimeType: file.mimetype,
          textContent,
          extractedData: {},
          extractionConfidence: 0,
        });

        createdDocs.push(doc);

        // Queue extraction asynchronously — do not block the response
        setImmediate(() => {
          extractionService.extractDocument(doc.id, textContent, tags, file.mimetype).catch((err) => {
            console.error(`[exercise-upload] Extraction failed for ${doc.id}:`, err);
          });
        });
      }

      res.status(202).json({
        uploaded: createdDocs.length,
        documents: createdDocs.map((d) => ({
          id: d.id,
          filename: d.filename,
          team: d.team,
          exercisePhase: d.exercisePhase,
          documentType: d.documentType,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Upload failed' });
    }
  }
);

/**
 * GET /api/exercise/scenarios/:id/documents
 * List documents for a scenario (filtered by req.visibleTeams).
 * Optional query params: phase, type, team
 */
exerciseRouter.get('/scenarios/:id/documents', async (req: Request, res: Response) => {
  try {
    const phase = qstr(req.query.phase);
    const type = qstr(req.query.type);
    const team = qstr(req.query.team);

    let docs: import('../exercise/types.js').ScenarioDocument[];

    if (phase) {
      docs = await documentStore.findByScenarioAndPhase(
        req.params.id as string,
        phase,
        req.visibleTeams
      );
    } else {
      docs = await documentStore.findByScenario(req.params.id as string, req.visibleTeams);
    }

    // Apply optional client-side filters
    if (type) docs = docs.filter((d) => d.documentType === type);
    if (team) docs = docs.filter((d) => d.team === team);

    res.json({ documents: docs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list documents' });
  }
});

/**
 * GET /api/exercise/documents/:docId
 * Get a single document with extraction results.
 */
exerciseRouter.get('/documents/:docId', async (req: Request, res: Response) => {
  try {
    const doc = await documentStore.findById(req.params.docId as string, req.visibleTeams);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get document' });
  }
});

// ============ IPB ROUTES ============

/**
 * POST /api/exercise/scenarios/:id/ipb/assemble
 * Trigger IPB assembly. Body: { team, perspective, exercisePhase }
 */
exerciseRouter.post('/scenarios/:id/ipb/assemble', async (req: Request, res: Response) => {
  try {
    const { team, perspective, exercisePhase } = req.body as {
      team?: string;
      perspective?: string;
      exercisePhase?: string;
    };

    if (!team || !perspective || !exercisePhase) {
      res.status(400).json({ error: 'team, perspective, and exercisePhase are required' });
      return;
    }

    if (team !== 'blue' && team !== 'red') {
      res.status(400).json({ error: 'team must be "blue" or "red"' });
      return;
    }

    if (perspective !== 'own' && perspective !== 'enemy_assessment') {
      res.status(400).json({ error: 'perspective must be "own" or "enemy_assessment"' });
      return;
    }

    const ipbService = getIPBService();
    const assessment = await ipbService.assembleIPB(
      req.params.id as string,
      team as 'blue' | 'red',
      perspective as 'own' | 'enemy_assessment',
      exercisePhase,
      req.visibleTeams
    );

    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to assemble IPB' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/ipb
 * List IPB assessments. Query params: team, perspective, phase
 */
exerciseRouter.get('/scenarios/:id/ipb', async (req: Request, res: Response) => {
  try {
    const team = qstr(req.query.team);
    const perspective = qstr(req.query.perspective);
    const phase = qstr(req.query.phase);

    let assessments: import('../exercise/types.js').IPBAssessment[];

    if (team && perspective) {
      const single = await ipbStore.findByScenarioAndPerspective(
        req.params.id as string,
        team,
        perspective,
        req.visibleTeams
      );
      assessments = single ? [single] : [];
    } else {
      assessments = await ipbStore.findByScenario(req.params.id as string, req.visibleTeams);
    }

    // Filter by phase if provided
    if (phase) {
      assessments = assessments.filter((a) => a.exercisePhase === phase);
    }

    res.json({ assessments });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list IPB assessments' });
  }
});

/**
 * GET /api/exercise/ipb/:assessmentId
 * Get a single IPB assessment with overlay layers.
 */
exerciseRouter.get('/ipb/:assessmentId', async (req: Request, res: Response) => {
  try {
    const assessment = await ipbStore.findById(req.params.assessmentId as string, req.visibleTeams);
    if (!assessment) {
      res.status(404).json({ error: 'IPB assessment not found' });
      return;
    }
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get IPB assessment' });
  }
});

/**
 * GET /api/exercise/ipb/:assessmentId/history
 * Get version history of an IPB assessment.
 */
exerciseRouter.get('/ipb/:assessmentId/history', async (req: Request, res: Response) => {
  try {
    const history = await ipbStore.getVersionHistory(req.params.assessmentId as string, req.visibleTeams);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get IPB history' });
  }
});

/**
 * POST /api/exercise/ipb/:assessmentId/sitrep-preview
 * Preview SITREP delta without committing. Body: { sitrepDocId }
 * Returns SITREPDeltaPreview — changedFields, affectedCOAs, sitrepSummary.
 * Does NOT create a new IPB version.
 */
exerciseRouter.post('/ipb/:assessmentId/sitrep-preview', async (req: Request, res: Response) => {
  try {
    const { sitrepDocId } = req.body as { sitrepDocId?: string };

    if (!sitrepDocId) {
      res.status(400).json({ error: 'sitrepDocId is required' });
      return;
    }

    const ipbService = getIPBService();
    const preview = await ipbService.previewIPBFromSITREP(
      req.params.assessmentId as string,
      sitrepDocId,
      req.visibleTeams
    );

    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to preview SITREP delta' });
  }
});

/**
 * POST /api/exercise/ipb/:assessmentId/update-from-sitrep
 * Update IPB assessment from a new SITREP. Body: { sitrepDocId }
 */
exerciseRouter.post('/ipb/:assessmentId/update-from-sitrep', async (req: Request, res: Response) => {
  try {
    const { sitrepDocId } = req.body as { sitrepDocId?: string };

    if (!sitrepDocId) {
      res.status(400).json({ error: 'sitrepDocId is required' });
      return;
    }

    const ipbService = getIPBService();
    const updated = await ipbService.updateIPBFromSITREP(
      req.params.assessmentId as string,
      sitrepDocId,
      req.visibleTeams
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update IPB from SITREP' });
  }
});

// ============ COA ROUTES ============

/**
 * POST /api/exercise/scenarios/:id/coas
 * Create a COA. Body: { team, exercisePhase, name, description, scheme }
 */
exerciseRouter.post('/scenarios/:id/coas', async (req: Request, res: Response) => {
  try {
    const { team, exercisePhase, name, description, scheme } = req.body as {
      team?: string;
      exercisePhase?: string;
      name?: string;
      description?: string;
      scheme?: string;
    };

    if (!team || !exercisePhase || !name) {
      res.status(400).json({ error: 'team, exercisePhase, and name are required' });
      return;
    }

    // Auto-number within scenario+team+phase
    const existing = await coaStore.findByScenario(req.params.id as string, req.visibleTeams);
    const teamPhase = existing.filter((c) => c.team === team && c.exercisePhase === exercisePhase);
    const nextNumber = teamPhase.length + 1;

    const coa = await coaStore.create({
      scenarioId: req.params.id as string,
      team: team as 'blue' | 'red',
      exercisePhase,
      number: nextNumber,
      name,
      description: description ?? '',
      scheme: scheme ?? '',
      doctScores: null,
      wargameEvidence: {},
      combinedScore: null,
      narrative: '',
      commanderDecision: null,
      commanderDecisionNotes: '',
      decisionHash: null,
      blockchainTx: null,
      selected: false,
      createdBy: (req.headers['x-did'] as string) || 'anonymous',
    });

    res.status(201).json(coa);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create COA' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/coas
 * List COAs. Query params: team, phase
 */
exerciseRouter.get('/scenarios/:id/coas', async (req: Request, res: Response) => {
  try {
    const team = qstr(req.query.team);
    const phase = qstr(req.query.phase);

    let coas = await coaStore.findByScenario(req.params.id as string, req.visibleTeams);

    if (team) coas = coas.filter((c) => c.team === team);
    if (phase) coas = coas.filter((c) => c.exercisePhase === phase);

    res.json({ coas });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list COAs' });
  }
});

/**
 * GET /api/exercise/coas/:coaId
 * Get a single COA with scores.
 */
exerciseRouter.get('/coas/:coaId', async (req: Request, res: Response) => {
  try {
    const coa = await coaStore.findById(req.params.coaId as string, req.visibleTeams);
    if (!coa) {
      res.status(404).json({ error: 'COA not found' });
      return;
    }
    res.json(coa);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get COA' });
  }
});

/**
 * POST /api/exercise/coas/:coaId/score
 * Trigger COA scoring via FASDC criteria. Returns ExerciseCOAScore.
 */
exerciseRouter.post('/coas/:coaId/score', async (req: Request, res: Response) => {
  try {
    const scoringService = getCOAScoringService();
    const scores = await scoringService.scoreCOA(req.params.coaId as string, req.visibleTeams);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to score COA' });
  }
});

/**
 * POST /api/exercise/coas/:coaId/wargame
 * Integrate wargame results. Body: { wargameSessionId, outcomes }
 */
exerciseRouter.post('/coas/:coaId/wargame', async (req: Request, res: Response) => {
  try {
    const { wargameSessionId, outcomes } = req.body as {
      wargameSessionId?: string;
      outcomes?: Record<string, unknown>;
    };

    if (!wargameSessionId || !outcomes) {
      res.status(400).json({ error: 'wargameSessionId and outcomes are required' });
      return;
    }

    const scoringService = getCOAScoringService();
    await scoringService.integrateWargameResults(
      req.params.coaId as string,
      wargameSessionId,
      outcomes,
      req.visibleTeams
    );

    const updated = await coaStore.findById(req.params.coaId as string, req.visibleTeams);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to integrate wargame results' });
  }
});

/**
 * POST /api/exercise/coas/:coaId/narrative
 * Update staff-editable narrative. Body: { narrative }
 */
exerciseRouter.post('/coas/:coaId/narrative', async (req: Request, res: Response) => {
  try {
    const { narrative } = req.body as { narrative?: string };

    if (narrative === undefined || narrative === null) {
      res.status(400).json({ error: 'narrative is required' });
      return;
    }

    await coaStore.updateNarrative(req.params.coaId as string, narrative);
    const updated = await coaStore.findById(req.params.coaId as string, req.visibleTeams);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update narrative' });
  }
});

/**
 * POST /api/exercise/coas/compare
 * Compare multiple COAs. Body: { coaIds }
 */
exerciseRouter.post('/coas/compare', async (req: Request, res: Response) => {
  try {
    const { coaIds } = req.body as { coaIds?: string[] };

    if (!coaIds || !Array.isArray(coaIds) || coaIds.length < 2) {
      res.status(400).json({ error: 'coaIds array with at least 2 IDs is required' });
      return;
    }

    const scoringService = getCOAScoringService();
    const comparison = await scoringService.compareCOAs(coaIds, req.visibleTeams);
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to compare COAs' });
  }
});

/**
 * POST /api/exercise/coas/:coaId/decision
 * Record commander decision. Body: { decision, notes }. Returns { hash }.
 */
exerciseRouter.post('/coas/:coaId/decision', async (req: Request, res: Response) => {
  try {
    const { decision, notes } = req.body as { decision?: string; notes?: string };

    if (!decision) {
      res.status(400).json({ error: 'decision is required' });
      return;
    }

    const scoringService = getCOAScoringService();
    const result = await scoringService.recordCommanderDecision(
      req.params.coaId as string,
      decision,
      notes ?? ''
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record commander decision' });
  }
});

// ============ ORDER ROUTES ============

/**
 * POST /api/exercise/scenarios/:id/orders/generate
 * Generate an order. Body: { team, orderType, exercisePhase, selectedCOAId? }
 */
exerciseRouter.post('/scenarios/:id/orders/generate', async (req: Request, res: Response) => {
  try {
    const { team, orderType, exercisePhase, selectedCOAId } = req.body as {
      team?: string;
      orderType?: string;
      exercisePhase?: string;
      selectedCOAId?: string;
    };

    if (!team || !orderType || !exercisePhase) {
      res.status(400).json({ error: 'team, orderType, and exercisePhase are required' });
      return;
    }

    if (team !== 'blue' && team !== 'red') {
      res.status(400).json({ error: 'team must be "blue" or "red"' });
      return;
    }

    const generator = getOrderGenerator();
    let order: import('../exercise/types.js').ExerciseOrder;

    if (orderType === 'WARNORD') {
      order = await generator.generateWARNORD(
        req.params.id as string,
        team as 'blue' | 'red',
        exercisePhase,
        req.visibleTeams
      );
    } else if (orderType === 'OPORD') {
      if (!selectedCOAId) {
        res.status(400).json({ error: 'selectedCOAId is required for OPORD generation' });
        return;
      }
      order = await generator.generateOPORD(
        req.params.id as string,
        team as 'blue' | 'red',
        exercisePhase,
        selectedCOAId,
        req.visibleTeams
      );
    } else if (orderType === 'FRAGO') {
      if (!selectedCOAId) {
        res.status(400).json({ error: 'selectedCOAId (baseOrderId) is required for FRAGO generation' });
        return;
      }
      const changedContext = (req.body as Record<string, unknown>).changedContext as string ?? '';
      order = await generator.generateFRAGO(
        req.params.id as string,
        selectedCOAId, // baseOrderId for FRAGO
        changedContext,
        req.visibleTeams
      );
    } else {
      res.status(400).json({ error: 'orderType must be WARNORD, OPORD, or FRAGO' });
      return;
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate order' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/orders/draft
 * Create a blank draft for manual authoring. Body: { team, orderType, exercisePhase }
 */
exerciseRouter.post('/scenarios/:id/orders/draft', async (req: Request, res: Response) => {
  try {
    const { team, orderType, exercisePhase } = req.body as {
      team?: string;
      orderType?: string;
      exercisePhase?: string;
    };

    if (!team || !orderType || !exercisePhase) {
      res.status(400).json({ error: 'team, orderType, and exercisePhase are required' });
      return;
    }

    const order = await orderStore.create({
      scenarioId: req.params.id as string,
      team: team as 'blue' | 'red',
      orderType: orderType as 'WARNORD' | 'OPORD' | 'FRAGO',
      exercisePhase,
      version: 1,
      content: {} as import('../exercise/types.js').WARNORDContent,
      status: 'draft',
      publishedAt: null,
      createdBy: (req.headers['x-did'] as string) || 'anonymous',
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create draft order' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/orders
 * List orders. Query params: team, phase, type
 */
exerciseRouter.get('/scenarios/:id/orders', async (req: Request, res: Response) => {
  try {
    const team = qstr(req.query.team);
    const phase = qstr(req.query.phase);
    const type = qstr(req.query.type);

    let orders: import('../exercise/types.js').ExerciseOrder[];

    if (phase) {
      orders = await orderStore.findByPhase(req.params.id as string, phase, req.visibleTeams);
    } else {
      orders = await orderStore.findByScenario(req.params.id as string, req.visibleTeams);
    }

    if (team) orders = orders.filter((o) => o.team === team);
    if (type) orders = orders.filter((o) => o.orderType === type);

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list orders' });
  }
});

/**
 * GET /api/exercise/orders/:orderId
 * Get a single order.
 */
exerciseRouter.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const order = await orderStore.findById(req.params.orderId as string, req.visibleTeams);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get order' });
  }
});

/**
 * PUT /api/exercise/orders/:orderId/content
 * Update order content (staff edits). Body: any valid order content object.
 */
exerciseRouter.put('/orders/:orderId/content', async (req: Request, res: Response) => {
  try {
    await orderStore.updateContent(req.params.orderId as string, req.body as object);
    const updated = await orderStore.findById(req.params.orderId as string, req.visibleTeams);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update order content' });
  }
});

/**
 * POST /api/exercise/orders/:orderId/publish
 * Publish an order → creates planning tasks via PlanningBoardService.
 */
exerciseRouter.post('/orders/:orderId/publish', async (req: Request, res: Response) => {
  try {
    const boardService = getPlanningBoardService();
    const result = await boardService.publishOrder(req.params.orderId as string, req.visibleTeams);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish order' });
  }
});

// ============ TASK ROUTES ============

/**
 * GET /api/exercise/scenarios/:id/tasks
 * List tasks. Query params: role, status, phase
 */
exerciseRouter.get('/scenarios/:id/tasks', async (req: Request, res: Response) => {
  try {
    const role = qstr(req.query.role);
    const status = qstr(req.query.status);
    const phase = qstr(req.query.phase);

    let tasks: import('../exercise/types.js').PlanningTask[];

    if (role) {
      tasks = await taskStore.findByRole(req.params.id as string, role, req.visibleTeams);
    } else {
      tasks = await taskStore.findByScenario(req.params.id as string, req.visibleTeams);
    }

    if (status) tasks = tasks.filter((t) => t.status === status);
    if (phase) {
      // Filter by phase requires joining with orders — load orders to build phase map
      const orders = await orderStore.findByScenario(req.params.id as string, req.visibleTeams);
      const phaseByOrderId = new Map(orders.map((o) => [o.id, o.exercisePhase]));
      tasks = tasks.filter((t) => phaseByOrderId.get(t.orderId) === phase);
    }

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list tasks' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/tasks/summary
 * Board summary with completion stats.
 */
exerciseRouter.get('/scenarios/:id/tasks/summary', async (req: Request, res: Response) => {
  try {
    const boardService = getPlanningBoardService();
    const summary = await boardService.getBoardSummary(req.params.id as string, req.visibleTeams);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get board summary' });
  }
});

/**
 * PUT /api/exercise/tasks/:taskId/status
 * Update task status. Body: { status }
 */
exerciseRouter.put('/tasks/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    if (!['pending', 'in_progress', 'complete'].includes(status)) {
      res.status(400).json({ error: 'status must be pending, in_progress, or complete' });
      return;
    }

    const boardService = getPlanningBoardService();
    const updated = await boardService.updateTaskStatus(
      req.params.taskId as string,
      status as 'pending' | 'in_progress' | 'complete',
      req.visibleTeams
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update task status' });
  }
});

/**
 * PUT /api/exercise/tasks/:taskId/reassign
 * Reassign task. Body: { role }
 */
exerciseRouter.put('/tasks/:taskId/reassign', async (req: Request, res: Response) => {
  try {
    const { role } = req.body as { role?: string };

    if (!role) {
      res.status(400).json({ error: 'role is required' });
      return;
    }

    const boardService = getPlanningBoardService();
    const updated = await boardService.reassignTask(req.params.taskId as string, role, req.visibleTeams);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reassign task' });
  }
});

// ============ GATE ROUTES ============

/**
 * POST /api/exercise/scenarios/:id/gates
 * Create a gate. Body: { exercisePhase, gateType, conditionDescription }
 */
exerciseRouter.post('/scenarios/:id/gates', async (req: Request, res: Response) => {
  try {
    const { exercisePhase, gateType, conditionDescription } = req.body as {
      exercisePhase?: string;
      gateType?: string;
      conditionDescription?: string;
    };

    if (!exercisePhase || !gateType || !conditionDescription) {
      res.status(400).json({ error: 'exercisePhase, gateType, and conditionDescription are required' });
      return;
    }

    const gate = await gateStore.create({
      scenarioId: req.params.id as string,
      exercisePhase,
      gateType: gateType as import('../exercise/types.js').ExerciseGate['gateType'],
      conditionDescription,
      isOpen: false,
      openedBy: null,
      openedAt: null,
    });

    res.status(201).json(gate);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create gate' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/gates
 * List gates. Query param: phase
 */
exerciseRouter.get('/scenarios/:id/gates', async (req: Request, res: Response) => {
  try {
    const phase = qstr(req.query.phase);

    let gates: import('../exercise/types.js').ExerciseGate[];

    if (phase) {
      gates = await gateStore.findByPhase(req.params.id as string, phase);
    } else {
      gates = await gateStore.findByScenario(req.params.id as string);
    }

    res.json({ gates });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list gates' });
  }
});

/**
 * POST /api/exercise/gates/:gateId/open
 * Open a gate (exercise_control action only).
 */
exerciseRouter.post('/gates/:gateId/open', async (req: Request, res: Response) => {
  try {
    // Only exercise_control can open gates
    if (req.exerciseRole !== 'exercise_control') {
      res.status(403).json({ error: 'Only exercise_control can open gates' });
      return;
    }

    const openedBy = (req.headers['x-did'] as string) || 'exercise_control';
    await gateStore.openGate(req.params.gateId as string, openedBy);
    res.json({ success: true, gateId: req.params.gateId as string, openedBy });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to open gate' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/gates/phase-ready/:phase
 * Check whether all gates for a phase are open (phase transition ready).
 */
exerciseRouter.get('/scenarios/:id/gates/phase-ready/:phase', async (req: Request, res: Response) => {
  try {
    const isReady = await gateStore.isPhaseReady(req.params.id as string, req.params.phase as string);
    res.json({ phase: req.params.phase as string, ready: isReady });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check phase readiness' });
  }
});

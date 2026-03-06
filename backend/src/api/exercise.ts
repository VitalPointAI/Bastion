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
import { getPool, getSharedBoss } from '../lib/database.js';
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
import { StaffProductStore } from '../exercise/staff-product-store.js';
import { StaffNotificationService } from '../exercise/staff-notification-service.js';
import { StrategicImportService } from '../exercise/strategic-import-service.js';
import { inferTagsFromPath } from '../exercise/package-parser.js';
import type { AgentTeamConfig } from '../exercise/types.js';
import { STAFF_ROLE_CONFIG, PRODUCT_TYPE_REGISTRY } from '../exercise/types.js';
import { configService } from '../strategic/config/service.js';
import type { ProviderConfig } from '../strategic/extraction/providers/types.js';
import { OpenAICompatibleProvider } from '../strategic/extraction/providers/openai-provider.js';
import { AIRunStore } from '../exercise/ai-run-store.js';
import { AIChannelStore } from '../exercise/ai-channel-store.js';
import { ProductVersionStore } from '../exercise/product-version-store.js';
import { AIContextStore } from '../exercise/ai-context-store.js';
import { AICoordinationStore } from '../exercise/ai-coordination-store.js';
import { TriggerRouter, registerAIRoleWorker } from '../exercise/trigger-router.js';
import { LangGraphAgentRunner } from '../exercise/ai-role-runner.js';
import { getDefaultAgentsForRole } from '../exercise/agent-library.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { ReviewFeedback } from '../exercise/types.js';
import { aarStore } from '../exercise/aar-store.js';
import { checkpointStore } from '../exercise/checkpoint-store.js';
// ─── Multer Setup ─────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
});

// ─── Store / Service Singletons ───────────────────────────────────────────────

const scenarioStore = new ScenarioStore();
const documentStore = new ScenarioDocumentStore();
const ipbStore = new IPBStore();
const coaStore = new COAStore();
const orderStore = new OrderStore();
const taskStore = new TaskStore();
const gateStore = new GateStore();
const staffProductStore = new StaffProductStore();
const staffNotificationService = new StaffNotificationService();
const strategicImportService = new StrategicImportService();

// ─── AI Workspace Store / Runner / Router Singletons ─────────────────────────

/**
 * Build or return the AI workspace singletons.
 * Uses lazy initialization so the database pool is available when first accessed.
 */
let _aiWorkspaceInit = false;
let _aiRunStore: AIRunStore;
let _aiChannelStore: AIChannelStore;
let _productVersionStore: ProductVersionStore;
let _aiContextStore: AIContextStore;
let _aiCoordinationStore: AICoordinationStore;
let _agentRunner: LangGraphAgentRunner;
let _triggerRouter: TriggerRouter;

export async function initAIWorkspace(): Promise<void> {
  await getAIWorkspace();

  // Phase 22: Initialize training infrastructure tables (idempotent)
  await aarStore.init();
  await checkpointStore.init();
}

async function getAIWorkspace(): Promise<{
  aiRunStore: AIRunStore;
  aiChannelStore: AIChannelStore;
  productVersionStore: ProductVersionStore;
  aiContextStore: AIContextStore;
  aiCoordinationStore: AICoordinationStore;
  agentRunner: LangGraphAgentRunner;
  triggerRouter: TriggerRouter;
}> {
  if (_aiWorkspaceInit) {
    return {
      aiRunStore: _aiRunStore,
      aiChannelStore: _aiChannelStore,
      productVersionStore: _productVersionStore,
      aiContextStore: _aiContextStore,
      aiCoordinationStore: _aiCoordinationStore,
      agentRunner: _agentRunner,
      triggerRouter: _triggerRouter,
    };
  }

  const pool = getPool();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required for AI workspace');

  _aiRunStore = new AIRunStore(pool);
  _aiChannelStore = new AIChannelStore(pool);
  _productVersionStore = new ProductVersionStore(pool);
  _aiContextStore = new AIContextStore(pool);
  _aiCoordinationStore = new AICoordinationStore(pool);

  const checkpointer = PostgresSaver.fromConnString(dbUrl);
  _agentRunner = new LangGraphAgentRunner(
    checkpointer,
    _aiRunStore,
    _aiChannelStore,
    _productVersionStore,
    _aiContextStore,
  );

  const boss = await getSharedBoss();
  _triggerRouter = new TriggerRouter(boss, _aiRunStore);
  await registerAIRoleWorker(boss, _agentRunner, _aiRunStore);

  _aiWorkspaceInit = true;
  return {
    aiRunStore: _aiRunStore,
    aiChannelStore: _aiChannelStore,
    productVersionStore: _productVersionStore,
    aiContextStore: _aiContextStore,
    aiCoordinationStore: _aiCoordinationStore,
    agentRunner: _agentRunner,
    triggerRouter: _triggerRouter,
  };
}

/**
 * Build an LLM ProviderConfig from the admin-configured settings.
 * Reads from the same config store that the Admin Dashboard LLM panel writes to.
 */
async function getLLMConfig(): Promise<ProviderConfig> {
  const llmConfig = await configService.getLLMConfig();
  const providerType = llmConfig.provider === 'local' ? 'ollama' : llmConfig.provider;
  return {
    type: providerType as ProviderConfig['type'],
    model: llmConfig.models.extraction,
    apiKey: llmConfig.apiKey || undefined,
    baseUrl: llmConfig.baseUrl,
  };
}

async function getExtractionService(): Promise<ExerciseExtractionService> {
  const providerConfig = await getLLMConfig();
  return new ExerciseExtractionService(documentStore, providerConfig);
}

async function getIPBService(): Promise<IPBService> {
  const pool = getPool();
  const llmConfig = await getLLMConfig();
  return new IPBService(pool, ipbStore, documentStore, llmConfig);
}

async function getCOAScoringService(): Promise<COAScoringService> {
  const pool = getPool();
  const llmConfig = await getLLMConfig();
  return new COAScoringService(pool, coaStore, llmConfig);
}

async function getOrderGenerator(): Promise<ExerciseOrderGenerator> {
  const pool = getPool();
  const llmConfig = await getLLMConfig();
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
    const { name, designation, exercisePhases, enabledRoles } = req.body as {
      name?: string;
      designation?: string;
      exercisePhases?: string[];
      enabledRoles?: string[];
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    // Default to core_staff preset if enabledRoles not specified
    const { STAFF_PRESET_TEMPLATES } = await import('../exercise/types.js');
    const resolvedEnabledRoles = enabledRoles ?? STAFF_PRESET_TEMPLATES['core_staff'];

    const scenario = await scenarioStore.create({
      name,
      designation: (designation as 'training/exercise' | 'operational') ?? 'training/exercise',
      exercisePhases: exercisePhases ?? [],
      currentPhaseIndex: 0,
      status: 'draft',
      enabledRoles: resolvedEnabledRoles,
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
    const scenarioId = req.params.id as string;
    const previousScenario = await scenarioStore.findById(scenarioId);
    const previousPhase = previousScenario?.exercisePhases?.[previousScenario.currentPhaseIndex];
    const scenario = await scenarioStore.advancePhase(scenarioId);
    const newPhase = scenario.exercisePhases?.[scenario.currentPhaseIndex];
    res.json(scenario);

    // Auto-trigger: phase change fires all AI-assigned roles (non-blocking)
    setImmediate(async () => {
      try {
        const aiRoles = Object.entries(scenario.roleAssignments ?? {})
          .filter(([, mode]) => mode === 'ai')
          .map(([roleKey]) => roleKey);
        if (aiRoles.length === 0) return;
        const { triggerRouter } = await getAIWorkspace();
        for (const roleKey of aiRoles) {
          await triggerRouter.trigger(scenarioId, roleKey, {
            triggerType: 'phase_change',
            payload: { newPhase, previousPhase },
          });
        }
      } catch (err) {
        console.error('[advance-phase] phase_change auto-trigger failed:', err);
      }
    });
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
      const createdDocs: import('../exercise/types.js').ScenarioDocument[] = [];

      // Parse client-provided tags (from the pre-upload preview table)
      let clientTags: Array<{ team: string; exercisePhase: string; documentType: string }> | null = null;
      if (req.body?.tags) {
        try {
          clientTags = JSON.parse(req.body.tags as string);
        } catch { /* fall back to server-side inference */ }
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Use client-provided tags if available, otherwise infer from filename
        const tags = clientTags?.[i]
          ? { team: clientTags[i].team as 'blue' | 'red' | 'controller', exercisePhase: clientTags[i].exercisePhase, documentType: clientTags[i].documentType as import('../exercise/types.js').ScenarioDocument['documentType'], confidence: 1.0 }
          : inferTagsFromPath(file.originalname);

        // Parse file content to text
        let textContent = '';
        try {
          const parsed = await documentParser.parse(file.buffer, file.mimetype);
          textContent = parsed.text;
        } catch (parseErr) {
          console.warn(`[exercise-upload] Failed to parse ${file.originalname}:`, parseErr);
          textContent = '';
        }

        // Create the document record (store original file buffer for re-parse on retry)
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
        }, file.buffer);

        createdDocs.push(doc);

        // Queue extraction asynchronously — do not block the response
        setImmediate(() => {
          getExtractionService()
            .then((extractionService) =>
              extractionService.extractDocument(doc.id, textContent, tags, file.mimetype)
            )
            .catch((err) => {
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

      // Auto-trigger: OPORD upload fires all AI-assigned roles (non-blocking)
      setImmediate(async () => {
        try {
          const scenario = await scenarioStore.findById(scenarioId);
          if (!scenario) return;
          const aiRoles = Object.entries(scenario.roleAssignments ?? {})
            .filter(([, mode]) => mode === 'ai')
            .map(([roleKey]) => roleKey);
          if (aiRoles.length === 0) return;
          const { triggerRouter } = await getAIWorkspace();
          for (const roleKey of aiRoles) {
            for (const uploadedDoc of createdDocs) {
              await triggerRouter.trigger(scenarioId, roleKey, {
                triggerType: 'opord_upload',
                payload: { documentId: uploadedDoc.id, documentType: uploadedDoc.documentType },
              });
            }
          }
        } catch (err) {
          console.error('[exercise-upload] opord_upload auto-trigger failed:', err);
        }
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

/**
 * PUT /api/exercise/documents/:docId
 * Update document tags (team, exercisePhase, documentType).
 */
exerciseRouter.put('/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { team, exercisePhase, documentType } = req.body as {
      team?: string;
      exercisePhase?: string;
      documentType?: string;
    };

    const updated = await documentStore.updateTags(req.params.docId as string, {
      team,
      exercisePhase,
      documentType,
    });

    if (!updated) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update document' });
  }
});

/**
 * POST /api/exercise/documents/:docId/retry-extraction
 * Reset extraction state and re-trigger LLM extraction for a single document.
 * Useful for retrying failed extractions or re-extracting after tag changes.
 *
 * Flow:
 * 1. If textContent is empty, attempt re-parse from stored file_data
 * 2. If re-parse succeeds → standard text extraction
 * 3. If re-parse still produces no text AND it's a PDF → vision extraction
 *    (Claude native PDF document block, with truncation for oversized files)
 * 4. If no file_data stored → error
 */
exerciseRouter.post('/documents/:docId/retry-extraction', async (req: Request, res: Response) => {
  try {
    const doc = await documentStore.findById(req.params.docId as string, req.visibleTeams);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Build tags early — needed for both vision and standard extraction paths
    const tags = {
      team: doc.team as 'blue' | 'red' | 'controller',
      exercisePhase: doc.exercisePhase,
      documentType: doc.documentType as import('../exercise/types.js').ScenarioDocument['documentType'],
      confidence: 1.0,
    };

    // Reset extraction state
    await documentStore.updateExtraction(doc.id, {}, 0);

    let textContent = doc.textContent;

    // If textContent is empty, try to re-parse from stored file_data
    if (!textContent || textContent.trim().length === 0) {
      const fileData = await documentStore.getFileData(doc.id);
      if (!fileData) {
        res.status(422).json({
          error: 'No stored file data — delete and re-upload this document to retry extraction',
        });
        return;
      }

      try {
        const documentParser = new DocumentParser();
        const parsed = await documentParser.parse(fileData, doc.mimeType);
        textContent = parsed.text;
        if (textContent && textContent.trim().length > 0) {
          await documentStore.updateTextContent(doc.id, textContent);
          console.log(`[exercise] Re-parsed ${doc.filename}: ${textContent.length} chars`);
        }
      } catch (parseErr) {
        console.warn(`[exercise] Re-parse failed for ${doc.filename}:`, parseErr);
      }

      // ── Vision fallback for PDFs that produce no text ──────────────────────
      // Scanned/image-based PDFs return empty text from unpdf. Route these to
      // Claude vision extraction regardless of document type.
      if ((!textContent || textContent.trim().length === 0) && doc.mimeType === 'application/pdf') {
        setImmediate(async () => {
          try {
            const extractionService = await getExtractionService();
            await extractionService.extractWithVision(doc.id, fileData, tags);
            console.log(`[exercise] Vision extraction complete for ${doc.id}`);
          } catch (err) {
            console.error(`[exercise] Vision extraction failed for ${doc.id}:`, err);
          }
        });

        res.json({ message: 'Vision extraction triggered (scanned PDF detected)', docId: doc.id });
        return;
      }
    }

    // ── Standard text extraction path ────────────────────────────────────────
    setImmediate(() => {
      getExtractionService()
        .then((extractionService) =>
          extractionService.extractDocument(doc.id, textContent, tags, doc.mimeType)
        )
        .catch((err) => {
          console.error(`[exercise] Retry extraction failed for ${doc.id}:`, err);
        });
    });

    res.json({ message: 'Extraction re-triggered', docId: doc.id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to retry extraction' });
  }
});

/**
 * DELETE /api/exercise/documents/:docId
 * Delete a document.
 */
exerciseRouter.delete('/documents/:docId', async (req: Request, res: Response) => {
  try {
    await documentStore.delete(req.params.docId as string);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete document' });
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

    const ipbService = await getIPBService();
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

    const ipbService = await getIPBService();
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

    const ipbService = await getIPBService();
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
    const scoringService = await getCOAScoringService();
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

    const scoringService = await getCOAScoringService();
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

    const scoringService = await getCOAScoringService();
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

    const scoringService = await getCOAScoringService();
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

    const generator = await getOrderGenerator();
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

// ============ STAFF PRODUCT ROUTES ============

/**
 * GET /api/exercise/scenarios/:id/staff-products
 * List staff products. Query param `roleKey` filters to a specific role;
 * omit to return all products for the scenario.
 *
 * Seed-on-first-access: when `roleKey` is provided, triggers idempotent
 * workspace seeding before returning results. If the workspace already has
 * products the seed is a no-op (returns existing). This implements the
 * RESEARCH.md recommendation: "Trigger on first GET to the workspace endpoint."
 */
exerciseRouter.get('/scenarios/:id/staff-products', async (req: Request, res: Response) => {
  try {
    const roleKey = qstr(req.query.roleKey);
    const scenarioId = req.params.id as string;

    if (roleKey) {
      // Seed-on-first-access: idempotent — returns existing if already seeded
      await staffProductStore.seedRoleWorkspace(scenarioId, roleKey);
    }

    const products = roleKey
      ? await staffProductStore.findByRole(scenarioId, roleKey)
      : await staffProductStore.findByScenario(scenarioId);

    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list staff products' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/staff-products/:productId
 * Get a single staff product by ID.
 */
exerciseRouter.get('/scenarios/:id/staff-products/:productId', async (req: Request, res: Response) => {
  try {
    const product = await staffProductStore.findById(req.params.productId as string);
    if (!product || product.scenarioId !== req.params.id) {
      res.status(404).json({ error: 'Staff product not found' });
      return;
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get staff product' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/staff-products
 * Create a new staff product (starts as draft).
 * Body: { roleKey, productType, title, structured?, content? }
 */
exerciseRouter.post('/scenarios/:id/staff-products', async (req: Request, res: Response) => {
  try {
    const { roleKey, productType, title, structured, content } = req.body as {
      roleKey?: string;
      productType?: string;
      title?: string;
      structured?: Record<string, unknown>;
      content?: string;
    };

    if (!roleKey || !productType || !title) {
      res.status(400).json({ error: 'roleKey, productType, and title are required' });
      return;
    }

    const product = await staffProductStore.create({
      scenarioId: req.params.id as string,
      roleKey,
      productType,
      title,
      structured,
      content,
      createdBy: (req.headers['x-did'] as string) || 'anonymous',
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create staff product' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id/staff-products/:productId
 * Update a draft staff product's content.
 * Body: { title?, structured?, content? }
 */
exerciseRouter.put('/scenarios/:id/staff-products/:productId', async (req: Request, res: Response) => {
  try {
    const { title, structured, content } = req.body as {
      title?: string;
      structured?: Record<string, unknown>;
      content?: string;
    };

    const updated = await staffProductStore.update(req.params.productId as string, { title, structured, content });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update staff product' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/staff-products/:productId/publish
 * Publish a product and trigger the notification pipeline.
 * Requires enabled_roles from the scenario to fan out notifications.
 */
exerciseRouter.post('/scenarios/:id/staff-products/:productId/publish', async (req: Request, res: Response) => {
  try {
    const scenarioId = req.params.id as string;
    const productId = req.params.productId as string;
    const publishedBy = (req.headers['x-did'] as string) || 'anonymous';

    // Fetch scenario to get enabledRoles for notification fan-out
    const scenario = await scenarioStore.findById(scenarioId);
    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }

    await staffNotificationService.publishProduct(productId, publishedBy, scenario.enabledRoles);

    // Return the updated product
    const product = await staffProductStore.findById(productId);
    res.json(product);

    if (!product) return;

    // Auto-trigger: upstream publish fires all other AI-assigned roles (non-blocking)
    const publishingRoleKey = product.roleKey;
    setImmediate(async () => {
      try {
        const aiRoles = Object.entries(scenario.roleAssignments ?? {})
          .filter(([key, mode]) => mode === 'ai' && key !== publishingRoleKey)
          .map(([roleKey]) => roleKey);
        if (aiRoles.length === 0) return;
        const { triggerRouter } = await getAIWorkspace();
        for (const roleKey of aiRoles) {
          await triggerRouter.trigger(scenarioId, roleKey, {
            triggerType: 'upstream_publish',
            payload: {
              publishedRoleKey: publishingRoleKey,
              productId: product.id,
              productType: product.productType,
            },
          });
        }
      } catch (err) {
        console.error('[staff-products-publish] upstream_publish auto-trigger failed:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish staff product' });
  }
});

/**
 * DELETE /api/exercise/scenarios/:id/staff-products/:productId
 * Delete a staff product (cascades notifications).
 */
exerciseRouter.delete('/scenarios/:id/staff-products/:productId', async (req: Request, res: Response) => {
  try {
    await staffProductStore.delete(req.params.productId as string);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete staff product' });
  }
});

// ============ STAFF NOTIFICATION ROUTES ============

/**
 * GET /api/exercise/scenarios/:id/staff-notifications
 * Get notifications. Query params:
 * - roleKey: filter to a specific target role
 * - unreadOnly: 'true' to return only unread notifications
 */
exerciseRouter.get('/scenarios/:id/staff-notifications', async (req: Request, res: Response) => {
  try {
    const scenarioId = req.params.id as string;
    const roleKey = qstr(req.query.roleKey);
    const unreadOnly = req.query.unreadOnly === 'true';

    let notifications;
    if (roleKey) {
      notifications = await staffNotificationService.getNotifications(scenarioId, roleKey);
    } else {
      notifications = await staffNotificationService.getAllNotifications(scenarioId);
    }

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list notifications' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/staff-notifications/count
 * Get unread notification count. Query param `roleKey` is required.
 */
exerciseRouter.get('/scenarios/:id/staff-notifications/count', async (req: Request, res: Response) => {
  try {
    const roleKey = qstr(req.query.roleKey);
    if (!roleKey) {
      res.status(400).json({ error: 'roleKey is required' });
      return;
    }

    const count = await staffNotificationService.getUnreadCount(req.params.id as string, roleKey);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get notification count' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id/staff-notifications/:notificationId/read
 * Mark a notification as read.
 */
exerciseRouter.put('/scenarios/:id/staff-notifications/:notificationId/read', async (req: Request, res: Response) => {
  try {
    await staffNotificationService.markRead(req.params.notificationId as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id/staff-notifications/:notificationId/integrate
 * Mark a notification as integrated (acknowledged by the receiving role).
 */
exerciseRouter.put('/scenarios/:id/staff-notifications/:notificationId/integrate', async (req: Request, res: Response) => {
  try {
    await staffNotificationService.markIntegrated(req.params.notificationId as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to mark notification as integrated' });
  }
});

// ============ STRATEGIC IMPORT ROUTE ============

/**
 * POST /api/exercise/scenarios/:id/import-strategic-direction
 * Import strategic objectives and commander's intent from the Design tab
 * into the Commander workspace as a strategic_guidance product.
 */
exerciseRouter.post('/scenarios/:id/import-strategic-direction', async (req: Request, res: Response) => {
  try {
    const importedBy = (req.headers['x-did'] as string) || 'anonymous';
    const product = await strategicImportService.importToCommanderWorkspace(
      req.params.id as string,
      importedBy
    );
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import strategic direction' });
  }
});

// ============ ENABLED ROLES ROUTES ============

/**
 * PUT /api/exercise/scenarios/:id/enabled-roles
 * Update the enabled staff roles for a scenario.
 * Body: { enabledRoles: string[] }
 */
exerciseRouter.put('/scenarios/:id/enabled-roles', async (req: Request, res: Response) => {
  try {
    const { enabledRoles } = req.body as { enabledRoles?: string[] };

    if (!enabledRoles || !Array.isArray(enabledRoles)) {
      res.status(400).json({ error: 'enabledRoles array is required' });
      return;
    }

    const updated = await scenarioStore.update(req.params.id as string, { enabledRoles });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update enabled roles' });
  }
});

// ============ AGENT TEAM CONFIG ROUTES ============

/**
 * GET /api/exercise/scenarios/:id/agent-team-config
 * Get agent team configs for a scenario. Query param `roleKey` filters to one role.
 */
exerciseRouter.get('/scenarios/:id/agent-team-config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const scenarioId = req.params.id as string;
    const roleKey = qstr(req.query.roleKey);

    const query = roleKey
      ? 'SELECT * FROM agent_team_config WHERE scenario_id = $1 AND role_key = $2 ORDER BY role_key, product_type'
      : 'SELECT * FROM agent_team_config WHERE scenario_id = $1 ORDER BY role_key, product_type';

    const params = roleKey ? [scenarioId, roleKey] : [scenarioId];
    const result = await pool.query(query, params);

    const configs: AgentTeamConfig[] = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      scenarioId: row.scenario_id as string,
      roleKey: row.role_key as string,
      productType: (row.product_type as string | null) ?? null,
      agentTeamId: row.agent_team_id as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }));

    res.json({ configs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get agent team config' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id/agent-team-config
 * Upsert an agent team config for a role (optionally scoped to a product type).
 * Body: { roleKey, productType?: string, agentTeamId }
 */
exerciseRouter.put('/scenarios/:id/agent-team-config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const scenarioId = req.params.id as string;
    const { roleKey, productType, agentTeamId } = req.body as {
      roleKey?: string;
      productType?: string;
      agentTeamId?: string;
    };

    if (!roleKey || !agentTeamId) {
      res.status(400).json({ error: 'roleKey and agentTeamId are required' });
      return;
    }

    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO agent_team_config
         (id, scenario_id, role_key, product_type, agent_team_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (scenario_id, role_key, product_type)
       DO UPDATE SET agent_team_id = EXCLUDED.agent_team_id, updated_at = NOW()
       RETURNING *`,
      [id, scenarioId, roleKey, productType ?? null, agentTeamId]
    );

    const row = result.rows[0] as Record<string, unknown>;
    const config: AgentTeamConfig = {
      id: row.id as string,
      scenarioId: row.scenario_id as string,
      roleKey: row.role_key as string,
      productType: (row.product_type as string | null) ?? null,
      agentTeamId: row.agent_team_id as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upsert agent team config' });
  }
});

/**
 * DELETE /api/exercise/scenarios/:id/agent-team-config/:configId
 * Remove an agent team config entry (reverts to role default).
 */
exerciseRouter.delete('/scenarios/:id/agent-team-config/:configId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    await pool.query(
      'DELETE FROM agent_team_config WHERE id = $1 AND scenario_id = $2',
      [req.params.configId as string, req.params.id as string]
    );
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete agent team config' });
  }
});

// ============ AI WORKSPACE ROUTES ============

/**
 * GET /api/exercise/scenarios/:id/role-assignments
 * Returns current roleAssignments map for the scenario.
 */
exerciseRouter.get('/scenarios/:id/role-assignments', async (req: Request, res: Response) => {
  try {
    const scenario = await scenarioStore.findById(req.params.id as string);
    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }
    res.json({ roleAssignments: scenario.roleAssignments ?? {} });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get role assignments' });
  }
});

/**
 * PUT /api/exercise/scenarios/:id/role-assignments
 * Body: { roleAssignments: Record<string, 'human' | 'ai' | 'disabled'> }
 */
exerciseRouter.put('/scenarios/:id/role-assignments', async (req: Request, res: Response) => {
  try {
    const { roleAssignments } = req.body as { roleAssignments?: Record<string, string> };
    if (!roleAssignments || typeof roleAssignments !== 'object') {
      res.status(400).json({ error: 'roleAssignments object required' });
      return;
    }
    const updated = await scenarioStore.updateRoleAssignments(
      req.params.id as string,
      roleAssignments as Record<string, import('../exercise/types.js').RoleAssignment>
    );
    res.json({ roleAssignments: updated.roleAssignments });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update role assignments' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/roles/:roleKey/runs
 * Manual trigger — queues an AI execution run via TriggerRouter.
 */
exerciseRouter.post('/scenarios/:id/roles/:roleKey/runs', async (req: Request, res: Response) => {
  try {
    const scenarioId = req.params.id as string;
    const roleKey = req.params.roleKey as string;
    const { triggerRouter } = await getAIWorkspace();
    await triggerRouter.trigger(scenarioId, roleKey, {
      triggerType: 'manual',
      payload: (req.body as Record<string, unknown>) ?? {},
    });
    res.status(202).json({ status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to trigger AI run' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/roles/:roleKey/runs
 * List all AI runs for a role within a scenario.
 */
exerciseRouter.get('/scenarios/:id/roles/:roleKey/runs', async (req: Request, res: Response) => {
  try {
    const { aiRunStore } = await getAIWorkspace();
    const runs = await aiRunStore.findByScenarioAndRole(
      req.params.id as string,
      req.params.roleKey as string
    );
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list AI runs' });
  }
});

/**
 * PATCH /api/exercise/scenarios/:id/roles/:roleKey/runs/:runId/pause
 * Pause an in-flight AI run.
 */
exerciseRouter.patch('/scenarios/:id/roles/:roleKey/runs/:runId/pause', async (req: Request, res: Response) => {
  try {
    const { agentRunner } = await getAIWorkspace();
    await agentRunner.pause(req.params.runId as string);
    res.json({ status: 'paused' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to pause AI run' });
  }
});

/**
 * PATCH /api/exercise/scenarios/:id/roles/:roleKey/runs/:runId/resume
 * Resume a paused AI run.
 */
exerciseRouter.patch('/scenarios/:id/roles/:roleKey/runs/:runId/resume', async (req: Request, res: Response) => {
  try {
    const { agentRunner } = await getAIWorkspace();
    await agentRunner.resume(req.params.runId as string);
    res.json({ status: 'resumed' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resume AI run' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/roles/:roleKey/runs/:runId/review
 * Body: ReviewFeedback { action, notes?, annotations?, edits? }
 * Resumes the interrupted LangGraph graph with human review feedback.
 */
exerciseRouter.post('/scenarios/:id/roles/:roleKey/runs/:runId/review', async (req: Request, res: Response) => {
  try {
    const feedback = req.body as ReviewFeedback;
    if (!feedback?.action) {
      res.status(400).json({ error: 'action required' });
      return;
    }
    const { agentRunner } = await getAIWorkspace();
    await agentRunner.resume(req.params.runId as string, feedback as unknown as Record<string, unknown>);
    res.json({ status: 'resumed' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit review' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/roles/:roleKey/channel
 * SSE stream — backfills existing events then streams new ones via pg LISTEN.
 */
exerciseRouter.get('/scenarios/:id/roles/:roleKey/channel', async (req: Request, res: Response) => {
  const scenarioId = req.params.id as string;
  const roleKey = req.params.roleKey as string;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const { aiChannelStore } = await getAIWorkspace();

    // Backfill: send existing events
    const existing = await aiChannelStore.findByRole(scenarioId, roleKey, 100);
    for (const event of existing) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Subscribe to new events via pg LISTEN
    const pool = getPool();
    const pgClient = await pool.connect();
    try {
      await pgClient.query(`LISTEN "channel:${scenarioId}:${roleKey}"`);
      pgClient.on('notification', (msg) => {
        if (msg.payload) {
          res.write(`data: ${msg.payload}\n\n`);
        }
      });
    } catch (_err) {
      pgClient.release();
      res.end();
      return;
    }

    req.on('close', () => {
      pgClient.query(`UNLISTEN "channel:${scenarioId}:${roleKey}"`).finally(() => pgClient.release());
      res.end();
    });
  } catch (_error) {
    res.write(`data: ${JSON.stringify({ error: 'Channel initialization failed' })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/exercise/scenarios/:id/roles/:roleKey/agents
 * List default agents for a role (from agent library).
 */
exerciseRouter.get('/scenarios/:id/roles/:roleKey/agents', async (req: Request, res: Response) => {
  try {
    const agents = getDefaultAgentsForRole(req.params.roleKey as string);
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get agents' });
  }
});

/**
 * GET /api/exercise/scenarios/:id/staff-products/:productId/versions
 * Returns version history for a specific staff product.
 */
exerciseRouter.get('/scenarios/:id/staff-products/:productId/versions', async (req: Request, res: Response) => {
  try {
    const { productVersionStore } = await getAIWorkspace();
    const versions = await productVersionStore.findByProduct(req.params.productId as string);
    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get product versions' });
  }
});

/**
 * POST /api/exercise/scenarios/:id/roles/commander/directives
 * Save a commander directive product and trigger all other AI-assigned roles.
 * Body: { productType: string, title: string, content?: string, structured?: Record<string, unknown> }
 */
exerciseRouter.post('/scenarios/:id/roles/commander/directives', async (req: Request, res: Response) => {
  try {
    const scenarioId = req.params.id as string;
    const createdBy = (req.headers['x-did'] as string) || 'anonymous';
    const { productType, title, content, structured } = req.body as {
      productType?: string;
      title?: string;
      content?: string;
      structured?: Record<string, unknown>;
    };

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    // Create the commander directive product
    const savedProduct = await staffProductStore.create({
      scenarioId,
      roleKey: 'commander',
      productType: productType ?? 'commander_directive',
      title,
      structured: structured ?? {},
      content: content ?? '',
      createdBy,
    });

    res.status(201).json(savedProduct);

    // Auto-trigger: commander_directive fires all other AI-assigned roles (non-blocking)
    setImmediate(async () => {
      try {
        const scenario = await scenarioStore.findById(scenarioId);
        if (!scenario) return;
        const aiRoles = Object.entries(scenario.roleAssignments ?? {})
          .filter(([key, mode]) => mode === 'ai' && key !== 'commander')
          .map(([roleKey]) => roleKey);
        if (aiRoles.length === 0) return;
        const { triggerRouter } = await getAIWorkspace();
        for (const roleKey of aiRoles) {
          await triggerRouter.trigger(scenarioId, roleKey, {
            triggerType: 'commander_directive',
            payload: {
              directiveProductId: savedProduct.id,
              directiveType: savedProduct.productType,
            },
          });
        }
      } catch (err) {
        console.error('[commander-directives] commander_directive auto-trigger failed:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create commander directive' });
  }
});

// ============ AI SUGGESTION ROUTE ============

/**
 * POST /api/exercise/scenarios/:id/staff-products/:productId/suggest
 *
 * Generate AI-assisted suggestion blocks for a staff product.
 *
 * Resolution chain for agent team (LLM config):
 *   1. agent_team_config with matching (scenarioId, roleKey, productType) — product override
 *   2. agent_team_config with matching (scenarioId, roleKey, NULL productType) — role default
 *   3. STAFF_ROLE_CONFIG[roleKey].agentTeamId — static role default (currently null for all)
 *   4. Admin-configured LLM from configService (system default)
 *
 * Returns: { blocks: Array<{ id, type, fieldName?, content, status: 'pending' }> }
 */
exerciseRouter.post('/scenarios/:id/staff-products/:productId/suggest', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const scenarioId = req.params.id as string;
    const productId = req.params.productId as string;

    // 1. Load the staff product
    const product = await staffProductStore.findById(productId);
    if (!product || product.scenarioId !== scenarioId) {
      res.status(404).json({ error: 'Staff product not found' });
      return;
    }

    const { roleKey, productType, structured, content } = product;

    // 2. Resolve agent team config (fallback chain)
    const configResult = await pool.query(
      `SELECT agent_team_id FROM agent_team_config
       WHERE scenario_id = $1 AND role_key = $2
       ORDER BY (product_type = $3) DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [scenarioId, roleKey, productType]
    );

    // For now, agent team config maps to LLM config — use system LLM
    // (In a fuller implementation, each agent team ID would map to a specific LLM profile)
    const llmConfig = await getLLMConfig();
    const llm = new OpenAICompatibleProvider(llmConfig);

    // 3. Build role-specific system prompt
    const roleConfig = STAFF_ROLE_CONFIG[roleKey];
    const productTypeDef = PRODUCT_TYPE_REGISTRY[productType];
    const agentTeamId = (configResult.rows[0] as { agent_team_id: string } | undefined)?.agent_team_id ?? null;

    const systemPrompt = `You are an AI staff assistant supporting the ${roleConfig?.label ?? roleKey} role in a Joint Planning Process (JPP) exercise.

Your doctrinal focus: ${roleConfig?.doctrinalFocus ?? 'Staff planning and coordination'}
Product type: ${productTypeDef?.label ?? productType}
${agentTeamId ? `Agent team: ${agentTeamId}` : ''}

Generate concise, actionable suggestions for the staff officer completing this product.
Break your response into clearly separated blocks — one per structured field that needs content,
plus a narrative block if the overall narrative content can be improved.

Output your response as a JSON object with this exact shape:
{
  "blocks": [
    {
      "id": "unique-string-id",
      "type": "structured_field",
      "fieldName": "fieldNameHere",
      "content": "suggested content for this field"
    },
    {
      "id": "unique-string-id",
      "type": "narrative",
      "content": "suggested narrative paragraph(s)"
    }
  ]
}

Output ONLY the JSON object — no markdown fences, no preamble, no explanation.`;

    // 4. Build user prompt with current product state
    const structuredFields = productTypeDef?.structuredFields ?? [];
    const structuredSummary = structuredFields.length > 0
      ? structuredFields.map((f) => `  ${f.name}: ${JSON.stringify((structured as Record<string, unknown>)[f.name] ?? '(empty)')}`).join('\n')
      : '  (no structured fields defined)';

    const userPrompt = `Current product state for "${product.title}":

Structured fields:
${structuredSummary}

Current narrative content:
${content?.trim() || '(empty — no narrative written yet)'}

Generate suggestions to improve or complete this product. Focus on the most important gaps.`;

    // 5. Call LLM
    const response = await llm.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.4,
    });

    // 6. Parse response into suggestion blocks
    let blocks: Array<{
      id: string;
      type: 'structured_field' | 'narrative';
      fieldName?: string;
      content: string;
      status: 'pending';
    }>;

    try {
      const raw = response.content ?? '{"blocks":[]}';
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleaned) as { blocks?: unknown[] };
      const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];

      const { randomUUID } = await import('crypto');
      blocks = rawBlocks.map((b) => {
        const block = b as Record<string, unknown>;
        return {
          id: (typeof block.id === 'string' && block.id) ? block.id : randomUUID(),
          type: block.type === 'structured_field' ? 'structured_field' : 'narrative',
          fieldName: typeof block.fieldName === 'string' ? block.fieldName : undefined,
          content: typeof block.content === 'string' ? block.content : String(block.content ?? ''),
          status: 'pending' as const,
        };
      });
    } catch (parseErr) {
      // LLM returned non-JSON — wrap entire response as a single narrative block
      console.warn('[suggest] LLM response was not valid JSON, wrapping as narrative:', parseErr);
      const { randomUUID } = await import('crypto');
      blocks = [{
        id: randomUUID(),
        type: 'narrative',
        content: response.content ?? '(no suggestion generated)',
        status: 'pending',
      }];
    }

    res.json({ blocks });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate suggestion' });
  }
});

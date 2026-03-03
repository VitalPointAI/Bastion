/**
 * Strategic Planning API
 * Document ingestion, objective extraction, workflow, and risk assessment endpoints
 */

import express from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/auth-instance.js';
import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import {
  DocumentStore,
  initStrategicDocumentsTable,
} from '../strategic/ingestion/document-store.js';
import { uploadToIPFS } from '../lib/ipfs.js';
import { encryptData, generateEncryptionKey } from '../lib/encryption.js';
import type {
  StrategicDocumentLevel,
  ClassificationLevel,
  DocumentUploadResponse,
} from '../strategic/ingestion/types.js';
import { ObjectiveStore, objectiveStore, initStrategicObjectivesTable } from '../strategic/objectives/index.js';
import type { ObjectiveInput, ObjectiveUpdate } from '../strategic/objectives/index.js';
import { ExtractionService } from '../strategic/extraction/index.js';
import type { ExtractedObjective, ExtractionProgress } from '../strategic/extraction/index.js';
import { WorkflowEngine, workflowEngine } from '../strategic/workflows/index.js';
import type { ApprovalEvent } from '../strategic/workflows/index.js';
import {
  getRiskAssessmentService,
  riskAssessmentStore,
  calculateRiskLevel,
  initRiskAssessmentTable,
} from '../strategic/assessment/index.js';
import type { RiskAssessment, Likelihood, Impact } from '../strategic/assessment/index.js';
import type { StrategicObjective } from '../strategic/schemas/strategic-objective.js';
import type { DIMEInstrument } from '../strategic/schemas/dime.js';
import { dimeToMidlife } from '../strategic/schemas/dime.js';
import { IntentStore, intentStore } from '../strategic/intent/index.js';
import { configService } from '../strategic/config/service.js';
import type { ProviderConfig } from '../strategic/extraction/providers/types.js';
import type { IntentInput, IntentUpdate } from '../strategic/intent/index.js';
import { getStrategyReviewerExecutor } from '../strategic/agents/strategy-reviewer-executor.js';
import { reviewStore } from '../strategic/reviews/store.js';
import type { ReviewStatus } from '../strategic/reviews/types.js';
import { assignmentStore } from '../strategic/assignments/index.js';
import type { AssignmentInput } from '../strategic/assignments/index.js';
import { triggerAutoReview } from '../strategic/extraction/auto-review-hook.js';
import { executeStrategyReview } from '../agents/langgraph/graphs/strategy-reviewer-graph.js';
import { getReviewCheckpointManager } from '../agents/langgraph/graphs/strategy-reviewer-checkpoint.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Initialize document parser and store
const parser = new DocumentParser();
const store = new DocumentStore();
const objectives = objectiveStore;

// Initialize tables on first request (lazy init)
let tableInitialized = false;
async function ensureTableExists(): Promise<void> {
  if (!tableInitialized) {
    await initStrategicDocumentsTable();
    await initStrategicObjectivesTable();
    await initRiskAssessmentTable();
    await workflowEngine.initialize();
    tableInitialized = true;
  }
}

/**
 * Infer MIME type from file extension
 * Used as fallback when client sends application/octet-stream
 */
function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();
  const extensionMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
  };
  return ext ? extensionMap[ext] || null : null;
}

// Configure multer for file uploads
// 50MB limit, only accept PDF and Office documents
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ];

    // Direct MIME type check
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    // Fallback: check extension when MIME is octet-stream or empty
    // This handles clients (like curl) that don't detect MIME types properly
    if (file.mimetype === 'application/octet-stream' || !file.mimetype) {
      const inferredMime = getMimeTypeFromExtension(file.originalname);
      if (inferredMime && allowedTypes.includes(inferredMime)) {
        // Override the mimetype for downstream processing
        file.mimetype = inferredMime;
        cb(null, true);
        return;
      }
    }

    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, DOC, PPTX, PPT`
      )
    );
  },
});

/**
 * Build DID from NEAR account ID
 */
function buildDID(nearAccountId: string): string {
  return `did:near:${nearAccountId}`;
}

/**
 * POST /api/strategic/documents - Upload a strategic document
 *
 * Body (multipart/form-data):
 * - document: File (PDF, DOCX, DOC, PPTX, PPT)
 * - title: string
 * - level: StrategicDocumentLevel (optional, default: 'OTHER')
 * - classification: ClassificationLevel (optional, default: 'UNCLASSIFIED')
 * - backupToIPFS: boolean (optional, default: false)
 */
router.post('/documents', requireAuth, upload.single('document'), async (req, res) => {
  try {
    await ensureTableExists();

    // Get user DID from authenticated session
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Get uploaded file
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    // Parse request body
    const {
      title = file.originalname,
      level = 'OTHER',
      classification = 'UNCLASSIFIED',
      backupToIPFS = false,
    } = req.body;

    // Validate level
    const validLevels: StrategicDocumentLevel[] = [
      'NSS',
      'NDS',
      'NMS',
      'GEF',
      'JSCP',
      'CAMPAIGN_PLAN',
      'OTHER',
    ];
    if (!validLevels.includes(level as StrategicDocumentLevel)) {
      return res.status(400).json({
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    // Validate classification
    const validClassifications: ClassificationLevel[] = [
      'UNCLASSIFIED',
      'CONFIDENTIAL',
      'SECRET',
      'TOP_SECRET',
    ];
    if (!validClassifications.includes(classification as ClassificationLevel)) {
      return res.status(400).json({
        error: `Invalid classification. Must be one of: ${validClassifications.join(', ')}`,
      });
    }

    console.log(
      `Processing document upload: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`
    );

    // Parse document
    const content = await parser.parse(file.buffer, file.mimetype);

    console.log(
      `Parsed document: ${content.pageCount || 'N/A'} pages, ${content.text.length} chars`
    );

    // Optional: Backup encrypted file to IPFS
    let ipfsCid: string | undefined;
    if (backupToIPFS === 'true' || backupToIPFS === true) {
      try {
        // Encrypt the original file
        const encryptionKey = await generateEncryptionKey();
        const { encrypted } = await encryptData(file.buffer, encryptionKey);

        // Upload encrypted file to IPFS
        const encryptedBuffer = Buffer.from(encrypted, 'base64');
        const { cid } = await uploadToIPFS(
          encryptedBuffer,
          `${file.originalname}.encrypted`
        );
        ipfsCid = cid;

        console.log(`Backed up to IPFS: ${cid}`);
      } catch (ipfsError) {
        // Log but don't fail the upload
        console.error('IPFS backup failed (non-fatal):', ipfsError);
      }
    }

    // Store in PostgreSQL
    const documentId = await store.store({
      title: title as string,
      level: level as StrategicDocumentLevel,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      pageCount: content.pageCount,
      textContent: content.text,
      classification: classification as ClassificationLevel,
      ipfsCid,
      createdBy: userDID,
    });

    console.log(`✓ Strategic document stored: ${documentId}`);

    const response: DocumentUploadResponse = {
      documentId,
      title: title as string,
      pageCount: content.pageCount,
      textLength: content.text.length,
    };

    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Document upload failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents - List user's strategic documents
 *
 * Query params:
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 */
router.get('/documents', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    // Get user DID from authenticated session
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const documents = await store.list(userDID, limit, offset);

    res.json({
      documents,
      count: documents.length,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List documents failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:id - Get document by ID
 */
router.get('/documents/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID from authenticated session
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check ownership (or admin role in future)
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return document without full text content (use /text endpoint for that)
    const { textContent, ...metadata } = document;

    res.json({
      ...metadata,
      hasText: textContent.length > 0,
      textPreview: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:id/text - Get document text content
 *
 * Query params:
 * - chunk: number (optional) - return specific chunk index
 * - chunkSize: number (optional, default: 8000) - chunk size for splitting
 */
router.get('/documents/:id/text', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID from authenticated session
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // First verify ownership
    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get text content
    const text = await store.getText(documentId);

    if (text === null) {
      return res.status(404).json({ error: 'Document text not found' });
    }

    // Check if chunking is requested
    const chunkIndex = req.query.chunk !== undefined
      ? parseInt(req.query.chunk as string)
      : undefined;
    const chunkSize = parseInt(req.query.chunkSize as string) || 8000;

    if (chunkIndex !== undefined) {
      // Return specific chunk
      const chunks = parser.chunkDocument(text, chunkSize);

      if (chunkIndex < 0 || chunkIndex >= chunks.length) {
        return res.status(400).json({
          error: `Invalid chunk index. Document has ${chunks.length} chunks (0-${chunks.length - 1})`,
        });
      }

      res.json({
        documentId,
        chunkIndex,
        totalChunks: chunks.length,
        chunkSize,
        text: chunks[chunkIndex],
      });
    } else {
      // Return full text with chunk metadata
      const chunks = parser.chunkDocument(text, chunkSize);

      res.json({
        documentId,
        totalChunks: chunks.length,
        textLength: text.length,
        text,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document text failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/strategic/documents/:id - Delete a document
 */
router.delete('/documents/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID from authenticated session
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify ownership
    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await store.delete(documentId);

    res.json({ deleted: true, documentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete document failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// OBJECTIVE ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/documents/:documentId/extract - Extract objectives from document
 */
router.post('/documents/:documentId/extract', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists and user owns it
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get document text
    const text = await store.getText(documentId);
    if (!text) {
      return res.status(400).json({ error: 'Document has no text content' });
    }

    console.log(`Extracting objectives from document ${documentId}...`);

    // Get admin-configured LLM provider
    const llmConfig = await configService.getLLMConfig();

    // Map admin config to provider config format
    // Note: 'local' in admin config maps to 'ollama' in provider types
    const providerType = llmConfig.provider === 'local' ? 'ollama' : llmConfig.provider;
    const providerConfig: ProviderConfig = {
      type: providerType as ProviderConfig['type'],
      model: llmConfig.models.extraction,
      apiKey: llmConfig.apiKey || undefined,
      baseUrl: llmConfig.baseUrl,
    };

    // Extract objectives using configured LLM provider
    const extractor = new ExtractionService({ provider: providerConfig });
    const result = await extractor.extractFromDocument(text);

    // Convert extracted objectives to ObjectiveInput format and save
    const inputs: ObjectiveInput[] = result.objectives.map((obj: ExtractedObjective) => {
      // Get MIDLIFE category from extraction or derive from DIME
      const midlifeCategory = obj.midlifeCategory || dimeToMidlife(obj.dimeCategory as DIMEInstrument);
      const midlifeConfidence = obj.midlifeConfidence ?? result.extractionConfidence;

      return {
        documentId,
        sourceReference: obj.sourceReference,
        description: obj.description,
        endsWaysMeans: {
          ends: obj.ends,
          ways: obj.ways,
          means: obj.means,
        },
        primaryInstrument: obj.dimeCategory as DIMEInstrument,
        supportingInstruments: (obj.supportingDIME || []) as DIMEInstrument[],
        midlifeCategory,
        midlifeCategorizedBy: 'AI' as const,
        midlifeConfidence,
        constraints: obj.constraints,
        assumptions: obj.assumptions,
        risks: obj.risks || [],
        priority: obj.priority,
        extractedBy: 'AI' as const,
        extractionConfidence: result.extractionConfidence,
        createdBy: userDID,
      };
    });

    const savedIds = await objectives.saveObjectives(inputs);

    console.log(`✓ Extracted ${savedIds.length} objectives from document ${documentId}`);

    // Trigger auto-review if configured (non-blocking)
    triggerAutoReview(documentId).then((autoReviewResult) => {
      if (autoReviewResult.triggered) {
        console.log(`✓ Auto-review triggered: ${autoReviewResult.reviewId}`);
      }
    }).catch((err) => {
      console.error('Auto-review trigger failed:', err);
    });

    res.status(201).json({
      objectiveCount: savedIds.length,
      documentSummary: result.documentSummary,
      extractionConfidence: result.extractionConfidence,
      chunkCount: result.chunkCount,
      objectives: savedIds.map((id, i) => ({
        id,
        description: result.objectives[i].description.substring(0, 100) + '...',
        dimeCategory: result.objectives[i].dimeCategory,
        midlifeCategory: inputs[i].midlifeCategory,
        midlifeConfidence: inputs[i].midlifeConfidence,
        priority: result.objectives[i].priority,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Objective extraction failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:documentId/extract/stream - Extract with SSE progress streaming
 *
 * Uses Server-Sent Events to stream extraction progress to the client.
 * Returns progress updates as each chunk is processed, then final results.
 */
router.get('/documents/:documentId/extract/stream', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists and user owns it
    const document = await store.get(documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Check ownership
    if (document.createdBy !== userDID) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get document text
    const text = await store.getText(documentId);
    if (!text) {
      res.status(400).json({ error: 'Document has no text content' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Helper to send SSE events
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log(`Extracting objectives (streaming) from document ${documentId}...`);

    // Get admin-configured LLM provider
    const llmConfig = await configService.getLLMConfig();

    // Map admin config to provider config format
    const providerType = llmConfig.provider === 'local' ? 'ollama' : llmConfig.provider;
    const providerConfig: ProviderConfig = {
      type: providerType as ProviderConfig['type'],
      model: llmConfig.models.extraction,
      apiKey: llmConfig.apiKey || undefined,
      baseUrl: llmConfig.baseUrl,
    };

    // Extract objectives with progress callback
    const extractor = new ExtractionService({ provider: providerConfig });

    const result = await extractor.extractFromDocument(text, (progress: ExtractionProgress) => {
      sendEvent('progress', progress);
    });

    // Convert extracted objectives to ObjectiveInput format and save
    const inputs: ObjectiveInput[] = result.objectives.map((obj: ExtractedObjective) => {
      // Get MIDLIFE category from extraction or derive from DIME
      const midlifeCategory = obj.midlifeCategory || dimeToMidlife(obj.dimeCategory as DIMEInstrument);
      const midlifeConfidence = obj.midlifeConfidence ?? result.extractionConfidence;

      return {
        documentId,
        sourceReference: obj.sourceReference,
        description: obj.description,
        endsWaysMeans: {
          ends: obj.ends,
          ways: obj.ways,
          means: obj.means,
        },
        primaryInstrument: obj.dimeCategory as DIMEInstrument,
        supportingInstruments: (obj.supportingDIME || []) as DIMEInstrument[],
        midlifeCategory,
        midlifeCategorizedBy: 'AI' as const,
        midlifeConfidence,
        constraints: obj.constraints,
        assumptions: obj.assumptions,
        risks: obj.risks || [],
        priority: obj.priority,
        extractedBy: 'AI' as const,
        extractionConfidence: result.extractionConfidence,
        createdBy: userDID,
      };
    });

    const savedIds = await objectives.saveObjectives(inputs);

    console.log(`✓ Extracted ${savedIds.length} objectives (streaming) from document ${documentId}`);

    // Trigger auto-review if configured (non-blocking)
    triggerAutoReview(documentId).then((autoReviewResult) => {
      if (autoReviewResult.triggered) {
        console.log(`✓ Auto-review triggered: ${autoReviewResult.reviewId}`);
      }
    }).catch((err) => {
      console.error('Auto-review trigger failed:', err);
    });

    // Send final result
    sendEvent('complete', {
      objectiveCount: savedIds.length,
      documentSummary: result.documentSummary,
      extractionConfidence: result.extractionConfidence,
      chunkCount: result.chunkCount,
      objectives: savedIds.map((id, i) => ({
        id,
        description: result.objectives[i].description.substring(0, 100) + '...',
        dimeCategory: result.objectives[i].dimeCategory,
        midlifeCategory: inputs[i].midlifeCategory,
        midlifeConfidence: inputs[i].midlifeConfidence,
        priority: result.objectives[i].priority,
      })),
    });

    // Close the stream
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Streaming extraction failed:', message);

    // Try to send error event if headers not sent
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      // Send error as SSE event
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/strategic/documents/:documentId/objectives - Get objectives for a document
 */
router.get('/documents/:documentId/objectives', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document ownership
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const documentObjectives = await objectives.getObjectivesForDocument(documentId);

    res.json({
      documentId,
      count: documentObjectives.length,
      objectives: documentObjectives,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document objectives failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives - List all objectives with filters
 */
router.get('/objectives', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const userDID = buildDID(req.anonUser!.nearAccountId);

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const instrument = req.query.instrument as string | undefined;

    const result = await objectives.listObjectives({
      status: status as ObjectiveUpdate['status'],
      priority: priority as ObjectiveUpdate['priority'],
      instrument: instrument as DIMEInstrument,
      limit,
      offset,
    });

    res.json({
      objectives: result.objectives,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List objectives failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives/:id - Get single objective
 */
router.get('/objectives/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);

    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    res.json(objective);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get objective failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/strategic/objectives/:id - Update objective
 *
 * Supports MIDLIFE category updates with human override tracking.
 * When midlifeCategory is updated, automatically sets midlifeCategorizedBy to 'HUMAN'.
 */
router.put('/objectives/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const updates: ObjectiveUpdate = req.body;

    // Validate MIDLIFE category if provided
    if (updates.midlifeCategory !== undefined) {
      const validCategories = ['MILITARY', 'INFORMATION', 'DIPLOMATIC', 'LEGAL', 'INTELLIGENCE', 'FINANCIAL', 'ECONOMIC'];
      if (!validCategories.includes(updates.midlifeCategory)) {
        return res.status(400).json({
          error: `Invalid midlifeCategory. Must be one of: ${validCategories.join(', ')}`,
        });
      }

      // Track human override of MIDLIFE categorization
      if (objective.midlifeCategorizedBy === 'AI' || !objective.midlifeCategorizedBy) {
        updates.midlifeCategorizedBy = 'HUMAN';
        // Clear confidence when human overrides (human decisions are definitive)
        updates.midlifeConfidence = 1.0;
      }
    }

    // Mark as human verified if being edited
    updates.humanVerified = true;
    updates.verifiedBy = userDID;

    const updated = await objectives.updateObjective(objectiveId, updates);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update objective' });
    }

    const updatedObjective = await objectives.getObjective(objectiveId);
    res.json(updatedObjective);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update objective failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/strategic/objectives/:id - Delete objective
 */
router.delete('/objectives/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const deleted = await objectives.deleteObjective(objectiveId);

    res.json({ deleted, objectiveId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete objective failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/verify - Mark objective as human-verified
 */
router.post('/objectives/:id/verify', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { verified } = req.body;
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'verified field required (boolean)' });
    }

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    await objectives.updateObjective(objectiveId, {
      humanVerified: verified,
      verifiedBy: verified ? userDID : undefined,
    });

    const updatedObjective = await objectives.getObjective(objectiveId);
    res.json(updatedObjective);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verify objective failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// WORKFLOW ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/objectives/:id/submit - Submit objective for approval
 */
router.post('/objectives/:id/submit', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    if (objective.status !== 'DRAFT') {
      return res.status(400).json({ error: `Cannot submit objective with status ${objective.status}` });
    }

    const { reviewers } = req.body;
    if (!Array.isArray(reviewers) || reviewers.length === 0) {
      return res.status(400).json({ error: 'reviewers array required' });
    }

    // Update objective status
    await objectives.updateObjective(objectiveId, { status: 'SUBMITTED' });

    // Send SUBMIT event to workflow
    const event: ApprovalEvent = {
      type: 'SUBMIT',
      objectiveId,
      documentId: objective.documentId,
      submittedBy: userDID,
      reviewers,
      riskLevel: 'MEDIUM', // Default, updated after risk assessment
    };

    const status = await workflowEngine.sendEvent(objectiveId, event, userDID);

    res.json({
      objectiveId,
      workflowStatus: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Submit objective failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/review - Submit review decision
 */
router.post('/objectives/:id/review', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const { decision, comment } = req.body;
    const validDecisions = ['APPROVE', 'REJECT', 'REQUEST_REVISION'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: `decision must be one of: ${validDecisions.join(', ')}` });
    }

    // Send REVIEW event to workflow
    const event: ApprovalEvent = {
      type: 'REVIEW',
      reviewerId: userDID,
      decision,
      comment,
    };

    const status = await workflowEngine.sendEvent(objectiveId, event, userDID);

    // Update objective status based on workflow state
    if (status.state === 'approved') {
      await objectives.updateObjective(objectiveId, { status: 'APPROVED' });
    } else if (status.state === 'rejected') {
      await objectives.updateObjective(objectiveId, { status: 'REJECTED' });
    } else if (status.state === 'pendingRevision') {
      await objectives.updateObjective(objectiveId, { status: 'DRAFT' });
    }

    res.json({
      objectiveId,
      workflowStatus: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Review objective failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives/:id/workflow - Get workflow status
 */
router.get('/objectives/:id/workflow', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const status = await workflowEngine.getWorkflowStatus(objectiveId);

    if (!status) {
      return res.status(404).json({ error: 'No workflow found for this objective' });
    }

    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get workflow status failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/workflow/comment - Add comment to workflow
 */
router.post('/objectives/:id/workflow/comment', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content field required (string)' });
    }

    const event: ApprovalEvent = {
      type: 'ADD_COMMENT',
      authorId: userDID,
      content,
    };

    const status = await workflowEngine.sendEvent(objectiveId, event, userDID);

    res.json({
      objectiveId,
      workflowStatus: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Add workflow comment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/workflow/escalate - Escalate workflow
 */
router.post('/objectives/:id/workflow/escalate', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { reason, escalateTo } = req.body;
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason field required (string)' });
    }
    if (!escalateTo || typeof escalateTo !== 'string') {
      return res.status(400).json({ error: 'escalateTo field required (string)' });
    }

    const event: ApprovalEvent = {
      type: 'ESCALATE',
      reason,
      escalateTo,
    };

    const status = await workflowEngine.sendEvent(objectiveId, event, userDID);

    res.json({
      objectiveId,
      workflowStatus: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Escalate workflow failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// RISK ASSESSMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/objectives/:id/assess - Generate AI risk assessment
 */
router.post('/objectives/:id/assess', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const { context: additionalContext } = req.body;

    // Convert to StrategicObjective format for the risk service
    const strategicObjective: StrategicObjective = objective;

    console.log(`Generating AI risk assessment for objective ${objectiveId}...`);

    const riskService = getRiskAssessmentService();
    const assessment = await riskService.generateAIAssessment(
      strategicObjective,
      additionalContext
    );

    // Save the AI assessment
    await riskService.saveAIAssessment(assessment);

    console.log(`✓ AI risk assessment generated: ${assessment.id}`);

    res.status(201).json(assessment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate risk assessment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives/:id/risk - Get risk assessments for objective
 */
router.get('/objectives/:id/risk', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const assessments = await riskAssessmentStore.getAssessmentsForObjective(objectiveId);

    res.json({
      objectiveId,
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get risk assessments failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/risk - Create manual risk assessment
 */
router.post('/objectives/:id/risk', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const { riskToMission, riskToForce, mitigations, riskDecision } = req.body;

    if (!riskToMission || !riskToForce) {
      return res.status(400).json({ error: 'riskToMission and riskToForce required' });
    }

    // Calculate risk levels from likelihood/impact
    const missionRiskLevel = calculateRiskLevel(
      riskToMission.likelihood as Likelihood,
      riskToMission.impact as Impact
    );
    const forceRiskLevel = calculateRiskLevel(
      riskToForce.likelihood as Likelihood,
      riskToForce.impact as Impact
    );

    const riskService = getRiskAssessmentService();
    const assessment = await riskService.createAssessment(objectiveId, userDID, {
      riskToMission: { ...riskToMission, riskLevel: missionRiskLevel },
      riskToForce: { ...riskToForce, riskLevel: forceRiskLevel },
      mitigations: mitigations || [],
      riskDecision: riskDecision || 'MITIGATE',
    });

    res.status(201).json(assessment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create risk assessment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/strategic/risk/:assessmentId/review - Review risk assessment
 */
router.put('/risk/:assessmentId/review', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const assessmentId = req.params.assessmentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { approved, modifications } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved field required (boolean)' });
    }

    const riskService = getRiskAssessmentService();
    const updated = await riskService.reviewAssessment(
      assessmentId,
      userDID,
      approved,
      modifications
    );

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Review risk assessment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/risk/high-risk - Get high/extreme risk assessments
 */
router.get('/risk/high-risk', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const userDID = buildDID(req.anonUser!.nearAccountId);

    const assessments = await riskAssessmentStore.getHighRiskAssessments();

    res.json({
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get high-risk assessments failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// COMMANDER'S INTENT ENDPOINTS
// ============================================================================

const intents = intentStore;

/**
 * POST /api/strategic/objectives/:id/intent - Create commander's intent from objective
 */
router.post('/objectives/:id/intent', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Only allow intent creation for APPROVED objectives
    if (objective.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Cannot create intent for objective with status ${objective.status}. Objective must be APPROVED.`,
      });
    }

    const {
      purpose,
      keyTasks,
      endState,
      expandedPurpose,
      rationale,
      keyDecisions,
      antiGoals,
      constraints,
      classification,
    } = req.body;

    if (!purpose || !keyTasks || !endState) {
      return res.status(400).json({
        error: 'purpose, keyTasks (array), and endState are required',
      });
    }

    if (!Array.isArray(keyTasks)) {
      return res.status(400).json({ error: 'keyTasks must be an array' });
    }

    const input: IntentInput = {
      objectiveId,
      purpose,
      keyTasks,
      endState,
      expandedPurpose,
      rationale,
      keyDecisions,
      antiGoals,
      constraints,
      sourceObjectiveId: objectiveId,
      issuedBy: userDID,
      classification,
    };

    const intentId = await intents.saveIntent(input);
    const intent = await intents.getIntent(intentId);

    console.log(`✓ Commander's intent created: ${intentId}`);

    res.status(201).json(intent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create intent failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives/:id/intent - Get intents for objective
 */
router.get('/objectives/:id/intent', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objectiveIntents = await intents.getIntentsForObjective(objectiveId);

    res.json({
      objectiveId,
      count: objectiveIntents.length,
      intents: objectiveIntents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get intents failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/strategic/intent/:intentId - Update commander's intent
 */
router.put('/intent/:intentId', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const intentId = req.params.intentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const intent = await intents.getIntent(intentId);
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    const updates: IntentUpdate = req.body;
    const updated = await intents.updateIntent(intentId, updates);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update intent' });
    }

    const updatedIntent = await intents.getIntent(intentId);
    res.json(updatedIntent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update intent failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/intent/generate - AI-assist intent generation
 */
router.post('/objectives/:id/intent/generate', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Generate intent draft from objective's EWM
    const ewm = objective.endsWaysMeans;

    // Draft intent based on objective structure
    const intentDraft = {
      purpose: `To achieve: ${ewm.ends.description}`,
      keyTasks: ewm.ways.keyTasks,
      endState: ewm.ends.description,
      expandedPurpose: `This objective supports ${objective.primaryInstrument} instrument of national power.`,
      rationale: `Derived from objective: ${objective.description.substring(0, 200)}...`,
      keyDecisions: ['Key decision points to be determined by commander'],
      antiGoals: ['Avoid scope creep beyond defined ends'],
      constraints: objective.constraints,
      suggestedClassification: 'UNCLASSIFIED',
    };

    res.json({
      objectiveId,
      draft: intentDraft,
      message: 'AI-generated draft. Review and modify before creating.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate intent draft failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/objectives/:id/operationalize - Check operationalization readiness
 */
router.get('/objectives/:id/operationalize', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const blockers: string[] = [];

    // Check objective is APPROVED
    if (objective.status !== 'APPROVED') {
      blockers.push(`Objective status is ${objective.status}, must be APPROVED`);
    }

    // Check risk assessment exists and is reviewed
    const assessments = await riskAssessmentStore.getAssessmentsForObjective(objectiveId);
    if (assessments.length === 0) {
      blockers.push('No risk assessment found');
    } else {
      const reviewed = assessments.find(a => a.reviewedBy);
      if (!reviewed) {
        blockers.push('Risk assessment not yet reviewed');
      }
    }

    // Check intent exists
    const objectiveIntents = await intents.getIntentsForObjective(objectiveId);
    if (objectiveIntents.length === 0) {
      blockers.push('No commander\'s intent drafted');
    }

    const ready = blockers.length === 0;

    res.json({
      objectiveId,
      ready,
      blockers,
      status: objective.status,
      hasRiskAssessment: assessments.length > 0,
      hasIntent: objectiveIntents.length > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Check operationalization readiness failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/objectives/:id/operationalize - Mark objective as OPERATIONALIZED
 */
router.post('/objectives/:id/operationalize', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const objectiveId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    if (!userDID) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const objective = await objectives.getObjective(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Verify readiness
    if (objective.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Cannot operationalize objective with status ${objective.status}`,
      });
    }

    const assessments = await riskAssessmentStore.getAssessmentsForObjective(objectiveId);
    const reviewed = assessments.find(a => a.reviewedBy);
    if (!reviewed) {
      return res.status(400).json({
        error: 'Risk assessment must be reviewed before operationalization',
      });
    }

    const objectiveIntents = await intents.getIntentsForObjective(objectiveId);
    if (objectiveIntents.length === 0) {
      return res.status(400).json({
        error: 'Commander\'s intent must be drafted before operationalization',
      });
    }

    // Update status to OPERATIONALIZED
    await objectives.updateObjective(objectiveId, { status: 'OPERATIONALIZED' });

    // Create planning directive (simple JSON for Phase 5 handoff)
    const planningDirective = {
      id: `PD-${objectiveId}`,
      objectiveId,
      intent: objectiveIntents[0],
      riskAssessment: reviewed,
      operationalizedBy: userDID,
      operationalizedAt: new Date().toISOString(),
      phase5Ready: true,
    };

    console.log(`✓ Objective ${objectiveId} operationalized`);

    res.json({
      status: 'OPERATIONALIZED',
      planningDirectiveId: planningDirective.id,
      planningDirective,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Operationalize objective failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// AGENT REVIEW ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/documents/:documentId/review - Trigger agent review
 *
 * Request body (optional):
 * - confidenceThreshold: number (default: 0.7)
 * - prioritizationDomain: 'strategic' | 'operational' | 'tactical' | 'resource'
 * - onlyUncategorized: boolean
 */
router.post('/documents/:documentId/review', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists and user owns it
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { confidenceThreshold, prioritizationDomain, onlyUncategorized } = req.body;

    console.log(`Triggering agent review for document ${documentId}...`);

    // Execute review
    const executor = getStrategyReviewerExecutor();
    const report = await executor.reviewDocument(documentId, {
      confidenceThreshold,
      prioritizationDomain,
      onlyUncategorized,
    });

    // Save the review
    await reviewStore.saveReview(report);

    console.log(`✓ Agent review complete: ${report.id}`);

    res.status(201).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent review failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:documentId/review/stream - Stream agent review with SSE
 *
 * Uses Server-Sent Events to stream agent reasoning steps as they happen.
 * Returns progress events during analysis, then final report.
 *
 * Query params:
 * - confidenceThreshold: number (default: 0.7)
 * - prioritizationDomain: 'strategic' | 'operational' | 'tactical' | 'resource'
 */
router.get('/documents/:documentId/review/stream', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists and user owns it
    const document = await store.get(documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (document.createdBy !== userDID) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Helper to send SSE events
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log(`Streaming agent review for document ${documentId}...`);

    // Send start event
    sendEvent('start', {
      documentId,
      message: 'Starting LangGraph agent review...',
      timestamp: new Date().toISOString(),
    });

    try {
      // Execute the LangGraph review
      const result = await executeStrategyReview(documentId);

      // Send status updates based on graph state
      if (result.status === 'error') {
        sendEvent('error', {
          message: result.error || 'Review failed',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      // Stream progress for each analyzed objective
      if (result.categoryAssessments) {
        for (let i = 0; i < result.categoryAssessments.length; i++) {
          const assessment = result.categoryAssessments[i];
          sendEvent('progress', {
            type: 'category_assessment',
            index: i + 1,
            total: result.totalObjectives,
            objectiveId: assessment.objectiveId,
            suggestedCategory: assessment.suggestedCategory,
            confidence: assessment.confidence,
            requiresReview: assessment.requiresHumanReview,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Stream priority assessments
      if (result.priorityAssessments) {
        sendEvent('progress', {
          type: 'prioritization_complete',
          assessmentCount: result.priorityAssessments.length,
          timestamp: new Date().toISOString(),
        });
      }

      // If we have a complete report, save it and send
      if (result.report) {
        // Save to review store
        await reviewStore.saveReview(result.report);

        // Create checkpoint for human approval
        const checkpointManager = getReviewCheckpointManager();
        await checkpointManager.initialize();
        const checkpoint = await checkpointManager.createCheckpoint(
          result.report,
          `thread-${result.report.id}`
        );

        console.log(`Agent review complete: ${result.report.id}, checkpoint: ${checkpoint.checkpointId}`);

        // Send complete event with report
        sendEvent('complete', {
          reviewId: result.report.id,
          checkpointId: checkpoint.checkpointId,
          documentId: result.report.documentId,
          status: result.report.status,
          summary: result.report.documentSummary,
          categoryAssessmentCount: result.report.categoryAssessments.length,
          priorityAssessmentCount: result.report.priorityAssessments.length,
          coherenceScore: result.report.documentSummary.coherenceScore,
          flags: result.report.documentSummary.flags,
          timestamp: new Date().toISOString(),
        });
      } else {
        sendEvent('error', {
          message: 'Review completed but no report generated',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (graphError) {
      const errorMsg = graphError instanceof Error ? graphError.message : 'Unknown error';
      console.error('LangGraph review error:', errorMsg);
      sendEvent('error', {
        message: `Agent review failed: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Streaming review failed:', message);

    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/strategic/documents/:documentId/reviews - List reviews for document
 */
router.get('/documents/:documentId/reviews', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reviews = await reviewStore.getReviewsForDocument(documentId);

    res.json({
      documentId,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get reviews failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/reviews/:reviewId - Get specific review
 */
router.get('/reviews/:reviewId', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const reviewId = req.params.reviewId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const review = await reviewStore.getReview(reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get review failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/reviews/:reviewId/accept - Accept all suggestions
 */
router.post('/reviews/:reviewId/accept', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const reviewId = req.params.reviewId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const review = await reviewStore.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.status !== 'pending_review') {
      return res.status(400).json({
        error: `Cannot accept review with status ${review.status}`,
      });
    }

    // Apply all category suggestions
    for (const assessment of review.categoryAssessments) {
      await objectives.updateObjective(assessment.objectiveId, {
        midlifeCategory: assessment.suggestedCategory,
        midlifeCategorizedBy: 'AI',
        midlifeConfidence: assessment.confidence,
      });
    }

    // Apply all priority suggestions
    for (const assessment of review.priorityAssessments) {
      await objectives.updateObjective(assessment.objectiveId, {
        priority: assessment.suggestedPriority,
      });
    }

    // Update review status
    const updated = await reviewStore.updateStatus(reviewId, 'accepted' as ReviewStatus, userDID);

    console.log(`✓ Review ${reviewId} accepted, ${review.categoryAssessments.length} objectives updated`);

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept review failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/reviews/:reviewId/accept-partial - Accept selected suggestions
 *
 * Request body:
 * - objectiveIds: string[] - IDs of objectives to accept suggestions for
 * - acceptCategories: boolean (default: true) - Whether to apply category suggestions
 * - acceptPriorities: boolean (default: true) - Whether to apply priority suggestions
 */
router.post('/reviews/:reviewId/accept-partial', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const reviewId = req.params.reviewId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const review = await reviewStore.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const {
      objectiveIds,
      acceptCategories = true,
      acceptPriorities = true,
    } = req.body;

    if (!Array.isArray(objectiveIds) || objectiveIds.length === 0) {
      return res.status(400).json({
        error: 'objectiveIds array is required',
      });
    }

    // Apply category suggestions for selected objectives
    if (acceptCategories) {
      for (const assessment of review.categoryAssessments) {
        if (objectiveIds.includes(assessment.objectiveId)) {
          await objectives.updateObjective(assessment.objectiveId, {
            midlifeCategory: assessment.suggestedCategory,
            midlifeCategorizedBy: 'AI',
            midlifeConfidence: assessment.confidence,
          });
        }
      }
    }

    // Apply priority suggestions for selected objectives
    if (acceptPriorities) {
      for (const assessment of review.priorityAssessments) {
        if (objectiveIds.includes(assessment.objectiveId)) {
          await objectives.updateObjective(assessment.objectiveId, {
            priority: assessment.suggestedPriority,
          });
        }
      }
    }

    // Mark as partially accepted
    const acceptedIds = await reviewStore.acceptPartialSuggestions(reviewId, objectiveIds, userDID);

    console.log(`✓ Review ${reviewId} partially accepted, ${acceptedIds.length} objectives updated`);

    const updated = await reviewStore.getReview(reviewId);
    res.json({
      ...updated,
      acceptedObjectiveIds: acceptedIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Accept partial review failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/reviews/:reviewId/reject - Reject review
 *
 * Request body:
 * - reason: string (optional)
 */
router.post('/reviews/:reviewId/reject', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const reviewId = req.params.reviewId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const review = await reviewStore.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const { reason } = req.body;

    const updated = await reviewStore.updateStatus(
      reviewId,
      'rejected' as ReviewStatus,
      userDID,
      reason
    );

    console.log(`✓ Review ${reviewId} rejected`);

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Reject review failed:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// DOCUMENT-AGENT ASSIGNMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/strategic/assignments - Create document-agent assignment
 *
 * Request body:
 * - documentId: string
 * - agentId: string
 * - autoReview?: boolean (default: false)
 * - reviewOptions?: { confidenceThreshold?, prioritizationDomain?, onlyUncategorized? }
 */
router.post('/assignments', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { documentId, agentId, autoReview, reviewOptions } = req.body;

    if (!documentId || !agentId) {
      return res.status(400).json({
        error: 'documentId and agentId are required',
      });
    }

    // Verify document exists and user owns it
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const input: AssignmentInput = {
      documentId,
      agentId,
      autoReview: autoReview ?? false,
      reviewOptions,
    };

    const assignment = await assignmentStore.createAssignment(input, userDID);

    console.log(`✓ Document ${documentId} assigned to agent ${agentId}`);

    res.status(201).json(assignment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create assignment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/assignments - List all assignments
 *
 * Query params:
 * - documentId?: string
 * - agentId?: string
 * - status?: 'active' | 'completed' | 'revoked'
 * - autoReview?: boolean
 */
router.get('/assignments', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const userDID = buildDID(req.anonUser!.nearAccountId);

    const { documentId, agentId, status, autoReview } = req.query;

    const filters: Record<string, unknown> = {};
    if (documentId) filters.documentId = documentId as string;
    if (agentId) filters.agentId = agentId as string;
    if (status) filters.status = status as string;
    if (autoReview !== undefined) filters.autoReview = autoReview === 'true';

    const result = await assignmentStore.listAssignments(filters);

    res.json({
      count: result.total,
      assignments: result.assignments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List assignments failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:documentId/assignments - Get assignments for document
 */
router.get('/documents/:documentId/assignments', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.documentId as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    // Verify document exists
    const document = await store.get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const assignments = await assignmentStore.getAssignmentsForDocument(documentId);

    res.json({
      documentId,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document assignments failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/strategic/assignments/:id - Update assignment
 *
 * Request body:
 * - autoReview?: boolean
 * - reviewOptions?: object
 */
router.patch('/assignments/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const assignmentId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const assignment = await assignmentStore.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { autoReview } = req.body;

    if (autoReview !== undefined) {
      await assignmentStore.setAutoReview(assignmentId, autoReview);
    }

    const updated = await assignmentStore.getAssignment(assignmentId);

    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update assignment failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/strategic/assignments/:id - Revoke assignment
 */
router.delete('/assignments/:id', requireAuth, async (req, res) => {
  try {
    await ensureTableExists();

    const assignmentId = req.params.id as string;
    const userDID = buildDID(req.anonUser!.nearAccountId);

    const assignment = await assignmentStore.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const revoked = await assignmentStore.revokeAssignment(assignmentId, userDID);

    console.log(`✓ Assignment ${assignmentId} revoked`);

    res.json(revoked);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Revoke assignment failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;

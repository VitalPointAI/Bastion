/**
 * Document Intelligence API Routes
 *
 * Express router for the scoping interview, problem set context,
 * document processing pipeline, and intelligence report management.
 *
 * Provides endpoints for:
 * - Starting and continuing conversational interviews
 * - Retrieving interview state for resume
 * - Completing interviews and storing ProblemSetContext
 * - Retrieving stored ProblemSetContext
 * - Document upload with immediate processing (Plan 09)
 * - SSE streaming of specialist processing status (Plan 09)
 * - Intelligence report retrieval (Plan 09)
 * - NATO rating override with audit trail (Plan 09)
 * - Flagged source approval and re-processing (Plan 09)
 */

import { Router, Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import multer from 'multer';
import { InterviewService } from '../doc-intelligence/interview/interview-service.js';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import { BriefingService } from '../doc-intelligence/briefing/briefing-service.js';
import { ChangeTracker } from '../doc-intelligence/briefing/change-tracker.js';
import { createWiredDocIntelligenceGraph } from '../doc-intelligence/orchestrator-wiring.js';
import type { ProgressCallback } from '../doc-intelligence/orchestrator.js';
import type { DocumentIntelligenceReport } from '../doc-intelligence/types.js';
import { sourceStore } from '../doc-intelligence/source-registry/source-store.js';
import { getPool } from '../lib/database.js';
import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import { notifyCOPChange } from '../cop/index.js';

const router = Router();
const interviewService = new InterviewService();
const briefingService = new BriefingService();
const changeTracker = new ChangeTracker();
const docParser = new DocumentParser();

// Multer for file uploads — accept common document formats
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'text/html',
      'text/csv',
      'application/json',
      'application/xml',
      'text/xml',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ==========================================================================
// Processing State Management (in-memory, scoped to server lifetime)
// ==========================================================================

interface ProcessingSession {
  processingId: string;
  documentId: string;
  problemSetId: string;
  status: 'processing' | 'complete' | 'error' | 'flagged';
  report?: DocumentIntelligenceReport;
  error?: string;
  events: Array<{ event: string; data: Record<string, unknown>; timestamp: string }>;
  sseClients: Set<Response>;
}

/** Active processing sessions keyed by processingId */
const processingSessions = new Map<string, ProcessingSession>();

/**
 * Problem-set-wide SSE clients — receives multiplexed events from ALL
 * processing sessions belonging to a given problemSetId.
 */
const problemSetSSEClients = new Map<string, Set<Response>>();

// ==========================================================================
// Document Hashing & Similarity Utilities
// ==========================================================================

/** Compute SHA-256 hash of normalized text content for duplicate detection. */
function computeContentHash(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compute Jaccard similarity between two texts using word-level shingles.
 * Returns a value between 0 and 1.
 */
function computeTextSimilarity(textA: string, textB: string): number {
  const toWords = (t: string) => new Set(
    t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  );
  const setA = toWords(textA);
  const setB = toWords(textB);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

/** Check for duplicate or near-duplicate documents in a problem set. */
async function checkForDuplicates(
  problemSetId: string,
  contentHash: string,
  documentText: string,
  similarityThreshold = 0.95,
): Promise<{ exact: boolean; similar: Array<{ documentId: string; title: string; similarity: number }> }> {
  const pool = getPool();

  // 1. Exact hash match
  const exactResult = await pool.query(
    `SELECT id, title FROM strategic_documents
     WHERE workspace_id = $1 AND content_hash = $2
     LIMIT 5`,
    [problemSetId, contentHash],
  );
  if (exactResult.rows.length > 0) {
    return {
      exact: true,
      similar: exactResult.rows.map((r: Record<string, unknown>) => ({
        documentId: r.id as string,
        title: r.title as string,
        similarity: 1.0,
      })),
    };
  }

  // 2. Fuzzy similarity — compare against recent documents in the same problem set.
  //    Fetch text previews (first 5000 chars) to avoid loading full texts for many docs.
  const candidates = await pool.query(
    `SELECT id, title, LEFT(text_content, 5000) as preview
     FROM strategic_documents
     WHERE workspace_id = $1 AND processing_status IN ('complete', 'processing')
     ORDER BY created_at DESC
     LIMIT 50`,
    [problemSetId],
  );

  const similar: Array<{ documentId: string; title: string; similarity: number }> = [];
  const docPreview = documentText.slice(0, 5000);

  for (const row of candidates.rows as Array<Record<string, unknown>>) {
    const sim = computeTextSimilarity(docPreview, row.preview as string);
    if (sim >= similarityThreshold) {
      similar.push({
        documentId: row.id as string,
        title: row.title as string,
        similarity: Math.round(sim * 1000) / 1000,
      });
    }
  }

  return { exact: false, similar };
}

/**
 * Create an SSE progress callback that broadcasts to all connected clients.
 */
function createSSEProgressCallback(session: ProcessingSession): ProgressCallback {
  return (event: string, data: Record<string, unknown>) => {
    const entry = { event, data, timestamp: new Date().toISOString() };
    session.events.push(entry);

    const enrichedData = { ...data, processId: session.processingId, documentId: session.documentId };

    // Broadcast to per-session SSE clients
    for (const client of session.sseClients) {
      try {
        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        session.sseClients.delete(client);
      }
    }

    // Broadcast to problem-set-wide SSE clients
    const psClients = problemSetSSEClients.get(session.problemSetId);
    if (psClients) {
      for (const client of psClients) {
        try {
          client.write(`event: ${event}\n`);
          client.write(`data: ${JSON.stringify(enrichedData)}\n\n`);
        } catch {
          psClients.delete(client);
        }
      }
    }
  };
}

// ==========================================================================
// Interview Endpoints
// ==========================================================================

/**
 * POST /api/doc-intelligence/interview/:problemSetId/start
 * Start a new scoping interview for a problem set.
 * Returns the first AI message (introduction and opening question).
 */
router.post(
  '/interview/:problemSetId/start',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const result = await interviewService.startInterview(problemSetId as string);

      res.json({
        success: true,
        message: {
          role: 'assistant',
          content:
            typeof result.message.content === 'string'
              ? result.message.content
              : JSON.stringify(result.message.content),
        },
        state: result.state,
      });
    } catch (error) {
      console.error('[DocIntelligence] Start interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * POST /api/doc-intelligence/interview/:problemSetId/message
 * Send a user message and receive the next AI response.
 * Body: { message: string }
 */
router.post(
  '/interview/:problemSetId/message',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const { message } = req.body;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
      }

      const result = await interviewService.continueInterview(problemSetId as string, message);

      res.json({
        success: true,
        message: {
          role: 'assistant',
          content:
            typeof result.message.content === 'string'
              ? result.message.content
              : JSON.stringify(result.message.content),
        },
        state: result.state,
      });
    } catch (error) {
      console.error('[DocIntelligence] Continue interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * GET /api/doc-intelligence/interview/:problemSetId/state
 * Get the current interview state for resume after page refresh.
 * Returns messages, questions asked, completion status, and derived context.
 */
router.get(
  '/interview/:problemSetId/state',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const state = await interviewService.getInterviewState(problemSetId as string);

      if (!state) {
        res.json({
          success: true,
          state: null,
        });
        return;
      }

      // Serialize messages to simple role/content format for the frontend
      const serializedMessages = state.messages.map((msg) => {
        const msgType = msg._getType();
        return {
          role: msgType === 'human' ? 'user' : 'assistant',
          content:
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content),
        };
      });

      res.json({
        success: true,
        state: {
          messages: serializedMessages,
          questionsAsked: state.questionsAsked,
          isComplete: state.isComplete,
          derivedContext: state.derivedContext,
        },
      });
    } catch (error) {
      console.error('[DocIntelligence] Get interview state error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * POST /api/doc-intelligence/interview/:problemSetId/complete
 * Finalize the interview and store the validated ProblemSetContext.
 * Returns the extracted and validated context.
 */
router.post(
  '/interview/:problemSetId/complete',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const context = await interviewService.completeInterview(problemSetId as string);

      res.json({
        success: true,
        context,
      });
    } catch (error) {
      console.error('[DocIntelligence] Complete interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

// ==========================================================================
// Context Endpoints
// ==========================================================================

/**
 * GET /api/doc-intelligence/context/:problemSetId
 * Retrieve the stored ProblemSetContext for a problem set.
 */
router.get(
  '/context/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const context = await getProblemSetContext(problemSetId as string);

      if (!context) {
        res.status(404).json({
          success: false,
          error: 'No context found for this problem set',
        });
        return;
      }

      res.json({
        success: true,
        context,
      });
    } catch (error) {
      console.error('[DocIntelligence] Get context error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

// ==========================================================================
// Briefing Endpoints (Phase 40 Plan 08)
// ==========================================================================

/**
 * GET /api/doc-intelligence/briefing/:problemSetId
 * Generate a strategic environment briefing for the authenticated user.
 * Returns a narrative briefing with change detection and predictive analytics.
 */
router.get(
  '/briefing/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const requestedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const briefing = await briefingService.generateBriefing(problemSetId as string, requestedBy);

      res.json({
        success: true,
        briefing,
      });
    } catch (error) {
      console.error('[DocIntelligence] Generate briefing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/briefing/:problemSetId/changes
 * Quick check if changes exist since the user's last access.
 * Lightweight endpoint -- does not generate a full briefing.
 */
router.get(
  '/briefing/:problemSetId/changes',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const accessedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const hasChanges = await changeTracker.hasChanges(problemSetId as string, accessedBy);

      res.json({
        success: true,
        hasChanges,
      });
    } catch (error) {
      console.error('[DocIntelligence] Check changes error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/briefing/:problemSetId/history
 * Retrieve past briefings for the authenticated user on a problem set.
 */
router.get(
  '/briefing/:problemSetId/history',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const requestedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const history = await briefingService.getBriefingHistory(problemSetId as string, requestedBy);

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error('[DocIntelligence] Get briefing history error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

// ==========================================================================
// Document Processing Endpoints (Phase 40 Plan 09)
// ==========================================================================

/**
 * POST /api/doc-intelligence/process/:problemSetId
 * Upload a document for immediate processing through the full orchestrator pipeline.
 *
 * Accepts multipart file upload (field name: "document") OR JSON body with
 * { documentId, documentText, metadata }.
 *
 * Returns 202 Accepted with { processingId, documentId, sseUrl }
 */
router.post(
  '/process/:problemSetId',
  docUpload.single('document'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      // Resolve document content from file upload or JSON body
      let documentId: string;
      let documentText: string;
      let metadata: Record<string, unknown>;

      if (req.file) {
        // Multipart file upload path
        documentId = randomUUID();
        const parsed = await docParser.parse(req.file.buffer, req.file.mimetype);
        documentText = parsed.text;
        metadata = {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          pageCount: parsed.pageCount,
        };
      } else if (req.body?.documentId && req.body?.documentText) {
        // JSON body path (programmatic API usage)
        documentId = req.body.documentId;
        documentText = req.body.documentText;
        metadata = req.body.metadata ?? {};
      } else {
        res.status(400).json({
          success: false,
          error: 'Upload a document file or provide { documentId, documentText } in JSON body',
        });
        return;
      }

      // Load ProblemSetContext -- required for scoped processing
      const problemSetContext = await getProblemSetContext(problemSetId as string);
      if (!problemSetContext) {
        console.warn(`[DocIntelligence] Process rejected: no ProblemSetContext for ${problemSetId}`);
        res.status(400).json({
          success: false,
          error: 'No problem set context found. Complete the scoping interview before uploading documents.',
          code: 'INTERVIEW_REQUIRED',
        });
        return;
      }

      // --- Duplicate detection ---
      const contentHash = computeContentHash(documentText);
      const forceUpload = req.body?.forceUpload === true || req.query.force === 'true';

      if (!forceUpload) {
        const dupeCheck = await checkForDuplicates(
          problemSetId as string,
          contentHash,
          documentText,
        );

        if (dupeCheck.exact) {
          res.status(409).json({
            success: false,
            error: 'This document has already been uploaded to this problem set.',
            code: 'DUPLICATE_EXACT',
            duplicates: dupeCheck.similar,
          });
          return;
        }

        if (dupeCheck.similar.length > 0) {
          res.status(409).json({
            success: false,
            error: `Document is ${Math.round(dupeCheck.similar[0].similarity * 100)}% similar to an existing document. Add forceUpload=true to proceed anyway.`,
            code: 'DUPLICATE_SIMILAR',
            duplicates: dupeCheck.similar,
          });
          return;
        }
      }

      const pool = getPool();

      // --- Persist document to strategic_documents with processing status ---
      const title = (metadata.originalName as string) ?? `Document ${documentId.slice(0, 8)}`;
      try {
        await pool.query(
          `INSERT INTO strategic_documents (
            id, title, original_filename, mime_type, text_content, text_length,
            created_by, workspace_id, content_hash, processing_status, processing_started_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing', NOW())
          ON CONFLICT (id) DO UPDATE SET
            processing_status = 'processing',
            processing_started_at = NOW(),
            processing_error = NULL`,
          [
            documentId, title,
            (metadata.originalName as string) ?? 'upload',
            (metadata.mimeType as string) ?? 'application/octet-stream',
            documentText, documentText.length,
            'system', problemSetId, contentHash,
          ],
        );
      } catch (dbErr) {
        console.warn('[DocIntelligence] Failed to persist document row:', dbErr);
      }

      // Create processing session
      const processingId = randomUUID();
      const session: ProcessingSession = {
        processingId,
        documentId,
        problemSetId: problemSetId as string,
        status: 'processing',
        events: [],
        sseClients: new Set(),
      };
      processingSessions.set(processingId, session);

      // Return 202 immediately, processing happens async
      const sseUrl = `/api/doc-intelligence/process/${problemSetId}/stream/${processingId}`;
      res.status(202).json({
        success: true,
        processingId,
        documentId,
        sseUrl,
      });

      // Start async processing (fire-and-forget from request perspective)
      const onProgress = createSSEProgressCallback(session);

      try {
        const graph = await createWiredDocIntelligenceGraph({
          problemSetId: problemSetId as string,
          problemSetContext,
          onProgress,
        });

        const report = await graph.processDocument(
          documentId,
          documentText,
          metadata,
        );

        session.report = report;
        session.status = 'complete';

        // Store report in database
        try {
          await pool.query(
            `INSERT INTO doc_intelligence_reports (document_id, problem_set_id, report, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (document_id, problem_set_id)
             DO UPDATE SET report = $3, updated_at = NOW()`,
            [documentId, problemSetId, JSON.stringify(report)],
          );
        } catch (dbError) {
          console.warn('[DocIntelligence] Failed to persist report:', dbError);
        }

        // Update document processing status
        try {
          await pool.query(
            `UPDATE strategic_documents
             SET processing_status = 'complete', processing_completed_at = NOW(), processing_error = NULL
             WHERE id = $1`,
            [documentId],
          );
        } catch (dbError) {
          console.warn('[DocIntelligence] Failed to update processing status:', dbError);
        }

        // Notify SSE clients of completion
        onProgress('processing:complete', {
          processingId,
          documentId,
          reportId: documentId,
          timestamp: new Date().toISOString(),
        });

        // Notify COP that new intelligence has been ingested
        notifyCOPChange(problemSetId as string, 'doc-intelligence');
      } catch (error) {
        session.status = 'error';
        session.error = error instanceof Error ? error.message : String(error);

        // Update document processing status to failed
        try {
          await pool.query(
            `UPDATE strategic_documents
             SET processing_status = 'failed', processing_error = $2, processing_completed_at = NOW()
             WHERE id = $1`,
            [documentId, session.error],
          );
        } catch (dbError) {
          console.warn('[DocIntelligence] Failed to update failed status:', dbError);
        }

        onProgress('processing:error', {
          processingId,
          error: session.error,
          timestamp: new Date().toISOString(),
        });

        console.error('[DocIntelligence] Processing error:', error);
      }

      // Clean up session after 5 minutes
      setTimeout(() => {
        processingSessions.delete(processingId);
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('[DocIntelligence] Process document error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/process/:problemSetId/stream/:processingId
 * SSE stream for real-time processing status updates.
 *
 * Events emitted:
 * - specialist:start     { agentId, documentId, timestamp }
 * - specialist:progress  { agentId, stage, detail, entitiesFound }
 * - specialist:complete  { agentId, result, duration }
 * - specialist:error     { agentId, error, duration } (non-fatal, pipeline continues)
 * - report:assembled     { reportId, entityCount, ratingsSummary }
 * - processing:error     { error } (fatal pipeline error)
 * - processing:flagged   { reason, trustStatus }
 * - processing:complete  { processingId, documentId, reportId }
 */
router.get(
  '/process/:problemSetId/stream/:processingId',
  async (req: Request, res: Response): Promise<void> => {
    const { processingId } = req.params;

    const session = processingSessions.get(processingId as string);
    if (!session) {
      res.status(404).json({ success: false, error: 'Processing session not found' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send all buffered events (catch-up for late-connecting clients)
    for (const entry of session.events) {
      res.write(`event: ${entry.event}\n`);
      res.write(`data: ${JSON.stringify(entry.data)}\n\n`);
    }

    // Register this client for future events
    session.sseClients.add(res);

    // If processing already complete, send final status and close
    if (session.status === 'complete' || session.status === 'error') {
      const finalEvent = session.status === 'complete' ? 'processing:complete' : 'processing:error';
      const finalData = session.status === 'complete'
        ? { processingId, documentId: session.documentId, reportId: session.documentId }
        : { processingId, error: session.error };
      res.write(`event: ${finalEvent}\n`);
      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
    }

    // Clean up on client disconnect
    req.on('close', () => {
      session.sseClients.delete(res);
    });
  },
);

// ==========================================================================
// Problem-Set-Wide SSE Stream
// ==========================================================================

/**
 * GET /api/doc-intelligence/stream/:problemSetId
 * SSE stream that multiplexes events from ALL active processing sessions
 * for the given problem set. Used by the brain IngestionSidebar for a
 * unified real-time feed without needing to know individual processingIds.
 *
 * On connect, sends catch-up events from all active sessions. Then
 * receives live events as they occur via createSSEProgressCallback.
 */
router.get(
  '/stream/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    const problemSetId = req.params.problemSetId as string;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send catch-up events from all active sessions for this problem set
    for (const session of processingSessions.values()) {
      if (session.problemSetId !== problemSetId) continue;
      for (const entry of session.events) {
        const enrichedData = { ...entry.data, processId: session.processingId, documentId: session.documentId };
        res.write(`event: ${entry.event}\n`);
        res.write(`data: ${JSON.stringify(enrichedData)}\n\n`);
      }
    }

    // Register this client for future problem-set-wide events
    if (!problemSetSSEClients.has(problemSetId)) {
      problemSetSSEClients.set(problemSetId, new Set());
    }
    problemSetSSEClients.get(problemSetId)!.add(res);

    // Send a heartbeat every 30s to keep the connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      const clients = problemSetSSEClients.get(problemSetId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          problemSetSSEClients.delete(problemSetId);
        }
      }
    });
  },
);

// ==========================================================================
// Document Status & Recovery Endpoints
// ==========================================================================

/**
 * GET /api/doc-intelligence/documents/:problemSetId
 * List all documents for a problem set with their processing status.
 * Includes interrupted/failed documents that can be retried.
 */
router.get(
  '/documents/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const statusFilter = req.query.status as string | undefined;

      const pool = getPool();
      let query = `SELECT id, title, original_filename, mime_type, text_length,
                          processing_status, processing_error, processing_started_at,
                          processing_completed_at, content_hash, trust_status, created_at
                   FROM strategic_documents
                   WHERE workspace_id = $1`;
      const params: unknown[] = [problemSetId];

      if (statusFilter) {
        query += ` AND processing_status = $2`;
        params.push(statusFilter);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);

      const documents = result.rows.map((row: Record<string, unknown>) => ({
        documentId: row.id,
        title: row.title,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        textLength: row.text_length,
        processingStatus: row.processing_status ?? 'pending',
        processingError: row.processing_error,
        processingStartedAt: row.processing_started_at,
        processingCompletedAt: row.processing_completed_at,
        trustStatus: row.trust_status,
        createdAt: row.created_at,
      }));

      res.json({ success: true, documents });
    } catch (error) {
      console.error('[DocIntelligence] List documents error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * POST /api/doc-intelligence/documents/:problemSetId/:documentId/retry
 * Retry processing for a failed or interrupted document.
 */
router.post(
  '/documents/:problemSetId/:documentId/retry',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId, documentId } = req.params;
      const pool = getPool();

      // Fetch the document — must be in a retryable state
      const docResult = await pool.query(
        `SELECT id, text_content, original_filename, mime_type, processing_status
         FROM strategic_documents
         WHERE id = $1 AND workspace_id = $2`,
        [documentId, problemSetId],
      );

      if (docResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const doc = docResult.rows[0] as Record<string, unknown>;
      const status = doc.processing_status as string;

      if (status !== 'failed' && status !== 'interrupted') {
        res.status(400).json({
          success: false,
          error: `Cannot retry document with status '${status}'. Only failed or interrupted documents can be retried.`,
        });
        return;
      }

      // Load ProblemSetContext
      const problemSetContext = await getProblemSetContext(problemSetId as string);
      if (!problemSetContext) {
        res.status(400).json({
          success: false,
          error: 'No problem set context found. Complete the scoping interview first.',
          code: 'INTERVIEW_REQUIRED',
        });
        return;
      }

      // Mark as processing
      await pool.query(
        `UPDATE strategic_documents
         SET processing_status = 'processing', processing_started_at = NOW(), processing_error = NULL
         WHERE id = $1`,
        [documentId],
      );

      // Create session
      const processingId = randomUUID();
      const session: ProcessingSession = {
        processingId,
        documentId: documentId as string,
        problemSetId: problemSetId as string,
        status: 'processing',
        events: [],
        sseClients: new Set(),
      };
      processingSessions.set(processingId, session);

      const sseUrl = `/api/doc-intelligence/process/${problemSetId}/stream/${processingId}`;
      res.status(202).json({ success: true, processingId, documentId, sseUrl });

      // Fire-and-forget async processing
      const onProgress = createSSEProgressCallback(session);
      try {
        const graph = await createWiredDocIntelligenceGraph({
          problemSetId: problemSetId as string,
          problemSetContext,
          onProgress,
        });

        const report = await graph.processDocument(
          documentId as string,
          doc.text_content as string,
          { originalName: doc.original_filename, mimeType: doc.mime_type, retried: true },
        );

        session.report = report;
        session.status = 'complete';

        await pool.query(
          `INSERT INTO doc_intelligence_reports (document_id, problem_set_id, report, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (document_id, problem_set_id)
           DO UPDATE SET report = $3, updated_at = NOW()`,
          [documentId, problemSetId, JSON.stringify(report)],
        );

        await pool.query(
          `UPDATE strategic_documents
           SET processing_status = 'complete', processing_completed_at = NOW(), processing_error = NULL
           WHERE id = $1`,
          [documentId],
        );

        onProgress('processing:complete', {
          processingId, documentId, reportId: documentId, timestamp: new Date().toISOString(),
        });
      } catch (error) {
        session.status = 'error';
        session.error = error instanceof Error ? error.message : String(error);

        await pool.query(
          `UPDATE strategic_documents
           SET processing_status = 'failed', processing_error = $2, processing_completed_at = NOW()
           WHERE id = $1`,
          [documentId, session.error],
        ).catch(() => {});

        onProgress('processing:error', {
          processingId, error: session.error, timestamp: new Date().toISOString(),
        });
        console.error('[DocIntelligence] Retry processing error:', error);
      }

      setTimeout(() => processingSessions.delete(processingId), 5 * 60 * 1000);
    } catch (error) {
      console.error('[DocIntelligence] Retry document error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

// ==========================================================================
// Report Endpoints (Phase 40 Plan 09)
// ==========================================================================

/**
 * GET /api/doc-intelligence/reports/:problemSetId
 * List all intelligence reports for a problem set.
 */
router.get(
  '/reports/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const pool = getPool();
      const result = await pool.query(
        `SELECT document_id, problem_set_id, report, created_at, updated_at
         FROM doc_intelligence_reports
         WHERE problem_set_id = $1
         ORDER BY created_at DESC`,
        [problemSetId],
      );

      const reports = result.rows.map((row: Record<string, unknown>) => ({
        documentId: row.document_id,
        problemSetId: row.problem_set_id,
        report: typeof row.report === 'string' ? JSON.parse(row.report as string) : row.report,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({ success: true, reports });
    } catch (error) {
      console.error('[DocIntelligence] List reports error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/reports/:problemSetId/:documentId
 * Get a specific intelligence report.
 */
router.get(
  '/reports/:problemSetId/:documentId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId, documentId } = req.params;

      if (!problemSetId || !documentId) {
        res.status(400).json({ success: false, error: 'problemSetId and documentId are required' });
        return;
      }

      const pool = getPool();
      const result = await pool.query(
        `SELECT document_id, problem_set_id, report, created_at, updated_at
         FROM doc_intelligence_reports
         WHERE problem_set_id = $1 AND document_id = $2`,
        [problemSetId, documentId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Report not found' });
        return;
      }

      const row = result.rows[0] as Record<string, unknown>;
      const report = typeof row.report === 'string' ? JSON.parse(row.report as string) : row.report;

      res.json({ success: true, report });
    } catch (error) {
      console.error('[DocIntelligence] Get report error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

// ==========================================================================
// Rating Override Endpoints (Phase 40 Plan 09)
// ==========================================================================

/**
 * POST /api/doc-intelligence/ratings/:documentId/override
 * Override a NATO rating with user assessment.
 *
 * Body: { sourceReliability, informationCredibility, reason }
 *
 * Preserves original rating as originalRating, sets overriddenBy to
 * authenticated user DID, and logs overrideReason for audit trail.
 */
router.post(
  '/ratings/:documentId/override',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { sourceReliability, informationCredibility, reason } = req.body;
      const userDid: string = String(req.headers['x-did'] || 'anonymous');

      if (!documentId) {
        res.status(400).json({ success: false, error: 'documentId is required' });
        return;
      }

      if (!sourceReliability || !informationCredibility || !reason) {
        res.status(400).json({
          success: false,
          error: 'sourceReliability, informationCredibility, and reason are required',
        });
        return;
      }

      const pool = getPool();

      // Read current rating to preserve as originalRating
      const current = await pool.query(
        `SELECT source_reliability, information_credibility
         FROM strategic_documents
         WHERE id = $1`,
        [documentId],
      );

      if (current.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const row = current.rows[0] as Record<string, unknown>;
      const originalRating = {
        sourceReliability: row.source_reliability,
        informationCredibility: row.information_credibility,
      };

      // Apply override
      await pool.query(
        `UPDATE strategic_documents
         SET source_reliability = $2,
             information_credibility = $3,
             original_source_reliability = COALESCE(original_source_reliability, source_reliability),
             original_information_credibility = COALESCE(original_information_credibility, information_credibility),
             rating_overridden_by = $4,
             rating_override_reason = $5,
             rating_overridden_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [documentId, sourceReliability, informationCredibility, userDid, reason],
      );

      res.json({
        success: true,
        originalRating,
        newRating: { sourceReliability, informationCredibility },
        overriddenBy: userDid,
        overrideReason: reason,
      });
    } catch (error) {
      console.error('[DocIntelligence] Rating override error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

// ==========================================================================
// Source Approval Endpoints (Phase 40 Plan 09)
// ==========================================================================

/**
 * POST /api/doc-intelligence/sources/:documentId/approve
 * Approve a flagged source for graph ingestion.
 *
 * Changes trust_status from 'flagged' to 'trusted' and triggers
 * re-processing of the document through extraction specialists.
 */
router.post(
  '/sources/:documentId/approve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const documentId = req.params.documentId as string;
      const userDid: string = String(req.headers['x-did'] || 'anonymous');

      if (!documentId) {
        res.status(400).json({ success: false, error: 'documentId is required' });
        return;
      }

      // Update trust status to trusted
      await sourceStore.updateDocumentTrustStatus(documentId, 'trusted', userDid);

      // Find the problem set for this document
      const pool = getPool();
      const docResult = await pool.query(
        `SELECT problem_set_id, content FROM strategic_documents WHERE id = $1`,
        [documentId],
      );

      if (docResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const docRow = docResult.rows[0] as Record<string, unknown>;
      const problemSetId = docRow.problem_set_id as string;

      // Return 202 -- re-processing starts async
      res.status(202).json({
        success: true,
        message: 'Source approved. Re-processing document for graph ingestion.',
        documentId,
        problemSetId,
        approvedBy: userDid,
      });

      // Trigger re-processing asynchronously
      try {
        const problemSetContext = await getProblemSetContext(problemSetId);
        if (!problemSetContext) {
          console.warn(`[DocIntelligence] Cannot re-process ${documentId}: no problem set context`);
          return;
        }

        const processingId = randomUUID();
        const session: ProcessingSession = {
          processingId,
          documentId,
          problemSetId,
          status: 'processing',
          events: [],
          sseClients: new Set(),
        };
        processingSessions.set(processingId, session);

        const onProgress = createSSEProgressCallback(session);
        const graph = await createWiredDocIntelligenceGraph({
          problemSetId,
          problemSetContext,
          onProgress,
        });

        const documentText = typeof docRow.content === 'string' ? docRow.content : '';
        const report = await graph.processDocument(documentId, documentText, {
          reprocessed: true,
          approvedBy: userDid,
        });

        session.report = report;
        session.status = 'complete';

        // Update stored report
        await pool.query(
          `INSERT INTO doc_intelligence_reports (document_id, problem_set_id, report, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (document_id, problem_set_id)
           DO UPDATE SET report = $3, updated_at = NOW()`,
          [documentId, problemSetId, JSON.stringify(report)],
        );

        console.log(`[DocIntelligence] Re-processed approved document ${documentId}`);
      } catch (reprocessError) {
        console.error('[DocIntelligence] Re-processing error:', reprocessError);
      }

      // Clean up after 5 minutes
      setTimeout(() => {
        // Clean any session for this documentId
        for (const [key, s] of processingSessions) {
          if (s.documentId === documentId) {
            processingSessions.delete(key);
          }
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('[DocIntelligence] Source approve error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

export default router;

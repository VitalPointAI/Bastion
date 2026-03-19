/**
 * Universal Intelligence Input — Ingest API Router
 *
 * Phase 50 Plan 02 Task 1
 *
 * Provides two Express endpoints:
 *   POST /api/ingest/classify  — classify content, return ClassificationResult
 *   POST /api/ingest/submit    — classify + route to correct pipeline
 *
 * Both endpoints accept:
 * - JSON body `{ content: string, [problemSetId: string] }`
 * - Multipart form with `document` file field + optional fields
 *
 * SSE events are broadcast to the problem-set SSE stream (problemSetSSEClients)
 * if a problemSetId is included in the request.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { classifyInput } from '../ingest/universal-classifier.js';
import { routeToProcess } from '../ingest/universal-ingest-router.js';
import { broadcastSSE } from './doc-intelligence.js';
import { randomUUID } from 'crypto';
import type { InputType } from '../ingest/types.js';

const router = Router();

// ---------------------------------------------------------------------------
// Multer — same configuration as doc-intelligence (50MB, common doc formats)
// ---------------------------------------------------------------------------

const ingestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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

// ---------------------------------------------------------------------------
// POST /api/ingest/classify
// ---------------------------------------------------------------------------

/**
 * Classify content without submitting it to any pipeline.
 *
 * Body (JSON): `{ content: string, problemSetId?: string }`
 * Body (multipart): `document` file field + optional `problemSetId` text field
 *
 * Returns: `{ classification: ClassificationResult }`
 */
router.post(
  '/classify',
  ingestUpload.single('document'),
  async (req: Request, res: Response): Promise<void> => {
    const processId = randomUUID();
    const problemSetId = (req.body?.problemSetId ?? req.query.problemSetId) as string | undefined;

    // Broadcast classify:start if we know which problem set
    if (problemSetId) {
      const contentPreview = req.file
        ? `[file: ${req.file.originalname}]`
        : String(req.body?.content ?? '').slice(0, 120);
      broadcastSSE(problemSetId, 'classify:start', { processId, content_preview: contentPreview });
    }

    // Build content for classifier
    let content: string | Buffer;
    let hint: { filename?: string; mimeType?: string } | undefined;

    if (req.file) {
      content = req.file.buffer;
      hint = { filename: req.file.originalname, mimeType: req.file.mimetype };
    } else {
      const raw = req.body?.content;
      if (typeof raw !== 'string' || !raw.trim()) {
        res.status(400).json({ error: 'content is required (string or file upload)' });
        return;
      }
      content = raw;
    }

    // Timeout wrapper — respond within 15 seconds even if URL unfurling is slow
    const classifyWithTimeout = () =>
      Promise.race([
        classifyInput(content, hint),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('classify timeout')), 15_000),
        ),
      ]);

    try {
      const classification = await classifyWithTimeout();

      if (problemSetId) {
        broadcastSSE(problemSetId, 'classify:result', { processId, classification });
      }

      res.json({ classification });
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'classify timeout';
      if (isTimeout) {
        // Return partial result with lower confidence rather than failing
        const partial = {
          inputType: 'unknown' as InputType,
          confidence: 0.3,
          suggestedPipeline: 'manual' as const,
          metadata: {},
        };
        if (problemSetId) {
          broadcastSSE(problemSetId, 'classify:result', { processId, classification: partial, partial: true });
        }
        res.json({ classification: partial, partial: true });
      } else {
        console.error('[IngestAPI] Classify error:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/ingest/submit
// ---------------------------------------------------------------------------

/**
 * Classify content and route it to the correct backend pipeline.
 *
 * Body (JSON):
 * ```
 * {
 *   content: string | null,
 *   problemSetId: string,
 *   filename?: string,
 *   mimeType?: string,
 *   forceClassification?: InputType,
 *   classification?: ClassificationResult   // skip classify step if provided
 * }
 * ```
 *
 * Body (multipart): `document` file field + required `problemSetId` text field
 *
 * Returns: `{ processId, classification, status }`
 */
router.post(
  '/submit',
  ingestUpload.single('document'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const problemSetId = req.body?.problemSetId as string | undefined;

      if (!problemSetId) {
        res.status(400).json({ error: 'problemSetId is required' });
        return;
      }

      // Build IngestSubmitRequest
      let content: string | null = null;
      let fileBuffer: Buffer | undefined;
      let filename: string | undefined;
      let mimeType: string | undefined;

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        content = req.body?.content ?? null;
        filename = req.body?.filename;
        mimeType = req.body?.mimeType;
      }

      const forceClassification = req.body?.forceClassification as InputType | undefined;

      // Determine classification — use provided or run classifier
      let classification = req.body?.classification;

      if (!classification) {
        const processId = randomUUID();
        const contentPreview = fileBuffer
          ? `[file: ${filename}]`
          : String(content ?? '').slice(0, 120);

        broadcastSSE(problemSetId, 'classify:start', { processId, content_preview: contentPreview });

        const classifyContent: string | Buffer = fileBuffer ?? content ?? '';
        const hint: { filename?: string; mimeType?: string } = {};
        if (filename) hint.filename = filename;
        if (mimeType) hint.mimeType = mimeType;

        try {
          classification = await Promise.race([
            classifyInput(classifyContent, hint),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('classify timeout')), 15_000),
            ),
          ]);
        } catch {
          // Timeout — use low-confidence unknown
          classification = {
            inputType: 'unknown' as InputType,
            confidence: 0.3,
            suggestedPipeline: 'manual' as const,
            metadata: {},
          };
        }

        // Apply forceClassification override if requested
        if (forceClassification) {
          classification = { ...classification, inputType: forceClassification };
        }

        broadcastSSE(problemSetId, 'classify:result', { processId, classification });
      }

      // Route to pipeline
      const response = await routeToProcess(
        { content, fileBuffer, filename, mimeType, problemSetId, forceClassification },
        classification,
      );

      // Map status to HTTP code
      if (response.status === 'duplicate') {
        res.status(409).json(response);
      } else if (response.status === 'interview_required') {
        res.status(200).json(response); // 200 — not an error, just a workflow gate
      } else {
        res.status(202).json(response);
      }
    } catch (err) {
      console.error('[IngestAPI] Submit error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  },
);

export default router;

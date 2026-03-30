/**
 * Universal Intelligence Input — Pipeline Router
 *
 * Phase 50 Plan 02 Task 1
 *
 * Dispatches classified content to the correct backend pipeline:
 * - doc-intelligence  → files, article URLs (text extracted), raw text, JSON, XML
 * - osint-subscribe   → RSS / Atom feed URLs (auto-creates feed subscription)
 * - text-ingest       → pasted text / notes (routes to doc-intelligence)
 * - manual            → ambiguous; returns accepted so frontend can show chips
 *
 * Broadcasts SSE events (classify:result, route:selected, route:error) through
 * the problem-set-wide SSE channel exported from doc-intelligence.ts.
 */

import { randomUUID } from 'crypto';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import { osintFeedStore } from '../jpp/osint-feed-store.js';
import { broadcastSSE } from '../api/doc-intelligence.js';
import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import { getPool } from '../lib/database.js';
import { createHash } from 'crypto';
import { createWiredDocIntelligenceGraph } from '../doc-intelligence/orchestrator-wiring.js';
import type { ProgressCallback } from '../doc-intelligence/orchestrator.js';
import type { IngestSubmitRequest, IngestSubmitResponse, ClassificationResult } from './types.js';
import { forwardEventToIronclaw } from '../ironclaw/event-forwarder.js';

const docParser = new DocumentParser();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeContentHash(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Persist a text document to strategic_documents and run it through the
 * doc-intelligence LangGraph orchestrator asynchronously.
 *
 * Returns the processingId immediately (202-style fire-and-forget).
 */
async function routeToDocIntelligence(
  problemSetId: string,
  documentText: string,
  metadata: Record<string, unknown>,
  processId: string,
): Promise<{ processId: string; documentId: string }> {
  const documentId = randomUUID();
  const pool = getPool();
  const contentHash = computeContentHash(documentText);
  const title = (metadata.originalName as string) ?? (metadata.filename as string) ?? `Document ${documentId.slice(0, 8)}`;

  // Duplicate detection — exact match only at this layer
  const exactResult = await pool.query(
    `SELECT id FROM strategic_documents WHERE workspace_id = $1 AND content_hash = $2 LIMIT 1`,
    [problemSetId, contentHash],
  );
  if (exactResult.rows.length > 0) {
    const dupErr = new Error('DUPLICATE_EXACT');
    (dupErr as NodeJS.ErrnoException).code = 'DUPLICATE_EXACT';
    throw dupErr;
  }

  // Persist document row
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
        documentId,
        title,
        (metadata.originalName as string) ?? (metadata.filename as string) ?? 'upload',
        (metadata.mimeType as string) ?? 'text/plain',
        documentText,
        documentText.length,
        'system',
        problemSetId,
        contentHash,
      ],
    );
  } catch (dbErr) {
    console.warn('[IngestRouter] Failed to persist document row:', dbErr);
  }

  // Async processing — fire and forget
  void (async () => {
    const onProgress: ProgressCallback = (event, data) => {
      broadcastSSE(problemSetId, event, { ...data, processId, documentId });
    };

    try {
      const problemSetContext = await getProblemSetContext(problemSetId);
      if (!problemSetContext) return; // interview_required already handled before this point

      const graph = await createWiredDocIntelligenceGraph({
        problemSetId,
        problemSetContext,
        onProgress,
      });

      const report = await graph.processDocument(documentId, documentText, metadata);

      // Persist report
      try {
        await pool.query(
          `INSERT INTO doc_intelligence_reports (document_id, problem_set_id, report, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (document_id, problem_set_id) DO UPDATE SET report = $3, updated_at = NOW()`,
          [documentId, problemSetId, JSON.stringify(report)],
        );
      } catch (dbErr) {
        console.warn('[IngestRouter] Failed to persist report:', dbErr);
      }

      // Update processing status
      try {
        await pool.query(
          `UPDATE strategic_documents
           SET processing_status = 'complete', processing_completed_at = NOW(), processing_error = NULL
           WHERE id = $1`,
          [documentId],
        );
      } catch (dbErr) {
        console.warn('[IngestRouter] Failed to update processing status:', dbErr);
      }

      // Geocode locations and create COP layer (best-effort, non-blocking)
      // Gate: skip if trust-flagged (graphIngestionBlocked)
      if (!report.graphIngestionBlocked) {
        try {
          const { geocodingService } = await import('../lib/geocoding-service.js');
          const locations = await geocodingService.extractLocations(documentText.slice(0, 4000));
          if (locations.length > 0) {
            const { updateDocIntelCOPLayer } = await import('../doc-intelligence/doc-cop-pipeline.js');
            const copResult = await updateDocIntelCOPLayer(problemSetId, report, locations, metadata);
            if (copResult) {
              broadcastSSE(problemSetId, 'cop:doc_layer_updated', {
                processId,
                documentId,
                symbolCount: copResult.symbolCount,
                layerSectionId: copResult.layerSectionId,
              });
            }
          }
        } catch (copErr) {
          console.warn('[IngestRouter] COP layer creation failed (non-fatal):', copErr);
        }
      }

      // Phase 65: Forward event to Ironclaw for autonomous monitoring (batched, fire-and-forget)
      try {
        const docTitle = String(metadata?.originalName ?? metadata?.title ?? documentId);
        forwardEventToIronclaw({
          type: 'document_processed',
          problemSetId,
          summary: `Document processed: ${docTitle}`,
        });
      } catch {
        // forwardEventToIronclaw already swallows errors; this is an extra safety guard
      }

      onProgress('processing:complete', {
        processId,
        documentId,
        reportId: documentId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[IngestRouter] Doc-intelligence pipeline error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      broadcastSSE(problemSetId, 'route:error', {
        processId,
        error: errMsg,
        retryable: false,
      });

      try {
        await pool.query(
          `UPDATE strategic_documents SET processing_status = 'error', processing_error = $1 WHERE id = $2`,
          [errMsg, documentId],
        );
      } catch { /* best-effort */ }
    }
  })();

  return { processId, documentId };
}

/**
 * Attempt a pipeline call with one automatic retry on transient failure.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  problemSetId: string,
  processId: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // 4xx errors are not retryable
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) throw err;

    broadcastSSE(problemSetId, 'route:error', {
      processId,
      error: err instanceof Error ? err.message : String(err),
      retryable: true,
    });

    // Single retry after 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
    const result = await fn();
    broadcastSSE(problemSetId, 'route:retry_success', { processId });
    return result;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Route an already-classified ingest submission to the correct pipeline.
 *
 * @param request        Original submission payload
 * @param classification Classification result from classifyInput()
 */
export async function routeToProcess(
  request: IngestSubmitRequest,
  classification: ClassificationResult,
): Promise<IngestSubmitResponse> {
  const { problemSetId } = request;
  const processId = randomUUID();

  // Broadcast classification result to SSE stream
  broadcastSSE(problemSetId, 'classify:result', {
    processId,
    classification,
  });

  // ── ProblemSetContext gate (required for doc-intelligence and text-ingest) ──
  const needsContext =
    classification.suggestedPipeline === 'doc-intelligence' ||
    classification.suggestedPipeline === 'text-ingest';

  if (needsContext) {
    const ctx = await getProblemSetContext(problemSetId);
    if (!ctx) {
      return {
        processId,
        classification,
        status: 'interview_required',
      };
    }
  }

  // Broadcast routing decision
  broadcastSSE(problemSetId, 'route:selected', {
    processId,
    pipeline: classification.suggestedPipeline,
    target:
      classification.suggestedPipeline === 'osint-subscribe'
        ? 'osint-feed-store'
        : 'doc-intelligence-graph',
  });

  // ─── Route by pipeline ────────────────────────────────────────────────────

  switch (classification.suggestedPipeline) {

    // ── doc-intelligence: files, article URLs, JSON, XML, PDF URLs ──────────
    case 'doc-intelligence': {
      let documentText: string;
      let metadata: Record<string, unknown> = {};

      if (request.fileBuffer) {
        // Binary file — parse through DocumentParser
        const parsed = await withRetry(
          () => docParser.parse(request.fileBuffer!, request.mimeType ?? 'application/octet-stream'),
          problemSetId,
          processId,
        );
        documentText = parsed.text;
        metadata = {
          originalName: request.filename ?? 'upload',
          mimeType: request.mimeType ?? 'application/octet-stream',
          pageCount: parsed.pageCount,
        };
      } else if (classification.inputType === 'article_url' && request.content) {
        // Article URL — extract text from HTML
        const url = request.content.trim();
        let htmlBody: string;
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(15_000),
            headers: { 'User-Agent': 'Bastion Intelligence Ingest/1.0' },
          });
          htmlBody = await res.text();
        } catch (fetchErr) {
          console.warn('[IngestRouter] Article URL fetch failed:', fetchErr);
          htmlBody = '';
        }

        // Extract text from HTML body
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM(htmlBody);
        documentText = dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const titleEl = dom.window.document.querySelector('title');
        metadata = {
          originalName: classification.metadata.title ?? titleEl?.textContent ?? 'article',
          mimeType: 'text/plain',
          sourceUrl: url,
          title: classification.metadata.title ?? titleEl?.textContent,
          description: classification.metadata.description,
        };
      } else if (classification.inputType === 'pdf_url' && request.content) {
        // PDF URL — download then parse
        const url = request.content.trim();
        let pdfBuffer: Buffer;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
          pdfBuffer = Buffer.from(await res.arrayBuffer());
        } catch (fetchErr) {
          console.warn('[IngestRouter] PDF URL fetch failed:', fetchErr);
          return { processId, classification, status: 'accepted' };
        }
        const parsed = await docParser.parse(pdfBuffer, 'application/pdf');
        documentText = parsed.text;
        metadata = {
          originalName: url.split('/').pop() ?? 'document.pdf',
          mimeType: 'application/pdf',
          sourceUrl: url,
          pageCount: parsed.pageCount,
        };
      } else {
        // Raw text / JSON / XML
        documentText = request.content ?? '';
        metadata = {
          originalName: request.filename ?? `document-${Date.now()}.txt`,
          mimeType: request.mimeType ?? 'text/plain',
        };
      }

      if (!documentText.trim()) {
        return { processId, classification, status: 'accepted' };
      }

      try {
        await withRetry(
          () => routeToDocIntelligence(problemSetId, documentText, metadata, processId),
          problemSetId,
          processId,
        );
      } catch (err) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'DUPLICATE_EXACT') {
          return { processId, classification, status: 'duplicate' };
        }
        throw err;
      }

      return { processId, classification, status: 'accepted' };
    }

    // ── osint-subscribe: RSS / Atom feeds ───────────────────────────────────
    case 'osint-subscribe': {
      const feedUrl = classification.metadata.feedUrl ?? request.content ?? '';
      const feedName = classification.metadata.title ?? 'Auto-detected feed';

      const feed = await withRetry(
        () =>
          osintFeedStore.createFeed({
            problemSetId,
            sourceName: feedName,
            sourceType: 'rss',
            endpointUrl: feedUrl,
            pollingIntervalMs: 900_000, // 15 min
            relevanceMode: 'entity_objective',
          }),
        problemSetId,
        processId,
      );

      broadcastSSE(problemSetId, 'route:selected', {
        processId,
        pipeline: 'osint-subscribe',
        target: 'osint-feed-store',
        feedId: feed.id,
      });

      return {
        processId: feed.id,
        classification,
        status: 'accepted',
      };
    }

    // ── text-ingest: pasted notes, freeform text ─────────────────────────────
    case 'text-ingest': {
      const documentText = request.content ?? '';
      const metadata: Record<string, unknown> = {
        originalName: request.filename ?? `pasted-text-${Date.now()}.txt`,
        mimeType: 'text/plain',
      };

      if (!documentText.trim()) {
        return { processId, classification, status: 'accepted' };
      }

      try {
        await withRetry(
          () => routeToDocIntelligence(problemSetId, documentText, metadata, processId),
          problemSetId,
          processId,
        );
      } catch (err) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'DUPLICATE_EXACT') {
          return { processId, classification, status: 'duplicate' };
        }
        throw err;
      }

      return { processId, classification, status: 'accepted' };
    }

    // ── manual: ambiguous — front end shows smart suggestion chips ───────────
    case 'manual':
    default: {
      return { processId, classification, status: 'accepted' };
    }
  }
}

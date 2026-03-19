/**
 * Validation REST API Router
 *
 * Phase 31 Plan 03: Express routes for validation runs, dashboard,
 * agent scores, threshold management, reinstatement, and data export.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';

import { validationRunner } from './validation-runner.js';
import { validationStore } from './validation-store.js';
import { circuitBreaker } from './circuit-breaker.js';
import type { ThresholdConfigRow } from './validation-types.js';

export const validationRouter = Router();

// ---------------------------------------------------------------------------
// POST /runs — trigger manual validation run
// ---------------------------------------------------------------------------

validationRouter.post('/runs', async (req: Request, res: Response) => {
  try {
    const { triggeredBy } = req.body as { triggeredBy?: string };
    const userId = triggeredBy ?? (req as unknown as Record<string, unknown>).userDID as string ?? 'manual';

    // Create run record immediately
    const run = await validationStore.createRun(userId);

    // Start run in background (don't block response)
    setImmediate(() => {
      validationRunner.executeFullRun(userId).catch((err) => {
        console.error('[ValidationRouter] Background run failed:', err);
      });
    });

    res.status(202).json({ runId: run.id, status: 'started' });
  } catch (err) {
    console.error('[ValidationRouter] POST /runs error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /runs — list recent runs
// ---------------------------------------------------------------------------

validationRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit ?? '20'), 10) || 20;
    const runs = await validationStore.getRecentRuns(limit);
    res.json(runs);
  } catch (err) {
    console.error('[ValidationRouter] GET /runs error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /runs/:runId — get run details with results
// ---------------------------------------------------------------------------

validationRouter.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.runId);
    const runs = await validationStore.getRecentRuns(100);
    const run = runs.find((r) => r.id === runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const results = await validationStore.getRunResults(runId);
    res.json({ run, results });
  } catch (err) {
    console.error('[ValidationRouter] GET /runs/:runId error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — dashboard summary
// ---------------------------------------------------------------------------

validationRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const summaries = await validationStore.getDashboardSummaries();
    res.json(summaries);
  } catch (err) {
    console.error('[ValidationRouter] GET /dashboard error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /agents/:agentId/scores — agent score history
// ---------------------------------------------------------------------------

validationRouter.get(
  '/agents/:agentId/scores',
  async (req: Request, res: Response) => {
    try {
      const agentId = String(req.params.agentId);
      const category = String(req.query.category ?? 'determinism');
      const limit = parseInt(String(req.query.limit ?? '50'), 10) || 50;
      const scores = await validationStore.getAgentScoreHistory(
        agentId,
        category,
        limit,
      );
      res.json(scores);
    } catch (err) {
      console.error('[ValidationRouter] GET /agents/:agentId/scores error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /agents/:agentId/circuit-events — circuit breaker history
// ---------------------------------------------------------------------------

validationRouter.get(
  '/agents/:agentId/circuit-events',
  async (req: Request, res: Response) => {
    try {
      const agentId = String(req.params.agentId);
      const events = await validationStore.getCircuitEvents(agentId);
      res.json(events);
    } catch (err) {
      console.error('[ValidationRouter] GET /agents/:agentId/circuit-events error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /thresholds — get all thresholds
// ---------------------------------------------------------------------------

validationRouter.get('/thresholds', async (req: Request, res: Response) => {
  try {
    const scopeType = req.query.scopeType ? String(req.query.scopeType) : undefined;
    const scopeId = req.query.scopeId ? String(req.query.scopeId) : undefined;
    const thresholds = await validationStore.getThresholds(scopeType, scopeId);
    res.json(thresholds);
  } catch (err) {
    console.error('[ValidationRouter] GET /thresholds error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /thresholds — upsert threshold
// ---------------------------------------------------------------------------

validationRouter.put('/thresholds', async (req: Request, res: Response) => {
  try {
    const body = req.body as Omit<ThresholdConfigRow, 'id' | 'updated_at'>;
    await validationStore.upsertThreshold(body);

    // Return updated thresholds for this scope
    const thresholds = await validationStore.getThresholds(
      body.scope_type,
      body.scope_id ?? undefined,
    );
    const updated = thresholds.find((t) => t.category === body.category);
    res.json(updated ?? body);
  } catch (err) {
    console.error('[ValidationRouter] PUT /thresholds error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /agents/:agentId/reinstate — reinstate disabled agent
// ---------------------------------------------------------------------------

validationRouter.post(
  '/agents/:agentId/reinstate',
  async (req: Request, res: Response) => {
    try {
      const agentId = String(req.params.agentId);
      const { justification } = req.body as { justification?: string };
      const userId = String(
        (req as unknown as Record<string, unknown>).userDID ?? 'admin',
      );

      const result = await circuitBreaker.reinstateAgent(
        agentId,
        userId,
        justification,
      );

      res.json({
        reinstated: result.reinstated,
        reason: result.reason,
      });
    } catch (err) {
      console.error('[ValidationRouter] POST /agents/:agentId/reinstate error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /override-status — check if validation override is active
// ---------------------------------------------------------------------------

validationRouter.get('/override-status', (_req: Request, res: Response) => {
  res.json({ overrideActive: circuitBreaker.overrideActive });
});

// ---------------------------------------------------------------------------
// POST /override-all — enable override: reinstate ALL disabled agents
// ---------------------------------------------------------------------------

validationRouter.post('/override-all', async (req: Request, res: Response) => {
  try {
    const { justification } = req.body as { justification?: string };
    const userId = String(
      (req as unknown as Record<string, unknown>).userDID ?? 'admin',
    );

    if (!justification || !justification.trim()) {
      res.status(400).json({
        error: 'Justification is required for bulk validation override',
      });
      return;
    }

    const result = await circuitBreaker.overrideAll(userId, justification.trim());

    res.json({
      reinstatedCount: result.reinstatedCount,
      agentIds: result.agentIds,
    });
  } catch (err) {
    console.error('[ValidationRouter] POST /override-all error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /override-disable — disable override: re-enable validation enforcement
// ---------------------------------------------------------------------------

validationRouter.post('/override-disable', async (req: Request, res: Response) => {
  try {
    const userId = String(
      (req as unknown as Record<string, unknown>).userDID ?? 'admin',
    );

    await circuitBreaker.disableOverride(userId);

    res.json({
      overrideActive: false,
      message: 'Validation override disabled. Re-evaluation started.',
    });
  } catch (err) {
    console.error('[ValidationRouter] POST /override-disable error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /export/:format — export validation data as CSV or PDF
// ---------------------------------------------------------------------------

validationRouter.get(
  '/export/:format',
  async (req: Request, res: Response) => {
    try {
      const format = String(req.params.format);
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;

      // Get all results (limited by query params)
      const runs = await validationStore.getRecentRuns(100);
      const allResults: Array<Record<string, unknown>> = [];

      for (const run of runs) {
        // Filter by date range
        if (from && new Date(run.started_at) < new Date(from)) continue;
        if (to && new Date(run.started_at) > new Date(to)) continue;

        const results = await validationStore.getRunResults(run.id);
        for (const result of results) {
          if (agentId && result.agent_id !== agentId) continue;
          allResults.push({
            run_id: result.run_id,
            agent_id: result.agent_id,
            scenario_id: result.scenario_id,
            category: result.category,
            functional_score: result.functional_score,
            llm_judge_score: result.llm_judge_score,
            combined_score: result.combined_score,
            disagreement: result.disagreement,
            created_at: result.created_at,
          });
        }
      }

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="validation-results.csv"',
        );

        // Header
        const headers = [
          'run_id',
          'agent_id',
          'scenario_id',
          'category',
          'functional_score',
          'llm_judge_score',
          'combined_score',
          'disagreement',
          'created_at',
        ];
        res.write(headers.join(',') + '\n');

        // Rows
        for (const row of allResults) {
          const values = headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(','))
              return `"${val}"`;
            return String(val);
          });
          res.write(values.join(',') + '\n');
        }

        res.end();
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="validation-report.pdf"',
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // Title page
        doc.fontSize(24).text('Validation Report', { align: 'center' });
        doc.moveDown();
        doc
          .fontSize(12)
          .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown();

        if (agentId) {
          doc.text(`Agent: ${agentId}`, { align: 'center' });
        }
        if (from || to) {
          doc.text(
            `Period: ${from ?? 'start'} to ${to ?? 'now'}`,
            { align: 'center' },
          );
        }
        doc.moveDown(2);

        // Summary section
        doc.fontSize(16).text('Summary');
        doc.moveDown(0.5);
        doc.fontSize(10);

        // Get dashboard summaries for the summary page
        const dashboardData = await validationStore.getDashboardSummaries();

        // Agent grid
        doc.fontSize(14).text('Agent Scores');
        doc.moveDown(0.5);

        const tableHeader = 'Agent ID | Determinism | Reliability | Authority | Status';
        doc.fontSize(9).text(tableHeader);
        doc.text('─'.repeat(70));

        for (const summary of dashboardData) {
          if (agentId && summary.agentId !== agentId) continue;

          const det =
            summary.categories.determinism?.avgScore?.toFixed(3) ?? 'N/A';
          const rel =
            summary.categories.reliability?.avgScore?.toFixed(3) ?? 'N/A';
          const auth =
            summary.categories.authority?.avgScore?.toFixed(3) ?? 'N/A';

          doc.text(
            `${summary.agentId.padEnd(20)} | ${det.padEnd(11)} | ${rel.padEnd(11)} | ${auth.padEnd(9)} | ${summary.overallStatus}`,
          );
        }

        doc.moveDown();

        // Per-agent detail pages with results tables
        if (allResults.length > 0) {
          doc.addPage();
          doc.fontSize(14).text('Detailed Results');
          doc.moveDown(0.5);

          const detailHeader =
            'Scenario ID | Category | Functional | LLM Judge | Combined | Disagree';
          doc.fontSize(8).text(detailHeader);
          doc.text('─'.repeat(80));

          for (const row of allResults.slice(0, 200)) {
            // Cap at 200 rows for PDF
            doc.text(
              `${String(row.scenario_id).padEnd(12).substring(0, 12)} | ${String(row.category).padEnd(12)} | ${String(row.functional_score ?? '').padEnd(10)} | ${String(row.llm_judge_score ?? '').padEnd(9)} | ${String(row.combined_score ?? '').padEnd(8)} | ${row.disagreement ? 'YES' : 'no'}`,
            );
          }

          if (allResults.length > 200) {
            doc.moveDown();
            doc.text(`... and ${allResults.length - 200} more results`);
          }
        }

        // Circuit events table
        if (agentId) {
          const events = await validationStore.getCircuitEvents(agentId);
          if (events.length > 0) {
            doc.addPage();
            doc.fontSize(14).text(`Circuit Events: ${agentId}`);
            doc.moveDown(0.5);

            doc
              .fontSize(8)
              .text('Event Type | Category | Previous | New | Triggered By | Date');
            doc.text('─'.repeat(80));

            for (const evt of events) {
              doc.text(
                `${evt.event_type.padEnd(12)} | ${evt.category.padEnd(12)} | ${evt.previous_state.padEnd(8)} | ${evt.new_state.padEnd(8)} | ${evt.triggered_by.padEnd(14)} | ${evt.created_at.substring(0, 10)}`,
              );
            }
          }
        }

        doc.end();
      } else {
        res.status(400).json({ error: `Unsupported format: ${format}` });
      }
    } catch (err) {
      console.error('[ValidationRouter] GET /export/:format error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

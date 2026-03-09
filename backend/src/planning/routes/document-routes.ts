/**
 * Document Generation, Versioning, and Distribution Routes
 *
 * Phase 33 Plan 10: REST API for document export, version lifecycle,
 * and distribution to subordinate problem sets.
 *
 * Endpoints:
 * - POST /generate          - Generate PDF/DOCX document
 * - POST /versions          - Create version snapshot
 * - GET  /:planId/versions  - List version history
 * - POST /distribute        - Distribute to subordinate problem sets
 * - GET  /:planId/distributions - Distribution history
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { generatePlanDocument, type DocumentFormat } from '../document-generator.js';
import type { PlanType, AnnexLetter } from '../types.js';

export const documentRouter = Router({ mergeParams: true });

// ─── In-memory stores (production: move to PostgreSQL) ──────────────────────

interface VersionRecord {
  versionId: string;
  planId: string;
  status: 'draft' | 'coordinating_draft' | 'final';
  notes?: string;
  createdAt: string;
  createdBy: string;
  snapshotRef?: string;
}

interface DistributionRecord {
  distributionId: string;
  planId: string;
  versionId: string;
  targetProblemSetId: string;
  status: 'delivered' | 'pending' | 'failed';
  distributedAt: string;
  distributedBy: string;
}

const versionRecords: VersionRecord[] = [];
const distributionRecords: DistributionRecord[] = [];

// ─── 1. Generate Document ───────────────────────────────────────────────────

documentRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { planId, format, includeAnnexes } = req.body;

    if (!planId || !format) {
      res.status(400).json({ error: 'planId and format are required' });
      return;
    }

    if (!['pdf', 'docx'].includes(format)) {
      res.status(400).json({ error: 'format must be "pdf" or "docx"' });
      return;
    }

    // Infer plan type from body or default to OPLAN
    const planType = (req.body.planType as PlanType | 'CAMPAIGN_PLAN') || 'OPLAN';
    const classification = (req.body.classification as string) || 'UNCLASSIFIED';

    const doc = await generatePlanDocument({
      planId,
      planType,
      format: format as DocumentFormat,
      classification,
      includeAnnexes: includeAnnexes as AnnexLetter[] | undefined,
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.setHeader('Content-Length', doc.size.toString());
    res.send(doc.buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate document';
    res.status(500).json({ error: message });
  }
});

// ─── 2. Create Version ─────────────────────────────────────────────────────

documentRouter.post('/versions', async (req: Request, res: Response) => {
  try {
    const { planId, status, notes } = req.body;

    if (!planId || !status) {
      res.status(400).json({ error: 'planId and status are required' });
      return;
    }

    const validStatuses = ['draft', 'coordinating_draft', 'final'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const createdBy = (req.headers['x-did'] as string) || 'anonymous';

    const version: VersionRecord = {
      versionId: `VER-${randomUUID()}`,
      planId,
      status,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
      createdBy,
      snapshotRef: `snapshot-${planId}-${Date.now()}`,
    };

    versionRecords.push(version);

    res.status(201).json({
      versionId: version.versionId,
      status: version.status,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create version';
    res.status(500).json({ error: message });
  }
});

// ─── 3. List Versions ──────────────────────────────────────────────────────

documentRouter.get('/:planId/versions', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const versions = versionRecords
      .filter((v) => v.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(versions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list versions';
    res.status(500).json({ error: message });
  }
});

// ─── 4. Distribute Plan ────────────────────────────────────────────────────

documentRouter.post('/distribute', async (req: Request, res: Response) => {
  try {
    const { planId, versionId, targetProblemSetIds } = req.body;

    if (!planId || !versionId || !targetProblemSetIds?.length) {
      res.status(400).json({
        error: 'planId, versionId, and targetProblemSetIds (non-empty array) are required',
      });
      return;
    }

    // Verify version exists and is final
    const version = versionRecords.find((v) => v.versionId === versionId);
    if (!version) {
      res.status(404).json({ error: `Version ${versionId} not found` });
      return;
    }
    if (version.status !== 'final') {
      res.status(400).json({ error: 'Only final versions can be distributed' });
      return;
    }

    const distributedBy = (req.headers['x-did'] as string) || 'anonymous';
    const distributionId = `DIST-${randomUUID()}`;
    const now = new Date().toISOString();

    const targets: Array<{ problemSetId: string; status: string }> = [];

    for (const targetId of targetProblemSetIds as string[]) {
      const record: DistributionRecord = {
        distributionId,
        planId,
        versionId,
        targetProblemSetId: targetId,
        status: 'delivered',
        distributedAt: now,
        distributedBy,
      };
      distributionRecords.push(record);
      targets.push({ problemSetId: targetId, status: 'delivered' });
    }

    res.status(201).json({
      distributionId,
      targets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to distribute plan';
    res.status(500).json({ error: message });
  }
});

// ─── 5. Distribution History ────────────────────────────────────────────────

documentRouter.get('/:planId/distributions', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const distributions = distributionRecords
      .filter((d) => d.planId === planId)
      .sort((a, b) => new Date(b.distributedAt).getTime() - new Date(a.distributedAt).getTime());

    res.json(distributions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list distributions';
    res.status(500).json({ error: message });
  }
});

/**
 * PIR/CCIR REST API Routes
 *
 * Express routes for /api/pirs/*
 * CRUD operations for Priority Intelligence Requirements,
 * Commander's Critical Information Requirements, Friendly Force
 * Information Requirements, and Essential Elements of Friendly Information.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { pirStore } from '../design/pir-store.js';
import type { PIRType, PIRStatus } from '../design/pir-store.js';
import { gapFillerService } from '../ironclaw/gap-filler-service.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/pirs?problemSetId=X&type=CCIR&status=ACTIVE
// ---------------------------------------------------------------------------

router.get('/', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.query.problemSetId as string;
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }

    const filters: { type?: PIRType; status?: PIRStatus } = {};
    if (req.query.type) filters.type = req.query.type as PIRType;
    if (req.query.status) filters.status = req.query.status as PIRStatus;

    const pirs = await pirStore.listPIRs(problemSetId, filters);
    return res.json({ pirs });
  } catch (err) {
    console.error('[pir-routes] GET / failed:', err);
    return res.status(500).json({ error: 'Failed to list PIRs' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pirs
// ---------------------------------------------------------------------------

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      problemSetId,
      type,
      description,
      priority,
      sourceType,
      sourceId,
      linkedAssumptionIds,
      linkedObjectiveIds,
      createdBy,
    } = req.body;

    if (!problemSetId || !type || !description) {
      return res.status(400).json({
        error: 'problemSetId, type, and description are required',
      });
    }

    const validTypes: PIRType[] = ['CCIR', 'PIR', 'FFIR', 'EEFI'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    const pir = await pirStore.createPIR({
      problemSetId,
      type,
      description,
      priority,
      sourceType,
      sourceId,
      linkedAssumptionIds,
      linkedObjectiveIds,
      createdBy: createdBy || 'user',
    });

    return res.status(201).json({ pir });
  } catch (err) {
    console.error('[pir-routes] POST / failed:', err);
    return res.status(500).json({ error: 'Failed to create PIR' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/pirs/:id
// ---------------------------------------------------------------------------

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const pir = await pirStore.updatePIR(id as string, updates);
    if (!pir) {
      return res.status(404).json({ error: `PIR ${id} not found` });
    }

    return res.json({ pir });
  } catch (err) {
    console.error('[pir-routes] PUT /:id failed:', err);
    return res.status(500).json({ error: 'Failed to update PIR' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/pirs/:id
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await pirStore.deletePIR(id as string);
    if (!deleted) {
      return res.status(404).json({ error: `PIR ${id} not found` });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[pir-routes] DELETE /:id failed:', err);
    return res.status(500).json({ error: 'Failed to delete PIR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pirs/:id/answer
// ---------------------------------------------------------------------------

router.post('/:id/answer', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { answer, answeredBy } = req.body;

    if (!answer) {
      return res.status(400).json({ error: 'answer is required' });
    }

    const pir = await pirStore.updatePIR(id as string, {
      answer,
      answeredBy: answeredBy || 'user',
      status: 'ANSWERED',
    });

    if (!pir) {
      return res.status(404).json({ error: `PIR ${id} not found` });
    }

    return res.json({ pir });
  } catch (err) {
    console.error('[pir-routes] POST /:id/answer failed:', err);
    return res.status(500).json({ error: 'Failed to answer PIR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pirs/:id/link-assumption
// ---------------------------------------------------------------------------

router.post('/:id/link-assumption', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assumptionId } = req.body;

    if (!assumptionId) {
      return res.status(400).json({ error: 'assumptionId is required' });
    }

    const pir = await pirStore.linkAssumption(id as string, assumptionId as string);
    if (!pir) {
      return res.status(404).json({ error: `PIR ${id} not found` });
    }

    return res.json({ pir });
  } catch (err) {
    console.error('[pir-routes] POST /:id/link-assumption failed:', err);
    return res.status(500).json({ error: 'Failed to link assumption' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pirs/:id/research-status
// ---------------------------------------------------------------------------

router.get('/:id/research-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pir = await pirStore.getPIR(id as string);
    if (!pir) {
      return res.status(404).json({ error: `PIR ${id} not found` });
    }

    // Check if the gap filler is actively monitoring this problem set
    const gapStatus = gapFillerService.getStatus(pir.problemSetId);

    return res.json({
      pirId: id,
      pirStatus: pir.status,
      gapFillerMonitoring: gapStatus.isMonitored,
      gapFillerRunning: gapStatus.isRunning,
      lastGapFillerRun: gapStatus.lastRunAt,
      nextScheduledRun: gapStatus.nextScheduledRun,
    });
  } catch (err) {
    console.error('[pir-routes] GET /:id/research-status failed:', err);
    return res.status(500).json({ error: 'Failed to get research status' });
  }
});

export default router;

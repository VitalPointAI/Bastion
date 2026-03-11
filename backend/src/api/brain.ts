/**
 * Brain API Router
 *
 * REST endpoints for brain visualization features:
 * annotations, snapshots, historical graph queries,
 * intelligence gap detection, and pattern alerts.
 */

import { Router, type Request, type Response } from 'express';
import { brainStore } from '../brain/brain-store.js';
import type { CreateAnnotationInput, UpdateAnnotationInput, CreateSnapshotInput } from '../brain/brain-types.js';

const router = Router();

/**
 * Helper to extract string value from query param (handles arrays)
 */
function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

// =====================
// ANNOTATION ENDPOINTS
// =====================

// GET /api/brain/annotations?problemSetId=X
// Returns annotations for the given problem set visible to the requesting user
router.get('/annotations', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const annotations = await brainStore.getAnnotations(problemSetId, userId);
    res.json({ annotations });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/annotations
// Create a new annotation
router.post('/annotations', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: CreateAnnotationInput = {
      ...req.body,
      createdBy: userId,
    };
    if (!input.nodeId || !input.nodeType || !input.annotationType || !input.problemSetId) {
      return res.status(400).json({ error: 'nodeId, nodeType, annotationType, and problemSetId are required' });
    }
    const annotation = await brainStore.createAnnotation(input);
    res.status(201).json(annotation);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// PUT /api/brain/annotations/:id
// Update an annotation (owner only)
router.put('/annotations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: UpdateAnnotationInput = req.body;
    const updated = await brainStore.updateAnnotation(id, userId, input);
    if (!updated) {
      return res.status(404).json({ error: 'Annotation not found or not owned by user' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// DELETE /api/brain/annotations/:id
// Delete an annotation (owner only)
router.delete('/annotations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const deleted = await brainStore.deleteAnnotation(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Annotation not found or not owned by user' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// SNAPSHOT ENDPOINTS
// =====================

// GET /api/brain/snapshots?problemSetId=X
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const snapshots = await brainStore.getSnapshots(problemSetId);
    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/snapshots
// Save a new AI context snapshot
router.post('/snapshots', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: CreateSnapshotInput = {
      ...req.body,
      createdBy: userId,
    };
    if (!input.problemSetId || !input.title || !input.summary) {
      return res.status(400).json({ error: 'problemSetId, title, and summary are required' });
    }
    const snapshot = await brainStore.createSnapshot(input);
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// GET /api/brain/snapshots/:id
router.get('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const snapshot = await brainStore.getSnapshot(id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/brain/snapshots/:id
router.delete('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await brainStore.deleteSnapshot(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// HISTORICAL GRAPH ENDPOINT
// =====================

// GET /api/brain/graph-snapshot?problemSetId=X&at=ISO_TIMESTAMP
// Returns the graph state as it existed at the given timestamp
router.get('/graph-snapshot', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    const at = getQueryString(req.query.at);
    if (!problemSetId || !at) {
      return res.status(400).json({ error: 'problemSetId and at (ISO timestamp) query parameters are required' });
    }
    const graphState = await brainStore.getGraphAtTime(problemSetId, at);
    res.json(graphState);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GAP DETECTION ENDPOINT
// =====================

// GET /api/brain/gaps?problemSetId=X
// Returns under-connected nodes representing intelligence gaps
router.get('/gaps', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const report = await brainStore.getIntelligenceGaps(problemSetId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// PATTERN ALERTS ENDPOINT
// =====================

// GET /api/brain/pattern-alerts?problemSetId=X
// Returns detected trends and anomalies in the graph
router.get('/pattern-alerts', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const alerts = await brainStore.getPatternAlerts(problemSetId);
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
export { router as brainRouter };

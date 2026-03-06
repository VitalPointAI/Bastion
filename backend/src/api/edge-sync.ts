import express from 'express';
import { processSyncRequest, getSyncDelta } from '../lib/edge-sync.js';

const router = express.Router();

/**
 * POST /api/edge/sync - Push operations from edge device
 */
router.post('/sync', async (req, res) => {
  const { device_id, operations } = req.body;

  if (!device_id || !operations || !Array.isArray(operations)) {
    return res.status(400).json({
      error: 'Missing required fields: device_id, operations'
    });
  }

  // TODO: Authenticate edge device (NEAR account signature)

  try {
    const result = await processSyncRequest(device_id, operations);
    res.json(result);
  } catch (error: unknown) {
    console.error('Edge sync error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Edge sync error' });
  }
});

/**
 * GET /api/edge/sync/delta - Pull updates for edge device
 */
router.get('/sync/delta', async (req, res) => {
  const { device_id, since } = req.query;

  if (!device_id || !since) {
    return res.status(400).json({
      error: 'Missing required query params: device_id, since'
    });
  }

  try {
    const updates = await getSyncDelta(device_id as string, since as string);
    res.json({ updates });
  } catch (error: unknown) {
    console.error('Edge delta sync error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Edge delta sync error' });
  }
});

export default router;

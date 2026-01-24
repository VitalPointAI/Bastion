/**
 * Resource Management API
 *
 * Phase 4.4 Plan 06: REST API for resource catalog, personnel, and consumables
 */

import { Router, type Request, type Response } from 'express';
import { resourceStore } from '../resources/resource-store.js';
import { personnelStore } from '../resources/personnel-store.js';
import { consumableStore } from '../resources/consumable-store.js';
import type { ResourceCategory, ResourceStatus, ConsumableCategory } from '../resources/types.js';

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
// RESOURCE CATALOG ENDPOINTS
// =====================

// List resources with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    const category = getQueryString(req.query.category) as ResourceCategory | undefined;
    const status = getQueryString(req.query.status) as ResourceStatus | undefined;

    const resources = await resourceStore.listResources({
      missionId,
      category,
      status,
    });

    res.json({ resources });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get single resource
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const resource = await resourceStore.getResource(req.params.id as string);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create resource
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      missionId,
      name,
      category,
      status,
      specifications,
      serialNumber,
      sidc,
      location,
    } = req.body;

    const resource = await resourceStore.createResource(
      missionId,
      name,
      category,
      status,
      specifications || {},
      serialNumber,
      sidc,
      location
    );

    res.status(201).json(resource);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update resource
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const resource = await resourceStore.getResource(req.params.id as string);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // For now, this is a placeholder - full update would require additional store method
    // The status update endpoint below handles the primary use case
    res.json({ success: true, message: 'Use /api/resources/:id/status for status updates' });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update resource status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const resource = await resourceStore.updateStatus(req.params.id as string, status);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete resource
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await resourceStore.deleteResource(req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Bulk import resources
router.post('/bulk-import', async (req: Request, res: Response) => {
  try {
    const { missionId, rows } = req.body;

    if (!missionId || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'missionId and rows array required' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const resource = await resourceStore.createResource(
          missionId,
          row.name,
          row.category,
          row.status || 'FMC',
          row.specifications || {},
          row.serialNumber,
          row.sidc,
          row.location
        );
        created.push(resource);
      } catch (error) {
        errors.push({ row: i, error: String(error) });
      }
    }

    res.status(201).json({
      success: true,
      created: created.length,
      errors: errors.length,
      resources: created,
      errorDetails: errors,
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// PERSONNEL ENDPOINTS
// =====================

// List personnel with filters
router.get('/personnel', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    const unitId = getQueryString(req.query.unitId);

    let personnel;
    if (unitId) {
      personnel = await personnelStore.listByUnit(unitId);
    } else if (missionId) {
      personnel = await personnelStore.listByMission(missionId);
    } else {
      return res.status(400).json({ error: 'missionId or unitId required' });
    }

    res.json({ personnel });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get single personnel record
router.get('/personnel/:id', async (req: Request, res: Response) => {
  try {
    const personnel = await personnelStore.getPersonnel(req.params.id as string);
    if (!personnel) {
      return res.status(404).json({ error: 'Personnel not found' });
    }
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create personnel
router.post('/personnel', async (req: Request, res: Response) => {
  try {
    const {
      missionId,
      name,
      rank,
      specialty,
      readinessStatus,
      clearanceLevel,
      unitId,
    } = req.body;

    const personnel = await personnelStore.createPersonnel(
      missionId,
      name,
      rank,
      specialty,
      readinessStatus || 'ready',
      clearanceLevel || 'UNCLASS',
      unitId
    );

    res.status(201).json(personnel);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update personnel
router.patch('/personnel/:id', async (req: Request, res: Response) => {
  try {
    const personnel = await personnelStore.getPersonnel(req.params.id as string);
    if (!personnel) {
      return res.status(404).json({ error: 'Personnel not found' });
    }

    // Placeholder for full update - specific endpoints below handle primary use cases
    res.json({ success: true, message: 'Use specific endpoints for unit or readiness updates' });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Assign personnel to unit
router.patch('/personnel/:id/unit', async (req: Request, res: Response) => {
  try {
    const { unitId } = req.body;
    const personnel = await personnelStore.assignToUnit(req.params.id as string, unitId || null);

    if (!personnel) {
      return res.status(404).json({ error: 'Personnel not found' });
    }

    res.json(personnel);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete personnel
router.delete('/personnel/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await personnelStore.deletePersonnel(req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Personnel not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Bulk import personnel
router.post('/personnel/bulk-import', async (req: Request, res: Response) => {
  try {
    const { missionId, rows } = req.body;

    if (!missionId || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'missionId and rows array required' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const personnel = await personnelStore.createPersonnel(
          missionId,
          row.name,
          row.rank,
          row.specialty,
          row.readinessStatus || 'ready',
          row.clearanceLevel || 'UNCLASS',
          row.unitId
        );
        created.push(personnel);
      } catch (error) {
        errors.push({ row: i, error: String(error) });
      }
    }

    res.status(201).json({
      success: true,
      created: created.length,
      errors: errors.length,
      personnel: created,
      errorDetails: errors,
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// CONSUMABLE ENDPOINTS
// =====================

// List consumables with filters
router.get('/consumables', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    const category = getQueryString(req.query.category) as ConsumableCategory | undefined;

    const consumables = await consumableStore.listConsumables({
      missionId,
      category,
    });

    res.json({ consumables });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get single consumable
router.get('/consumables/:id', async (req: Request, res: Response) => {
  try {
    const consumable = await consumableStore.getConsumable(req.params.id as string);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }
    res.json(consumable);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create consumable
router.post('/consumables', async (req: Request, res: Response) => {
  try {
    const {
      missionId,
      category,
      name,
      quantity,
      unit,
      minimumLevel,
      currentLevel,
      location,
    } = req.body;

    const consumable = await consumableStore.createConsumable(
      missionId,
      category,
      name,
      quantity,
      unit,
      minimumLevel,
      currentLevel,
      location
    );

    res.status(201).json(consumable);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update consumable
router.patch('/consumables/:id', async (req: Request, res: Response) => {
  try {
    const consumable = await consumableStore.getConsumable(req.params.id as string);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }

    // Placeholder for full update - level endpoint below handles primary use case
    res.json({ success: true, message: 'Use /api/resources/consumables/:id/level for level updates' });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Update consumable level
router.patch('/consumables/:id/level', async (req: Request, res: Response) => {
  try {
    const { currentLevel } = req.body;
    if (currentLevel === undefined) {
      return res.status(400).json({ error: 'currentLevel is required' });
    }

    const consumable = await consumableStore.updateLevel(req.params.id as string, currentLevel);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }

    res.json(consumable);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete consumable
router.delete('/consumables/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await consumableStore.deleteConsumable(req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Consumable not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get low stock items
router.get('/consumables/low-stock', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    if (!missionId) {
      return res.status(400).json({ error: 'missionId required' });
    }

    const lowStock = await consumableStore.getLowStock(missionId);
    res.json({ lowStock });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

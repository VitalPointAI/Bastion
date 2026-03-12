/**
 * Resource Management API
 *
 * Phase 4.4 Plan 06: REST API for resource catalog, personnel, and consumables
 * Phase 27 Plan 04: Extended with registry, DID, group, and telemetry endpoints
 */

import { Router, type Request, type Response } from 'express';
import { resourceStore } from '../resources/resource-store.js';
import { personnelStore } from '../resources/personnel-store.js';
import { consumableStore } from '../resources/consumable-store.js';
import { getResourceRegistry } from '../resources/resource-registry.js';
import { resourceGroupStore } from '../resources/resource-group-store.js';
import { getResourceTelemetryService } from '../resources/resource-telemetry.js';
import { getPluginRegistry } from '../resources/plugins/plugin-registry.js';
import type { ResourceCategory, ResourceStatus, ConsumableCategory, ResourceManifest } from '../resources/types.js';

const router = Router();

/**
 * Helper to extract string value from query param (handles arrays)
 */
function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Helper to parse a query param as a number
 */
function getQueryNumber(value: unknown): number | undefined {
  const str = getQueryString(value);
  if (str === undefined) return undefined;
  const num = Number(str);
  return Number.isFinite(num) ? num : undefined;
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

// =====================
// REGISTRY ENDPOINTS (static routes BEFORE parametric /:id)
// =====================

// Search registry with multiple query modes
router.get('/registry/search', async (req: Request, res: Response) => {
  try {
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const capability = getQueryString(req.query.capability);
    const category = getQueryString(req.query.category) as ResourceCategory | undefined;
    const status = getQueryString(req.query.status) as ResourceStatus | undefined;
    const did = getQueryString(req.query.did);
    const north = getQueryNumber(req.query.north);
    const south = getQueryNumber(req.query.south);
    const east = getQueryNumber(req.query.east);
    const west = getQueryNumber(req.query.west);

    // DID lookup
    if (did) {
      const resource = registry.getByDID(did);
      return res.json({ resources: resource ? [resource] : [] });
    }

    // Capability search
    if (capability) {
      const resources = registry.findByCapability(capability);
      return res.json({ resources });
    }

    // Area search
    if (north !== undefined && south !== undefined && east !== undefined && west !== undefined) {
      const resources = registry.findInArea({ north, south, east, west });
      return res.json({ resources });
    }

    // Type + status search
    if (category || status) {
      const resources = registry.findByTypeAndStatus(category, status);
      return res.json({ resources });
    }

    // No filters — return all
    const resources = registry.getAllResources();
    return res.json({ resources });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// List all known capabilities across all plugins
router.get('/registry/capabilities', async (_req: Request, res: Response) => {
  try {
    const pluginRegistry = getPluginRegistry();
    await pluginRegistry.ensureInitialized();

    const allPlugins = pluginRegistry.getAllPlugins();
    const capSet = new Set<string>();
    for (const plugin of allPlugins) {
      for (const cap of plugin.capabilities) {
        capSet.add(cap);
      }
    }

    res.json({ capabilities: Array.from(capSet).sort() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Registry statistics
router.get('/registry/stats', async (_req: Request, res: Response) => {
  try {
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const all = registry.getAllResources();
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let autonomous = 0;
    let passive = 0;
    let withDID = 0;

    for (const r of all) {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.isAutonomous) {
        autonomous++;
      } else {
        passive++;
      }
      if (r.did) {
        withDID++;
      }
    }

    // Count total groups across all missions
    const allGroups = await resourceGroupStore.countAllGroups();

    res.json({
      total: all.length,
      byCategory,
      byStatus,
      autonomous,
      passive,
      withDID,
      groupCount: allGroups,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Register resource with full plugin treatment
router.post('/registry/register', async (req: Request, res: Response) => {
  try {
    const { name, category, missionId, specifications, isAutonomous, capabilities } = req.body;

    if (!name || !category || !missionId) {
      return res.status(400).json({ error: 'name, category, and missionId are required' });
    }

    const manifest: ResourceManifest = {
      name,
      category,
      missionId,
      specifications: specifications || {},
      isAutonomous: isAutonomous ?? false,
      capabilities: capabilities || [],
    };

    const registry = getResourceRegistry();
    const registered = await registry.registerResource(manifest);
    res.status(201).json(registered);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// DID ENDPOINTS (static routes BEFORE parametric /:id)
// =====================

// Resolve resource by DID
router.get('/did/:did', async (req: Request, res: Response) => {
  try {
    const did = decodeURIComponent(req.params.did as string);
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const resource = registry.getByDID(did);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found for DID' });
    }

    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GROUP ENDPOINTS (static routes BEFORE parametric /:id)
// =====================

// List groups for a mission
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    if (!missionId) {
      return res.status(400).json({ error: 'missionId query parameter is required' });
    }

    const groups = await resourceGroupStore.listGroups(missionId);
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create group
router.post('/groups', async (req: Request, res: Response) => {
  try {
    const { missionId, name, groupType, description, parentGroupId } = req.body;

    if (!missionId || !name || !groupType) {
      return res.status(400).json({ error: 'missionId, name, and groupType are required' });
    }

    const group = await resourceGroupStore.createGroup(
      missionId,
      name,
      groupType,
      description,
      parentGroupId
    );

    res.status(201).json(group);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get group with member count
router.get('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const group = await resourceGroupStore.getGroupWithMemberCount(req.params.groupId as string);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// List group members
router.get('/groups/:groupId/members', async (req: Request, res: Response) => {
  try {
    const group = await resourceGroupStore.getGroup(req.params.groupId as string);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const members = await resourceGroupStore.getGroupMembers(req.params.groupId as string);
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Add resource to group
router.post('/groups/:groupId/members', async (req: Request, res: Response) => {
  try {
    const { resourceId } = req.body;
    if (!resourceId) {
      return res.status(400).json({ error: 'resourceId is required' });
    }

    await resourceGroupStore.addToGroup(resourceId, req.params.groupId as string);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Remove resource from group
router.delete('/groups/:groupId/members/:resourceId', async (req: Request, res: Response) => {
  try {
    await resourceGroupStore.removeFromGroup(req.params.resourceId as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Update group name/description
router.patch('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    if (!name && !description) {
      return res.status(400).json({ error: 'Provide name or description to update' });
    }
    const updated = await resourceGroupStore.updateGroup(groupId as string, { name, description });
    if (!updated) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Delete group (unassigns members first)
router.delete('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const deleted = await resourceGroupStore.deleteGroup(req.params.groupId as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// TELEMETRY ENDPOINT (static route BEFORE parametric /:id)
// =====================

// Ingest telemetry data
router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const { resourceId, lat, lng, heading, speed } = req.body;

    if (!resourceId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'resourceId, lat, and lng are required' });
    }

    const telemetryService = getResourceTelemetryService();
    telemetryService.ingestTelemetry(resourceId, { lat, lng, heading, speed });

    res.status(202).json({ accepted: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// PARAMETRIC RESOURCE ENDPOINTS (after static routes to prevent shadowing)
// =====================

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

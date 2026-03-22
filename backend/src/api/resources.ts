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

// ---------------------------------------------------------------------------
// Command discovery — dynamic command schemas per resource
// ---------------------------------------------------------------------------

/**
 * Command parameter field schema — describes one input field for a command.
 */
interface CommandParamField {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'select' | 'location' | 'waypoints' | 'area' | 'file';
  label: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

/**
 * A command definition available for a specific resource.
 */
interface CommandDefinition {
  command: string;
  label: string;
  description: string;
  group: string;
  params: CommandParamField[];
}

/** Robot mission command → required capability */
const COMMAND_CAPABILITY_MAP: Record<string, string> = {
  patrol_route: 'patrol',
  find_engage: 'find_engage',
  recon_area: 'ISR',
  visual_search: 'ISR',
  overwatch: 'patrol',
  resupply_route: 'resupply',
  swarm_patrol: 'swarm_leader',
  swarm_recon: 'swarm_leader',
  swarm_advance: 'swarm_leader',
};

/** Full mission command schemas — parameter definitions for each robot command */
// Common mission params appended to all mission command schemas
const COMMON_MISSION_PARAMS: CommandDefinition['params'] = [
  { name: 'description', type: 'string', label: "Commander's Intent", description: 'Free-text mission description for tactical planner (e.g. "Conduct screening operation between grid A and B")' },
  { name: 'terrain_context', type: 'string', label: 'Terrain/Context', description: 'Environmental context (e.g. "Urban area, narrow corridors, limited visibility")' },
];

const MISSION_COMMAND_SCHEMAS: Record<string, Omit<CommandDefinition, 'command'>> = {
  find_engage: {
    label: 'Find & Engage',
    description: 'Navigate to target location and engage',
    group: 'mission',
    params: [
      { name: 'target_location', type: 'location', label: 'Target Location', required: true, description: 'Room-relative coordinates (meters)' },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  patrol_route: {
    label: 'Patrol Route',
    description: 'Patrol an area — AI planner generates the route from intent',
    group: 'mission',
    params: [
      { name: 'area', type: 'area', label: 'Patrol Area', description: 'Bounding box to patrol (optional — planner generates route)' },
      { name: 'waypoints', type: 'waypoints', label: 'Waypoints', description: 'Specific waypoints (optional — overrides planner)' },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  recon_area: {
    label: 'Recon Area',
    description: 'Sweep a bounded area with ISR sensors',
    group: 'mission',
    params: [
      { name: 'area', type: 'area', label: 'Area Bounds', description: 'Bounding box in room-relative meters' },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  visual_search: {
    label: 'Visual Search',
    description: 'Search for object matching reference image',
    group: 'mission',
    params: [
      { name: 'reference_image_b64', type: 'file', label: 'Reference Image', required: true, description: 'Image of the target object' },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  overwatch: {
    label: 'Overwatch',
    description: 'Hold position and observe target location',
    group: 'mission',
    params: [
      { name: 'target_location', type: 'location', label: 'Observation Point' },
      { name: 'duration_sec', type: 'number', label: 'Duration (seconds)', min: 10, max: 600, step: 10, default: 60 },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  resupply_route: {
    label: 'Resupply Route',
    description: 'Follow waypoints to deliver supplies',
    group: 'mission',
    params: [
      { name: 'waypoints', type: 'waypoints', label: 'Route Waypoints', required: true },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
      ...COMMON_MISSION_PARAMS,
    ],
  },
  swarm_patrol: {
    label: 'Swarm Patrol',
    description: 'Formation patrol along waypoints',
    group: 'swarm',
    params: [
      { name: 'waypoints', type: 'waypoints', label: 'Waypoints', required: true },
      { name: 'formation', type: 'select', label: 'Formation', default: 'wedge', options: [
        { value: 'wedge', label: 'Wedge' }, { value: 'line', label: 'Line' },
        { value: 'column', label: 'Column' }, { value: 'echelon_left', label: 'Echelon Left' },
        { value: 'echelon_right', label: 'Echelon Right' }, { value: 'vee', label: 'Vee' },
      ]},
      { name: 'technique', type: 'select', label: 'Movement Technique', default: 'traveling', options: [
        { value: 'traveling', label: 'Traveling' },
        { value: 'traveling_overwatch', label: 'Traveling Overwatch' },
        { value: 'bounding_overwatch', label: 'Bounding Overwatch' },
      ]},
      { name: 'spacing_m', type: 'number', label: 'Spacing (m)', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
    ],
  },
  swarm_recon: {
    label: 'Swarm Recon',
    description: 'Formation sweep of area with shared vision',
    group: 'swarm',
    params: [
      { name: 'area', type: 'area', label: 'Area Bounds', required: true },
      { name: 'formation', type: 'select', label: 'Formation', default: 'line', options: [
        { value: 'wedge', label: 'Wedge' }, { value: 'line', label: 'Line' },
        { value: 'column', label: 'Column' }, { value: 'echelon_left', label: 'Echelon Left' },
        { value: 'echelon_right', label: 'Echelon Right' }, { value: 'vee', label: 'Vee' },
      ]},
      { name: 'technique', type: 'select', label: 'Movement Technique', default: 'traveling', options: [
        { value: 'traveling', label: 'Traveling' },
        { value: 'traveling_overwatch', label: 'Traveling Overwatch' },
        { value: 'bounding_overwatch', label: 'Bounding Overwatch' },
      ]},
      { name: 'spacing_m', type: 'number', label: 'Spacing (m)', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
    ],
  },
  swarm_advance: {
    label: 'Swarm Advance',
    description: 'Doctrinal advance toward target in formation',
    group: 'swarm',
    params: [
      { name: 'target_location', type: 'location', label: 'Objective', required: true },
      { name: 'formation', type: 'select', label: 'Formation', default: 'wedge', options: [
        { value: 'wedge', label: 'Wedge' }, { value: 'line', label: 'Line' },
        { value: 'column', label: 'Column' }, { value: 'echelon_left', label: 'Echelon Left' },
        { value: 'echelon_right', label: 'Echelon Right' }, { value: 'vee', label: 'Vee' },
      ]},
      { name: 'technique', type: 'select', label: 'Movement Technique', default: 'traveling', options: [
        { value: 'traveling', label: 'Traveling' },
        { value: 'traveling_overwatch', label: 'Traveling Overwatch' },
        { value: 'bounding_overwatch', label: 'Bounding Overwatch' },
      ]},
      { name: 'spacing_m', type: 'number', label: 'Spacing (m)', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
    ],
  },
};

/** Bastion-level command schemas for plugin CommandAdapter commands */
const BASTION_COMMAND_SCHEMAS: Record<string, Omit<CommandDefinition, 'command'>> = {
  move: {
    label: 'Move',
    description: 'Move resource to a location',
    group: 'bastion',
    params: [
      { name: 'target_location', type: 'location', label: 'Destination', required: true },
      { name: 'speed', type: 'number', label: 'Speed', min: 0, max: 255, step: 1, default: 50 },
    ],
  },
  report: {
    label: 'Report',
    description: 'Request a status report from the resource',
    group: 'bastion',
    params: [],
  },
  configure: {
    label: 'Configure',
    description: 'Update resource configuration',
    group: 'bastion',
    params: [
      { name: 'key', type: 'string', label: 'Configuration Key', required: true },
      { name: 'value', type: 'string', label: 'Value', required: true },
    ],
  },
  execute: {
    label: 'Execute',
    description: 'Execute a device-specific command',
    group: 'bastion',
    params: [
      { name: 'action', type: 'string', label: 'Action', required: true, description: 'Device-specific action name' },
    ],
  },
};

/** Lifecycle commands available to all resources */
const LIFECYCLE_COMMANDS: CommandDefinition[] = [
  {
    command: 'set_status',
    label: 'Set Status',
    description: 'Change resource operational status',
    group: 'lifecycle',
    params: [
      { name: 'status', type: 'select', label: 'Status', required: true, options: [
        { value: 'FMC', label: 'Fully Mission Capable' },
        { value: 'PMC', label: 'Partially Mission Capable' },
        { value: 'NMC', label: 'Not Mission Capable' },
      ]},
    ],
  },
];

router.get('/:id/commands', async (req: Request, res: Response) => {
  try {
    const resource = await resourceStore.getResource(req.params.id as string);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const commands: CommandDefinition[] = [...LIFECYCLE_COMMANDS];
    const caps = resource.capabilities || [];

    // 1. Mission commands — for resources with robot capabilities
    // Invert commandCapabilityMap: find all commands this resource can execute
    for (const [cmd, requiredCap] of Object.entries(COMMAND_CAPABILITY_MAP)) {
      const hasCapability = caps.includes(requiredCap) ||
        (caps.includes('ISR') && ['recon_area', 'visual_search'].includes(cmd)) ||
        (caps.includes('patrol') && ['patrol_route', 'overwatch'].includes(cmd));

      if (hasCapability && MISSION_COMMAND_SCHEMAS[cmd]) {
        commands.push({ command: cmd, ...MISSION_COMMAND_SCHEMAS[cmd] });
      }
    }

    // 2. Plugin CommandAdapter commands — for resources whose plugin defines a command adapter
    const pluginRegistry = getPluginRegistry();
    const plugin = pluginRegistry.getPlugin(resource.category);
    if (plugin?.commandAdapter) {
      for (const bastionCmd of plugin.commandAdapter.supportedCommands) {
        if (BASTION_COMMAND_SCHEMAS[bastionCmd]) {
          commands.push({ command: bastionCmd, ...BASTION_COMMAND_SCHEMAS[bastionCmd] });
        }
      }
    }

    res.json({
      resource_id: resource.id,
      name: resource.name,
      category: resource.category,
      capabilities: caps,
      is_autonomous: resource.isAutonomous,
      commands,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// PARAMETRIC RESOURCE ENDPOINTS (must be last to prevent /:id shadowing /personnel, /consumables, etc.)
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

// Update resource status (must be before generic /:id to avoid route shadowing)
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

// Update resource (generic)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const resource = await resourceStore.getResource(req.params.id as string);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json({ success: true, message: 'Use /api/resources/:id/status for status updates' });
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

export default router;

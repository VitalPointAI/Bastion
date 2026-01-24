import { Router, type Request, type Response } from 'express';
import { unitStore } from '../command/unit-store.js';
import { relationshipStore } from '../command/relationship-store.js';
import type { Unit, CommandRelationship, RelationshipType } from '../command/types.js';
import { getPool } from '../lib/database.js';

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
 * Hierarchy node structure for nested tree representation
 */
interface HierarchyNode {
  unit: Unit;
  relationship?: CommandRelationship;
  children: HierarchyNode[];
}

// =====================
// UNIT ENDPOINTS
// =====================

/**
 * Create a new unit
 * POST /api/command/units
 */
router.post('/units', async (req: Request, res: Response) => {
  try {
    const { missionId, name, sidc, parentDid, location } = req.body;

    // Validate required fields
    if (!missionId || !name || !sidc) {
      return res.status(400).json({
        error: 'Missing required fields: missionId, name, sidc are required',
      });
    }

    // Basic SIDC validation (should be 15 characters for MIL-STD-2525D)
    if (typeof sidc !== 'string' || sidc.length !== 15) {
      return res.status(400).json({
        error: 'Invalid SIDC format: must be 15 characters (MIL-STD-2525D)',
      });
    }

    const unit = await unitStore.createUnit(
      missionId,
      name,
      sidc,
      parentDid,
      location
    );

    res.status(201).json(unit);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * List units for a mission
 * GET /api/command/units?missionId=X
 */
router.get('/units', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);

    if (!missionId) {
      return res.status(400).json({
        error: 'Missing required query parameter: missionId',
      });
    }

    const units = await unitStore.listUnits(missionId);
    res.json({ units });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get single unit by ID
 * GET /api/command/units/:id
 */
router.get('/units/:id', async (req: Request, res: Response) => {
  try {
    const unitId = req.params.id as string;
    const unit = await unitStore.getUnit(unitId);

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(unit);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Update unit
 * PATCH /api/command/units/:id
 */
router.patch('/units/:id', async (req: Request, res: Response) => {
  try {
    const unitId = req.params.id as string;
    const { name, sidc, location } = req.body;

    // Validate SIDC if provided
    if (sidc !== undefined && (typeof sidc !== 'string' || sidc.length !== 15)) {
      return res.status(400).json({
        error: 'Invalid SIDC format: must be 15 characters (MIL-STD-2525D)',
      });
    }

    const updated = await unitStore.updateUnit(unitId, {
      name,
      sidc,
      location,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * Delete unit
 * DELETE /api/command/units/:id
 */
router.delete('/units/:id', async (req: Request, res: Response) => {
  try {
    const unitId = req.params.id as string;
    const deleted = await unitStore.deleteUnit(unitId);

    if (!deleted) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// RELATIONSHIP ENDPOINTS
// =====================

/**
 * Create command relationship
 * POST /api/command/relationships
 */
router.post('/relationships', async (req: Request, res: Response) => {
  try {
    const {
      missionId,
      superiorUnitId,
      subordinateUnitId,
      relationshipType,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // Validate required fields
    if (!missionId || !superiorUnitId || !subordinateUnitId || !relationshipType) {
      return res.status(400).json({
        error: 'Missing required fields: missionId, superiorUnitId, subordinateUnitId, relationshipType',
      });
    }

    // Validate relationship type
    const validTypes: RelationshipType[] = ['OPCON', 'TACON', 'ADCON', 'COCOM', 'DS', 'GS', 'GSR', 'R'];
    if (!validTypes.includes(relationshipType)) {
      return res.status(400).json({
        error: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const relationship = await relationshipStore.createRelationship(
      missionId,
      superiorUnitId,
      subordinateUnitId,
      relationshipType,
      effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveTo ? new Date(effectiveTo) : undefined
    );

    res.status(201).json(relationship);
  } catch (error) {
    // Check for cycle detection error
    if (String(error).includes('cycle')) {
      return res.status(409).json({ error: String(error) });
    }
    res.status(400).json({ error: String(error) });
  }
});

/**
 * List relationships for a mission
 * GET /api/command/relationships?missionId=X
 */
router.get('/relationships', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);

    if (!missionId) {
      return res.status(400).json({
        error: 'Missing required query parameter: missionId',
      });
    }

    const relationships = await relationshipStore.getHierarchy(missionId);
    res.json({ relationships });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Delete relationship
 * DELETE /api/command/relationships/:id
 */
router.delete('/relationships/:id', async (req: Request, res: Response) => {
  try {
    const relationshipId = req.params.id as string;
    const deleted = await relationshipStore.deleteRelationship(relationshipId);

    if (!deleted) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Update relationship
 * PATCH /api/command/relationships/:id
 */
router.patch('/relationships/:id', async (req: Request, res: Response) => {
  try {
    const relationshipId = req.params.id as string;
    const { relationshipType, effectiveFrom, effectiveTo } = req.body;

    // Validate relationship type if provided
    if (relationshipType !== undefined) {
      const validTypes: RelationshipType[] = ['OPCON', 'TACON', 'ADCON', 'COCOM', 'DS', 'GS', 'GSR', 'R'];
      if (!validTypes.includes(relationshipType)) {
        return res.status(400).json({
          error: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    const pool = getPool();
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (relationshipType !== undefined) {
      fields.push(`relationship_type = $${idx++}`);
      params.push(relationshipType);
    }
    if (effectiveFrom !== undefined) {
      fields.push(`effective_from = $${idx++}`);
      params.push(effectiveFrom ? new Date(effectiveFrom) : null);
    }
    if (effectiveTo !== undefined) {
      fields.push(`effective_to = $${idx++}`);
      params.push(effectiveTo ? new Date(effectiveTo) : null);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
      });
    }

    params.push(relationshipId);

    const result = await pool.query(
      `UPDATE command_relationships SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({ success: true, relationship: result.rows[0] });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// HIERARCHY ENDPOINTS
// =====================

/**
 * Get full hierarchy tree for a mission
 * GET /api/command/hierarchy/:missionId
 */
router.get('/hierarchy/:missionId', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId as string;

    // Get all units and relationships for this mission
    const units = await unitStore.listUnits(missionId);
    const relationships = await relationshipStore.getHierarchy(missionId);

    // Build hierarchy tree
    const tree = buildHierarchyTree(units, relationships);

    res.json({ tree });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Validate hierarchy without saving (cycle check)
 * POST /api/command/validate-hierarchy/:missionId
 */
router.post('/validate-hierarchy/:missionId', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId as string;
    const { superiorUnitId, subordinateUnitId } = req.body;

    if (!superiorUnitId || !subordinateUnitId) {
      return res.status(400).json({
        error: 'Missing required fields: superiorUnitId, subordinateUnitId',
      });
    }

    const hasCycle = await relationshipStore.validateNoCycle(
      missionId,
      superiorUnitId,
      subordinateUnitId
    );

    res.json({
      valid: !hasCycle,
      hasCycle,
      message: hasCycle
        ? 'Relationship would create a cycle in the hierarchy'
        : 'Relationship is valid',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get relationship matrix view data
 * GET /api/command/matrix/:missionId
 */
router.get('/matrix/:missionId', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId as string;

    // Get all units and relationships
    const units = await unitStore.listUnits(missionId);
    const relationships = await relationshipStore.getHierarchy(missionId);

    // Build matrix representation
    const matrix = units.map((unit) => {
      const row: Record<string, string | null> = {
        unitId: unit.id,
        unitName: unit.name,
      };

      // For each other unit, find if there's a relationship
      units.forEach((otherUnit) => {
        if (unit.id === otherUnit.id) {
          row[otherUnit.id] = null; // Self
        } else {
          const rel = relationships.find(
            (r) =>
              (r.superiorUnitId === unit.id && r.subordinateUnitId === otherUnit.id) ||
              (r.subordinateUnitId === unit.id && r.superiorUnitId === otherUnit.id)
          );
          row[otherUnit.id] = rel ? rel.relationshipType : null;
        }
      });

      return row;
    });

    res.json({ matrix, units });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Build hierarchical tree structure from flat units and relationships
 */
function buildHierarchyTree(
  units: Unit[],
  relationships: CommandRelationship[]
): HierarchyNode[] {
  // Create a map of unit ID to unit for quick lookup
  const unitMap = new Map<string, Unit>();
  units.forEach((unit) => unitMap.set(unit.id, unit));

  // Create a map of subordinate ID to relationships
  const subordinateMap = new Map<string, CommandRelationship[]>();
  relationships.forEach((rel) => {
    const existing = subordinateMap.get(rel.subordinateUnitId) || [];
    existing.push(rel);
    subordinateMap.set(rel.subordinateUnitId, existing);
  });

  // Find root units (units with no superior)
  const superiorIds = new Set(relationships.map((r) => r.superiorUnitId));
  const subordinateIds = new Set(relationships.map((r) => r.subordinateUnitId));
  const rootUnitIds = units
    .filter((unit) => !subordinateIds.has(unit.id))
    .map((unit) => unit.id);

  // Recursive function to build tree
  function buildNode(unitId: string, relationship?: CommandRelationship): HierarchyNode {
    const unit = unitMap.get(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    // Find all relationships where this unit is superior
    const childRelationships = relationships.filter((r) => r.superiorUnitId === unitId);

    // Build child nodes recursively
    const children = childRelationships.map((rel) =>
      buildNode(rel.subordinateUnitId, rel)
    );

    return {
      unit,
      relationship,
      children,
    };
  }

  // Build tree from root nodes
  return rootUnitIds.map((rootId) => buildNode(rootId));
}

export default router;

/**
 * Brain Subspaces API Router
 *
 * REST endpoints for:
 * - Subspace CRUD (named node subsets)
 * - Lens CRUD (filter/visualization configurations)
 * - N-hop neighbor query (returns nodes and edges within N hops of a starting node)
 *
 * Mounted at /api/brain (alongside existing brain.ts routes)
 */

import { Router, type Request, type Response } from 'express';
import {
  createSubspace,
  getSubspaces,
  getSubspaceById,
  updateSubspace,
  deleteSubspace,
} from '../graph/subspace/subspace-store.js';
import {
  createLens,
  getLenses,
  updateLens,
  deleteLens,
  cloneLens,
} from '../graph/subspace/lens-store.js';
import { executeReadQuery } from '../graph/neo4j-client.js';

const router = Router();

// =====================
// Helper
// =====================

function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

function getUserId(req: Request): string {
  return (req.headers['x-did'] as string) || 'anonymous';
}

// =====================
// SUBSPACE ENDPOINTS
// =====================

// GET /api/brain/subspaces?problemSetId=X
// Returns subspaces visible to the requesting user (own + shared)
router.get('/subspaces', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const userId = getUserId(req);
    const subspaces = await getSubspaces(problemSetId, userId);
    res.json({ subspaces });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/subspaces
// Create a new subspace
router.post('/subspaces', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { problemSetId, name, subspaceType, nodeIds, queryDefinition } = req.body;
    if (!problemSetId || !name || !subspaceType) {
      return res.status(400).json({ error: 'problemSetId, name, and subspaceType are required' });
    }
    if (subspaceType !== 'manual' && subspaceType !== 'smart') {
      return res.status(400).json({ error: 'subspaceType must be "manual" or "smart"' });
    }
    const subspace = await createSubspace(
      problemSetId,
      name,
      subspaceType,
      userId,
      nodeIds,
      queryDefinition,
    );
    res.status(201).json(subspace);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// PUT /api/brain/subspaces/:id
// Update a subspace
router.put('/subspaces/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, nodeIds, queryDefinition, isShared } = req.body;
    const updated = await updateSubspace(id, { name, nodeIds, queryDefinition, isShared });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// DELETE /api/brain/subspaces/:id
// Delete a subspace
router.delete('/subspaces/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await getSubspaceById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Subspace not found' });
    }
    await deleteSubspace(id);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// LENS ENDPOINTS
// =====================

// GET /api/brain/lenses?problemSetId=X
// Returns lenses visible to user (own + shared + built-in)
router.get('/lenses', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const userId = getUserId(req);
    const lenses = await getLenses(problemSetId, userId);
    res.json({ lenses });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/lenses
// Create a new lens
router.post('/lenses', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { problemSetId, name, ...config } = req.body;
    if (!problemSetId || !name) {
      return res.status(400).json({ error: 'problemSetId and name are required' });
    }
    const lens = await createLens(problemSetId, name, userId, config);
    res.status(201).json(lens);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// PUT /api/brain/lenses/:id
// Update a lens
router.put('/lenses/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updated = await updateLens(id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// DELETE /api/brain/lenses/:id
// Delete a lens (built-in lenses cannot be deleted)
router.delete('/lenses/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteLens(id);
    res.status(204).end();
  } catch (error) {
    // deleteLens throws on built-in lens — surface as 403
    const msg = String(error);
    if (msg.includes('built-in')) {
      return res.status(403).json({ error: msg });
    }
    res.status(400).json({ error: msg });
  }
});

// POST /api/brain/lenses/:id/clone
// Clone a lens for the requesting user
router.post('/lenses/:id/clone', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = getUserId(req);
    const cloned = await cloneLens(id, userId);
    res.status(201).json(cloned);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// N-HOP ENDPOINT
// =====================

// GET /api/brain/nhop?workspaceId=X&nodeId=Y&hops=N
// Returns { nodes, edges } within N hops of nodeId in the given workspace
router.get('/nhop', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const nodeId = getQueryString(req.query.nodeId);
    const hopsRaw = getQueryString(req.query.hops);

    if (!workspaceId || !nodeId) {
      return res.status(400).json({ error: 'workspaceId and nodeId query parameters are required' });
    }

    const hops = hopsRaw ? Math.min(Math.max(parseInt(hopsRaw, 10), 1), 5) : 2;
    const nodeLimit = hops <= 2 ? 200 : 100;

    // Step 1: Find all neighbor nodes within N hops of the starting node
    const neighborResult = await executeReadQuery(
      `MATCH path = (start:Actor {id: $nodeId, workspaceId: $workspaceId})-[*1..$hops]-(neighbor)
       WITH COLLECT(DISTINCT neighbor) AS neighbors
       UNWIND neighbors AS n
       RETURN n
       LIMIT $nodeLimit`,
      { nodeId, workspaceId, hops, nodeLimit },
    );

    const nodes: Record<string, unknown>[] = neighborResult.records.map(
      (r: { get: (key: string) => { properties: Record<string, unknown> } }) =>
        r.get('n').properties,
    );
    const nodeIds = nodes.map((n) => n.id as string);

    // Include the starting node
    const startResult = await executeReadQuery(
      `MATCH (a:Actor {id: $nodeId, workspaceId: $workspaceId}) RETURN a`,
      { nodeId, workspaceId },
    );
    if (startResult.records.length > 0) {
      const startNode = startResult.records[0].get('a').properties as Record<string, unknown>;
      if (!nodeIds.includes(startNode.id as string)) {
        nodes.unshift(startNode);
        nodeIds.unshift(startNode.id as string);
      }
    }

    // Step 2: Fetch edges between all result nodes
    let edges: Record<string, unknown>[] = [];
    if (nodeIds.length > 1) {
      const edgeResult = await executeReadQuery(
        `MATCH (a:Actor {workspaceId: $workspaceId})-[r]-(b:Actor {workspaceId: $workspaceId})
         WHERE a.id IN $nodeIds AND b.id IN $nodeIds
         RETURN r`,
        { workspaceId, nodeIds },
      );
      edges = edgeResult.records.map(
        (r: { get: (key: string) => { properties: Record<string, unknown>; type: string } }) => ({
          ...r.get('r').properties,
          type: r.get('r').type,
        }),
      );
    }

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

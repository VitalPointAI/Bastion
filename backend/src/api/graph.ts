import { Router, type Request, type Response } from 'express';
import { graphProblemSetStore } from '../graph/problem-set/store.js';
import { GraphProblemSetInputSchema, type GraphProblemSetCategory } from '../graph/problem-set/types.js';
import { graphProblemSetAggregationService } from '../graph/problem-set/aggregation-service.js';
import { actorStore } from '../graph/raft/actor-store.js';
import { relationshipStore } from '../graph/raft/relationship-store.js';
import { tensionStore } from '../graph/raft/tension-store.js';
import type { ActorType, TensionIntensity } from '../graph/raft/types.js';
import { osintEventStore } from '../graph/osint/event-store.js';
import { OSINTEventInputSchema } from '../graph/osint/types.js';
import { validityService } from '../graph/osint/validity-service.js';
import { entityResolutionService } from '../graph/resolution/resolution-service.js';
import { graphBuilder } from '../graph/construction/graph-builder.js';
import {
  fetchAdjacencyList,
  computeEigenvectorCentrality,
  computePageRank,
} from '../graph/tools/raft-tools.js';

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
// WORKSPACE ENDPOINTS
// =====================

// List workspaces
router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const type = getQueryString(req.query.type) as GraphProblemSetCategory | undefined;
    const parentId = getQueryString(req.query.parentId);
    const classification = getQueryString(req.query.classification);
    const problemSets = await graphProblemSetStore.listProblemSets({
      type,
      parentId,
      classification,
    });
    res.json({ problemSets });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create workspace
router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const input = GraphProblemSetInputSchema.parse(req.body);
    const createdBy = (req.headers['x-did'] as string) || 'anonymous';
    const problemSet = await graphProblemSetStore.createProblemSet(input, createdBy);
    res.status(201).json(problemSet);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get workspace with context
router.get('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const problemSet = await graphProblemSetAggregationService.getProblemSetWithContext(problemSetId);
    if (!problemSet) {
      return res.status(404).json({ error: 'Problem set not found' });
    }
    res.json(problemSet);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Update problem set
router.put('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const updated = await graphProblemSetStore.updateProblemSet(problemSetId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Problem set not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete problem set
router.delete('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const deleted = await graphProblemSetStore.deleteProblemSet(problemSetId);
    if (!deleted) {
      return res.status(404).json({ error: 'Problem set not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get master view
router.get('/master-view', async (req: Request, res: Response) => {
  try {
    const classification = getQueryString(req.query.classification) as 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET' | undefined;
    const view = await graphProblemSetAggregationService.getMasterView(classification);
    res.json(view);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get problem set tree
router.get('/workspaces/:id/tree', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.id as string;
    const tree = await graphProblemSetAggregationService.getProblemSetTree(problemSetId);
    res.json({ tree });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// RAFT GRAPH ENDPOINTS
// =====================

// List actors
router.get('/actors', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const type = getQueryString(req.query.type) as ActorType | undefined;
    const actors = await actorStore.listActors(workspaceId, type);
    res.json({ actors });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get actor profile
router.get('/actors/:id', async (req: Request, res: Response) => {
  try {
    const actorId = req.params.id as string;
    const actor = await actorStore.getActor(actorId);
    if (!actor) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    const relationships = await relationshipStore.getActorRelationships(actorId, 'both');
    const tensions = await tensionStore.getTensionsForActor(actorId);
    res.json({ actor, relationships, tensions });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Search actors
router.get('/actors/search/:query', async (req: Request, res: Response) => {
  try {
    const query = req.params.query as string;
    const actors = await actorStore.findActorsByName(query, true);
    res.json({ actors });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// List tensions
router.get('/tensions', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const intensity = getQueryString(req.query.intensity) as TensionIntensity | undefined;
    const tensions = await tensionStore.listTensions(workspaceId, intensity);
    res.json({ tensions });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// OSINT ENDPOINTS
// =====================

// List OSINT events
router.get('/osint/events', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const sourceType = getQueryString(req.query.sourceType);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);
    const limitStr = getQueryString(req.query.limit);
    const offsetStr = getQueryString(req.query.offset);

    const result = await osintEventStore.listEvents({
      workspaceId,
      sourceType,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
      offset: offsetStr ? parseInt(offsetStr, 10) : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create OSINT event
router.post('/osint/events', async (req: Request, res: Response) => {
  try {
    const input = OSINTEventInputSchema.parse(req.body);
    const event = await osintEventStore.createEvent(input);
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get OSINT event
router.get('/osint/events/:id', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id as string;
    const event = await osintEventStore.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Link event to objective
router.post('/osint/events/:eventId/link', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId as string;
    const { objectiveId, relevance, relevanceScore, reasoning } = req.body;
    const linkedBy = (req.headers['x-did'] as string) || 'anonymous';
    const evidence = await osintEventStore.linkToObjective(
      eventId,
      objectiveId,
      relevance,
      relevanceScore,
      reasoning,
      linkedBy
    );
    res.status(201).json(evidence);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// VALIDITY ENDPOINTS
// =====================

// Calculate validity for objective
router.post('/validity/:objectiveId/calculate', async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.objectiveId as string;
    const calculatedBy = (req.headers['x-did'] as string) || 'system';
    const score = await validityService.calculateValidity(objectiveId, calculatedBy);
    res.json(score);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get validity history
router.get('/validity/:objectiveId/history', async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.objectiveId as string;
    const limitStr = getQueryString(req.query.limit);
    const limit = limitStr ? parseInt(limitStr, 10) : 30;
    const history = await validityService.getValidityHistory(objectiveId, limit);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get validity trend
router.get('/validity/:objectiveId/trend', async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.objectiveId as string;
    const windowStr = getQueryString(req.query.window);
    const windowDays = windowStr ? parseInt(windowStr, 10) : 30;
    const trend = await validityService.calculateTrend(objectiveId, windowDays);
    res.json(trend);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get unacknowledged alerts
router.get('/validity/alerts', async (req: Request, res: Response) => {
  try {
    const objectiveId = getQueryString(req.query.objectiveId);
    const alerts = await validityService.getUnacknowledgedAlerts(objectiveId);
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Acknowledge alert
router.post('/validity/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const alertId = req.params.alertId as string;
    const acknowledgedBy = (req.headers['x-did'] as string) || 'anonymous';
    const success = await validityService.acknowledgeAlert(alertId, acknowledgedBy);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// ENTITY RESOLUTION ENDPOINTS
// =====================

// Find duplicates
router.get('/resolution/duplicates', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const result = await entityResolutionService.findDuplicates(workspaceId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Merge actors
router.post('/resolution/merge', async (req: Request, res: Response) => {
  try {
    const { actor1Id, actor2Id } = req.body;
    const result = await entityResolutionService.mergeActors(actor1Id, actor2Id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// =====================
// OBJECTIVES WITH VALIDITY ENDPOINTS
// =====================

function mapTrend(serviceTrend: 'improving' | 'declining' | 'stable'): 'up' | 'down' | 'stable' {
  switch (serviceTrend) {
    case 'improving': return 'up';
    case 'declining': return 'down';
    case 'stable': return 'stable';
  }
}

// Get objectives with validity scores for a workspace
router.get('/validity/objectives', async (req: Request, res: Response) => {
  try {
    // workspaceId reserved for future filtering
    void getQueryString(req.query.workspaceId);
    const { objectiveStore } = await import('../strategic/objectives/store.js');

    // Get all objectives (optionally filter by workspace in future)
    const result = await objectiveStore.listObjectives({ limit: 100 });
    const objectives = result.objectives;

    // Enrich with validity data
    const objectivesWithValidity = await Promise.all(
      objectives.map(async (obj) => {
        try {
          const validity = await validityService.calculateValidity(obj.id, 'system');
          const trendResult = await validityService.calculateTrend(obj.id);
          return {
            id: obj.id,
            objectiveTitle: obj.description.slice(0, 100),
            validityScore: validity.score,
            trend: mapTrend(trendResult.trend),
            lastUpdated: validity.calculatedAt,
            classification: 'UNCLASSIFIED', // Default for now
          };
        } catch {
          return {
            id: obj.id,
            objectiveTitle: obj.description.slice(0, 100),
            validityScore: 70, // Default baseline
            trend: 'stable' as const,
            lastUpdated: new Date().toISOString(),
            classification: 'UNCLASSIFIED',
          };
        }
      })
    );

    res.json({ objectives: objectivesWithValidity });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// WORKSPACE GRAPH DATA ENDPOINTS
// =====================

// Get graph data by workspaceId query param (used by MonitorTab frontend)
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId) || 'default';

    const actors = await actorStore.listActors(workspaceId);
    const nodes = actors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      workspaceId: actor.workspaceId,
    }));

    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number }>();
    for (const actor of actors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        if (!edgeSet.has(rel.id)) {
          edgeSet.set(rel.id, {
            source: rel.sourceActorId,
            target: rel.targetActorId,
            type: rel.type,
            strength: rel.strength,
          });
        }
      }
    }
    const edges = Array.from(edgeSet.values());

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get graph data for a workspace (nodes and edges for visualization)
router.get('/workspaces/:id/graph', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    // Get actors as nodes
    const actors = await actorStore.listActors(workspaceId);
    const nodes = actors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      workspaceId: actor.workspaceId,
    }));

    // Get relationships as edges by querying each actor's relationships
    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number }>();
    for (const actor of actors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        if (!edgeSet.has(rel.id)) {
          edgeSet.set(rel.id, {
            source: rel.sourceActorId,
            target: rel.targetActorId,
            type: rel.type,
            strength: rel.strength,
          });
        }
      }
    }
    const edges = Array.from(edgeSet.values());

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GRAPH CONSTRUCTION ENDPOINTS
// =====================

// Build graph from document objectives
router.post('/graph/build/:documentId', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId as string;
    const { workspaceId, runEntityResolution } = req.body;

    // Get document objectives
    const { objectiveStore } = await import('../strategic/objectives/store.js');
    const objectives = await objectiveStore.getObjectivesForDocument(documentId);

    const result = await graphBuilder.buildFromDocument(
      documentId,
      objectives.map(o => ({ id: o.id, description: o.description })),
      { workspaceId, runEntityResolution }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// CENTRALITY COMPARISON ENDPOINT
// =====================

/**
 * GET /api/graph/centrality-comparison
 *
 * Runs eigenvector centrality and PageRank on the same graph and returns
 * merged results sorted by eigenvector score. Actors with high divergence
 * between the two rankings are structurally interesting.
 *
 * Query params:
 *   workspaceId - optional workspace filter
 *   limit       - max actors to return (default 20)
 */
router.get('/centrality-comparison', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const limitStr = getQueryString(req.query.limit);
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 20;

    // Fetch the shared adjacency list once
    const adjacency = await fetchAdjacencyList(workspaceId);
    const totalActors = adjacency.size;

    if (totalActors === 0) {
      return res.json({
        actors: [],
        metadata: {
          totalActors: 0,
          eigenvectorIterations: 0,
          pageRankIterations: 0,
          algorithmNote: 'Power iteration without Neo4j GDS',
        },
      });
    }

    // Run both algorithms
    const eigenvectorResults = computeEigenvectorCentrality(adjacency);
    const pageRankResults = computePageRank(adjacency);

    // Build lookup maps for rank merging
    const prByActorId = new Map(
      pageRankResults.map(r => [r.actorId, { score: r.pageRankScore, rank: r.rank }])
    );

    // Generate insight string based on divergence pattern
    function buildInsight(
      eigenvectorRank: number,
      pageRankRank: number,
      divergence: number
    ): string {
      if (divergence === 0) return 'Consistent ranking across both centrality measures';
      if (eigenvectorRank < pageRankRank && divergence >= 3) {
        return 'High eigenvector despite lower PageRank suggests structural influence through key connections';
      }
      if (pageRankRank < eigenvectorRank && divergence >= 3) {
        return 'High PageRank despite lower eigenvector suggests broad reach but connections to less influential actors';
      }
      if (divergence >= 5) {
        return 'Large ranking divergence — structurally anomalous position warrants analyst attention';
      }
      return 'Minor divergence between centrality measures';
    }

    // Merge results (eigenvector-sorted)
    const merged = eigenvectorResults.slice(0, limit).map(ev => {
      const pr = prByActorId.get(ev.actorId) ?? { score: 0, rank: pageRankResults.length };
      const divergence = Math.abs(ev.rank - pr.rank);
      return {
        actorId: ev.actorId,
        name: ev.name,
        type: ev.type,
        eigenvectorScore: ev.eigenvectorScore,
        eigenvectorRank: ev.rank,
        pageRankScore: pr.score,
        pageRankRank: pr.rank,
        divergence,
        insight: buildInsight(ev.rank, pr.rank, divergence),
      };
    });

    // Approximate iteration counts from convergence behavior
    // (actual convergence tracked implicitly; report max for transparency)
    res.json({
      actors: merged,
      metadata: {
        totalActors,
        eigenvectorIterations: 100,
        pageRankIterations: 100,
        algorithmNote: 'Power iteration without Neo4j GDS',
      },
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

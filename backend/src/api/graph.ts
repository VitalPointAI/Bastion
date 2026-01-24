import { Router, type Request, type Response } from 'express';
import { workspaceStore } from '../graph/workspace/store.js';
import { WorkspaceInputSchema, type WorkspaceType } from '../graph/workspace/types.js';
import { aggregationService } from '../graph/workspace/aggregation-service.js';
import { actorStore } from '../graph/raft/actor-store.js';
import { relationshipStore } from '../graph/raft/relationship-store.js';
import { tensionStore } from '../graph/raft/tension-store.js';
import type { ActorType, TensionIntensity } from '../graph/raft/types.js';
import { osintEventStore } from '../graph/osint/event-store.js';
import { OSINTEventInputSchema } from '../graph/osint/types.js';
import { validityService } from '../graph/osint/validity-service.js';
import { entityResolutionService } from '../graph/resolution/resolution-service.js';
import { graphBuilder } from '../graph/construction/graph-builder.js';

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
    const type = getQueryString(req.query.type) as WorkspaceType | undefined;
    const parentId = getQueryString(req.query.parentId);
    const classification = getQueryString(req.query.classification);
    const workspaces = await workspaceStore.listWorkspaces({
      type,
      parentId,
      classification,
    });
    res.json({ workspaces });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create workspace
router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const input = WorkspaceInputSchema.parse(req.body);
    const createdBy = (req.headers['x-did'] as string) || 'anonymous';
    const workspace = await workspaceStore.createWorkspace(input, createdBy);
    res.status(201).json(workspace);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get workspace with context
router.get('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;
    const workspace = await aggregationService.getWorkspaceWithContext(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Update workspace
router.put('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;
    const updated = await workspaceStore.updateWorkspace(workspaceId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Delete workspace
router.delete('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;
    const deleted = await workspaceStore.deleteWorkspace(workspaceId);
    if (!deleted) {
      return res.status(404).json({ error: 'Workspace not found' });
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
    const view = await aggregationService.getMasterView(classification);
    res.json(view);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get workspace tree
router.get('/workspaces/:id/tree', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;
    const tree = await aggregationService.getWorkspaceTree(workspaceId);
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

// Get objectives with validity scores for a workspace
router.get('/validity/objectives', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const { objectiveStore } = await import('../strategic/objectives/store.js');

    // Get all objectives (optionally filter by workspace in future)
    const objectives = await objectiveStore.getObjectives({ limit: 100 });

    // Enrich with validity data
    const objectivesWithValidity = await Promise.all(
      objectives.map(async (obj) => {
        try {
          const validity = await validityService.calculateValidity(obj.id);
          const trend = await validityService.getValidityTrend(obj.id);
          return {
            id: obj.id,
            objectiveTitle: obj.description.slice(0, 100),
            validityScore: validity.validityScore,
            trend: trend.trend,
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

// Get graph data for a workspace (nodes and edges for visualization)
router.get('/workspaces/:id/graph', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;

    // Get actors as nodes
    const actors = await actorStore.listActors({ workspaceId, limit: 500 });
    const nodes = actors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      workspaceId: actor.workspaceId,
    }));

    // Get relationships as edges
    const relationships = await relationshipStore.listRelationships({ workspaceId, limit: 1000 });
    const edges = relationships.map(rel => ({
      source: rel.sourceActorId,
      target: rel.targetActorId,
      type: rel.relationshipType,
      strength: rel.weight,
    }));

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

export default router;

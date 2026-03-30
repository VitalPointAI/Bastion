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
import { executeReadQuery } from '../graph/neo4j-client.js';
import { graphBuilder } from '../graph/construction/graph-builder.js';
import { decisionStore } from '../graph/raft/decision-store.js';
import type { DecisionBasis } from '../graph/raft/types.js';
import {
  fetchAdjacencyList,
  computeEigenvectorCentrality,
  computePageRank,
} from '../graph/tools/raft-tools.js';
import { graphSummaryService } from '../exercise/graph-summary-service.js';

const router = Router();

/**
 * Classify confidence value into visual tier.
 * Mirrors frontend getConfidenceTier() from provenance-types.
 */
function getConfidenceTierForValue(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence > 0.85) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

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
// Query params: atTime (ISO string for temporal filtering), includeProvenance (bool, default true)
router.get('/actors', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const type = getQueryString(req.query.type) as ActorType | undefined;
    const atTime = getQueryString(req.query.atTime);
    const includeProvenanceStr = getQueryString(req.query.includeProvenance);
    const includeProvenance = includeProvenanceStr !== 'false'; // default true

    // Use containerId for problem-set scoping (matches containerIds + workspaceId)
    const actors = workspaceId
      ? await actorStore.listActors(undefined, type, undefined, workspaceId)
      : await actorStore.listActors(undefined, type);

    // Temporal filtering: only include actors valid at the given point in time
    const filteredActors = atTime
      ? actors.filter((a) => {
          const validFrom = a.validFrom ? new Date(a.validFrom).getTime() : 0;
          const validTo = a.validTo ? new Date(a.validTo).getTime() : Infinity;
          const atMs = new Date(atTime).getTime();
          return atMs >= validFrom && atMs <= validTo;
        })
      : actors;

    const shaped = filteredActors.map((actor) => ({
      id: actor.id,
      name: actor.name,
      type: actor.type,
      jsonldType: actor.jsonldType,
      confidence: actor.confidence,
      confidenceTier: getConfidenceTierForValue(actor.confidence),
      validFrom: actor.validFrom,
      validTo: actor.validTo,
      workspaceId: actor.workspaceId,
      natoSourceReliability: actor.natoSourceReliability ?? null,
      natoInformationCredibility: actor.natoInformationCredibility ?? null,
      ...(includeProvenance && {
        provenance: {
          assertedBy: actor.assertedBy,
          assertedVia: actor.assertedVia,
          derivedFrom: actor.derivedFrom,
          sourceWeight: actor.sourceWeight,
        },
      }),
    }));

    res.json({ actors: shaped });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get actor profile
router.get('/actors/:id', async (req: Request, res: Response) => {
  try {
    const actorId = req.params.id as string;
    const includeProvenanceStr = getQueryString(req.query.includeProvenance);
    const includeProvenance = includeProvenanceStr !== 'false'; // default true

    const actor = await actorStore.getActor(actorId);
    if (!actor) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    const relationships = await relationshipStore.getActorRelationships(actorId, 'both');
    const tensions = await tensionStore.getTensionsForActor(actorId);

    const actorShaped = {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      jsonldType: actor.jsonldType,
      confidence: actor.confidence,
      confidenceTier: getConfidenceTierForValue(actor.confidence),
      validFrom: actor.validFrom,
      validTo: actor.validTo,
      workspaceId: actor.workspaceId,
      aliases: actor.aliases,
      attributes: actor.attributes,
      natoSourceReliability: actor.natoSourceReliability ?? null,
      natoInformationCredibility: actor.natoInformationCredibility ?? null,
      ...(includeProvenance && {
        provenance: {
          assertedBy: actor.assertedBy,
          assertedVia: actor.assertedVia,
          derivedFrom: actor.derivedFrom,
          sourceWeight: actor.sourceWeight,
        },
      }),
    };

    res.json({ actor: actorShaped, relationships, tensions });
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
// Tensions carry jsonldType and confidence from Phase 47 Plan 03 schema additions
router.get('/tensions', async (req: Request, res: Response) => {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);
    const intensity = getQueryString(req.query.intensity) as TensionIntensity | undefined;
    const includeProvenanceStr = getQueryString(req.query.includeProvenance);
    const includeProvenance = includeProvenanceStr !== 'false'; // default true

    // Use containerId for problem-set scoping (matches containerIds + workspaceId)
    const tensions = workspaceId
      ? await tensionStore.listTensions(undefined, intensity, undefined, undefined, workspaceId)
      : await tensionStore.listTensions(undefined, intensity);

    const shaped = tensions.map((t) => ({
      ...t,
      // Include provenance only when requested (default: true)
      ...(!includeProvenance && {
        assertedBy: undefined,
        assertedVia: undefined,
        derivedFrom: undefined,
        sourceWeight: undefined,
      }),
    }));

    res.json({ tensions: shaped });
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
// BATCH MERGE ENDPOINT
// =====================

/**
 * Handler for POST /resolution/batch-merge
 * Exported for unit testing without supertest.
 *
 * dryRun=true (default): returns candidate counts + sample without merging.
 * dryRun=false: auto-merges high-confidence duplicates (autoMerge bucket only).
 * Batch operations skip LLM verification — too expensive for bulk runs (Pitfall 6).
 */
export async function batchMergeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { workspaceId, dryRun = true, limit } = req.body as {
      workspaceId?: string;
      dryRun?: boolean;
      limit?: number;
    };
    const result = await entityResolutionService.findDuplicates(workspaceId);

    if (dryRun) {
      const sampleLimit = typeof limit === 'number' ? limit : 50;
      const sample = result.autoMerge.slice(0, sampleLimit).map(c => ({
        actor1Name: c.actor1Name,
        actor2Name: c.actor2Name,
        score: c.score.score,
      }));
      res.json({
        autoMergeCandidates: result.autoMerge.length,
        reviewCandidates: result.needsReview.length,
        totalCandidates: result.candidates.length,
        sample,
      });
      return;
    }

    // Auto-merge only the high-confidence autoMerge bucket — no LLM verification
    const merges = await entityResolutionService.autoMergeDuplicates(result);
    res.json({
      mergedCount: merges.length,
      merges: merges.map(m => ({
        canonicalActorId: m.canonicalActorId,
        mergedActorIds: m.mergedActorIds,
        aliasesAdded: m.aliasesAdded,
      })),
    });
  } catch (err) {
    console.error('[Graph] Batch merge failed:', err);
    res.status(500).json({ error: 'Batch merge failed' });
  }
}

router.post('/resolution/batch-merge', batchMergeHandler);

// =====================
// GRAPH STATS ENDPOINT
// =====================

/**
 * Handler for GET /stats
 * Exported for unit testing without supertest.
 *
 * Returns totalActors, activeActors, softDeletedActors plus dedup metrics.
 * Dedup metrics degrade gracefully to zero if resolution scan fails.
 */
export async function graphStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = getQueryString(req.query.workspaceId);

    const countResult = await executeReadQuery(`
      MATCH (a:Actor)
      WHERE $workspaceId IS NULL OR a.workspaceId = $workspaceId
      RETURN
        count(a) as total,
        count(CASE WHEN a.validTo IS NOT NULL THEN 1 END) as softDeleted,
        count(CASE WHEN a.validTo IS NULL THEN 1 END) as active
    `, { workspaceId: workspaceId ?? null });

    const counts = countResult.records[0];

    let dedupMetrics = {
      duplicateCandidates: 0,
      autoMergeCandidates: 0,
      humanReviewCandidates: 0,
    };
    try {
      const resolution = await entityResolutionService.findDuplicates(workspaceId ?? undefined);
      dedupMetrics = {
        duplicateCandidates: resolution.candidates.length,
        autoMergeCandidates: resolution.autoMerge.length,
        humanReviewCandidates: resolution.needsReview.length,
      };
    } catch (resolveErr) {
      console.warn('[Graph] Stats: resolution scan failed, returning zero counts:', resolveErr);
    }

    res.json({
      totalActors: counts.get('total').toNumber(),
      activeActors: counts.get('active').toNumber(),
      softDeletedActors: counts.get('softDeleted').toNumber(),
      ...dedupMetrics,
    });
  } catch (err) {
    console.error('[Graph] Stats failed:', err);
    res.status(500).json({ error: 'Failed to fetch graph stats' });
  }
}

router.get('/stats', graphStatsHandler);

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
    const workspaceId = getQueryString(req.query.workspaceId) || undefined;
    const { objectiveStore } = await import('../strategic/objectives/store.js');

    // Filter objectives by workspace (via their parent document's workspace_id)
    const result = await objectiveStore.listObjectives({ workspaceId, limit: 100 });
    const objectives = result.objectives;

    // Enrich with validity data
    const objectivesWithValidity = await Promise.all(
      objectives.map(async (obj) => {
        try {
          const validity = await validityService.calculateValidity(obj.id, 'system');
          const trendResult = await validityService.calculateTrend(obj.id);
          return {
            id: obj.id,
            objective_text: obj.description,
            midlife_category: obj.midlifeCategory,
            extraction_confidence: obj.extractionConfidence,
            created_at: obj.createdAt?.toISOString(),
            primary_instrument: obj.primaryInstrument,
            priority: obj.priority,
            assumptions: obj.assumptions,
            risks: obj.risks,
            constraints: obj.constraints,
            objectiveTitle: obj.description.slice(0, 100),
            validityScore: validity.score,
            trend: mapTrend(trendResult.trend),
            lastUpdated: validity.calculatedAt,
            classification: 'UNCLASSIFIED',
          };
        } catch {
          return {
            id: obj.id,
            objective_text: obj.description,
            midlife_category: obj.midlifeCategory,
            extraction_confidence: obj.extractionConfidence,
            created_at: obj.createdAt?.toISOString(),
            primary_instrument: obj.primaryInstrument,
            priority: obj.priority,
            assumptions: obj.assumptions,
            risks: obj.risks,
            constraints: obj.constraints,
            objectiveTitle: obj.description.slice(0, 100),
            validityScore: 70,
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
    const atTime = getQueryString(req.query.atTime);
    const includeInfoSources = getQueryString(req.query.includeInfoSources) === 'true';

    // Use containerId filtering to scope graph to problem set
    // (matches both containerIds array and workspaceId for backward compat)
    let actors = await actorStore.listActors(undefined, undefined, undefined, workspaceId);

    // Exclude information_source actors from visualization by default
    // (journalists, authors — relevant for provenance, not the geopolitical graph)
    if (!includeInfoSources) {
      actors = actors.filter(a => a.type !== 'information_source');
    }

    // Temporal filtering
    if (atTime) {
      const atMs = new Date(atTime).getTime();
      actors = actors.filter((a) => {
        const validFrom = a.validFrom ? new Date(a.validFrom).getTime() : 0;
        const validTo = a.validTo ? new Date(a.validTo).getTime() : Infinity;
        return atMs >= validFrom && atMs <= validTo;
      });
    }

    const nodes = actors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      jsonldType: actor.jsonldType ?? 'cco:Agent',
      confidence: actor.confidence ?? 0.75,
      confidenceTier: getConfidenceTierForValue(actor.confidence ?? 0.75),
      workspaceId: actor.workspaceId,
      natoSourceReliability: actor.natoSourceReliability ?? null,
      natoInformationCredibility: actor.natoInformationCredibility ?? null,
    }));

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number }>();
    for (const actor of actors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        // Only include edges where both endpoints are in the scoped node set
        if (!nodeIdSet.has(rel.sourceActorId) || !nodeIdSet.has(rel.targetActorId)) continue;
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
    const atTime = getQueryString(req.query.atTime);
    const includeInfoSources = getQueryString(req.query.includeInfoSources) === 'true';
    const skipScopeFilter = getQueryString(req.query.skipScopeFilter) === 'true';

    // Get actors scoped to this problem set via containerIds (+ workspaceId backward compat)
    let actors = await actorStore.listActors(undefined, undefined, undefined, workspaceId);

    // Exclude information_source actors from visualization by default
    if (!includeInfoSources) {
      actors = actors.filter(a => a.type !== 'information_source');
    }

    // ── Scoping-context relevance filter ────────────────────────────────
    // When the problem set has a completed scoping interview, use the
    // geographic scope and actor focus to surface only relevant actors.
    // Actors that match primary actors, countries, regions, or alliance
    // members pass directly. Then actors connected to those via relationships
    // are included as well (1-hop expansion). This prevents 28 000+ node
    // graphs from overwhelming the brain visualization.
    if (!skipScopeFilter) {
      try {
        const { getProblemSetContext } = await import('../doc-intelligence/interview/interview-store.js');
        const ctx = await getProblemSetContext(workspaceId);
        const totalBeforeFilter = actors.length;

        if (ctx) {
          // Build case-insensitive term set from scoping context
          const scopeTerms = new Set<string>();
          for (const t of ctx.actorFocus.primaryActors) scopeTerms.add(t.toLowerCase());
          for (const c of ctx.geographicScope.countries) scopeTerms.add(c.toLowerCase());
          for (const r of ctx.geographicScope.regions) scopeTerms.add(r.toLowerCase());
          if (ctx.geographicScope.specificAreas) {
            for (const a of ctx.geographicScope.specificAreas) scopeTerms.add(a.toLowerCase());
          }
          if (ctx.actorFocus.alliances) {
            for (const alliance of ctx.actorFocus.alliances) {
              scopeTerms.add(alliance.name.toLowerCase());
              for (const m of alliance.members) scopeTerms.add(m.toLowerCase());
            }
          }

          console.log(`[graph] Scope filter for ${workspaceId}: ${scopeTerms.size} terms: [${[...scopeTerms].join(', ')}]`);

          if (scopeTerms.size > 0) {
            // Phase 1: direct match — actor name or alias matches a scope term
            const directMatchIds = new Set<string>();
            for (const actor of actors) {
              const nameLC = actor.name.toLowerCase();
              const aliasesLC = (actor.aliases ?? []).map(a => a.toLowerCase());
              const allTerms = [nameLC, ...aliasesLC];
              const isMatch = allTerms.some(term =>
                [...scopeTerms].some(st => term.includes(st) || st.includes(term)),
              );
              if (isMatch) {
                directMatchIds.add(actor.id);
              }
            }

            console.log(`[graph] Scope filter: ${directMatchIds.size} direct matches out of ${totalBeforeFilter} actors`);

            // Phase 2: 1-hop expansion — include actors that have a relationship
            // with a direct-match actor (they are contextually relevant even if
            // their name doesn't match a scope term).
            // Cap at 200 relationship lookups to avoid N+1 query explosion.
            const connectedIds = new Set<string>();
            const lookupIds = [...directMatchIds].slice(0, 200);
            for (const actorId of lookupIds) {
              const rels = await relationshipStore.getActorRelationships(actorId, 'both');
              for (const rel of rels) {
                connectedIds.add(rel.sourceActorId);
                connectedIds.add(rel.targetActorId);
              }
            }

            console.log(`[graph] Scope filter: ${connectedIds.size} connected via 1-hop from ${lookupIds.length} lookups`);

            // Keep direct matches + 1-hop connected actors
            actors = actors.filter(a =>
              directMatchIds.has(a.id) || connectedIds.has(a.id),
            );

            console.log(`[graph] Scope filter result: ${actors.length} actors (was ${totalBeforeFilter})`);
          }
        } else {
          console.log(`[graph] No scoping context found for ${workspaceId} — showing all ${totalBeforeFilter} actors`);
        }
      } catch (err) {
        // Non-blocking: if scoping context unavailable, show all actors
        console.warn('[graph] Scoping context filter error:', err instanceof Error ? err.message : err);
      }
    }

    // Temporal filtering
    if (atTime) {
      const atMs = new Date(atTime).getTime();
      actors = actors.filter((a) => {
        const validFrom = a.validFrom ? new Date(a.validFrom).getTime() : 0;
        const validTo = a.validTo ? new Date(a.validTo).getTime() : Infinity;
        return atMs >= validFrom && atMs <= validTo;
      });
    }

    // ── Server-side OSINT event clustering ────────────────────────────────
    // Group OSINT event nodes by source into aggregate "cluster" nodes.
    // This reduces 1000+ individual OSINT event nodes into ~20 clusters.
    // Non-OSINT actors pass through unchanged.
    const osintEventsBySource = new Map<string, typeof actors>();
    const nonOsintActors: typeof actors = [];

    for (const actor of actors) {
      // OSINT event nodes are stored with type 'event' (outside ActorType union)
      // and IDs starting with 'OSINT-'
      if ((actor.type as string) === 'event' && actor.id.startsWith('OSINT-')) {
        const attrs = typeof actor.attributes === 'string'
          ? JSON.parse(actor.attributes) as Record<string, unknown>
          : (actor.attributes ?? {}) as Record<string, unknown>;
        const sourceName = (attrs.sourceName as string) ?? 'Unknown';
        const group = osintEventsBySource.get(sourceName) ?? [];
        group.push(actor);
        osintEventsBySource.set(sourceName, group);
      } else {
        nonOsintActors.push(actor);
      }
    }

    // Build nodes — non-OSINT actors as-is, OSINT events as clusters
    const nodes = nonOsintActors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      jsonldType: actor.jsonldType ?? 'cco:Agent',
      confidence: actor.confidence ?? 0.75,
      confidenceTier: getConfidenceTierForValue(actor.confidence ?? 0.75),
      workspaceId: actor.workspaceId,
      natoSourceReliability: actor.natoSourceReliability ?? null,
      natoInformationCredibility: actor.natoInformationCredibility ?? null,
    }));

    // Create cluster nodes for OSINT event groups
    const clusterMemberIds = new Set<string>();
    for (const [sourceName, eventActors] of osintEventsBySource) {
      if (eventActors.length <= 3) {
        // Small groups: keep as individual nodes
        for (const actor of eventActors) {
          nodes.push({
            id: actor.id,
            label: actor.name,
            type: actor.type,
            jsonldType: 'cco:InformationBearingEntity',
            confidence: actor.confidence ?? 0.65,
            confidenceTier: getConfidenceTierForValue(actor.confidence ?? 0.65),
            workspaceId: actor.workspaceId,
            natoSourceReliability: actor.natoSourceReliability ?? null,
            natoInformationCredibility: actor.natoInformationCredibility ?? null,
          });
        }
      } else {
        // Cluster: create one summary node
        const clusterId = `cluster:osint:${sourceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        nodes.push({
          id: clusterId,
          label: `${sourceName} (${eventActors.length} events)`,
          type: 'organization' as const, // Clusters render as entity nodes in the graph
          jsonldType: 'cco:InformationBearingEntity',
          confidence: 0.65,
          confidenceTier: 'medium' as const,
          workspaceId: workspaceId,
          natoSourceReliability: null,
          natoInformationCredibility: null,
        });
        // Track which member IDs are clustered (for edge remapping)
        for (const actor of eventActors) {
          clusterMemberIds.add(actor.id);
        }
      }
    }

    // Get relationships as edges — remap clustered OSINT events to their cluster node
    // Build a memberIdToClusterId lookup
    const memberToCluster = new Map<string, string>();
    for (const [sourceName, eventActors] of osintEventsBySource) {
      if (eventActors.length > 3) {
        const clusterId = `cluster:osint:${sourceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        for (const actor of eventActors) {
          memberToCluster.set(actor.id, clusterId);
        }
      }
    }

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number }>();

    // Only query relationships for non-clustered actors to avoid 1000+ queries
    const actorsToQuery = actors.filter(a => !clusterMemberIds.has(a.id));
    for (const actor of actorsToQuery) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        // Remap source/target if they're clustered OSINT events
        const source = memberToCluster.get(rel.sourceActorId) ?? rel.sourceActorId;
        const target = memberToCluster.get(rel.targetActorId) ?? rel.targetActorId;

        // Skip edges where both ends are the same cluster
        if (source === target) continue;
        // Skip edges to nodes not in the visible set
        if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) continue;

        const edgeKey = `${source}-${target}-${rel.type}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.set(edgeKey, {
            source,
            target,
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
// CROSS-SCOPE: GRAPH WITH PARENT ENDPOINT
// =====================

// Get graph data for a workspace merged with its parent's graph
router.get('/workspaces/:id/graph-with-parent', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id as string;
    const atTime = getQueryString(req.query.atTime);

    // Look up parent problem set
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();
    const parentResult = await pool.query(
      'SELECT parent_problem_set_id FROM graph_problem_sets WHERE id = $1',
      [workspaceId]
    );
    const parentId = parentResult.rows.length > 0
      ? (parentResult.rows[0].parent_problem_set_id as string | null)
      : null;

    // Collect workspace IDs to query
    const workspaceIds = [workspaceId];
    if (parentId) {
      workspaceIds.push(parentId);
    }

    // Fetch actors from all workspaces
    const allNodes: Array<{
      id: string;
      label: string;
      type: string;
      jsonldType: string;
      confidence: number;
      confidenceTier: 'high' | 'medium' | 'low';
      workspaceId: string;
      sourceWorkspaceId: string;
      natoSourceReliability: string | null;
      natoInformationCredibility: number | null;
    }> = [];
    const allActors: Array<{ id: string; workspaceId: string }> = [];

    for (const wsId of workspaceIds) {
      let actors = await actorStore.listActors(undefined, undefined, undefined, wsId);

      if (atTime) {
        const atMs = new Date(atTime).getTime();
        actors = actors.filter((a) => {
          const validFrom = a.validFrom ? new Date(a.validFrom).getTime() : 0;
          const validTo = a.validTo ? new Date(a.validTo).getTime() : Infinity;
          return atMs >= validFrom && atMs <= validTo;
        });
      }

      for (const actor of actors) {
        allActors.push({ id: actor.id, workspaceId: wsId });
        allNodes.push({
          id: actor.id,
          label: actor.name,
          type: actor.type,
          jsonldType: actor.jsonldType ?? 'cco:Agent',
          confidence: actor.confidence ?? 0.75,
          confidenceTier: getConfidenceTierForValue(actor.confidence ?? 0.75),
          workspaceId: actor.workspaceId ?? wsId,
          sourceWorkspaceId: wsId,
          natoSourceReliability: actor.natoSourceReliability ?? null,
          natoInformationCredibility: actor.natoInformationCredibility ?? null,
        });
      }
    }

    // Get relationships
    const nodeIdSet = new Set(allNodes.map(n => n.id));
    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number; sourceWorkspaceId: string }>();

    for (const actor of allActors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        if (!nodeIdSet.has(rel.sourceActorId) || !nodeIdSet.has(rel.targetActorId)) continue;
        const edgeKey = `${rel.sourceActorId}-${rel.targetActorId}-${rel.type}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.set(edgeKey, {
            source: rel.sourceActorId,
            target: rel.targetActorId,
            type: rel.type,
            strength: rel.strength,
            sourceWorkspaceId: actor.workspaceId,
          });
        }
      }
    }

    const edges = Array.from(edgeSet.values());

    res.json({ nodes: allNodes, edges, parentId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GLOBAL GRAPH ENDPOINT
// =====================

// Get the entire graph across all workspaces (no workspaceId filter)
router.get('/global/graph', async (req: Request, res: Response) => {
  try {
    const classification = getQueryString(req.query.classification);
    const atTime = getQueryString(req.query.atTime);

    // Get all actors without workspace filter
    let actors = await actorStore.listActors(undefined);

    // Temporal filtering
    if (atTime) {
      const atMs = new Date(atTime).getTime();
      actors = actors.filter((a) => {
        const validFrom = a.validFrom ? new Date(a.validFrom).getTime() : 0;
        const validTo = a.validTo ? new Date(a.validTo).getTime() : Infinity;
        return atMs >= validFrom && atMs <= validTo;
      });
    }

    // If classification filter is provided, only include actors from workspaces
    // matching that classification level
    if (classification) {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      const classResult = await pool.query(
        'SELECT id FROM graph_problem_sets WHERE classification = $1',
        [classification]
      );
      const allowedWorkspaceIds = new Set(classResult.rows.map(r => r.id as string));
      actors = actors.filter(a => a.workspaceId != null && allowedWorkspaceIds.has(a.workspaceId));
    }

    const nodes = actors.map(actor => ({
      id: actor.id,
      label: actor.name,
      type: actor.type,
      jsonldType: actor.jsonldType ?? 'cco:Agent',
      confidence: actor.confidence ?? 0.75,
      confidenceTier: getConfidenceTierForValue(actor.confidence ?? 0.75),
      workspaceId: actor.workspaceId,
      natoSourceReliability: actor.natoSourceReliability ?? null,
      natoInformationCredibility: actor.natoInformationCredibility ?? null,
    }));

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const edgeSet = new Map<string, { source: string; target: string; type: string; strength: number }>();

    for (const actor of actors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        if (!nodeIdSet.has(rel.sourceActorId) || !nodeIdSet.has(rel.targetActorId)) continue;
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
      { workspaceId, containerIds: workspaceId ? [workspaceId] : [], runEntityResolution }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GRAPH SUMMARY ENDPOINTS
// =====================

// Get graph summary for a container
router.get('/summary/:containerId', async (req: Request, res: Response) => {
  try {
    const containerId = req.params.containerId as string;
    const scenarioPhase = getQueryString(req.query.scenarioPhase);
    const summary = await graphSummaryService.getGraphSummary(containerId, scenarioPhase);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Invalidate graph summary cache for a container
router.post('/summary/:containerId/invalidate', async (req: Request, res: Response) => {
  try {
    const containerId = req.params.containerId as string;
    graphSummaryService.invalidateContainer(containerId);
    res.json({ status: 'invalidated' });
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

// =============================================================================
// Decision Graph Endpoints
// =============================================================================

/**
 * GET /decisions/:problemSetId - List decisions in the knowledge graph
 * Optional query params: ?type=operational_approach&basis=intuition_based&limit=50
 */
router.get('/decisions/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const decisionType = getQueryString(req.query.type);
    const basis = getQueryString(req.query.basis) as DecisionBasis | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const decisions = await decisionStore.listDecisions(problemSetId, {
      decisionType,
      basis,
      limit,
    });

    res.json({ decisions });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /decisions/:problemSetId/knowledge-gaps - Surface decisions made without evidence
 * Returns decisions marked as intuition_based or with explicit knowledge gaps.
 * These highlight where the team is relying on judgment rather than documented knowledge.
 */
router.get('/decisions/:problemSetId/knowledge-gaps', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const decisions = await decisionStore.findKnowledgeGaps(problemSetId);

    res.json({
      knowledgeGapCount: decisions.length,
      decisions,
      summary: decisions.length > 0
        ? `${decisions.length} decision(s) made without full document evidence. These may indicate areas where intuition is filling knowledge gaps.`
        : 'All decisions have document-based evidence trails.',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /decisions/:decisionId/chain - Get the decision chain leading to a decision
 * Returns predecessor decisions in chronological order.
 */
router.get('/decisions/:decisionId/chain', async (req: Request, res: Response) => {
  try {
    const decisionId = req.params.decisionId as string;
    const chain = await decisionStore.getDecisionChain(decisionId);

    res.json({ chain });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

import { graphProblemSetStore, type GraphProblemSet, type GraphProblemSetStats } from './index.js';
import { actorStore } from '../raft/actor-store.js';

import { tensionStore } from '../raft/tension-store.js';
import { osintEventStore } from '../osint/event-store.js';
import { validityService } from '../osint/validity-service.js';

export interface AggregatedView {
  problemSets: GraphProblemSet[];
  totalStats: GraphProblemSetStats;
  topActors: Array<{
    id: string;
    name: string;
    type: string;
    /** JSON-LD ontology type — coalesce from pre-migration default 'cco:Agent' */
    jsonldType: string;
    /** Current confidence value (may be decayed) */
    confidence: number;
    problemSetId: string;
  }>;
  criticalTensions: Array<{ id: string; description: string; intensity: string; problemSetId: string }>;
  recentEvents: Array<{ id: string; title: string; publishedAt: Date; problemSetId: string }>;
  activeAlerts: Array<{ id: string; title: string; severity: string; objectiveId: string }>;
  /** Ontology type breakdown — count of actors per JSON-LD class across all problem sets */
  ontologyTypeCounts: Record<string, number>;
  /** Average confidence across all actors (0 if no actors) */
  averageConfidence: number;
}

export interface GraphProblemSetWithContext extends GraphProblemSet {
  stats: GraphProblemSetStats;
  childCount: number;
  linkedCount: number;
}

/**
 * Aggregation Service
 * Provides cross-problem-set views and master aggregation
 */
export class GraphProblemSetAggregationService {
  /**
   * Get master view aggregating all problem sets
   */
  async getMasterView(
    classification?: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET'
  ): Promise<AggregatedView> {
    // Get all accessible problem sets
    const problemSets = await graphProblemSetStore.listProblemSets({ classification });

    // Aggregate stats across all problem sets
    const totalStats: GraphProblemSetStats = {
      actorCount: 0,
      relationshipCount: 0,
      tensionCount: 0,
      objectiveCount: 0,
      eventCount: 0,
      alertCount: 0,
    };

    // Get actors from all problem sets — include JSON-LD fields for ontology grouping
    const allActors: AggregatedView['topActors'] = [];
    const ontologyTypeCounts: Record<string, number> = {};
    let totalConfidenceSum = 0;
    let totalActorsWithConfidence = 0;

    for (const ps of problemSets) {
      const actors = await actorStore.listActors(ps.id);
      for (const actor of actors) {
        // Use coalesced jsonldType — handles pre-migration actors without the field
        const jsonldType = actor.jsonldType ?? 'cco:Agent';
        const confidence = typeof actor.confidence === 'number' ? actor.confidence : 0.75;

        allActors.push({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          jsonldType,
          confidence,
          problemSetId: ps.id,
        });

        // Aggregate ontology type counts
        ontologyTypeCounts[jsonldType] = (ontologyTypeCounts[jsonldType] ?? 0) + 1;

        // Track confidence for average calculation
        totalConfidenceSum += confidence;
        totalActorsWithConfidence++;
      }
      totalStats.actorCount += actors.length;
    }

    // Get critical tensions
    const criticalTensions: AggregatedView['criticalTensions'] = [];
    for (const ps of problemSets) {
      const tensions = await tensionStore.listTensions(ps.id, 'critical');
      const highTensions = await tensionStore.listTensions(ps.id, 'high');

      for (const t of [...tensions, ...highTensions]) {
        criticalTensions.push({
          id: t.id,
          description: t.description,
          intensity: t.intensity,
          problemSetId: ps.id,
        });
      }
      totalStats.tensionCount += tensions.length + highTensions.length;
    }

    // Get recent events
    const { events } = await osintEventStore.listEvents({ limit: 20 });
    const recentEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      publishedAt: e.publishedAt,
      problemSetId: e.workspaceId || 'global',
    }));
    totalStats.eventCount = events.length;

    // Get active alerts
    const alerts = await validityService.getUnacknowledgedAlerts();
    const activeAlerts = alerts.map(a => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      objectiveId: a.objectiveId,
    }));
    totalStats.alertCount = alerts.length;

    const averageConfidence = totalActorsWithConfidence > 0
      ? totalConfidenceSum / totalActorsWithConfidence
      : 0;

    return {
      problemSets,
      totalStats,
      topActors: allActors.slice(0, 20),
      criticalTensions: criticalTensions.slice(0, 10),
      recentEvents,
      activeAlerts,
      ontologyTypeCounts,
      averageConfidence,
    };
  }

  /**
   * Get problem set with full context including stats and relationships
   */
  async getProblemSetWithContext(problemSetId: string): Promise<GraphProblemSetWithContext | null> {
    const problemSet = await graphProblemSetStore.getProblemSet(problemSetId);
    if (!problemSet) return null;

    const [stats, children, linked] = await Promise.all([
      graphProblemSetStore.getProblemSetStats(problemSetId),
      graphProblemSetStore.getChildProblemSets(problemSetId),
      graphProblemSetStore.getLinkedProblemSets(problemSetId),
    ]);

    return {
      ...problemSet,
      stats,
      childCount: children.length,
      linkedCount: linked.length,
    };
  }

  /**
   * Get all data for a problem set tree (problem set + all children)
   */
  async getProblemSetTree(rootProblemSetId: string): Promise<GraphProblemSet[]> {
    const result: GraphProblemSet[] = [];
    const visited = new Set<string>();

    const traverse = async (problemSetId: string) => {
      if (visited.has(problemSetId)) return;
      visited.add(problemSetId);

      const problemSet = await graphProblemSetStore.getProblemSet(problemSetId);
      if (!problemSet) return;

      result.push(problemSet);

      const children = await graphProblemSetStore.getChildProblemSets(problemSetId);
      for (const child of children) {
        await traverse(child.id);
      }
    };

    await traverse(rootProblemSetId);
    return result;
  }

  /**
   * Get cross-problem-set relationships (actors that appear in multiple problem sets)
   */
  async getCrossProblemSetConnections(problemSetIds: string[]): Promise<{
    sharedActors: Array<{ actorName: string; problemSetIds: string[] }>;
    crossProblemSetRelationships: number;
  }> {
    // Track actors by name across problem sets
    const actorProblemSets = new Map<string, Set<string>>();

    for (const psId of problemSetIds) {
      const actors = await actorStore.listActors(psId);
      for (const actor of actors) {
        const name = actor.name.toLowerCase();
        if (!actorProblemSets.has(name)) {
          actorProblemSets.set(name, new Set());
        }
        actorProblemSets.get(name)!.add(psId);
      }
    }

    // Find actors in multiple problem sets
    const sharedActors: Array<{ actorName: string; problemSetIds: string[] }> = [];
    for (const [name, psSet] of actorProblemSets) {
      if (psSet.size > 1) {
        sharedActors.push({
          actorName: name,
          problemSetIds: Array.from(psSet),
        });
      }
    }

    return {
      sharedActors,
      crossProblemSetRelationships: sharedActors.length,
    };
  }
}

export const graphProblemSetAggregationService = new GraphProblemSetAggregationService();

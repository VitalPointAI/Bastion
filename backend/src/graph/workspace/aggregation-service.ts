import { workspaceStore, type Workspace, type WorkspaceStats } from './index.js';
import { actorStore } from '../raft/actor-store.js';
import { relationshipStore } from '../raft/relationship-store.js';
import { tensionStore } from '../raft/tension-store.js';
import { osintEventStore } from '../osint/event-store.js';
import { validityService } from '../osint/validity-service.js';

export interface AggregatedView {
  workspaces: Workspace[];
  totalStats: WorkspaceStats;
  topActors: Array<{ id: string; name: string; type: string; workspaceId: string }>;
  criticalTensions: Array<{ id: string; description: string; intensity: string; workspaceId: string }>;
  recentEvents: Array<{ id: string; title: string; publishedAt: Date; workspaceId: string }>;
  activeAlerts: Array<{ id: string; title: string; severity: string; objectiveId: string }>;
}

export interface WorkspaceWithContext extends Workspace {
  stats: WorkspaceStats;
  childCount: number;
  linkedCount: number;
}

/**
 * Aggregation Service
 * Provides cross-workspace views and master aggregation
 */
export class AggregationService {
  /**
   * Get master view aggregating all workspaces
   */
  async getMasterView(
    classification?: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET'
  ): Promise<AggregatedView> {
    // Get all accessible workspaces
    const workspaces = await workspaceStore.listWorkspaces({ classification });

    // Aggregate stats across all workspaces
    const totalStats: WorkspaceStats = {
      actorCount: 0,
      relationshipCount: 0,
      tensionCount: 0,
      objectiveCount: 0,
      eventCount: 0,
      alertCount: 0,
    };

    // Get actors from all workspaces
    const allActors: AggregatedView['topActors'] = [];
    for (const ws of workspaces) {
      const actors = await actorStore.listActors(ws.id);
      for (const actor of actors) {
        allActors.push({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          workspaceId: ws.id,
        });
      }
      totalStats.actorCount += actors.length;
    }

    // Get critical tensions
    const criticalTensions: AggregatedView['criticalTensions'] = [];
    for (const ws of workspaces) {
      const tensions = await tensionStore.listTensions(ws.id, 'critical');
      const highTensions = await tensionStore.listTensions(ws.id, 'high');

      for (const t of [...tensions, ...highTensions]) {
        criticalTensions.push({
          id: t.id,
          description: t.description,
          intensity: t.intensity,
          workspaceId: ws.id,
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
      workspaceId: e.workspaceId || 'global',
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

    return {
      workspaces,
      totalStats,
      topActors: allActors.slice(0, 20),
      criticalTensions: criticalTensions.slice(0, 10),
      recentEvents,
      activeAlerts,
    };
  }

  /**
   * Get workspace with full context including stats and relationships
   */
  async getWorkspaceWithContext(workspaceId: string): Promise<WorkspaceWithContext | null> {
    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) return null;

    const [stats, children, linked] = await Promise.all([
      workspaceStore.getWorkspaceStats(workspaceId),
      workspaceStore.getChildWorkspaces(workspaceId),
      workspaceStore.getLinkedWorkspaces(workspaceId),
    ]);

    return {
      ...workspace,
      stats,
      childCount: children.length,
      linkedCount: linked.length,
    };
  }

  /**
   * Get all data for a workspace tree (workspace + all children)
   */
  async getWorkspaceTree(rootWorkspaceId: string): Promise<Workspace[]> {
    const result: Workspace[] = [];
    const visited = new Set<string>();

    const traverse = async (workspaceId: string) => {
      if (visited.has(workspaceId)) return;
      visited.add(workspaceId);

      const workspace = await workspaceStore.getWorkspace(workspaceId);
      if (!workspace) return;

      result.push(workspace);

      const children = await workspaceStore.getChildWorkspaces(workspaceId);
      for (const child of children) {
        await traverse(child.id);
      }
    };

    await traverse(rootWorkspaceId);
    return result;
  }

  /**
   * Get cross-workspace relationships (actors that appear in multiple workspaces)
   */
  async getCrossWorkspaceConnections(workspaceIds: string[]): Promise<{
    sharedActors: Array<{ actorName: string; workspaceIds: string[] }>;
    crossWorkspaceRelationships: number;
  }> {
    // Track actors by name across workspaces
    const actorWorkspaces = new Map<string, Set<string>>();

    for (const wsId of workspaceIds) {
      const actors = await actorStore.listActors(wsId);
      for (const actor of actors) {
        const name = actor.name.toLowerCase();
        if (!actorWorkspaces.has(name)) {
          actorWorkspaces.set(name, new Set());
        }
        actorWorkspaces.get(name)!.add(wsId);
      }
    }

    // Find actors in multiple workspaces
    const sharedActors: Array<{ actorName: string; workspaceIds: string[] }> = [];
    for (const [name, wsSet] of actorWorkspaces) {
      if (wsSet.size > 1) {
        sharedActors.push({
          actorName: name,
          workspaceIds: Array.from(wsSet),
        });
      }
    }

    return {
      sharedActors,
      crossWorkspaceRelationships: sharedActors.length,
    };
  }
}

export const aggregationService = new AggregationService();

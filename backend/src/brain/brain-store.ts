/**
 * Brain Store
 *
 * Database operations for brain visualization features:
 * annotations, snapshots, historical graph queries, gap detection,
 * and pattern alerts.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { executeReadQuery } from '../graph/neo4j-client.js';
import type {
  BrainAnnotationRow,
  BrainSnapshotRow,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  CreateSnapshotInput,
  GapReport,
  GapReportWithParentContext,
  ParentGraphSuggestion,
  PatternAlert,
} from './brain-types.js';

// =====================
// Row mappers
// =====================

function rowToAnnotation(row: Record<string, unknown>): BrainAnnotationRow {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    nodeType: row.node_type as BrainAnnotationRow['nodeType'],
    annotationType: row.annotation_type as BrainAnnotationRow['annotationType'],
    content: row.content as string | null,
    createdBy: row.created_by as string,
    problemSetId: row.problem_set_id as string,
    isShared: row.is_shared as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function rowToSnapshot(row: Record<string, unknown>): BrainSnapshotRow {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    title: row.title as string,
    summary: row.summary as string,
    timeScale: row.time_scale ? (row.time_scale as Date).toISOString() : null,
    nodeCount: row.node_count as number,
    edgeCount: row.edge_count as number,
    createdBy: row.created_by as string,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// =====================
// Annotations CRUD
// =====================

async function createAnnotation(input: CreateAnnotationInput): Promise<BrainAnnotationRow> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO brain_annotations
      (node_id, node_type, annotation_type, content, created_by, problem_set_id, is_shared)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.nodeId,
      input.nodeType,
      input.annotationType,
      input.content ?? null,
      input.createdBy,
      input.problemSetId,
      input.isShared ?? false,
    ]
  );
  return rowToAnnotation(result.rows[0]);
}

async function getAnnotations(problemSetId: string, userId: string): Promise<BrainAnnotationRow[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_annotations
     WHERE problem_set_id = $1
       AND (created_by = $2 OR is_shared = true)
     ORDER BY created_at DESC`,
    [problemSetId, userId]
  );
  return result.rows.map(rowToAnnotation);
}

async function updateAnnotation(
  id: string,
  userId: string,
  input: UpdateAnnotationInput
): Promise<BrainAnnotationRow | null> {
  const pool = getPool();

  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (input.content !== undefined) {
    sets.push(`content = $${paramIdx++}`);
    params.push(input.content);
  }
  if (input.isShared !== undefined) {
    sets.push(`is_shared = $${paramIdx++}`);
    params.push(input.isShared);
  }
  if (input.annotationType !== undefined) {
    sets.push(`annotation_type = $${paramIdx++}`);
    params.push(input.annotationType);
  }

  // Ownership check — only author can update
  params.push(id);
  params.push(userId);

  const result = await pool.query(
    `UPDATE brain_annotations
     SET ${sets.join(', ')}
     WHERE id = $${paramIdx++} AND created_by = $${paramIdx}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToAnnotation(result.rows[0]);
}

async function deleteAnnotation(id: string, userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM brain_annotations WHERE id = $1 AND created_by = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// =====================
// Snapshots CRUD
// =====================

async function createSnapshot(input: CreateSnapshotInput): Promise<BrainSnapshotRow> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO brain_snapshots
      (problem_set_id, title, summary, time_scale, node_count, edge_count, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.problemSetId,
      input.title,
      input.summary,
      input.timeScale ?? null,
      input.nodeCount ?? 0,
      input.edgeCount ?? 0,
      input.createdBy,
    ]
  );
  return rowToSnapshot(result.rows[0]);
}

async function getSnapshots(problemSetId: string): Promise<BrainSnapshotRow[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_snapshots WHERE problem_set_id = $1 ORDER BY created_at DESC`,
    [problemSetId]
  );
  return result.rows.map(rowToSnapshot);
}

async function getSnapshot(id: string): Promise<BrainSnapshotRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_snapshots WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToSnapshot(result.rows[0]);
}

async function deleteSnapshot(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM brain_snapshots WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// =====================
// Historical graph query (Neo4j)
// =====================

async function getGraphAtTime(
  problemSetId: string,
  timestamp: string
): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  // Query Neo4j for actors that existed at the given timestamp
  // Actors store workspaceId (= problemSetId) and createdAt
  const actorResult = await executeReadQuery(
    `MATCH (a:Actor)
     WHERE a.workspaceId = $workspaceId
       AND a.createdAt <= $timestamp
     RETURN a`,
    { workspaceId: problemSetId, timestamp }
  );

  const actors = actorResult.records.map((r) => {
    const props = r.get('a').properties as Record<string, unknown>;
    return {
      id: props.id as string,
      label: props.name as string,
      type: props.type as string,
      workspaceId: props.workspaceId as string,
      createdAt: props.createdAt as string,
    };
  });

  const actorIdSet = new Set(actors.map((a) => a.id));

  if (actorIdSet.size === 0) {
    return { nodes: actors, edges: [] };
  }

  // Query relationships where both endpoints existed at the timestamp
  const relResult = await executeReadQuery(
    `MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor)
     WHERE source.workspaceId = $workspaceId
       AND r.createdAt <= $timestamp
       AND source.createdAt <= $timestamp
       AND target.createdAt <= $timestamp
     RETURN r, source.id AS sourceId, target.id AS targetId`,
    { workspaceId: problemSetId, timestamp }
  );

  const edges = relResult.records
    .map((r) => {
      const relProps = r.get('r').properties as Record<string, unknown>;
      const sourceId = r.get('sourceId') as string;
      const targetId = r.get('targetId') as string;
      // Filter to only edges where both nodes exist in our actor set
      if (!actorIdSet.has(sourceId) || !actorIdSet.has(targetId)) return null;
      return {
        id: relProps.id as string,
        source: sourceId,
        target: targetId,
        type: relProps.type as string,
        strength: relProps.strength as number,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return { nodes: actors, edges };
}

// =====================
// Gap detection (heuristic)
// =====================

async function getIntelligenceGaps(problemSetId: string): Promise<GapReport> {
  // Query Neo4j for actors with fewer than 2 relationships (under-connected nodes)
  const result = await executeReadQuery(
    `MATCH (a:Actor)
     WHERE a.workspaceId = $workspaceId
     OPTIONAL MATCH (a)-[r:RELATES_TO]-()
     WITH a, COUNT(r) AS relCount
     WHERE relCount < 2
     RETURN a, relCount`,
    { workspaceId: problemSetId }
  );

  // Define typical connection types by actor type for gap analysis
  const expectedConnectionsByType: Record<string, string[]> = {
    nation: ['alliance', 'conflict', 'trade', 'diplomatic'],
    organization: ['member', 'affiliated', 'opposes', 'supports'],
    individual: ['member_of', 'commands', 'reports_to'],
    non_state_actor: ['affiliated', 'opposes', 'controls'],
  };

  const gaps = result.records.map((record) => {
    const props = record.get('a').properties as Record<string, unknown>;
    const relCount = typeof record.get('relCount') === 'object'
      ? (record.get('relCount') as { toNumber: () => number }).toNumber()
      : (record.get('relCount') as number);

    const actorType = (props.type as string) || 'unknown';
    const expectedTypes = expectedConnectionsByType[actorType] ?? ['alliance', 'conflict', 'affiliated'];
    const expectedCount = expectedTypes.length;

    return {
      nodeId: props.id as string,
      nodeLabel: props.name as string,
      nodeType: actorType,
      missingConnectionTypes: expectedTypes.slice(relCount),
      expectedConnections: expectedCount,
      actualConnections: relCount,
    };
  });

  return { gaps };
}

// =====================
// Gap detection with parent context
// =====================

/**
 * Get intelligence gaps for a problem set plus suggestions from the parent
 * graph. Parent suggestions are actors in the parent workspace that are
 * related (via RELATES_TO) to entities already present in the child
 * workspace but do not themselves exist in the child workspace.
 */
async function getIntelligenceGapsWithParentContext(
  problemSetId: string,
): Promise<GapReportWithParentContext> {
  // 1. Get local gaps via existing method
  const localReport = await getIntelligenceGaps(problemSetId);

  // 2. Look up parent problem set
  const pool = getPool();
  const parentResult = await pool.query(
    'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
    [problemSetId],
  );

  const parentId = parentResult.rows[0]?.parent_problem_set_id as string | undefined;

  if (!parentId) {
    return { ...localReport, parentSuggestions: [] };
  }

  // 3. Find actors in the parent graph that are related to entities in the
  //    child graph but do not themselves exist in the child graph.
  //    This surfaces "available from parent" intelligence that may help fill gaps.
  const parentSuggestionResult = await executeReadQuery(
    `MATCH (parentActor:Actor {workspaceId: $parentId})-[r:RELATES_TO]-(childActor:Actor {workspaceId: $childId})
     WHERE NOT EXISTS {
       MATCH (existing:Actor {workspaceId: $childId})
       WHERE existing.name = parentActor.name
     }
     RETURN DISTINCT
       parentActor.id AS actorId,
       parentActor.name AS actorName,
       parentActor.type AS actorType,
       childActor.name AS relatedChildActor,
       type(r) AS relType
     LIMIT 30`,
    { parentId, childId: problemSetId },
  );

  const suggestions: ParentGraphSuggestion[] = parentSuggestionResult.records.map(
    (record) => ({
      actorId: record.get('actorId') as string,
      actorName: record.get('actorName') as string,
      actorType: (record.get('actorType') as string) || 'unknown',
      relevanceReason: `Related to ${record.get('relatedChildActor')} via ${record.get('relType')} in parent graph`,
      parentWorkspaceId: parentId,
    }),
  );

  // Deduplicate by actorId (an actor may relate to multiple child entities)
  const seen = new Set<string>();
  const dedupedSuggestions = suggestions.filter((s) => {
    if (seen.has(s.actorId)) return false;
    seen.add(s.actorId);
    return true;
  });

  return {
    ...localReport,
    parentSuggestions: dedupedSuggestions,
  };
}

// =====================
// Pattern alerts
// =====================

async function getPatternAlerts(problemSetId: string): Promise<PatternAlert[]> {
  const alerts: PatternAlert[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Query recent node additions vs 30-day average for trend detection
  const recentResult = await executeReadQuery(
    `MATCH (a:Actor)
     WHERE a.workspaceId = $workspaceId AND a.createdAt >= $since
     RETURN COUNT(a) AS recentCount`,
    { workspaceId: problemSetId, since: sevenDaysAgo }
  );

  const avgResult = await executeReadQuery(
    `MATCH (a:Actor)
     WHERE a.workspaceId = $workspaceId AND a.createdAt >= $since
     RETURN COUNT(a) AS totalCount`,
    { workspaceId: problemSetId, since: thirtyDaysAgo }
  );

  const toNum = (val: unknown): number => {
    if (val && typeof val === 'object' && 'toNumber' in val) {
      return (val as { toNumber: () => number }).toNumber();
    }
    return val as number;
  };

  const recentCount = toNum(recentResult.records[0]?.get('recentCount') ?? 0);
  const totalCount30 = toNum(avgResult.records[0]?.get('totalCount') ?? 0);

  // 7-day average = recent period. 30-day average weekly = totalCount30 / 4.3
  const weeklyAvg = totalCount30 / 4.3;
  if (weeklyAvg > 0 && recentCount > weeklyAvg * 1.5) {
    alerts.push({
      id: `trend-${randomUUID()}`,
      type: 'trend',
      message: `Node addition rate is ${Math.round((recentCount / weeklyAvg - 1) * 100)}% above 30-day average (${recentCount} new nodes in last 7 days vs ${weeklyAvg.toFixed(1)} weekly average)`,
      severity: recentCount > weeklyAvg * 2 ? 'high' : 'medium',
      detectedAt: new Date().toISOString(),
      relatedNodeIds: [],
    });
  }

  // Anomaly detection: contradicting relationships (same source+target, opposing types)
  const anomalyResult = await executeReadQuery(
    `MATCH (a:Actor)-[r1:RELATES_TO]->(b:Actor)
     MATCH (a)-[r2:RELATES_TO]->(b)
     WHERE a.workspaceId = $workspaceId
       AND r1.id <> r2.id
       AND (
         (r1.type = 'alliance' AND r2.type = 'conflict') OR
         (r1.type = 'conflict' AND r2.type = 'alliance') OR
         (r1.type = 'supports' AND r2.type = 'opposes') OR
         (r1.type = 'opposes' AND r2.type = 'supports')
       )
     RETURN a.id AS sourceId, b.id AS targetId, r1.type AS type1, r2.type AS type2
     LIMIT 10`,
    { workspaceId: problemSetId }
  );

  for (const record of anomalyResult.records) {
    const sourceId = record.get('sourceId') as string;
    const targetId = record.get('targetId') as string;
    const type1 = record.get('type1') as string;
    const type2 = record.get('type2') as string;
    alerts.push({
      id: `anomaly-${randomUUID()}`,
      type: 'anomaly',
      message: `Contradicting relationship detected: same actor pair has both "${type1}" and "${type2}" connections`,
      severity: 'high',
      detectedAt: new Date().toISOString(),
      relatedNodeIds: [sourceId, targetId],
    });
  }

  return alerts;
}

// =====================
// Context query methods (for StrategicContextService)
// =====================

/**
 * Get the most recently saved snapshot for a problem set.
 * Used by StrategicContextService to inject "source of truth" summaries
 * into AI agent context bundles.
 */
async function getLatestSnapshot(problemSetId: string): Promise<BrainSnapshotRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_snapshots
     WHERE problem_set_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [problemSetId],
  );
  if (result.rows.length === 0) return null;
  return rowToSnapshot(result.rows[0]);
}

/**
 * Get recent shared annotations for a problem set (up to 50).
 * Used by StrategicContextService to include human-curated node insights
 * in the AI agent context bundle.
 */
async function getSharedAnnotationsForContext(problemSetId: string): Promise<BrainAnnotationRow[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_annotations
     WHERE problem_set_id = $1
       AND is_shared = true
     ORDER BY created_at DESC
     LIMIT 50`,
    [problemSetId],
  );
  return result.rows.map(rowToAnnotation);
}

// =====================
// Exported BrainStore
// =====================

export const brainStore = {
  createAnnotation,
  getAnnotations,
  updateAnnotation,
  deleteAnnotation,
  createSnapshot,
  getSnapshots,
  getSnapshot,
  deleteSnapshot,
  getGraphAtTime,
  getIntelligenceGaps,
  getIntelligenceGapsWithParentContext,
  getPatternAlerts,
  getLatestSnapshot,
  getSharedAnnotationsForContext,
};

export type BrainStore = typeof brainStore;

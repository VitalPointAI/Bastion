/**
 * Ends-Ways-Means (E-W-M) Linkage Store
 *
 * Phase 33 Plan 01: PostgreSQL CRUD for E-W-M linkages with gap analysis.
 * Links strategic objectives (Ends) to LOEs/COAs (Ways) to forces/resources (Means).
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  EWMLinkage,
  EWMGap,
  EWMWayType,
  EWMMeanType,
} from './types.js';

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLinkage(row: Record<string, any>): EWMLinkage {
  return {
    id: row.id,
    jppInstanceId: row.jpp_instance_id,
    endObjectiveId: row.end_objective_id,
    wayId: row.way_id,
    wayType: row.way_type as EWMWayType,
    meanId: row.mean_id ?? null,
    meanType: row.mean_type ? (row.mean_type as EWMMeanType) : null,
    allocationPct: Number(row.allocation_pct ?? 0),
    createdAt: new Date(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// EWM Store
// ---------------------------------------------------------------------------

class EWMStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ewm_linkages (
        id TEXT PRIMARY KEY,
        jpp_instance_id TEXT NOT NULL,
        end_objective_id TEXT NOT NULL,
        way_id TEXT NOT NULL,
        way_type TEXT NOT NULL,
        mean_id TEXT,
        mean_type TEXT,
        allocation_pct REAL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ewm_linkages_instance
        ON ewm_linkages(jpp_instance_id);
      CREATE INDEX IF NOT EXISTS idx_ewm_linkages_end
        ON ewm_linkages(end_objective_id);
      CREATE INDEX IF NOT EXISTS idx_ewm_linkages_way
        ON ewm_linkages(way_id);
    `);
    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async createLinkage(data: {
    jppInstanceId: string;
    endObjectiveId: string;
    wayId: string;
    wayType: EWMWayType;
    meanId?: string | null;
    meanType?: EWMMeanType | null;
    allocationPct?: number;
  }): Promise<EWMLinkage> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `EWM-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO ewm_linkages
         (id, jpp_instance_id, end_objective_id, way_id, way_type, mean_id, mean_type, allocation_pct, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.jppInstanceId,
        data.endObjectiveId,
        data.wayId,
        data.wayType,
        data.meanId ?? null,
        data.meanType ?? null,
        data.allocationPct ?? 0,
        now,
      ],
    );

    const result = await pool.query('SELECT * FROM ewm_linkages WHERE id = $1', [id]);
    return rowToLinkage(result.rows[0]);
  }

  async deleteLinkage(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query('DELETE FROM ewm_linkages WHERE id = $1', [id]);
  }

  async getLinkagesByInstance(jppInstanceId: string): Promise<EWMLinkage[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ewm_linkages WHERE jpp_instance_id = $1 ORDER BY created_at ASC',
      [jppInstanceId],
    );
    return result.rows.map(rowToLinkage);
  }

  // -------------------------------------------------------------------------
  // Aggregate queries
  // -------------------------------------------------------------------------

  async getEnds(jppInstanceId: string): Promise<Array<{ endObjectiveId: string; wayCount: number }>> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT end_objective_id, COUNT(DISTINCT way_id)::int AS way_count
       FROM ewm_linkages
       WHERE jpp_instance_id = $1
       GROUP BY end_objective_id
       ORDER BY end_objective_id`,
      [jppInstanceId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      endObjectiveId: r.end_objective_id as string,
      wayCount: Number(r.way_count),
    }));
  }

  async getWays(jppInstanceId: string): Promise<Array<{
    wayId: string;
    wayType: EWMWayType;
    endCount: number;
    meanCount: number;
  }>> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         way_id,
         way_type,
         COUNT(DISTINCT end_objective_id)::int AS end_count,
         COUNT(DISTINCT mean_id) FILTER (WHERE mean_id IS NOT NULL)::int AS mean_count
       FROM ewm_linkages
       WHERE jpp_instance_id = $1
       GROUP BY way_id, way_type
       ORDER BY way_id`,
      [jppInstanceId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      wayId: r.way_id as string,
      wayType: r.way_type as EWMWayType,
      endCount: Number(r.end_count),
      meanCount: Number(r.mean_count),
    }));
  }

  async getMeans(jppInstanceId: string): Promise<Array<{
    meanId: string;
    meanType: EWMMeanType;
    wayCount: number;
    totalAllocation: number;
  }>> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         mean_id,
         mean_type,
         COUNT(DISTINCT way_id)::int AS way_count,
         COALESCE(SUM(allocation_pct), 0)::real AS total_allocation
       FROM ewm_linkages
       WHERE jpp_instance_id = $1 AND mean_id IS NOT NULL
       GROUP BY mean_id, mean_type
       ORDER BY mean_id`,
      [jppInstanceId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      meanId: r.mean_id as string,
      meanType: r.mean_type as EWMMeanType,
      wayCount: Number(r.way_count),
      totalAllocation: Number(r.total_allocation),
    }));
  }

  async updateAllocation(linkageId: string, allocationPct: number): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query(
      'UPDATE ewm_linkages SET allocation_pct = $1 WHERE id = $2',
      [allocationPct, linkageId],
    );
  }

  // -------------------------------------------------------------------------
  // Gap Analysis
  // -------------------------------------------------------------------------

  /**
   * Identify gaps in the E-W-M linkage framework:
   * (a) Ends (objectives) with zero linked Ways
   * (b) Ways with zero linked Ends
   * (c) Means with zero linked Ways
   * (d) Means where total allocation_pct > 100
   *
   * NOTE: (b) and (c) are detected from the linkage table itself.
   * Truly "orphan" entities (never appearing in any linkage row) would need
   * to be checked against their source tables (strategic_objectives, etc.).
   * This method reports gaps observable from the linkage graph.
   */
  async findGaps(jppInstanceId: string): Promise<EWMGap[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const gaps: EWMGap[] = [];

    // (a) Ends with zero linked ways (end appears only in linkages with NULL way — impossible
    //     by schema, so instead we look for ends in linkages that have only self-referential rows
    //     with no distinct ways. Actually, all linkage rows require way_id, so an "unlinked end"
    //     means an objective that exists in strategic_objectives but has no ewm_linkages row.
    //     We query strategic_objectives LEFT JOIN ewm_linkages.
    const unlinkedEnds = await pool.query(
      `SELECT so.id AS entity_id, so.description AS entity_name
       FROM strategic_objectives so
       LEFT JOIN ewm_linkages el
         ON el.end_objective_id = so.id AND el.jpp_instance_id = $1
       WHERE el.id IS NULL
       ORDER BY so.id`,
      [jppInstanceId],
    );

    for (const row of unlinkedEnds.rows) {
      gaps.push({
        type: 'unlinked_end',
        entityId: row.entity_id,
        entityName: row.entity_name ?? row.entity_id,
        details: 'Objective has no linked Ways (LOEs or COAs)',
      });
    }

    // (b) Ways linked to ends but with zero means
    const unsupportedWays = await pool.query(
      `SELECT way_id, way_type, COUNT(DISTINCT end_objective_id)::int AS end_count
       FROM ewm_linkages
       WHERE jpp_instance_id = $1
       GROUP BY way_id, way_type
       HAVING COUNT(DISTINCT mean_id) FILTER (WHERE mean_id IS NOT NULL) = 0`,
      [jppInstanceId],
    );

    for (const row of unsupportedWays.rows) {
      gaps.push({
        type: 'unsupported_way',
        entityId: row.way_id,
        entityName: `${row.way_type}:${row.way_id}`,
        details: `Way has ${row.end_count} linked End(s) but zero allocated Means`,
      });
    }

    // (c) Means with zero linked ways (means that appear only in NULL-way rows — again,
    //     way_id is required, so a truly unallocated mean would not appear in linkages at all.
    //     We flag means where allocation is 0 across all linkages.)
    const unallocatedMeans = await pool.query(
      `SELECT mean_id, mean_type, COUNT(DISTINCT way_id)::int AS way_count
       FROM ewm_linkages
       WHERE jpp_instance_id = $1 AND mean_id IS NOT NULL
       GROUP BY mean_id, mean_type
       HAVING COALESCE(SUM(allocation_pct), 0) = 0`,
      [jppInstanceId],
    );

    for (const row of unallocatedMeans.rows) {
      gaps.push({
        type: 'unallocated_mean',
        entityId: row.mean_id,
        entityName: `${row.mean_type}:${row.mean_id}`,
        details: `Mean is linked to ${row.way_count} Way(s) but has 0% total allocation`,
      });
    }

    // (d) Over-allocated means (total allocation > 100%)
    const overAllocated = await pool.query(
      `SELECT mean_id, mean_type, SUM(allocation_pct)::real AS total_allocation
       FROM ewm_linkages
       WHERE jpp_instance_id = $1 AND mean_id IS NOT NULL
       GROUP BY mean_id, mean_type
       HAVING SUM(allocation_pct) > 100`,
      [jppInstanceId],
    );

    for (const row of overAllocated.rows) {
      gaps.push({
        type: 'over_allocated_mean',
        entityId: row.mean_id,
        entityName: `${row.mean_type}:${row.mean_id}`,
        details: `Mean allocated at ${row.total_allocation}% (exceeds 100%)`,
      });
    }

    return gaps;
  }
}

export const ewmStore = new EWMStore();

/**
 * IPB Assessment Store
 *
 * Phase 14 Plan 01: CRUD for ipb_assessments with version history chain.
 * Every query against team-specific data uses `AND team = ANY($N)`.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { IPBAssessment, CreateIPBAssessment, OAKOCAnalysis, IPBLayer, NamedAreaOfInterest, ForceDisposition } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToIPB(row: Record<string, unknown>): IPBAssessment {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    team: row.team as IPBAssessment['team'],
    perspective: row.perspective as IPBAssessment['perspective'],
    exercisePhase: row.exercise_phase as string,
    areaOfOperations: (row.area_of_operations as Record<string, unknown>) ?? {},
    terrainAnalysis: (row.terrain_analysis as OAKOCAnalysis) ?? {} as OAKOCAnalysis,
    threatAssessment: (row.threat_assessment as string) ?? '',
    civilConsiderations: (row.civil_considerations as string) ?? '',
    namedAreasOfInterest: (row.named_areas_of_interest as NamedAreaOfInterest[]) ?? [],
    forceDispositions: (row.force_dispositions as ForceDisposition[]) ?? [],
    overlayLayers: (row.overlay_layers as IPBLayer[]) ?? [],
    version: row.version as number,
    parentVersionId: (row.parent_version_id as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class IPBStore {
  private pool = getPool();

  /**
   * Create a new IPB assessment
   */
  async create(data: CreateIPBAssessment): Promise<IPBAssessment> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO ipb_assessments
         (id, scenario_id, team, perspective, exercise_phase,
          area_of_operations, terrain_analysis, threat_assessment, civil_considerations,
          named_areas_of_interest, force_dispositions, overlay_layers,
          version, parent_version_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id,
        data.scenarioId,
        data.team,
        data.perspective,
        data.exercisePhase,
        JSON.stringify(data.areaOfOperations ?? {}),
        JSON.stringify(data.terrainAnalysis ?? {}),
        data.threatAssessment ?? '',
        data.civilConsiderations ?? '',
        JSON.stringify(data.namedAreasOfInterest ?? []),
        JSON.stringify(data.forceDispositions ?? []),
        JSON.stringify(data.overlayLayers ?? []),
        data.version ?? 1,
        data.parentVersionId ?? null,
        data.createdBy,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM ipb_assessments WHERE id = $1',
      [id]
    );
    return rowToIPB(result.rows[0]);
  }

  /**
   * Find all assessments for a scenario visible to the given teams
   */
  async findByScenario(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment[]> {
    const result = await this.pool.query(
      `SELECT * FROM ipb_assessments
       WHERE scenario_id = $1 AND team = ANY($2)
       ORDER BY version DESC, created_at DESC`,
      [scenarioId, visibleTeams]
    );
    return result.rows.map(rowToIPB);
  }

  /**
   * Find the latest assessment for a specific team/perspective combination
   */
  async findByScenarioAndPerspective(
    scenarioId: string,
    team: string,
    perspective: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment | null> {
    const result = await this.pool.query(
      `SELECT * FROM ipb_assessments
       WHERE scenario_id = $1
         AND team = $2
         AND perspective = $3
         AND team = ANY($4)
       ORDER BY version DESC
       LIMIT 1`,
      [scenarioId, team, perspective, visibleTeams]
    );
    return result.rows[0] ? rowToIPB(result.rows[0]) : null;
  }

  /**
   * Find an assessment by ID with team barrier check
   */
  async findById(
    id: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment | null> {
    const result = await this.pool.query(
      `SELECT * FROM ipb_assessments
       WHERE id = $1 AND team = ANY($2)`,
      [id, visibleTeams]
    );
    return result.rows[0] ? rowToIPB(result.rows[0]) : null;
  }

  /**
   * Create a new version of an existing assessment.
   * Copies parent data, increments version, sets parentVersionId.
   */
  async createNewVersion(
    parentId: string,
    data: Partial<IPBAssessment>
  ): Promise<IPBAssessment> {
    const parent = await this.pool.query(
      'SELECT * FROM ipb_assessments WHERE id = $1',
      [parentId]
    );
    if (!parent.rows[0]) {
      throw new Error(`IPB assessment ${parentId} not found`);
    }

    const parentAssessment = rowToIPB(parent.rows[0]);
    const merged: CreateIPBAssessment = {
      scenarioId: parentAssessment.scenarioId,
      team: data.team ?? parentAssessment.team,
      perspective: data.perspective ?? parentAssessment.perspective,
      exercisePhase: data.exercisePhase ?? parentAssessment.exercisePhase,
      areaOfOperations: data.areaOfOperations ?? parentAssessment.areaOfOperations,
      terrainAnalysis: data.terrainAnalysis ?? parentAssessment.terrainAnalysis,
      threatAssessment: data.threatAssessment ?? parentAssessment.threatAssessment,
      civilConsiderations: data.civilConsiderations ?? parentAssessment.civilConsiderations,
      namedAreasOfInterest: data.namedAreasOfInterest ?? parentAssessment.namedAreasOfInterest,
      forceDispositions: data.forceDispositions ?? parentAssessment.forceDispositions,
      overlayLayers: data.overlayLayers ?? parentAssessment.overlayLayers,
      version: parentAssessment.version + 1,
      parentVersionId: parentId,
      createdBy: data.createdBy ?? parentAssessment.createdBy,
    };

    return this.create(merged);
  }

  /**
   * Follow the parentVersionId chain backwards to retrieve full version history
   */
  async getVersionHistory(
    assessmentId: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment[]> {
    const history: IPBAssessment[] = [];
    let currentId: string | null = assessmentId;

    while (currentId !== null) {
      const result = await this.pool.query(
        `SELECT * FROM ipb_assessments
         WHERE id = $1 AND team = ANY($2)`,
        [currentId, visibleTeams]
      );
      if (!result.rows[0]) break;

      const assessment = rowToIPB(result.rows[0]);
      history.push(assessment);
      currentId = assessment.parentVersionId;
    }

    return history;
  }
}

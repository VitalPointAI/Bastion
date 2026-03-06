/**
 * Operational Design Store
 *
 * Phase 25 Plan 01: PostgreSQL CRUD for operational_designs table.
 * One design record per problem set, auto-created on first access.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  OperationalDesign,
  DesignStatus,
  DesignHandoffPayload,
  ProblemFramingData,
  CoGAnalysis,
  LineOfEffort,
  OperationalApproach,
  SectionStatus,
} from './types.js';

// ─── Table Initialization ────────────────────────────────────────────────────

async function initDesignTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operational_designs (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL UNIQUE REFERENCES problem_sets(id) ON DELETE CASCADE,
      problem_framing JSONB NOT NULL DEFAULT '${JSON.stringify(defaultProblemFraming())}',
      cog_analysis JSONB NOT NULL DEFAULT '{"friendly":{"root":null},"adversary":{"root":null}}',
      lines_of_effort JSONB NOT NULL DEFAULT '[]',
      operational_approach JSONB NOT NULL DEFAULT '${JSON.stringify(defaultOperationalApproach())}',
      status JSONB NOT NULL DEFAULT '${JSON.stringify(defaultStatus())}',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_operational_designs_problem_set
      ON operational_designs(problem_set_id);
  `);
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function defaultProblemFraming(): ProblemFramingData {
  return {
    currentState: '',
    desiredEndState: '',
    problemStatement: '',
    keyTensions: [],
    obstacles: [],
    opportunities: [],
    assumptions: [],
    constraints: [],
  };
}

function defaultOperationalApproach(): OperationalApproach {
  return {
    phases: [],
    transitions: [],
    decisionPoints: [],
    narrative: '',
  };
}

function defaultStatus(): DesignStatus {
  return {
    problemFraming: 'not-started',
    cogAnalysis: 'not-started',
    linesOfEffort: 'not-started',
    operationalApproach: 'not-started',
  };
}

// ─── Status Derivation ──────────────────────────────────────────────────────

function deriveProblemFramingStatus(data: ProblemFramingData): SectionStatus {
  const hasCurrentState = (data.currentState ?? '').trim().length > 0;
  const hasEndState = (data.desiredEndState ?? '').trim().length > 0;
  const hasProblemStatement = (data.problemStatement ?? '').trim().length > 0;

  if (hasCurrentState && hasEndState && hasProblemStatement) return 'complete';

  // Check if any field has content
  const hasAnyContent =
    hasCurrentState ||
    hasEndState ||
    hasProblemStatement ||
    (data.keyTensions ?? []).length > 0 ||
    (data.obstacles ?? []).length > 0 ||
    (data.opportunities ?? []).length > 0 ||
    (data.assumptions ?? []).length > 0 ||
    (data.constraints ?? []).length > 0;

  return hasAnyContent ? 'in-progress' : 'not-started';
}

function deriveCogAnalysisStatus(data: CoGAnalysis): SectionStatus {
  const hasFriendly = data.friendly?.root !== null && data.friendly?.root !== undefined;
  const hasAdversary = data.adversary?.root !== null && data.adversary?.root !== undefined;

  if (hasFriendly && hasAdversary) return 'complete';
  if (hasFriendly || hasAdversary) return 'in-progress';
  return 'not-started';
}

function deriveLinesOfEffortStatus(data: LineOfEffort[]): SectionStatus {
  if (!Array.isArray(data) || data.length === 0) return 'not-started';
  const allHaveDPs = data.every(loe => (loe.decisivePoints ?? []).length >= 1);
  return allHaveDPs ? 'complete' : 'in-progress';
}

function deriveOperationalApproachStatus(data: OperationalApproach): SectionStatus {
  const hasPhases = (data.phases ?? []).length >= 1;
  const hasNarrative = (data.narrative ?? '').trim().length > 0;

  if (hasPhases && hasNarrative) return 'complete';

  const hasAny =
    hasPhases ||
    hasNarrative ||
    (data.transitions ?? []).length > 0 ||
    (data.decisionPoints ?? []).length > 0;

  return hasAny ? 'in-progress' : 'not-started';
}

// Section name to DB column mapping
const SECTION_COLUMN_MAP: Record<string, string> = {
  'problem-framing': 'problem_framing',
  'cog-analysis': 'cog_analysis',
  'lines-of-effort': 'lines_of_effort',
  'operational-approach': 'operational_approach',
};

// Section name to status key mapping
const SECTION_STATUS_KEY_MAP: Record<string, keyof DesignStatus> = {
  'problem-framing': 'problemFraming',
  'cog-analysis': 'cogAnalysis',
  'lines-of-effort': 'linesOfEffort',
  'operational-approach': 'operationalApproach',
};

// Status derivation functions per section
const STATUS_DERIVERS: Record<string, (data: unknown) => SectionStatus> = {
  'problem-framing': (data) => deriveProblemFramingStatus(data as ProblemFramingData),
  'cog-analysis': (data) => deriveCogAnalysisStatus(data as CoGAnalysis),
  'lines-of-effort': (data) => deriveLinesOfEffortStatus(data as LineOfEffort[]),
  'operational-approach': (data) => deriveOperationalApproachStatus(data as OperationalApproach),
};

// ─── Row-to-Model Mapping ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDesign(row: Record<string, any>): OperationalDesign {
  return {
    id: row.id,
    problemSetId: row.problem_set_id,
    problemFraming: row.problem_framing as ProblemFramingData,
    cogAnalysis: row.cog_analysis as CoGAnalysis,
    linesOfEffort: row.lines_of_effort as LineOfEffort[],
    operationalApproach: row.operational_approach as OperationalApproach,
    status: row.status as DesignStatus,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ─── Design Store ───────────────────────────────────────────────────────────

class DesignStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initDesignTable();
    this.initialized = true;
  }

  /**
   * Get or auto-create design record for a problem set.
   */
  async getByProblemSetId(problemSetId: string, createdBy = 'system'): Promise<OperationalDesign> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM operational_designs WHERE problem_set_id = $1',
      [problemSetId]
    );

    if (result.rows[0]) {
      return rowToDesign(result.rows[0]);
    }

    // Auto-create with defaults
    const id = `DESIGN-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO operational_designs (
        id, problem_set_id, problem_framing, cog_analysis, lines_of_effort,
        operational_approach, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        problemSetId,
        JSON.stringify(defaultProblemFraming()),
        JSON.stringify({ friendly: { root: null }, adversary: { root: null } }),
        JSON.stringify([]),
        JSON.stringify(defaultOperationalApproach()),
        JSON.stringify(defaultStatus()),
        createdBy,
        now,
        now,
      ]
    );

    const created = await pool.query(
      'SELECT * FROM operational_designs WHERE id = $1',
      [id]
    );
    return rowToDesign(created.rows[0]);
  }

  /**
   * Update one section's data and auto-derive its status.
   */
  async updateSection(
    problemSetId: string,
    section: string,
    data: unknown
  ): Promise<OperationalDesign> {
    await this.ensureInitialized();

    const column = SECTION_COLUMN_MAP[section];
    if (!column) {
      throw new Error(`Invalid section: ${section}. Must be one of: ${Object.keys(SECTION_COLUMN_MAP).join(', ')}`);
    }

    const statusKey = SECTION_STATUS_KEY_MAP[section];
    const deriveStatus = STATUS_DERIVERS[section];
    const newStatus = deriveStatus(data);

    const pool = getPool();
    await pool.query(
      `UPDATE operational_designs
       SET ${column} = $1,
           status = jsonb_set(status, $2, $3),
           updated_at = NOW()
       WHERE problem_set_id = $4`,
      [
        JSON.stringify(data),
        `{${statusKey}}`,
        JSON.stringify(newStatus),
        problemSetId,
      ]
    );

    return this.getByProblemSetId(problemSetId);
  }

  /**
   * Return just the status JSONB for a problem set's design.
   */
  async getStatus(problemSetId: string): Promise<DesignStatus> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT status FROM operational_designs WHERE problem_set_id = $1',
      [problemSetId]
    );

    if (!result.rows[0]) {
      // Auto-create and return default status
      const design = await this.getByProblemSetId(problemSetId);
      return design.status;
    }

    return result.rows[0].status as DesignStatus;
  }

  /**
   * Assemble and return DesignHandoffPayload from stored data.
   */
  async getHandoffPayload(problemSetId: string): Promise<DesignHandoffPayload> {
    const design = await this.getByProblemSetId(problemSetId);

    return {
      problemStatement: design.problemFraming.problemStatement,
      cogAnalysis: design.cogAnalysis,
      linesOfEffort: design.linesOfEffort,
      phases: design.operationalApproach.phases,
      objectives: design.linesOfEffort
        .filter(loe => loe.objectiveId)
        .map(loe => loe.objectiveId!),
      assumptions: design.problemFraming.assumptions,
      constraints: design.problemFraming.constraints,
    };
  }
}

export const designStore = new DesignStore();

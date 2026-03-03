/**
 * Scenario Document Store
 *
 * Phase 14 Plan 01: CRUD for scenario_documents with team-based
 * information barrier filtering via `AND team = ANY($N)`.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ScenarioDocument, CreateScenarioDocument } from './types.js';

// ─── Column list (excludes file_data blob to avoid loading large buffers) ────

const DOC_COLUMNS = `id, scenario_id, team, exercise_phase, document_type, filename,
  mime_type, text_content, extracted_data, extraction_confidence, created_at, updated_at`;

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToDocument(row: Record<string, unknown>): ScenarioDocument {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    team: row.team as ScenarioDocument['team'],
    exercisePhase: row.exercise_phase as string,
    documentType: row.document_type as ScenarioDocument['documentType'],
    filename: row.filename as string,
    mimeType: row.mime_type as string,
    textContent: row.text_content as string,
    extractedData: (row.extracted_data as Record<string, unknown>) ?? {},
    extractionConfidence: parseFloat(String(row.extraction_confidence ?? 0)),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class ScenarioDocumentStore {
  private pool = getPool();

  /**
   * Create a new scenario document, optionally storing the original file buffer.
   */
  async create(
    data: CreateScenarioDocument,
    fileData?: Buffer
  ): Promise<ScenarioDocument> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO scenario_documents
         (id, scenario_id, team, exercise_phase, document_type, filename, mime_type,
          text_content, extracted_data, extraction_confidence, file_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        data.scenarioId,
        data.team,
        data.exercisePhase,
        data.documentType,
        data.filename,
        data.mimeType,
        data.textContent,
        JSON.stringify(data.extractedData ?? {}),
        data.extractionConfidence ?? 0,
        fileData ?? null,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      `SELECT ${DOC_COLUMNS} FROM scenario_documents WHERE id = $1`,
      [id]
    );
    return rowToDocument(result.rows[0]);
  }

  /**
   * Find all documents for a scenario visible to the given teams
   */
  async findByScenario(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<ScenarioDocument[]> {
    const result = await this.pool.query(
      `SELECT ${DOC_COLUMNS} FROM scenario_documents
       WHERE scenario_id = $1 AND team = ANY($2)
       ORDER BY created_at DESC`,
      [scenarioId, visibleTeams]
    );
    return result.rows.map(rowToDocument);
  }

  /**
   * Find documents for a specific phase with team filtering
   */
  async findByScenarioAndPhase(
    scenarioId: string,
    phase: string,
    visibleTeams: string[]
  ): Promise<ScenarioDocument[]> {
    const result = await this.pool.query(
      `SELECT ${DOC_COLUMNS} FROM scenario_documents
       WHERE scenario_id = $1 AND exercise_phase = $2 AND team = ANY($3)
       ORDER BY created_at DESC`,
      [scenarioId, phase, visibleTeams]
    );
    return result.rows.map(rowToDocument);
  }

  /**
   * Find a single document by ID with team filtering
   */
  async findById(
    id: string,
    visibleTeams: string[]
  ): Promise<ScenarioDocument | null> {
    const result = await this.pool.query(
      `SELECT ${DOC_COLUMNS} FROM scenario_documents
       WHERE id = $1 AND team = ANY($2)`,
      [id, visibleTeams]
    );
    return result.rows[0] ? rowToDocument(result.rows[0]) : null;
  }

  /**
   * Update extracted data and confidence score for a document
   */
  async updateExtraction(
    id: string,
    extractedData: Record<string, unknown>,
    confidence: number
  ): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_documents
       SET extracted_data = $1, extraction_confidence = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(extractedData), confidence, id]
    );
  }

  /**
   * Update editable fields (team, phase, type) on a document
   */
  async updateTags(
    id: string,
    updates: { team?: string; exercisePhase?: string; documentType?: string }
  ): Promise<ScenarioDocument | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (updates.team) { sets.push(`team = $${idx++}`); vals.push(updates.team); }
    if (updates.exercisePhase) { sets.push(`exercise_phase = $${idx++}`); vals.push(updates.exercisePhase); }
    if (updates.documentType) { sets.push(`document_type = $${idx++}`); vals.push(updates.documentType); }

    if (sets.length === 0) return this.findById(id, ['blue', 'red', 'controller']);

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    await this.pool.query(
      `UPDATE scenario_documents SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    );

    const result = await this.pool.query(`SELECT ${DOC_COLUMNS} FROM scenario_documents WHERE id = $1`, [id]);
    return result.rows[0] ? rowToDocument(result.rows[0]) : null;
  }

  /**
   * Retrieve the stored original file buffer for a document.
   * Returns null if no file_data was stored (legacy uploads).
   */
  async getFileData(id: string): Promise<Buffer | null> {
    const result = await this.pool.query(
      'SELECT file_data FROM scenario_documents WHERE id = $1',
      [id]
    );
    return (result.rows[0]?.file_data as Buffer) ?? null;
  }

  /**
   * Update the text_content for a document (used after re-parsing from file_data).
   */
  async updateTextContent(id: string, textContent: string): Promise<void> {
    await this.pool.query(
      `UPDATE scenario_documents SET text_content = $1, updated_at = NOW() WHERE id = $2`,
      [textContent, id]
    );
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM scenario_documents WHERE id = $1', [id]);
  }

  /**
   * Count total documents for a scenario (across all teams)
   */
  async countByScenario(scenarioId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) AS count FROM scenario_documents WHERE scenario_id = $1',
      [scenarioId]
    );
    return parseInt(result.rows[0].count as string, 10);
  }
}

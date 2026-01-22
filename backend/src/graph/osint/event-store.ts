/**
 * OSINT Event Store
 *
 * Storage and retrieval for OSINT events and objective evidence linking.
 * Uses PostgreSQL with lazy initialization.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type { OSINTEvent, OSINTEventInput, ObjectiveEvidence, EventRelevance } from './types.js';

/**
 * Initialize OSINT tables
 */
export async function initOSINTTables(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS osint_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      source_name TEXT NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      location JSONB,
      actors TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      raw_content TEXT,
      workspace_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_osint_events_published ON osint_events(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_osint_events_workspace ON osint_events(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_osint_events_source_type ON osint_events(source_type);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS objective_evidence (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      event_id TEXT NOT NULL REFERENCES osint_events(id),
      relevance TEXT NOT NULL,
      relevance_score REAL NOT NULL,
      reasoning TEXT NOT NULL,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      linked_by TEXT NOT NULL,
      UNIQUE(objective_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_objective ON objective_evidence(objective_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_event ON objective_evidence(event_id);
  `);
}

/**
 * OSINT Event Store - manages OSINT events and evidence linking
 */
export class OSINTEventStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initOSINTTables();
      this.initialized = true;
    }
  }

  /**
   * Create a new OSINT event
   */
  async createEvent(input: OSINTEventInput): Promise<OSINTEvent> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `EVT-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO osint_events (
        id, title, description, source_type, source_url, source_name,
        published_at, ingested_at, location, actors, tags, raw_content,
        workspace_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      id,
      input.title,
      input.description,
      input.sourceType,
      input.sourceUrl || null,
      input.sourceName,
      input.publishedAt,
      now,
      input.location ? JSON.stringify(input.location) : null,
      input.actors,
      input.tags,
      input.rawContent || null,
      input.workspaceId || null,
      JSON.stringify(input.metadata),
    ]);

    return {
      id,
      ...input,
      ingestedAt: now,
    };
  }

  /**
   * Get event by ID
   */
  async getEvent(id: string): Promise<OSINTEvent | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM osint_events WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToEvent(result.rows[0]);
  }

  /**
   * List events with filters
   */
  async listEvents(options: {
    workspaceId?: string;
    sourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: OSINTEvent[]; total: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.workspaceId) {
      conditions.push(`workspace_id = $${idx++}`);
      params.push(options.workspaceId);
    }
    if (options.sourceType) {
      conditions.push(`source_type = $${idx++}`);
      params.push(options.sourceType);
    }
    if (options.startDate) {
      conditions.push(`published_at >= $${idx++}`);
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push(`published_at <= $${idx++}`);
      params.push(options.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM osint_events ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM osint_events ${where} ORDER BY published_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, options.limit || 50, options.offset || 0]
    );

    return {
      events: result.rows.map(row => this.rowToEvent(row)),
      total,
    };
  }

  /**
   * Link an event to an objective as evidence
   */
  async linkToObjective(
    eventId: string,
    objectiveId: string,
    relevance: EventRelevance,
    relevanceScore: number,
    reasoning: string,
    linkedBy: string
  ): Promise<ObjectiveEvidence> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `EVI-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    await pool.query(`
      INSERT INTO objective_evidence (id, objective_id, event_id, relevance, relevance_score, reasoning, linked_at, linked_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (objective_id, event_id) DO UPDATE SET
        relevance = $4, relevance_score = $5, reasoning = $6, linked_at = $7, linked_by = $8
    `, [id, objectiveId, eventId, relevance, relevanceScore, reasoning, now, linkedBy]);

    return { id, objectiveId, eventId, relevance, relevanceScore, reasoning, linkedAt: now, linkedBy };
  }

  /**
   * Get all evidence for an objective with event details
   */
  async getObjectiveEvidence(objectiveId: string): Promise<Array<ObjectiveEvidence & { event: OSINTEvent }>> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(`
      SELECT e.*, ev.id as evidence_id, ev.relevance, ev.relevance_score,
             ev.reasoning, ev.linked_at, ev.linked_by
      FROM objective_evidence ev
      JOIN osint_events e ON e.id = ev.event_id
      WHERE ev.objective_id = $1
      ORDER BY e.published_at DESC
    `, [objectiveId]);

    return result.rows.map(row => ({
      id: row.evidence_id,
      objectiveId,
      eventId: row.id,
      relevance: row.relevance,
      relevanceScore: row.relevance_score,
      reasoning: row.reasoning,
      linkedAt: new Date(row.linked_at),
      linkedBy: row.linked_by,
      event: this.rowToEvent(row),
    }));
  }

  /**
   * Delete an event and its evidence links
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    // Delete evidence links first (FK constraint)
    await pool.query('DELETE FROM objective_evidence WHERE event_id = $1', [eventId]);
    const result = await pool.query('DELETE FROM osint_events WHERE id = $1', [eventId]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Convert database row to OSINTEvent
   */
  private rowToEvent(row: Record<string, unknown>): OSINTEvent {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      sourceType: row.source_type as OSINTEvent['sourceType'],
      sourceUrl: row.source_url as string | undefined,
      sourceName: row.source_name as string,
      publishedAt: new Date(row.published_at as string),
      ingestedAt: new Date(row.ingested_at as string),
      location: row.location as OSINTEvent['location'],
      actors: row.actors as string[],
      tags: row.tags as string[],
      rawContent: row.raw_content as string | undefined,
      workspaceId: row.workspace_id as string | undefined,
      metadata: row.metadata as Record<string, unknown>,
    };
  }
}

// Singleton instance
export const osintEventStore = new OSINTEventStore();

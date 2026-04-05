/**
 * Concept Store
 *
 * Phase 66 Plan 01: Versioned concept CRUD with pgvector semantic search.
 *
 * Concepts are stored in ironclaw-postgres (pgvector/pgvector:pg16 image).
 * Access follows the getIronclawPool() pattern from routine-service.ts.
 *
 * Key behaviours:
 * - upsertConcept: never overwrites — creates a new version that supersedes the prior
 * - semanticSearch: cosine similarity search over concept embeddings
 * - retractByThread: marks concepts retracted when a thread is deleted
 * - getVersionChain: full evolution history of a concept_key
 */

import pg from 'pg';
import pgvector from 'pgvector/pg';
import OpenAI from 'openai';
import type { ConceptEntry, ConceptUpsertInput } from './concept-types.js';

export type { ConceptEntry, ConceptUpsertInput };

// ---------------------------------------------------------------------------
// Ironclaw DB pool (lazy-initialized, mirrors routine-service.ts pattern)
// ---------------------------------------------------------------------------

let ironclawPool: pg.Pool | null = null;

function getIronclawPool(): pg.Pool {
  if (!ironclawPool) {
    const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
    if (!url) {
      throw new Error(
        '[concept-store] DATABASE_URL_IRONCLAW not set — ' +
        'add DATABASE_URL_IRONCLAW to docker-compose environment.',
      );
    }
    ironclawPool = new pg.Pool({ connectionString: url, max: 3 });
  }
  return ironclawPool;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToConceptEntry(row: Record<string, unknown>): ConceptEntry {
  return {
    id: row.id as string,
    problemSetId: (row.problem_set_id as string) ?? null,
    userDid: row.user_did as string,
    conceptKey: row.concept_key as string,
    conceptType: row.concept_type as ConceptEntry['conceptType'],
    currentValue: (row.current_value as Record<string, unknown>),
    confidence: parseFloat(row.confidence as string),
    sourceThreadId: (row.source_thread_id as string) ?? null,
    version: row.version as number,
    supersedesId: (row.supersedes_id as string) ?? null,
    status: row.status as ConceptEntry['status'],
    embedding: null, // embeddings omitted from query results to save bandwidth
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    expiresAt: (row.expires_at as Date) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Embedding generation helper
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null;

/**
 * Generate a 1536-dim embedding for the given text using OpenAI's
 * text-embedding-3-small model (matches vector(1536) column).
 *
 * Returns null if OPENAI_API_KEY is not set (graceful degradation).
 */
export async function generateConceptEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[concept-store] OPENAI_API_KEY not set — skipping embedding generation');
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI(); // reads OPENAI_API_KEY from env
  }

  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// ---------------------------------------------------------------------------
// ConceptStore
// ---------------------------------------------------------------------------

export class ConceptStore {
  private pgvectorRegistered = false;

  /**
   * Register pgvector types with the pool so embeddings round-trip correctly.
   * Called once on first DB use.
   */
  async ensureReady(): Promise<void> {
    if (this.pgvectorRegistered) return;

    const pool = getIronclawPool();

    // Ensure vector extension and table exist (idempotent)
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE ironclaw_concept_type AS ENUM (
          'actor', 'situation', 'assessment', 'preference',
          'lesson', 'intent', 'relationship', 'directive'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_concepts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id  TEXT,
        user_did        TEXT NOT NULL,
        concept_key     TEXT NOT NULL,
        concept_type    ironclaw_concept_type NOT NULL,
        current_value   JSONB NOT NULL,
        confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.500,
        source_thread_id TEXT,
        version         INT NOT NULL DEFAULT 1,
        supersedes_id   UUID REFERENCES ironclaw_concepts(id),
        status          TEXT NOT NULL DEFAULT 'active',
        embedding       vector(1536),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ,
        UNIQUE (problem_set_id, user_did, concept_key, version)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_embedding
        ON ironclaw_concepts USING hnsw (embedding vector_cosine_ops)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_lookup
        ON ironclaw_concepts (user_did, problem_set_id, concept_key, status)
    `);

    // Register pgvector types on each new connection in the pool
    pool.on('connect', async (client) => {
      await pgvector.registerTypes(client);
    });

    this.pgvectorRegistered = true;
  }

  // ---------------------------------------------------------------------------
  // upsertConcept
  // ---------------------------------------------------------------------------

  /**
   * Create or version a concept.
   *
   * If an active concept with the same (user_did, concept_key, problem_set_id)
   * exists, it is marked 'superseded' and a new version is inserted pointing
   * back to it via supersedes_id. Version number is auto-incremented.
   *
   * If no existing concept, version 1 is created.
   */
  async upsertConcept(input: ConceptUpsertInput): Promise<ConceptEntry> {
    await this.ensureReady();
    const pool = getIronclawPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find existing active concept (latest version)
      const existingResult = await client.query(
        `SELECT id, version
         FROM ironclaw_concepts
         WHERE user_did = $1
           AND concept_key = $2
           AND (problem_set_id = $3 OR (problem_set_id IS NULL AND $3::TEXT IS NULL))
           AND status = 'active'
         ORDER BY version DESC
         LIMIT 1`,
        [input.userDid, input.conceptKey, input.problemSetId],
      );

      let newVersion = 1;
      let supersedesId: string | null = null;

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        newVersion = (existing.version as number) + 1;
        supersedesId = existing.id as string;

        // Mark prior version as superseded
        await client.query(
          `UPDATE ironclaw_concepts
           SET status = 'superseded', updated_at = NOW()
           WHERE id = $1`,
          [supersedesId],
        );
      }

      // Insert new version
      const embeddingParam = input.embedding != null
        ? pgvector.toSql(input.embedding)
        : null;

      const insertResult = await client.query(
        `INSERT INTO ironclaw_concepts
           (problem_set_id, user_did, concept_key, concept_type,
            current_value, confidence, source_thread_id,
            version, supersedes_id, status, embedding)
         VALUES ($1, $2, $3, $4::ironclaw_concept_type,
                 $5::jsonb, $6, $7,
                 $8, $9, 'active', $10::vector)
         RETURNING *`,
        [
          input.problemSetId,
          input.userDid,
          input.conceptKey,
          input.conceptType,
          JSON.stringify(input.value),
          input.confidence,
          input.sourceThreadId,
          newVersion,
          supersedesId,
          embeddingParam,
        ],
      );

      await client.query('COMMIT');
      return rowToConceptEntry(insertResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // getActive
  // ---------------------------------------------------------------------------

  /**
   * Return all active concepts for a user + problem set combination.
   * Pass problemSetId = null for global concepts.
   */
  async getActive(userDid: string, problemSetId: string | null): Promise<ConceptEntry[]> {
    await this.ensureReady();
    const pool = getIronclawPool();

    const result = await pool.query(
      `SELECT id, problem_set_id, user_did, concept_key, concept_type,
              current_value, confidence, source_thread_id,
              version, supersedes_id, status, created_at, updated_at, expires_at
       FROM ironclaw_concepts
       WHERE user_did = $1
         AND (problem_set_id = $2 OR (problem_set_id IS NULL AND $2::TEXT IS NULL))
         AND status = 'active'
       ORDER BY concept_key ASC, version DESC`,
      [userDid, problemSetId],
    );

    return result.rows.map(rowToConceptEntry);
  }

  // ---------------------------------------------------------------------------
  // getByKey
  // ---------------------------------------------------------------------------

  /**
   * Get the latest active version of a concept by its canonical key.
   */
  async getByKey(
    userDid: string,
    conceptKey: string,
    problemSetId: string | null,
  ): Promise<ConceptEntry | null> {
    await this.ensureReady();
    const pool = getIronclawPool();

    const result = await pool.query(
      `SELECT id, problem_set_id, user_did, concept_key, concept_type,
              current_value, confidence, source_thread_id,
              version, supersedes_id, status, created_at, updated_at, expires_at
       FROM ironclaw_concepts
       WHERE user_did = $1
         AND concept_key = $2
         AND (problem_set_id = $3 OR (problem_set_id IS NULL AND $3::TEXT IS NULL))
         AND status = 'active'
       ORDER BY version DESC
       LIMIT 1`,
      [userDid, conceptKey, problemSetId],
    );

    if (result.rows.length === 0) return null;
    return rowToConceptEntry(result.rows[0]);
  }

  // ---------------------------------------------------------------------------
  // getVersionChain
  // ---------------------------------------------------------------------------

  /**
   * Return all versions of a concept ordered by version ASC.
   * Uses a recursive CTE walking the supersedes_id FK chain.
   */
  async getVersionChain(
    userDid: string,
    conceptKey: string,
    problemSetId: string | null,
  ): Promise<ConceptEntry[]> {
    await this.ensureReady();
    const pool = getIronclawPool();

    // Find the root (v1) entry, then walk forward via supersedes_id chain
    // Simpler: just query all versions by (user_did, concept_key, problem_set_id)
    // ordered by version ASC — no need for CTE given the unique constraint
    const result = await pool.query(
      `SELECT id, problem_set_id, user_did, concept_key, concept_type,
              current_value, confidence, source_thread_id,
              version, supersedes_id, status, created_at, updated_at, expires_at
       FROM ironclaw_concepts
       WHERE user_did = $1
         AND concept_key = $2
         AND (problem_set_id = $3 OR (problem_set_id IS NULL AND $3::TEXT IS NULL))
       ORDER BY version ASC`,
      [userDid, conceptKey, problemSetId],
    );

    return result.rows.map(rowToConceptEntry);
  }

  // ---------------------------------------------------------------------------
  // semanticSearch
  // ---------------------------------------------------------------------------

  /**
   * Find concepts semantically similar to the given embedding vector.
   *
   * Searches active concepts for the user, including both problem-set-specific
   * and global concepts (problem_set_id IS NULL).
   *
   * Returns top-K results with similarity score (0–1, higher = more similar).
   */
  async semanticSearch(
    embedding: number[],
    userDid: string,
    problemSetId: string | null,
    limit = 5,
  ): Promise<(ConceptEntry & { similarity: number })[]> {
    await this.ensureReady();
    const pool = getIronclawPool();

    const embeddingParam = pgvector.toSql(embedding);

    const result = await pool.query(
      `SELECT id, problem_set_id, user_did, concept_key, concept_type,
              current_value, confidence, source_thread_id,
              version, supersedes_id, status, created_at, updated_at, expires_at,
              1 - (embedding <=> $1::vector) AS similarity
       FROM ironclaw_concepts
       WHERE user_did = $2
         AND (problem_set_id = $3 OR problem_set_id IS NULL)
         AND status = 'active'
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [embeddingParam, userDid, problemSetId, limit],
    );

    return result.rows.map((row) => ({
      ...rowToConceptEntry(row),
      similarity: parseFloat(row.similarity as string),
    }));
  }

  // ---------------------------------------------------------------------------
  // retractByThread
  // ---------------------------------------------------------------------------

  /**
   * Mark all concepts sourced from the given thread as 'retracted'.
   *
   * If a retracted concept is the latest version and has a prior superseded
   * version, the predecessor is re-activated.
   *
   * Returns the count of retracted concepts.
   */
  async retractByThread(threadId: string): Promise<number> {
    await this.ensureReady();
    const pool = getIronclawPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find all active concepts sourced from this thread
      const toRetract = await client.query(
        `SELECT id, supersedes_id, user_did, concept_key, problem_set_id
         FROM ironclaw_concepts
         WHERE source_thread_id = $1
           AND status = 'active'`,
        [threadId],
      );

      let count = 0;

      for (const row of toRetract.rows) {
        // Retract this concept
        await client.query(
          `UPDATE ironclaw_concepts
           SET status = 'retracted', updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        );
        count++;

        // Re-activate predecessor if it exists and was superseded
        if (row.supersedes_id) {
          await client.query(
            `UPDATE ironclaw_concepts
             SET status = 'active', updated_at = NOW()
             WHERE id = $1
               AND status = 'superseded'`,
            [row.supersedes_id],
          );
        }
      }

      await client.query('COMMIT');
      return count;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // retractById
  // ---------------------------------------------------------------------------

  /**
   * Mark a single concept as 'retracted' by its UUID.
   * Does not cascade — predecessors are not re-activated (use retractByThread for that).
   */
  async retractById(id: string): Promise<void> {
    await this.ensureReady();
    const pool = getIronclawPool();

    await pool.query(
      `UPDATE ironclaw_concepts
       SET status = 'retracted', updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  // ---------------------------------------------------------------------------
  // getConsolidationCandidates
  // ---------------------------------------------------------------------------

  /**
   * Find concept_keys that have 2+ active versions sourced from different threads.
   * These are candidates for LLM-based cross-thread consolidation (Plan 66-04).
   */
  async getConsolidationCandidates(
    problemSetId: string | null,
  ): Promise<{ conceptKey: string; userDid: string; versions: number }[]> {
    await this.ensureReady();
    const pool = getIronclawPool();

    const result = await pool.query(
      `SELECT concept_key, user_did, COUNT(*) AS versions
       FROM ironclaw_concepts
       WHERE (problem_set_id = $1 OR (problem_set_id IS NULL AND $1::TEXT IS NULL))
         AND status = 'active'
         AND source_thread_id IS NOT NULL
         AND source_thread_id != 'consolidation'
       GROUP BY concept_key, user_did
       HAVING COUNT(DISTINCT source_thread_id) >= 2`,
      [problemSetId],
    );

    return result.rows.map((row) => ({
      conceptKey: row.concept_key as string,
      userDid: row.user_did as string,
      versions: parseInt(row.versions as string, 10),
    }));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const conceptStore = new ConceptStore();

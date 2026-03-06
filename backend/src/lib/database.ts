import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';

// Lazy-initialized connection pool (created after dotenv.config runs)
let pool: Pool;

// Shared PgBoss singleton to avoid duplicate type creation on startup
let bossInstance: PgBoss | null = null;
let bossStartPromise: Promise<PgBoss> | null = null;

export async function getSharedBoss(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;
  if (bossStartPromise) return bossStartPromise;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required for pg-boss');

  bossStartPromise = (async () => {
    const boss = new PgBoss(dbUrl);
    boss.on('error', (error) => {
      console.error('[pg-boss] error:', error.message);
    });
    await boss.start();
    bossInstance = boss;
    return boss;
  })();

  return bossStartPromise;
}

export async function stopSharedBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
    bossInstance = null;
    bossStartPromise = null;
  }
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export interface DocumentInput {
  encrypted_cid: string;
  encrypted_classification: string;
  encrypted_metadata: object;
  owner_account_id: string;
  file_size_bytes?: number;
  mime_type?: string;
  encryption_nonce?: string;
}

/**
 * Dual-write: Insert document into PostgreSQL + queue for blockchain
 * Uses transactional outbox pattern for reliability
 */
export async function dualWriteDocument(doc: DocumentInput): Promise<string> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Insert into documents table
    const docResult = await client.query(`
      INSERT INTO documents (
        encrypted_cid, encrypted_classification, encrypted_metadata,
        owner_account_id, file_size_bytes, mime_type, encryption_nonce
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING document_id
    `, [
      doc.encrypted_cid,
      doc.encrypted_classification,
      JSON.stringify(doc.encrypted_metadata),
      doc.owner_account_id,
      doc.file_size_bytes,
      doc.mime_type,
      doc.encryption_nonce
    ]);

    const documentId = docResult.rows[0].document_id;

    // Insert into outbox for blockchain sync
    await client.query(`
      INSERT INTO outbox (
        aggregate_type, aggregate_id, event_type, payload
      ) VALUES ($1, $2, $3, $4)
    `, [
      'document',
      documentId,
      'document_registered',
      JSON.stringify({
        document_id: documentId,
        encrypted_cid: doc.encrypted_cid,
        encrypted_classification: doc.encrypted_classification,
        encrypted_metadata: doc.encrypted_metadata,
        owner_account_id: doc.owner_account_id
      })
    ]);

    await client.query('COMMIT');
    return documentId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Get document by ID (fast PostgreSQL query)
 */
export async function getDocument(documentId: string) {
  const result = await getPool().query(`
    SELECT * FROM documents WHERE document_id = $1
  `, [documentId]);
  return result.rows[0];
}

/**
 * List user's documents (paginated)
 */
export async function listUserDocuments(
  ownerAccountId: string,
  limit: number = 20,
  offset: number = 0
) {
  const result = await getPool().query(`
    SELECT * FROM documents
    WHERE owner_account_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [ownerAccountId, limit, offset]);
  return result.rows;
}

export { getPool };

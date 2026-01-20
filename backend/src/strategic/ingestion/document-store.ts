/**
 * Strategic Document Store
 * PostgreSQL storage for strategic planning documents
 */

import { getPool } from '../../lib/database.js';
import { randomUUID } from 'crypto';
import type {
  StrategicDocument,
  CreateStrategicDocumentInput,
  StrategicDocumentLevel,
  ClassificationLevel,
} from './types.js';

/**
 * Initialize strategic_documents table if not exists
 */
export async function initStrategicDocumentsTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS strategic_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'OTHER',
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      page_count INTEGER,
      text_content TEXT NOT NULL,
      text_length INTEGER NOT NULL,
      classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
      ipfs_cid TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_strategic_documents_created_by
    ON strategic_documents(created_by)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_strategic_documents_level
    ON strategic_documents(level)
  `);

  console.log('✓ strategic_documents table initialized');
}

/**
 * Store a new strategic document
 * @param input - Document input
 * @returns Created document ID
 */
export async function storeDocument(
  input: CreateStrategicDocumentInput
): Promise<string> {
  const pool = getPool();
  const id = randomUUID();

  await pool.query(
    `
    INSERT INTO strategic_documents (
      id, title, level, original_filename, mime_type,
      page_count, text_content, text_length, classification,
      ipfs_cid, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      id,
      input.title,
      input.level,
      input.originalFilename,
      input.mimeType,
      input.pageCount || null,
      input.textContent,
      input.textContent.length,
      input.classification || 'UNCLASSIFIED',
      input.ipfsCid || null,
      input.createdBy,
    ]
  );

  return id;
}

/**
 * Get a document by ID
 * @param documentId - Document ID
 * @returns Document or null if not found
 */
export async function getDocumentById(
  documentId: string
): Promise<StrategicDocument | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM strategic_documents WHERE id = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToDocument(result.rows[0]);
}

/**
 * Get document text content by ID (for LLM extraction)
 * @param documentId - Document ID
 * @returns Text content or null if not found
 */
export async function getDocumentText(
  documentId: string
): Promise<string | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT text_content FROM strategic_documents WHERE id = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].text_content;
}

/**
 * Document summary with objective count
 */
export interface DocumentWithObjectiveCount extends Omit<StrategicDocument, 'textContent'> {
  objectiveCount: number;
}

/**
 * List documents for a user with objective counts
 * @param createdBy - User DID
 * @param limit - Max results
 * @param offset - Offset for pagination
 * @returns Array of documents with objective counts
 */
export async function listDocuments(
  createdBy: string,
  limit: number = 20,
  offset: number = 0
): Promise<DocumentWithObjectiveCount[]> {
  const pool = getPool();

  const result = await pool.query(
    `
    SELECT d.id, d.title, d.level, d.original_filename, d.mime_type,
           d.page_count, d.text_length, d.classification, d.ipfs_cid,
           d.created_by, d.created_at,
           COALESCE(COUNT(o.id), 0)::int as objective_count
    FROM strategic_documents d
    LEFT JOIN strategic_objectives o ON o.document_id = d.id
    WHERE d.created_by = $1
    GROUP BY d.id, d.title, d.level, d.original_filename, d.mime_type,
             d.page_count, d.text_length, d.classification, d.ipfs_cid,
             d.created_by, d.created_at
    ORDER BY d.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [createdBy, limit, offset]
  );

  return result.rows.map(mapRowToDocumentWithCount);
}

/**
 * List all documents (admin view)
 * @param limit - Max results
 * @param offset - Offset for pagination
 * @returns Array of documents (without text_content)
 */
export async function listAllDocuments(
  limit: number = 50,
  offset: number = 0
): Promise<Omit<StrategicDocument, 'textContent'>[]> {
  const pool = getPool();

  const result = await pool.query(
    `
    SELECT id, title, level, original_filename, mime_type,
           page_count, text_length, classification, ipfs_cid,
           created_by, created_at
    FROM strategic_documents
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows.map(mapRowToDocumentSummary);
}

/**
 * Delete a document
 * @param documentId - Document ID
 * @returns true if deleted
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM strategic_documents WHERE id = $1`,
    [documentId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Map database row to StrategicDocument
 */
function mapRowToDocument(row: Record<string, unknown>): StrategicDocument {
  return {
    id: row.id as string,
    title: row.title as string,
    level: row.level as StrategicDocumentLevel,
    originalFilename: row.original_filename as string,
    mimeType: row.mime_type as string,
    pageCount: row.page_count as number | undefined,
    textContent: row.text_content as string,
    textLength: row.text_length as number,
    classification: row.classification as ClassificationLevel,
    ipfsCid: row.ipfs_cid as string | undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Map database row to document summary (without text content)
 */
function mapRowToDocumentSummary(
  row: Record<string, unknown>
): Omit<StrategicDocument, 'textContent'> {
  return {
    id: row.id as string,
    title: row.title as string,
    level: row.level as StrategicDocumentLevel,
    originalFilename: row.original_filename as string,
    mimeType: row.mime_type as string,
    pageCount: row.page_count as number | undefined,
    textLength: row.text_length as number,
    classification: row.classification as ClassificationLevel,
    ipfsCid: row.ipfs_cid as string | undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Map database row to document with objective count
 */
function mapRowToDocumentWithCount(
  row: Record<string, unknown>
): DocumentWithObjectiveCount {
  return {
    id: row.id as string,
    title: row.title as string,
    level: row.level as StrategicDocumentLevel,
    originalFilename: row.original_filename as string,
    mimeType: row.mime_type as string,
    pageCount: row.page_count as number | undefined,
    textLength: row.text_length as number,
    classification: row.classification as ClassificationLevel,
    ipfsCid: row.ipfs_cid as string | undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    objectiveCount: row.objective_count as number,
  };
}

/**
 * DocumentStore class for encapsulated access
 */
export class DocumentStore {
  async init(): Promise<void> {
    await initStrategicDocumentsTable();
  }

  async store(input: CreateStrategicDocumentInput): Promise<string> {
    return storeDocument(input);
  }

  async get(documentId: string): Promise<StrategicDocument | null> {
    return getDocumentById(documentId);
  }

  async getText(documentId: string): Promise<string | null> {
    return getDocumentText(documentId);
  }

  async list(
    createdBy: string,
    limit?: number,
    offset?: number
  ): Promise<Omit<StrategicDocument, 'textContent'>[]> {
    return listDocuments(createdBy, limit, offset);
  }

  async listAll(
    limit?: number,
    offset?: number
  ): Promise<Omit<StrategicDocument, 'textContent'>[]> {
    return listAllDocuments(limit, offset);
  }

  async delete(documentId: string): Promise<boolean> {
    return deleteDocument(documentId);
  }
}

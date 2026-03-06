import * as Y from 'yjs';
import { getPool } from '../lib/database.js';
import { YjsDocument, DocumentMetadata } from './types.js';

class YjsDocumentProvider {
  private documents: Map<string, YjsDocument> = new Map();
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Create yjs_documents table
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS yjs_documents (
        document_id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES operational_plans(id) ON DELETE CASCADE,
        state BYTEA NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_modified TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_yjs_documents_plan_id ON yjs_documents(plan_id);
    `);

    this.initialized = true;
  }

  /**
   * Get or create a Yjs document for a plan
   */
  async getDocument(planId: string, documentId?: string): Promise<YjsDocument> {
    await this.ensureInitialized();

    const docId = documentId || `doc-${planId}`;

    // Check memory cache first
    if (this.documents.has(docId)) {
      return this.documents.get(docId)!;
    }

    // Try to load from database
    const result = await getPool().query(
      'SELECT * FROM yjs_documents WHERE document_id = $1',
      [docId]
    );

    const doc = new Y.Doc();
    let metadata: DocumentMetadata;

    if (result.rows.length > 0) {
      // Restore from database
      const row = result.rows[0];
      Y.applyUpdate(doc, row.state);
      metadata = {
        documentId: docId,
        planId: row.plan_id,
        createdAt: row.created_at,
        lastModified: row.last_modified
      };
    } else {
      // Create new document with plan structure
      this.initializePlanStructure(doc);
      metadata = {
        documentId: docId,
        planId,
        createdAt: new Date(),
        lastModified: new Date()
      };

      // Persist initial state
      await this.persistDocument(docId, planId, doc);
    }

    const yjsDoc: YjsDocument = {
      doc,
      metadata,
      connectedUsers: new Map()
    };

    // Set up persistence on changes
    doc.on('update', async (_update: Uint8Array) => {
      await this.persistUpdate(docId, planId, doc);
    });

    this.documents.set(docId, yjsDoc);
    return yjsDoc;
  }

  /**
   * Initialize a new plan document with required Yjs types
   */
  private initializePlanStructure(doc: Y.Doc): void {
    // Text fields for rich editing
    doc.getText('situationText');
    doc.getText('missionText');
    doc.getText('executionText');
    doc.getText('sustainmentText');
    doc.getText('commandSignalText');

    // Structured data
    doc.getArray('coas');
    doc.getArray('tasks');
    doc.getArray('risks');
    doc.getMap('annexes');
    doc.getMap('comments');
  }

  /**
   * Persist document state to PostgreSQL
   */
  private async persistDocument(documentId: string, planId: string, doc: Y.Doc): Promise<void> {
    const state = Y.encodeStateAsUpdate(doc);

    await getPool().query(`
      INSERT INTO yjs_documents (document_id, plan_id, state, created_at, last_modified)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (document_id) DO UPDATE SET
        state = EXCLUDED.state,
        last_modified = NOW()
    `, [documentId, planId, Buffer.from(state)]);
  }

  /**
   * Persist incremental update (debounced in practice)
   */
  private persistUpdate = this.debounce(async (documentId: string, planId: string, doc: Y.Doc) => {
    await this.persistDocument(documentId, planId, doc);
  }, 1000);

  /**
   * Create a version snapshot
   */
  async createSnapshot(documentId: string, version: number, _changedBy: string, _reason?: string): Promise<void> {
    const yjsDoc = this.documents.get(documentId);
    if (!yjsDoc) return;

    const _state = Y.encodeStateAsUpdate(yjsDoc.doc);

    // Use versionStore from planning module (will be imported in actual implementation)
    // For now, just log the intent
    console.log(`Creating snapshot v${version} for ${documentId}`);
  }

  /**
   * Cleanup document from memory (for disconnection)
   */
  async releaseDocument(documentId: string): Promise<void> {
    const yjsDoc = this.documents.get(documentId);
    if (!yjsDoc) return;

    // Final persist before release
    await this.persistDocument(
      documentId,
      yjsDoc.metadata.planId,
      yjsDoc.doc
    );

    yjsDoc.doc.destroy();
    this.documents.delete(documentId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    let timeout: NodeJS.Timeout | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...args: any[]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    }) as T;
  }
}

export const yjsProvider = new YjsDocumentProvider();

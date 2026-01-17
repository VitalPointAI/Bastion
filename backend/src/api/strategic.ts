/**
 * Strategic Planning API
 * Document ingestion and strategic planning endpoints
 */

import express from 'express';
import multer from 'multer';
import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import {
  DocumentStore,
  initStrategicDocumentsTable,
} from '../strategic/ingestion/document-store.js';
import { uploadToIPFS } from '../lib/ipfs.js';
import { encryptData, generateEncryptionKey } from '../lib/encryption.js';
import type {
  StrategicDocumentLevel,
  ClassificationLevel,
  DocumentUploadResponse,
} from '../strategic/ingestion/types.js';

const router = express.Router();

// Initialize document parser and store
const parser = new DocumentParser();
const store = new DocumentStore();

// Initialize table on first request (lazy init)
let tableInitialized = false;
async function ensureTableExists(): Promise<void> {
  if (!tableInitialized) {
    await initStrategicDocumentsTable();
    tableInitialized = true;
  }
}

// Configure multer for file uploads
// 50MB limit, only accept PDF and Office documents
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, DOC, PPTX, PPT`
        )
      );
    }
  },
});

/**
 * Extract user DID from request headers
 * Supports: Authorization Bearer, X-DID header, query param
 */
function getUserDID(req: express.Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-DID header
  const xDid = req.headers['x-did'];
  if (typeof xDid === 'string') {
    return xDid;
  }

  // Check query param
  const queryDid = req.query.did;
  if (typeof queryDid === 'string') {
    return queryDid;
  }

  return null;
}

/**
 * POST /api/strategic/documents - Upload a strategic document
 *
 * Body (multipart/form-data):
 * - document: File (PDF, DOCX, DOC, PPTX, PPT)
 * - title: string
 * - level: StrategicDocumentLevel (optional, default: 'OTHER')
 * - classification: ClassificationLevel (optional, default: 'UNCLASSIFIED')
 * - backupToIPFS: boolean (optional, default: false)
 */
router.post('/documents', upload.single('document'), async (req, res) => {
  try {
    await ensureTableExists();

    // Get user DID
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required. Provide DID via Authorization Bearer, X-DID header, or did query param',
      });
    }

    // Get uploaded file
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    // Parse request body
    const {
      title = file.originalname,
      level = 'OTHER',
      classification = 'UNCLASSIFIED',
      backupToIPFS = false,
    } = req.body;

    // Validate level
    const validLevels: StrategicDocumentLevel[] = [
      'NSS',
      'NDS',
      'NMS',
      'GEF',
      'JSCP',
      'CAMPAIGN_PLAN',
      'OTHER',
    ];
    if (!validLevels.includes(level as StrategicDocumentLevel)) {
      return res.status(400).json({
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    // Validate classification
    const validClassifications: ClassificationLevel[] = [
      'UNCLASSIFIED',
      'CONFIDENTIAL',
      'SECRET',
      'TOP_SECRET',
    ];
    if (!validClassifications.includes(classification as ClassificationLevel)) {
      return res.status(400).json({
        error: `Invalid classification. Must be one of: ${validClassifications.join(', ')}`,
      });
    }

    console.log(
      `Processing document upload: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`
    );

    // Parse document
    const content = await parser.parse(file.buffer, file.mimetype);

    console.log(
      `Parsed document: ${content.pageCount || 'N/A'} pages, ${content.text.length} chars`
    );

    // Optional: Backup encrypted file to IPFS
    let ipfsCid: string | undefined;
    if (backupToIPFS === 'true' || backupToIPFS === true) {
      try {
        // Encrypt the original file
        const encryptionKey = await generateEncryptionKey();
        const { encrypted } = await encryptData(file.buffer, encryptionKey);

        // Upload encrypted file to IPFS
        const encryptedBuffer = Buffer.from(encrypted, 'base64');
        const { cid } = await uploadToIPFS(
          encryptedBuffer,
          `${file.originalname}.encrypted`
        );
        ipfsCid = cid;

        console.log(`Backed up to IPFS: ${cid}`);
      } catch (ipfsError) {
        // Log but don't fail the upload
        console.error('IPFS backup failed (non-fatal):', ipfsError);
      }
    }

    // Store in PostgreSQL
    const documentId = await store.store({
      title: title as string,
      level: level as StrategicDocumentLevel,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      pageCount: content.pageCount,
      textContent: content.text,
      classification: classification as ClassificationLevel,
      ipfsCid,
      createdBy: userDID,
    });

    console.log(`✓ Strategic document stored: ${documentId}`);

    const response: DocumentUploadResponse = {
      documentId,
      title: title as string,
      pageCount: content.pageCount,
      textLength: content.text.length,
    };

    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Document upload failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents - List user's strategic documents
 *
 * Query params:
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 */
router.get('/documents', async (req, res) => {
  try {
    await ensureTableExists();

    // Get user DID
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const documents = await store.list(userDID, limit, offset);

    res.json({
      documents,
      count: documents.length,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('List documents failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:id - Get document by ID
 */
router.get('/documents/:id', async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check ownership (or admin role in future)
    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return document without full text content (use /text endpoint for that)
    const { textContent, ...metadata } = document;

    res.json({
      ...metadata,
      hasText: textContent.length > 0,
      textPreview: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/strategic/documents/:id/text - Get document text content
 *
 * Query params:
 * - chunk: number (optional) - return specific chunk index
 * - chunkSize: number (optional, default: 8000) - chunk size for splitting
 */
router.get('/documents/:id/text', async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    // First verify ownership
    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get text content
    const text = await store.getText(documentId);

    if (text === null) {
      return res.status(404).json({ error: 'Document text not found' });
    }

    // Check if chunking is requested
    const chunkIndex = req.query.chunk !== undefined
      ? parseInt(req.query.chunk as string)
      : undefined;
    const chunkSize = parseInt(req.query.chunkSize as string) || 8000;

    if (chunkIndex !== undefined) {
      // Return specific chunk
      const chunks = parser.chunkDocument(text, chunkSize);

      if (chunkIndex < 0 || chunkIndex >= chunks.length) {
        return res.status(400).json({
          error: `Invalid chunk index. Document has ${chunks.length} chunks (0-${chunks.length - 1})`,
        });
      }

      res.json({
        documentId,
        chunkIndex,
        totalChunks: chunks.length,
        chunkSize,
        text: chunks[chunkIndex],
      });
    } else {
      // Return full text with chunk metadata
      const chunks = parser.chunkDocument(text, chunkSize);

      res.json({
        documentId,
        totalChunks: chunks.length,
        textLength: text.length,
        text,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get document text failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/strategic/documents/:id - Delete a document
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    await ensureTableExists();

    const documentId = req.params.id as string;

    // Get user DID
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    // Verify ownership
    const document = await store.get(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy !== userDID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await store.delete(documentId);

    res.json({ deleted: true, documentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete document failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;

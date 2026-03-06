import express from 'express';
import multer from 'multer';
import { encryptData, generateEncryptionKey } from '../lib/encryption.js';
import { uploadToIPFS } from '../lib/ipfs.js';
import { dualWriteDocument, getDocument, listUserDocuments } from '../lib/database.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * POST /api/documents/upload - Upload document to IPFS and register in PostgreSQL + blockchain
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { owner_account_id, classification, metadata } = req.body;

    if (!file || !owner_account_id) {
      return res.status(400).json({ error: 'File and owner_account_id required' });
    }

    // TODO: Verify authentication (owner_account_id matches authenticated user)

    // Step 1: Encrypt file
    const fileKey = await generateEncryptionKey();
    const { encrypted: encryptedFile, nonce: fileNonce } = await encryptData(file.buffer, fileKey);

    // Step 2: Upload encrypted file to IPFS
    const encryptedBuffer = Buffer.from(encryptedFile, 'base64');
    const { cid, size } = await uploadToIPFS(encryptedBuffer, `${file.originalname}.encrypted`);

    // Step 3: Encrypt CID for on-chain storage
    const cidKey = await generateEncryptionKey();
    const { encrypted: encryptedCid, nonce: cidNonce } = await encryptData(cid, cidKey);

    // Step 4: Encrypt classification
    const classKey = await generateEncryptionKey();
    const { encrypted: encryptedClassification, nonce: classNonce } = await encryptData(
      classification || 'UNCLASS',
      classKey
    );

    // Step 5: Encrypt metadata
    const metaKey = await generateEncryptionKey();
    const metadataStr = metadata ? JSON.stringify(metadata) : '{}';
    const { encrypted: encryptedMetadata, nonce: metaNonce } = await encryptData(metadataStr, metaKey);

    // Step 6: Dual-write to PostgreSQL + outbox (for blockchain sync)
    const documentId = await dualWriteDocument({
      encrypted_cid: encryptedCid,
      encrypted_classification: encryptedClassification,
      encrypted_metadata: { encrypted: encryptedMetadata }, // Store encrypted string in JSONB wrapper
      owner_account_id,
      file_size_bytes: size,
      mime_type: file.mimetype,
      encryption_nonce: `${fileNonce}|${cidNonce}|${classNonce}|${metaNonce}` // Combined nonces
    });

    console.log(`✓ Document registered: ${documentId}, IPFS CID: ${cid}`);

    res.json({
      document_id: documentId,
      ipfs_cid: cid, // Return plaintext CID for now (client needs it to fetch)
      size,
      mime_type: file.mimetype,
      // Keys for decryption (in production, these would be managed via TEE/key service)
      encryption_keys: {
        file_key: fileKey,
        cid_key: cidKey,
        classification_key: classKey,
        metadata_key: metaKey
      },
      nonces: {
        file_nonce: fileNonce,
        cid_nonce: cidNonce,
        classification_nonce: classNonce,
        metadata_nonce: metaNonce
      },
      message: 'Document uploaded, encrypted, and registered for blockchain sync'
    });
  } catch (error: unknown) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Upload failed' });
  }
});

/**
 * GET /api/documents/:documentId - Get document metadata
 */
router.get('/:documentId', async (req, res) => {
  try {
    const doc = await getDocument(req.params.documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // TODO: Verify user has access to this document

    res.json(doc);
  } catch (error: unknown) {
    console.error('Get document failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Get document failed' });
  }
});

/**
 * GET /api/documents - List user's documents
 */
router.get('/', async (req, res) => {
  const { owner_account_id, limit, offset } = req.query;

  if (!owner_account_id) {
    return res.status(400).json({ error: 'owner_account_id required' });
  }

  // TODO: Verify authentication

  try {
    const docs = await listUserDocuments(
      owner_account_id as string,
      parseInt(limit as string) || 20,
      parseInt(offset as string) || 0
    );
    res.json({ documents: docs, count: docs.length });
  } catch (error: unknown) {
    console.error('List documents failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'List documents failed' });
  }
});

export default router;

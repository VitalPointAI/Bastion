import express from 'express';
import multer from 'multer';
import { encryptData, generateEncryptionKey } from '../lib/encryption.js';
import { uploadToIPFS } from '../lib/ipfs.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { owner_account_id } = req.body;

    if (!file || !owner_account_id) {
      return res.status(400).json({ error: 'File and owner_account_id required' });
    }

    // TODO: Verify authentication

    // Step 1: Encrypt file
    const key = await generateEncryptionKey();
    const { encrypted, nonce } = await encryptData(file.buffer, key);

    // Step 2: Upload encrypted data to IPFS
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const { cid, size } = await uploadToIPFS(encryptedBuffer, `${file.originalname}.encrypted`);

    // Step 3: Store metadata (will integrate with PostgreSQL in next task)
    console.log(`Document uploaded: ${cid}, size: ${size}`);

    res.json({
      cid,
      size,
      encrypted_key: key,
      nonce,
      message: 'Document uploaded and encrypted'
    });
  } catch (error: any) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

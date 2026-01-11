import express from 'express';
import { encryptData, decryptData, generateEncryptionKey } from '../lib/encryption.js';

const router = express.Router();

router.post('/encrypt', async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Data required' });

  try {
    const key = await generateEncryptionKey();
    const result = await encryptData(data, key);
    res.json({ ...result, key });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/decrypt', async (req, res) => {
  const { encrypted, key, nonce } = req.body;
  if (!encrypted || !key || !nonce) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const decrypted = await decryptData(encrypted, key, nonce);
    res.json({ data: decrypted.toString('utf-8') });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

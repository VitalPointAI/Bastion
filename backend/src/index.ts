import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import encryptionRouter from './api/encryption.js';
import documentsRouter from './api/documents.js';
import { startSyncWorkers } from './lib/blockchain-sync.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/encryption', encryptionRouter);
app.use('/api/documents', documentsRouter);

app.listen(port, async () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Start blockchain sync workers
  try {
    await startSyncWorkers();
  } catch (error) {
    console.error('Failed to start sync workers:', error);
  }
});

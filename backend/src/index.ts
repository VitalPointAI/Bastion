import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import encryptionRouter from './api/encryption';
import documentsRouter from './api/documents';
import edgeSyncRouter from './api/edge-sync';
import accountsRouter from './api/accounts';
import identityRouter from './api/identity';
import credentialsRouter from './api/credentials';
import { startSyncWorkers } from './lib/blockchain-sync';

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
app.use('/api/edge', edgeSyncRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/identity', identityRouter);
app.use('/api/credentials', credentialsRouter);

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

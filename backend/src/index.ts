import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import encryptionRouter from './api/encryption.js';
import documentsRouter from './api/documents.js';
import edgeSyncRouter from './api/edge-sync.js';
import accountsRouter from './api/accounts.js';
import identityRouter from './api/identity.js';
import credentialsRouter from './api/credentials.js';
import daoRouter from './api/dao.js';
import agentRouter from './api/agents.js';
import strategicRouter from './api/strategic.js';
import strategicAgentsRouter from './api/strategic-agents.js';
import adminRouter from './api/admin.js';
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
app.use('/api/edge', edgeSyncRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/identity', identityRouter);
console.log('Mounting credentials router:', typeof credentialsRouter, credentialsRouter?.stack?.length || 0, 'routes');
app.use('/api/credentials', credentialsRouter);
app.use('/api/dao', daoRouter);
app.use('/api/agents', agentRouter);
app.use('/api/strategic', strategicRouter);
app.use('/api/strategic/agents', strategicAgentsRouter);
app.use('/api/admin', adminRouter);

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

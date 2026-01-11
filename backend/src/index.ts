import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import encryptionRouter from './api/encryption.js';
import documentsRouter from './api/documents.js';

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

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

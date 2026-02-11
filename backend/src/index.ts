import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRouter from './api/auth.js';
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
import strategicToolsRouter from './api/strategic-tools.js';
import adminRouter from './api/admin.js';
import messagingRouter, { setupMessageWebSocket } from './api/messaging.js';
import orchestrationRouter, { setupOrchestrationWebSocket } from './api/orchestration.js';
import graphRouter from './api/graph.js';
import { createSyncServer } from './collaboration/index.js';
import commandRouter from './api/command.js';
import missionRouter from './api/missions.js';
import resourceRouter from './api/resources.js';
import sensorRouter from './api/sensors.js';
import planningRouter from './api/planning.js';
import mdmpRouter from './routes/mdmp.js';
import { startSyncWorkers } from './lib/blockchain-sync.js';
import { getMessageBus } from './messaging/message-bus.js';
import { getCheckpointer } from './orchestration/checkpointer.js';
import { getTracer } from './orchestration/observability.js';
import { getCheckpointManager } from './orchestration/human-checkpoints.js';
import { seedLangGraphAgents } from './agents/langgraph/agent-seeder.js';
import { closeNeo4jDriver } from './graph/index.js';
import { initRAFTSchema } from './graph/raft/schema-init.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS to allow credentials with explicit origins
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Alternative dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow any localhost origin
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-DID', 'Accept'],
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRouter);
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
app.use('/api/strategic/tools', strategicToolsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/messages', messagingRouter);
app.use('/api/orchestration', orchestrationRouter);
app.use('/api/graph', graphRouter);
app.use('/api/command', commandRouter);
app.use('/api/missions', missionRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/sensors', sensorRouter);
app.use('/api/planning', planningRouter);
app.use('/api/mdmp', mdmpRouter);

// Create HTTP server for WebSocket support
const server = createServer(app);

// Setup WebSocket for real-time message delivery
setupMessageWebSocket(server);

// Setup WebSocket for orchestration execution streaming
setupOrchestrationWebSocket(server);

// Setup WebSocket for real-time collaboration (Yjs document sync)
createSyncServer(server, '/ws/collab');
console.log('Collaboration WebSocket server mounted at /ws/collab');

server.listen(port, async () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Start blockchain sync workers
  try {
    await startSyncWorkers();
  } catch (error) {
    console.error('Failed to start sync workers:', error);
  }

  // Initialize message bus
  try {
    const messageBus = getMessageBus();
    await messageBus.ensureInitialized();
    console.log('Message bus initialized');
  } catch (error) {
    console.error('Failed to initialize message bus:', error);
  }

  // Initialize orchestration components
  try {
    await getCheckpointer();
    console.log('LangGraph checkpointer initialized');

    const tracer = getTracer();
    await tracer.initialize();
    console.log('Execution tracer initialized');

    const checkpointManager = getCheckpointManager();
    await checkpointManager.initialize();
    console.log('Human checkpoint manager initialized');
  } catch (error) {
    console.error('Failed to initialize orchestration:', error);
  }

  // Seed LangGraph-based agents
  try {
    await seedLangGraphAgents();
    console.log('LangGraph agents seeded');
  } catch (error) {
    console.error('Failed to seed LangGraph agents:', error);
  }

  // Initialize RAFT Neo4j schema (constraints and indexes)
  try {
    await initRAFTSchema();
  } catch (error) {
    console.error('Failed to initialize RAFT schema:', error);
  }
});

// Graceful shutdown handlers
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}, starting graceful shutdown...`);

  // Close Neo4j driver
  try {
    await closeNeo4jDriver();
  } catch (error) {
    console.error('Error closing Neo4j driver:', error);
  }

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

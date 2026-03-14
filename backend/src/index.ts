import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { createAnonAuth } from '@vitalpoint/near-phantom-auth/server';
import { dropLegacyAuthTables } from './auth/migration-drop-legacy.js';
import { setAuthInstance } from './auth/auth-instance.js';
import { getFundingService } from './auth/funding-service.js';
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
import { setupResourceWebSocket } from './resources/resource-ws.js';
import commandRouter from './api/command.js';
import problemSetsRouter from './api/problem-sets.js';
import { missionCreationRouter } from './api/mission-creation-routes.js';
import resourceRouter from './api/resources.js';
import sensorRouter from './api/sensors.js';
import planningRouter from './api/planning.js';
import mdmpRouter from './routes/mdmp.js';
import { exerciseRouter } from './api/exercise.js';
import userProfileRouter from './api/user-profile.js';
import userModeRouter from './api/user-mode.js';
import designRouter from './api/design.js';
import { startSyncWorkers } from './lib/blockchain-sync.js';
import { getMessageBus } from './messaging/message-bus.js';
import { getCheckpointer } from './orchestration/checkpointer.js';
import { getTracer } from './orchestration/observability.js';
import { getCheckpointManager } from './orchestration/human-checkpoints.js';
import { seedLangGraphAgents } from './agents/langgraph/agent-seeder.js';
import { closeNeo4jDriver } from './graph/index.js';
import { stopSharedBoss, getPool } from './lib/database.js';
import { initRAFTSchema } from './graph/raft/schema-init.js';
import { copRouter, initCOP } from './cop/index.js';
import { strategicContextRouter } from './api/strategic-context.js';
import { problemSetSubscriptionStore } from './problem-set/problem-set-subscription-store.js';
import inheritanceRouter from './api/inheritance.js';
import { gateRoutes } from './gates/gate-routes.js';
import { gateStore } from './gates/gate-store.js';
import { runMigrations } from './db/migration-runner.js';
import { aiStaffRouter, aiStaffStore } from './ai-staff/index.js';
import { ironclawRouter, ironclawStore } from './ironclaw/index.js';
import { validationRouter } from './validation/validation-router.js';
import { registerValidationJobs } from './validation/validation-scheduler.js';
import { requireAuth } from './auth/auth-instance.js';
import { discoveryRouter, setupDiscoveryWS, getDiscoveryService } from './discovery/index.js';
import { setupInheritanceWebSocket } from './inheritance/inheritance-ws.js';
import { setupRobotWebSocket, setupBridgeWebSocket, bridgeRouter } from './robot/index.js';
import { robotRouter } from './api/robot-routes.js';
import { osintWebhookRouter } from './api/osint-webhook.js';
import jppRouter from './api/jpp.js';
import { documentRouter } from './planning/routes/document-routes.js';
import assessmentRouter from './api/assessment-routes.js';
import { strategicGuidanceRouter } from './strategic/guidance/routes.js';
import docIntelligenceRouter from './api/doc-intelligence.js';
import brainRouter from './api/brain.js';
import brainSubspacesRouter from './api/brain-subspaces.js';

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

// Add production origin from APP_URL env var (e.g. https://bastion.vitalpoint.ai)
if (process.env.APP_URL) {
  allowedOrigins.push(process.env.APP_URL);
}

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
  allowedHeaders: ['Content-Type', 'X-DID', 'Accept'],
}));
app.use(express.json());

// Initialize @vitalpoint/near-phantom-auth
// auth.initialize() is called in the server startup sequence (see server.listen below)
const auth = createAnonAuth({
  nearNetwork: (process.env.NEAR_NETWORK as 'testnet' | 'mainnet') || 'testnet',
  sessionSecret: process.env.SESSION_SECRET!,
  database: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL!,
  },
  rp: {
    name: 'Bastion',
    id: process.env.NODE_ENV === 'production'
      ? new URL(process.env.APP_URL || 'https://localhost').hostname
      : 'localhost',
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.APP_URL || 'https://localhost')
      : 'http://localhost:5173',
  },
  recovery: {
    wallet: false,
    ipfs: {
      pinningService: 'pinata',
      apiKey: process.env.PINATA_API_KEY,
      apiSecret: process.env.PINATA_API_SECRET,
    },
  },
});

// Register the auth instance so route files can use requireAuth via auth-instance.ts
setAuthInstance(auth.requireAuth, auth.middleware);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount API routes
// Wire NEAR account funding to package registration completion:
// Intercept /register/finish responses and trigger fundAccount on success
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/register/finish') {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // After package handles registration, trigger NEAR funding if response was successful
      // The package returns { nearAccountId, ... } on successful registration
      const responseBody = body as Record<string, unknown>;
      if (res.statusCode < 400 && responseBody?.nearAccountId) {
        const accountId = responseBody.nearAccountId as string;
        const fundingService = getFundingService();
        if (fundingService.isEnabled()) {
          fundingService.fundAccount(accountId).then((result) => {
            if (result.success) {
              console.log(`[near-funding] Account ${accountId} funded successfully (${result.attempts} attempt(s))`);
            } else {
              console.error(`[near-funding] Failed to fund account ${accountId}: ${result.error}`);
            }
          }).catch((err) => {
            console.error('[near-funding] Unexpected error funding account:', err);
          });
        }
      }
      return originalJson(body);
    };
  }
  next();
}, auth.router);
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
app.use('/api/problem-sets/:problemSetId/missions', missionCreationRouter);
app.use('/api/problem-sets', problemSetsRouter);
app.use('/api/problem-sets', inheritanceRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/sensors', sensorRouter);
app.use('/api/planning', planningRouter);
app.use('/api/mdmp', mdmpRouter);
app.use('/api/exercise', exerciseRouter);
app.use('/api/user-profile', userProfileRouter);
app.use('/api/user-mode', userModeRouter);
app.use('/api/design', designRouter);
app.use('/api/cop', copRouter);
app.use('/api/strategic-context', strategicContextRouter);
app.use('/api/gates', gateRoutes);
app.use('/api/ai-staff', requireAuth, aiStaffRouter);
app.use('/api/ironclaw', requireAuth, ironclawRouter);
app.use('/api/validation', requireAuth, validationRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/osint', osintWebhookRouter);
app.use('/api/jpp', requireAuth, jppRouter);
app.use('/api/documents/planning', requireAuth, documentRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/strategic-guidance', strategicGuidanceRouter);
app.use('/api/doc-intelligence', docIntelligenceRouter);
app.use('/api/robot', robotRouter);
app.use('/api/brain', brainRouter);
app.use('/api/brain', brainSubspacesRouter);
// Bridge REST routes (Phase 43): /api/admin/bridge-tokens and /api/bridge/status
// Routes in bridgeRouter include full path prefixes, so mount at root
app.use('/', bridgeRouter);

// Create HTTP server for WebSocket support
const server = createServer(app);

// ---------------------------------------------------------------------------
// WebSocket setup — IMPORTANT: all WS servers use { noServer: true }.
// When multiple WebSocketServer instances use { server, path }, the ws library
// sends "HTTP/1.1 400 Bad Request" on the raw socket for non-matching paths,
// corrupting the WebSocket frame stream of the server that DID match.
// A single centralized 'upgrade' handler routes to the correct WSS by path.
// ---------------------------------------------------------------------------
import { WebSocketServer } from 'ws';

const wsServers = {
  messages: new WebSocketServer({ noServer: true }),
  orchestration: new WebSocketServer({ noServer: true }),
  collab: new WebSocketServer({ noServer: true }),
  resources: new WebSocketServer({ noServer: true }),
  discovery: new WebSocketServer({ noServer: true }),
  inheritance: new WebSocketServer({ noServer: true }),
  robot: new WebSocketServer({ noServer: true }),
  bridge: new WebSocketServer({ noServer: true }),
};

setupMessageWebSocket(wsServers.messages);
setupOrchestrationWebSocket(wsServers.orchestration);
createSyncServer(wsServers.collab);
console.log('Collaboration WebSocket server mounted at /ws/collab');
setupResourceWebSocket(wsServers.resources);
setupDiscoveryWS(wsServers.discovery);
setupInheritanceWebSocket(wsServers.inheritance);
setupRobotWebSocket(wsServers.robot);
setupBridgeWebSocket(wsServers.bridge);

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/messages') {
    wsServers.messages.handleUpgrade(request, socket, head, (ws) => {
      wsServers.messages.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/ws/orchestration/')) {
    wsServers.orchestration.handleUpgrade(request, socket, head, (ws) => {
      wsServers.orchestration.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/collab') {
    wsServers.collab.handleUpgrade(request, socket, head, (ws) => {
      wsServers.collab.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/resources') {
    wsServers.resources.handleUpgrade(request, socket, head, (ws) => {
      wsServers.resources.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/discovery') {
    wsServers.discovery.handleUpgrade(request, socket, head, (ws) => {
      wsServers.discovery.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/inheritance') {
    wsServers.inheritance.handleUpgrade(request, socket, head, (ws) => {
      wsServers.inheritance.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/robot') {
    wsServers.robot.handleUpgrade(request, socket, head, (ws) => {
      wsServers.robot.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/bridge') {
    wsServers.bridge.handleUpgrade(request, socket, head, (ws) => {
      wsServers.bridge.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, async () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Run pending database migrations (must run before ensureTable/initialize calls)
  try {
    await runMigrations();
  } catch (error) {
    console.error('Failed to run migrations:', error);
  }

  // Recover interrupted document processing (mark stuck 'processing' as 'interrupted')
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE strategic_documents
       SET processing_status = 'interrupted'
       WHERE processing_status = 'processing'
       RETURNING id`,
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Recovered ${result.rowCount} interrupted document(s)`);
    }
  } catch (error) {
    // Table may not exist yet on first run — that's fine
    console.warn('Could not recover interrupted documents:', (error as Error).message);
  }

  // Drop legacy auth tables (idempotent, must run before auth.initialize())
  try {
    await dropLegacyAuthTables();
  } catch (error) {
    console.error('Failed to drop legacy auth tables:', error);
  }

  // Initialize @vitalpoint/near-phantom-auth (creates anon_* schema tables)
  try {
    await auth.initialize();
    console.log('Anonymous auth initialized');
  } catch (error) {
    console.error('Failed to initialize anonymous auth:', error);
  }

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

  // Initialize decision gates table
  try {
    await gateStore.ensureTable();
    console.log('Decision gates table initialized');
  } catch (error) {
    console.error('Failed to initialize decision gates:', error);
  }

  // Initialize AI staff tables (Phase 29)
  try {
    await aiStaffStore.ensureTable();
    console.log('AI staff tables initialized');
  } catch (error) {
    console.error('Failed to initialize AI staff tables:', error);
  }

  // Initialize Ironclaw tables (Phase 30)
  try {
    await ironclawStore.ensureTable();
    console.log('Ironclaw tables initialized');
  } catch (error) {
    console.error('Failed to initialize Ironclaw tables:', error);
  }

  // Initialize COP module (schema, tables, triggers, agent definitions)
  try {
    await initCOP();
    console.log('COP module initialized');
  } catch (error) {
    console.error('Failed to initialize COP module:', error);
  }

  // Initialize RAFT Neo4j schema (constraints and indexes)
  try {
    await initRAFTSchema();
  } catch (error) {
    console.error('Failed to initialize RAFT schema:', error);
  }

  // Initialize AI workspace (PgBoss + PostgresSaver) eagerly to avoid cold-start 500s
  try {
    const { initAIWorkspace } = await import('./api/exercise.js');
    await initAIWorkspace();
    console.log('AI workspace initialized');
  } catch (error) {
    console.error('Failed to initialize AI workspace:', error);
  }

  // Register validation scheduler (Phase 31)
  try {
    await registerValidationJobs();
    console.log('Validation scheduler registered');
  } catch (error) {
    console.error('Failed to register validation scheduler:', error);
  }

  // Start OAuth token auto-refresh timer
  try {
    const { startTokenRefreshTimer } = await import('./auth/oauth-token-refresh.js');
    startTokenRefreshTimer();
  } catch (error) {
    console.error('Failed to start OAuth token refresh timer:', error);
  }

  // Initialize Discovery Service (Phase 32) — scanners paused until operator starts
  try {
    const { getResourceRegistry } = await import('./resources/resource-registry.js');
    const { gateService } = await import('./gates/gate-service.js');
    const discoveryService = getDiscoveryService();
    await discoveryService.initialize({
      resourceRegistry: getResourceRegistry(),
      messageBus: getMessageBus(),
      gateService,
    });
    console.log('[Server] Discovery service initialized (scanners paused)');
  } catch (error) {
    console.error('Failed to initialize discovery service:', error);
  }

  // Register document intelligence team (Phase 40)
  try {
    const { registerDocIntelligenceTeam } = await import('./doc-intelligence/team-setup.js');
    await registerDocIntelligenceTeam();
    console.log('Document intelligence team registered');
  } catch (error) {
    console.error('Failed to register document intelligence team:', error);
  }

  // Register strategic cache refresh pg-boss worker (Phase 25.3)
  try {
    const { getSharedBoss } = await import('./lib/database.js');
    const boss = await getSharedBoss();
    await boss.work('strategic-cache-refresh', async (jobs: unknown[]) => {
      for (const job of jobs) {
        const { publisherProblemSetId } = (job as { data: { publisherProblemSetId: string } }).data;
        await problemSetSubscriptionStore.refreshCacheForPublisher(publisherProblemSetId);
      }
    });
    console.log('Strategic cache refresh worker registered');
  } catch (error) {
    console.error('Failed to register strategic cache refresh worker:', error);
  }
});

// Graceful shutdown handlers
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}, starting graceful shutdown...`);

  // Stop discovery service scanners
  try {
    const discoveryService = getDiscoveryService();
    discoveryService.stop();
    console.log('Discovery service stopped');
  } catch (error) {
    console.error('Error stopping discovery service:', error);
  }

  // Stop shared pg-boss
  try {
    await stopSharedBoss();
  } catch (error) {
    console.error('Error stopping pg-boss:', error);
  }

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

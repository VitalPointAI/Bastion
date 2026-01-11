---
phase: 01-foundation-infrastructure
plan: 03A
type: execute
insertion: true
note: "Inserted after Plan 1-03 (IPFS) to implement PostgreSQL hybrid storage architecture decided 2026-01-11"
---

<objective>
Implement PostgreSQL hybrid storage infrastructure with dual-write pattern, event synchronization, and offline-first edge sync for DDIL environments.

Purpose: Establish fast query layer for operational dashboards while maintaining blockchain verification and IPFS large file storage. Enable autonomous vehicles to operate offline with eventual consistency.
Output: Working PostgreSQL deployment with extensions, dual-write to NEAR blockchain, event synchronization worker, and SQLite edge sync foundation.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
./summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-infrastructure/1-RESEARCH.md
@.planning/phases/01-foundation-infrastructure/1-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-02-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-03-PLAN.md
@.planning/research/postgresql-offline-sync-ddil-patterns.md

**Architectural decision (2026-01-11):**
- Hybrid storage: PostgreSQL (fast queries) + NEAR blockchain (verification) + IPFS (large files)
- Dual-write pattern for critical events
- Event synchronization for eventual consistency
- Offline sync for DDIL environments (autonomous vehicles)
- Mission-based data retention with IPFS archival
- Self-hosted PostgreSQL deployment

**Tech stack from research:**
- PostgreSQL 16+ with extensions: PostGIS, TimescaleDB, pg_trgm, pgvector, pg_partman
- PowerSync for edge SQLite synchronization (Jetson Orin Nano) - post-v1
- pgboss for background jobs and retry queues
- Transactional outbox pattern for dual-write reliability
- Event sourcing for audit trail and blockchain sync

**From Plan 1-03 (IPFS Storage):**
- Encrypted IPFS CIDs stored on-chain
- Need to also store in PostgreSQL for fast querying
- Document metadata needs full-text search in PostgreSQL

**From Plan 1-01 (NEAR Contracts):**
- Smart contract state versioning patterns established
- Need event emission for blockchain → PostgreSQL sync

**From Plan 1-02 (React Frontend):**
- Frontend will query PostgreSQL for fast operational dashboards
- Blockchain verification available for audit/compliance
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up PostgreSQL with extensions for operational queries</name>
  <files>docker-compose.yml, backend/database/init.sql, backend/database/schema.sql, backend/.env</files>
  <action>
    Create self-hosted PostgreSQL deployment with extensions for geospatial, time-series, full-text search, and vector similarity:

    1. Update docker-compose.yml with PostgreSQL service:
       - PostgreSQL 16 (latest stable) with TimescaleDB image (timescale/timescaledb:latest-pg16)
       - TimescaleDB image includes PostgreSQL + TimescaleDB extension pre-installed
       - Persistent volume for data (./postgres-data:/var/lib/postgresql/data)
       - Expose port 5432 (localhost only for security)
       - Environment variables: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
       - Health check for readiness:
         test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
         interval: 10s
         timeout: 5s
         retries: 5
       - Resource limits appropriate for development (increase for production)
       - Network: Backend service network

    2. Create backend/database/init.sql initialization script:
       - Enable TimescaleDB extension (CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;)
       - Enable PostGIS extension (CREATE EXTENSION IF NOT EXISTS postgis;)
       - Enable pg_trgm for full-text search (CREATE EXTENSION IF NOT EXISTS pg_trgm;)
       - Enable pgvector for AI embeddings (CREATE EXTENSION IF NOT EXISTS vector;)
       - Install pg_partman for mission-based partitioning (CREATE EXTENSION IF NOT EXISTS pg_partman;)
       - Set up pgboss schema (will be auto-created by pgboss library, but reserve schema)
       - Set appropriate privileges for application user
       - Configure PostgreSQL settings for performance:
         * shared_preload_libraries = 'timescaledb, pg_partman_bgw'
         * max_connections = 100 (adjust based on workload)
         * shared_buffers = 256MB (adjust based on available memory)

    3. Create backend/database/schema.sql with core tables:

       **documents table** (synced with NEAR blockchain):
       ```sql
       CREATE TABLE documents (
         document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         encrypted_cid TEXT NOT NULL,  -- IPFS CID (encrypted)
         encrypted_classification TEXT,
         encrypted_metadata JSONB,
         owner_account_id TEXT NOT NULL,  -- NEAR account
         created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
         blockchain_tx_hash TEXT,  -- NEAR transaction hash for verification
         blockchain_synced BOOLEAN DEFAULT false,

         -- IPFS integration fields
         ipfs_cid_hash TEXT,  -- Hash of plaintext CID for deduplication
         file_size_bytes BIGINT,
         mime_type TEXT,
         encryption_nonce TEXT  -- For decryption
       );

       CREATE INDEX idx_documents_owner ON documents(owner_account_id, created_at DESC);
       CREATE INDEX idx_documents_blockchain_sync ON documents(blockchain_synced) WHERE NOT blockchain_synced;
       CREATE INDEX idx_documents_metadata_gin ON documents USING GIN(encrypted_metadata jsonb_path_ops);
       ```

       **blockchain_events table** (event sourcing for audit trail):
       ```sql
       CREATE TABLE blockchain_events (
         event_id BIGSERIAL PRIMARY KEY,
         event_type TEXT NOT NULL,  -- document_registered, mission_approved, strike_authorized
         aggregate_id TEXT NOT NULL,  -- Entity this event relates to
         event_data JSONB NOT NULL,
         blockchain_tx_hash TEXT,
         created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
         processed BOOLEAN DEFAULT false
       );

       -- Convert to TimescaleDB hypertable for time-series optimization
       SELECT create_hypertable('blockchain_events', 'created_at');

       CREATE INDEX idx_events_aggregate ON blockchain_events(aggregate_id, created_at DESC);
       CREATE INDEX idx_events_type ON blockchain_events(event_type, created_at DESC);
       ```

       **outbox table** (transactional outbox pattern):
       ```sql
       CREATE TABLE outbox (
         outbox_id BIGSERIAL PRIMARY KEY,
         aggregate_type TEXT NOT NULL,  -- document, mission, strike
         aggregate_id TEXT NOT NULL,
         event_type TEXT NOT NULL,
         payload JSONB NOT NULL,  -- Data to write to blockchain
         created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
         processed_at TIMESTAMPTZ,
         blockchain_tx_hash TEXT,
         error TEXT,
         retry_count INTEGER DEFAULT 0
       );

       CREATE INDEX idx_outbox_pending ON outbox(created_at) WHERE processed_at IS NULL;
       ```

       **edge_sync_state table** (track offline edge devices):
       ```sql
       CREATE TABLE edge_sync_state (
         edge_device_id TEXT PRIMARY KEY,
         last_sync_at TIMESTAMPTZ,
         sync_checkpoint TEXT,  -- LSN or timestamp
         device_status TEXT,  -- online, offline, syncing
         pending_operations_count INTEGER DEFAULT 0,
         metadata JSONB
       );
       ```

       **sensor_telemetry table** (time-series from edge devices):
       ```sql
       CREATE TABLE sensor_telemetry (
         telemetry_id BIGSERIAL,
         edge_device_id TEXT NOT NULL,
         sensor_type TEXT NOT NULL,  -- camera, lidar, gps, imu
         sensor_data JSONB NOT NULL,
         timestamp TIMESTAMPTZ NOT NULL,
         mission_id TEXT,
         PRIMARY KEY (timestamp, telemetry_id)
       );

       -- Convert to TimescaleDB hypertable
       SELECT create_hypertable('sensor_telemetry', 'timestamp');

       CREATE INDEX idx_telemetry_device ON sensor_telemetry(edge_device_id, timestamp DESC);
       CREATE INDEX idx_telemetry_mission ON sensor_telemetry(mission_id, timestamp DESC);
       ```

       **mission_updates table** (bidirectional sync):
       ```sql
       CREATE TABLE mission_updates (
         update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         mission_id TEXT NOT NULL,
         update_type TEXT NOT NULL,  -- order, intelligence, status_change
         update_data JSONB NOT NULL,
         created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
         created_by TEXT NOT NULL  -- account_id or edge_device_id
       );

       CREATE INDEX idx_mission_updates ON mission_updates(mission_id, created_at DESC);
       ```

    4. Add to backend/.env:
       ```
       DATABASE_URL=postgresql://postgres:password@localhost:5432/coalition_ops
       POSTGRES_DB=coalition_ops
       POSTGRES_USER=postgres
       POSTGRES_PASSWORD=change_in_production
       ```
       Note: Use .env.development, .env.production for environment-specific configs

    5. Create backend/database/README.md with documentation:
       - How to start PostgreSQL: `docker-compose up -d postgres`
       - Extension purposes:
         * PostGIS: Geospatial queries (vehicle positions, target locations, AO boundaries)
         * TimescaleDB: Time-series optimization (sensor data, operational metrics)
         * pg_trgm: Full-text search (limited by encryption, but useful for tags/metadata)
         * pgvector: AI embeddings for semantic search and context graph
         * pg_partman: Mission-based data partitioning for retention and archival
       - Schema overview and table relationships
       - Backup procedure: `pg_dump $DATABASE_URL > backup.sql`
       - Restore procedure: `psql $DATABASE_URL < backup.sql`
       - Migration strategy: Will use node-pg-migrate or Prisma Migrate

    PostgreSQL provides foundation for:
    - Fast operational dashboards (Phase 9)
    - Intelligence fusion queries (Phase 8)
    - Sensor data aggregation (Phase 6-7)
    - Real-time command & control (Phase 7)
    - Geospatial mission planning (Phase 5)

    Don't hand-roll: Database clustering (use Patroni post-v1), connection pooling (use PgBouncer post-v1), backup automation (use pgBackRest post-v1), schema migrations (use node-pg-migrate or Prisma), monitoring (use pgAdmin or Grafana post-v1).
  </action>
  <verify>
    - docker-compose up -d postgres starts successfully
    - Health check passes: docker ps shows postgres as healthy
    - All extensions installed: psql $DATABASE_URL -c "SELECT * FROM pg_extension;"
    - All tables created: psql $DATABASE_URL -c "\dt"
    - Hypertables created: psql $DATABASE_URL -c "SELECT * FROM timescaledb_information.hypertables;"
    - Indexes created: psql $DATABASE_URL -c "\di"
    - Can connect from backend: psql $DATABASE_URL -c "SELECT version();"
  </verify>
  <done>PostgreSQL 16 running with TimescaleDB, PostGIS, pg_trgm, pgvector, pg_partman; core schema created with documents, blockchain_events, outbox, edge_sync_state, sensor_telemetry, mission_updates; hypertables for time-series; indexes for fast queries; ready for application integration</done>
</task>

<task type="auto">
  <name>Task 2: Implement dual-write pattern with transactional outbox</name>
  <files>backend/src/lib/database.ts, backend/src/lib/blockchain-sync.ts, backend/package.json</files>
  <action>
    Create dual-write infrastructure ensuring both PostgreSQL and NEAR blockchain are updated reliably:

    1. Install dependencies:
       ```bash
       cd backend
       pnpm add pg @types/pg pgboss @types/pgboss
       ```

    2. Create backend/src/lib/database.ts:
       ```typescript
       import { Pool } from 'pg';

       // Connection pool
       const pool = new Pool({
         connectionString: process.env.DATABASE_URL,
         max: 20,
         idleTimeoutMillis: 30000,
         connectionTimeoutMillis: 2000,
       });

       export interface DocumentInput {
         encrypted_cid: string;
         encrypted_classification: string;
         encrypted_metadata: object;
         owner_account_id: string;
         file_size_bytes?: number;
         mime_type?: string;
         encryption_nonce?: string;
       }

       /**
        * Dual-write: Insert document into PostgreSQL + queue for blockchain
        * Uses transactional outbox pattern for reliability
        */
       export async function dualWriteDocument(doc: DocumentInput): Promise<string> {
         const client = await pool.connect();
         try {
           await client.query('BEGIN');

           // Insert into documents table
           const docResult = await client.query(`
             INSERT INTO documents (
               encrypted_cid, encrypted_classification, encrypted_metadata,
               owner_account_id, file_size_bytes, mime_type, encryption_nonce
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING document_id
           `, [
             doc.encrypted_cid,
             doc.encrypted_classification,
             JSON.stringify(doc.encrypted_metadata),
             doc.owner_account_id,
             doc.file_size_bytes,
             doc.mime_type,
             doc.encryption_nonce
           ]);

           const documentId = docResult.rows[0].document_id;

           // Insert into outbox for blockchain sync
           await client.query(`
             INSERT INTO outbox (
               aggregate_type, aggregate_id, event_type, payload
             ) VALUES ($1, $2, $3, $4)
           `, [
             'document',
             documentId,
             'document_registered',
             JSON.stringify({
               document_id: documentId,
               encrypted_cid: doc.encrypted_cid,
               encrypted_classification: doc.encrypted_classification,
               encrypted_metadata: doc.encrypted_metadata,
               owner_account_id: doc.owner_account_id
             })
           ]);

           await client.query('COMMIT');
           return documentId;
         } catch (e) {
           await client.query('ROLLBACK');
           throw e;
         } finally {
           client.release();
         }
       }

       /**
        * Get document by ID (fast PostgreSQL query)
        */
       export async function getDocument(documentId: string) {
         const result = await pool.query(`
           SELECT * FROM documents WHERE document_id = $1
         `, [documentId]);
         return result.rows[0];
       }

       /**
        * List user's documents (paginated)
        */
       export async function listUserDocuments(
         ownerAccountId: string,
         limit: number = 20,
         offset: number = 0
       ) {
         const result = await pool.query(`
           SELECT * FROM documents
           WHERE owner_account_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3
         `, [ownerAccountId, limit, offset]);
         return result.rows;
       }

       export { pool };
       ```

    3. Create backend/src/lib/blockchain-sync.ts:
       ```typescript
       import PgBoss from 'pg-boss';
       import { pool } from './database.js';
       import { Contract } from 'near-api-js';

       const boss = new PgBoss(process.env.DATABASE_URL!);

       /**
        * Process outbox records and write to NEAR blockchain
        */
       async function processOutboxWorker() {
         // Poll outbox for unprocessed records
         await boss.work('process-outbox', { teamSize: 5 }, async (job) => {
           const client = await pool.connect();
           try {
             // Get oldest unprocessed outbox record
             const result = await client.query(`
               SELECT * FROM outbox
               WHERE processed_at IS NULL
               ORDER BY created_at ASC
               LIMIT 1
               FOR UPDATE SKIP LOCKED
             `);

             if (result.rows.length === 0) return;

             const outboxRecord = result.rows[0];
             const payload = JSON.parse(outboxRecord.payload);

             // Write to NEAR blockchain
             // TODO: Integrate with NEAR contract from Plan 1-01
             // const contract = getNearContract();
             // const tx = await contract.register_document({
             //   args: payload,
             //   gas: '30000000000000'
             // });

             // Simulate for now
             const blockchainTxHash = `near:${Date.now()}`;

             // Mark as processed
             await client.query(`
               UPDATE outbox
               SET processed_at = NOW(),
                   blockchain_tx_hash = $1
               WHERE outbox_id = $2
             `, [blockchainTxHash, outboxRecord.outbox_id]);

             // Update document record
             await client.query(`
               UPDATE documents
               SET blockchain_synced = true,
                   blockchain_tx_hash = $1
               WHERE document_id = $2
             `, [blockchainTxHash, outboxRecord.aggregate_id]);

           } catch (error) {
             // Increment retry count and log error
             await client.query(`
               UPDATE outbox
               SET retry_count = retry_count + 1,
                   error = $1
               WHERE outbox_id = $2
             `, [error.message, outboxRecord.outbox_id]);

             // If max retries exceeded, alert
             if (outboxRecord.retry_count >= 5) {
               console.error('Max retries exceeded for outbox record', outboxRecord.outbox_id);
             }

             throw error; // pgboss will retry with exponential backoff
           } finally {
             client.release();
           }
         });
       }

       /**
        * Listen to NEAR blockchain events and sync to PostgreSQL
        */
       async function syncBlockchainEventsWorker() {
         // TODO: Implement NEAR event listener
         // Use NEAR RPC subscriptions or polling
         // When external document registered on blockchain:
         // - Check if exists in PostgreSQL
         // - If not: INSERT from blockchain event
         // - INSERT into blockchain_events table for audit
       }

       /**
        * Start all sync workers
        */
       export async function startSyncWorkers() {
         await boss.start();

         // Schedule outbox processing every 5 seconds
         await boss.schedule('process-outbox', '*/5 * * * * *');

         await processOutboxWorker();
         // await syncBlockchainEventsWorker(); // Phase 2

         console.log('Blockchain sync workers started');
       }

       /**
        * Graceful shutdown
        */
       export async function stopSyncWorkers() {
         await boss.stop();
       }

       // Handle process termination
       process.on('SIGTERM', stopSyncWorkers);
       process.on('SIGINT', stopSyncWorkers);
       ```

    4. Integration in backend/src/index.ts:
       ```typescript
       import { startSyncWorkers } from './lib/blockchain-sync.js';

       // Start sync workers on backend startup
       await startSyncWorkers();
       ```

    Transactional outbox pattern benefits:
    - **Atomic**: PostgreSQL write and outbox insert in single transaction
    - **Reliable**: Survives crashes, network failures
    - **Asynchronous**: Blockchain writes don't block user operations
    - **Retryable**: Automatic retry with exponential backoff (pgboss)
    - **Idempotent**: Can detect and skip duplicate blockchain writes

    Don't hand-roll: Job queue (use pgboss), retry logic (pgboss handles it), distributed transactions (outbox pattern eliminates need), connection pooling (use pg.Pool), event deduplication (pgboss provides it).
  </action>
  <verify>
    - pnpm build succeeds
    - Call dualWriteDocument creates records in both documents and outbox
    - Background worker processes outbox record
    - On success: documents.blockchain_synced = true, blockchain_tx_hash populated
    - On simulated failure: retry_count increments
    - Test: Stop NEAR RPC, verify retry with exponential backoff
    - Test: Restart backend, verify workers resume processing
  </verify>
  <done>Dual-write implemented with transactional outbox; pgboss processes blockchain writes asynchronously; PostgreSQL writes immediate, blockchain eventual; retry logic with exponential backoff; workers start on backend initialization</done>
</task>

<task type="auto">
  <name>Task 3: Implement offline-first edge sync foundation for DDIL</name>
  <files>backend/src/lib/edge-sync.ts, edge-device/src/lib/local-db.ts, backend/src/api/edge-sync.ts</files>
  <action>
    Create foundation for offline-first edge device synchronization (full PowerSync integration deferred to post-v1):

    1. For v1: Simple queue-based approach
       - Edge devices queue operations in local SQLite
       - Sync via HTTP API when connectivity available
       - Foundation for PowerSync or ElectricSQL integration post-v1

    2. Install edge device dependencies (edge-device directory):
       ```bash
       cd edge-device
       pnpm add better-sqlite3 @types/better-sqlite3 axios @types/axios
       ```

    3. Create edge-device/src/lib/local-db.ts:
       ```typescript
       import Database from 'better-sqlite3';

       const db = new Database('edge-local.db');

       // Initialize local database
       db.exec(`
         CREATE TABLE IF NOT EXISTS local_operations (
           operation_id TEXT PRIMARY KEY,
           operation_type TEXT NOT NULL,
           payload TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           synced INTEGER DEFAULT 0
         );

         CREATE TABLE IF NOT EXISTS sync_state (
           key TEXT PRIMARY KEY,
           value TEXT
         );
       `);

       export interface Operation {
         operation_id: string;
         operation_type: string;
         payload: object;
       }

       /**
        * Queue operation for sync when offline
        */
       export function queueOperation(type: string, payload: object) {
         const operationId = crypto.randomUUID();
         db.prepare(`
           INSERT INTO local_operations (operation_id, operation_type, payload, created_at)
           VALUES (?, ?, ?, ?)
         `).run(operationId, type, JSON.stringify(payload), Date.now());
         return operationId;
       }

       /**
        * Get all unsynced operations
        */
       export function getSyncQueue(): Operation[] {
         const rows = db.prepare(`
           SELECT * FROM local_operations
           WHERE synced = 0
           ORDER BY created_at ASC
         `).all();

         return rows.map(row => ({
           operation_id: row.operation_id,
           operation_type: row.operation_type,
           payload: JSON.parse(row.payload)
         }));
       }

       /**
        * Mark operation as synced
        */
       export function markSynced(operationId: string) {
         db.prepare(`
           UPDATE local_operations
           SET synced = 1
           WHERE operation_id = ?
         `).run(operationId);
       }

       /**
        * Clear old synced operations (retention)
        */
       export function clearSyncedOperations(olderThanMs: number) {
         const cutoff = Date.now() - olderThanMs;
         db.prepare(`
           DELETE FROM local_operations
           WHERE synced = 1 AND created_at < ?
         `).run(cutoff);
       }

       export { db };
       ```

    4. Create backend/src/lib/edge-sync.ts:
       ```typescript
       import { pool } from './database.js';

       /**
        * Process sync request from edge device
        */
       export async function processSyncRequest(
         deviceId: string,
         operations: Array<{operation_type: string, payload: object}>
       ) {
         const client = await pool.connect();
         try {
           await client.query('BEGIN');

           for (const op of operations) {
             switch (op.operation_type) {
               case 'sensor_reading':
                 await client.query(`
                   INSERT INTO sensor_telemetry (
                     edge_device_id, sensor_type, sensor_data, timestamp
                   ) VALUES ($1, $2, $3, $4)
                 `, [
                   deviceId,
                   op.payload.sensor_type,
                   JSON.stringify(op.payload.data),
                   op.payload.timestamp
                 ]);
                 break;

               case 'mission_update':
                 await client.query(`
                   INSERT INTO mission_updates (
                     mission_id, update_type, update_data, created_by
                   ) VALUES ($1, $2, $3, $4)
                 `, [
                   op.payload.mission_id,
                   op.payload.update_type,
                   JSON.stringify(op.payload.data),
                   deviceId
                 ]);
                 break;

               // Add other operation types as needed
             }
           }

           // Update edge device sync state
           await client.query(`
             INSERT INTO edge_sync_state (
               edge_device_id, last_sync_at, device_status
             ) VALUES ($1, NOW(), 'online')
             ON CONFLICT (edge_device_id)
             DO UPDATE SET last_sync_at = NOW(), device_status = 'online'
           `, [deviceId]);

           await client.query('COMMIT');
           return { success: true, synced_count: operations.length };
         } catch (error) {
           await client.query('ROLLBACK');
           throw error;
         } finally {
           client.release();
         }
       }

       /**
        * Get updates for edge device (pull sync)
        */
       export async function getSyncDelta(deviceId: string, since: string) {
         // Query for mission updates since last sync
         const result = await pool.query(`
           SELECT * FROM mission_updates
           WHERE created_at > $1
           ORDER BY created_at ASC
         `, [since]);

         return result.rows;
       }
       ```

    5. Create backend/src/api/edge-sync.ts (Express routes):
       ```typescript
       import express from 'express';
       import { processSyncRequest, getSyncDelta } from '../lib/edge-sync.js';

       const router = express.Router();

       /**
        * POST /api/edge/sync - Push operations from edge device
        */
       router.post('/sync', async (req, res) => {
         const { device_id, operations } = req.body;

         // TODO: Authenticate edge device (NEAR account signature)

         try {
           const result = await processSyncRequest(device_id, operations);
           res.json(result);
         } catch (error) {
           res.status(500).json({ error: error.message });
         }
       });

       /**
        * GET /api/edge/sync/delta - Pull updates for edge device
        */
       router.get('/sync/delta', async (req, res) => {
         const { device_id, since } = req.query;

         try {
           const updates = await getSyncDelta(device_id as string, since as string);
           res.json({ updates });
         } catch (error) {
           res.status(500).json({ error: error.message });
         }
       });

       export default router;
       ```

    6. Conflict resolution strategy:
       - Timestamp-based Last-Write-Wins (LWW) for simple conflicts
       - Blockchain as source of truth for critical decisions
       - All conflicts logged to blockchain_events for audit
       - Commander review for significant conflicts (Phase 3+)

    DDIL sync characteristics:
    - **Offline operation**: Edge devices fully functional without connectivity
    - **Local queue**: All operations persisted in SQLite
    - **Opportunistic sync**: Sync when connectivity available
    - **No data loss**: All operations eventually synced
    - **Eventual consistency**: Central database updated asynchronously

    For v1: Simple queue-based sync (this plan)
    For production: PowerSync or ElectricSQL (post-v1 upgrade)

    Don't hand-roll: SQLite sync protocols (use PowerSync post-v1), conflict resolution algorithms (use CRDT libraries or PowerSync), real-time subscriptions (use WebSocket libraries post-v1), authentication (use NEAR signatures).
  </action>
  <verify>
    - Edge device queues operations locally
    - Edge device POSTs to /api/edge/sync when online
    - Backend processes operations and stores in PostgreSQL
    - edge_sync_state updated with last_sync_at
    - Test offline: Queue operations, then sync, verify all synced
    - Test conflict: Two devices, same operation, verify LWW resolution
  </verify>
  <done>Offline-first edge sync foundation implemented; SQLite on edge queues operations; HTTP sync API processes edge operations; sensor_telemetry and mission_updates tables populated from edge; timestamp-based LWW conflict resolution; DDIL operations supported</done>
</task>

<task type="auto">
  <name>Task 4: Integrate PostgreSQL with IPFS document storage from Plan 1-03</name>
  <files>backend/src/lib/database.ts, backend/src/api/documents.ts</files>
  <action>
    Update PostgreSQL integration to work with IPFS document storage from Plan 1-03:

    1. Document upload workflow (integrating Plan 1-03):
       - Client encrypts document (Plan 1-03: encryption.ts)
       - Client uploads encrypted document to IPFS (Plan 1-03: ipfs.ts)
       - Client receives IPFS CID
       - Client encrypts CID for on-chain storage
       - Client calls backend API with encrypted CID and metadata
       - Backend uses dualWriteDocument (already implemented in Task 2):
         * Stores in PostgreSQL immediately
         * Queues for NEAR blockchain (outbox)
       - Background worker syncs to blockchain

    2. Update backend/src/lib/database.ts (extend dualWriteDocument):
       ```typescript
       // DocumentInput already defined in Task 2, enhance if needed:
       export interface DocumentInput {
         encrypted_cid: string;           // From IPFS upload (encrypted)
         encrypted_classification: string;
         encrypted_metadata: object;
         owner_account_id: string;
         file_size_bytes?: number;        // From IPFS response
         mime_type?: string;
         encryption_nonce?: string;       // For decryption
       }

       // dualWriteDocument already handles this, no changes needed
       ```

    3. Create backend/src/api/documents.ts (REST API):
       ```typescript
       import express from 'express';
       import { dualWriteDocument, getDocument, listUserDocuments } from '../lib/database.js';

       const router = express.Router();

       /**
        * POST /api/documents - Register document after IPFS upload
        */
       router.post('/', async (req, res) => {
         // Client has already uploaded to IPFS and encrypted CID
         const {
           encrypted_cid,
           encrypted_classification,
           encrypted_metadata,
           owner_account_id,
           file_size_bytes,
           mime_type,
           encryption_nonce
         } = req.body;

         // TODO: Authenticate user (verify owner_account_id matches auth)

         try {
           const documentId = await dualWriteDocument({
             encrypted_cid,
             encrypted_classification,
             encrypted_metadata,
             owner_account_id,
             file_size_bytes,
             mime_type,
             encryption_nonce
           });

           res.json({ document_id: documentId });
         } catch (error) {
           res.status(500).json({ error: error.message });
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
           res.json(doc);
         } catch (error) {
           res.status(500).json({ error: error.message });
         }
       });

       /**
        * GET /api/documents - List user's documents
        */
       router.get('/', async (req, res) => {
         const { owner_account_id, limit, offset } = req.query;

         try {
           const docs = await listUserDocuments(
             owner_account_id as string,
             parseInt(limit as string) || 20,
             parseInt(offset as string) || 0
           );
           res.json({ documents: docs });
         } catch (error) {
           res.status(500).json({ error: error.message });
         }
       });

       export default router;
       ```

    4. Document retrieval workflow:
       - Client queries PostgreSQL: GET /api/documents/:documentId
       - Response includes:
         * encrypted_cid (encrypted IPFS CID)
         * encrypted_metadata
         * encryption_nonce
         * blockchain_tx_hash (for verification)
         * blockchain_synced (true if on blockchain)
       - Client decrypts CID (key from blockchain or TEE)
       - Client fetches encrypted document from IPFS
       - Client decrypts document

    5. Verification workflow:
       - Client checks blockchain_synced = true
       - Client queries NEAR blockchain with blockchain_tx_hash
       - Client verifies encrypted_cid matches on blockchain
       - Blockchain is source of truth for provenance

    6. Searchable metadata strategy (v1):
       - Store metadata field names unencrypted for search
       - Store metadata values encrypted
       - Example encrypted_metadata:
         ```json
         {
           "type": "intelligence_report",
           "tags": ["tactical", "reconnaissance"],
           "author_encrypted": "encrypted_value",
           "content_summary_encrypted": "encrypted_value"
         }
         ```
       - Can search by type and tags
       - Values remain encrypted
       - Full searchable encryption deferred to Phase 2

    Architecture after integration:
    ```
    Client
      ↓ 1. Encrypt document
      ↓ 2. Upload to IPFS → Get CID
      ↓ 3. Encrypt CID
      ↓ 4. POST /api/documents
    Backend
      ↓ 5. dualWriteDocument
      ├─→ PostgreSQL (immediate)
      └─→ Outbox (queued)
    Background Worker
      ↓ 6. Process outbox
      └─→ NEAR Blockchain (eventual)

    Retrieval:
    Client
      ↓ 1. GET /api/documents/:id
      ← 2. encrypted_cid, metadata
      ↓ 3. Decrypt CID
      ↓ 4. Fetch from IPFS
      ↓ 5. Decrypt document
    ```

    Don't hand-roll: CID validation (use IPFS libraries), encryption (use @noble/ciphers from Plan 1-03), searchable encryption (use field-level for v1), authentication (use Privy from Plan 1-02).
  </action>
  <verify>
    - Upload encrypted document to IPFS (Plan 1-03 workflow)
    - POST /api/documents with encrypted_cid
    - Verify record in PostgreSQL documents table
    - Verify record in outbox table
    - Wait for background worker to process
    - Verify blockchain_synced = true
    - GET /api/documents/:documentId returns correct data
    - GET /api/documents lists user's documents
    - Verify blockchain_tx_hash can be used to query NEAR
  </verify>
  <done>PostgreSQL integrated with IPFS storage; document upload workflow stores encrypted CIDs in both PostgreSQL and NEAR blockchain; fast queries via PostgreSQL; verification via blockchain; REST API for document operations; searchable metadata with field-level encryption</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] PostgreSQL 16 running with TimescaleDB, PostGIS, pg_trgm, pgvector, pg_partman
- [ ] All tables created: documents, blockchain_events, outbox, edge_sync_state, sensor_telemetry, mission_updates
- [ ] Hypertables created for time-series tables
- [ ] Dual-write pattern functional: PostgreSQL + outbox
- [ ] pgboss background worker processes outbox → NEAR blockchain
- [ ] Offline-first edge sync: SQLite queues, HTTP sync API
- [ ] IPFS integration: encrypted CIDs in PostgreSQL and blockchain
- [ ] REST API endpoints functional: POST/GET /api/documents, POST/GET /api/edge/sync
- [ ] End-to-end test: Upload to IPFS → Register in PostgreSQL → Sync to blockchain → Retrieve
- [ ] DDIL test: Edge device offline → Queue operations → Online → Sync successfully
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- PostgreSQL deployed with required extensions
- Hybrid storage operational: PostgreSQL (fast) + NEAR (verification) + IPFS (large files)
- Dual-write reliable with transactional outbox
- Eventual consistency: PostgreSQL immediate, blockchain within seconds
- Offline-first edge sync foundation for DDIL environments
- No indexer infrastructure costs
- Self-hosted PostgreSQL
- Mission-based partitioning foundation
- Integration with Plan 1-03 IPFS storage
- Ready for operational dashboards, intelligence fusion, sensor data aggregation
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-03A-SUMMARY.md`:

# Phase 1 Plan 3A: PostgreSQL Hybrid Storage Summary

**Inserted plan implementing PostgreSQL operational database with dual-write to blockchain, offline-first edge sync, and IPFS integration**

## Accomplishments

- PostgreSQL 16 with TimescaleDB, PostGIS, pg_trgm, pgvector, pg_partman extensions
- Hybrid storage: PostgreSQL (fast queries) + NEAR (verification) + IPFS (large files)
- Dual-write pattern with transactional outbox
- pgboss background worker for async blockchain sync
- Offline-first edge sync for DDIL environments
- SQLite on Jetson Orin Nano with HTTP sync API
- Conflict resolution with timestamp LWW
- Event sourcing with blockchain_events hypertable
- IPFS integration from Plan 1-03
- Mission-based partitioning foundation
- No indexer costs (custom sync worker)

## Files Created/Modified

- `docker-compose.yml` - PostgreSQL service
- `backend/database/init.sql` - Extensions initialization
- `backend/database/schema.sql` - Core tables
- `backend/database/README.md` - Documentation
- `backend/src/lib/database.ts` - Dual-write pattern
- `backend/src/lib/blockchain-sync.ts` - Outbox processor
- `backend/src/lib/edge-sync.ts` - Edge sync API
- `backend/src/api/documents.ts` - Document REST API
- `backend/src/api/edge-sync.ts` - Edge sync endpoints
- `edge-device/src/lib/local-db.ts` - SQLite local storage

## Decisions Made

- Self-hosted PostgreSQL for control and security
- Transactional outbox for dual-write reliability
- pgboss for background jobs (simpler than Kafka for v1)
- SQLite for edge devices (offline-first)
- Timestamp LWW conflict resolution
- Mission-based partitioning for retention
- Field-level encryption for searchable metadata

## Next Step

Proceed to [1-04-PLAN.md](1-04-PLAN.md): Phala TEE Environment
</output>

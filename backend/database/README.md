# Coalition Operations Database

PostgreSQL 16 with TimescaleDB for hybrid storage architecture.

## Architecture

**Hybrid Storage Model:**
- **PostgreSQL**: Fast operational queries, intelligence fusion, sensor aggregation
- **NEAR Blockchain**: Critical decisions, audit trail, provenance
- **IPFS**: Large files, documents, sensor data

## Extensions

### TimescaleDB
**Purpose**: Time-series optimization for sensor data and operational metrics

**Use Cases:**
- Sensor telemetry from edge devices (camera, lidar, GPS, IMU)
- Blockchain event history and audit trail
- Operational metrics and performance monitoring

**Tables**: `blockchain_events`, `sensor_telemetry`

### PostGIS
**Purpose**: Geospatial queries for military operations

**Use Cases:**
- Vehicle positions and tracking
- Target location management
- Area of Operations (AO) boundary queries
- Geofencing and proximity alerts

**Status**: Extension installed, spatial tables to be added in Phase 5 (Mission Planning)

### pg_trgm
**Purpose**: Full-text search for document metadata

**Use Cases:**
- Tag-based document search
- Metadata filtering (classification, mission, author)
- Limited by encryption but useful for unencrypted fields

**Tables**: `documents.encrypted_metadata` (GIN index)

### pgvector
**Purpose**: AI embeddings for semantic search and context graph

**Use Cases:**
- Semantic document search
- Context graph entity similarity
- Intelligence clustering and pattern recognition

**Status**: Extension installed, embedding columns to be added in Phase 8 (Intelligence Fusion)

### pg_partman
**Purpose**: Mission-based data partitioning for retention

**Use Cases:**
- Archive completed mission data
- Automatic partition management
- Mission-based data lifecycle

**Status**: Extension installed, partitioning strategy to be implemented in Phase 9 (Assessment)

## Tables

### documents
Encrypted document registry synced with NEAR blockchain.

**Columns:**
- `document_id`: UUID primary key
- `encrypted_cid`: IPFS CID (encrypted for privacy)
- `encrypted_classification`: Security classification (encrypted)
- `encrypted_metadata`: Document metadata (JSONB, encrypted)
- `owner_account_id`: NEAR account (plaintext for access control)
- `blockchain_tx_hash`: NEAR transaction hash for verification
- `blockchain_synced`: Sync status flag

**Indexes:**
- Owner + created_at (fast user document list)
- Blockchain sync status (pending sync query)
- Metadata GIN (fast metadata search)

### blockchain_events (Hypertable)
Event sourcing for audit trail.

**Columns:**
- `event_id`: Bigserial primary key
- `event_type`: document_registered, mission_approved, strike_authorized
- `aggregate_id`: Related entity ID
- `event_data`: Event payload (JSONB)
- `blockchain_tx_hash`: NEAR transaction hash
- `created_at`: Timestamp (hypertable partition key)
- `processed`: Processing status

**Indexes:**
- Aggregate + created_at (entity event history)
- Event type + created_at (type-based queries)

### outbox
Transactional outbox pattern for dual-write reliability.

**Columns:**
- `outbox_id`: Bigserial primary key
- `aggregate_type`: document, mission, strike
- `aggregate_id`: Entity ID
- `event_type`: Event type
- `payload`: Blockchain write data (JSONB)
- `created_at`: Queue timestamp
- `processed_at`: Processing completion timestamp
- `blockchain_tx_hash`: NEAR transaction hash after sync
- `error`: Error message if failed
- `retry_count`: Retry attempts

**Indexes:**
- Pending records (unprocessed outbox entries)

### edge_sync_state
Track offline edge devices (DDIL environments).

**Columns:**
- `edge_device_id`: Device identifier (primary key)
- `last_sync_at`: Last successful sync timestamp
- `sync_checkpoint`: LSN or timestamp for delta sync
- `device_status`: online, offline, syncing
- `pending_operations_count`: Operations queued on device
- `metadata`: Device info (JSONB)

### sensor_telemetry (Hypertable)
Time-series sensor data from edge devices.

**Columns:**
- `telemetry_id`: Bigserial
- `edge_device_id`: Device identifier
- `sensor_type`: camera, lidar, gps, imu
- `sensor_data`: Sensor reading (JSONB)
- `timestamp`: Reading timestamp (hypertable partition key)
- `mission_id`: Related mission

**Indexes:**
- Device + timestamp (device history)
- Mission + timestamp (mission sensor data)

### mission_updates
Bidirectional sync for mission orders and status.

**Columns:**
- `update_id`: UUID primary key
- `mission_id`: Mission identifier
- `update_type`: order, intelligence, status_change
- `update_data`: Update payload (JSONB)
- `created_at`: Update timestamp
- `created_by`: Account or device ID

**Indexes:**
- Mission + created_at (mission update history)

## Operations

### Start PostgreSQL
```bash
docker-compose up -d postgres
```

### Check Health
```bash
docker ps  # Verify postgres container is healthy
psql postgresql://postgres:password@localhost:5432/coalition_ops -c "SELECT version();"
```

### Verify Extensions
```bash
psql postgresql://postgres:password@localhost:5432/coalition_ops -c "SELECT * FROM pg_extension;"
```

### List Tables
```bash
psql postgresql://postgres:password@localhost:5432/coalition_ops -c "\dt"
```

### Check Hypertables
```bash
psql postgresql://postgres:password@localhost:5432/coalition_ops -c "SELECT * FROM timescaledb_information.hypertables;"
```

### Backup
```bash
pg_dump postgresql://postgres:password@localhost:5432/coalition_ops > backup-$(date +%Y%m%d).sql
```

### Restore
```bash
psql postgresql://postgres:password@localhost:5432/coalition_ops < backup-20260111.sql
```

## Migration Strategy

**v1**: Manual SQL scripts in `database/` directory
**Post-v1**: Consider migration tools:
- node-pg-migrate (Node.js migration framework)
- Prisma Migrate (if adopting Prisma ORM)
- Flyway (Java-based, enterprise-grade)

## Performance Tuning

### Development Settings (Current)
- shared_buffers: Default (128MB)
- max_connections: Default (100)
- work_mem: Default (4MB)

### Production Recommendations
- shared_buffers: 25% of RAM
- max_connections: Based on connection pool size
- work_mem: Adjust based on query complexity
- effective_cache_size: 50-75% of RAM
- random_page_cost: 1.1 (for SSD)

### Connection Pooling
**v1**: Direct connections from backend
**Production**: PgBouncer for connection pooling

## High Availability (Post-v1)

- **Replication**: PostgreSQL streaming replication
- **Clustering**: Patroni for automatic failover
- **Backup**: pgBackRest for continuous archiving
- **Monitoring**: pgAdmin, Grafana, or Datadog

## Security

### Current (Development)
- Password authentication
- localhost-only port exposure
- Sealed secrets in backend/.env

### Production
- SSL/TLS encryption (require)
- Certificate-based authentication
- Row-level security (RLS) for multi-tenancy
- Audit logging with pg_audit extension
- Secrets management (HashiCorp Vault, AWS Secrets Manager)

## Data Retention

### Strategy
1. **Operational data**: Retained in PostgreSQL during mission/event
2. **Archival**: Moved to IPFS after mission completion
3. **Provenance**: CIDs and metadata remain on NEAR blockchain
4. **Partitioning**: pg_partman for automatic mission-based cleanup

### Implementation (Post-v1)
- Automatic archival workflow
- Mission-based partition creation
- Retention policies per data classification
- IPFS pinning for long-term storage

## Conflict Resolution

**PostgreSQL vs Blockchain:**
- Blockchain is source of truth for critical decisions
- PostgreSQL is operational state
- Conflicts logged to blockchain_events for audit

**Edge Device Conflicts:**
- Timestamp-based Last-Write-Wins (LWW)
- Commander review for significant conflicts
- All conflicts logged to blockchain

## Integration Points

### NEAR Blockchain
- Dual-write via transactional outbox
- Background worker processes outbox → NEAR
- Event listener syncs blockchain → PostgreSQL

### IPFS
- CIDs stored in documents table
- Large files remain on IPFS
- Content addressing for integrity

### Edge Devices
- SQLite on Jetson Orin Nano
- HTTP sync API for queue processing
- Eventual consistency model

## Phase Roadmap

- **Phase 1-03A** (Current): Core schema, extensions, dual-write foundation
- **Phase 5**: Geospatial mission planning (PostGIS spatial tables)
- **Phase 7**: Real-time C2 queries, edge sync operational
- **Phase 8**: Intelligence fusion, AI embeddings (pgvector)
- **Phase 9**: Operational dashboards, mission partitioning (pg_partman)

---
**Hybrid Storage**: PostgreSQL (fast) + NEAR (verification) + IPFS (large files)

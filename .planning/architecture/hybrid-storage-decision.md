# Hybrid Storage Architecture Decision

**Date**: 2026-01-11
**Status**: Decided
**Impact**: Foundation-wide (affects all phases)

## Context

The project requires blockchain synchronization to enable:
- Fast complex queries for operational dashboards
- Intelligence fusion and sensor data aggregation
- Real-time command & control operations
- Offline operation in DDIL (Denied, Degraded, Intermittent, Limited) environments
- Verifiable audit trail and provenance
- Mission-based data retention and archival

## Problem Statement

Blockchain-only storage has limitations:
- **Slow queries**: Complex joins, full-text search, geospatial queries not practical on-chain
- **High costs**: Storing large datasets on-chain is prohibitively expensive
- **Query patterns**: Operational dashboards require SQL-style queries (WHERE, JOIN, GROUP BY, etc.)
- **Indexing costs**: Running NEAR Lake indexer or using TheGraph adds infrastructure and operational costs

Alternatives considered:
- ❌ **NEAR Lake Indexer**: Too expensive for self-hosted deployment
- ❌ **TheGraph**: External dependency, costs, less control
- ❌ **Blockchain-only**: Too slow for operational queries
- ✅ **Hybrid storage**: PostgreSQL + NEAR + IPFS

## Decision

Implement **hybrid storage architecture** with three tiers:

### Tier 1: PostgreSQL (Fast Operational Queries)
- **Purpose**: Fast complex queries, operational dashboards, intelligence fusion, sensor aggregation
- **Data**: Operational state, metadata, indexes, full-text search, time-series data
- **Extensions**: PostGIS (geospatial), TimescaleDB (time-series), pg_trgm (full-text search), pgvector (AI embeddings), pg_partman (partitioning)
- **Deployment**: Self-hosted (control, security, cost predictability)

### Tier 2: NEAR Blockchain (Verification & Audit Trail)
- **Purpose**: Immutable audit trail, provenance, critical decision records, access control policies
- **Data**: Critical events (DAO votes, strike authorizations, mission approvals), encrypted document registry CIDs, provenance records
- **Benefit**: Decentralized verification, coalition trust, tamper-proof history

### Tier 3: IPFS (Large File Storage)
- **Purpose**: Decentralized storage for large files
- **Data**: Documents, intelligence products, mission plans, sensor feeds, training data
- **Storage**: Pinata (managed pinning service)
- **Benefit**: Content addressing, tamper-proof, resilient, cost-effective for large files

## Synchronization Strategy

### Dual-Write Pattern (Critical Events)
```
Application
  ↓ BEGIN TRANSACTION
  ├─→ Write to PostgreSQL
  └─→ Write to outbox table
  ↓ COMMIT (atomic)

Background Worker (pgboss)
  ↓ Poll outbox
  └─→ Write to NEAR blockchain (async, retryable)
```

**Benefits**:
- Single database transaction (atomic)
- PostgreSQL writes succeed immediately (fast)
- Blockchain writes eventual (seconds to minutes)
- Survives crashes and network failures
- Automatic retry with exponential backoff

### Event Synchronization (Blockchain → PostgreSQL)
```
NEAR Blockchain
  ↓ Emit event (contract event log)

Event Listener (Node.js worker)
  ↓ Poll NEAR RPC or subscribe to events
  ├─→ Check if event exists in PostgreSQL
  └─→ INSERT if missing

PostgreSQL
  ↓ Eventual consistency
```

**Benefits**:
- No indexer infrastructure (custom event listener)
- No NEAR Lake costs
- Bidirectional sync (PostgreSQL ↔ NEAR)
- Blockchain as source of truth for critical decisions

### Offline Sync for DDIL Environments
```
Edge Device (Jetson Orin Nano)
  ↓ Local SQLite database
  ↓ Queue operations when offline

When connectivity restored:
  ↓ HTTP sync API
  └─→ Central PostgreSQL

Background Worker
  ↓ Process edge operations
  ├─→ Write to PostgreSQL
  └─→ Write to blockchain via outbox (critical operations)
```

**Benefits**:
- Autonomous vehicles operate fully offline
- No data loss (all operations queued)
- Eventual consistency when connected
- Conflict resolution: timestamp-based Last-Write-Wins, blockchain as ultimate truth

## Data Classification

| Data Type | PostgreSQL | NEAR Blockchain | IPFS | Rationale |
|-----------|-----------|----------------|------|-----------|
| **Strategic objectives** | ✅ Searchable | ✅ Approval record | ✅ Full document | Need search + audit trail |
| **Operational plans** | ✅ Queryable | ✅ Version hash | ✅ Full plan | Complex queries + verification |
| **Mission orders** | ✅ Current state | ✅ Order + approval | ❌ | Real-time C2 + audit |
| **DAO votes** | ✅ Cache | ✅ Source of truth | ❌ | Blockchain authoritative |
| **Strike authorizations** | ✅ Cache | ✅ Immutable record | ❌ | Legal accountability |
| **Sensor telemetry** | ✅ Time-series | ❌ | ✅ Raw feeds | High volume, SQL queries |
| **Intelligence products** | ✅ Metadata | ✅ CID + provenance | ✅ Encrypted content | Fast search + verification |
| **Agent decisions** | ✅ Operational log | ✅ Audit trail | ❌ | Transparency + verification |
| **User sessions** | ✅ | ❌ | ❌ | Ephemeral, not critical |
| **Access control policies** | ✅ Cache | ✅ Smart contract | ❌ | Blockchain enforced |

## Technology Stack

- **PostgreSQL 16** with extensions: PostGIS, TimescaleDB, pg_trgm, pgvector, pg_partman
- **pgboss**: Background job queue for blockchain sync (PostgreSQL-native, no Kafka needed)
- **Transactional outbox pattern**: Reliability for dual-write
- **NEAR smart contracts**: Encrypted document registry, access control, DAO governance
- **IPFS (Pinata)**: Managed pinning service for large files
- **SQLite on edge**: Lightweight local storage for offline operations (Jetson Orin Nano)
- **PowerSync or ElectricSQL** (post-v1): Production-ready PostgreSQL↔SQLite sync for edge devices

## Conflict Resolution

- **Simple conflicts**: Timestamp-based Last-Write-Wins (LWW)
- **Critical decisions**: Blockchain is source of truth (DAO votes, strike authorizations)
- **Audit**: All conflicts logged to blockchain_events table
- **Commander review**: Significant conflicts flagged for human decision (Phase 3+)

## Data Retention

- **Operational data**: Retained in PostgreSQL for mission/event duration
- **Archival**: Mission-based partitioning (pg_partman)
  - Detach partition when mission completes
  - Export and encrypt partition
  - Upload to IPFS (Pinata)
  - Store IPFS CID on NEAR blockchain (provenance)
  - Drop PostgreSQL partition (reclaim space)
- **Verification**: Archive integrity verifiable via blockchain CID

## Advantages

✅ **No indexer costs**: Custom event listener instead of NEAR Lake or TheGraph
✅ **Fast queries**: PostgreSQL optimized for complex SQL operations
✅ **Blockchain verification**: Coalition partners can verify against immutable blockchain
✅ **Offline capability**: Autonomous vehicles operate in DDIL environments
✅ **Cost-effective**: Large files in IPFS, only CIDs and metadata on-chain
✅ **Scalable**: PostgreSQL scales horizontally with read replicas (post-v1)
✅ **Self-hosted**: Full control over infrastructure and security

## Trade-offs

⚠️ **Complexity**: Application manages dual-write logic
⚠️ **Eventual consistency**: Blockchain writes asynchronous (seconds to minutes lag)
⚠️ **Storage costs**: Pay for both PostgreSQL and blockchain (but only CIDs on-chain)
⚠️ **Operational overhead**: Need to monitor sync lag and retry queue

## Implementation Phases

### Phase 1 (Current)
- ✅ PostgreSQL deployment with extensions
- ✅ Dual-write pattern with transactional outbox
- ✅ pgboss background worker for blockchain sync
- ✅ SQLite on edge with HTTP sync API
- ✅ IPFS integration with encrypted CIDs in PostgreSQL and blockchain

### Phase 2 (Post-v1)
- PowerSync or ElectricSQL for production edge sync
- pgEdge Spock for multi-master replication
- High availability (Patroni) and connection pooling (PgBouncer)
- Advanced conflict resolution (CRDTs for specific use cases)

### Phase 3 (Scale)
- Debezium + Kafka for high-throughput CDC (if needed)
- Read replicas and query optimization
- Multi-region replication
- Automated archival workflow (pg_partman → IPFS)

## Alternatives Considered

### Option 1: Blockchain-only
- ❌ Too slow for complex queries
- ❌ Too expensive for large datasets
- ❌ Not practical for operational dashboards

### Option 2: NEAR Lake Indexer
- ❌ High infrastructure costs (self-hosted indexer)
- ❌ Operational complexity (manage indexer fleet)
- ✅ Official NEAR solution
- Decision: Custom event listener simpler for v1

### Option 3: TheGraph
- ❌ External dependency
- ❌ Ongoing costs
- ❌ Less control over infrastructure
- ✅ Production-ready indexing
- Decision: Self-hosted PostgreSQL preferred for defense deployment

### Option 4: PostgreSQL with full blockchain replication
- ❌ PostgreSQL becomes single point of failure
- ❌ Blockchain adds redundancy and verification
- Decision: Hybrid approach balances speed and verification

## Success Criteria

- [x] PROJECT.md updated with hybrid storage architecture
- [x] Plan 1-03A created for PostgreSQL infrastructure
- [x] Plan 1-03 updated to reference PostgreSQL dual-write
- [x] ROADMAP.md updated with data synchronization strategy
- [ ] PostgreSQL deployed with all extensions (during Plan 1-03A execution)
- [ ] Dual-write pattern functional (during Plan 1-03A execution)
- [ ] Offline edge sync tested in DDIL scenario (during Plan 1-03A execution)

## References

- [PROJECT.md](./../PROJECT.md) - Updated with hybrid storage requirements
- [Plan 1-03A-PLAN.md](./../phases/01-foundation-infrastructure/1-03A-PLAN.md) - PostgreSQL infrastructure implementation
- [Plan 1-03-PLAN.md](./../phases/01-foundation-infrastructure/1-03-PLAN.md) - IPFS storage with PostgreSQL integration
- [ROADMAP.md](./../ROADMAP.md) - Phase 1 updated with data sync strategy
- [postgresql-offline-sync-ddil-patterns.md](./../research/postgresql-offline-sync-ddil-patterns.md) - Research on offline sync patterns

## Approval

**Decided by**: User + Claude Code
**Date**: 2026-01-11
**Impact**: Foundation-wide (all phases use hybrid storage)
**Review**: Before production deployment (post-v1)

---

*This architectural decision is foundational and affects data storage, querying, and synchronization throughout the entire project.*

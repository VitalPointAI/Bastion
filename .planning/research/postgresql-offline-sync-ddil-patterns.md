# PostgreSQL Offline Synchronization and DDIL Environment Patterns

**Research Date:** 2026-01-11
**Purpose:** Identify PostgreSQL patterns for offline-first architecture, edge computing, and DDIL (Denied, Degraded, Intermittent, Limited) environments suitable for autonomous vehicles with blockchain integration.

---

## Executive Summary

This research identifies proven PostgreSQL patterns for offline synchronization and DDIL environments, focusing on autonomous vehicle fleet management with blockchain integration. Key findings:

1. **PowerSync and ElectricSQL** provide production-ready PostgreSQL↔SQLite sync for edge devices
2. **pgEdge Spock** enables multi-master replication with automated conflict resolution for distributed PostgreSQL
3. **Transactional Outbox Pattern** with Debezium/wal2json enables reliable CDC to blockchain
4. **Event Sourcing + CQRS** with PostgreSQL as event store aligns well with blockchain verification
5. **TimescaleDB + pg_partman** handles mission-based time-series data retention and archival
6. **IPFS integration** enables decentralized archival with PostgreSQL metadata

**Recommended Architecture:**
- **Edge devices:** SQLite with PowerSync/ElectricSQL for offline-first operation
- **Central database:** Self-hosted PostgreSQL with pglogical/Spock for multi-master replication
- **Blockchain sync:** Transactional outbox pattern with Debezium CDC to NEAR blockchain
- **Data retention:** TimescaleDB partitioning with IPFS archival for mission-based storage
- **Conflict resolution:** Timestamp-based LWW (Last-Write-Wins) with NEAR blockchain as source of truth for critical decisions

---

## 1. Offline-First Architecture Patterns

### 1.1 PostgreSQL ↔ SQLite Sync Solutions

#### **PowerSync** (Recommended for Production)

**Overview:** Postgres↔SQLite bi-directional sync layer enabling local-first architectures where SQLite on edge devices automatically syncs with PostgreSQL backend.

**Key Features:**
- Centralized master model: authoritative writes go to PostgreSQL, clients maintain local SQLite cache
- Real-time streaming of PostgreSQL changes to clients
- SDKs for Flutter, React Native, and Web (WASM SQLite in browsers)
- Production heritage: 10+ years in production at Fortune 500 companies

**Architecture:**
```
Edge Device (SQLite) ←→ PowerSync Service ←→ PostgreSQL (Central)
                              ↓
                         Kafka/Redis Queue
```

**Use Case Fit:**
- ✅ Excellent for autonomous vehicles: local SQLite for offline operation
- ✅ Proven at scale: tens of thousands of daily users
- ✅ Less invasive: works with existing PostgreSQL schemas
- ⚠️ Centralized sync service: requires PowerSync infrastructure

**Integration with Project:**
- Edge devices (Jetson Orin Nano) run SQLite locally
- PowerSync service syncs to central PostgreSQL
- PostgreSQL → NEAR blockchain via transactional outbox

**Sources:**
- [Introducing PowerSync v1.0: Postgres<>SQLite Sync Layer](https://www.powersync.com/blog/introducing-powersync-v1-0-postgres-sqlite-sync-layer)
- [PowerSync: Backend DB - SQLite sync engine](https://www.powersync.com/)

---

#### **ElectricSQL** (Alternative: More Decentralized)

**Overview:** Local-first sync layer providing bi-directional active-active replication with transactional causal+ consistency between cloud PostgreSQL and local SQLite.

**Key Features:**
- Uses PostgreSQL logical replication (native)
- Apps read/write directly to local embedded SQLite
- Writes trigger immediate reactivity, sync in background
- More decentralized architecture than PowerSync

**Architecture:**
```
Edge SQLite ←→ Electric Sync ←→ PostgreSQL (Logical Replication)
```

**Use Case Fit:**
- ✅ Active-active replication: better for multi-master scenarios
- ✅ Uses native PostgreSQL logical replication
- ⚠️ Less mature than PowerSync in production

**Integration with Project:**
- Could replace PowerSync for more decentralized architecture
- Better aligned with multi-master edge computing

**Sources:**
- [Local-first sync for Postgres from the inventors of CRDTs | ElectricSQL](https://electric-sql.com/blog/2023/09/20/introducing-electricsql-v0.6)
- [Show HN: ElectricSQL, Postgres to SQLite active-active sync for local-first apps](https://news.ycombinator.com/item?id=37584049)

---

### 1.2 Design Patterns for Offline-First

**Core Principle:**
> Offline-first design flips the architecture: the local device becomes the primary source of truth, and the network becomes a background optimization rather than a hard dependency.

**Key Patterns:**

1. **Local-First Data Model**
   - Local device is primary source of truth
   - Network is background optimization, not hard dependency
   - Apps remain fully functional offline

2. **Hub-and-Spoke Pattern** (for IoT/Edge)
   - Data generated and stored at edges
   - Central cluster aggregates data from edges
   - Common in IoT use cases and retail
   - **Perfect fit for autonomous vehicle fleet**

3. **Disconnected Operating Mode**
   - Predominant pattern: applications run independently
   - Occasional connectivity as exception, not norm
   - **Aligns with DDIL requirements**

4. **Store-and-Forward**
   - Data stored locally when connectivity unavailable
   - Forwarded when connectivity improves
   - Critical for DDIL environments

**Notion's Offline Implementation:**
- Uses SQLite to cache records locally
- Maintains "forest of offline page trees" tracking reasons for offline availability
- Pages can have multiple independent reasons for offline status
- Only removes pages when last reason disappears

**Sources:**
- [Offline-first frontend apps in 2025: IndexedDB and SQLite in the browser and beyond](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [How we made Notion available offline](https://www.notion.com/blog/how-we-made-notion-available-offline)
- [Edge Databases: Empowering Distributed Computing Environments](https://www.navicat.com/en/company/aboutus/blog/3331-edge-databases-empowering-distributed-computing-environments)

---

## 2. Conflict Resolution Strategies

### 2.1 Multi-Master Replication with Automated Conflict Resolution

#### **pgEdge Spock** (Recommended for Multi-Master PostgreSQL)

**Overview:** Asynchronous multi-master (active-active) replication extension for PostgreSQL with enhanced conflict resolution and conflict avoidance.

**Key Features:**
- Multi-master: multiple PostgreSQL nodes, each handles read/write traffic
- Timestamp-based conflict resolution (LWW - Last-Write-Wins)
- Conflict-free delta-apply for numeric fields
- All conflict resolutions logged to PostgreSQL table for audit
- Built for edge computing: small footprint, runs on Raspberry Pi
- Cloudflare Workers integration for edge platforms

**Conflict Resolution Mechanisms:**

1. **Timestamp-Based (Default):**
   - Last update wins based on commit timestamp
   - No data loss during updates
   - Guarantees database consistency
   - Requires `track_commit_timestamp` setting

2. **Delta-Apply for Numerics:**
   - Intelligent resolution for conflicting numeric changes
   - Maintains data consistency across nodes

3. **Conflict Audit Trail:**
   - All conflicts stored in PostgreSQL table
   - Central location for conflict visibility
   - Critical for accountability in military operations

**Edge Computing Integration:**
- Built-in integration with Cloudflare Workers, edge platforms
- Small footprint for factory floor, IoT devices
- Parallel workloads with data closer to users

**PostgreSQL Version Support:**
- Spock: PostgreSQL 15+ (active development)
- pglogical: PostgreSQL 9.4-17 (legacy, still maintained)

**Use Case Fit:**
- ✅ Excellent for distributed autonomous vehicle fleet
- ✅ Edge computing optimized (small footprint)
- ✅ Automated conflict resolution (reduces manual intervention)
- ✅ Conflict audit trail (critical for military accountability)
- ⚠️ Asynchronous: eventual consistency, not immediate

**Integration with Project:**
- Central PostgreSQL + edge PostgreSQL nodes (on vehicles or field operations centers)
- Spock handles multi-master replication and conflicts
- NEAR blockchain as ultimate source of truth for critical decisions

**Sources:**
- [GitHub - pgEdge/spock: Logical multi-master PostgreSQL replication](https://github.com/pgEdge/spock)
- [Multi-Master Distributed Postgres from pgEdge](https://www.pgedge.com/solutions/benefit/multi-master)
- [How to achieve multi-master replication in PostgreSQL with Spock](https://www.pgedge.com/blog/achieve-multiactive-data-replication-in-postgresql-with-spock)

---

### 2.2 Native PostgreSQL Logical Replication Conflicts

**Official PostgreSQL Behavior:**
- Logical replication conflicts **stop replication**
- Conflicts must be resolved manually by user
- Details logged in subscriber's server log

**Conflict Types:**
- INSERT conflicts (duplicate primary key)
- UPDATE conflicts (row modified on both sides)
- DELETE conflicts (row deleted on one side, updated on other)

**Manual Resolution Required:**
- No automated resolution in native PostgreSQL
- DBA must fix conflicting rows
- Replication resumes after manual fix

**Recommendation:** Use pglogical/Spock for automated conflict resolution instead of native logical replication for multi-master scenarios.

**Sources:**
- [PostgreSQL: Documentation: 18: 29.7. Conflicts](https://www.postgresql.org/docs/current/logical-replication-conflicts.html)
- [Replication conflicts in PostgreSQL and how to deal with them](https://www.cybertec-postgresql.com/en/streaming-replication-conflicts-in-postgresql/)

---

## 3. Event Sourcing and CQRS Patterns

### 3.1 PostgreSQL as Event Store

**Viability:** PostgreSQL is suitable for event sourcing, despite specialized databases being marketed as preferred solution.

**PostgreSQL + Kafka Pattern:**
- PostgreSQL stores event stream (write model)
- Kafka distributes events to read projections
- Good alternative when EventStoreDB restricted

**Event Sourcing Fundamentals:**
- Event stream is write model and primary source of truth
- Read model is "denormalized" view of write model
- Enables faster, more convenient querying
- CQRS usually used in conjunction with event sourcing

**CQRS Pattern:**
- Write model: Event stream in PostgreSQL
- Read model: Denormalized views (PostgreSQL, MongoDB, ElasticSearch)
- Separation enables independent scaling and optimization

**Blockchain Alignment:**
> "CQRS combined with Event Sourcing is one of the most exciting architectural patterns used in building blockchain-based applications. Event Sourcing provides transparency, auditability, and the ability to reconstruct the application's state at any point in time, which aligns well with blockchain principles."

**Use Case Fit:**
- ✅ Excellent alignment with NEAR blockchain verification
- ✅ Event stream provides audit trail
- ✅ Reconstruction capability critical for military operations
- ✅ Transparency and auditability match blockchain principles

**Integration with Project:**
- PostgreSQL event store for all system events
- NEAR blockchain stores critical decision events (strike authorization, target selection)
- Read models: PostgreSQL (dashboards), ElasticSearch (full-text search)

**Implementation Stacks:**
- Go + PostgreSQL + Kafka + MongoDB/ElasticSearch
- Kotlin + Spring Reactive + PostgreSQL + Kafka + MongoDB
- TypeScript + Node.js + PostgreSQL + Kafka (best fit for project)

**Sources:**
- [GitHub - eugene-khyst/postgresql-event-sourcing](https://github.com/eugene-khyst/postgresql-event-sourcing)
- [Go EventSourcing and CQRS with PostgreSQL, Kafka, MongoDB and ElasticSearch](https://dev.to/aleksk1ng/go-eventsourcing-and-cqrs-with-postgresql-kafka-mongodb-and-elasticsearch-44d7)
- [Implementing event sourcing using a relational database | SoftwareMill](https://softwaremill.com/implementing-event-sourcing-using-a-relational-database/)

---

### 3.2 Transactional Outbox Pattern

**Problem:** Dual-write problem when writing to database + message broker (Kafka/NEAR blockchain)

**Solution:** Transactional outbox pattern
- Store messages in database as part of transaction updating business entities
- Separate process sends messages to message broker
- Atomicity guaranteed by database transaction

**Implementation Approaches:**

#### **1. Polling-Publisher Pattern**
- Polling listener queries outbox table on short interval
- When unprocessed messages found, send to broker
- Simple but less efficient

#### **2. Transaction Log Tailing (Recommended)**
- Read from PostgreSQL Write-Ahead Log (WAL)
- PostgreSQL logical replication captures outbox changes
- Use LSN (Log Sequence Number) for sequencing

**PostgreSQL + Debezium + Kafka:**
```
PostgreSQL → WAL → Debezium → Kafka → NEAR Blockchain
             ↓
        Outbox Table
```

**Workflow:**
1. Application writes data + outbox entry in single transaction
2. Debezium captures WAL changes from outbox table
3. Debezium publishes to Kafka
4. Kafka consumer writes to NEAR blockchain
5. LSN used for sequencing and idempotency

**Delivery Guarantee:** At-least-once
- Every message in outbox eventually arrives in Kafka
- May arrive more than once (idempotency required)

**Use Case Fit:**
- ✅ Solves dual-write problem (PostgreSQL + NEAR blockchain)
- ✅ Atomic writes guaranteed
- ✅ LSN-based sequencing
- ✅ Proven pattern in production

**Integration with Project:**
- PostgreSQL outbox table for blockchain writes
- Debezium captures changes
- Kafka (or direct integration) to NEAR blockchain
- Idempotent blockchain writes using LSN/nonce

**Sources:**
- [Revisiting the Outbox Pattern](https://www.decodable.co/blog/revisiting-the-outbox-pattern)
- [Microservices Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Push-based Outbox Pattern with Postgres Logical Replication](https://event-driven.io/en/push_based_outbox_pattern_with_postgres_logical_replication/)

---

## 4. Logical Replication

### 4.1 PostgreSQL Native Logical Replication

**Overview:** Built-in PostgreSQL feature for selective, table-level replication using logical decoding of WAL.

**Key Features:**
- Table-level selective replication
- Cross-version replication (PostgreSQL 10+)
- Asynchronous by default, supports synchronous mode
- No automatic conflict resolution (manual intervention required)

**Replication Slots:**
- Ensures master retains WAL files until replicas confirm replication
- Prevents WAL deletion for disconnected replicas
- Critical for DDIL environments with intermittent connectivity

**Synchronization Modes:**
- **Asynchronous (default):** No wait for replica confirmation
- **Synchronous:** Commits wait for replica to flush to durable storage

**Use Case Fit:**
- ✅ Native PostgreSQL feature (no extensions required)
- ✅ Replication slots prevent data loss during disconnection
- ⚠️ No automated conflict resolution (manual intervention)
- ⚠️ Not suitable for multi-master without pglogical/Spock

**Integration with Project:**
- Primary → standby replication for HA
- Use pglogical/Spock for multi-master instead

**Sources:**
- [PostgreSQL: Documentation: 18: Chapter 29. Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [Working with PostgreSQL Replication Slots: Simplified Guide](https://hevodata.com/learn/postgresql-replication-slots/)

---

### 4.2 pglogical (Cross-Version, Multi-Master)

**Overview:** Logical replication extension for PostgreSQL 9.4-17 providing faster replication and multi-master capabilities.

**Key Features:**
- Publish-subscribe model
- Selective table/database replication
- Cascading replication
- Custom conflict resolution logic
- Hooks for external system integration
- Faster than Slony, Bucardo, Londiste

**Use Case Fit:**
- ✅ Proven, mature solution (2ndQuadrant)
- ✅ Wide PostgreSQL version support
- ✅ Flexible replication topologies
- ⚠️ Superseded by Spock for PostgreSQL 15+ (use Spock for new deployments)

**Integration with Project:**
- Use Spock instead for PostgreSQL 15+
- pglogical as fallback for older PostgreSQL versions

**Sources:**
- [GitHub - 2ndQuadrant/pglogical](https://github.com/2ndQuadrant/pglogical)
- [pglogical Rediscovered: A Fresh Approach to Logical Replication](https://www.pgedge.com/blog/pglogical-rediscovered-a-fresh-approach-to-logical-replication-for-ultra-high-availability)

---

## 5. Write-Ahead Log (WAL) Shipping

### 5.1 WAL Fundamentals

**What is WAL:**
- Standard method for ensuring data integrity
- Changes logged before data files modified
- Changes to data files written only after logged

**Log-Shipping Standby Servers:**
- WAL files used to apply same changes to another database
- Part of backup solution with base backup
- **Streaming replication:** WAL transferred to standby in real-time

**Use Cases:**
- High availability (failover to standby)
- Point-in-time recovery (PITR)
- Backup and disaster recovery

**Synchronization Modes:**
- **Asynchronous:** No wait for standby confirmation
- **Synchronous:** Wait for standby to flush to durable storage

**Use Case Fit:**
- ✅ Foundation for logical replication and CDC
- ✅ Critical for HA and disaster recovery
- ⚠️ Physical replication (entire database), not selective
- ⚠️ Better to use logical replication for selective sync

**Integration with Project:**
- WAL used by logical replication (pglogical/Spock)
- WAL used by Debezium for CDC to blockchain

**Sources:**
- [PostgreSQL: Documentation: 18: 28.3. Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html)
- [PostgreSQL: Documentation: 18: 26.2. Log-Shipping Standby Servers](https://www.postgresql.org/docs/current/warm-standby.html)
- [Understanding PostgreSQL Write-Ahead Logging (WAL)](https://www.postgresql.fastware.com/blog/understanding-postgresql-write-ahead-logging-wal)

---

### 5.2 WAL for Offline Sync

**DDIL Application:**
- WAL files can be stored during disconnection
- Replayed when connectivity restored
- Provides complete change history

**Challenges:**
- WAL accumulation during long disconnections
- Storage constraints on edge devices
- Network bandwidth for WAL transfer

**Recommendation:** Use logical replication with replication slots instead of physical WAL shipping for selective, efficient sync.

---

## 6. CRDTs (Conflict-Free Replicated Data Types)

### 6.1 PostgreSQL CRDT Extensions

#### **EDB Postgres Distributed (PGD)** (Production-Ready)

**Overview:** Enterprise PostgreSQL distribution with native CRDT support for distributed deployments.

**CRDT Types (6 Available):**

**Operation-Based:**
1. `crdt_delta_counter` - bigint counter (increments/decrements)
2. `crdt_delta_sum` - numeric sum (increments/decrements)

**State-Based:**
3. `crdt_gcounter` - Grow-only counter
4. Additional state-based types (4 total state-based)

**Implementation:**
- Each CRDT type is separate PostgreSQL data type
- Callbacks registered in `bdr.crdt_handlers` catalog
- Operation-based types compute operations from old/new row

**Use Case Fit:**
- ✅ Production-ready, enterprise-grade
- ⚠️ Enterprise license (EDB commercial product)
- ⚠️ Limited CRDT types (6 total)
- ⚠️ May be overkill for project needs

**Integration with Project:**
- Consider for specific use cases (counters, sums)
- Not required for LWW timestamp-based conflict resolution

**Sources:**
- [EDB Docs - EDB Postgres Distributed (PGD) v5.7 - Conflict-free replicated data types](https://www.enterprisedb.com/docs/pgd/latest/conflict-management/crdt/)
- [CRDTs with PostgreSQL: Guide for Distributed Systems](https://minervadb.xyz/conflict-free-replicated-data-types-postgresql/)

---

#### **Supabase pg_crdt** (Experimental)

**Overview:** Experimental extension adding CRDT support to Postgres.

**Status:** Experimental (not production-ready)

**Use Case Fit:**
- ⚠️ Experimental, not recommended for production
- ⚠️ Consider for future exploration

**Sources:**
- [GitHub - supabase/pg_crdt: CRDT support in Postgres (experimental)](https://github.com/supabase/pg_crdt)

---

### 6.2 Application-Layer CRDTs

**Alternative Approach:**
- Implement CRDT logic in application layer
- PostgreSQL stores CRDT state or operations
- Custom stored procedures for CRDT operations

**When to Use:**
- Need specific CRDT types not available in extensions
- Want full control over CRDT semantics
- Avoid vendor lock-in

**Use Case Fit:**
- ✅ Flexible, custom CRDT implementations
- ⚠️ More complex to implement and maintain

**Recommendation:** Use timestamp-based LWW conflict resolution for simplicity; reserve CRDTs for specific use cases (counters, sets) if needed.

---

## 7. Queue-Based Sync Patterns

### 7.1 PostgreSQL-Based Message Queues

#### **pgboss** (Node.js Job Queue)

**Overview:** Job queue built on PostgreSQL using SKIP LOCKED for exactly-once delivery.

**Key Features:**
- Exactly-once delivery guarantee
- Guaranteed atomic commits
- Asynchronous job processing
- Background processing

**Use Case Fit:**
- ✅ Excellent for Node.js backend (project uses Node.js)
- ✅ PostgreSQL-native (no additional infrastructure)
- ✅ Atomic commits for reliability

**Integration with Project:**
- Use for background jobs (data sync, blockchain writes)
- Alternative to Kafka for simpler deployments

**Sources:**
- [GitHub - timgit/pg-boss: Queueing jobs in Postgres from Node.js like a boss](https://github.com/timgit/pg-boss)
- [Using Postgres as a Message Queue - JVM Advent](https://www.javaadvent.com/2022/12/using-postgres-as-a-message-queue.html)

---

#### **PGMQ (PostgreSQL Message Queue)**

**Overview:** Lightweight message queue similar to AWS SQS/RSMQ built on PostgreSQL.

**Key Features:**
- SKIP LOCKED for queue semantics
- Persistent messages
- LISTEN/NOTIFY integration
- Lightweight, PostgreSQL-native

**Use Case Fit:**
- ✅ Simpler than Kafka for single-node deployments
- ✅ PostgreSQL-native (no additional infrastructure)

**Integration with Project:**
- Consider for lightweight message queuing
- Alternative to Kafka for simpler scenarios

**Sources:**
- [GitHub - pgmq/pgmq: A lightweight message queue. Like AWS SQS and RSMQ but on Postgres](https://github.com/pgmq/pgmq)
- [Set Up a Message Queue with Postgres, PGMQ, and Docker](https://userjot.com/blog/using-postgres-docker-pgmq-message-queue)

---

### 7.2 PostgreSQL LISTEN/NOTIFY

**Overview:** Simple interprocess communication for processes accessing same PostgreSQL database.

**Key Features:**
- Asynchronous notifications
- Payload strings (up to 8000 bytes)
- Pub/sub semantics (similar to Redis pub/sub)
- UDP-like behavior (no persistence if no listeners)

**Queue Pattern:**
- Create queue table with triggers
- INSERT triggers NOTIFY
- Listeners receive asynchronous notifications
- SKIP LOCKED for job dequeue

**Use Case Fit:**
- ✅ Simple pub/sub for real-time updates
- ⚠️ No persistence if no listeners (unlike queues)
- ⚠️ Limited to single PostgreSQL instance

**Integration with Project:**
- Use for real-time dashboard updates
- Not suitable for reliable job processing (use pgboss/PGMQ)

**Sources:**
- [PostgreSQL: Documentation: 18: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [GitHub - oliverlambson/pgmq: Postgres message queue with persistent messages using LISTEN/NOTIFY](https://github.com/oliverlambson/pgmq)

---

### 7.3 Redis vs PostgreSQL for Queues

**Comparison:**

| Feature | Redis | PostgreSQL |
|---------|-------|------------|
| Persistence | Optional (RDB/AOF) | Native (WAL) |
| Exactly-once | No (at-least-once) | Yes (SKIP LOCKED) |
| Atomic commits | No | Yes (transactions) |
| Infrastructure | Separate service | Existing database |
| Performance | Faster (in-memory) | Slower (disk-based) |

**When to Use PostgreSQL:**
- Already using PostgreSQL
- Need exactly-once delivery
- Need atomic commits with database operations
- Simplify infrastructure (avoid additional service)

**When to Use Redis:**
- Need high throughput (millions/sec)
- Need pub/sub with many subscribers
- Caching + queuing in one service

**Recommendation:** Use PostgreSQL-based queues (pgboss/PGMQ) for simplicity; use Kafka/Redis only if performance requires.

**Sources:**
- [Using PostgreSQL as a Message Broker | Baeldung](https://www.baeldung.com/spring-postgresql-message-broker)

---

## 8. SQLite → PostgreSQL Sync

### 8.1 Edge Device Architecture

**Pattern:** SQLite on edge device → Sync service → PostgreSQL central

**Edge Device (Autonomous Vehicle):**
- SQLite embedded database
- Local AI inference (Jetson Orin Nano)
- Offline-first operation
- Queue sync operations when disconnected

**Sync Service Options:**

1. **PowerSync** (Recommended)
   - Production-ready, proven at scale
   - Real-time sync
   - Bi-directional
   - SDKs for multiple platforms

2. **ElectricSQL**
   - More decentralized
   - Active-active replication
   - PostgreSQL logical replication

**Central Database (PostgreSQL):**
- Aggregates data from all edge devices
- Serves dashboards, analytics
- Writes critical events to NEAR blockchain

**Use Case Fit:**
- ✅ Perfect for autonomous vehicle fleet
- ✅ Offline-first operation (DDIL support)
- ✅ Real-time sync when connected
- ✅ Proven in production

**Integration with Project:**
```
Jetson Orin Nano (SQLite) → PowerSync → PostgreSQL → Debezium → NEAR Blockchain
         ↓                                    ↓                        ↓
   Local AI Models                    Operational Dashboards    Audit Trail
```

**Sources:**
- [Introducing PowerSync v1.0: Postgres<>SQLite Sync Layer](https://www.powersync.com/blog/introducing-powersync-v1-0-postgres-sqlite-sync-layer)
- [Sync Postgres with SQLite](https://www.powersync.com/sync-postgres)

---

### 8.2 Data Normalization and Harmonization

**Challenge:** Autonomous vehicles from multiple manufacturers produce different data formats.

**Solution:**
- Common schema in PostgreSQL
- Normalization layer in sync service
- Data cleaning and transformation

**Critical for Multi-Manufacturer Fleets:**
> "When an AV fleet includes vehicles from multiple manufacturers, normalization, harmonization, and synchronization of data becomes even more essential, risking making the fleet nearly inoperable without it."

**Use Case Fit:**
- ✅ Critical for coalition operations (multi-national equipment)
- ✅ Data normalization in sync layer
- ✅ Common schema for operational picture

**Sources:**
- [DataOps for autonomous vehicle operations - Microsoft](https://learn.microsoft.com/en-us/industry/mobility/architecture/autonomous-vehicle-operations-dataops-content)

---

## 9. Replication Slots and pglogical

### 9.1 Replication Slots

**Purpose:** Ensure master retains WAL files until all subscribers confirm replication.

**Key Features:**
- Persistent stream of changes
- Prevents WAL deletion for disconnected replicas
- Critical for DDIL environments
- LSN (Log Sequence Number) tracking

**Use Case Fit:**
- ✅ Essential for intermittent connectivity (DDIL)
- ✅ Prevents data loss during disconnection
- ✅ Required for logical replication

**Best Practices:**
- Monitor replication lag
- Prevent WAL bloat from inactive slots
- Clean up unused slots

**Integration with Project:**
- Replication slots for each edge PostgreSQL node
- Monitor slot lag for operational awareness

**Sources:**
- [Working with PostgreSQL Replication Slots: Simplified Guide](https://hevodata.com/learn/postgresql-replication-slots/)
- [Mastering Postgres Replication Slots: Preventing WAL Bloat](https://www.morling.dev/blog/mastering-postgres-replication-slots/)

---

### 9.2 pglogical for Multi-Master

**Overview:** Covered in Section 4.2 and 2.1.

**Recommendation:** Use **pgEdge Spock** for PostgreSQL 15+ instead of pglogical.

---

## 10. Change Data Capture (CDC) to Blockchain

### 10.1 Debezium for PostgreSQL CDC

**Overview:** Open-source CDC platform capturing row-level changes from PostgreSQL.

**Key Features:**
- Low latency data streaming
- Captures every row-level change
- Uses PostgreSQL logical decoding (WAL)
- Publishes to Kafka

**Logical Decoding Plugins:**
- `pgoutput` (native PostgreSQL 10+, recommended)
- `wal2json` (JSON output format)
- `wal2json_rds`, `wal2json_streaming` (AWS RDS)
- `decoderbufs` (Protocol Buffers format)

**Architecture:**
```
PostgreSQL → WAL → Debezium (Logical Decoding) → Kafka → Consumer → NEAR Blockchain
```

**Use Cases:**
- Event-driven architectures
- Microservices communication
- Near real-time sync between databases
- ETL pipelines

**Use Case Fit:**
- ✅ Industry-standard CDC solution
- ✅ Real-time change capture
- ✅ Kafka integration for reliable delivery
- ⚠️ Requires Kafka infrastructure

**Integration with Project:**
- Debezium captures PostgreSQL changes
- Kafka topics for different event types
- Consumer writes to NEAR blockchain
- Idempotent writes using LSN

**Sources:**
- [Debezium connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [Track every PostgreSQL data change using Debezium](https://dev.to/emtiajium/track-every-postgresql-data-change-using-debezium-5e19)
- [Change Data Capture Architecture Using Debezium, Postgres, and Kafka](https://dzone.com/articles/change-data-capture-architecture-using-debezium-po)

---

### 10.2 Debezium Server (No Kafka)

**Overview:** Standalone Debezium without Kafka dependency.

**Key Features:**
- Debezium Server runs as standalone process
- Sinks directly to various targets (HTTP, Redis, Kinesis, etc.)
- Simpler deployment (no Kafka cluster)

**Use Case Fit:**
- ✅ Simpler than Kafka for single-consumer scenarios
- ✅ Direct sink to NEAR blockchain (via HTTP webhook)
- ⚠️ Less reliable than Kafka for at-least-once delivery

**Integration with Project:**
- Consider for simpler deployments without Kafka
- Direct HTTP webhook to NEAR blockchain indexer

**Sources:**
- [Change Data Capture (CDC) with Debezium Server (No Kafka)](https://dev.to/maqboolthoufeeq/change-data-capture-cdc-with-debezium-server-no-kafka-django-postgres-mongodb-example-m0h)

---

### 10.3 wal2json Plugin

**Overview:** PostgreSQL logical decoding plugin outputting changes as JSON.

**Key Features:**
- JSON output format (easy to parse)
- Supports filtering (tables, columns)
- Includes transaction metadata

**When to Use:**
- Custom CDC implementation (not using Debezium)
- Need JSON format for processing
- Simpler than Protocol Buffers

**Use Case Fit:**
- ⚠️ Lower-level than Debezium
- ⚠️ Requires custom consumer implementation
- ✅ More control over CDC logic

**Recommendation:** Use Debezium with `pgoutput` plugin instead for production-ready solution.

---

### 10.4 Blockchain Integration Pattern

**No Direct Examples Found:**
Research found extensive Debezium/CDC documentation but **no specific examples of CDC to blockchain integration**.

**Recommended Pattern:**
```
PostgreSQL → Debezium → Kafka → Custom Consumer → NEAR Blockchain
                                         ↓
                                 Idempotency Check
                                 (using LSN as nonce)
```

**Implementation Steps:**

1. **Debezium Captures Changes:**
   - Configure Debezium for PostgreSQL
   - Use `pgoutput` plugin (native)
   - Capture relevant tables (events, decisions, targets)

2. **Kafka Topics:**
   - `events.strategic` - Strategic planning events
   - `events.operational` - Operational planning events
   - `events.tactical` - Tactical execution events
   - `events.critical` - Strike authorization, critical decisions

3. **Consumer to NEAR:**
   - Kafka consumer reads events
   - Transforms to NEAR blockchain format
   - Idempotency check using LSN
   - Writes to NEAR smart contract
   - Handles failures with retry queue

4. **Idempotency:**
   - Use PostgreSQL LSN as unique identifier
   - NEAR smart contract stores processed LSNs
   - Skip duplicate writes

**Alternative: Transactional Outbox (Recommended):**
- Simpler than full Debezium setup
- Outbox table in PostgreSQL
- Debezium captures outbox changes only
- Consumer writes to NEAR blockchain

**Sources:**
- [Enabling CDC with the Fully Managed Debezium PostgreSQL Connector](https://www.confluent.io/blog/cdc-and-data-streaming-capture-database-changes-in-real-time-with-debezium/)

---

## 11. DDIL Environment Patterns

### 11.1 Military DDIL Context

**DDIL Definition:**
- **D**enied
- **D**isrupted / **D**egraded
- **I**ntermittent
- **L**imited / **L**ow-bandwidth

**Characteristics:**
- Unreliable, unpredictable, or completely unavailable internet
- High latency, low bandwidth
- Regular disconnects for substantial periods
- Prevalent at tactical edge

**Impact on Military Operations:**
- Limits real-time communications
- Restricts data transfer
- Complicates coordination across units/systems
- Affects intelligence accuracy and timeliness
- Hinders decision-making and situational awareness
- Makes cloud-based applications difficult

**Use Case Fit:**
- ✅ Core requirement for project (autonomous vehicles in contested environments)
- ✅ Offline-first architecture addresses DDIL
- ✅ Store-and-forward for eventual delivery

**Sources:**
- [Achieving Uninterrupted Defense Processes in DDIL Environments](https://appian.com/blog/2024/operating-in-dod-ddil-environments)
- [DDIL: How DOD Seeks to Operate in Low Bandwidth Environments](https://www.executivebiz.com/articles/ddil-dod-cyber-cloud-cjadc2-low-bandwidth)
- [DDIL Environments: Managing Cloud Edge Computing for Defense Agencies](https://fedtechmagazine.com/article/2025/03/ddil-environments-managing-cloud-edge-computing-defense-agencies-perfcon)

---

### 11.2 Edge Computing Solutions for DDIL

**Core Principle:**
> "Edge computing processes data closer to the source ('on the edge') which reduces the need to send large amounts of data over constrained networks."

**Key Strategies:**

1. **Local Processing (Edge Computing):**
   - AI inference on Jetson Orin Nano
   - Data processing at tactical edge
   - Reduces network dependency

2. **Store-and-Forward:**
   - Data stored locally during disconnection
   - Forwarded when connectivity improves
   - Ensures critical information eventually transmitted

3. **Hybrid Capabilities:**
   - Full features when cloud connected
   - Degraded but functional when offline
   - Seamless transition between modes

4. **Disruption-Tolerant Networking (DTN):**
   - Protocols adapt to varying network conditions
   - Software-Defined Networks (SDN)
   - Maintain data flow in DDIL

5. **Autonomous Local Operation:**
   - Systems function independently
   - Decision-making at edge
   - Sync state when connected

**DoD Organizational Response:**
- DoD CIO designated Department of Navy CIO as executive agent (2021)
- Cross-service joint working group focused on DDIL
- CJADC2 (Joint All-Domain Command and Control) requires DDIL capability

**Use Case Fit:**
- ✅ All strategies directly applicable to project
- ✅ Edge AI on Jetson (local processing)
- ✅ Store-and-forward with PowerSync/ElectricSQL
- ✅ Hybrid capabilities (full when connected, degraded when offline)

**Integration with Project:**
```
Tactical Edge (DDIL Environment)
    ↓
Jetson Orin Nano (SQLite, Local AI)
    ↓ (Intermittent Connectivity)
PowerSync/ElectricSQL (Store-and-Forward)
    ↓ (When Connected)
Central PostgreSQL → NEAR Blockchain
```

**Sources:**
- [Marines aim to solve the DDIL challenge](https://federalnewsnetwork.com/reporters-notebook-jason-miller/2022/06/marines-aim-to-solve-the-ddil-challenge/)
- [A 2026 Guide to DDIL Environments | Strata.io](https://www.strata.io/blog/identity-continuity/ddil-resilient-identity-continuity/)

---

### 11.3 Autonomous Vehicle Offline Capabilities

**Production Examples:**

1. **Automatic Commands:**
   - "Return to charge" when battery low
   - "Return to home" when internet disconnects
   - Mission continuation without connectivity

2. **Local Mission Storage:**
   - Missions saved locally on vehicle
   - Executable from on-vehicle touchscreen
   - No cloud dependency for execution

3. **Offline Intelligence:**
   - Strong eventual consistency for replicas
   - CRDTs for offline data structures
   - Local decision-making with AI

**Fleet Management Considerations:**
- Data normalization across manufacturers
- Common schema for interoperability
- Centralized fleet management system (when connected)
- Distributed operation (when disconnected)

**Use Case Fit:**
- ✅ Sphero RVR+ with Jetson demonstrates offline capability
- ✅ Local mission execution without cloud
- ✅ Automatic fallback behaviors

**Integration with Project:**
- Mission plans stored locally on Jetson
- Autonomous execution without connectivity
- Sync mission status when connected

**Sources:**
- [Autonomous Fleet Management: The Future of Fleet Operations](https://www.epikafleet.com/blog/autonomous-fleet-management/)
- [Autonomous Vehicle Fleet Management System (FMS) | Cyngn Insight](https://www.cyngn.com/solutions/insight)

---

## 12. Mission-Based Data Retention and IPFS Archival

### 12.1 PostgreSQL Data Retention Strategies

**Core Strategies:**

1. **Partitioning:**
   - Time-based partitioning (PostgreSQL 10+ declarative partitioning)
   - Break large tables into manageable partitions
   - Easy partition detachment for archival

2. **Compression:**
   - Reduce storage footprint
   - TimescaleDB compression for time-series

3. **Archival:**
   - Move old data to cheaper storage
   - IPFS for decentralized archival

**pg_partman Extension:**
- Automates partition creation
- Time-based and serial-based partitioning
- Retention policies for automatic detachment/drop
- Critical for mission-based retention

**Use Case Fit:**
- ✅ Perfect for mission-based retention (partition per mission)
- ✅ Automatic archival after mission completion
- ✅ TimescaleDB for sensor time-series data

**Integration with Project:**
```
PostgreSQL Partition (Active Mission)
    ↓ (Mission Complete)
Detach Partition
    ↓
Export to IPFS (pg_dump or COPY)
    ↓
Store CID on NEAR Blockchain
    ↓
Drop Partition (data archived)
```

**Sources:**
- [Data archiving and retention in PostgreSQL. Best practices for large datasets](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)
- [Auto-archiving and Data Retention Management in Postgres with pg_partman](https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman)

---

### 12.2 TimescaleDB for Time-Series Data

**Overview:** PostgreSQL extension optimized for time-series data.

**Key Features:**
- Automatic partitioning (hypertables)
- Compression (10x-100x storage reduction)
- Retention policies (automatic data deletion/archival)
- Continuous aggregates (materialized views)
- Time-series functions (gap filling, LOCF, interpolation)

**Use Case Fit:**
- ✅ Excellent for sensor data from autonomous vehicles
- ✅ Automatic retention policies
- ✅ Compression reduces storage costs
- ✅ Fast time-series queries

**Integration with Project:**
- Sensor data (camera, LIDAR, GPS, IMU) in TimescaleDB hypertables
- Continuous aggregates for dashboards
- Retention policy: archive to IPFS after mission completion
- Compression for older data

**Sources:**
- [PostgreSQL with TimescaleDB: Managing Retention Policies and Archival Data](https://www.slingacademy.com/article/postgresql-with-timescaledb-managing-retention-policies-and-archival-data/)

---

### 12.3 IPFS Integration with PostgreSQL

**Current State:**
- **Limited direct integration** between PostgreSQL archival and IPFS
- Most integration is manual or custom

**Available Tools:**

1. **ipfs-ds-postgres:**
   - PostgreSQL datastore for IPFS
   - Allows IPFS to use PostgreSQL as backend for storing IPFS blocks
   - **Not for archiving PostgreSQL data to IPFS**

2. **Manual Export Pattern:**
   ```bash
   # Export partition to file
   pg_dump -t mission_001_data > mission_001.sql

   # Add to IPFS
   ipfs add mission_001.sql
   # Returns CID: QmXxx...

   # Store CID in PostgreSQL metadata table
   INSERT INTO archived_missions (mission_id, ipfs_cid, archived_at)
   VALUES ('001', 'QmXxx...', NOW());

   # Store CID on NEAR blockchain for provenance
   ```

3. **SQLite + IPFS Pattern:**
   - Export partition to SQLite file
   - Add SQLite file to IPFS
   - Participants can retrieve SQLite file from IPFS
   - Import to PostgreSQL using pgloader if needed

**IPFS as Archival Storage:**
> "The Interplanetary File System (IPFS) provides a tailor-made solution to maintaining historical records that remain publicly accessible. IPFS storage and IPFS gateways provide both the archival and the retrieval layer to ensure preservation of important data."

**Archival Workflow:**
```
1. Mission completes
2. Detach PostgreSQL partition
3. Export partition data (pg_dump, COPY, or SQLite)
4. Encrypt data (client-side, classification-based)
5. Add to IPFS (returns CID)
6. Store CID in PostgreSQL metadata table
7. Store CID on NEAR blockchain (immutable provenance)
8. Drop partition from PostgreSQL (optional, to save space)
9. Data retrievable from IPFS using CID
```

**Use Case Fit:**
- ✅ Decentralized archival (no single point of failure)
- ✅ Content addressing (tamper-proof)
- ✅ Client-side encryption (classification support)
- ✅ NEAR blockchain stores CIDs (provenance)
- ✅ Pinata for reliable IPFS pinning

**Integration with Project:**
- Mission data archived to IPFS after completion
- Encrypted before upload (classification-based)
- CIDs stored on NEAR blockchain
- Metadata in PostgreSQL for fast queries
- Retrieval via IPFS gateways (Pinata)

**Sources:**
- [IPFS As An Archival Storage Solution](https://pinata.cloud/blog/ipfs-as-an-archival-storage-solution/)
- [GitHub - alanshaw/ipfs-ds-postgres: PostgreSQL datastore for IPFS](https://github.com/alanshaw/ipfs-ds-postgres)
- [PostgreSQL: Anzacathon, PostgreSQL and IPFS](https://www.postgresql.org/message-id/e4c9a6e1-5bef-51bd-0d87-a44c48b35c8a@pocock.pro)

---

## 13. Self-Hosted PostgreSQL for High Availability

### 13.1 Bare Metal Deployment

**Cloudflare Example:**
- Runs distributed PostgreSQL on bare metal infrastructure
- Rack-mounted servers with high-bandwidth network cards
- Maximum flexibility for SSD RAID configuration
- Open-source cluster management

**pgEdge Platform:**
- Self-managed bare metal or virtual machines
- Enterprise-ready Postgres distribution
- Multi-master capabilities
- Low-latency, high availability

**Use Case Fit:**
- ✅ Self-hosted deployment (project requirement)
- ✅ Full control over hardware and configuration
- ✅ No managed cloud service dependencies

**Integration with Project:**
- Self-hosted PostgreSQL on bare metal or VMs
- pgEdge for multi-master replication
- Full control over security and configuration

**Sources:**
- [Relational Data at the Edge: How Cloudflare Operates Distributed PostgreSQL Clusters](https://www.infoq.com/articles/cloudflare-distributed-postgres/)
- [Self-managed bare metal or virtual machines](https://www.pgedge.com/products/self-managed-vm)

---

### 13.2 Kubernetes-Based High Availability

**Zalando Postgres Operator:**
- Patroni-managed automatic failover
- Read replicas for load balancing
- Single-region HA
- Can be paired with Spock for multi-region

**Bare Metal Kubernetes:**
- `enableMasterLoadBalancer` for external IPs on bare metal
- Node private IPs as externally accessible addresses

**Use Case Fit:**
- ✅ Kubernetes orchestration (project uses containers)
- ✅ Automatic failover
- ⚠️ Additional complexity (Kubernetes management)

**Integration with Project:**
- Consider for production deployment
- Kubernetes orchestration for all components
- PostgreSQL operator for HA

**Sources:**
- [Self-hosting a high-availability Postgres cluster on Kubernetes](https://ryan-schachte.com/blog/ha_postgres_zolando/)

---

### 13.3 High Availability Patterns

**Replication for HA:**
- Primary-standby replication
- Automatic failover (Patroni)
- Load balancing across read replicas

**Multi-Master for HA:**
- Active-active replication (pgEdge Spock)
- Four or five nines availability
- Write-anywhere, read-anywhere
- Built-in disaster recovery

**Use Case Fit:**
- ✅ Multi-master provides highest availability
- ✅ Critical for military operations (no single point of failure)
- ✅ pgEdge Spock recommended

**Integration with Project:**
- Primary PostgreSQL + standby (Patroni failover)
- Multi-master replication for edge PostgreSQL nodes (pgEdge Spock)
- NEAR blockchain as ultimate source of truth

**Sources:**
- [Enterprise grade Postgres for agentic AI, high availability and more](https://www.pgedge.com/)
- [Replication and High Availability](https://docs.tigerdata.com/self-hosted/latest/replication-and-ha/)

---

## 14. Production Patterns from Offline-First Companies

### 14.1 Notion's Offline Architecture

**Key Insights:**
- SQLite for local caching
- Forest of offline page trees tracking offline availability reasons
- Multiple independent reasons for offline status
- Pages removed only when last reason disappears
- Push limits of local sync (more pages to devices)
- Moving toward local-first architecture

**Challenges:**
- Reference tracking
- Background syncing
- Rich-text conflict resolution
- Block architecture complexity

**Use Case Fit:**
- ✅ SQLite caching pattern applicable
- ✅ Multiple reasons for offline availability (similar to mission-based retention)
- ✅ Local-first vision aligns with project

**Sources:**
- [How we made Notion available offline](https://www.notion.com/blog/how-we-made-notion-available-offline)

---

### 14.2 Linear's Sync Engine

**Key Insights:**
- Sophisticated sync system with offline capabilities
- 3 years of lessons learned building sync engine
- Real-time sync when connected
- Offline operation when disconnected

**Challenges:**
- Keeping multiple systems in sync (Notion + Linear)
- Busywork maintaining changes in two systems
- Getting out of sync easily
- No single source of truth when integrating multiple tools

**Use Case Fit:**
- ⚠️ Highlights challenge of multi-system sync
- ✅ Single source of truth important (NEAR blockchain for critical decisions)

**Sources:**
- [Building an offline realtime sync engine](https://gist.github.com/pesterhazy/3e039677f2e314cb77ffe3497ebca07b)

---

## 15. Recommended Architecture for Project

### 15.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tactical Edge (DDIL)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Autonomous Vehicle (Sphero RVR+ + Jetson Orin Nano)     │   │
│  │  - SQLite (local database)                              │   │
│  │  - Local AI models (perception, navigation)             │   │
│  │  - Mission plans (stored locally)                       │   │
│  │  - Store-and-forward queue                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↕ (Intermittent)                        │
│                   PowerSync/ElectricSQL                          │
└─────────────────────────────────────────────────────────────────┘
                          ↕ (Sync when connected)
┌─────────────────────────────────────────────────────────────────┐
│                   Operational Backend                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PostgreSQL (Central, Self-Hosted)                       │   │
│  │  - PostGIS (geospatial)                                 │   │
│  │  - TimescaleDB (time-series sensor data)                │   │
│  │  - pg_trgm (full-text search)                           │   │
│  │  - pgvector (AI embeddings)                             │   │
│  │  - pg_partman (mission-based partitioning)              │   │
│  │                                                          │   │
│  │ Multi-Master Replication (pgEdge Spock)                 │   │
│  │  - Multiple PostgreSQL nodes (central + field nodes)    │   │
│  │  - Timestamp-based conflict resolution (LWW)            │   │
│  │  - Conflict audit trail                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↕                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Event Store (PostgreSQL Event Sourcing)                 │   │
│  │  - All system events in event_stream table              │   │
│  │  - CQRS read models (dashboards, analytics)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↕                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Transactional Outbox (blockchain_outbox table)          │   │
│  │  - Critical events for blockchain                       │   │
│  │  - LSN for idempotency                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ↕                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ CDC to Blockchain (Debezium + Kafka or pgboss)          │   │
│  │  - Captures outbox changes                              │   │
│  │  - Publishes to Kafka topics                            │   │
│  │  - Consumer writes to NEAR blockchain                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────────┐
│                    NEAR Blockchain Layer                        │
│  - Critical decisions (strike authorization, target selection)  │
│  - Audit trail (immutable event log)                            │
│  - Provenance (IPFS CIDs for archived data)                     │
│  - Access control policies                                      │
│  - DAO governance                                               │
└─────────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────────┐
│                    IPFS Archival Layer                          │
│  - Mission data archives (encrypted, client-side)               │
│  - Sensor data archives (time-series partitions)                │
│  - Intelligence products (documents, imagery)                   │
│  - Content addressing (CIDs stored on blockchain)               │
│  - Pinata for reliable pinning                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 15.2 Component Breakdown

#### **Edge Layer (Autonomous Vehicles)**

**Database:** SQLite
- Embedded, zero-configuration
- Offline-first operation
- Fast local queries

**Sync:** PowerSync (Recommended) or ElectricSQL
- Bi-directional sync with central PostgreSQL
- Real-time when connected
- Queue operations when disconnected

**AI:** Local models on Jetson Orin Nano
- Perception (object detection, tracking)
- Navigation (path planning, obstacle avoidance)
- Sensor fusion (camera, LIDAR, GPS, IMU)

**Mission Execution:** Local mission storage
- Missions downloaded when connected
- Executable offline without cloud
- Status synced when connected

---

#### **Operational Layer (Central Backend)**

**Primary Database:** PostgreSQL (Self-Hosted)

**Extensions:**
- **PostGIS:** Geospatial queries (vehicle positions, target locations, areas of operations)
- **TimescaleDB:** Time-series sensor data (hypertables, compression, retention policies)
- **pg_trgm:** Full-text search (intelligence products, mission plans)
- **pgvector:** AI embeddings (semantic search, similarity)
- **pg_partman:** Mission-based partitioning (automatic partition management, retention policies)

**Multi-Master Replication:** pgEdge Spock
- Multiple PostgreSQL nodes (central HQ + forward operating bases)
- Timestamp-based conflict resolution (LWW)
- Conflict audit trail (all conflicts logged)
- Edge computing optimized (small footprint, Cloudflare Workers integration)

**Event Store:** PostgreSQL tables
- `event_stream` table (all system events)
- Immutable append-only log
- CQRS read models derived from event stream

**Transactional Outbox:** `blockchain_outbox` table
- Critical events for blockchain (strike authorization, target selection, intelligence products)
- LSN for idempotency
- Status tracking (pending, processing, confirmed, failed)

**Message Queue:** pgboss (Node.js) or PGMQ
- Background jobs (data sync, blockchain writes, mission planning)
- Exactly-once delivery
- Atomic commits with database operations

---

#### **CDC Layer (PostgreSQL → Blockchain)**

**Option 1: Debezium + Kafka (More Robust)**
- Debezium captures `blockchain_outbox` changes
- Kafka topics for event types
- Consumer writes to NEAR blockchain
- Idempotency using LSN
- At-least-once delivery

**Option 2: pgboss (Simpler)**
- Poll `blockchain_outbox` table
- Background jobs write to NEAR blockchain
- Idempotency using LSN
- Exactly-once delivery

**Recommendation:** Start with pgboss for simplicity; migrate to Debezium + Kafka if throughput requires.

---

#### **Blockchain Layer (NEAR Protocol)**

**Critical Events:**
- Strike authorization (DAO approval, target, weapon, ROE)
- Target selection (target ID, priority, intelligence)
- Operational plan approval (campaign plan, commander's intent)
- Intelligence products (classification, source, reliability)
- Access control policies (ABAC rules, classification caveats)

**Provenance:**
- IPFS CIDs for archived data
- Encrypted document registry
- Tamper-proof audit trail

**Governance:**
- DAO smart contracts
- Coalition member voting
- Autonomy delegation rules

---

#### **Archival Layer (IPFS + Pinata)**

**Archival Workflow:**
1. Mission completes
2. Detach PostgreSQL partition (pg_partman)
3. Export partition data (pg_dump or COPY to CSV)
4. Encrypt data (client-side, classification-based keys)
5. Add to IPFS via Pinata (returns CID)
6. Store CID in PostgreSQL metadata table
7. Store CID on NEAR blockchain (immutable provenance)
8. Drop partition from PostgreSQL (save space)
9. Data retrievable from IPFS using CID

**Archived Data Types:**
- Mission sensor data (time-series partitions)
- Intelligence products (documents, imagery, videos)
- Mission plans (after completion)
- Battle damage assessment (BDA) imagery

**Retention Policy:**
- Hot data: PostgreSQL (active missions, recent 30 days)
- Warm data: PostgreSQL compressed (TimescaleDB, 30-365 days)
- Cold data: IPFS (archived missions, >365 days)

---

### 15.3 Conflict Resolution Strategy

**Layers of Truth:**

1. **Local Device (SQLite):**
   - Source of truth for local state
   - Immediate writes, no latency

2. **Central PostgreSQL:**
   - Source of truth for operational state
   - Timestamp-based LWW for conflicts (pgEdge Spock)

3. **NEAR Blockchain:**
   - Source of truth for critical decisions
   - Immutable, verifiable
   - Overrides PostgreSQL in case of conflict

**Conflict Resolution Rules:**

| Data Type | Source of Truth | Conflict Resolution |
|-----------|----------------|---------------------|
| Sensor data | Local (SQLite) | Timestamp (LWW), no conflicts (append-only) |
| Mission status | Local (SQLite) | Timestamp (LWW), sync when connected |
| Operational plans | Central (PostgreSQL) | Timestamp (LWW), Spock automated resolution |
| Strike authorization | Blockchain (NEAR) | Blockchain is immutable truth |
| Target selection | Blockchain (NEAR) | Blockchain is immutable truth |
| Intelligence products | Blockchain (NEAR) | Blockchain provenance + IPFS content |

**Conflict Audit:**
- All Spock conflicts logged in PostgreSQL
- Blockchain provides immutable audit trail for critical decisions
- Operational dashboards show conflict history

---

### 15.4 Data Flow Patterns

#### **1. Sensor Data (Edge → Central)**

```
Jetson Orin Nano (Sensors)
    ↓
SQLite (local storage, time-series)
    ↓ (PowerSync, when connected)
PostgreSQL TimescaleDB (central storage)
    ↓ (Continuous aggregates)
Dashboards (operational picture)
    ↓ (Mission complete, pg_partman detach)
Export → Encrypt → IPFS (archival)
    ↓ (Store CID)
NEAR Blockchain (provenance)
```

---

#### **2. Mission Planning (Central → Edge)**

```
Commander Interface (React frontend)
    ↓
PostgreSQL (mission plan storage)
    ↓ (Event sourcing)
Event Stream (mission_plan_created event)
    ↓ (PowerSync, sync to edge)
SQLite on Jetson (local mission storage)
    ↓
Autonomous Execution (offline capable)
    ↓ (Status updates)
SQLite → PowerSync → PostgreSQL
    ↓ (Critical milestones)
Transactional Outbox → Debezium → NEAR Blockchain
```

---

#### **3. Strike Authorization (Critical Decision)**

```
Target Selection (Commander)
    ↓
PostgreSQL (target_selection event)
    ↓ (Transactional outbox)
Outbox Table (blockchain_outbox)
    ↓ (Debezium/pgboss)
Kafka → Consumer
    ↓ (Write to blockchain)
NEAR Smart Contract (DAO approval process)
    ↓ (DAO members vote)
Strike Authorization Event (on-chain)
    ↓ (Background sync)
PostgreSQL Update (strike_authorized status)
    ↓ (PowerSync)
Edge Device (execute mission)
```

---

#### **4. Intelligence Product Archival**

```
Intelligence Product Created
    ↓
PostgreSQL (metadata: classification, source, reliability)
    ↓ (Transactional outbox)
Encrypt Product (client-side, classification-based key)
    ↓
Upload to IPFS (Pinata)
    ↓ (Returns CID)
Store CID in PostgreSQL (intel_products table)
    ↓ (Transactional outbox)
Write CID to NEAR Blockchain (provenance, access control)
    ↓ (Query)
User retrieves: PostgreSQL metadata + IPFS content (via CID)
```

---

### 15.5 Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Edge Database** | SQLite | Offline-first local storage |
| **Edge Sync** | PowerSync | Bi-directional PostgreSQL↔SQLite sync |
| **Central Database** | PostgreSQL | Operational data, event store |
| **Extensions** | PostGIS, TimescaleDB, pg_trgm, pgvector, pg_partman | Geospatial, time-series, search, AI, partitioning |
| **Multi-Master** | pgEdge Spock | Multi-master replication, conflict resolution |
| **Event Store** | PostgreSQL tables | Event sourcing, CQRS |
| **Outbox** | PostgreSQL table | Transactional outbox pattern |
| **CDC** | Debezium or pgboss | Change data capture to blockchain |
| **Message Broker** | Kafka or pgboss | Event distribution (optional) |
| **Blockchain** | NEAR Protocol | Critical decisions, audit trail, provenance |
| **Archival** | IPFS + Pinata | Decentralized archival storage |
| **Backend** | Node.js in Phala TEE | Privacy-preserving backend |
| **Frontend** | React + TypeScript | Commander interface |

---

### 15.6 Implementation Phases

#### **Phase 1: Core Infrastructure**
1. Set up self-hosted PostgreSQL with extensions
2. Implement event sourcing tables (event_stream)
3. Create transactional outbox (blockchain_outbox)
4. Set up pgboss for background jobs
5. Implement basic NEAR blockchain integration

#### **Phase 2: Edge Sync**
1. Integrate PowerSync for SQLite↔PostgreSQL sync
2. Set up SQLite on Jetson Orin Nano
3. Implement store-and-forward queue
4. Test offline operation and sync recovery

#### **Phase 3: Multi-Master Replication**
1. Deploy pgEdge Spock for multi-master
2. Configure timestamp-based conflict resolution
3. Set up conflict audit logging
4. Test multi-node sync scenarios

#### **Phase 4: CDC to Blockchain**
1. Implement Debezium (or stick with pgboss)
2. Set up Kafka topics (if using Debezium)
3. Implement blockchain consumer with idempotency
4. Test at-least-once delivery and recovery

#### **Phase 5: Time-Series and Archival**
1. Set up TimescaleDB hypertables for sensor data
2. Configure pg_partman for mission-based partitioning
3. Implement IPFS archival workflow
4. Store CIDs on NEAR blockchain

#### **Phase 6: Production Hardening**
1. High availability (Patroni failover)
2. Monitoring and alerting
3. Performance optimization
4. Security hardening

---

## 16. Key Libraries and Tools

### 16.1 PostgreSQL Extensions

| Extension | Purpose | Documentation |
|-----------|---------|---------------|
| **PostGIS** | Geospatial queries | https://postgis.net/ |
| **TimescaleDB** | Time-series optimization | https://www.timescale.com/ |
| **pg_trgm** | Full-text search (trigram) | https://www.postgresql.org/docs/current/pgtrgm.html |
| **pgvector** | Vector similarity search | https://github.com/pgvector/pgvector |
| **pg_partman** | Partition management | https://github.com/pgpartman/pg_partman |

---

### 16.2 Replication and Sync

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **PowerSync** | PostgreSQL↔SQLite sync | https://www.powersync.com/ |
| **ElectricSQL** | Active-active PostgreSQL↔SQLite | https://electric-sql.com/ |
| **pgEdge Spock** | Multi-master PostgreSQL | https://github.com/pgEdge/spock |
| **pglogical** | Logical replication (legacy) | https://github.com/2ndQuadrant/pglogical |

---

### 16.3 Change Data Capture

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **Debezium** | CDC from PostgreSQL | https://debezium.io/ |
| **wal2json** | WAL to JSON plugin | https://github.com/eulerto/wal2json |
| **pgoutput** | Native logical decoding | Built-in PostgreSQL 10+ |

---

### 16.4 Message Queues

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **pgboss** | PostgreSQL-based job queue (Node.js) | https://github.com/timgit/pg-boss |
| **PGMQ** | Lightweight message queue | https://github.com/pgmq/pgmq |
| **Kafka** | Distributed streaming platform | https://kafka.apache.org/ |

---

### 16.5 IPFS and Archival

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **IPFS** | Decentralized storage | https://ipfs.tech/ |
| **Pinata** | IPFS pinning service | https://www.pinata.cloud/ |
| **ipfs-ds-postgres** | PostgreSQL backend for IPFS | https://github.com/alanshaw/ipfs-ds-postgres |

---

### 16.6 High Availability

| Tool | Purpose | Documentation |
|------|---------|---------------|
| **Patroni** | PostgreSQL HA and failover | https://github.com/patroni/patroni |
| **Zalando Postgres Operator** | Kubernetes PostgreSQL operator | https://github.com/zalando/postgres-operator |
| **pgEdge Platform** | Distributed PostgreSQL for edge | https://www.pgedge.com/ |

---

## 17. Critical Considerations

### 17.1 DDIL Environment Requirements

**Must-Have Capabilities:**
- ✅ Offline-first operation (SQLite on edge)
- ✅ Store-and-forward (PowerSync queue)
- ✅ Local AI inference (no cloud dependency)
- ✅ Automatic fallback behaviors (return to home when disconnected)
- ✅ Eventual consistency (NEAR blockchain as ultimate truth)

**Implementation Checklist:**
- [ ] SQLite on Jetson Orin Nano
- [ ] PowerSync sync service
- [ ] Queue for operations during disconnection
- [ ] Automatic retry with exponential backoff
- [ ] Conflict resolution (timestamp-based LWW)
- [ ] Blockchain as source of truth for critical decisions

---

### 17.2 Autonomous Vehicle Fleet Management

**Key Requirements:**
- Data normalization across vehicles
- Common schema for interoperability
- Real-time operational picture (when connected)
- Offline mission execution (when disconnected)
- Mission-based data retention
- Sensor data time-series storage

**Implementation Checklist:**
- [ ] Common schema in PostgreSQL
- [ ] TimescaleDB for sensor data
- [ ] pg_partman for mission-based partitioning
- [ ] PowerSync for vehicle↔central sync
- [ ] Dashboards for fleet visibility
- [ ] IPFS archival after mission completion

---

### 17.3 Blockchain Integration

**Challenges:**
- Dual-write problem (PostgreSQL + NEAR)
- Idempotency (at-least-once delivery)
- Performance (blockchain writes slower than database)
- Cost (gas fees for blockchain transactions)

**Solutions:**
- ✅ Transactional outbox pattern (atomic writes)
- ✅ LSN-based idempotency (no duplicate blockchain writes)
- ✅ Selective blockchain writes (only critical events)
- ✅ Batching (multiple events per blockchain transaction)

**Implementation Checklist:**
- [ ] Transactional outbox table
- [ ] Debezium or pgboss for CDC
- [ ] LSN-based idempotency in smart contract
- [ ] Retry queue for failed blockchain writes
- [ ] Cost optimization (batch writes)

---

### 17.4 Security and Encryption

**Data Classifications:**
- UNCLASS, CUI, SECRET, TOP SECRET
- Coalition caveats (NATO, Five Eyes, bilateral)
- Release authority enforcement

**Encryption Strategy:**
- Client-side encryption before IPFS upload
- Classification-based encryption keys
- Phala TEE for backend key management
- NEAR blockchain for access control policies

**Implementation Checklist:**
- [ ] Client-side encryption (before IPFS)
- [ ] Classification-based key derivation
- [ ] Phala TEE key management
- [ ] NEAR smart contracts for access policies
- [ ] Attribute-Based Access Control (ABAC)

---

### 17.5 Performance and Scalability

**Bottlenecks:**
- PostgreSQL write throughput
- Blockchain transaction latency
- IPFS upload bandwidth
- Network bandwidth in DDIL environments

**Optimizations:**
- TimescaleDB compression (10x-100x reduction)
- pg_partman for partition pruning
- Batch blockchain writes
- IPFS compression before upload
- CDN/cache for read-heavy queries

**Implementation Checklist:**
- [ ] TimescaleDB compression enabled
- [ ] Partition pruning configured
- [ ] Batch blockchain writes
- [ ] IPFS compression
- [ ] Read replicas for dashboards
- [ ] Connection pooling (PgBouncer)

---

## 18. Production Deployment Patterns

### 18.1 Self-Hosted Infrastructure

**Recommended Setup:**

1. **Central PostgreSQL Cluster:**
   - Primary + 2 standbys (Patroni managed)
   - Read replicas for dashboards
   - pgEdge Spock for multi-master
   - Connection pooling (PgBouncer)

2. **Field PostgreSQL Nodes:**
   - Forward operating base (FOB) installations
   - Spock replication to central
   - Offline operation during disconnection
   - Sync when connectivity restored

3. **Edge Devices:**
   - SQLite embedded database
   - PowerSync client library
   - Local AI models
   - Store-and-forward queue

4. **Backend Services:**
   - Node.js in Phala TEE (privacy-preserving)
   - Debezium or pgboss (CDC)
   - Kafka (optional, for scale)
   - IPFS client (archival)

5. **Blockchain Nodes:**
   - FastNEAR RPC (optimized access)
   - Local NEAR node (optional, for resilience)
   - Smart contracts on NEAR

---

### 18.2 Monitoring and Observability

**Metrics to Monitor:**
- PostgreSQL: connection count, query latency, replication lag, WAL size
- PowerSync: sync lag, queue depth, error rate
- Spock: conflict rate, replication lag per node
- Blockchain: transaction confirmation time, failed writes, gas costs
- IPFS: upload latency, pin status, gateway availability

**Tools:**
- **Prometheus** + **Grafana** (metrics and dashboards)
- **pgwatch2** or **pg_stat_monitor** (PostgreSQL monitoring)
- **Loki** (log aggregation)
- **Jaeger** (distributed tracing)

---

### 18.3 Disaster Recovery

**Backup Strategy:**
- PostgreSQL: WAL archival + base backups (pg_basebackup)
- TimescaleDB: continuous aggregates backed up separately
- IPFS: redundant pinning (multiple Pinata nodes)
- NEAR blockchain: inherently redundant (decentralized)

**Recovery Time Objectives (RTO):**
- Critical systems: < 5 minutes (Patroni automatic failover)
- Operational systems: < 30 minutes (manual failover)
- Archival systems: < 24 hours (IPFS retrieval)

**Recovery Point Objectives (RPO):**
- Critical decisions: 0 (blockchain immutability)
- Operational data: < 1 minute (replication lag)
- Sensor data: < 5 minutes (acceptable loss for time-series)

---

## 19. Conclusion and Recommendations

### 19.1 Recommended Pattern Summary

**For Autonomous Vehicle Offline Sync:**

1. **Edge Layer:**
   - SQLite on Jetson Orin Nano
   - PowerSync for bi-directional sync
   - Local AI models (no cloud dependency)
   - Store-and-forward for DDIL

2. **Operational Layer:**
   - Self-hosted PostgreSQL with PostGIS, TimescaleDB, pg_trgm, pgvector, pg_partman
   - pgEdge Spock for multi-master replication (central + field nodes)
   - Event sourcing for audit trail
   - Transactional outbox for blockchain sync

3. **Blockchain Layer:**
   - NEAR Protocol for critical decisions
   - Debezium or pgboss for CDC
   - LSN-based idempotency
   - Selective blockchain writes (cost optimization)

4. **Archival Layer:**
   - Mission-based partitioning (pg_partman)
   - TimescaleDB compression
   - IPFS archival (encrypted, client-side)
   - CIDs stored on NEAR blockchain

---

### 19.2 Implementation Priorities

**Phase 1 (MVP):**
1. PostgreSQL with extensions (PostGIS, TimescaleDB, pg_trgm, pgvector)
2. Event sourcing tables
3. Transactional outbox + pgboss
4. Basic NEAR blockchain integration
5. SQLite on Jetson + PowerSync

**Phase 2 (Production):**
1. pgEdge Spock multi-master
2. Mission-based partitioning (pg_partman)
3. IPFS archival workflow
4. High availability (Patroni)
5. Monitoring and alerting

**Phase 3 (Scale):**
1. Debezium + Kafka (if throughput requires)
2. Read replicas and connection pooling
3. Multi-region replication
4. Advanced conflict resolution (CRDTs if needed)

---

### 19.3 Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| **PowerSync single point of failure** | Implement fallback sync mechanism; consider ElectricSQL as alternative |
| **Blockchain write latency** | Use transactional outbox with async writes; batch transactions |
| **Conflict resolution complexity** | Use simple timestamp-based LWW; blockchain as ultimate truth |
| **IPFS gateway availability** | Use multiple gateways (Pinata + public); consider self-hosted IPFS node |
| **PostgreSQL replication lag** | Monitor lag metrics; set alerts; use sync replication for critical data |
| **DDIL environment data loss** | Replication slots prevent WAL deletion; store-and-forward queue |

---

### 19.4 Key Success Factors

1. **Offline-First Architecture:**
   - SQLite on edge devices
   - PowerSync for automatic sync
   - Local AI inference

2. **Proven Technologies:**
   - PostgreSQL (mature, reliable)
   - pgEdge Spock (production-ready multi-master)
   - Debezium (industry-standard CDC)
   - NEAR blockchain (active ecosystem)

3. **Simple Conflict Resolution:**
   - Timestamp-based LWW
   - Blockchain as source of truth
   - Conflict audit trail

4. **Mission-Based Retention:**
   - pg_partman for automatic partitioning
   - IPFS archival after mission completion
   - TimescaleDB compression for storage efficiency

5. **Self-Hosted Deployment:**
   - Full control over infrastructure
   - No vendor lock-in
   - Classification-appropriate (defense requirements)

---

## 20. Sources and Further Reading

### Official Documentation
- [PostgreSQL: Documentation: 18: Chapter 29. Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [PostgreSQL: Documentation: 18: 28.3. Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html)
- [PostgreSQL: Documentation: 18: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [Debezium connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [TimescaleDB Documentation](https://www.timescale.com/)
- [PostGIS Documentation](https://postgis.net/)

### Offline-First and Edge Computing
- [Offline-first frontend apps in 2025: IndexedDB and SQLite in the browser and beyond](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Introducing PowerSync v1.0: Postgres<>SQLite Sync Layer](https://www.powersync.com/blog/introducing-powersync-v1-0-postgres-sqlite-sync-layer)
- [Local-first sync for Postgres from the inventors of CRDTs | ElectricSQL](https://electric-sql.com/blog/2023/09/20/introducing-electricsql-v0.6)
- [How we made Notion available offline](https://www.notion.com/blog/how-we-made-notion-available-offline)
- [Edge Databases: Empowering Distributed Computing Environments](https://www.navicat.com/en/company/aboutus/blog/3331-edge-databases-empowering-distributed-computing-environments)

### Multi-Master Replication
- [GitHub - pgEdge/spock: Logical multi-master PostgreSQL replication](https://github.com/pgEdge/spock)
- [Multi-Master Distributed Postgres from pgEdge](https://www.pgedge.com/solutions/benefit/multi-master)
- [How to achieve multi-master replication in PostgreSQL with Spock](https://www.pgedge.com/blog/achieve-multiactive-data-replication-in-postgresql-with-spock)
- [PostgreSQL: Documentation: 18: 29.7. Conflicts](https://www.postgresql.org/docs/current/logical-replication-conflicts.html)

### Event Sourcing and CQRS
- [GitHub - eugene-khyst/postgresql-event-sourcing](https://github.com/eugene-khyst/postgresql-event-sourcing)
- [Go EventSourcing and CQRS with PostgreSQL, Kafka, MongoDB and ElasticSearch](https://dev.to/aleksk1ng/go-eventsourcing-and-cqrs-with-postgresql-kafka-mongodb-and-elasticsearch-44d7)
- [Implementing event sourcing using a relational database | SoftwareMill](https://softwaremill.com/implementing-event-sourcing-using-a-relational-database/)

### Transactional Outbox Pattern
- [Revisiting the Outbox Pattern](https://www.decodable.co/blog/revisiting-the-outbox-pattern)
- [Microservices Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Push-based Outbox Pattern with Postgres Logical Replication](https://event-driven.io/en/push_based_outbox_pattern_with_postgres_logical_replication/)
- [The Transactional Outbox Pattern: Transforming Real-Time Data Distribution at SeatGeek](https://chairnerd.seatgeek.com/transactional-outbox-pattern/)

### CRDTs
- [EDB Docs - EDB Postgres Distributed (PGD) v5.7 - Conflict-free replicated data types](https://www.enterprisedb.com/docs/pgd/latest/conflict-management/crdt/)
- [CRDTs with PostgreSQL: Guide for Distributed Systems](https://minervadb.xyz/conflict-free-replicated-data-types-postgresql/)
- [GitHub - supabase/pg_crdt: CRDT support in Postgres (experimental)](https://github.com/supabase/pg_crdt)

### Message Queues
- [GitHub - timgit/pg-boss: Queueing jobs in Postgres from Node.js like a boss](https://github.com/timgit/pg-boss)
- [GitHub - pgmq/pgmq: A lightweight message queue. Like AWS SQS and RSMQ but on Postgres](https://github.com/pgmq/pgmq)
- [Using Postgres as a Message Queue - JVM Advent](https://www.javaadvent.com/2022/12/using-postgres-as-a-message-queue.html)

### Change Data Capture
- [Track every PostgreSQL data change using Debezium](https://dev.to/emtiajium/track-every-postgresql-data-change-using-debezium-5e19)
- [Change Data Capture Architecture Using Debezium, Postgres, and Kafka](https://dzone.com/articles/change-data-capture-architecture-using-debezium-po)
- [Enabling CDC with the Fully Managed Debezium PostgreSQL Connector](https://www.confluent.io/blog/cdc-and-data-streaming-capture-database-changes-in-real-time-with-debezium/)

### DDIL Environments
- [Achieving Uninterrupted Defense Processes in DDIL Environments](https://appian.com/blog/2024/operating-in-dod-ddil-environments)
- [DDIL: How DOD Seeks to Operate in Low Bandwidth Environments](https://www.executivebiz.com/articles/ddil-dod-cyber-cloud-cjadc2-low-bandwidth)
- [DDIL Environments: Managing Cloud Edge Computing for Defense Agencies](https://fedtechmagazine.com/article/2025/03/ddil-environments-managing-cloud-edge-computing-defense-agencies-perfcon)
- [Marines aim to solve the DDIL challenge](https://federalnewsnetwork.com/reporters-notebook-jason-miller/2022/06/marines-aim-to-solve-the-ddil-challenge/)
- [A 2026 Guide to DDIL Environments | Strata.io](https://www.strata.io/blog/identity-continuity/ddil-resilient-identity-continuity/)

### Data Retention and Archival
- [Data archiving and retention in PostgreSQL. Best practices for large datasets](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)
- [Auto-archiving and Data Retention Management in Postgres with pg_partman](https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman)
- [PostgreSQL with TimescaleDB: Managing Retention Policies and Archival Data](https://www.slingacademy.com/article/postgresql-with-timescaledb-managing-retention-policies-and-archival-data/)
- [IPFS As An Archival Storage Solution](https://pinata.cloud/blog/ipfs-as-an-archival-storage-solution/)

### High Availability
- [Self-hosting a high-availability Postgres cluster on Kubernetes](https://ryan-schachte.com/blog/ha_postgres_zolando/)
- [Relational Data at the Edge: How Cloudflare Operates Distributed PostgreSQL Clusters](https://www.infoq.com/articles/cloudflare-distributed-postgres/)
- [Enterprise grade Postgres for agentic AI, high availability and more](https://www.pgedge.com/)

### Autonomous Vehicles
- [Autonomous Fleet Management: The Future of Fleet Operations](https://www.epikafleet.com/blog/autonomous-fleet-management/)
- [Autonomous Vehicle Fleet Management System (FMS) | Cyngn Insight](https://www.cyngn.com/solutions/insight)
- [DataOps for autonomous vehicle operations - Microsoft](https://learn.microsoft.com/en-us/industry/mobility/architecture/autonomous-vehicle-operations-dataops-content)

---

**End of Research Document**

*Compiled: 2026-01-11*
*Research Focus: PostgreSQL patterns for offline synchronization, DDIL environments, autonomous vehicles, and blockchain integration*
*Total Sources: 100+*

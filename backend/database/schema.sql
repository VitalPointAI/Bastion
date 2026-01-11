-- Coalition Operations Database Schema
-- Hybrid storage: PostgreSQL (fast queries) + NEAR (verification) + IPFS (large files)

-- ============================================================================
-- DOCUMENTS TABLE
-- Synced with NEAR blockchain for provenance
-- ============================================================================
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

-- ============================================================================
-- BLOCKCHAIN EVENTS TABLE
-- Event sourcing for audit trail
-- Note: Using regular table for v1; TimescaleDB hypertable deferred to production
-- ============================================================================
CREATE TABLE blockchain_events (
    event_id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,  -- document_registered, mission_approved, strike_authorized
    aggregate_id TEXT NOT NULL,  -- Entity this event relates to
    event_data JSONB NOT NULL,
    blockchain_tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed BOOLEAN DEFAULT false
);

CREATE INDEX idx_events_aggregate ON blockchain_events(aggregate_id, created_at DESC);
CREATE INDEX idx_events_type ON blockchain_events(event_type, created_at DESC);
CREATE INDEX idx_events_created_at ON blockchain_events(created_at DESC);

-- ============================================================================
-- OUTBOX TABLE
-- Transactional outbox pattern for dual-write reliability
-- ============================================================================
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

-- ============================================================================
-- EDGE SYNC STATE TABLE
-- Track offline edge devices (autonomous vehicles)
-- ============================================================================
CREATE TABLE edge_sync_state (
    edge_device_id TEXT PRIMARY KEY,
    last_sync_at TIMESTAMPTZ,
    sync_checkpoint TEXT,  -- LSN or timestamp
    device_status TEXT,  -- online, offline, syncing
    pending_operations_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- ============================================================================
-- SENSOR TELEMETRY TABLE
-- Time-series data from edge devices
-- Note: Using regular table for v1; TimescaleDB hypertable deferred to production
-- ============================================================================
CREATE TABLE sensor_telemetry (
    telemetry_id BIGSERIAL PRIMARY KEY,
    edge_device_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,  -- camera, lidar, gps, imu
    sensor_data JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    mission_id TEXT
);

CREATE INDEX idx_telemetry_timestamp ON sensor_telemetry(timestamp DESC);
CREATE INDEX idx_telemetry_device ON sensor_telemetry(edge_device_id, timestamp DESC);
CREATE INDEX idx_telemetry_mission ON sensor_telemetry(mission_id, timestamp DESC);

-- ============================================================================
-- MISSION UPDATES TABLE
-- Bidirectional sync between backend and edge devices
-- ============================================================================
CREATE TABLE mission_updates (
    update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id TEXT NOT NULL,
    update_type TEXT NOT NULL,  -- order, intelligence, status_change
    update_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL  -- account_id or edge_device_id
);

CREATE INDEX idx_mission_updates ON mission_updates(mission_id, created_at DESC);

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully';
    RAISE NOTICE 'Tables: documents, blockchain_events, outbox, edge_sync_state, sensor_telemetry, mission_updates';
    RAISE NOTICE 'Ready for hybrid storage: PostgreSQL + NEAR + IPFS';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Using standard PostgreSQL tables for v1 development';
    RAISE NOTICE 'TimescaleDB hypertables can be added in production for time-series optimization';
END $$;

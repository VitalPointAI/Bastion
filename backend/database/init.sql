-- PostgreSQL Extensions Initialization
-- Enables available extensions for v1 development

-- pg_trgm for full-text search (document metadata, tags)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE coalition_ops TO postgres;

-- Log initialization status
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions initialized';
    RAISE NOTICE 'pg_trgm: ✓ Enabled for full-text search';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Advanced extensions deferred to production deployment:';
    RAISE NOTICE '  - TimescaleDB: Time-series optimization (will use regular tables for v1)';
    RAISE NOTICE '  - PostGIS: Geospatial queries (will add in Phase 5 if needed)';
    RAISE NOTICE '  - pgvector: AI embeddings (will add in Phase 8 if needed)';
    RAISE NOTICE '  - pg_partman: Data partitioning (will add post-v1 for production)';
    RAISE NOTICE '';
    RAISE NOTICE 'Core PostgreSQL functionality sufficient for v1 development';
END $$;

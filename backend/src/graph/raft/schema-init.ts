/**
 * RAFT Schema Initialization for Neo4j
 *
 * Creates constraints and indexes for RAFT entities in the Neo4j database.
 * This should be called once during backend startup to ensure the schema is ready.
 *
 * Constraints:
 * - Unique IDs for Actor, Tension, Function nodes
 *
 * Indexes:
 * - Actor: name, type, workspaceId
 * - Tension: intensity, domain, workspaceId
 * - Function: domain, workspaceId
 * - Full-text: Actor name/aliases for fuzzy search
 */

import { getNeo4jDriver } from '../neo4j-client.js';

/**
 * Initialize the RAFT schema in Neo4j
 * Creates constraints and indexes if they don't already exist
 */
export async function initRAFTSchema(): Promise<void> {
  const driver = getNeo4jDriver();

  console.log('Initializing RAFT Neo4j schema...');

  // =========================================================================
  // Unique Constraints
  // =========================================================================

  // Actor unique ID constraint
  await driver.executeQuery(`
    CREATE CONSTRAINT actor_id IF NOT EXISTS FOR (a:Actor) REQUIRE a.id IS UNIQUE
  `);

  // Tension unique ID constraint
  await driver.executeQuery(`
    CREATE CONSTRAINT tension_id IF NOT EXISTS FOR (t:Tension) REQUIRE t.id IS UNIQUE
  `);

  // Function unique ID constraint
  await driver.executeQuery(`
    CREATE CONSTRAINT function_id IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE
  `);

  // =========================================================================
  // Actor Indexes
  // =========================================================================

  // Actor name index for lookups
  await driver.executeQuery(`
    CREATE INDEX actor_name IF NOT EXISTS FOR (a:Actor) ON (a.name)
  `);

  // Actor type index for filtering
  await driver.executeQuery(`
    CREATE INDEX actor_type IF NOT EXISTS FOR (a:Actor) ON (a.type)
  `);

  // Actor workspace index for multi-tenant queries
  await driver.executeQuery(`
    CREATE INDEX actor_workspace IF NOT EXISTS FOR (a:Actor) ON (a.workspaceId)
  `);

  // =========================================================================
  // Tension Indexes
  // =========================================================================

  // Tension intensity index for filtering
  await driver.executeQuery(`
    CREATE INDEX tension_intensity IF NOT EXISTS FOR (t:Tension) ON (t.intensity)
  `);

  // Tension domain index for filtering
  await driver.executeQuery(`
    CREATE INDEX tension_domain IF NOT EXISTS FOR (t:Tension) ON (t.domain)
  `);

  // Tension workspace index for multi-tenant queries
  await driver.executeQuery(`
    CREATE INDEX tension_workspace IF NOT EXISTS FOR (t:Tension) ON (t.workspaceId)
  `);

  // =========================================================================
  // Function Indexes
  // =========================================================================

  // Function domain index for filtering
  await driver.executeQuery(`
    CREATE INDEX function_domain IF NOT EXISTS FOR (f:Function) ON (f.domain)
  `);

  // Function workspace index for multi-tenant queries
  await driver.executeQuery(`
    CREATE INDEX function_workspace IF NOT EXISTS FOR (f:Function) ON (f.workspaceId)
  `);

  // =========================================================================
  // Full-Text Indexes
  // =========================================================================

  // Full-text index on actor name and aliases for fuzzy search
  // Note: aliases is stored as array, full-text works on string properties
  // We index name for primary search; aliases handled at query level
  await driver.executeQuery(`
    CREATE FULLTEXT INDEX actor_name_fulltext IF NOT EXISTS
    FOR (a:Actor) ON EACH [a.name]
  `);

  console.log('RAFT Neo4j schema initialized successfully');
}

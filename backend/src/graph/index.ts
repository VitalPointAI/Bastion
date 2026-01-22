/**
 * Graph Database Module
 *
 * Provides Neo4j connectivity for RAFT analysis and strategic intelligence fusion.
 * This module enables actor-relationship-function-tension modeling in a graph structure.
 */

export {
  getNeo4jDriver,
  closeNeo4jDriver,
  executeGraphQuery,
  executeReadQuery,
  executeWriteQuery,
  verifyNeo4jConnection,
} from './neo4j-client.js';

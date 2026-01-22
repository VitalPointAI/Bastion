import neo4j, { Driver, Session, QueryResult, RecordShape } from 'neo4j-driver';

/**
 * Neo4j Graph Database Client
 *
 * Lazy-initialized singleton pattern matching existing database.ts
 * Connection is established on first access after environment is configured.
 */

// Lazy-initialized driver (created after dotenv.config runs)
let driver: Driver | null = null;

/**
 * Get the Neo4j driver instance (lazy initialization)
 * Creates the driver on first call using environment variables
 */
export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;

    if (!password) {
      throw new Error('NEO4J_PASSWORD environment variable is required');
    }

    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(user, password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        connectionTimeout: 30000,
      }
    );

    console.log(`Neo4j driver initialized for ${uri}`);
  }
  return driver;
}

/**
 * Close the Neo4j driver connection
 * Call this on application shutdown for graceful cleanup
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('Neo4j driver closed');
  }
}

/**
 * Execute a Cypher query against the graph database
 *
 * @param cypher - The Cypher query string
 * @param params - Optional query parameters
 * @returns Query result with records
 *
 * @example
 * const result = await executeGraphQuery(
 *   'MATCH (n:Actor {id: $id}) RETURN n',
 *   { id: 'actor-123' }
 * );
 */
export async function executeGraphQuery<T extends RecordShape = RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult<T>> {
  const session: Session = getNeo4jDriver().session();
  try {
    return await session.run<T>(cypher, params);
  } finally {
    await session.close();
  }
}

/**
 * Execute a read-only Cypher query (optimized for read replicas)
 *
 * @param cypher - The Cypher query string
 * @param params - Optional query parameters
 * @returns Query result with records
 */
export async function executeReadQuery<T extends RecordShape = RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult<T>> {
  const session: Session = getNeo4jDriver().session({
    defaultAccessMode: neo4j.session.READ,
  });
  try {
    return await session.run<T>(cypher, params);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write Cypher query (ensures routing to leader)
 *
 * @param cypher - The Cypher query string
 * @param params - Optional query parameters
 * @returns Query result with records
 */
export async function executeWriteQuery<T extends RecordShape = RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult<T>> {
  const session: Session = getNeo4jDriver().session({
    defaultAccessMode: neo4j.session.WRITE,
  });
  try {
    return await session.run<T>(cypher, params);
  } finally {
    await session.close();
  }
}

/**
 * Verify Neo4j connection is working
 * Useful for health checks and startup validation
 */
export async function verifyNeo4jConnection(): Promise<boolean> {
  try {
    const result = await executeGraphQuery('RETURN 1 as test');
    return result.records.length > 0 && result.records[0].get('test') === 1;
  } catch (error) {
    console.error('Neo4j connection verification failed:', error);
    return false;
  }
}

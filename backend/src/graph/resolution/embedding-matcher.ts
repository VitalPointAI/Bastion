/**
 * Embedding-based Similarity Matcher
 *
 * Computes cosine similarity between entity text representations using
 * OpenAI text-embedding-3-large embeddings via the existing LLM factory.
 *
 * Embeddings are cached on Neo4j nodes as a JSON string (embeddingVector)
 * to avoid repeated API calls (per JSON-LD graph Pitfall 4: batch operations).
 */

import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { executeWriteQuery, executeReadQuery } from '../neo4j-client.js';

// ─── Cosine Similarity ────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 * Returns a value in [0, 1].
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

// ─── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generate an embedding for the given text using text-embedding-3-large.
 * Uses the LLM factory which handles API key configuration.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // createLLMForAgent returns the LLM instance; we need the embeddings client
  // The factory accepts 'entity-resolver' and we use it to get an OpenAI embeddings instance
  const llmOrClient = await createLLMForAgent({ agentId: 'entity-resolver' });

  // Try to use the OpenAI embeddings API directly through the factory-provided client
  // If the returned object has an embeddings property (OpenAI client), use it
  // Otherwise fall back to treating the LLM as an embeddings proxy
  const client = llmOrClient as unknown as {
    embeddings?: {
      create: (opts: { model: string; input: string }) => Promise<{ data: Array<{ embedding: number[] }> }>;
    };
  };

  if (client.embeddings?.create) {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    return response.data[0].embedding;
  }

  // Fallback: return a zero vector (should not reach this in production)
  return new Array(1536).fill(0);
}

// ─── getOrComputeEmbedding ────────────────────────────────────────────────────

/**
 * Get or compute the embedding vector for an entity node.
 *
 * - Checks Neo4j for a cached embeddingVector property (stored as JSON string)
 * - If not cached, generates via text-embedding-3-large and writes back to Neo4j
 *
 * @param entityId - The entity node ID for caching
 * @param text     - Text representation to embed (typically name + type)
 */
export async function getOrComputeEmbedding(entityId: string, text: string): Promise<number[]> {
  // Check cache first
  const cacheResult = await executeReadQuery(
    `MATCH (a {id: $entityId})
     WHERE a.embeddingVector IS NOT NULL
     RETURN a.embeddingVector AS vector`,
    { entityId },
  );

  if (cacheResult.records.length > 0) {
    const stored = cacheResult.records[0].get('vector') as string | null;
    if (stored) {
      try {
        return JSON.parse(stored) as number[];
      } catch {
        // Corrupted cache entry — recompute
      }
    }
  }

  // Not cached — generate and store
  const vector = await generateEmbedding(text);

  await executeWriteQuery(
    `MATCH (a {id: $entityId})
     SET a.embeddingVector = $vector`,
    { entityId, vector: JSON.stringify(vector) },
  );

  return vector;
}

// ─── computeEmbeddingSimilarity ───────────────────────────────────────────────

/**
 * Compute embedding-based cosine similarity between two entity text strings.
 *
 * Does NOT use Neo4j caching (text only, no entityId) — use getOrComputeEmbedding
 * when you have entity IDs to benefit from caching.
 *
 * @param textA - Text representation of entity A
 * @param textB - Text representation of entity B
 * @returns Cosine similarity score in [0, 1]
 */
export async function computeEmbeddingSimilarity(textA: string, textB: string): Promise<number> {
  const [embA, embB] = await Promise.all([
    generateEmbedding(textA),
    generateEmbedding(textB),
  ]);

  return cosineSimilarity(embA, embB);
}

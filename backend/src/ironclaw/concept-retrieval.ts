/**
 * Concept Retrieval Service
 *
 * Phase 66 Plan 04: Semantic concept retrieval and [LEARNED CONTEXT] block assembly.
 *
 * On each Ironclaw message, embeds the user query, searches for top-5 relevant
 * concepts via pgvector cosine similarity, and injects a [LEARNED CONTEXT] block
 * into the system prompt preamble.
 *
 * Key behaviors:
 * - 400ms timeout protection — never blocks message flow
 * - Similarity threshold 0.3 — filters irrelevant matches
 * - 500-token (~2000 char) hard cap on context block
 * - Evolution notes for versioned concepts (v > 1)
 * - Returns '' on timeout, error, or no relevant concepts
 */

import { conceptStore, generateConceptEmbedding } from './concept-store.js';
import type { ConceptEntry } from './concept-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCEPTS = 5;
const SIMILARITY_THRESHOLD = 0.3;
const CONTEXT_CHAR_CAP = 2000; // ~500 tokens

// ---------------------------------------------------------------------------
// ConceptRetrievalService
// ---------------------------------------------------------------------------

class ConceptRetrievalService {
  /**
   * Build a [LEARNED CONTEXT] block for injection into the Ironclaw system prompt.
   *
   * Embeds the message content, searches for top-5 semantically similar concepts,
   * filters by similarity threshold, and formats into a structured block.
   *
   * @param userDid        - The user's DID
   * @param problemSetId   - Current problem set ID (null for global scope)
   * @param messageContent - The user's message (used for semantic embedding)
   * @param timeoutMs      - Maximum wait time before returning '' (default 400ms)
   * @returns Formatted [LEARNED CONTEXT] block, or '' if none/timeout/error
   */
  async getLearnedContextBlock(
    userDid: string,
    problemSetId: string | null,
    messageContent: string,
    timeoutMs = 400,
  ): Promise<string> {
    try {
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(''), timeoutMs),
      );
      return await Promise.race([
        timeoutPromise,
        this._doRetrieval(userDid, problemSetId, messageContent),
      ]);
    } catch {
      return '';
    }
  }

  /**
   * Internal: perform embedding + semantic search + context block assembly.
   * Wrapped in a Promise.race timeout by getLearnedContextBlock.
   */
  private async _doRetrieval(
    userDid: string,
    problemSetId: string | null,
    messageContent: string,
  ): Promise<string> {
    try {
      // Generate embedding for the incoming message
      const embedding = await generateConceptEmbedding(messageContent);

      // Graceful degradation when OPENAI_API_KEY is not set
      if (embedding === null) {
        return '';
      }

      // Search for top-5 semantically similar concepts
      const results = await conceptStore.semanticSearch(
        embedding,
        userDid,
        problemSetId,
        MAX_CONCEPTS,
      );

      // Filter out low-similarity matches
      const relevant = results.filter((r) => r.similarity > SIMILARITY_THRESHOLD);

      if (relevant.length === 0) {
        return '';
      }

      // Format each concept as a bullet with optional evolution note
      const bullets = relevant.map((concept) => {
        const textValue = this._extractText(concept);
        const bullet =
          `- ${concept.conceptKey} (confidence: ${concept.confidence.toFixed(2)}, v${concept.version}): ${textValue}`;

        if (concept.version > 1) {
          return `${bullet}\n  [Evolution: v1 → v${concept.version}]`;
        }

        return bullet;
      });

      const body = bullets.join('\n');
      const block = `[LEARNED CONTEXT]\n${body}\n[/LEARNED CONTEXT]`;

      // Hard-cap at ~500 tokens (~2000 characters)
      if (block.length > CONTEXT_CHAR_CAP) {
        return block.slice(0, CONTEXT_CHAR_CAP) + '...';
      }

      return block;
    } catch {
      return '';
    }
  }

  /**
   * Extract human-readable text from a concept's currentValue.
   * Concepts store their value as { text: string } or { value: string }.
   */
  private _extractText(concept: ConceptEntry): string {
    const val = concept.currentValue;
    if (typeof val.text === 'string') return val.text;
    if (typeof val.value === 'string') return val.value;
    return JSON.stringify(val);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const conceptRetrievalService = new ConceptRetrievalService();

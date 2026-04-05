/**
 * Concept Extraction Service
 *
 * Phase 66 Plan 03: Post-conversation extraction engine.
 *
 * Fires on idle timeout, thread switch, and drawer close (via frontend triggers).
 * Runs an LLM pass over thread messages using Claude Haiku, parses concept drafts,
 * and upserts them into the concept store with embeddings.
 *
 * Key behaviours:
 * - extractedThreads Set prevents double-extraction per process lifecycle
 * - Fire-and-forget — errors are logged, never thrown
 * - No minimum message count (per D-04)
 * - No rate limiting (per D-05)
 */

import Anthropic from '@anthropic-ai/sdk';
import { conceptStore, generateConceptEmbedding } from './concept-store.js';
import type { ConceptDraft } from './concept-types.js';
import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Extraction deduplication (in-memory per process)
// ---------------------------------------------------------------------------

const extractedThreads = new Set<string>();

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are reviewing a conversation between a military commander and their AI Chief of Staff (Ironclaw).

Extract key knowledge that should persist for future conversations:
1. Any NEW facts, assessments, or judgments discussed
2. Any REVISIONS to previously held understanding
3. Commander preferences or intent signals
4. Lessons learned from decisions or actions
5. Relationship dynamics between actors

For each extraction, provide:
- concept_key: canonical identifier (e.g., "actor:russia:naval_posture")
- concept_type: actor | situation | assessment | preference | lesson | intent | relationship
- value: the current understanding (2-3 sentences)
- confidence: 0.0-1.0
- supersedes: concept_key if this revises a prior understanding, null if new

Return a JSON array. Return empty array [] if no extractable knowledge.`;

// ---------------------------------------------------------------------------
// extractFromThread
// ---------------------------------------------------------------------------

/**
 * Extract concepts from a thread via LLM pass.
 *
 * @param threadId   - UUID of the thread to extract from
 * @param userDid    - DID of the thread owner (for concept attribution)
 * @param problemSetId - Problem set context (or null for global threads)
 * @returns Number of concepts upserted (0 if already extracted or no messages)
 */
async function extractFromThread(
  threadId: string,
  userDid: string,
  problemSetId: string | null,
): Promise<number> {
  // Deduplication guard
  if (extractedThreads.has(threadId)) {
    return 0;
  }
  extractedThreads.add(threadId);

  try {
    const pool = getPool();

    // Load messages for this thread
    const result = await pool.query(
      `SELECT sender, content
       FROM ironclaw_chat
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId],
    );

    // Map sender values to LLM-compatible role labels
    const messages = result.rows
      .filter((row) => row.content && (row.content as string).trim().length > 0)
      .map((row) => ({
        role: (row.sender as string) === 'user' ? 'user' : 'assistant',
        content: row.content as string,
      }));

    if (messages.length === 0) {
      return 0;
    }

    // LLM extraction pass
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + '\n\nConversation:\n' + JSON.stringify(messages),
        },
      ],
    });

    // Parse response
    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');

    let drafts: ConceptDraft[] = [];
    try {
      // Find JSON array in response (may be wrapped in markdown code block)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        drafts = JSON.parse(jsonMatch[0]) as ConceptDraft[];
      }
    } catch (parseErr) {
      // Malformed output produces zero concepts — not an error (per T-66-08)
      console.warn('[concept-extraction] Failed to parse LLM output, skipping:', parseErr);
      return 0;
    }

    if (!Array.isArray(drafts) || drafts.length === 0) {
      return 0;
    }

    // Upsert each concept draft
    let upsertCount = 0;
    for (const draft of drafts) {
      try {
        // Validate required fields
        if (!draft.concept_key || !draft.concept_type || !draft.value) {
          continue;
        }

        const embedding = await generateConceptEmbedding(draft.value);

        await conceptStore.upsertConcept({
          problemSetId,
          userDid,
          conceptKey: draft.concept_key,
          conceptType: draft.concept_type,
          value: { text: draft.value },
          confidence: typeof draft.confidence === 'number' ? draft.confidence : 0.5,
          sourceThreadId: threadId,
          embedding,
        });

        upsertCount++;
      } catch (upsertErr) {
        // Log but continue with remaining concepts
        console.error('[concept-extraction] Failed to upsert concept:', upsertErr);
      }
    }

    console.log(`[concept-extraction] Extracted ${upsertCount} concepts from thread ${threadId}`);
    return upsertCount;
  } catch (err) {
    // Fire-and-forget: log errors, never throw
    console.error('[concept-extraction] extractFromThread error:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const conceptExtractionService = { extractFromThread };

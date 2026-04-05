/**
 * Concept Consolidation Job
 *
 * Phase 66 Plan 06: Scheduled cross-thread consolidation of versioned concepts.
 *
 * Runs every 6 hours. For each concept_key with 2+ active versions from different
 * source threads, uses Claude Haiku to synthesize a merged understanding. If versions
 * contradict each other, the contradiction is flagged in the stored value.
 *
 * Key behaviours:
 * - 5-minute startup delay (lets system stabilize before first run)
 * - Contradictions are stored as { text, contradicted: true, perspectives: [...] }
 * - All consolidated versions have source_thread_id = 'consolidation'
 * - Null problem_set_id in getConsolidationCandidates fetches across all problem sets
 *
 * Threat model:
 * - T-66-14: LLM-synthesized values stored via parameterized queries — never eval'd
 */

import Anthropic from '@anthropic-ai/sdk';
import { conceptStore, generateConceptEmbedding } from './concept-store.js';
import type { ConceptEntry } from './concept-types.js';
import { sidecarSyncService } from './sidecar-sync.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSOLIDATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Anthropic client (lazy, mirrors concept-extraction.ts pattern)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// ---------------------------------------------------------------------------
// LLM merge prompt
// ---------------------------------------------------------------------------

function buildMergePrompt(conceptKey: string, versions: ConceptEntry[]): string {
  const versionLines = versions
    .map(
      (v) =>
        `v${v.version} (thread ${v.sourceThreadId ?? 'unknown'}): ${JSON.stringify(v.currentValue)}`,
    )
    .join('\n');

  return `You are synthesizing multiple versions of the same concept from different conversations.

Concept key: ${conceptKey}
Versions:
${versionLines}

Instructions:
1. If versions AGREE: Synthesize into a single comprehensive understanding. Set confidence to the highest version's confidence + 0.05 (capped at 1.0).
2. If versions CONTRADICT: Set status to "contradicted" in your response. Include both perspectives. Set confidence to 0.5.

Return JSON only (no markdown):
{ "value": "synthesized understanding", "confidence": 0.0, "contradicted": true }`;
}

// ---------------------------------------------------------------------------
// runConsolidation
// ---------------------------------------------------------------------------

/**
 * Execute one consolidation pass across all concept keys with 2+ active
 * versions from different threads.
 *
 * Returns summary counts for logging.
 */
export async function runConsolidation(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[ironclaw] consolidation: ANTHROPIC_API_KEY not set — skipping');
    return;
  }

  // Fetch all consolidation candidates across all problem sets (null = all)
  const candidates = await conceptStore.getConsolidationCandidates(null);

  if (candidates.length === 0) {
    console.log('[ironclaw] consolidation: no candidates found');
    return;
  }

  let consolidated = 0;
  let contradictions = 0;
  let errors = 0;

  for (const candidate of candidates) {
    try {
      // We need to determine which problem set to pass to getVersionChain.
      // getConsolidationCandidates(null) returns candidates across all problem sets.
      // We'll use null here and let the version chain query handle it.
      // NOTE: If a concept_key exists in multiple problem sets, this is still safe —
      // each (userDid, conceptKey) pair is unique in the candidate list (grouped by both).
      const allVersions = await conceptStore.getVersionChain(
        candidate.userDid,
        candidate.conceptKey,
        null,
      );

      // Only consider active versions from different threads
      const activeVersions = allVersions.filter(
        (v) =>
          v.status === 'active' &&
          v.sourceThreadId != null &&
          v.sourceThreadId !== 'consolidation',
      );

      const uniqueThreads = new Set(activeVersions.map((v) => v.sourceThreadId));
      if (uniqueThreads.size < 2) {
        // No longer qualifies — skip
        continue;
      }

      // Use latest active version to carry forward metadata
      const latestVersion = activeVersions[activeVersions.length - 1];

      // Build and send LLM merge prompt
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: buildMergePrompt(candidate.conceptKey, activeVersions),
          },
        ],
      });

      const rawText =
        response.content[0].type === 'text' ? response.content[0].text.trim() : '';

      let mergedValue: string;
      let mergedConfidence: number;
      let isContradicted: boolean;

      try {
        // Strip any accidental markdown fences
        const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(jsonText) as {
          value: string;
          confidence: number;
          contradicted?: boolean;
        };

        mergedValue = parsed.value ?? '';
        mergedConfidence = Math.min(1.0, Math.max(0.0, parsed.confidence ?? 0.5));
        isContradicted = parsed.contradicted === true;
      } catch {
        // If LLM returned unparseable text, treat as low-confidence non-contradiction
        console.warn(
          `[ironclaw] consolidation: failed to parse LLM response for ${candidate.conceptKey}`,
        );
        mergedValue = rawText;
        mergedConfidence = 0.4;
        isContradicted = false;
      }

      if (isContradicted) {
        contradictions++;
        console.warn(
          `[ironclaw] consolidation: contradiction detected for ${candidate.conceptKey}`,
        );
      }

      // Build the stored value with contradiction metadata if needed
      const storedValue: Record<string, unknown> = {
        text: mergedValue,
        contradicted: isContradicted,
      };

      if (isContradicted) {
        // Preserve both perspectives in the stored value for audit trail (T-66-15)
        storedValue.perspectives = activeVersions.map((v) => ({
          thread: v.sourceThreadId,
          version: v.version,
          value: v.currentValue,
        }));
      }

      // Generate embedding for the merged text
      const embedding = await generateConceptEmbedding(mergedValue);

      // Upsert consolidated version — creates a new version superseding the active ones
      const consolidatedConcept = await conceptStore.upsertConcept({
        problemSetId: latestVersion.problemSetId,
        userDid: candidate.userDid,
        conceptKey: candidate.conceptKey,
        conceptType: latestVersion.conceptType,
        value: storedValue,
        confidence: mergedConfidence,
        sourceThreadId: 'consolidation',
        embedding,
      });

      // Push consolidated concept to sidecar (best-effort)
      await sidecarSyncService.pushConceptToSidecar(consolidatedConcept);

      consolidated++;
    } catch (err) {
      errors++;
      console.error(
        `[ironclaw] consolidation: error processing ${candidate.conceptKey}:`,
        err,
      );
    }
  }

  console.log(
    `[ironclaw] consolidation: processed ${candidates.length} candidates, ` +
      `${consolidated} consolidated, ${contradictions} contradictions, ${errors} errors`,
  );
}

// ---------------------------------------------------------------------------
// startConsolidationJob
// ---------------------------------------------------------------------------

/**
 * Start the concept consolidation background job.
 *
 * Runs once after a 5-minute startup delay (system stabilization), then
 * every 6 hours thereafter.
 *
 * Call once during application startup.
 */
export function startConsolidationJob(): void {
  console.log('[ironclaw] starting concept consolidation job (6h interval)');

  // Run once on startup after 5-minute delay (let system stabilize)
  setTimeout(() => {
    runConsolidation().catch((err) =>
      console.error('[ironclaw] consolidation error:', err),
    );
  }, STARTUP_DELAY_MS);

  // Then every 6 hours
  setInterval(() => {
    runConsolidation().catch((err) =>
      console.error('[ironclaw] consolidation error:', err),
    );
  }, CONSOLIDATION_INTERVAL_MS);
}

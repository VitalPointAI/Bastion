/**
 * Ironclaw Memory Retrieval Service
 *
 * Phase 57 Plan 02: Intelligence layer that reads from memory stores (Plan 01),
 * computes behavioral signals, and injects personalized context into every
 * Ironclaw AI interaction.
 *
 * Exports:
 *   - memoryRetrievalService (singleton)
 *
 * Key behaviors:
 *   - assembleMemoryBlock(): formats memory from both user and context scopes,
 *     with 200ms timeout protection and 1300 character hard cap
 *   - deriveAdaptivePreferences(): computes behavioral signals from 30-day
 *     interaction outcome history
 *   - recordOutcome(): fire-and-forget pass-through to ironclawOutcomeStore
 */

import {
  ironclawUserMemoryStore,
  ironclawContextMemoryStore,
  ironclawOutcomeStore,
} from './ironclaw-memory-store.js';
import type { AdaptivePreferences } from './ironclaw-memory-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEMORY_CHAR_CAP = 1300;
const MAX_USER_MEMORIES = 8;
const MAX_CONTEXT_MEMORIES = 8;
const OUTCOME_WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// MemoryRetrievalService
// ---------------------------------------------------------------------------

export class MemoryRetrievalService {
  /**
   * Assemble a memory block string for injection into AI messages.
   *
   * - Returns '' if retrieval takes longer than timeoutMs (MEM-05)
   * - Returns '' if no memories exist for the user or problem set
   * - Hard-caps output at 1300 chars with '...' suffix (MEM-06)
   * - Returns '' on any error (fault-tolerant — never blocks message flow)
   *
   * @param userDid       - The user's DID
   * @param problemSetId  - The current problem set ID (null for global context)
   * @param timeoutMs     - Maximum wait time before returning '' (default 200ms)
   */
  async assembleMemoryBlock(
    userDid: string,
    problemSetId: string | null,
    timeoutMs = 200,
  ): Promise<string> {
    try {
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(''), timeoutMs),
      );

      const buildPromise = this._buildBlock(userDid, problemSetId);

      return await Promise.race([buildPromise, timeoutPromise]);
    } catch {
      return '';
    }
  }

  /**
   * Build the full memory block string from all available sources.
   * Called internally by assembleMemoryBlock inside a Promise.race.
   */
  private async _buildBlock(
    userDid: string,
    problemSetId: string | null,
  ): Promise<string> {
    // Fetch user memories and context memories in parallel
    const [userMemories, contextMemories, outcomeCounts] = await Promise.all([
      ironclawUserMemoryStore.getActiveMemories(userDid),
      problemSetId
        ? ironclawContextMemoryStore.getActiveMemories(problemSetId)
        : Promise.resolve([]),
      ironclawOutcomeStore.getOutcomeCounts(userDid, OUTCOME_WINDOW_DAYS),
    ]);

    // Take top N memories by recency (stores already order by updated_at DESC)
    const topUserMemories = userMemories.slice(0, MAX_USER_MEMORIES);
    const topContextMemories = contextMemories.slice(0, MAX_CONTEXT_MEMORIES);

    // If no memories at all, return empty string
    const hasContent =
      topUserMemories.length > 0 || topContextMemories.length > 0;
    if (!hasContent) return '';

    const sections: string[] = [];

    // User preferences section
    if (topUserMemories.length > 0) {
      const lines = topUserMemories.map((m) => {
        const val =
          typeof m.memory_value.value !== 'undefined'
            ? String(m.memory_value.value)
            : JSON.stringify(m.memory_value);
        return `- ${m.memory_key}: ${val}`;
      });
      sections.push(`## User Preferences (persistent)\n${lines.join('\n')}`);
    }

    // Problem set context section
    if (topContextMemories.length > 0) {
      const lines = topContextMemories.map((m) => {
        const val =
          typeof m.memory_value.value !== 'undefined'
            ? String(m.memory_value.value)
            : JSON.stringify(m.memory_value);
        return `- ${m.memory_key}: ${val}`;
      });
      sections.push(`## Problem Set Memory\n${lines.join('\n')}`);
    }

    // Behavioral Adaptation section — only when outcome history exists
    const totalOutcomes = Object.values(outcomeCounts).reduce((a, b) => a + b, 0);
    if (totalOutcomes > 0) {
      const prefs = this._computePreferences(outcomeCounts);
      const adaptationLines = [
        `- proactivityLevel: ${prefs.proactivityLevel}`,
        `- critiqueFrequency: ${prefs.critiqueFrequency}`,
        `- prefersDraftFirst: ${prefs.prefersDraftFirst}`,
      ];
      sections.push(`## Behavioral Adaptation\n${adaptationLines.join('\n')}`);
    }

    const block = sections.join('\n\n');

    // Hard cap at 1300 chars
    if (block.length > MEMORY_CHAR_CAP) {
      return block.slice(0, MEMORY_CHAR_CAP) + '...';
    }

    return block;
  }

  /**
   * Derive adaptive behavioral preferences from interaction outcome counts.
   *
   * Reads outcome counts over the past 30 days and computes:
   * - proactivityLevel: based on suggestion rejection rate
   * - critiqueFrequency: based on edit-post-critique incorporation rate
   * - prefersDraftFirst: draft_accepted vs blank_page_preferred counts
   *
   * @param userDid - The user's DID
   */
  async deriveAdaptivePreferences(userDid: string): Promise<AdaptivePreferences> {
    const counts = await ironclawOutcomeStore.getOutcomeCounts(
      userDid,
      OUTCOME_WINDOW_DAYS,
    );
    return this._computePreferences(counts);
  }

  /**
   * Internal preference computation (synchronous — takes already-fetched counts).
   */
  private _computePreferences(
    counts: Record<string, number>,
  ): AdaptivePreferences {
    const rejected = counts['suggestion_rejected'] ?? 0;
    const accepted = counts['suggestion_accepted'] ?? 0;
    const editPostCritique = counts['edit_post_critique'] ?? 0;
    const draftAccepted = counts['draft_accepted'] ?? 0;
    const blankPagePreferred = counts['blank_page_preferred'] ?? 0;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rejectionRate = rejected / Math.max(total, 1);
    const incorporationRate = editPostCritique / Math.max(accepted, 1);

    // Proactivity level: how often suggestions are accepted vs rejected
    let proactivityLevel: AdaptivePreferences['proactivityLevel'];
    if (rejectionRate > 0.6) {
      proactivityLevel = 'low';
    } else if (rejectionRate < 0.2) {
      proactivityLevel = 'high';
    } else {
      proactivityLevel = 'medium';
    }

    // Critique frequency: how often user edits after critique feedback
    let critiqueFrequency: AdaptivePreferences['critiqueFrequency'];
    if (incorporationRate > 0.7) {
      critiqueFrequency = 'high';
    } else if (incorporationRate < 0.3) {
      critiqueFrequency = 'low';
    } else {
      critiqueFrequency = 'medium';
    }

    // Draft preference: user prefers getting a draft over starting blank
    const prefersDraftFirst = draftAccepted > blankPagePreferred;

    return { proactivityLevel, critiqueFrequency, prefersDraftFirst };
  }

  /**
   * Record an interaction outcome (fire-and-forget pass-through).
   *
   * This is the public API for callers who want to record outcomes without
   * coupling to the outcome store directly. Error handling is the caller's
   * responsibility (use .catch() for fire-and-forget patterns).
   */
  async recordOutcome(
    userDid: string,
    problemSetId: string | null,
    outcomeType: string,
    context: Record<string, unknown> | null,
  ): Promise<void> {
    await ironclawOutcomeStore.recordOutcome(userDid, problemSetId, outcomeType, context);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const memoryRetrievalService = new MemoryRetrievalService();

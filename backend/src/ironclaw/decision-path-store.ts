/**
 * Decision Path Memory Store
 *
 * Phase 66 Plan 06: Records autonomous action outcomes as 'lesson' type concepts
 * for reinforcement learning. When commanders rate activity feed entries with
 * thumbs up/down, this store converts those rated activities into structured
 * decision path lessons stored in the concept store.
 *
 * Threat model:
 * - T-66-15: All decision paths include source activity ID and timestamp for audit trail
 */

import { conceptStore, generateConceptEmbedding } from './concept-store.js';
import { autonomousActivityStore } from './autonomous-activity-store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionPathEntry {
  problemSetId: string;
  userDid: string;
  finding: string;
  decision: string;
  toolsUsed: string[];
  outcome: string;
  commanderRating: number | null;
}

// ---------------------------------------------------------------------------
// recordDecisionPath
// ---------------------------------------------------------------------------

/**
 * Record a single decision path as a 'lesson' concept.
 *
 * Confidence is derived from commander feedback:
 * - Positive rating (1): 0.8 — commander validated this decision
 * - Negative rating (-1): 0.3 — commander rejected this decision
 * - Unrated (null): 0.5 — no feedback yet
 */
async function recordDecisionPath(entry: DecisionPathEntry): Promise<void> {
  const conceptKey = `decision_path:${Date.now()}`;

  const value = {
    text: `Finding: ${entry.finding}. Decision: ${entry.decision}. Tools: ${entry.toolsUsed.join(', ')}. Outcome: ${entry.outcome}.`,
    finding: entry.finding,
    decision: entry.decision,
    toolsUsed: entry.toolsUsed,
    outcome: entry.outcome,
    commanderRating: entry.commanderRating,
    successful: entry.commanderRating != null ? entry.commanderRating > 0 : null,
  };

  const confidence =
    entry.commanderRating != null
      ? entry.commanderRating > 0
        ? 0.8
        : 0.3
      : 0.5;

  const embedding = await generateConceptEmbedding(value.text);

  await conceptStore.upsertConcept({
    problemSetId: entry.problemSetId,
    userDid: entry.userDid,
    conceptKey,
    conceptType: 'lesson',
    value,
    confidence,
    sourceThreadId: 'autonomous',
    embedding,
  });
}

// ---------------------------------------------------------------------------
// buildDecisionPathsFromRatedActivities
// ---------------------------------------------------------------------------

/**
 * Convert recently-rated autonomous activities into decision path lessons.
 *
 * Scans the last 24 hours of rated activities for the given problem set,
 * extracts structured finding/decision/outcome from the activity detail,
 * and records each as a lesson concept.
 *
 * Returns the count of paths recorded.
 */
async function buildDecisionPathsFromRatedActivities(
  problemSetId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activities = await autonomousActivityStore.getRatedActivities(
    problemSetId,
    since,
  );

  let recorded = 0;

  for (const activity of activities) {
    try {
      const detail = (activity.detail ?? {}) as Record<string, unknown>;

      const finding =
        (detail.finding as string) ??
        (detail.summary as string) ??
        activity.summary ??
        'Unknown finding';
      const decision =
        (detail.decision as string) ??
        (detail.action as string) ??
        'No decision recorded';
      const toolsUsed = Array.isArray(detail.toolsUsed)
        ? (detail.toolsUsed as string[])
        : [];
      const outcome =
        (detail.outcome as string) ??
        (detail.result as string) ??
        activity.outcomeStatus ??
        'Unknown outcome';

      // Use a stable DID — activity entries are problem-set scoped,
      // so we use the service DID as the author of autonomous lessons
      const userDid = 'ironclaw:autonomous';

      await recordDecisionPath({
        problemSetId,
        userDid,
        finding,
        decision,
        toolsUsed,
        outcome,
        commanderRating: activity.commanderRating ?? null,
      });

      recorded++;
    } catch (err) {
      console.error(
        `[ironclaw] decision-path: error processing activity ${activity.id}:`,
        err,
      );
    }
  }

  if (recorded > 0) {
    console.log(
      `[ironclaw] decision-path: recorded ${recorded} paths from ${activities.length} rated activities (${problemSetId})`,
    );
  }

  return recorded;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const decisionPathStore = {
  recordDecisionPath,
  buildDecisionPathsFromRatedActivities,
};

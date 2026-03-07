/**
 * Feed Priority Algorithm
 *
 * Phase 29 Plan 02: Ranks feed items by priority weight, then urgency
 * weight, then timestamp (newest first). Includes WebSocket batching
 * to prevent flooding (per RESEARCH.md pitfall 4).
 */

import type { AIFeedItemRow, FeedPriority, FeedUrgency } from './ai-staff-types.js';

// ---------------------------------------------------------------------------
// Weight maps
// ---------------------------------------------------------------------------

const PRIORITY_WEIGHT: Record<FeedPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const URGENCY_WEIGHT: Record<FeedUrgency, number> = {
  action_required: 3,
  attention: 2,
  info: 1,
};

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Sort feed items by priority (descending), then urgency (descending),
 * then created_at (newest first).
 */
export function rankFeedItems(items: AIFeedItemRow[]): AIFeedItemRow[] {
  return [...items].sort((a, b) => {
    // 1. Priority weight (higher = more important)
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // 2. Urgency weight (higher = more urgent)
    const urgencyDiff = URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // 3. Timestamp (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ---------------------------------------------------------------------------
// WebSocket batching
// ---------------------------------------------------------------------------

/**
 * Group items that fall within the same time window to prevent
 * WebSocket flooding. Items within `windowMs` of each other are
 * batched together.
 *
 * Items must be sorted by created_at ascending before batching.
 * Returns an array of batches, each batch is an array of items.
 */
export function batchForWebSocket(
  items: AIFeedItemRow[],
  windowMs: number = 2000,
): AIFeedItemRow[][] {
  if (items.length === 0) return [];

  // Sort by timestamp ascending for batching
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const batches: AIFeedItemRow[][] = [];
  let currentBatch: AIFeedItemRow[] = [sorted[0]];
  let batchStart = new Date(sorted[0].created_at).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const itemTime = new Date(sorted[i].created_at).getTime();
    if (itemTime - batchStart <= windowMs) {
      currentBatch.push(sorted[i]);
    } else {
      batches.push(currentBatch);
      currentBatch = [sorted[i]];
      batchStart = itemTime;
    }
  }

  // Push the last batch
  batches.push(currentBatch);

  return batches;
}

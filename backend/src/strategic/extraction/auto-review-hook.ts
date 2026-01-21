/**
 * Auto-Review Hook
 *
 * Hooks into the extraction completion flow to trigger automatic agent reviews
 * for documents with autoReview enabled in their assignments.
 *
 * This module provides the integration between objective extraction and
 * the Strategy Document Reviewer agent.
 */

import { assignmentStore } from '../assignments/index.js';
import { reviewStore } from '../reviews/store.js';
import { getStrategyReviewerExecutor } from '../agents/strategy-reviewer-executor.js';

/**
 * Auto-review result.
 */
export interface AutoReviewResult {
  triggered: boolean;
  assignmentId?: string;
  reviewId?: string;
  error?: string;
}

/**
 * Trigger auto-review for a document if configured.
 *
 * Called after extraction completes to check for auto-review assignments
 * and trigger the Strategy Document Reviewer agent.
 *
 * @param documentId - The document that was extracted
 * @returns Auto-review result indicating if review was triggered
 */
export async function triggerAutoReview(documentId: string): Promise<AutoReviewResult> {
  try {
    // Get active assignments for this document
    const assignments = await assignmentStore.getAssignmentsForDocument(documentId);

    // Find an assignment with autoReview enabled
    const autoReviewAssignment = assignments.find(a => a.autoReview);

    if (!autoReviewAssignment) {
      console.log(`[auto-review] No auto-review assignment for document ${documentId}`);
      return { triggered: false };
    }

    console.log(
      `[auto-review] Triggering auto-review for document ${documentId} ` +
      `via assignment ${autoReviewAssignment.id}`
    );

    // Execute the review
    const executor = getStrategyReviewerExecutor();
    const report = await executor.reviewDocument(
      documentId,
      autoReviewAssignment.reviewOptions
    );

    // Save the review
    await reviewStore.saveReview(report);

    // Update the assignment with the review info
    await assignmentStore.recordReview(autoReviewAssignment.id, report.id);

    console.log(`[auto-review] Review ${report.id} created for document ${documentId}`);

    return {
      triggered: true,
      assignmentId: autoReviewAssignment.id,
      reviewId: report.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[auto-review] Failed for document ${documentId}: ${message}`);
    return {
      triggered: false,
      error: message,
    };
  }
}

/**
 * Check if a document has auto-review configured.
 *
 * @param documentId - The document to check
 * @returns True if auto-review is configured
 */
export async function hasAutoReview(documentId: string): Promise<boolean> {
  const assignments = await assignmentStore.getAssignmentsForDocument(documentId);
  return assignments.some(a => a.autoReview);
}

/**
 * Get all documents with auto-review enabled.
 *
 * Useful for batch processing or monitoring.
 *
 * @returns List of document IDs with auto-review enabled
 */
export async function getAutoReviewDocuments(): Promise<string[]> {
  const assignments = await assignmentStore.getAutoReviewAssignments();
  return [...new Set(assignments.map(a => a.documentId))];
}

/**
 * Process pending auto-reviews.
 *
 * Triggers reviews for all documents that have:
 * 1. Auto-review enabled
 * 2. No recent review (within the last 24 hours)
 *
 * This can be called from a cron job or worker process.
 *
 * @returns Results for each document processed
 */
export async function processPendingAutoReviews(): Promise<Map<string, AutoReviewResult>> {
  const results = new Map<string, AutoReviewResult>();
  const documentIds = await getAutoReviewDocuments();

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24);

  for (const documentId of documentIds) {
    // Check if there's a recent review
    const latestReview = await reviewStore.getLatestReview(documentId);

    if (latestReview && new Date(latestReview.reviewedAt) > cutoffTime) {
      results.set(documentId, {
        triggered: false,
        reviewId: latestReview.id,
      });
      continue;
    }

    // Trigger auto-review
    const result = await triggerAutoReview(documentId);
    results.set(documentId, result);
  }

  return results;
}

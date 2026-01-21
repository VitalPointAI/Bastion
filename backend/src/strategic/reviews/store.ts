/**
 * Strategy Review Store
 *
 * Manages persistence of strategy review reports.
 * In-memory storage for now; can be extended to PostgreSQL.
 */

import type {
  StrategyReviewReport,
  ReviewStatus,
  CategoryAssessment,
} from './types.js';

/**
 * Review Store - manages review report persistence.
 */
export class ReviewStore {
  private reviews: Map<string, StrategyReviewReport> = new Map();
  private documentReviews: Map<string, string[]> = new Map(); // documentId -> reviewIds

  /**
   * Save a review report.
   */
  async saveReview(review: StrategyReviewReport): Promise<void> {
    this.reviews.set(review.id, review);

    // Index by document
    const docReviews = this.documentReviews.get(review.documentId) || [];
    if (!docReviews.includes(review.id)) {
      docReviews.push(review.id);
      this.documentReviews.set(review.documentId, docReviews);
    }
  }

  /**
   * Get a review by ID.
   */
  async getReview(reviewId: string): Promise<StrategyReviewReport | null> {
    return this.reviews.get(reviewId) || null;
  }

  /**
   * Get all reviews for a document.
   */
  async getReviewsForDocument(documentId: string): Promise<StrategyReviewReport[]> {
    const reviewIds = this.documentReviews.get(documentId) || [];
    const reviews: StrategyReviewReport[] = [];

    for (const id of reviewIds) {
      const review = this.reviews.get(id);
      if (review) {
        reviews.push(review);
      }
    }

    // Sort by date, newest first
    return reviews.sort(
      (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()
    );
  }

  /**
   * Get the latest review for a document.
   */
  async getLatestReview(documentId: string): Promise<StrategyReviewReport | null> {
    const reviews = await this.getReviewsForDocument(documentId);
    return reviews.length > 0 ? reviews[0] : null;
  }

  /**
   * Update review status.
   */
  async updateStatus(
    reviewId: string,
    status: ReviewStatus,
    actorDID: string,
    reason?: string
  ): Promise<StrategyReviewReport | null> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return null;
    }

    review.status = status;

    if (status === 'accepted') {
      review.acceptedAt = new Date();
      review.acceptedBy = actorDID;
    } else if (status === 'rejected') {
      review.rejectedAt = new Date();
      review.rejectedBy = actorDID;
      review.rejectionReason = reason;
    }

    this.reviews.set(reviewId, review);
    return review;
  }

  /**
   * Accept specific category suggestions from a review.
   * Returns the IDs of objectives that were updated.
   */
  async acceptPartialSuggestions(
    reviewId: string,
    objectiveIds: string[],
    actorDID: string
  ): Promise<string[]> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return [];
    }

    // Filter assessments to only the specified objectives
    const acceptedAssessments = review.categoryAssessments.filter(
      a => objectiveIds.includes(a.objectiveId)
    );

    // Update review status to partial if not all accepted
    if (acceptedAssessments.length < review.categoryAssessments.length) {
      review.status = 'partial';
    } else {
      review.status = 'accepted';
      review.acceptedAt = new Date();
      review.acceptedBy = actorDID;
    }

    this.reviews.set(reviewId, review);

    return acceptedAssessments.map(a => a.objectiveId);
  }

  /**
   * List all reviews with optional filters.
   */
  async listReviews(options?: {
    status?: ReviewStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ reviews: StrategyReviewReport[]; total: number }> {
    let reviews = Array.from(this.reviews.values());

    // Filter by status
    if (options?.status) {
      reviews = reviews.filter(r => r.status === options.status);
    }

    // Sort by date
    reviews.sort(
      (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()
    );

    const total = reviews.length;

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    reviews = reviews.slice(offset, offset + limit);

    return { reviews, total };
  }

  /**
   * Get pending reviews count.
   */
  async getPendingCount(): Promise<number> {
    return Array.from(this.reviews.values()).filter(
      r => r.status === 'pending_review'
    ).length;
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId: string): Promise<boolean> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return false;
    }

    // Remove from document index
    const docReviews = this.documentReviews.get(review.documentId) || [];
    const idx = docReviews.indexOf(reviewId);
    if (idx !== -1) {
      docReviews.splice(idx, 1);
      this.documentReviews.set(review.documentId, docReviews);
    }

    this.reviews.delete(reviewId);
    return true;
  }
}

// Singleton instance
let storeInstance: ReviewStore | null = null;

/**
 * Get or create the review store singleton.
 */
export function getReviewStore(): ReviewStore {
  if (!storeInstance) {
    storeInstance = new ReviewStore();
  }
  return storeInstance;
}

// Export singleton for convenience
export const reviewStore = getReviewStore();

/**
 * LangGraph Agent State Definitions
 *
 * Defines TypedDict state for LangGraph agents using Annotation.
 */

import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { MidlifeCategory } from '../../strategic/schemas/dime.js';
import type { Priority } from '../../strategic/schemas/strategic-objective.js';

// ============================================================================
// Objective Types
// ============================================================================

/**
 * Strategic objective for review.
 */
export interface ReviewObjective {
  id: string;
  description: string;
  primaryInstrument?: string;
  currentMidlifeCategory?: MidlifeCategory;
  currentPriority?: Priority;
  status?: string;
}

// ============================================================================
// Assessment Types
// ============================================================================

/**
 * Category assessment from MIDLIFE analysis.
 */
export interface CategoryAssessment {
  objectiveId: string;
  suggestedCategory: MidlifeCategory;
  currentCategory?: MidlifeCategory;
  confidence: number;
  rationale: string;
  requiresHumanReview: boolean;
}

/**
 * Priority assessment from domain prioritization.
 */
export interface PriorityAssessment {
  objectiveId: string;
  suggestedPriority: Priority;
  currentPriority: Priority;
  score: number;
  rationale: string;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Document summary from review.
 */
export interface DocumentSummary {
  totalObjectives: number;
  categoryDistribution: Record<MidlifeCategory, number>;
  coherenceScore: number;
  flags: string[];
}

/**
 * Strategy review report.
 */
export interface StrategyReviewReport {
  id: string;
  documentId: string;
  reviewedAt: Date;
  reviewedBy: string;
  categoryAssessments: CategoryAssessment[];
  priorityAssessments: PriorityAssessment[];
  documentSummary: DocumentSummary;
  status: 'pending_review' | 'accepted' | 'rejected' | 'partial';
}

// ============================================================================
// Strategy Reviewer State
// ============================================================================

/**
 * State for the Strategy Document Reviewer agent.
 * Uses LangGraph Annotation for type-safe state management.
 */
export const StrategyReviewerState = Annotation.Root({
  // === Input ===
  /** Document being reviewed */
  documentId: Annotation<string>,

  /** Objectives loaded from document */
  objectives: Annotation<ReviewObjective[]>({
    reducer: (prev, next) => next, // Replace on update
    default: () => [],
  }),

  // === Agent Memory ===
  /** Conversation messages (LLM reasoning) */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // === Results ===
  /** MIDLIFE category assessments */
  categoryAssessments: Annotation<CategoryAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Priority assessments */
  priorityAssessments: Annotation<PriorityAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // === Progress Tracking ===
  /** Index of current objective being analyzed */
  currentObjectiveIndex: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),

  /** Total objectives to analyze */
  totalObjectives: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),

  // === Output ===
  /** Final review report */
  report: Annotation<StrategyReviewReport | null>({
    reducer: (prev, next) => next,
    default: () => null,
  }),

  /** Current execution status */
  status: Annotation<'loading' | 'analyzing' | 'prioritizing' | 'building_report' | 'complete' | 'error'>({
    reducer: (prev, next) => next,
    default: () => 'loading' as const,
  }),

  /** Error message if status is error */
  error: Annotation<string | null>({
    reducer: (prev, next) => next,
    default: () => null,
  }),
});

/**
 * Type for StrategyReviewerState.
 */
export type StrategyReviewerStateType = typeof StrategyReviewerState.State;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create initial state for strategy review.
 */
export function createInitialReviewState(documentId: string): StrategyReviewerStateType {
  return {
    documentId,
    objectives: [],
    messages: [],
    categoryAssessments: [],
    priorityAssessments: [],
    currentObjectiveIndex: 0,
    totalObjectives: 0,
    report: null,
    status: 'loading',
    error: null,
  };
}

/**
 * Create empty category distribution.
 */
export function createEmptyCategoryDistribution(): Record<MidlifeCategory, number> {
  return {
    MILITARY: 0,
    INFORMATION: 0,
    DIPLOMATIC: 0,
    LEGAL: 0,
    INTELLIGENCE: 0,
    FINANCIAL: 0,
    ECONOMIC: 0,
  };
}

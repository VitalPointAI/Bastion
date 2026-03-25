/**
 * Ironclaw Memory System Types
 *
 * Phase 57 Plan 01: Type definitions for the dual-scope persistent memory
 * system. Covers user memory, context memory, interaction outcomes, and
 * adaptive preferences.
 *
 * Uses const objects (not enums) per project convention (erasableSyntaxOnly).
 */

// ---------------------------------------------------------------------------
// Memory TTL Constants
// ---------------------------------------------------------------------------

/** User memory TTL: 90 days */
export const USER_MEMORY_TTL_DAYS = 90;

/** Context (problem set) memory TTL: 180 days */
export const CONTEXT_MEMORY_TTL_DAYS = 180;

// ---------------------------------------------------------------------------
// Memory Key Constants
// ---------------------------------------------------------------------------

export const MEMORY_KEYS = {
  WORKING_STYLE: 'working_style',
  CRITIQUE_TOLERANCE: 'critique_tolerance',
  DOMAIN_EXPERTISE: 'domain_expertise',
  COMMUNICATION_STYLE: 'communication_style',
  ADAPTIVE_BEHAVIOR: 'adaptive_behavior',
} as const;
export type MemoryKey = (typeof MEMORY_KEYS)[keyof typeof MEMORY_KEYS];

// ---------------------------------------------------------------------------
// Outcome Type Constants
// ---------------------------------------------------------------------------

export const OUTCOME_TYPES = {
  SUGGESTION_ACCEPTED: 'suggestion_accepted',
  SUGGESTION_REJECTED: 'suggestion_rejected',
  CORRECTION_MADE: 'correction_made',
  QUESTION_ASKED: 'question_asked',
  EDIT_POST_CRITIQUE: 'edit_post_critique',
  DRAFT_ACCEPTED: 'draft_accepted',
  BLANK_PAGE_PREFERRED: 'blank_page_preferred',
} as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[keyof typeof OUTCOME_TYPES];

// ---------------------------------------------------------------------------
// Memory Source
// ---------------------------------------------------------------------------

export type MemorySource = 'inferred' | 'explicit';

// ---------------------------------------------------------------------------
// User Memory Entry
// ---------------------------------------------------------------------------

/**
 * A single persisted user-scoped memory entry.
 * Keyed by (user_did, memory_key) — upsert semantics.
 */
export interface UserMemoryEntry {
  id: string;
  user_did: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  /** Confidence score 0.000–1.000 */
  confidence: number;
  source: MemorySource;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Context Memory Entry
// ---------------------------------------------------------------------------

/**
 * A single persisted problem-set-scoped memory entry.
 * Keyed by (problem_set_id, memory_key) — upsert semantics.
 */
export interface ContextMemoryEntry {
  id: string;
  problem_set_id: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  /** Number of sessions where this memory was observed/updated */
  session_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Interaction Outcome
// ---------------------------------------------------------------------------

/**
 * A recorded interaction outcome — used to adaptively learn user preferences
 * over time (acceptance rate, correction patterns, etc.).
 */
export interface InteractionOutcome {
  id: string;
  user_did: string;
  /** May be null for global (non-problem-set-specific) outcomes */
  problem_set_id: string | null;
  outcome_type: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Adaptive Preferences
// ---------------------------------------------------------------------------

/**
 * Derived view of adaptive preferences computed from memory entries.
 * This is NOT stored directly — it is assembled from UserMemoryEntry rows.
 */
export interface AdaptivePreferences {
  proactivityLevel: 'low' | 'medium' | 'high';
  critiqueFrequency: 'low' | 'medium' | 'high';
  prefersDraftFirst: boolean;
}

/**
 * Concept Store Types
 *
 * Phase 66 Plan 01: Type definitions for the versioned concept store.
 *
 * Concepts are the building blocks of Ironclaw's learned understanding.
 * Each concept is versioned — when understanding evolves, a new version is
 * created that supersedes the old one (never overwritten).
 */

// ---------------------------------------------------------------------------
// ConceptType
// ---------------------------------------------------------------------------

export type ConceptType =
  | 'actor'        // Understanding of a specific actor/entity
  | 'situation'    // Assessment of an operational situation
  | 'assessment'   // Analytical judgment or estimate
  | 'preference'   // Commander preference or working style
  | 'lesson'       // Lesson learned from an action or decision
  | 'intent'       // Commander intent or guidance
  | 'relationship' // Understanding of actor-to-actor dynamics
  | 'directive';   // Commander-set priority or constraint (Plan 66-09)

// ---------------------------------------------------------------------------
// ConceptEntry — a single version of a concept
// ---------------------------------------------------------------------------

export interface ConceptEntry {
  id: string;
  problemSetId: string | null;
  userDid: string;
  conceptKey: string;
  conceptType: ConceptType;
  currentValue: Record<string, unknown>;
  confidence: number;
  sourceThreadId: string | null;
  version: number;
  supersedesId: string | null;
  status: 'active' | 'retracted' | 'superseded';
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

// ---------------------------------------------------------------------------
// ConceptUpsertInput — input for creating/versioning a concept
// ---------------------------------------------------------------------------

export interface ConceptUpsertInput {
  problemSetId: string | null;
  userDid: string;
  conceptKey: string;
  conceptType: ConceptType;
  value: Record<string, unknown>;
  confidence: number;
  sourceThreadId: string | null;
  embedding: number[] | null;
}

// ---------------------------------------------------------------------------
// ConceptDraft — LLM-extracted concept (pre-store format)
// ---------------------------------------------------------------------------

export interface ConceptDraft {
  concept_key: string;
  concept_type: ConceptType;
  value: string;        // Human-readable description from LLM
  confidence: number;   // 0.0–1.0
  supersedes: string | null; // concept_key of prior concept this revises
}

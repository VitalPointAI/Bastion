/**
 * Design Interview Types
 *
 * Phase 55 Plan 01: Type definitions and coverage criteria for the Ironclaw
 * guided design interview system. Based on JP 5-0 operational design doctrine
 * and Strange's CG-CC-CR-CV framework.
 */

import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { OperationalDesign } from '../design/types.js';

// ============================================================================
// Section Type
// ============================================================================

export type DesignInterviewSection =
  | 'problem-framing'
  | 'cog-analysis'
  | 'loes'
  | 'operational-approach';

export type InterviewMode = 'new' | 'revision';

// ============================================================================
// Section Coverage
// ============================================================================

/**
 * Tracks doctrinal coverage for a section.
 * met = all required criteria satisfied OR user explicitly said "move on"
 */
export interface SectionCoverage {
  /** Whether the section meets minimum doctrinal coverage */
  met: boolean;
  /** All required criteria for this section */
  criteria: string[];
  /** Criteria that have been satisfied so far */
  metCriteria: string[];
}

/**
 * Doctrinal coverage criteria per section.
 * These define the minimum information required for each section to be
 * considered complete per JP 5-0 and Strange's CG-CC-CR-CV framework.
 */
export const SECTION_COVERAGE_CRITERIA: Record<DesignInterviewSection, string[]> = {
  'problem-framing': [
    'current_state',
    'desired_end_state',
    'problem_statement',
    'key_tensions',
    'obstacles',
  ],
  'cog-analysis': [
    'adversary_cog',
    'adversary_ccs',       // >= 2 critical capabilities
    'adversary_crs_per_cc', // at least one CR per CC
    'adversary_cvs',       // at least one CV identified
    'friendly_cog',
  ],
  'loes': [
    'loe_names',           // >= 2 lines of effort
    'loe_decisive_points', // decisive points for each LOE
    'loe_cog_links',       // LOE linkage to CoG analysis
  ],
  'operational-approach': [
    'phases',              // >= 2 operational phases
    'transitions',         // transition conditions between phases
    'decision_points',     // decision points per phase
  ],
};

/**
 * Sequential section order for the design interview.
 * Mirrors JP 5-0 operational design methodology.
 */
export const SECTION_ORDER: DesignInterviewSection[] = [
  'problem-framing',
  'cog-analysis',
  'loes',
  'operational-approach',
];

// ============================================================================
// State Annotation
// ============================================================================

/**
 * Design interview state tracks conversation messages, section progress,
 * coverage status, and the partially-derived operational design.
 */
export const DesignInterviewStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  /** Current interview section */
  currentSection: Annotation<DesignInterviewSection>({
    reducer: (_prev, next) => next,
    default: () => 'problem-framing' as DesignInterviewSection,
  }),

  /** Per-section coverage tracking */
  sectionCoverage: Annotation<Record<string, SectionCoverage>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),

  /** Partially-derived operational design built from interview answers */
  derivedDesign: Annotation<Partial<OperationalDesign>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),

  /** Interview mode: new walkthrough vs. revision of existing design */
  interviewMode: Annotation<InterviewMode>({
    reducer: (_prev, next) => next,
    default: () => 'new' as InterviewMode,
  }),

  /** Whether the interview is waiting for section confirmation from user */
  awaitingSectionConfirm: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** The problem set ID being designed */
  problemSetId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  /** Total questions asked across all sections */
  questionsAsked: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Whether the entire interview is complete (all 4 sections confirmed + narrative generated) */
  isComplete: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** Phase: 'start' for initial question, 'continue' for processing answer, 'confirm' for section advance */
  phase: Annotation<'start' | 'continue' | 'confirm'>({
    reducer: (_prev, next) => next,
    default: () => 'start' as 'start' | 'continue' | 'confirm',
  }),

  /**
   * Background research topics dispatched to the research agent.
   * Used to track what gaps have been queued for KG enrichment.
   */
  pendingResearch: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

// ============================================================================
// Meta type (for API responses — no messages)
// ============================================================================

/**
 * Lightweight metadata returned alongside AI messages.
 * Used for UI progress indicators and state restore.
 */
export interface FieldWrite {
  targetField: string;
  value: string | string[];
}

export interface DesignInterviewMeta {
  currentSection: DesignInterviewSection;
  sectionCoverage: Record<string, SectionCoverage>;
  questionsAsked: number;
  isComplete: boolean;
  interviewMode: InterviewMode;
  awaitingSectionConfirm: boolean;
  /** Field writes to apply to the design form — populated when derivedDesign changes */
  fieldWrites?: FieldWrite[];
}

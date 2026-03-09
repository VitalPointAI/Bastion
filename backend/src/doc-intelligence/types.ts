/**
 * Document Intelligence Team - Shared Types
 *
 * Foundation types for all specialist agents, the orchestrator, and UI.
 * Every specialist I/O contract, document taxonomy, and processing state
 * is defined here. Zod runtime validators in schemas.ts mirror these types.
 */

import type { NATORating } from './source-registry/nato-ratings.js';

// ============================================================================
// Document Type Taxonomy
// ============================================================================

/**
 * Document type taxonomy for triage classification.
 * The orchestrator assigns one of these based on LLM-driven analysis.
 */
export const DocumentType = {
  INTEL_ESTIMATE: 'INTEL_ESTIMATE',
  CONOP: 'CONOP',
  POLICY_PAPER: 'POLICY_PAPER',
  NEWS_ARTICLE: 'NEWS_ARTICLE',
  ACADEMIC_RESEARCH: 'ACADEMIC_RESEARCH',
  MILITARY_ORDER: 'MILITARY_ORDER',
  DIPLOMATIC_CABLE: 'DIPLOMATIC_CABLE',
  OSINT_REPORT: 'OSINT_REPORT',
  OTHER: 'OTHER',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

// ============================================================================
// Specialist Identifiers
// ============================================================================

/**
 * All specialist agent IDs in the document intelligence team.
 * Used for routing, logging, and result tracking.
 */
export const SpecialistId = {
  FORMAT_CONVERTER: 'format-converter',
  DOCUMENT_CLASSIFIER: 'document-classifier',
  FACT_EXTRACTOR: 'fact-extractor',
  OBJECTIVE_EXTRACTOR: 'objective-extractor',
  PERSPECTIVE_ANALYST: 'perspective-analyst',
  CROSS_DOC_LINKER: 'cross-doc-linker',
  BIAS_IDENTIFIER: 'bias-identifier',
  QUALITY_ASSESSOR: 'quality-assessor',
  TRUST_AGENT: 'trust-agent',
  RESEARCHER: 'researcher',
} as const;

export type SpecialistId = (typeof SpecialistId)[keyof typeof SpecialistId];

// ============================================================================
// Triage Decision
// ============================================================================

/**
 * Output of the orchestrator's LLM-driven triage step.
 * Determines document type, relevance, and which specialists to invoke.
 */
export interface TriageDecision {
  documentType: DocumentType;
  relevanceScore: number; // 0-1
  specialists: SpecialistId[];
  reasoning: string;
}

// ============================================================================
// Specialist Results
// ============================================================================

export type SpecialistStatus = 'success' | 'error' | 'skipped';

/**
 * Result from a single specialist agent execution.
 */
export interface SpecialistResult {
  specialistId: SpecialistId;
  status: SpecialistStatus;
  output: unknown;
  duration: number; // milliseconds
  error?: string;
}

// ============================================================================
// Processing State
// ============================================================================

/**
 * Processing state for a document moving through the intelligence pipeline.
 * Tracks which specialists have completed and the overall phase.
 */
export type ProcessingPhase =
  | 'queued'
  | 'triaging'
  | 'converting'
  | 'classifying'
  | 'extracting'
  | 'analyzing'
  | 'linking'
  | 'assessing'
  | 'assembling'
  | 'complete'
  | 'error';

export interface ProcessingState {
  documentId: string;
  problemSetId: string;
  triageDecision: TriageDecision | null;
  specialistResults: Map<SpecialistId, SpecialistResult>;
  currentPhase: ProcessingPhase;
  startedAt: string; // ISO datetime
  completedAt?: string; // ISO datetime
}

// ============================================================================
// Extracted Fact
// ============================================================================

export type FactType =
  | 'entity'
  | 'date'
  | 'location'
  | 'quantity'
  | 'assertion'
  | 'capability';

/**
 * A structured fact extracted from a document by the Fact Extractor specialist.
 */
export interface ExtractedFact {
  claim: string;
  type: FactType;
  confidence: number; // 0-1
  sourceReference: {
    page?: number;
    paragraph?: number;
    quote: string;
  };
  entities: string[];
  temporalContext?: string;
  geospatialContext?: string;
}

// ============================================================================
// Perspective Analysis
// ============================================================================

export type PerspectiveCategory =
  | 'friendly'
  | 'adversary'
  | 'neutral'
  | 'partner';

/**
 * Analysis from a single perspective (friendly/adversary/neutral/partner).
 */
export interface PerspectiveAnalysis {
  perspective: PerspectiveCategory;
  implications: string[];
  opportunities: string[];
  threats: string[];
  unknowns: string[];
}

// ============================================================================
// Bias Assessment
// ============================================================================

export type BiasSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Bias finding from the Bias Identifier specialist.
 */
export interface BiasAssessment {
  biasType: string;
  severity: BiasSeverity;
  evidence: string;
  recommendation: string;
}

// ============================================================================
// Cross-Document Link
// ============================================================================

export type LinkType =
  | 'corroborates'
  | 'contradicts'
  | 'extends'
  | 'references';

/**
 * A link between two documents discovered by the Cross-Document Linker.
 */
export interface CrossDocLink {
  sourceDocId: string;
  targetDocId: string;
  linkType: LinkType;
  strength: number; // 0-1
  evidence: string;
}

// ============================================================================
// Document Intelligence Report
// ============================================================================

/**
 * Unified report assembled by the orchestrator from all specialist outputs.
 * One report per document per problem set.
 */
export interface DocumentIntelligenceReport {
  documentId: string;
  problemSetId: string;
  triage: TriageDecision;
  facts: ExtractedFact[];
  perspectives: PerspectiveAnalysis[];
  biasFindings: BiasAssessment[];
  qualityRating: NATORating;
  crossDocLinks: CrossDocLink[];
  summary: string;
}

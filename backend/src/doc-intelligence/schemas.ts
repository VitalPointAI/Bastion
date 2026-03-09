/**
 * Document Intelligence Team - Zod Schemas
 *
 * Runtime validation schemas for all specialist I/O contracts.
 * These mirror the TypeScript types in types.ts but provide runtime
 * validation via Zod safeParse for untrusted inputs (LLM outputs,
 * API payloads, database reads).
 */

import { z } from 'zod';
import {
  NATORatingSchema,
  SourceReliabilitySchema,
  InformationCredibilitySchema,
} from './source-registry/nato-ratings.js';

// Re-export NATO schemas for convenience
export { NATORatingSchema, SourceReliabilitySchema, InformationCredibilitySchema };

// ============================================================================
// Document Type & Specialist Enums
// ============================================================================

export const DocumentTypeSchema = z.enum([
  'INTEL_ESTIMATE',
  'CONOP',
  'POLICY_PAPER',
  'NEWS_ARTICLE',
  'ACADEMIC_RESEARCH',
  'MILITARY_ORDER',
  'DIPLOMATIC_CABLE',
  'OSINT_REPORT',
  'OTHER',
]);

export const SpecialistIdSchema = z.enum([
  'format-converter',
  'document-classifier',
  'fact-extractor',
  'objective-extractor',
  'perspective-analyst',
  'cross-doc-linker',
  'bias-identifier',
  'quality-assessor',
  'trust-agent',
  'researcher',
]);

// ============================================================================
// Triage Decision
// ============================================================================

export const TriageDecisionSchema = z.object({
  documentType: DocumentTypeSchema,
  relevanceScore: z.number().min(0).max(1),
  specialists: z.array(SpecialistIdSchema),
  reasoning: z.string(),
});

// ============================================================================
// Extracted Fact
// ============================================================================

export const FactTypeSchema = z.enum([
  'entity',
  'date',
  'location',
  'quantity',
  'assertion',
  'capability',
]);

export const SourceReferenceSchema = z.object({
  page: z.number().int().optional(),
  paragraph: z.number().int().optional(),
  quote: z.string(),
});

export const ExtractedFactSchema = z.object({
  claim: z.string(),
  type: FactTypeSchema,
  confidence: z.number().min(0).max(1),
  sourceReference: SourceReferenceSchema,
  entities: z.array(z.string()),
  temporalContext: z.string().optional(),
  geospatialContext: z.string().optional(),
});

// ============================================================================
// Perspective Analysis
// ============================================================================

export const PerspectiveCategorySchema = z.enum([
  'friendly',
  'adversary',
  'neutral',
  'partner',
]);

export const PerspectiveAnalysisSchema = z.object({
  perspective: PerspectiveCategorySchema,
  implications: z.array(z.string()),
  opportunities: z.array(z.string()),
  threats: z.array(z.string()),
  unknowns: z.array(z.string()),
});

// ============================================================================
// Bias Assessment
// ============================================================================

export const BiasSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const BiasAssessmentSchema = z.object({
  biasType: z.string(),
  severity: BiasSeveritySchema,
  evidence: z.string(),
  recommendation: z.string(),
});

// ============================================================================
// Cross-Document Link
// ============================================================================

export const LinkTypeSchema = z.enum([
  'corroborates',
  'contradicts',
  'extends',
  'references',
]);

export const CrossDocLinkSchema = z.object({
  sourceDocId: z.string(),
  targetDocId: z.string(),
  linkType: LinkTypeSchema,
  strength: z.number().min(0).max(1),
  evidence: z.string(),
});

// ============================================================================
// Document Intelligence Report
// ============================================================================

export const DocumentIntelligenceReportSchema = z.object({
  documentId: z.string(),
  problemSetId: z.string(),
  triage: TriageDecisionSchema,
  facts: z.array(ExtractedFactSchema),
  perspectives: z.array(PerspectiveAnalysisSchema),
  biasFindings: z.array(BiasAssessmentSchema),
  qualityRating: NATORatingSchema,
  crossDocLinks: z.array(CrossDocLinkSchema),
  summary: z.string(),
});

// ============================================================================
// Specialist Result
// ============================================================================

export const SpecialistStatusSchema = z.enum(['success', 'error', 'skipped']);

export const SpecialistResultSchema = z.object({
  specialistId: SpecialistIdSchema,
  status: SpecialistStatusSchema,
  output: z.unknown(),
  duration: z.number(),
  error: z.string().optional(),
});

// ============================================================================
// Problem Set Context (Scoping Interview Output)
// ============================================================================

export const ProblemSetContextSchema = z.object({
  problemSetId: z.string(),
  geographicScope: z.object({
    regions: z.array(z.string()),
    countries: z.array(z.string()),
    specificAreas: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
  }),
  temporalRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    historicalDepth: z.string().optional(),
    futureHorizon: z.string().optional(),
  }),
  actorFocus: z.object({
    primaryActors: z.array(z.string()),
    alliances: z.array(z.object({
      name: z.string(),
      members: z.array(z.string()),
    })).optional(),
    excludedActors: z.array(z.string()).optional(),
  }),
  coreProblem: z.string(),
  additionalNuance: z.string().optional(),
  classificationCeiling: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']),
  echelon: z.enum(['strategic', 'operational', 'tactical']),
  standingRequirements: z.array(z.string()).optional(),
  updatedAt: z.string().datetime(),
  version: z.number().int(),
});

// ============================================================================
// Inferred Types (for runtime-validated paths)
// ============================================================================

export type ValidatedTriageDecision = z.infer<typeof TriageDecisionSchema>;
export type ValidatedExtractedFact = z.infer<typeof ExtractedFactSchema>;
export type ValidatedPerspectiveAnalysis = z.infer<typeof PerspectiveAnalysisSchema>;
export type ValidatedBiasAssessment = z.infer<typeof BiasAssessmentSchema>;
export type ValidatedCrossDocLink = z.infer<typeof CrossDocLinkSchema>;
export type ValidatedDocumentIntelligenceReport = z.infer<typeof DocumentIntelligenceReportSchema>;
export type ValidatedSpecialistResult = z.infer<typeof SpecialistResultSchema>;
export type ProblemSetContext = z.infer<typeof ProblemSetContextSchema>;

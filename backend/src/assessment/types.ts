/**
 * Assessment Type Definitions
 *
 * Phase 37 Plan 01: Training Assessment Loop - Data Model Foundation
 *
 * Types for structured AARs (FM 7-0 doctrinal format), METL task proficiency
 * tracking (T/P/U), and operational MOE/MOP assessment measures (JP 5-0).
 */

// ============================================================================
// AAR (After-Action Review) Types
// ============================================================================

/** AAR lifecycle status values */
export const AARStatus = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  FINALIZED: 'finalized',
} as const;

export type AARStatusValue = (typeof AARStatus)[keyof typeof AARStatus];

/** Structured After-Action Review (doctrinal FM 7-0 format) */
export interface StructuredAAR {
  id: string;                    // "AAR-{uuid}"
  problemSetId: string;
  trainingEventName: string;
  initiatedBy: string;           // DID of O/C or Commander
  status: AARStatusValue;
  whatWasPlanned: string;
  whatHappened: string;
  why: string;
  finalizedAt?: Date;
  finalizedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new AAR */
export interface CreateAARInput {
  problemSetId: string;
  trainingEventName: string;
  initiatedBy: string;
}

/** Input for updating an AAR (partial doctrinal sections + status) */
export interface UpdateAARInput {
  whatWasPlanned?: string;
  whatHappened?: string;
  why?: string;
  status?: AARStatusValue;
}

/** Observation type for sustain/improve categorization */
export type AARObservationType = 'sustain' | 'improve';

/** Individual AAR observation linked to a METL task */
export interface AARObservation {
  id: string;                    // "AARO-{uuid}"
  aarId: string;
  observationType: AARObservationType;
  content: string;
  metlTaskId?: string;
  suggestedByAi: boolean;
  aiAccepted?: boolean;          // null if not AI-suggested
  createdBy: string;             // DID
  createdAt: Date;
}

/** Input for creating a new AAR observation */
export interface CreateObservationInput {
  aarId: string;
  observationType: AARObservationType;
  content: string;
  metlTaskId?: string;
  suggestedByAi?: boolean;
  createdBy: string;
}

// ============================================================================
// METL (Mission-Essential Task List) Types
// ============================================================================

/** METL proficiency rating values: Trained / Practiced / Untrained */
export const METLRating = {
  TRAINED: 'T',
  PRACTICED: 'P',
  UNTRAINED: 'U',
} as const;

export type METLRatingValue = (typeof METLRating)[keyof typeof METLRating];

/** METL task definition (defined at strategic level, inherited downward) */
export interface METLTask {
  id: string;                    // "METL-{uuid}"
  problemSetId: string;          // where task was defined
  sourceProblemSetId?: string;   // strategic PS that owns the canonical task
  taskName: string;
  taskDescription?: string;
  competencyArea?: string;       // grouping for dashboard
  isSupplemental: boolean;
  promotedToStrategic: boolean;
  decayDays: number;             // default 90, configurable per-task
  createdAt: Date;
}

/** Input for creating a new METL task */
export interface CreateMETLTaskInput {
  problemSetId: string;
  sourceProblemSetId?: string;
  taskName: string;
  taskDescription?: string;
  competencyArea?: string;
  isSupplemental?: boolean;
  decayDays?: number;
}

/** Proficiency assessment record (T/P/U per task per event) */
export interface METLAssessment {
  id: string;                    // "METLA-{uuid}"
  metlTaskId: string;
  problemSetId: string;          // where assessment was made
  aarId?: string;                // linked AAR
  rating: METLRatingValue;
  assessedBy: string;            // DID (O/C or Commander)
  aiSuggestedRating?: string;
  commanderOverride: boolean;
  assessedAt: Date;
  notes?: string;
}

/** Input for creating a new METL assessment */
export interface CreateMETLAssessmentInput {
  metlTaskId: string;
  problemSetId: string;
  aarId?: string;
  rating: METLRatingValue;
  assessedBy: string;
  aiSuggestedRating?: string;
  commanderOverride?: boolean;
  notes?: string;
}

/** Decay status for a METL task proficiency */
export type DecayStatus = 'current' | 'warning' | 'expired';

/** Summary of current proficiency for a METL task (aggregation query result) */
export interface METLProficiencySummary {
  metlTaskId: string;
  taskName: string;
  competencyArea?: string;
  decayDays: number;
  rating?: METLRatingValue;
  assessedAt?: Date;
  assessedBy?: string;
  commanderOverride?: boolean;
  decayStatus: DecayStatus;
}

// ============================================================================
// MOE/MOP (Measures of Effectiveness / Performance) Types
// ============================================================================

/** Assessment status values (traffic light) */
export const AssessmentStatus = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

export type AssessmentStatusValue = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

/** Assessment trend values */
export const AssessmentTrend = {
  IMPROVING: 'improving',
  STABLE: 'stable',
  DECLINING: 'declining',
} as const;

export type AssessmentTrendValue = (typeof AssessmentTrend)[keyof typeof AssessmentTrend];

/** Measure of Effectiveness (linked to operational objectives from Design tab) */
export interface AssessmentMOE {
  id: string;                    // "MOE-{uuid}"
  problemSetId: string;
  objectiveId?: string;          // from Design tab LineOfEffort
  objectiveSnapshot: string;     // snapshot of objective text at creation
  name: string;
  description?: string;
  status: AssessmentStatusValue;
  trend: AssessmentTrendValue;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new MOE */
export interface CreateMOEInput {
  problemSetId: string;
  objectiveId?: string;
  objectiveSnapshot: string;
  name: string;
  description?: string;
  createdBy: string;
}

/** Measure of Performance (linked to OPORD tasks) */
export interface AssessmentMOP {
  id: string;                    // "MOP-{uuid}"
  problemSetId: string;
  taskId?: string;               // from OPORD/mission tasks
  taskSnapshot: string;          // snapshot of task text at creation
  name: string;
  description?: string;
  standard?: string;             // what "to standard" means
  status: AssessmentStatusValue;
  trend: AssessmentTrendValue;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new MOP */
export interface CreateMOPInput {
  problemSetId: string;
  taskId?: string;
  taskSnapshot: string;
  name: string;
  description?: string;
  standard?: string;
  createdBy: string;
}

/** Observation source for MOE/MOP status updates */
export type AssessmentObservationSource = 'manual' | 'ai_suggestion' | 'osint';

/** Observation target type */
export type AssessmentObservationTargetType = 'moe' | 'mop';

/** Assessment observation for MOE/MOP status tracking */
export interface AssessmentObservation {
  id: string;                    // "AOBS-{uuid}"
  targetType: AssessmentObservationTargetType;
  targetId: string;              // MOE or MOP id
  content: string;
  source: AssessmentObservationSource;
  statusUpdate?: AssessmentStatusValue;
  trendUpdate?: AssessmentTrendValue;
  approvedBy?: string;           // DID of approver (null = pending)
  approvedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

/** Input for creating a new assessment observation (for MOE/MOP) */
export interface CreateAssessmentObservationInput {
  targetType: AssessmentObservationTargetType;
  targetId: string;
  content: string;
  source?: AssessmentObservationSource;
  statusUpdate?: AssessmentStatusValue;
  trendUpdate?: AssessmentTrendValue;
  createdBy: string;
}

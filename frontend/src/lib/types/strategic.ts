/**
 * Strategic Planning Frontend Types
 *
 * Types for strategic document management, objective extraction,
 * approval workflows, and risk assessment visualization.
 */

// =============================================================================
// Document Types
// =============================================================================

export const DocumentLevel = {
  NSS: 'NSS',
  NDS: 'NDS',
  NMS: 'NMS',
  GEF: 'GEF',
  JSCP: 'JSCP',
  CAMPAIGN_PLAN: 'CAMPAIGN_PLAN',
  OTHER: 'OTHER',
} as const;
export type DocumentLevel = typeof DocumentLevel[keyof typeof DocumentLevel];

export const Classification = {
  UNCLASSIFIED: 'UNCLASSIFIED',
  CONFIDENTIAL: 'CONFIDENTIAL',
  SECRET: 'SECRET',
  TOP_SECRET: 'TOP_SECRET',
} as const;
export type Classification = typeof Classification[keyof typeof Classification];

export interface StrategicDocument {
  id: string;
  title: string;
  level: DocumentLevel;
  originalFilename: string;
  mimeType: string;
  pageCount?: number;
  textLength: number;
  classification: Classification;
  createdBy: string;
  createdAt: string;
  objectiveCount?: number;
}

// =============================================================================
// Objective Types
// =============================================================================

export const DIMEInstrument = {
  DIPLOMATIC: 'DIPLOMATIC',
  INFORMATIONAL: 'INFORMATIONAL',
  MILITARY: 'MILITARY',
  ECONOMIC: 'ECONOMIC',
} as const;
export type DIMEInstrument = typeof DIMEInstrument[keyof typeof DIMEInstrument];

/**
 * MIDLIFE Framework
 * Extended categorization: Military, Information, Diplomatic, Legal, Intelligence, Financial, Economic
 */
export const MidlifeCategory = {
  MILITARY: 'MILITARY',
  INFORMATION: 'INFORMATION',
  DIPLOMATIC: 'DIPLOMATIC',
  LEGAL: 'LEGAL',
  INTELLIGENCE: 'INTELLIGENCE',
  FINANCIAL: 'FINANCIAL',
  ECONOMIC: 'ECONOMIC',
} as const;
export type MidlifeCategory = typeof MidlifeCategory[keyof typeof MidlifeCategory];

export const MidlifeCategorizedBy = {
  AI: 'AI',
  HUMAN: 'HUMAN',
} as const;
export type MidlifeCategorizedBy = typeof MidlifeCategorizedBy[keyof typeof MidlifeCategorizedBy];

/**
 * MIDLIFE category metadata for UI display
 */
export const MIDLIFE_METADATA: Record<MidlifeCategory, {
  label: string;
  color: string;
  description: string;
}> = {
  MILITARY: {
    label: 'Military',
    color: '#dc2626', // red-600
    description: 'Armed forces, defense capabilities, military operations',
  },
  INFORMATION: {
    label: 'Information',
    color: '#2563eb', // blue-600
    description: 'Communications, media, cyber, public affairs',
  },
  DIPLOMATIC: {
    label: 'Diplomatic',
    color: '#7c3aed', // violet-600
    description: 'Foreign relations, treaties, alliances, negotiations',
  },
  LEGAL: {
    label: 'Legal',
    color: '#059669', // emerald-600
    description: 'International law, domestic law, rules of engagement',
  },
  INTELLIGENCE: {
    label: 'Intelligence',
    color: '#4f46e5', // indigo-600
    description: 'Collection, analysis, counterintelligence',
  },
  FINANCIAL: {
    label: 'Financial',
    color: '#ca8a04', // yellow-600
    description: 'Banking, sanctions, monetary policy',
  },
  ECONOMIC: {
    label: 'Economic',
    color: '#ea580c', // orange-600
    description: 'Trade, resources, development, industrial base',
  },
};

export const Priority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type Priority = typeof Priority[keyof typeof Priority];

export const ObjectiveStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  OPERATIONALIZED: 'OPERATIONALIZED',
} as const;
export type ObjectiveStatus = typeof ObjectiveStatus[keyof typeof ObjectiveStatus];

export interface ObjectiveEnds {
  description: string;
  conditions: string[];
  timeframe?: string;
}

export interface ObjectiveWays {
  strategies: string[];
  concepts: string[];
  keyTasks: string[];
}

export interface ObjectiveMeans {
  forces: string[];
  capabilities: string[];
  resources: string[];
}

export interface StrategicObjective {
  id: string;
  documentId: string;
  sourceReference?: string;
  description: string;
  endsWaysMeans?: {
    ends: ObjectiveEnds;
    ways: ObjectiveWays;
    means: ObjectiveMeans;
  };
  // Legacy flat structure for backwards compatibility
  ends?: ObjectiveEnds;
  ways?: ObjectiveWays;
  means?: ObjectiveMeans;
  primaryInstrument: DIMEInstrument;
  supportingInstruments: DIMEInstrument[];
  // MIDLIFE categorization
  midlifeCategory?: MidlifeCategory;
  midlifeCategorizedBy?: MidlifeCategorizedBy;
  midlifeConfidence?: number;
  priority: Priority;
  constraints: string[];
  assumptions: string[];
  risks?: string[];
  status: ObjectiveStatus;
  extractedBy: 'HUMAN' | 'AI';
  extractionConfidence?: number;
  humanVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// Workflow Types
// =============================================================================

export const WorkflowState = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type WorkflowState = typeof WorkflowState[keyof typeof WorkflowState];

export interface WorkflowEvent {
  type: string;
  actorId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface WorkflowStatus {
  state: WorkflowState;
  objectiveId: string;
  currentReviewer?: string;
  approvalCount: number;
  reviewerCount: number;
  history: WorkflowEvent[];
}

// =============================================================================
// Risk Assessment Types
// =============================================================================

export const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
} as const;
export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel];

export const Likelihood = {
  RARE: 'RARE',
  UNLIKELY: 'UNLIKELY',
  POSSIBLE: 'POSSIBLE',
  LIKELY: 'LIKELY',
  ALMOST_CERTAIN: 'ALMOST_CERTAIN',
} as const;
export type Likelihood = typeof Likelihood[keyof typeof Likelihood];

export const Impact = {
  NEGLIGIBLE: 'NEGLIGIBLE',
  MINOR: 'MINOR',
  MODERATE: 'MODERATE',
  MAJOR: 'MAJOR',
  CATASTROPHIC: 'CATASTROPHIC',
} as const;
export type Impact = typeof Impact[keyof typeof Impact];

export const MitigationStatus = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  IMPLEMENTED: 'IMPLEMENTED',
  VERIFIED: 'VERIFIED',
} as const;
export type MitigationStatus = typeof MitigationStatus[keyof typeof MitigationStatus];

export interface Mitigation {
  id: string;
  description: string;
  residualLikelihood: Likelihood;
  residualImpact: Impact;
  status: MitigationStatus;
  owner?: string;
}

export interface RiskDimension {
  likelihood: Likelihood;
  impact: Impact;
  riskLevel: RiskLevel;
  factors: string[];
}

export interface RiskAssessment {
  id: string;
  objectiveId: string;
  riskToMission: RiskDimension;
  riskToForce: RiskDimension;
  residualRisk: RiskLevel;
  mitigations: Mitigation[];
  assessedBy: string;
  assessedAt: string;
  reviewedBy?: string;
}

// =============================================================================
// Extraction Types
// =============================================================================

export interface ExtractedObjectiveSummary {
  id: string;
  description: string;
  dimeCategory: DIMEInstrument;
  midlifeCategory?: MidlifeCategory;
  midlifeConfidence?: number;
  priority: Priority;
}

export interface ExtractionResult {
  objectiveCount: number;
  documentSummary?: string;
  extractionConfidence?: number;
  chunkCount?: number;
  objectives: ExtractedObjectiveSummary[];
}

// =============================================================================
// Filter Types
// =============================================================================

export interface ObjectiveFilters {
  status?: ObjectiveStatus;
  documentId?: string;
  priority?: Priority;
  humanVerified?: boolean;
}

// =============================================================================
// Agent Review Types
// =============================================================================

export const ReviewStatus = {
  PENDING_REVIEW: 'pending_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  PARTIAL: 'partial',
} as const;
export type ReviewStatus = typeof ReviewStatus[keyof typeof ReviewStatus];

export interface CategoryAssessment {
  objectiveId: string;
  suggestedCategory: MidlifeCategory;
  currentCategory?: MidlifeCategory;
  confidence: number;
  rationale: string;
  requiresHumanReview: boolean;
}

export interface PriorityAssessment {
  objectiveId: string;
  suggestedPriority: Priority;
  currentPriority: Priority;
  score: number;
  rationale: string;
}

export interface DocumentSummary {
  totalObjectives: number;
  categoryDistribution: Record<MidlifeCategory, number>;
  coherenceScore: number;
  flags: string[];
}

export interface StrategyReviewReport {
  id: string;
  documentId: string;
  reviewedAt: string;
  reviewedBy: string;
  categoryAssessments: CategoryAssessment[];
  priorityAssessments: PriorityAssessment[];
  documentSummary: DocumentSummary;
  status: ReviewStatus;
  acceptedAt?: string;
  acceptedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

// =============================================================================
// Document Agent Assignment Types
// =============================================================================

export const AssignmentType = {
  REVIEW: 'review',
  MONITOR: 'monitor',
  ANALYZE: 'analyze',
} as const;
export type AssignmentType = typeof AssignmentType[keyof typeof AssignmentType];

export const AssignmentStatus = {
  ASSIGNED: 'assigned',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
} as const;
export type AssignmentStatus = typeof AssignmentStatus[keyof typeof AssignmentStatus];

export interface DocumentAgentAssignment {
  id: string;
  documentId: string;
  agentId: string;
  teamId?: string;
  assignmentType: AssignmentType;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: string;
  lastActivityAt?: string;
  config?: Record<string, unknown>;
  // Populated from agent/team registry
  agentName?: string;
  agentDisplayName?: string;
  teamName?: string;
}

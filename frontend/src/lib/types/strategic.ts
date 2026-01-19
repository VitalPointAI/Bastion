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
  description: string;
  ends: ObjectiveEnds;
  ways: ObjectiveWays;
  means: ObjectiveMeans;
  primaryInstrument: DIMEInstrument;
  supportingInstruments: DIMEInstrument[];
  priority: Priority;
  constraints: string[];
  assumptions: string[];
  status: ObjectiveStatus;
  extractedBy: 'HUMAN' | 'AI';
  extractionConfidence?: number;
  humanVerified: boolean;
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

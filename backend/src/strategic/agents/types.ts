/**
 * Strategic Planning AI Agent Types
 * Type definitions for OSINT collection, threat monitoring, and intelligence fusion
 */

// ============================================================================
// Agent Output Wrapper
// ============================================================================

/**
 * Agent output wrapper with quality metadata
 * All agent outputs include confidence scores and areas for human review
 */
export interface AgentOutput<T> {
  data: T;
  agentId: string;
  agentVersion: string;
  generatedAt: Date;
  confidenceScore: number;
  qualityIndicators: {
    sourceCount: number;
    sourceDiversity: number;
    contradictionCount: number;
    uncertaintyFlags: string[];
  };
  executiveSummary: string;
  keyFindings: string[];
  areasOfUncertainty: string[];
  questionsForReviewer: string[];
  inputSources: string[];
}

// ============================================================================
// OSINT Types
// ============================================================================

/**
 * Extracted entity from OSINT content
 */
export interface ExtractedEntity {
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT' | 'WEAPON_SYSTEM' | 'MILITARY_UNIT';
  name: string;
  mentions: number;
  context: string;
}

/**
 * Sentiment classification
 */
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

/**
 * OSINT Report from collection
 */
export interface OSINTReport {
  id: string;
  source: string;
  sourceCredibility: number;
  collectedAt: Date;
  content: string;
  summary: string;
  entities: ExtractedEntity[];
  sentiment: Sentiment;
  relevanceScore: number;
  keywords: string[];
  geolocation?: { lat: number; lon: number };
}

// ============================================================================
// Threat Indicator Types
// ============================================================================

/**
 * Threat indicator types aligned with PMESII-PT
 */
export type ThreatType =
  | 'MILITARY_ACTIVITY'
  | 'POLITICAL_INSTABILITY'
  | 'ECONOMIC_PRESSURE'
  | 'CYBER_THREAT'
  | 'INFORMATION_OPS';

/**
 * Severity levels for threat indicators
 */
export type ThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Threat Indicator
 */
export interface ThreatIndicator {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  description: string;
  sources: string[];
  firstObserved: Date;
  lastUpdated: Date;
  associatedActors: string[];
  geolocation?: { lat: number; lon: number };
  confidence: number;
}

/**
 * Threat alert generated for HIGH/CRITICAL threats
 */
export interface ThreatAlert {
  id: string;
  indicatorId: string;
  severity: ThreatSeverity;
  title: string;
  description: string;
  recommendedActions: string[];
  generatedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// ============================================================================
// Human Checkpoint Types
// ============================================================================

/**
 * Checkpoint types for human-in-the-loop review
 */
export type CheckpointType = 'REVIEW' | 'APPROVAL' | 'EXCEPTION';

/**
 * Checkpoint status
 */
export type CheckpointStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

/**
 * Decision action for checkpoint
 */
export type CheckpointAction = 'APPROVE' | 'REJECT' | 'REVISE';

/**
 * Human checkpoint for agent outputs
 * Enables human-in-the-loop review for all analysis outputs
 */
export interface HumanCheckpoint {
  id: string;
  checkpointType: CheckpointType;
  itemType: string;
  itemId: string;
  itemSummary: string;
  agentAnalysis: string;
  agentRecommendation: string;
  confidenceScore: number;
  flaggedConcerns: string[];
  questionsForReviewer: string[];
  status: CheckpointStatus;
  assignedTo?: string;
  createdAt: Date;
  decision?: {
    action: CheckpointAction;
    decidedBy: string;
    decidedAt: Date;
    rationale: string;
  };
}

// ============================================================================
// Collection Configuration
// ============================================================================

/**
 * OSINT collection request
 */
export interface OSINTCollectionRequest {
  keywords: string[];
  regions: string[];
  sourceIds?: string[];
  maxResults?: number;
}

/**
 * Threat monitoring request
 */
export interface ThreatMonitorRequest {
  regions: string[];
  threatTypes?: ThreatType[];
  severityThreshold?: ThreatSeverity;
}

// ============================================================================
// Agent Base Interface
// ============================================================================

/**
 * Base interface for all strategic agents
 */
export interface StrategicAgent {
  readonly agentId: string;
  readonly agentVersion: string;
  isEnabled(): Promise<boolean>;
}

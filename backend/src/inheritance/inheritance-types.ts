/**
 * Inheritance Types
 *
 * Phase 26: Strategic Environment Inheritance
 * Phase 38: Inheritance Deepening — extended types for change notification UX,
 *           override tracking, OPORD/FRAGO propagation, and upward status reporting.
 *
 * TypeScript interfaces for the inheritance system that propagates strategic
 * context from parent to child problem sets via the existing subscription system.
 *
 * Tables: inheritance_acknowledgments, inheritance_annotations, inheritance_rfis,
 *         inheritance_rfi_messages, inheritance_changelog, interpretation_acknowledgments,
 *         frago_drafts, mission_status_snapshots
 * ID formats: IACK-{uuid}, IANN-{uuid}, IRFI-{uuid}, IRFIM-{uuid}, ICLOG-{uuid},
 *             IACK-INTERP-{uuid}, FRAGO-{uuid}, MSTAT-{uuid}
 */

import type { Echelon } from '../problem-set/types.js';

// ============================================================================
// Core Inheritance Types
// ============================================================================

/** Commander acknowledgment of inherited strategic context updates */
export interface InheritanceAcknowledgment {
  id: string;                    // "IACK-{uuid}"
  problemSetId: string;
  sourceProblemSetId: string;
  sourceVersion: string;         // version hash from cache
  acknowledgedBy: string;        // DID of commander
  acknowledgedAt: Date;
}

/** Annotation on an inherited item (inline comment or full interpretation) */
export interface InheritanceAnnotation {
  id: string;                    // "IANN-{uuid}"
  problemSetId: string;
  sourceProblemSetId: string;
  targetItemId: string;          // ID of inherited doc/graph item
  targetItemType: 'strategic_document' | 'graph_summary';
  annotationType: 'inline' | 'interpretation';
  content: string;
  basedOnVersion: string | null; // source version when annotation was created
  isStale: boolean;              // flagged when source updates
  visibility: 'upward' | 'local_only';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** RFI subtypes for categorizing request intent */
export const RFI_SUBTYPES = {
  clarification: 'clarification',
  modification_request: 'modification_request',
  guidance_request: 'guidance_request',
} as const;

export type RFISubtype = (typeof RFI_SUBTYPES)[keyof typeof RFI_SUBTYPES];

/** Request for Information thread between echelons */
export interface InheritanceRFI {
  id: string;                    // "IRFI-{uuid}"
  requestingProblemSetId: string;
  targetProblemSetId: string;
  targetItemId: string;          // inherited item being questioned
  targetItemType: string;
  subject: string;
  status: 'open' | 'responded' | 'closed';
  rfiSubtype: RFISubtype;        // Phase 38: categorize request intent
  resolution: 'approved' | 'denied' | null; // Phase 38: for modification_request outcomes
  createdBy: string;
  createdAt: Date;
  closedAt: Date | null;
}

/** A message within an RFI thread */
export interface RFIMessage {
  id: string;                    // "IRFIM-{uuid}"
  rfiId: string;
  authorDid: string;
  authorProblemSetId: string;    // which PS the author is responding from
  content: string;
  createdAt: Date;
}

/** Changelog entry for inherited context changes */
export interface InheritanceChangelog {
  id: string;                    // "ICLOG-{uuid}"
  sourceProblemSetId: string;
  changeType: 'document_added' | 'document_updated' | 'graph_updated' | 'document_removed';
  changeSeverity: 'significant' | 'minor';
  itemId: string;
  itemTitle: string | null;
  summary: string | null;
  createdAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

/** Ancestor problem set info for context display */
export interface AncestorInfo {
  problemSetId: string;
  name: string;
  echelon: Echelon;
  depth: number;                 // 1 = parent, 2 = grandparent
}

/** Pending acknowledgment info for a source problem set */
export interface PendingAck {
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  sourceEchelon: Echelon;
  currentVersion: string;
  lastAcknowledgedVersion: string | null;
}

/** Full API response shape for inherited context */
export interface InheritedContextResponse {
  ancestors: AncestorInfo[];
  inheritedDocuments: Array<{
    id: string;
    title: string;
    docType: string;             // 'directive' | 'policy' | 'intel_summary' | 'guidance'
    summary: string;
    sourceProblemSetId: string;
    sourceProblemSetName: string;
    sourceEchelon: string;
    lastUpdated: string;
    isNew: boolean;              // true if added since last acknowledgment
    isUpdated: boolean;          // true if modified since last acknowledgment
  }>;
  inheritedGraphSummaries: Array<{
    containerName: string;
    summary: unknown;            // GraphSummaryData shape from Phase 25.3
    sourceProblemSetId: string;
    sourceProblemSetName: string;
    sourceEchelon: string;
    lastUpdated: string;
  }>;
  syncStatus: {
    lastSyncAt: string | null;
    hasStaleCaches: boolean;
    pendingAcknowledgments: number;
  };
  changelog: Array<{
    id: string;
    changeType: string;
    changeSeverity: string;
    itemTitle: string | null;
    summary: string | null;
    createdAt: string;
    sourceProblemSetName: string;
  }>;
}

// ============================================================================
// Phase 38: Interpretation Acknowledgment Types
// ============================================================================

/** Actions a parent can take on a child's interpretation annotation */
export const INTERPRETATION_ACK_ACTIONS = {
  acknowledge: 'acknowledge',
  clarify: 'clarify',
  correct: 'correct',
} as const;

export type InterpretationAckAction = (typeof INTERPRETATION_ACK_ACTIONS)[keyof typeof INTERPRETATION_ACK_ACTIONS];

/** Parent acknowledgment/response to a child's interpretation annotation */
export interface InterpretationAcknowledgment {
  id: string;                     // "IACK-INTERP-{uuid}"
  annotationId: string;           // FK to inheritance_annotations
  parentProblemSetId: string;     // PS where parent reviews
  action: InterpretationAckAction;
  comment: string | null;
  rfiId: string | null;           // linked RFI for 'clarify' action
  actedBy: string;                // DID
  actedAt: Date;
}

// ============================================================================
// Phase 38: FRAGO (Fragmentary Order) Types
// ============================================================================

/** FRAGO draft statuses */
export const FRAGO_STATUS = {
  draft: 'draft',
  approved: 'approved',
  distributed: 'distributed',
  acknowledged: 'acknowledged',
} as const;

export type FRAGOStatus = (typeof FRAGO_STATUS)[keyof typeof FRAGO_STATUS];

/** AI-generated FRAGO draft for OPORD changes propagating to subordinates */
export interface FRAGODraft {
  id: string;                     // "FRAGO-{uuid}"
  parentProblemSetId: string;
  childProblemSetId: string;
  sourceOpordVersion: string;
  previousOpordVersion: string;
  changedParagraphs: number[];    // e.g. [2, 3]
  aiDraftContent: string;
  status: FRAGOStatus;
  approvedBy: string | null;
  editedContent: string | null;   // if commander edits before approval
  distributedAt: Date | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

// ============================================================================
// Phase 38: Mission Status Reporting Types
// ============================================================================

/** Key event in a mission status update */
export interface MissionKeyEvent {
  timestamp: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

/** Resource status breakdown */
export interface MissionResourceStatus {
  personnel: { assigned: number; available: number };
  equipment: { operational: number; total: number };
  supplies: Record<string, string>;
}

/** Progress toward a specific objective */
export interface ObjectiveProgress {
  objectiveId: string;
  objectiveName: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'failed';
  percentComplete: number;
}

/** Snapshot of a child problem set's mission status reported upward */
export interface MissionStatusSnapshot {
  id: string;                     // "MSTAT-{uuid}"
  childProblemSetId: string;
  childProblemSetName: string;
  parentProblemSetId: string;
  missionState: 'planning' | 'active' | 'complete' | 'archived';
  mdmpPhase: string;
  percentComplete: number;
  keyEvents: MissionKeyEvent[];
  resourceStatus: MissionResourceStatus;
  objectiveProgress: ObjectiveProgress[];
  lastUpdated: Date;
}

// ============================================================================
// Phase 38: OPORD Change Detail Types
// ============================================================================

/** Detail of a specific OPORD paragraph change */
export interface OpordChangeDetail {
  paragraph: number;              // 1-5
  severity: 'significant' | 'minor';
  summary: string;
}

// ============================================================================
// Phase 38: WebSocket Message Types
// ============================================================================

/** Status update WebSocket message payload types */
export interface StatusUpdateMessage {
  type: 'mission_status' | 'status_batch' | 'drill_down_request' | 'drill_down_response';
  payload: MissionStatusSnapshot | MissionStatusSnapshot[] | { childProblemSetId: string } | object;
  timestamp: string;
}

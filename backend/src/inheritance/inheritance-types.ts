/**
 * Inheritance Types
 *
 * Phase 26: Strategic Environment Inheritance
 *
 * TypeScript interfaces for the inheritance system that propagates strategic
 * context from parent to child problem sets via the existing subscription system.
 *
 * Tables: inheritance_acknowledgments, inheritance_annotations, inheritance_rfis,
 *         inheritance_rfi_messages, inheritance_changelog
 * ID formats: IACK-{uuid}, IANN-{uuid}, IRFI-{uuid}, IRFIM-{uuid}, ICLOG-{uuid}
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

/** Request for Information thread between echelons */
export interface InheritanceRFI {
  id: string;                    // "IRFI-{uuid}"
  requestingProblemSetId: string;
  targetProblemSetId: string;
  targetItemId: string;          // inherited item being questioned
  targetItemType: string;
  subject: string;
  status: 'open' | 'responded' | 'closed';
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

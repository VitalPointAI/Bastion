/**
 * Brain Backend Types
 *
 * TypeScript interfaces for the brain visualization backend —
 * annotations, snapshots, gap reports, and pattern alerts.
 */

// =====================
// Database Row Types
// =====================

export interface BrainAnnotationRow {
  id: string;
  nodeId: string;
  nodeType: 'entity' | 'objective' | 'document' | 'concept';
  annotationType: 'flag' | 'note' | 'questionable';
  content: string | null;
  createdBy: string;
  problemSetId: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrainSnapshotRow {
  id: string;
  problemSetId: string;
  title: string;
  summary: string;
  timeScale: string | null;
  nodeCount: number;
  edgeCount: number;
  createdBy: string;
  createdAt: string;
}

// =====================
// Input Types
// =====================

export interface CreateAnnotationInput {
  nodeId: string;
  nodeType: 'entity' | 'objective' | 'document' | 'concept';
  annotationType: 'flag' | 'note' | 'questionable';
  content?: string;
  createdBy: string;
  problemSetId: string;
  isShared?: boolean;
}

export interface UpdateAnnotationInput {
  content?: string;
  isShared?: boolean;
  annotationType?: 'flag' | 'note' | 'questionable';
}

export interface CreateSnapshotInput {
  problemSetId: string;
  title: string;
  summary: string;
  timeScale?: string;
  nodeCount?: number;
  edgeCount?: number;
  createdBy: string;
}

// =====================
// Analysis Report Types
// =====================

export interface GapReport {
  gaps: Array<{
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    missingConnectionTypes: string[];
    expectedConnections: number;
    actualConnections: number;
  }>;
}

export interface PatternAlert {
  id: string;
  type: 'trend' | 'anomaly' | 'correlation';
  message: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
  relatedNodeIds: string[];
}

import * as Y from 'yjs';

export interface CollaborationUser {
  did: string;
  name: string;
  role: string;
  color: string;
}

export interface DocumentMetadata {
  documentId: string;
  planId: string;
  createdAt: Date;
  lastModified: Date;
}

export interface YjsDocument {
  doc: Y.Doc;
  metadata: DocumentMetadata;
  connectedUsers: Map<number, CollaborationUser>;
}

// Shared types for plan editing
export interface PlanYjsStructure {
  // Text fields for rich editing
  situationText: Y.Text;
  missionText: Y.Text;
  executionText: Y.Text;
  sustainmentText: Y.Text;
  commandSignalText: Y.Text;

  // Arrays for structured data
  coas: Y.Array<unknown>;
  tasks: Y.Array<unknown>;
  risks: Y.Array<unknown>;
  annexes: Y.Map<unknown>;

  // Comments and annotations
  comments: Y.Map<unknown>;
}

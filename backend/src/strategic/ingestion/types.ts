/**
 * Strategic Document Types
 * Types for document ingestion and strategic planning
 */

/**
 * Parsed document content from PDF/DOCX extraction
 */
export interface DocumentContent {
  /** Extracted text content */
  text: string;
  /** Document metadata from parser */
  metadata: Record<string, unknown>;
  /** Number of pages (PDF only) */
  pageCount?: number;
  /** Parsed sections if detectable */
  sections?: ParsedSection[];
}

/**
 * A detected section within a document
 */
export interface ParsedSection {
  /** Unique section identifier */
  id: string;
  /** Section title/heading */
  title: string;
  /** Section text content */
  content: string;
  /** Starting page number (1-indexed) */
  pageStart?: number;
  /** Ending page number (1-indexed) */
  pageEnd?: number;
}

/**
 * Strategic document hierarchy levels per JP 5-0
 * NSS = National Security Strategy
 * NDS = National Defense Strategy
 * NMS = National Military Strategy
 * GEF = Guidance for Employment of the Force
 * JSCP = Joint Strategic Capabilities Plan
 */
export type StrategicDocumentLevel =
  | 'NSS'
  | 'NDS'
  | 'NMS'
  | 'GEF'
  | 'JSCP'
  | 'CAMPAIGN_PLAN'
  | 'OTHER';

/**
 * Classification levels for documents
 */
export type ClassificationLevel =
  | 'UNCLASSIFIED'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOP_SECRET';

/**
 * A strategic planning document stored in the system
 */
export interface StrategicDocument {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Strategic hierarchy level */
  level: StrategicDocumentLevel;
  /** Original uploaded filename */
  originalFilename: string;
  /** MIME type of original file */
  mimeType: string;
  /** Number of pages */
  pageCount?: number;
  /** Full extracted text content */
  textContent: string;
  /** Length of text content in characters */
  textLength: number;
  /** Parsed sections */
  sections?: ParsedSection[];
  /** Classification level */
  classification: ClassificationLevel;
  /** IPFS CID if backed up */
  ipfsCid?: string;
  /** DID of user who created */
  createdBy: string;
  /** Workspace this document belongs to */
  workspaceId?: string;
  /** Ingestion scope: global (shared) or local (problem set only) */
  scope?: 'global' | 'local';
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Input for creating a new strategic document
 */
export interface CreateStrategicDocumentInput {
  title: string;
  level: StrategicDocumentLevel;
  originalFilename: string;
  mimeType: string;
  pageCount?: number;
  textContent: string;
  classification?: ClassificationLevel;
  ipfsCid?: string;
  createdBy: string;
  workspaceId?: string;
  scope?: 'global' | 'local';
}

/**
 * Response from document upload
 */
export interface DocumentUploadResponse {
  documentId: string;
  title: string;
  pageCount?: number;
  textLength: number;
}

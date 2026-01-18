/**
 * LLM Extraction Types
 * Type definitions for LLM-powered strategic objective extraction
 */

import type { z } from 'zod';
import type {
  ChunkExtractionResultSchema,
  DocumentExtractionResultSchema,
  ExtractedObjectiveSchema,
} from './schemas.js';

/**
 * Extracted objective from LLM - simplified structure before validation
 */
export type ExtractedObjective = z.infer<typeof ExtractedObjectiveSchema>;

/**
 * Result from extracting objectives from a single chunk
 */
export type ChunkExtractionResult = z.infer<typeof ChunkExtractionResultSchema>;

/**
 * Result from extracting objectives from an entire document
 */
export type DocumentExtractionResult = z.infer<typeof DocumentExtractionResultSchema>;

/**
 * Audit entry for tracking extraction operations
 */
export interface ExtractionAuditEntry {
  chunkIndex: number;
  timestamp: Date;
  model: string;
  tokensUsed: number;
  objectivesFound: number;
}

/**
 * Configuration options for extraction
 */
export interface ExtractionConfig {
  /** Model to use for extraction (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Maximum number of retries for failed extractions (default: 3) */
  maxRetries?: number;
  /** Maximum characters per chunk (default: 8000) */
  chunkSize?: number;
}

/**
 * Full extraction result with audit trail
 */
export interface ExtractionResult {
  /** Extracted strategic objectives */
  objectives: ExtractedObjective[];
  /** Executive summary of the document */
  documentSummary: string;
  /** Overall extraction confidence (0-1) */
  extractionConfidence: number;
  /** Number of chunks processed */
  chunkCount: number;
  /** Audit log of extraction operations */
  auditLog: ExtractionAuditEntry[];
  /** Document hierarchy level */
  documentLevel: 'NSS' | 'NDS' | 'NMS' | 'GEF' | 'JSCP' | 'CAMPAIGN_PLAN' | 'OTHER';
}

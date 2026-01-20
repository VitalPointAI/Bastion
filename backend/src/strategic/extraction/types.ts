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
import type { ProviderConfig } from './providers/types.js';

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
 * Progress update during extraction
 */
export interface ExtractionProgress {
  /** Current phase: 'chunking' | 'extracting' | 'consolidating' | 'complete' */
  phase: 'chunking' | 'extracting' | 'consolidating' | 'complete';
  /** Current chunk being processed (1-indexed for display) */
  currentChunk: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Objectives found so far */
  objectivesFound: number;
  /** Preview of latest extracted objective (truncated) */
  latestObjectivePreview?: string;
  /** Current chunk summary */
  chunkSummary?: string;
}

/**
 * Progress callback function type
 */
export type ExtractionProgressCallback = (progress: ExtractionProgress) => void;

/**
 * Configuration options for extraction
 */
export interface ExtractionConfig {
  /** LLM provider configuration (default: Anthropic Claude) */
  provider?: ProviderConfig;
  /** Maximum number of retries for failed extractions (default: 3) */
  maxRetries?: number;
  /** Maximum characters per chunk (default: 8000) */
  chunkSize?: number;
  /** Optional progress callback for streaming updates */
  onProgress?: ExtractionProgressCallback;
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

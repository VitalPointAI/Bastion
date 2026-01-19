/**
 * Strategic Objective Extraction Module
 * LLM-powered extraction using Instructor-JS and Claude
 *
 * Exports:
 * - ExtractionService for document processing
 * - Zod schemas for validation
 * - TypeScript types
 */

// Service
export { ExtractionService } from './extractor.js';

// Schemas
export {
  ExtractedObjectiveSchema,
  ChunkExtractionResultSchema,
  DocumentExtractionResultSchema,
} from './schemas.js';

// Types
export type {
  ExtractedObjective,
  ChunkExtractionResult,
  DocumentExtractionResult,
  ExtractionAuditEntry,
  ExtractionConfig,
  ExtractionResult,
} from './types.js';

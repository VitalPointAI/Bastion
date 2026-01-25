/**
 * Document Generation Module
 *
 * Phase 05 Plan 09/10: Exports all document generators and types
 */

// Types
export * from './types.js';

// OPORD Document Generators (Phase 05 Plan 10)
export { generateOPORDDocx, generateOPORDPdf } from './generators/opord.js';

// PowerPoint Briefing Generator
export { generateBriefingSlides, BriefingType } from './generators/pptx-generator.js';
export type { BriefingOptions } from './generators/pptx-generator.js';

// Synchronization Matrix Generator
export { generateSyncMatrix, syncMatrixToCSV } from './generators/sync-matrix.js';
export type { SyncMatrix, SyncMatrixRow } from './generators/sync-matrix.js';

// DST and CCIR Generators
export { generateDST, generateCCIR } from './generators/dst-generator.js';
export type { DST, CCIR, DecisionPoint, PIR, FFIR, EEFI } from './generators/dst-generator.js';

/**
 * Document Generation Types
 *
 * Phase 05 Plan 08: Types for OPLAN/OPORD document generation
 */

import type { OperationalPlan, COA } from '../types.js';

/**
 * Document metadata for OPORD generation
 */
export interface DocumentMetadata {
  classification: string;
  portionMarkings?: boolean;
  unit: string;
  orderNumber: string;
  dtg: string; // Date-Time Group (e.g., "251400ZJAN26")
  references: string[];
  timeZone: string;
}

/**
 * Options for OPORD document generation
 */
export interface OPORDGeneratorOptions {
  includeAnnexes?: boolean;
  annexList?: string[];
  includeTaskOrg?: boolean;
  includeGraphics?: boolean;
  classificationBanner?: boolean;
  portionMarkings?: boolean;
}

/**
 * Generated document output
 */
export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
  generatedAt: Date;
}

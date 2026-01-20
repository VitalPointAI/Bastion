/**
 * DIME Framework Schemas
 * Diplomatic, Informational, Military, Economic - Instruments of National Power
 *
 * Based on military doctrine for categorizing strategic objectives.
 * @see https://fairchild-mil.libguides.com/dimefil
 */

import { z } from 'zod';

/**
 * DIME Instrument Schema
 * The four traditional instruments of national power
 */
export const DIMEInstrumentSchema = z.enum([
  'DIPLOMATIC',
  'INFORMATIONAL',
  'MILITARY',
  'ECONOMIC',
]).describe('Primary instrument of national power (DIME framework)');

export type DIMEInstrument = z.infer<typeof DIMEInstrumentSchema>;

/**
 * DIMEFIL Instrument Schema
 * Extended DIME framework with Financial, Intelligence, and Law Enforcement
 * Used for comprehensive national power modeling
 */
export const DIMEFILInstrumentSchema = z.enum([
  'DIPLOMATIC',
  'INFORMATIONAL',
  'MILITARY',
  'ECONOMIC',
  'FINANCIAL',
  'INTELLIGENCE',
  'LAW_ENFORCEMENT',
]).describe('Extended instrument of national power (DIMEFIL framework)');

export type DIMEFILInstrument = z.infer<typeof DIMEFILInstrumentSchema>;

/**
 * MIDLIFE Framework Schema
 * Military, Information, Diplomatic, Legal, Intelligence, Financial, Economic
 * Extended framework that adds Legal as a distinct category
 *
 * @see Plan 4-10 for implementation details
 */
export const MidlifeCategorySchema = z.enum([
  'MILITARY',
  'INFORMATION',
  'DIPLOMATIC',
  'LEGAL',
  'INTELLIGENCE',
  'FINANCIAL',
  'ECONOMIC',
]).describe('MIDLIFE category for strategic instruments of power');

export type MidlifeCategory = z.infer<typeof MidlifeCategorySchema>;

/**
 * Categorization source - who assigned the MIDLIFE category
 */
export const MidlifeCategorizedBySchema = z.enum([
  'AI',
  'HUMAN',
]).describe('Whether MIDLIFE category was assigned by AI or human');

export type MidlifeCategorizedBy = z.infer<typeof MidlifeCategorizedBySchema>;

/**
 * Map DIME instrument to MIDLIFE category
 * Used during migration and for backwards compatibility
 */
export function dimeToMidlife(dime: DIMEInstrument): MidlifeCategory {
  switch (dime) {
    case 'DIPLOMATIC':
      return 'DIPLOMATIC';
    case 'INFORMATIONAL':
      return 'INFORMATION';
    case 'MILITARY':
      return 'MILITARY';
    case 'ECONOMIC':
      return 'ECONOMIC';
  }
}

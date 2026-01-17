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

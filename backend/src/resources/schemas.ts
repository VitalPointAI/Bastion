/**
 * Resource Management Domain Zod Schemas
 *
 * Phase 4.4 Plan 01: Validation schemas for resources, personnel, consumables
 */

import { z } from 'zod';

/**
 * Location schema (reusable)
 */
const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Resource input validation schema
 */
export const ResourceInputSchema = z.object({
  name: z.string().min(1).max(200).describe('Resource name'),
  category: z
    .enum(['vehicles', 'weapons', 'communications', 'sensors', 'medical', 'other'])
    .describe('Resource category'),
  serialNumber: z.string().optional().describe('Optional serial number'),
  sidc: z.string().length(15).optional().describe('Optional MIL-STD-2525D symbol code'),
  status: z.enum(['FMC', 'PMC', 'NMC']).describe('Mission capability status'),
  specifications: z.record(z.string(), z.unknown()).describe('Flexible specifications as JSONB'),
  location: LocationSchema.optional().describe('Optional location coordinates'),
});

/**
 * Personnel input validation schema
 */
export const PersonnelInputSchema = z.object({
  name: z.string().min(1).max(200).describe('Personnel name'),
  unitId: z.string().optional().describe('Optional unit assignment'),
  rank: z.string().min(1).max(50).describe('Military rank'),
  specialty: z.string().min(1).max(100).describe('MOS, AFSC, rating, etc.'),
  readinessStatus: z.enum(['ready', 'limited', 'unavailable']).describe('Readiness status'),
  clearanceLevel: z.enum(['UNCLASS', 'SECRET', 'TOPSECRET']).describe('Security clearance'),
});

/**
 * Consumable input validation schema
 */
export const ConsumableInputSchema = z.object({
  category: z
    .enum(['ammunition', 'fuel', 'medical', 'rations', 'other'])
    .describe('Consumable category'),
  name: z.string().min(1).max(200).describe('Consumable name'),
  quantity: z.number().nonnegative().describe('Total quantity'),
  unit: z.string().min(1).max(50).describe('Unit of measure'),
  minimumLevel: z.number().nonnegative().describe('Minimum quantity threshold for alerts'),
  currentLevel: z.number().nonnegative().describe('Current quantity level'),
  location: LocationSchema.optional().describe('Optional storage location'),
});

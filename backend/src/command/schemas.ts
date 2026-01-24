/**
 * Command & Control Domain Zod Schemas
 *
 * Phase 4.4 Plan 01: Validation schemas for command relationships
 */

import { z } from 'zod';

/**
 * Unit input validation schema
 */
export const UnitInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Unit name'),
  sidc: z
    .string()
    .length(15)
    .describe('MIL-STD-2525D symbol identification code (15 characters)'),
  parentDid: z.string().optional().describe('Optional link to organizational entity DID'),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional()
    .describe('Optional location coordinates'),
});

/**
 * Command relationship input validation schema
 */
export const CommandRelationshipSchema = z.object({
  superiorUnitId: z.string().describe('ID of superior unit'),
  subordinateUnitId: z.string().describe('ID of subordinate unit'),
  relationshipType: z
    .enum(['OPCON', 'TACON', 'ADCON', 'COCOM', 'DS', 'GS', 'GSR', 'R'])
    .describe('Type of command relationship'),
  effectiveFrom: z.coerce.date().optional().describe('Start date of relationship'),
  effectiveTo: z.coerce.date().optional().describe('End date of relationship'),
});

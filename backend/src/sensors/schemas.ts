/**
 * Sensor Registration Domain Zod Schemas
 *
 * Phase 4.4 Plan 01: Validation schemas for sensor registration
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
 * Sensor capabilities schema
 */
const SensorCapabilitiesSchema = z.object({
  range: z.number().positive().optional().describe('Detection range in meters'),
  resolution: z.number().positive().optional().describe('Resolution in meters'),
  coverageArea: z.number().positive().optional().describe('Coverage area in square meters'),
  sensorTypes: z
    .array(z.string())
    .optional()
    .describe('Sensor types (EO, IR, SAR, SIGINT, etc.)'),
  updateRate: z.number().positive().optional().describe('Update frequency in seconds'),
});

/**
 * Sensor input validation schema
 */
export const SensorInputSchema = z.object({
  name: z.string().min(1).max(200).describe('Sensor name'),
  category: z
    .enum(['airborne', 'ground', 'maritime', 'space', 'autonomous'])
    .describe('Sensor platform category'),
  sidc: z.string().length(15).optional().describe('Optional MIL-STD-2525D symbol code'),
  capabilities: SensorCapabilitiesSchema.describe('Sensor capabilities specification'),
  status: z
    .enum(['operational', 'degraded', 'offline', 'maintenance'])
    .describe('Operational status'),
  location: LocationSchema.optional().describe('Optional sensor location'),
  dataFeedUrl: z.string().url().optional().describe('Optional real-time data feed URL'),
});

/**
 * GeoJSON Polygon schema for sensor coverage
 */
const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/**
 * Sensor coverage input validation schema
 */
export const SensorCoverageSchema = z.object({
  sensorId: z.string().describe('ID of associated sensor'),
  coveragePolygon: GeoJSONPolygonSchema.describe('Coverage area as GeoJSON Polygon'),
  confidenceLevel: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence in coverage accuracy (0-100)'),
});

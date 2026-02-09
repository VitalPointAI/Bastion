/**
 * Mission Domain Zod Schemas
 *
 * Phase 4.4 Plan 01: Validation schemas for mission workspaces
 */

import { z } from 'zod';

/**
 * GeoJSON Polygon schema for area of operations
 */
const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/**
 * Pending invite schema for mission creation
 */
const PendingInviteSchema = z.object({
  inviteeDID: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['commander', 'staff', 'observer']),
  expiresInHours: z.number().min(1).max(168).optional(),
});

/**
 * Mission input validation schema
 */
export const MissionInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Mission name (1-100 characters)'),
  description: z.string().optional().describe('Mission description'),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).describe('Classification level'),
  areaOfOperations: GeoJSONPolygonSchema.optional().describe('GeoJSON Polygon for area of operations'),
  workspaceId: z.string().optional().describe('ID of linked workspace'),
  pendingInvites: z.array(PendingInviteSchema).optional().describe('Invites to create after mission'),
});

/**
 * Mission participant schema
 */
export const MissionParticipantSchema = z.object({
  missionId: z.string(),
  userDid: z.string(),
  role: z.enum(['commander', 'staff', 'observer']),
  invitedBy: z.string(),
});

/**
 * Mission invite schema
 */
export const MissionInviteSchema = z.object({
  missionId: z.string(),
  role: z.enum(['commander', 'staff', 'observer']),
  inviteeEmail: z.string().email().optional(),
  inviteeDid: z.string().optional(),
  expirationHours: z.number().min(1).max(168).default(72), // 1 hour to 1 week, default 72h
});

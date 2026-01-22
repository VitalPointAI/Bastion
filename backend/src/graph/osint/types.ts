/**
 * OSINT Event Types
 *
 * Types for open-source intelligence events, objective evidence linking,
 * validity scoring, and alerting for strategic objective tracking.
 */

import { z } from 'zod';

// ============================================================================
// OSINT Source and Event Types
// ============================================================================

export type OSINTSourceType = 'news' | 'social_media' | 'government' | 'academic' | 'satellite' | 'signals' | 'other';
export type EventRelevance = 'supporting' | 'contradicting' | 'neutral' | 'unknown';
export type AlertType = 'validity_decreased' | 'validity_increased' | 'new_evidence' | 'conflict_detected' | 'trend_change';

/**
 * OSINT Event - an external event from open sources
 */
export interface OSINTEvent {
  id: string;                        // EVT-{uuid}
  title: string;
  description: string;
  sourceType: OSINTSourceType;
  sourceUrl?: string;
  sourceName: string;
  publishedAt: Date;
  ingestedAt: Date;
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
    region?: string;
    country?: string;
  };
  actors: string[];                  // Actor names mentioned
  tags: string[];
  rawContent?: string;
  workspaceId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Link between an OSINT event and a strategic objective
 */
export interface ObjectiveEvidence {
  id: string;                        // EVI-{uuid}
  objectiveId: string;
  eventId: string;
  relevance: EventRelevance;
  relevanceScore: number;            // 0-1 confidence
  reasoning: string;
  linkedAt: Date;
  linkedBy: string;                  // DID of user or agent
}

/**
 * Validity score snapshot for an objective
 */
export interface ValidityScore {
  id: string;                        // VAL-{uuid}
  objectiveId: string;
  score: number;                     // 0-100
  previousScore?: number;
  reasoning: string;
  evidenceIds: string[];
  calculatedAt: Date;
  calculatedBy: string;
}

/**
 * Alert when validity changes significantly
 */
export interface ValidityAlert {
  id: string;                        // ALT-{uuid}
  objectiveId: string;
  alertType: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  details: string;
  evidenceIds: string[];
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Location schema for geospatial data
 */
export const LocationSchema = z.object({
  name: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
}).optional();

/**
 * OSINT event input schema for validation
 */
export const OSINTEventInputSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  sourceType: z.enum(['news', 'social_media', 'government', 'academic', 'satellite', 'signals', 'other']),
  sourceUrl: z.string().url().optional(),
  sourceName: z.string(),
  publishedAt: z.coerce.date(),
  location: LocationSchema,
  actors: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  rawContent: z.string().optional(),
  workspaceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type OSINTEventInput = z.infer<typeof OSINTEventInputSchema>;

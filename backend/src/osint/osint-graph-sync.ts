/**
 * OSINT → Knowledge Graph Sync
 *
 * After OSINT events are stored, this module creates Actor nodes and
 * Relationship edges in the Neo4j knowledge graph so OSINT intelligence
 * is visible in the brain visualization.
 *
 * Also extracts geo-location data from event content for COP symbol placement.
 */

import { randomUUID } from 'crypto';
import type { OSINTEvent } from '../graph/osint/types.js';
import { SOURCE_WEIGHTS } from '../graph/confidence-calculator.js';
import { ACTOR_TYPE_TO_CCO_MAP } from '../graph/raft/types.js';
import { entityResolutionService } from '../graph/resolution/resolution-service.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';
const OSINT_ASSERTED_BY = 'system:osint-feed-poller';
const OSINT_SOURCE_WEIGHT = SOURCE_WEIGHTS['osint']; // 0.65

// ── Geo-location extraction ────────────────────────────────────────────────

/**
 * Known locations with lat/lng for common geopolitical references.
 * Used as a fast lookup when LLM geo-coding isn't available.
 */
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; region?: string; country?: string }> = {
  // Indo-Pacific (primary exercise scenario region)
  'taiwan': { lat: 23.6978, lng: 120.9605, region: 'Indo-Pacific', country: 'Taiwan' },
  'taipei': { lat: 25.0330, lng: 121.5654, region: 'Indo-Pacific', country: 'Taiwan' },
  'china': { lat: 35.8617, lng: 104.1954, region: 'Indo-Pacific', country: 'China' },
  'beijing': { lat: 39.9042, lng: 116.4074, region: 'Indo-Pacific', country: 'China' },
  'shanghai': { lat: 31.2304, lng: 121.4737, region: 'Indo-Pacific', country: 'China' },
  'south china sea': { lat: 12.0, lng: 114.0, region: 'Indo-Pacific' },
  'taiwan strait': { lat: 24.0, lng: 119.5, region: 'Indo-Pacific' },
  'japan': { lat: 36.2048, lng: 138.2529, region: 'Indo-Pacific', country: 'Japan' },
  'tokyo': { lat: 35.6762, lng: 139.6503, region: 'Indo-Pacific', country: 'Japan' },
  'okinawa': { lat: 26.5013, lng: 127.9454, region: 'Indo-Pacific', country: 'Japan' },
  'south korea': { lat: 35.9078, lng: 127.7669, region: 'Indo-Pacific', country: 'South Korea' },
  'seoul': { lat: 37.5665, lng: 126.9780, region: 'Indo-Pacific', country: 'South Korea' },
  'north korea': { lat: 40.3399, lng: 127.5101, region: 'Indo-Pacific', country: 'North Korea' },
  'pyongyang': { lat: 39.0392, lng: 125.7625, region: 'Indo-Pacific', country: 'North Korea' },
  'philippines': { lat: 12.8797, lng: 121.7740, region: 'Indo-Pacific', country: 'Philippines' },
  'guam': { lat: 13.4443, lng: 144.7937, region: 'Indo-Pacific', country: 'USA' },
  'hawaii': { lat: 19.8968, lng: -155.5828, region: 'Indo-Pacific', country: 'USA' },
  'australia': { lat: -25.2744, lng: 133.7751, region: 'Indo-Pacific', country: 'Australia' },
  'india': { lat: 20.5937, lng: 78.9629, region: 'Indo-Pacific', country: 'India' },
  'singapore': { lat: 1.3521, lng: 103.8198, region: 'Indo-Pacific', country: 'Singapore' },
  'vietnam': { lat: 14.0583, lng: 108.2772, region: 'Indo-Pacific', country: 'Vietnam' },
  'indonesia': { lat: -0.7893, lng: 113.9213, region: 'Indo-Pacific', country: 'Indonesia' },
  // Middle East
  'iran': { lat: 32.4279, lng: 53.6880, region: 'Middle East', country: 'Iran' },
  'iraq': { lat: 33.2232, lng: 43.6793, region: 'Middle East', country: 'Iraq' },
  'syria': { lat: 34.8021, lng: 38.9968, region: 'Middle East', country: 'Syria' },
  'israel': { lat: 31.0461, lng: 34.8516, region: 'Middle East', country: 'Israel' },
  'saudi arabia': { lat: 23.8859, lng: 45.0792, region: 'Middle East', country: 'Saudi Arabia' },
  'yemen': { lat: 15.5527, lng: 48.5164, region: 'Middle East', country: 'Yemen' },
  // Europe
  'russia': { lat: 61.5240, lng: 105.3188, region: 'Europe', country: 'Russia' },
  'moscow': { lat: 55.7558, lng: 37.6173, region: 'Europe', country: 'Russia' },
  'ukraine': { lat: 48.3794, lng: 31.1656, region: 'Europe', country: 'Ukraine' },
  'kyiv': { lat: 50.4501, lng: 30.5234, region: 'Europe', country: 'Ukraine' },
  'nato': { lat: 50.8503, lng: 4.3517, region: 'Europe' },
  // Africa
  'sudan': { lat: 12.8628, lng: 30.2176, region: 'Africa', country: 'Sudan' },
  'somalia': { lat: 5.1521, lng: 46.1996, region: 'Africa', country: 'Somalia' },
  'libya': { lat: 26.3351, lng: 17.2283, region: 'Africa', country: 'Libya' },
  // Americas
  'washington': { lat: 38.9072, lng: -77.0369, region: 'Americas', country: 'USA' },
  'pentagon': { lat: 38.8719, lng: -77.0563, region: 'Americas', country: 'USA' },
  'united states': { lat: 37.0902, lng: -95.7129, region: 'Americas', country: 'USA' },
  // Neijiang/Chongqing (from exercise scenario)
  'neijiang': { lat: 29.5854, lng: 105.0584, region: 'Indo-Pacific', country: 'China' },
  'chongqing': { lat: 29.4316, lng: 106.9123, region: 'Indo-Pacific', country: 'China' },
};

/**
 * Extract the first matching location from text content.
 * Returns null if no known location is found.
 */
export function extractLocation(text: string): {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
  country?: string;
} | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Try longest matches first (e.g., "south china sea" before "china")
  const sorted = Object.entries(KNOWN_LOCATIONS).sort((a, b) => b[0].length - a[0].length);

  for (const [name, coords] of sorted) {
    // Word boundary check: ensure we match whole words
    const idx = lower.indexOf(name);
    if (idx >= 0) {
      const before = idx > 0 ? lower[idx - 1] : ' ';
      const after = idx + name.length < lower.length ? lower[idx + name.length] : ' ';
      if (/\W/.test(before) && /\W/.test(after)) {
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          latitude: coords.lat,
          longitude: coords.lng,
          region: coords.region,
          country: coords.country,
        };
      }
    }
  }

  return null;
}

// ── Knowledge Graph Sync ───────────────────────────────────────────────────

/**
 * Sync an OSINT event into the Neo4j knowledge graph as Actor nodes + edges.
 *
 * Creates:
 * - An "osint_event" actor node for the event itself
 * - Actor nodes for each mentioned actor (if not already existing)
 * - RELATES_TO edges from actors → event
 */
export async function syncOSINTEventToGraph(event: OSINTEvent): Promise<void> {
  try {
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    const now = new Date().toISOString();
    const validFrom = event.publishedAt?.toISOString() ?? now;
    const eventNodeId = `OSINT-${event.id}`;
    const derivedFrom = JSON.stringify([event.id, event.sourceUrl ?? ''].filter(Boolean));

    // Create or update the OSINT event as a node with JSON-LD provenance
    await executeWriteQuery(`
      MERGE (e:Actor {id: $id})
      ON CREATE SET
        e.name = $name,
        e.type = 'event',
        e.aliases = $aliases,
        e.attributes = $attributes,
        e.workspaceId = $workspaceId,
        e.sourceDocumentIds = $sourceDocIds,
        e.containerIds = [],
        e.createdAt = $now,
        e.updatedAt = $now,
        e.jsonldType = $jsonldType,
        e.jsonldContext = $jsonldContext,
        e.assertedBy = $assertedBy,
        e.assertedVia = $assertedVia,
        e.derivedFrom = $derivedFrom,
        e.confidence = $confidence,
        e.sourceWeight = $sourceWeight,
        e.validFrom = $validFrom,
        e.validTo = null,
        e.halfLifeDays = $halfLifeDays
      ON MATCH SET
        e.attributes = $attributes,
        e.updatedAt = $now,
        e.derivedFrom = $derivedFrom,
        e.confidence = $confidence
    `, {
      id: eventNodeId,
      name: event.title,
      aliases: [event.sourceName ?? '', ...(event.tags ?? [])].filter(Boolean),
      attributes: JSON.stringify({
        nodeType: 'osint_event',
        sourceType: event.sourceType,
        sourceUrl: event.sourceUrl,
        sourceName: event.sourceName,
        publishedAt: event.publishedAt?.toISOString(),
        description: (event.description ?? '').slice(0, 500),
        location: event.location,
        tags: event.tags,
      }),
      workspaceId: event.workspaceId ?? null,
      sourceDocIds: [event.id],
      now,
      // JSON-LD provenance fields
      jsonldType: ACTOR_TYPE_TO_CCO_MAP['organization'] ?? 'cco:Organization',
      jsonldContext: BASTION_CONTEXT,
      assertedBy: OSINT_ASSERTED_BY,
      assertedVia: 'osint',
      derivedFrom,
      confidence: OSINT_SOURCE_WEIGHT,
      sourceWeight: OSINT_SOURCE_WEIGHT,
      validFrom,
      // OSINT events: political content decays in ~90 days
      halfLifeDays: 90,
    });

    // Create actor nodes for mentioned actors and link to event
    for (const actorName of (event.actors ?? [])) {
      if (!actorName || actorName.length < 2) continue;

      const actorId = `ACT-osint-${actorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
      const actorDerivedFrom = JSON.stringify([event.id, event.sourceUrl ?? ''].filter(Boolean));

      // Merge actor (create if not exists) with JSON-LD provenance
      await executeWriteQuery(`
        MERGE (a:Actor {id: $id})
        ON CREATE SET
          a.name = $name,
          a.type = 'organization',
          a.aliases = [],
          a.attributes = $attributes,
          a.workspaceId = $workspaceId,
          a.sourceDocumentIds = $sourceDocIds,
          a.containerIds = [],
          a.createdAt = $now,
          a.updatedAt = $now,
          a.jsonldType = $jsonldType,
          a.jsonldContext = $jsonldContext,
          a.assertedBy = $assertedBy,
          a.assertedVia = $assertedVia,
          a.derivedFrom = $derivedFrom,
          a.confidence = $confidence,
          a.sourceWeight = $sourceWeight,
          a.validFrom = $validFrom,
          a.validTo = null,
          a.halfLifeDays = $halfLifeDays
        ON MATCH SET
          a.sourceDocumentIds = a.sourceDocumentIds + $eventId,
          a.updatedAt = $now
      `, {
        id: actorId,
        name: actorName,
        attributes: JSON.stringify({ source: 'osint', firstSeen: now }),
        workspaceId: event.workspaceId ?? null,
        sourceDocIds: [event.id],
        eventId: event.id,
        now,
        // JSON-LD provenance fields
        jsonldType: ACTOR_TYPE_TO_CCO_MAP['organization'] ?? 'cco:Organization',
        jsonldContext: BASTION_CONTEXT,
        assertedBy: OSINT_ASSERTED_BY,
        assertedVia: 'osint',
        derivedFrom: actorDerivedFrom,
        confidence: OSINT_SOURCE_WEIGHT,
        sourceWeight: OSINT_SOURCE_WEIGHT,
        validFrom,
        // Political actors from OSINT: 90-day half-life
        halfLifeDays: 90,
      });

      // Create RELATES_TO edge from actor → event
      const relId = `REL-${randomUUID()}`;
      await executeWriteQuery(`
        MATCH (a:Actor {id: $actorId})
        MATCH (e:Actor {id: $eventId})
        MERGE (a)-[r:RELATES_TO {type: 'mentioned_in'}]->(e)
        ON CREATE SET
          r.id = $relId,
          r.type = 'mentioned_in',
          r.strength = $strength,
          r.description = $desc,
          r.evidence = $evidence,
          r.sourceDocumentIds = [$docId],
          r.createdAt = $now,
          r.updatedAt = $now,
          r.jsonldType = 'cco:ActOfRelating',
          r.jsonldContext = $jsonldContext,
          r.assertedBy = $assertedBy,
          r.assertedVia = 'osint',
          r.derivedFrom = $derivedFrom,
          r.confidence = $confidence,
          r.sourceWeight = $sourceWeight,
          r.validFrom = $validFrom,
          r.validTo = null,
          r.halfLifeDays = 90
      `, {
        actorId,
        eventId: eventNodeId,
        relId,
        strength: OSINT_SOURCE_WEIGHT,
        desc: `${actorName} mentioned in OSINT: ${event.title}`,
        evidence: event.sourceUrl ?? '',
        docId: event.id,
        now,
        jsonldContext: BASTION_CONTEXT,
        assertedBy: OSINT_ASSERTED_BY,
        derivedFrom,
        confidence: OSINT_SOURCE_WEIGHT,
        sourceWeight: OSINT_SOURCE_WEIGHT,
        validFrom,
      });
    }

    // Trigger entity resolution after OSINT writes to check for duplicates
    try {
      const resolution = await entityResolutionService.findDuplicates(event.workspaceId ?? undefined);
      if (resolution.autoMerge.length > 0) {
        await entityResolutionService.autoMergeDuplicates(resolution);
      }
    } catch (resolutionErr) {
      // Non-fatal: entity resolution failure should not block OSINT sync
      console.warn('[OSINT→Graph] Entity resolution failed after sync:', resolutionErr);
    }
  } catch (err) {
    // Non-fatal: log but don't block feed polling
    console.warn(`[OSINT→Graph] Failed to sync event "${event.title}" to graph:`, err);
  }
}

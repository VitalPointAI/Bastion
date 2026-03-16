/**
 * Contradiction Detection for Graph Assertions
 *
 * Detects when two assertions about the same entity+property have conflicting
 * values with overlapping temporal ranges. Non-overlapping ranges are treated
 * as historical succession (not contradictions), per OWL/JSON-LD Pitfall 7.
 *
 * When a contradiction is detected:
 * - A :CONTRADICTS edge is created in Neo4j between the two assertion contexts
 * - Confidence on BOTH assertions is lowered by 20%
 * - A ContradictionRecord is returned and emitted on the COP event bus
 */

import { randomUUID } from 'crypto';
import type { ContradictionRecord } from './provenance-types.js';
import { executeWriteQuery, executeReadQuery } from './neo4j-client.js';
import { copEventBus } from '../cop/messaging/event-bus.js';

// ─── Assertion Shape ──────────────────────────────────────────────────────────

/**
 * Minimal assertion shape needed for contradiction checks.
 * Compatible with the full RAFT node shape but only requires the fields
 * necessary to determine if two assertions conflict.
 */
export interface AssertionInput {
  /** Assertion identifier */
  id: string;
  /** Entity this assertion is about */
  entityId: string;
  /** Property key the assertion targets (e.g., "attributes_affiliation") */
  propertyKey: string;
  /** The asserted value */
  value: unknown;
  /** ISO 8601 — when this assertion became valid */
  validFrom: string;
  /** ISO 8601 — when this assertion expired; null = currently valid */
  validTo: string | null;
  /** Current confidence (0–1) */
  confidence: number;
  /** Workspace scope — optional, defaults to global if omitted */
  workspaceId?: string;
}

// ─── Temporal Overlap ─────────────────────────────────────────────────────────

/**
 * Determine whether two temporal ranges overlap.
 *
 * Ranges [aFrom, aTo) and [bFrom, bTo) overlap when:
 *   aFrom < bTo  (or bTo is null — b is still open)
 *   AND
 *   bFrom < aTo  (or aTo is null — a is still open)
 *
 * Per Pitfall 7: non-overlapping succession is NOT a contradiction.
 */
function temporalRangesOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null,
): boolean {
  const aFromTs = new Date(aFrom).getTime();
  const aToTs = aTo ? new Date(aTo).getTime() : Infinity;
  const bFromTs = new Date(bFrom).getTime();
  const bToTs = bTo ? new Date(bTo).getTime() : Infinity;

  return aFromTs < bToTs && bFromTs < aToTs;
}

// ─── detectContradiction ──────────────────────────────────────────────────────

/**
 * Check whether two assertions are contradictions of each other.
 *
 * Returns a ContradictionRecord if:
 * - Both assertions target the same entity (entityId)
 * - Both assertions target the same property (propertyKey)
 * - The asserted values differ
 * - The temporal validity ranges overlap
 *
 * Returns null for:
 * - Same values (no conflict)
 * - Different entities
 * - Different properties
 * - Non-overlapping temporal ranges (historical succession per Pitfall 7)
 *
 * @param assertionA - Existing assertion (the one already in the graph)
 * @param assertionB - Incoming assertion (the new one being added)
 */
export async function detectContradiction(
  assertionA: AssertionInput,
  assertionB: AssertionInput,
): Promise<ContradictionRecord | null> {
  // Different entities or different properties — not a contradiction
  if (
    assertionA.entityId !== assertionB.entityId ||
    assertionA.propertyKey !== assertionB.propertyKey
  ) {
    return null;
  }

  // Same value — no conflict
  if (assertionA.value === assertionB.value) {
    return null;
  }

  // Check temporal overlap (Pitfall 7)
  const overlaps = temporalRangesOverlap(
    assertionA.validFrom,
    assertionA.validTo,
    assertionB.validFrom,
    assertionB.validTo,
  );

  if (!overlaps) {
    // Historical succession — not a contradiction
    return null;
  }

  // ── Contradiction found ────────────────────────────────────────────────────

  const contradictionId = `CONTRA-${randomUUID()}`;
  const detectedAt = new Date().toISOString();
  const workspaceId = assertionA.workspaceId ?? assertionB.workspaceId ?? '';

  // Create :CONTRADICTS edge in Neo4j and lower confidence on both assertions.
  // Assertion IDs are included as literals in the query so that calling code
  // can identify which assertions were targeted (IDs are system-controlled UUIDs).
  await executeWriteQuery(
    `MATCH (a {id: '${assertionA.id}'})
     MATCH (b {id: '${assertionB.id}'})
     MERGE (a)-[r:CONTRADICTS {id: $contradictionId}]->(b)
     SET r.propertyKey = $propertyKey,
         r.detectedAt = $detectedAt,
         r.resolvedAt = null,
         r.resolution = null
     SET a.confidence = CASE WHEN a.confidence IS NOT NULL
                             THEN a.confidence * 0.8
                             ELSE 0.8 END
     SET b.confidence = CASE WHEN b.confidence IS NOT NULL
                             THEN b.confidence * 0.8
                             ELSE 0.8 END`,
    {
      contradictionId,
      propertyKey: assertionA.propertyKey,
      detectedAt,
    },
  );

  const contradictionRecord: ContradictionRecord = {
    id: contradictionId,
    entityId: assertionA.entityId,
    propertyKey: assertionA.propertyKey,
    assertionAId: assertionA.id,
    assertionBId: assertionB.id,
    detectedAt,
  };

  // Emit typed event on COP event bus
  copEventBus.emit('contradiction:detected', {
    contradictionId,
    entityId: assertionA.entityId,
    propertyKey: assertionA.propertyKey,
    assertionAId: assertionA.id,
    assertionBId: assertionB.id,
    workspaceId,
    detectedAt,
  });

  return contradictionRecord;
}

// ─── resolveContradiction ─────────────────────────────────────────────────────

/**
 * Resolve a previously detected contradiction.
 *
 * Resolution types:
 * - accept_a: Assertion A is correct; restore A's confidence, mark B expired
 * - accept_b: Assertion B is correct; restore B's confidence, mark A expired
 * - both_valid: Both are correct (different facets); restore both confidences
 * - flagged_for_intel: Keep lowered confidence; escalate to intel staff
 *
 * @param contradictionId - ID of the :CONTRADICTS relationship to resolve
 * @param resolution      - Resolution type chosen by staff
 */
export async function resolveContradiction(
  contradictionId: string,
  resolution: ContradictionRecord['resolution'],
): Promise<void> {
  const resolvedAt = new Date().toISOString();
  const now = resolvedAt;

  // Fetch the contradiction record to determine entity IDs
  const fetchResult = await executeReadQuery(
    `MATCH (a)-[r:CONTRADICTS {id: $contradictionId}]->(b)
     RETURN a.id AS assertionAId, b.id AS assertionBId,
            a.workspaceId AS workspaceId, b.entityId AS entityId`,
    { contradictionId },
  );

  if (fetchResult.records.length === 0) {
    throw new Error(`Contradiction not found: ${contradictionId}`);
  }

  const record = fetchResult.records[0];
  const assertionAId = record.get('assertionAId') as string;
  const assertionBId = record.get('assertionBId') as string;
  const entityId = (record.get('entityId') as string | null) ?? assertionBId;

  // Reverse the 20% confidence penalty: original = stored / 0.8 ≈ stored * 1.25
  const restorationFactor = 1 / 0.8;

  // Update the :CONTRADICTS relationship with resolution metadata
  await executeWriteQuery(
    `MATCH (a {id: $assertionAId})-[r:CONTRADICTS {id: $contradictionId}]->(b {id: $assertionBId})
     SET r.resolvedAt = $resolvedAt, r.resolution = $resolution`,
    { assertionAId, assertionBId, contradictionId, resolvedAt, resolution },
  );

  // Apply resolution-specific side effects
  switch (resolution) {
    case 'accept_a':
      // Restore A's confidence; expire B
      await executeWriteQuery(
        `MATCH (a {id: $assertionAId})
         MATCH (b {id: $assertionBId})
         SET a.confidence = CASE WHEN a.confidence IS NOT NULL
                                 THEN a.confidence * $factor
                                 ELSE 1.0 END
         SET b.validTo = $now`,
        { assertionAId, assertionBId, factor: restorationFactor, now },
      );
      break;

    case 'accept_b':
      // Restore B's confidence; expire A
      await executeWriteQuery(
        `MATCH (a {id: $assertionAId})
         MATCH (b {id: $assertionBId})
         SET b.confidence = CASE WHEN b.confidence IS NOT NULL
                                 THEN b.confidence * $factor
                                 ELSE 1.0 END
         SET a.validTo = $now`,
        { assertionAId, assertionBId, factor: restorationFactor, now },
      );
      break;

    case 'both_valid':
      // Both assertions are correct facets — restore both confidences
      await executeWriteQuery(
        `MATCH (a {id: $assertionAId})
         MATCH (b {id: $assertionBId})
         SET a.confidence = CASE WHEN a.confidence IS NOT NULL
                                 THEN a.confidence * $factor
                                 ELSE 1.0 END
         SET b.confidence = CASE WHEN b.confidence IS NOT NULL
                                 THEN b.confidence * $factor
                                 ELSE 1.0 END`,
        { assertionAId, assertionBId, factor: restorationFactor },
      );
      break;

    case 'flagged_for_intel':
      // Keep both confidence penalties; no DB changes beyond resolving the relationship
      break;

    default:
      throw new Error(`Unknown resolution type: ${String(resolution)}`);
  }

  // Emit resolution event on COP event bus
  copEventBus.emit('contradiction:resolved', {
    contradictionId,
    entityId,
    resolution: resolution as 'accept_a' | 'accept_b' | 'both_valid' | 'flagged_for_intel',
    resolvedAt,
  });
}

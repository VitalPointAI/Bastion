/**
 * COP Cross-Section Conflict Detector.
 *
 * Detects overlapping or contradictory entities across COP layers from
 * different workspace sections. Supports three conflict types:
 * - Position: same entityId, position distance > threshold (100m)
 * - Affiliation: same entityId, different affiliation
 * - Designation: same entityId, different designation
 *
 * Conflicts are sorted by severity: affiliation > position > designation.
 * Source authority ranking: SIGINT > HUMINT > IMINT > OSINT > default.
 */
import { randomUUID } from 'crypto';
import type { COPSymbolSpec } from './layer-types.js';
import type { COPLayer } from './layer-store.js';

// ---------------------------------------------------------------------------
// Conflict Types
// ---------------------------------------------------------------------------

export interface COPConflict {
  id: string;
  layerIdA: string;
  layerIdB: string;
  entityIdA: string;
  entityIdB: string;
  conflictType: 'position' | 'affiliation' | 'designation';
  description: string;
  resolved: boolean;
  resolvedBy?: string;
  sourceAuthorityA?: string;
  sourceAuthorityB?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Distance threshold in meters for position conflicts. */
const POSITION_THRESHOLD_METERS = 100;

/** Source authority ranking (higher = more authoritative). */
const SOURCE_AUTHORITY_RANKS: Record<string, number> = {
  SIGINT: 5,
  HUMINT: 4,
  IMINT: 3,
  OSINT: 2,
  default: 1,
};

/** Conflict severity ordering (lower index = higher severity). */
const SEVERITY_ORDER: Array<COPConflict['conflictType']> = [
  'affiliation',
  'position',
  'designation',
];

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Conflict Detector
// ---------------------------------------------------------------------------

export class ConflictDetector {
  /**
   * Detect conflicts between a target layer and existing COP layers.
   */
  detect(targetLayer: COPLayer, existingCOPLayers: COPLayer[]): COPConflict[] {
    const conflicts: COPConflict[] = [];

    const targetSymbols = targetLayer.spec?.symbols || [];

    for (const targetSym of targetSymbols) {
      for (const existingLayer of existingCOPLayers) {
        const existingSymbols = existingLayer.spec?.symbols || [];

        for (const existingSym of existingSymbols) {
          if (targetSym.entityId !== existingSym.entityId) continue;

          // Check affiliation conflict
          if (targetSym.affiliation !== existingSym.affiliation) {
            conflicts.push(this.createConflict(
              targetLayer.id, existingLayer.id,
              targetSym, existingSym,
              'affiliation',
              `Entity ${targetSym.entityId} has affiliation '${targetSym.affiliation}' in ${targetLayer.id} but '${existingSym.affiliation}' in ${existingLayer.id}`,
            ));
          }

          // Check position conflict
          const distance = haversineDistance(
            targetSym.position.lat, targetSym.position.lng,
            existingSym.position.lat, existingSym.position.lng,
          );
          if (distance > POSITION_THRESHOLD_METERS) {
            conflicts.push(this.createConflict(
              targetLayer.id, existingLayer.id,
              targetSym, existingSym,
              'position',
              `Entity ${targetSym.entityId} position differs by ${Math.round(distance)}m between ${targetLayer.id} and ${existingLayer.id}`,
            ));
          }

          // Check designation conflict
          if (targetSym.designation !== existingSym.designation) {
            conflicts.push(this.createConflict(
              targetLayer.id, existingLayer.id,
              targetSym, existingSym,
              'designation',
              `Entity ${targetSym.entityId} has designation '${targetSym.designation}' in ${targetLayer.id} but '${existingSym.designation}' in ${existingLayer.id}`,
            ));
          }
        }
      }
    }

    // Sort by severity: affiliation > position > designation
    conflicts.sort((a, b) => {
      const aIdx = SEVERITY_ORDER.indexOf(a.conflictType);
      const bIdx = SEVERITY_ORDER.indexOf(b.conflictType);
      return aIdx - bIdx;
    });

    return conflicts;
  }

  /**
   * Get the numeric authority rank for a source authority string.
   */
  getSourceAuthorityRank(sourceAuthority: string): number {
    return SOURCE_AUTHORITY_RANKS[sourceAuthority] ?? SOURCE_AUTHORITY_RANKS.default;
  }

  private createConflict(
    layerIdA: string,
    layerIdB: string,
    symA: COPSymbolSpec,
    symB: COPSymbolSpec,
    conflictType: COPConflict['conflictType'],
    description: string,
  ): COPConflict {
    return {
      id: randomUUID(),
      layerIdA,
      layerIdB,
      entityIdA: symA.entityId,
      entityIdB: symB.entityId,
      conflictType,
      description,
      resolved: false,
      sourceAuthorityA: symA.sourceAuthority,
      sourceAuthorityB: symB.sourceAuthority,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

/**
 * Detect conflicts between a target layer and existing COP layers.
 * Convenience wrapper around ConflictDetector.detect().
 */
export function detectConflicts(
  targetLayer: COPLayer,
  existingCOPLayers: COPLayer[],
): COPConflict[] {
  const detector = new ConflictDetector();
  return detector.detect(targetLayer, existingCOPLayers);
}

/**
 * Command & Control Domain Types
 *
 * Phase 4.4 Plan 01: Military command relationships and unit hierarchy
 */

/**
 * Military command relationship types per JP 1, Vol 2
 *
 * - OPCON: Operational Control
 * - TACON: Tactical Control
 * - ADCON: Administrative Control
 * - COCOM: Combatant Command
 * - DS: Direct Support
 * - GS: General Support
 * - GSR: General Support-Reinforcing
 * - R: Reinforcing
 */
export type RelationshipType =
  | 'OPCON'
  | 'TACON'
  | 'ADCON'
  | 'COCOM'
  | 'DS'
  | 'GS'
  | 'GSR'
  | 'R';

/**
 * Military unit definition
 *
 * Represents a unit within a mission's command structure with optional
 * link to organizational entity (from Phase 2 DID registry)
 */
export interface Unit {
  id: string; // Format: UNIT-{uuid}
  missionId: string;
  name: string;
  sidc: string; // MIL-STD-2525D symbol identification code for rendering
  parentDid?: string; // Optional link to organizational entity DID
  location?: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
}

/**
 * Command relationship between units
 *
 * Defines superior-subordinate relationships with temporal validity
 */
export interface CommandRelationship {
  id: string;
  missionId: string;
  superiorUnitId: string;
  subordinateUnitId: string;
  relationshipType: RelationshipType;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  createdAt: Date;
}

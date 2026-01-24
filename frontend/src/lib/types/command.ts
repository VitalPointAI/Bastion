/**
 * Command Types
 *
 * Type definitions for command and control structures.
 */

/**
 * Relationship types based on military doctrine.
 */
export type RelationshipType =
  | 'OPCON'   // Operational Control
  | 'TACON'   // Tactical Control
  | 'ADCON'   // Administrative Control
  | 'COCOM'   // Combatant Command
  | 'DS'      // Direct Support
  | 'GS'      // General Support
  | 'GSR'     // General Support Reinforcing
  | 'R';      // Reinforcing

/**
 * Command unit in a mission.
 */
export interface CommandUnit {
  id: string;
  missionId: string;
  name: string;
  sidc: string;          // MIL-STD-2525 Symbol Identification Code
  echelon: string;       // Unit size (squad, platoon, company, etc.)
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Command relationship between units.
 */
export interface CommandRelationship {
  id: string;
  missionId: string;
  superiorUnitId: string;
  subordinateUnitId: string;
  relationshipType: RelationshipType;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hierarchy node for tree visualization.
 */
export interface HierarchyNode {
  unit: CommandUnit;
  relationshipType?: RelationshipType;
  children: HierarchyNode[];
}

/**
 * Matrix cell data.
 */
export interface MatrixCell {
  relationshipId?: string;
  relationshipType?: RelationshipType;
  effectiveFrom?: string;
  effectiveTo?: string;
}

/**
 * Command matrix for grid visualization.
 */
export interface CommandMatrix {
  units: CommandUnit[];
  matrix: Record<string, Record<string, MatrixCell>>;
}

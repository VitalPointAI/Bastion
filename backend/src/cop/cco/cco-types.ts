/**
 * CCO (Common Core Ontology) Type Definitions
 *
 * Types for CCO class mapping, validation, and RAFT-to-CCO
 * entity type mapping. CCO is used as a standardization overlay
 * on the existing RAFT graph in Neo4j.
 */

/** CCO ontology modules relevant to military COP */
export type CCOModule =
  | 'core'
  | 'geospatial'
  | 'agent'
  | 'event'
  | 'artifact'
  | 'information_entity';

/**
 * Mapping of a CCO class URI to its metadata.
 * Loaded from bundled JSON at startup.
 */
export interface CCOClassMapping {
  /** CCO class URI, e.g. "cco:Person" */
  uri: string;
  /** Human-readable label */
  label: string;
  /** Which CCO module this class belongs to */
  module: CCOModule;
  /** Parent class URI for hierarchy traversal */
  parentClass?: string;
}

/**
 * Result of validating a proposed CCO class assignment.
 */
export interface CCOValidationResult {
  valid: boolean;
  reason?: string;
  suggestedClass?: string;
}

/**
 * Default mapping from RAFT entity types to CCO classes.
 * Used by suggestCCOClass() to propose CCO classifications
 * for entities discovered in the RAFT graph.
 */
export const RAFT_TO_CCO_MAP: Record<string, string> = {
  // Actor subtypes
  nation: 'cco:GovernmentOrganization',
  organization: 'cco:Organization',
  individual: 'cco:Person',
  non_state_actor: 'cco:Organization',

  // Military-specific
  military_unit: 'cco:MilitaryOrganization',

  // Geospatial
  location: 'cco:GeospatialRegion',

  // Information
  document: 'cco:InformationContentEntity',

  // Artifacts
  equipment: 'cco:Artifact',
  vehicle: 'cco:Vehicle',
  weapon: 'cco:Weapon',
};

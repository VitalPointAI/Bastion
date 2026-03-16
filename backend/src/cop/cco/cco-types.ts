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

// ============================================================================
// BFO Base Classes (ISO 21838-2)
// Phase 47: Upper ontology foundation — namespace http://purl.obolibrary.org/obo/BFO_
// ============================================================================

/**
 * BFO (Basic Formal Ontology) 2020 base class URIs.
 * BFO is the ISO 21838-2 upper ontology and foundation for the CCO mid-level ontology.
 * Use these constants when classifying entities at the highest level of abstraction.
 */
export const BFO_CLASSES: Record<string, string> = {
  /** BFO:0000001 — root of all entities */
  Entity:       'bfo:0000001',
  /** BFO:0000002 — entities that persist through time (objects, qualities) */
  Continuant:   'bfo:0000002',
  /** BFO:0000003 — entities that unfold through time (events, processes) */
  Occurrent:    'bfo:0000003',
  /** BFO:0000015 — a continuant process realized over time */
  Process:      'bfo:0000015',
  /** BFO:0000019 — a specifically dependent continuant (property) */
  Quality:      'bfo:0000019',
  /** BFO:0000023 — a realizable entity that can be enacted */
  Role:         'bfo:0000023',
  /** BFO:0000034 — a realizable entity with a biological/functional basis */
  Function:     'bfo:0000034',
  /** BFO:0000016 — a realizable entity representing a tendency */
  Disposition:  'bfo:0000016',
};

// ============================================================================
// DODAF View Types
// Phase 47: Architecture framework views — namespace https://dodcio.defense.gov/ontology/dodaf/
// ============================================================================

/**
 * DoDAF (Department of Defense Architecture Framework) 2.0 view type identifiers.
 * Used when classifying architecture artifacts and viewpoints in the RAFT graph.
 */
export const DODAF_VIEWS: Record<string, string> = {
  /** Operational View 1 — High-level operational concept */
  OV1: 'dodaf:OV-1',
  /** Operational View 2 — Operational resource flow description */
  OV2: 'dodaf:OV-2',
  /** Operational View 3 — Operational resource flow matrix */
  OV3: 'dodaf:OV-3',
  /** Operational View 4 — Organizational relationships chart */
  OV4: 'dodaf:OV-4',
  /** Operational View 5 — Operational activity model */
  OV5: 'dodaf:OV-5',
  /** Operational View 6 — Operational rules model */
  OV6: 'dodaf:OV-6',
  /** Systems View 1 — Systems interface description */
  SV1: 'dodaf:SV-1',
  /** Systems View 2 — Systems resource flow description */
  SV2: 'dodaf:SV-2',
  /** Systems View 3 — Systems-systems matrix */
  SV3: 'dodaf:SV-3',
  /** Systems View 4 — Systems functionality description */
  SV4: 'dodaf:SV-4',
  /** Systems View 5 — Operational activity to systems function traceability matrix */
  SV5: 'dodaf:SV-5',
  /** Systems View 6 — Systems data exchange matrix */
  SV6: 'dodaf:SV-6',
};

// ============================================================================
// JC3IEDM Entity Types
// Phase 47: Military entity catalog — namespace http://www.mip.saic.com/jc3iedm/
// ============================================================================

/**
 * JC3IEDM (Joint Command, Control, and Consultation Information Exchange
 * Data Model) military entity type identifiers.
 * Used for classifying military-specific entities beyond the CCO mid-level.
 */
export const JC3_ENTITY_TYPES: Record<string, string> = {
  /** Military unit (e.g., battalion, brigade, division) */
  Unit:       'jc3:Unit',
  /** Fixed or semi-permanent installation */
  Facility:   'jc3:Facility',
  /** Military platform, vehicle, or weapons system */
  Equipment:  'jc3:Equipment',
  /** Geographic or terrain feature */
  Feature:    'jc3:Feature',
};

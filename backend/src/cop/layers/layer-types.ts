/**
 * Backend-specific COP layer types.
 *
 * These extend the shared COP types with input/query interfaces
 * used by the layer store and API endpoints.
 *
 * Note: Types are re-declared here rather than importing from frontend
 * to maintain backend/frontend module boundary separation.
 */

import type { ConfidenceTier } from '../../graph/provenance-types.js';

// Re-export for consumers that import from this module
export type { ConfidenceTier };

// ---------------------------------------------------------------------------
// Re-declared shared types (canonical source: frontend/src/types/cop.ts)
// ---------------------------------------------------------------------------

export type LayerState = 'draft' | 'review' | 'published' | 'cop';

export type COPLayerType =
  | 'force_disposition'
  | 'objectives'
  | 'control_measures'
  | 'intel'
  | 'logistics'
  | 'c2';

export type Affiliation = 'friendly' | 'enemy' | 'neutral' | 'unknown';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface COPSymbolSpec {
  entityId: string;
  sidc: string;
  position: LatLng;
  designation: string;
  affiliation: Affiliation;
  movementPath?: Array<{ phase: number; position: LatLng }>;
  linkedEntities: string[];
  ccoClass: string;
  confidence: number;
  sourceAuthority: string;
  /** Confidence tier computed from confidence score — drives visual encoding */
  confidenceTier: ConfidenceTier;
  /** Provenance source method (prov:wasGeneratedBy) */
  assertedVia?: string;
  /** Human-readable provenance summary for symbol tooltips */
  provenanceSummary?: string;
}

export interface COPControlMeasureSpec {
  id: string;
  type: 'boundary' | 'phase_line' | 'objective_area' | 'axis_of_advance' | 'route';
  points: LatLng[];
  label: string;
  style?: Record<string, string>;
  phaseRange?: { start: number; end: number };
}

export interface COPAnnotationSpec {
  id: string;
  svgFragment: string;
  position: LatLng;
  bounds?: { topLeft: LatLng; bottomRight: LatLng };
  generatedBy: string;
  description: string;
}

export interface COPPhaseSpec {
  phaseNumber: number;
  label: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

export interface COPLayerSpec {
  layerId: string;
  layerType: COPLayerType;
  workspaceId: string;
  sectionId: string;
  symbols: COPSymbolSpec[];
  controlMeasures: COPControlMeasureSpec[];
  customAnnotations: COPAnnotationSpec[];
  temporalPhases: COPPhaseSpec[];
  metadata: {
    generatedBy: string;
    generatedAt: string;
    sourceDocumentIds: string[];
    ccoValidated: boolean;
  };
}

export interface ReviewFeedback {
  id: string;
  layerId: string;
  type: 'spatial_annotation' | 'general_comment';
  content: string;
  position?: LatLng;
  entityId?: string;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Backend-specific input/query types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new COP layer.
 */
export interface CreateLayerInput {
  workspaceId: string;
  sectionId: string;
  layerType: COPLayerType;
  spec: COPLayerSpec;
}

/**
 * Input for updating an existing COP layer.
 * Partial spec allows incremental updates from agent regeneration.
 */
export interface UpdateLayerInput {
  layerId: string;
  spec?: Partial<COPLayerSpec>;
  reviewFeedback?: ReviewFeedback[];
}

/**
 * Input for transitioning a layer between lifecycle states.
 * Includes audit trail fields (performedBy, reason).
 */
export interface LayerTransitionInput {
  layerId: string;
  targetState: LayerState;
  performedBy: string;
  reason?: string;
}

/**
 * Query filters for retrieving COP layers.
 */
export interface LayerQueryFilters {
  workspaceId?: string;
  sectionId?: string;
  state?: LayerState;
  layerType?: COPLayerType;
  beforeDate?: string;
  afterDate?: string;
}

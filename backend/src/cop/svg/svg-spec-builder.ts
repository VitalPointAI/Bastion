/**
 * SVG Spec Builder
 *
 * Converts COPLayerSpec symbols and control measures into the data shapes
 * that the frontend needs for milsymbol rendering and Leaflet overlay display.
 *
 * This module does NOT generate SVG -- it prepares the structured data
 * that milsymbol.Symbol() and Leaflet layers consume on the frontend.
 */

import type {
  COPSymbolSpec,
  COPControlMeasureSpec,
  LatLng,
} from '../layers/layer-types.js';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Data shape the frontend needs to render a military symbol via milsymbol.
 * Passed directly to milsymbol.Symbol(sidc, options).
 */
export interface SymbolRenderData {
  entityId: string;
  sidc: string;
  position: LatLng;
  designation: string;
  affiliation: string;
  options: Record<string, unknown>;
}

/**
 * Data shape for rendering a control measure as a Leaflet polyline/polygon.
 */
export interface ControlMeasureRenderData {
  id: string;
  type: COPControlMeasureSpec['type'];
  points: LatLng[];
  label: string;
  style: {
    color: string;
    weight: number;
    opacity: number;
    dashArray?: string;
    fill?: boolean;
    fillColor?: string;
    fillOpacity?: number;
  };
  phaseRange?: { start: number; end: number };
}

/**
 * Data shape for rendering movement path animation.
 * Keyed by phase number, each entry is a position for that phase.
 */
export interface MovementPathRenderData {
  entityId: string;
  designation: string;
  phases: Array<{ phase: number; position: LatLng }>;
}

// ---------------------------------------------------------------------------
// Default styles for control measure types
// ---------------------------------------------------------------------------

const CONTROL_MEASURE_STYLES: Record<
  COPControlMeasureSpec['type'],
  ControlMeasureRenderData['style']
> = {
  boundary: {
    color: '#000000',
    weight: 3,
    opacity: 0.8,
    dashArray: '10 5',
  },
  phase_line: {
    color: '#800080',
    weight: 2,
    opacity: 0.7,
    dashArray: '15 10',
  },
  objective_area: {
    color: '#FF0000',
    weight: 2,
    opacity: 0.8,
    fill: true,
    fillColor: '#FF0000',
    fillOpacity: 0.15,
  },
  axis_of_advance: {
    color: '#0000FF',
    weight: 3,
    opacity: 0.9,
  },
  route: {
    color: '#008000',
    weight: 2,
    opacity: 0.7,
    dashArray: '5 5',
  },
  engagement_area: {
    color: '#FF4444',
    weight: 2,
    opacity: 0.8,
    fill: true,
    fillColor: '#FF4444',
    fillOpacity: 0.08,
  },
  security_zone: {
    color: '#FF8800',
    weight: 2,
    opacity: 0.7,
    dashArray: '12 6',
    fill: true,
    fillColor: '#FF8800',
    fillOpacity: 0.06,
  },
  fire_support_coordination_line: {
    color: '#CC00CC',
    weight: 2,
    opacity: 0.8,
    dashArray: '20 5 5 5',
  },
};

// ---------------------------------------------------------------------------
// Affiliation to milsymbol additionalInformation mapping
// ---------------------------------------------------------------------------

const AFFILIATION_INFO: Record<string, string> = {
  friendly: 'FRI',
  enemy: 'ENY',
  hostile: 'ENY',
  neutral: 'NEU',
  unknown: 'UNK',
};

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

/**
 * Convert a COPSymbolSpec to the data shape milsymbol needs for rendering.
 * Includes milsymbol options: size, uniqueDesignation, additionalInformation.
 * Validates that SIDC is exactly 20 characters.
 *
 * @throws Error if SIDC is not exactly 20 characters
 */
export function buildSymbolRenderData(symbol: COPSymbolSpec): SymbolRenderData {
  if (symbol.sidc.length !== 20) {
    throw new Error(
      `SIDC must be exactly 20 characters, got ${symbol.sidc.length}: ${symbol.sidc}`
    );
  }

  return {
    entityId: symbol.entityId,
    sidc: symbol.sidc,
    position: symbol.position,
    designation: symbol.designation,
    affiliation: symbol.affiliation,
    options: {
      size: 35,
      uniqueDesignation: symbol.designation,
      additionalInformation: AFFILIATION_INFO[symbol.affiliation] ?? '',
    },
  };
}

/**
 * Convert a COPControlMeasureSpec to a Leaflet-renderable data structure
 * with style properties based on control measure type.
 * Custom styles from the spec override defaults.
 */
export function buildControlMeasureRenderData(
  cm: COPControlMeasureSpec
): ControlMeasureRenderData {
  const defaultStyle = CONTROL_MEASURE_STYLES[cm.type];

  // Merge custom styles from spec over defaults
  const style = cm.style
    ? {
        ...defaultStyle,
        ...(cm.style.color && { color: cm.style.color }),
        ...(cm.style.weight && { weight: Number(cm.style.weight) }),
        ...(cm.style.opacity && { opacity: Number(cm.style.opacity) }),
        ...(cm.style.dashArray && { dashArray: cm.style.dashArray }),
      }
    : defaultStyle;

  return {
    id: cm.id,
    type: cm.type,
    points: cm.points,
    label: cm.label,
    style,
    phaseRange: cm.phaseRange,
  };
}

/**
 * Extract movement path data from a symbol for phase-keyed animation.
 * Returns null if the symbol has no movement path.
 */
export function buildMovementPathRenderData(
  symbol: COPSymbolSpec
): MovementPathRenderData | null {
  if (!symbol.movementPath || symbol.movementPath.length === 0) {
    return null;
  }

  return {
    entityId: symbol.entityId,
    designation: symbol.designation,
    phases: symbol.movementPath.map((mp) => ({
      phase: mp.phase,
      position: mp.position,
    })),
  };
}

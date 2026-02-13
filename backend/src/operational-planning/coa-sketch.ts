/**
 * COA Sketch Data Model for Visual COA Representation with MIL-STD-2525D Operational Graphics
 *
 * Defines symbol placement, phase definitions, and movement paths for map overlay rendering.
 * Used in MDMP Phase 3 (COA Development) for visual COA representation with operational graphics.
 *
 * Supports:
 * - MIL-STD-2525D symbol identification codes (SIDC)
 * - Multi-phase unit positioning and movement
 * - Control measures (boundaries, phase lines, objectives, etc.)
 * - Affiliation-based filtering for map overlay layers
 * - Synchronized timeline visualization
 */

// ==========================================================================
// Type Definitions
// ==========================================================================

/** Military symbol affiliation */
export type SymbolAffiliation = 'friendly' | 'enemy' | 'neutral' | 'unknown' | 'combined' | 'partner';

/** Symbol dimension (unit type) */
export type SymbolDimension = 'land_unit' | 'air' | 'sea_surface' | 'subsurface' | 'equipment' | 'installation';

/** Echelon level */
export type Echelon = 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'brigade' | 'division' | 'corps' | 'army';

/** A single MIL-STD-2525D symbol on the map */
export interface SketchSymbol {
  /** Unique symbol identifier */
  id: string;
  /** MIL-STD-2525D SIDC (Symbol Identification Code), 15-character */
  sidc: string;
  /** Human-readable unit designation */
  designation: string;
  /** Affiliation for filtering */
  affiliation: SymbolAffiliation;
  /** Symbol dimension */
  dimension: SymbolDimension;
  /** Echelon level */
  echelon: Echelon;
  /** Position: lat/long */
  position: { lat: number; lng: number };
  /** Resources assigned to this unit */
  resources: Array<{ type: string; description: string; quantity: number }>;
  /** Tasks assigned to this unit */
  tasks: string[];
  /** Which phase(s) this symbol is active in */
  activeInPhases: number[];
  /** Movement path across phases (ordered positions per phase) */
  movementPath?: Array<{ phase: number; position: { lat: number; lng: number } }>;
}

/** A control measure or graphic on the map */
export interface ControlMeasure {
  /** Unique identifier */
  id: string;
  /** Type: boundary, phase_line, objective, axis_of_advance, direction_of_attack, assembly_area, engagement_area, fire_support_coord */
  type: string;
  /** Display label */
  label: string;
  /** Geometry: line (array of points) or polygon (closed array) or point */
  geometry: {
    type: 'line' | 'polygon' | 'point';
    coordinates: Array<{ lat: number; lng: number }>;
  };
  /** Affiliation */
  affiliation: SymbolAffiliation;
  /** Active in phases */
  activeInPhases: number[];
}

/** Phase definition for the timeline */
export interface SketchPhase {
  /** Phase number (1-based) */
  number: number;
  /** Phase name (e.g., "Phase I: Isolation", "Phase II: Decisive Action") */
  name: string;
  /** Description */
  description: string;
  /** Estimated duration */
  estimatedDuration: string;
  /** Key tasks in this phase */
  keyTasks: string[];
}

/** Area of Operations bounds */
export interface AOBounds {
  /** Southwest corner */
  southwest: { lat: number; lng: number };
  /** Northeast corner */
  northeast: { lat: number; lng: number };
}

/** Complete COA sketch data */
export interface COASketchData {
  /** COA identifier */
  coaId: string;
  /** COA name */
  coaName: string;
  /** Area of Operations bounds for map centering */
  aoBounds: AOBounds;
  /** All symbols on the map */
  symbols: SketchSymbol[];
  /** Control measures (phase lines, boundaries, objectives) */
  controlMeasures: ControlMeasure[];
  /** Phase definitions */
  phases: SketchPhase[];
  /** Legend entries */
  legend: Array<{ sidc: string; description: string }>;
  /** Created timestamp */
  createdAt: number;
}

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Filters symbols to those active in the given phase.
 *
 * @param sketch - COA sketch data
 * @param phaseNumber - Phase number to filter by (1-based)
 * @returns Array of symbols active in the specified phase
 */
export function getSymbolsForPhase(sketch: COASketchData, phaseNumber: number): SketchSymbol[] {
  return sketch.symbols.filter((symbol) => symbol.activeInPhases.includes(phaseNumber));
}

/**
 * Filters control measures to those active in the given phase.
 *
 * @param sketch - COA sketch data
 * @param phaseNumber - Phase number to filter by (1-based)
 * @returns Array of control measures active in the specified phase
 */
export function getControlMeasuresForPhase(sketch: COASketchData, phaseNumber: number): ControlMeasure[] {
  return sketch.controlMeasures.filter((measure) => measure.activeInPhases.includes(phaseNumber));
}

/**
 * Returns the symbol's position for a given phase (using movementPath or default position).
 *
 * @param symbol - Sketch symbol
 * @param phaseNumber - Phase number to get position for (1-based)
 * @returns Position for the specified phase
 */
export function getSymbolPosition(symbol: SketchSymbol, phaseNumber: number): { lat: number; lng: number } {
  // If movementPath exists, find position for this phase
  if (symbol.movementPath && symbol.movementPath.length > 0) {
    const phasePosition = symbol.movementPath.find((p) => p.phase === phaseNumber);
    if (phasePosition) {
      return phasePosition.position;
    }
  }

  // Fall back to default position
  return symbol.position;
}

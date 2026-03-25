/**
 * Operational Design Types
 *
 * Phase 25 Plan 01: All TypeScript interfaces for the operational design domain.
 * Based on JP 5-0 operational design methodology.
 */

// ─── Section Status ──────────────────────────────────────────────────────────

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';

export interface DesignStatus {
  problemFraming: SectionStatus;
  cogAnalysis: SectionStatus;
  linesOfEffort: SectionStatus;
  operationalApproach: SectionStatus;
}

// ─── Problem Framing (JP 5-0) ────────────────────────────────────────────────

export interface ProblemFramingData {
  currentState: string;
  desiredEndState: string;
  problemStatement: string;
  keyTensions: string[];
  obstacles: string[];
  opportunities: string[];
  assumptions: string[];
  constraints: string[];
}

// ─── CoG Analysis (Strange's CG-CC-CR-CV) ───────────────────────────────────

export interface CoGNode {
  id: string;
  type: 'cog' | 'critical-capability' | 'critical-requirement' | 'critical-vulnerability';
  label: string;
  description: string;
  children: CoGNode[];
}

export interface CoGTree {
  root: CoGNode | null;
}

export interface CoGAnalysis {
  friendly: CoGTree;
  adversary: CoGTree;
}

// ─── Lines of Effort ─────────────────────────────────────────────────────────

export interface LOECoGLink {
  loeId: string;
  decisivePointId: string;
  cogNodeId: string;
  cogNodeType: CoGNode['type'];
}

export interface DecisivePoint {
  id: string;
  label: string;
  description: string;
  phase: string;
  position: number;
  cogLinks: LOECoGLink[];
}

export interface LineOfEffort {
  id: string;
  name: string;
  description: string;
  objectiveId?: string;
  decisivePoints: DecisivePoint[];
  order: number;
}

// ─── Map Overlay (Phase 56) ──────────────────────────────────────────────────

export interface MapSymbol {
  id: string;
  sidc: string;                      // MIL-STD-2525D SIDC code
  designation: string;               // e.g. "1st MarDiv"
  affiliation: 'friendly' | 'enemy' | 'neutral' | 'unknown';
  lat: number;
  lng: number;
  echelon?: string;
  label?: string;
  additionalInfo?: Record<string, string>;
  createdBy: 'ironclaw' | 'user';
  createdAt: string;
}

export interface ControlMeasure {
  id: string;
  type:
    | 'phase_line'
    | 'boundary'
    | 'axis_of_advance'
    | 'objective'
    | 'engagement_area'
    | 'nai'                          // Named Area of Interest
    | 'fscm'                         // Fire Support Coordination Measure
    | 'flot'                         // Forward Line of Troops
    | 'other';
  label: string;
  affiliation: 'friendly' | 'enemy' | 'neutral';
  geometry: {
    type: 'line' | 'polygon' | 'point';
    coordinates: Array<{ lat: number; lng: number }>;
  };
  createdBy: 'ironclaw' | 'user';
  createdAt: string;
}

export interface MapOverlay {
  symbols: MapSymbol[];
  controlMeasures: ControlMeasure[];
  aoBounds?: {
    southwest: { lat: number; lng: number };
    northeast: { lat: number; lng: number };
  };
  lastUpdatedBy: 'ironclaw' | 'user';
  lastUpdatedAt: string;
}

// ─── Operational Approach ────────────────────────────────────────────────────

export interface OperationalApproach {
  phases: Array<{ id: string; name: string; description: string; order: number }>;
  transitions: Array<{ fromPhaseId: string; toPhaseId: string; conditions: string[] }>;
  decisionPoints: Array<{ id: string; label: string; phaseId: string; criteria: string[] }>;
  narrative: string;
  mapOverlay?: MapOverlay;           // Phase 56: Visual Operational Approach Editor
}

// ─── Design-to-Plan Handoff ──────────────────────────────────────────────────

export interface DesignHandoffPayload {
  problemStatement: string;
  cogAnalysis: CoGAnalysis;
  linesOfEffort: LineOfEffort[];
  phases: OperationalApproach['phases'];
  objectives: string[];
  assumptions: string[];
  constraints: string[];
}

// ─── Top-Level Operational Design Record ─────────────────────────────────────

export interface OperationalDesign {
  id: string;
  problemSetId: string;
  problemFraming: ProblemFramingData;
  cogAnalysis: CoGAnalysis;
  linesOfEffort: LineOfEffort[];
  operationalApproach: OperationalApproach;
  status: DesignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Operational Design Service
 *
 * Phase 25 Plan 01: API client for design CRUD operations.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend) ──────────────────────────────────────────

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';

export interface DesignStatus {
  problemFraming: SectionStatus;
  cogAnalysis: SectionStatus;
  linesOfEffort: SectionStatus;
  operationalApproach: SectionStatus;
}

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

export interface DesignHandoffPayload {
  problemStatement: string;
  cogAnalysis: CoGAnalysis;
  linesOfEffort: LineOfEffort[];
  phases: OperationalApproach['phases'];
  objectives: string[];
  assumptions: string[];
  constraints: string[];
}

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

// ─── Service ────────────────────────────────────────────────────────────────

export const designService = {
  /**
   * Get full operational design for a problem set (auto-creates if none exists).
   */
  async getDesign(problemSetId: string): Promise<OperationalDesign> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}`);
    if (!res.ok) throw new Error(`Failed to get design: ${res.statusText}`);
    const data = await res.json();
    // Guard against Ironclaw writing non-array data to array fields
    if (!Array.isArray(data.linesOfEffort)) data.linesOfEffort = [];
    return data;
  },

  /**
   * Get just the section statuses.
   */
  async getStatus(problemSetId: string): Promise<DesignStatus> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/status`);
    if (!res.ok) throw new Error(`Failed to get design status: ${res.statusText}`);
    return res.json();
  },

  /**
   * Update one section's data.
   */
  async updateSection(problemSetId: string, section: string, data: unknown): Promise<OperationalDesign> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/${section}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update section ${section}: ${res.statusText}`);
    return res.json();
  },

  /**
   * Request AI analysis for a design section.
   * Optionally pass additional agent IDs to augment the default agent's analysis.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async analyzeSection(problemSetId: string, section: string, context: object, additionalAgents?: string[]): Promise<Record<string, any>> {
    const body: Record<string, unknown> = { section, context };
    if (additionalAgents && additionalAgents.length > 0) {
      body.additionalAgents = additionalAgents;
    }
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to analyze section ${section}: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get design-to-plan handoff payload.
   */
  async getHandoff(problemSetId: string): Promise<DesignHandoffPayload> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/handoff`);
    if (!res.ok) throw new Error(`Failed to get handoff: ${res.statusText}`);
    return res.json();
  },

  /**
   * Push handoff payload to database (persists for Plan tab consumption).
   * @deprecated Phase 49 — Plan tab fetches directly via getDesign(). Kept for backward compatibility.
   */
  async pushHandoff(problemSetId: string): Promise<{ success: boolean; pushedAt: string }> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/push-handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to push handoff: ${res.statusText}`);
    return res.json();
  },
};

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

export interface OperationalApproach {
  phases: Array<{ id: string; name: string; description: string; order: number }>;
  transitions: Array<{ fromPhaseId: string; toPhaseId: string; conditions: string[] }>;
  decisionPoints: Array<{ id: string; label: string; phaseId: string; criteria: string[] }>;
  narrative: string;
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
    return res.json();
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
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async analyzeSection(problemSetId: string, section: string, context: object): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, context }),
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

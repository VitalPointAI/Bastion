/**
 * Operational Planning Domain Types
 *
 * Phase 05 Plan 01: Foundational data models for operational planning
 * Follows JP 5-0 Joint Planning Process doctrine
 */

/**
 * JP 5-0 Joint Planning Process steps
 */
export type JP50Step =
  | 'planning_initiation'
  | 'mission_analysis'
  | 'coa_development'
  | 'coa_analysis'
  | 'coa_comparison'
  | 'coa_approval'
  | 'plan_development'
  | 'plan_approval';

/**
 * Status for each JP 5-0 step
 */
export type StepStatus = 'not_started' | 'in_progress' | 'ready' | 'approved' | 'rejected';

/**
 * Plan types following military doctrine
 */
export type PlanType = 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD';

/**
 * Classification levels
 */
export type Classification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';

/**
 * Commander approval tracking
 */
export interface CommanderApproval {
  coaApproved: boolean;
  planApproved: boolean;
  coaApprovedAt?: Date;
  planApprovedAt?: Date;
  coaApprovedBy?: string; // DID
  planApprovedBy?: string; // DID
}

/**
 * Mission Statement (Who, What, When, Where, Why)
 */
export interface MissionStatement {
  who: string; // Task organization
  what: string; // Task or action
  when: string; // Time or event
  where: string; // Location
  why: string; // Purpose
}

/**
 * Commander's Intent following Klein's 7 facets
 */
export interface CommandersIntent {
  purpose: string; // Why this operation matters
  keyTasks: string[]; // Essential tasks
  endState: string; // Desired outcome
  context: string; // Relevant background
  constraints: string[]; // Limitations
  criticalFactors: string[]; // What determines success
  antigoals: string[]; // What to avoid
}

/**
 * Subordinate task for COA
 */
export interface SubordinateTask {
  id: string;
  unitId: string; // Links to force roster
  task: string;
  purpose: string;
  supportingEfforts?: string[];
}

/**
 * Risk assessment for COA
 */
export interface RiskAssessment {
  id: string;
  category: 'operational' | 'political' | 'strategic' | 'tactical';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

/**
 * Red Team simulation results populated by Red Team agent
 */
export interface RedTeamResult {
  adversaryActions: string[]; // What the adversary might do
  vulnerabilities: string[]; // Weaknesses in this COA
  counterActions: string[]; // How adversary might counter
  outcomeAssessment: string; // Overall assessment
  confidenceScore: number; // 0-100
  simulatedAt: Date;
  agentId: string; // DID of Red Team agent
}

/**
 * COA Comparison scoring populated by Comparator agent
 */
export interface COAComparisonScore {
  feasibility: { score: number; rationale: string }; // Can we do it?
  acceptability: { score: number; rationale: string }; // Worth the cost?
  suitability: { score: number; rationale: string }; // Does it achieve objective?
  distinguishability: { score: number; rationale: string }; // Different from others?
  completeness: { score: number; rationale: string }; // Fully addresses mission?
  overallScore: number; // Composite score
  ranking: number; // Rank among all COAs (1, 2, 3...)
  comparedAt: Date;
  agentId: string; // DID of Comparator agent
}

/**
 * Course of Action (COA)
 */
export interface COA {
  id: string; // Format: COA-{uuid}
  planId: string;
  number: number; // COA 1, 2, 3...
  name: string;
  description: string;
  scheme: string; // Scheme of maneuver
  commandersIntent: CommandersIntent;
  tasks: SubordinateTask[];
  risks: RiskAssessment[];
  supportingEfforts: string[];
  decisiveOperation: string;
  shaping: string;
  sustainingOperations: string;
  redTeamResults?: RedTeamResult; // Populated by Red Team agent
  comparisonScore?: COAComparisonScore; // Populated by Comparator agent
  selected: boolean;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 5-Paragraph Order: Situation (Paragraph 1)
 */
export interface SituationParagraph {
  areaOfInterest: string;
  areaOfOperations: string;
  enemyForces: {
    composition: string;
    disposition: string;
    strength: string;
    recentActivity: string;
    capabilities: string[];
    vulnerabilities: string[];
  };
  friendlyForces: {
    higherHQ: string;
    adjacentUnits: string[];
    supportingUnits: string[];
  };
  civilConsiderations: {
    population: string;
    infrastructure: string;
    governance: string;
  };
  attachmentsDetachments: string[];
}

/**
 * 5-Paragraph Order: Execution (Paragraph 3)
 */
export interface ExecutionParagraph {
  commandersIntent: CommandersIntent;
  conceptOfOperations: {
    scheme: string;
    phases: Array<{
      name: string;
      purpose: string;
      tasks: string[];
    }>;
  };
  tasks: SubordinateTask[];
  coordinatingInstructions: string[];
  fires: {
    supportingUnits: string[];
    priorityTargets: string[];
    restrictions: string[];
  };
  riskMitigation: {
    criticalRisks: RiskAssessment[];
    mitigationMeasures: string[];
  };
}

/**
 * 5-Paragraph Order: Sustainment (Paragraph 4)
 */
export interface SustainmentParagraph {
  logistics: {
    supplyPlan: string;
    transportationPlan: string;
    maintenancePlan: string;
  };
  personnel: {
    replacementPlan: string;
    medicalEvacuation: string;
  };
  publicAffairs: string;
  civilAffairs: string;
  healthServiceSupport: string;
}

/**
 * 5-Paragraph Order: Command and Signal (Paragraph 5)
 */
export interface CommandSignalParagraph {
  commandPost: {
    location: string;
    alternateLocation: string;
  };
  succession: string[]; // Chain of command
  signal: {
    frequencies: string[];
    callSigns: Record<string, string>;
    pyrotechnics: string[];
  };
  codewords: Record<string, string>;
}

/**
 * Annex letter designation (A-Z)
 */
export type AnnexLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

/**
 * Plan annex
 */
export interface Annex {
  letter: AnnexLetter;
  title: string;
  content: string; // JSONB allows flexible content
}

/**
 * Operational Plan following JP 5-0 structure
 */
export interface OperationalPlan {
  id: string; // Format: OPLAN-{uuid}
  missionId: string; // Links to mission workspace
  objectiveIds: string[]; // Links to strategic objectives (minimum 1 required)
  name: string;
  classification: Classification;
  planType: PlanType;
  step: JP50Step; // Current workflow step
  stepStatuses: Record<JP50Step, StepStatus>; // Track each step's status
  commanderApproval: CommanderApproval;

  // 5-Paragraph Order structure
  situation: SituationParagraph;
  mission: MissionStatement;
  execution: ExecutionParagraph; // Populated during COA selection
  sustainment: SustainmentParagraph;
  commandSignal: CommandSignalParagraph;

  annexes: Record<AnnexLetter, Annex>;
  yjsDocumentId: string; // For Yjs collaboration

  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JSON Rules Engine condition type
 */
export interface JSONRulesEngineCondition {
  all?: JSONRulesEngineCondition[];
  any?: JSONRulesEngineCondition[];
  fact?: string;
  operator?: string;
  value?: unknown;
  path?: string;
}

/**
 * ROE rule category
 */
export type ROECategory = 'weapons' | 'targets' | 'force' | 'procedures' | 'special';

/**
 * ROE event type
 */
export type ROEEventType = 'roe-violation' | 'roe-warning';

/**
 * ROE rule event
 */
export interface ROEEvent {
  type: ROEEventType;
  params: {
    severity: string;
    message: string;
    overrideAuthority: string;
    citation: string; // Legal/policy reference
  };
}

/**
 * Rules of Engagement (ROE) rule for json-rules-engine
 */
export interface ROERule {
  id: string; // Format: ROE-{uuid}
  missionId: string;
  name: string;
  description: string;
  category: ROECategory;
  conditions: JSONRulesEngineCondition;
  event: ROEEvent;
  active: boolean;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ROE Override for documented rule violations
 */
export interface ROEOverride {
  id: string; // Format: OVR-{uuid}
  planId: string;
  ruleId: string;
  actionContext: Record<string, unknown>; // Context when override occurred
  violations: string[]; // Which rules were violated
  justification: string; // Required - must document why
  commanderDID: string; // Who authorized override
  approvedAt: Date;
  blockchainTxHash: string; // Immutable audit trail
}

/**
 * Plan Version for history tracking with Yjs snapshots
 */
export interface PlanVersion {
  id: string; // Format: VER-{uuid}
  planId: string;
  version: number;
  yjsUpdate: Buffer; // Yjs state snapshot
  snapshot: OperationalPlan; // Full plan snapshot
  changedBy: string; // DID
  changedAt: Date;
  changeReason?: string;
}

/**
 * Input types for create operations
 */
export interface CreateOperationalPlanInput {
  missionId: string;
  objectiveIds: string[]; // Minimum 1 required
  name: string;
  classification: Classification;
  planType: PlanType;
  yjsDocumentId: string;
}

export interface UpdateOperationalPlanInput {
  name?: string;
  classification?: Classification;
  planType?: PlanType;
  situation?: SituationParagraph;
  mission?: MissionStatement;
  execution?: ExecutionParagraph;
  sustainment?: SustainmentParagraph;
  commandSignal?: CommandSignalParagraph;
  annexes?: Record<AnnexLetter, Annex>;
}

export interface CreateCOAInput {
  planId: string;
  number: number;
  name: string;
  description: string;
  scheme: string;
  commandersIntent: CommandersIntent;
  tasks?: SubordinateTask[];
  risks?: RiskAssessment[];
  supportingEfforts?: string[];
  decisiveOperation?: string;
  shaping?: string;
  sustainingOperations?: string;
}

export interface UpdateCOAInput {
  name?: string;
  description?: string;
  scheme?: string;
  commandersIntent?: CommandersIntent;
  tasks?: SubordinateTask[];
  risks?: RiskAssessment[];
  supportingEfforts?: string[];
  decisiveOperation?: string;
  shaping?: string;
  sustainingOperations?: string;
}

export interface CreateROERuleInput {
  missionId: string;
  name: string;
  description: string;
  category: ROECategory;
  conditions: JSONRulesEngineCondition;
  event: ROEEvent;
}

export interface UpdateROERuleInput {
  name?: string;
  description?: string;
  category?: ROECategory;
  conditions?: JSONRulesEngineCondition;
  event?: ROEEvent;
  active?: boolean;
}

export interface CreateROEOverrideInput {
  planId: string;
  ruleId: string;
  actionContext: Record<string, unknown>;
  violations: string[];
  justification: string;
  commanderDID: string;
  blockchainTxHash: string;
}

export interface CreateVersionInput {
  planId: string;
  yjsUpdate: Buffer;
  snapshot: OperationalPlan;
  changedBy: string;
  changeReason?: string;
}

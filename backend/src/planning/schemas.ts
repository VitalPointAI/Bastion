/**
 * Operational Planning Zod Schemas
 *
 * Phase 05 Plan 01: Validation schemas with .describe() hints for LLM extraction
 */

import { z } from 'zod';

/**
 * Classification levels
 */
export const ClassificationSchema = z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET'])
  .describe('Security classification level');

/**
 * Plan types
 */
export const PlanTypeSchema = z.enum(['OPLAN', 'OPORD', 'CONPLAN', 'FRAGORD'])
  .describe('Plan type following military doctrine: OPLAN (operation plan), OPORD (operation order), CONPLAN (concept plan), FRAGORD (fragmentary order)');

/**
 * JP 5-0 steps
 */
export const JP50StepSchema = z.enum([
  'planning_initiation',
  'mission_analysis',
  'coa_development',
  'coa_analysis',
  'coa_comparison',
  'coa_approval',
  'plan_development',
  'plan_approval'
]).describe('Joint Planning Process step from JP 5-0');

/**
 * Step status
 */
export const StepStatusSchema = z.enum(['not_started', 'in_progress', 'ready', 'approved', 'rejected'])
  .describe('Status of a planning step');

/**
 * ROE category
 */
export const ROECategorySchema = z.enum(['weapons', 'targets', 'force', 'procedures', 'special'])
  .describe('Category of Rules of Engagement');

/**
 * Mission Statement schema
 */
export const MissionStatementSchema = z.object({
  who: z.string().describe('Task organization - who will execute'),
  what: z.string().describe('Task or action to be performed'),
  when: z.string().describe('Time or event trigger'),
  where: z.string().describe('Location of operation'),
  why: z.string().describe('Purpose of the mission')
}).describe('Mission statement following 5W format');

/**
 * Commander\'s Intent schema following Klein's 7 facets
 */
export const CommandersIntentSchema = z.object({
  purpose: z.string().describe('Why this operation matters'),
  keyTasks: z.array(z.string()).describe('Essential tasks that must be accomplished'),
  endState: z.string().describe('Desired outcome when operation is complete'),
  context: z.string().describe('Relevant background and situation'),
  constraints: z.array(z.string()).describe('Limitations and restrictions'),
  criticalFactors: z.array(z.string()).describe('Factors that determine success'),
  antigoals: z.array(z.string()).describe('What to avoid - undesirable outcomes')
}).describe('Commander\'s intent using Klein\'s 7 facets of intent communication');

/**
 * Subordinate task schema
 */
export const SubordinateTaskSchema = z.object({
  id: z.string(),
  unitId: z.string().describe('ID of unit assigned this task'),
  task: z.string().describe('Task description'),
  purpose: z.string().describe('Purpose of this task'),
  supportingEfforts: z.array(z.string()).optional().describe('Other tasks that support this one')
}).describe('Task assigned to subordinate unit');

/**
 * Risk assessment schema
 */
export const RiskAssessmentSchema = z.object({
  id: z.string(),
  category: z.enum(['operational', 'political', 'strategic', 'tactical']).describe('Risk category'),
  description: z.string().describe('Description of the risk'),
  likelihood: z.enum(['low', 'medium', 'high']).describe('Likelihood of occurrence'),
  impact: z.enum(['low', 'medium', 'high']).describe('Impact if it occurs'),
  mitigation: z.string().optional().describe('Mitigation strategy')
}).describe('Risk assessment for course of action');

/**
 * Red Team result schema
 */
export const RedTeamResultSchema = z.object({
  adversaryActions: z.array(z.string()).describe('Predicted adversary actions'),
  vulnerabilities: z.array(z.string()).describe('Vulnerabilities in this COA'),
  counterActions: z.array(z.string()).describe('How adversary might counter'),
  outcomeAssessment: z.string().describe('Overall assessment'),
  confidenceScore: z.number().min(0).max(100).describe('Confidence in assessment (0-100)'),
  simulatedAt: z.date().or(z.string().transform(str => new Date(str))),
  agentId: z.string().describe('DID of Red Team agent')
}).describe('Red Team simulation results');

/**
 * COA comparison score schema
 */
export const COAComparisonScoreSchema = z.object({
  feasibility: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string()
  }).describe('Can we do it with available resources?'),
  acceptability: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string()
  }).describe('Is it worth the cost/risk?'),
  suitability: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string()
  }).describe('Does it achieve the objective?'),
  distinguishability: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string()
  }).describe('Is it sufficiently different from other COAs?'),
  completeness: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string()
  }).describe('Does it fully address the mission?'),
  overallScore: z.number().min(0).max(100).describe('Composite score'),
  ranking: z.number().int().positive().describe('Rank among all COAs'),
  comparedAt: z.date().or(z.string().transform(str => new Date(str))),
  agentId: z.string().describe('DID of Comparator agent')
}).describe('COA comparison scoring');

/**
 * Situation paragraph schema
 */
export const SituationParagraphSchema = z.object({
  areaOfInterest: z.string().describe('Geographic area of interest'),
  areaOfOperations: z.string().describe('Area where forces will operate'),
  enemyForces: z.object({
    composition: z.string().describe('Enemy composition'),
    disposition: z.string().describe('Enemy disposition'),
    strength: z.string().describe('Enemy strength'),
    recentActivity: z.string().describe('Recent enemy activity'),
    capabilities: z.array(z.string()).describe('Enemy capabilities'),
    vulnerabilities: z.array(z.string()).describe('Enemy vulnerabilities')
  }),
  friendlyForces: z.object({
    higherHQ: z.string().describe('Higher headquarters'),
    adjacentUnits: z.array(z.string()).describe('Adjacent friendly units'),
    supportingUnits: z.array(z.string()).describe('Supporting units')
  }),
  civilConsiderations: z.object({
    population: z.string().describe('Population considerations'),
    infrastructure: z.string().describe('Infrastructure status'),
    governance: z.string().describe('Governance situation')
  }),
  attachmentsDetachments: z.array(z.string()).describe('Attached or detached units')
}).describe('Situation paragraph (paragraph 1 of 5-paragraph order)');

/**
 * Execution paragraph schema
 */
export const ExecutionParagraphSchema = z.object({
  commandersIntent: CommandersIntentSchema,
  conceptOfOperations: z.object({
    scheme: z.string().describe('Overall scheme of operations'),
    phases: z.array(z.object({
      name: z.string(),
      purpose: z.string(),
      tasks: z.array(z.string())
    })).describe('Operation phases')
  }),
  tasks: z.array(SubordinateTaskSchema).describe('Subordinate tasks'),
  coordinatingInstructions: z.array(z.string()).describe('Coordinating instructions'),
  fires: z.object({
    supportingUnits: z.array(z.string()),
    priorityTargets: z.array(z.string()),
    restrictions: z.array(z.string())
  }).describe('Fire support plan'),
  riskMitigation: z.object({
    criticalRisks: z.array(RiskAssessmentSchema),
    mitigationMeasures: z.array(z.string())
  }).describe('Risk mitigation plan')
}).describe('Execution paragraph (paragraph 3 of 5-paragraph order)');

/**
 * Sustainment paragraph schema
 */
export const SustainmentParagraphSchema = z.object({
  logistics: z.object({
    supplyPlan: z.string(),
    transportationPlan: z.string(),
    maintenancePlan: z.string()
  }),
  personnel: z.object({
    replacementPlan: z.string(),
    medicalEvacuation: z.string()
  }),
  publicAffairs: z.string(),
  civilAffairs: z.string(),
  healthServiceSupport: z.string()
}).describe('Sustainment paragraph (paragraph 4 of 5-paragraph order)');

/**
 * Command and Signal paragraph schema
 */
export const CommandSignalParagraphSchema = z.object({
  commandPost: z.object({
    location: z.string(),
    alternateLocation: z.string()
  }),
  succession: z.array(z.string()).describe('Chain of command succession'),
  signal: z.object({
    frequencies: z.array(z.string()),
    callSigns: z.record(z.string(), z.string()),
    pyrotechnics: z.array(z.string())
  }),
  codewords: z.record(z.string(), z.string())
}).describe('Command and Signal paragraph (paragraph 5 of 5-paragraph order)');

/**
 * Annex schema
 */
export const AnnexSchema = z.object({
  letter: z.string().length(1).regex(/[A-Z]/).describe('Annex letter A-Z'),
  title: z.string().describe('Annex title'),
  content: z.string().describe('Annex content')
}).describe('Plan annex');

/**
 * Commander approval schema
 */
export const CommanderApprovalSchema = z.object({
  coaApproved: z.boolean(),
  planApproved: z.boolean(),
  coaApprovedAt: z.date().or(z.string().transform(str => new Date(str))).optional(),
  planApprovedAt: z.date().or(z.string().transform(str => new Date(str))).optional(),
  coaApprovedBy: z.string().optional(),
  planApprovedBy: z.string().optional()
}).describe('Commander approval tracking');

/**
 * JSON Rules Engine condition schema (recursive)
 */
const JSONRulesEngineConditionSchema: z.ZodType<{
  all?: unknown[];
  any?: unknown[];
  fact?: string;
  operator?: string;
  value?: unknown;
  path?: string;
}> = z.lazy(() => z.object({
  all: z.array(JSONRulesEngineConditionSchema).optional(),
  any: z.array(JSONRulesEngineConditionSchema).optional(),
  fact: z.string().optional(),
  operator: z.string().optional(),
  value: z.unknown().optional(),
  path: z.string().optional()
})).describe('JSON Rules Engine condition (supports nested all/any)');

/**
 * ROE event schema
 */
export const ROEEventSchema = z.object({
  type: z.enum(['roe-violation', 'roe-warning']),
  params: z.object({
    severity: z.string().describe('Severity level'),
    message: z.string().describe('Event message'),
    overrideAuthority: z.string().describe('Authority required to override'),
    citation: z.string().describe('Legal or policy citation')
  })
}).describe('ROE rule event');

/**
 * Create operational plan schema
 */
export const createOperationalPlanSchema = z.object({
  missionId: z.string().describe('Mission ID this plan belongs to'),
  objectiveIds: z.array(z.string()).default([])
    .describe('Strategic objectives this plan addresses (can be added during mission analysis)'),
  name: z.string().min(1).describe('Plan name'),
  classification: ClassificationSchema,
  planType: PlanTypeSchema,
  yjsDocumentId: z.string().optional().describe('Yjs document ID for collaboration (auto-generated if not provided)')
}).describe('Input for creating operational plan');

/**
 * Update operational plan schema
 */
export const updateOperationalPlanSchema = z.object({
  name: z.string().min(1).optional(),
  classification: ClassificationSchema.optional(),
  planType: PlanTypeSchema.optional(),
  situation: SituationParagraphSchema.optional(),
  mission: MissionStatementSchema.optional(),
  execution: ExecutionParagraphSchema.optional(),
  sustainment: SustainmentParagraphSchema.optional(),
  commandSignal: CommandSignalParagraphSchema.optional(),
  annexes: z.record(z.string(), AnnexSchema).optional()
}).describe('Input for updating operational plan');

/**
 * Create COA schema
 */
export const createCOASchema = z.object({
  planId: z.string().describe('Plan ID this COA belongs to'),
  number: z.number().int().positive().describe('COA number (1, 2, 3...)'),
  name: z.string().min(1).describe('COA name'),
  description: z.string().describe('COA description'),
  scheme: z.string().describe('Scheme of maneuver'),
  commandersIntent: CommandersIntentSchema,
  tasks: z.array(SubordinateTaskSchema).optional().default([]),
  risks: z.array(RiskAssessmentSchema).optional().default([]),
  supportingEfforts: z.array(z.string()).optional().default([]),
  decisiveOperation: z.string().optional().default(''),
  shaping: z.string().optional().default(''),
  sustainingOperations: z.string().optional().default('')
}).describe('Input for creating course of action');

/**
 * Update COA schema
 */
export const updateCOASchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  scheme: z.string().optional(),
  commandersIntent: CommandersIntentSchema.optional(),
  tasks: z.array(SubordinateTaskSchema).optional(),
  risks: z.array(RiskAssessmentSchema).optional(),
  supportingEfforts: z.array(z.string()).optional(),
  decisiveOperation: z.string().optional(),
  shaping: z.string().optional(),
  sustainingOperations: z.string().optional()
}).describe('Input for updating course of action');

/**
 * Create ROE rule schema
 */
export const createROERuleSchema = z.object({
  missionId: z.string().describe('Mission ID this rule applies to'),
  name: z.string().min(1).describe('Rule name'),
  description: z.string().describe('Rule description'),
  category: ROECategorySchema,
  conditions: JSONRulesEngineConditionSchema.describe('json-rules-engine compatible conditions'),
  event: ROEEventSchema
}).describe('Input for creating ROE rule');

/**
 * Update ROE rule schema
 */
export const updateROERuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: ROECategorySchema.optional(),
  conditions: JSONRulesEngineConditionSchema.optional(),
  event: ROEEventSchema.optional(),
  active: z.boolean().optional()
}).describe('Input for updating ROE rule');

/**
 * Create ROE override schema
 */
export const createROEOverrideSchema = z.object({
  planId: z.string().describe('Plan ID where override occurred'),
  ruleId: z.string().describe('Rule ID that was overridden'),
  actionContext: z.record(z.string(), z.unknown()).describe('Context when override occurred'),
  violations: z.array(z.string()).min(1).describe('Rules that were violated'),
  justification: z.string().min(1, 'Justification is required for ROE override')
    .describe('Required justification for override'),
  commanderDID: z.string().describe('DID of commander authorizing override'),
  blockchainTxHash: z.string().describe('Blockchain transaction hash for audit trail')
}).describe('Input for creating ROE override (requires justification)');

/**
 * Create version schema
 */
export const createVersionSchema = z.object({
  planId: z.string().describe('Plan ID being versioned'),
  yjsUpdate: z.instanceof(Buffer).describe('Yjs state snapshot as Buffer'),
  snapshot: z.unknown().describe('Full plan snapshot'),
  changedBy: z.string().describe('DID of person making change'),
  changeReason: z.string().optional().describe('Optional reason for change')
}).describe('Input for creating plan version');

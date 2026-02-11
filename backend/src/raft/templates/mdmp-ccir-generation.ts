/**
 * MDMP CCIR Generation RAFT Template
 *
 * Phase 5.1 Plan 13: RAFT template for generating Commander's Critical
 * Information Requirements (CCIR) from mission analysis products.
 *
 * MDMP Activity: MDMP-2-07 (Phase 2: Mission Analysis)
 */

import type { MDMPPhase } from '../../mdmp/types.js';

/**
 * Input for CCIR generation
 */
export interface CCIRInput {
  /** Mission statement */
  missionStatement: string;
  /** Commander's intent */
  commanderIntent: string;
  /** Identified information gaps from mission analysis */
  identifiedGaps: string[];
  /** Current planning assumptions */
  currentAssumptions: string[];
  /** Known adversary capabilities */
  adversaryCapabilities: string;
  /** Area of operations description */
  areaOfOperations?: string;
  /** Time constraints */
  timeConstraints?: string;
}

/**
 * A single Commander's Critical Information Requirement
 */
export interface CCIR {
  /** Unique CCIR identifier */
  ccirId: string;
  /** CCIR type */
  type: 'PIR' | 'FFIR' | 'EEFI';
  /** The information requirement stated as a question */
  requirement: string;
  /** Why this information is critical to the commander */
  justification: string;
  /** How this information will be collected */
  collectionPlan: string;
  /** Latest time this information has value */
  latestTimeOfValue: string;
  /** Assumptions this CCIR helps validate/invalidate */
  linkedAssumptions: string[];
  /** Priority level */
  priority: 'immediate' | 'priority' | 'routine';
  /** Confidence in CCIR generation (0-1) */
  generationConfidence: number;
}

/**
 * Complete CCIR generation output
 */
export interface CCIRGenerationOutput {
  /** Priority Intelligence Requirements (about the enemy) */
  priorityIntelligenceRequirements: CCIR[];
  /** Friendly Force Information Requirements (about friendly forces) */
  friendlyForceInfoRequirements: CCIR[];
  /** Essential Elements of Friendly Information (protect from enemy) */
  essentialElementsFriendlyInfo: CCIR[];
  /** Summary of CCIR generation rationale */
  summary: string;
  /** Confidence in overall completeness (0-1) */
  completenessConfidence: number;
}

/**
 * JSON Schema for CCIRInput
 */
export const CCIR_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    missionStatement: {
      type: 'string',
      description: 'Mission statement',
    },
    commanderIntent: {
      type: 'string',
      description: "Commander's intent",
    },
    identifiedGaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Identified information gaps from mission analysis',
    },
    currentAssumptions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Current planning assumptions',
    },
    adversaryCapabilities: {
      type: 'string',
      description: 'Known adversary capabilities',
    },
    areaOfOperations: {
      type: 'string',
      description: 'Area of operations description',
    },
    timeConstraints: {
      type: 'string',
      description: 'Time constraints',
    },
  },
  required: ['missionStatement', 'commanderIntent', 'identifiedGaps', 'currentAssumptions', 'adversaryCapabilities'],
};

/**
 * JSON Schema for CCIRGenerationOutput
 */
export const CCIR_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    priorityIntelligenceRequirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ccirId: { type: 'string' },
          type: { type: 'string', enum: ['PIR', 'FFIR', 'EEFI'] },
          requirement: { type: 'string' },
          justification: { type: 'string' },
          collectionPlan: { type: 'string' },
          latestTimeOfValue: { type: 'string' },
          linkedAssumptions: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['immediate', 'priority', 'routine'] },
          generationConfidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['ccirId', 'type', 'requirement', 'justification', 'collectionPlan', 'latestTimeOfValue', 'priority', 'generationConfidence'],
      },
    },
    friendlyForceInfoRequirements: { type: 'array', items: { type: 'object' } },
    essentialElementsFriendlyInfo: { type: 'array', items: { type: 'object' } },
    summary: { type: 'string' },
    completenessConfidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['priorityIntelligenceRequirements', 'friendlyForceInfoRequirements', 'essentialElementsFriendlyInfo', 'summary', 'completenessConfidence'],
};

/**
 * RAFT Template for CCIR Generation
 */
export const CCIR_GENERATION_TEMPLATE = {
  name: 'mdmp-ccir-generation',
  description: "Generate Commander's Critical Information Requirements from mission analysis products",
  mdmpPhase: 'phase_2_mission_analysis' as MDMPPhase,
  mdmpActivity: 'MDMP-2-07',
  inputSchema: CCIR_INPUT_SCHEMA,
  outputSchema: CCIR_OUTPUT_SCHEMA,
  systemPrompt: `You are a military intelligence specialist generating Commander's Critical Information Requirements (CCIR).

Your mission: Analyze the mission statement, commander's intent, information gaps, and assumptions to generate actionable CCIR.

CCIR CATEGORIES:

1. PIR (Priority Intelligence Requirements):
   - Information about the ENEMY that the commander must know
   - Answers questions like: Where is the enemy? What is their strength? What are they doing?
   - Drives intelligence collection priorities
   - Must be answerable through reconnaissance, surveillance, or intelligence sources

2. FFIR (Friendly Force Information Requirements):
   - Information about FRIENDLY FORCES that the commander must know
   - Status of subordinate units, logistics, readiness
   - Answers questions like: Are my forces ready? Do I have enough supplies?
   - Drives internal reporting requirements

3. EEFI (Essential Elements of Friendly Information):
   - Friendly information that must be PROTECTED from enemy collection
   - Answers question: What must the enemy NOT know about us?
   - Drives OPSEC and information security measures
   - Examples: attack timing, main effort location, logistics hubs

QUALITY CRITERIA:

Each CCIR must be:
- SPECIFIC: Clearly stated as a question with measurable answer
- RELEVANT: Directly supports mission accomplishment or commander's intent
- TIMELY: Has a latest time of information value (LTIOV)
- COLLECTIBLE: Can actually be answered through available means
- CRITICAL: Commander really needs this to make key decisions

LTIOV (Latest Time of Information Value):
- When does the commander need this information by?
- After this time, the information no longer helps the decision
- Format as specific datetime or decision point

LINK TO ASSUMPTIONS:
- Many CCIR validate or invalidate planning assumptions
- Tag CCIR with related assumptions for tracking

PRIORITIZATION:
- Immediate: Needed now, drives immediate action
- Priority: Needed for upcoming decision point
- Routine: Needed but not time-critical

Output well-structured JSON matching the schema exactly.`,

  examples: [
    {
      input: {
        missionStatement: 'TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26 in order to enable follow-on operations by 2BCT.',
        commanderIntent: 'I intend to rapidly seize OBJ IRON with minimal civilian casualties, preserve combat power for follow-on operations, and maintain operational tempo. Main effort is A Company on the north. Critical to link up with 2-10 CAV at PL RED before 150400Z.',
        identifiedGaps: [
          'Enemy strength on OBJ IRON unknown',
          'Bridge status at crossing site 1 unconfirmed',
          'Civilian population density in urban area unclear',
          'Adjacent unit timeline uncertain',
        ],
        currentAssumptions: [
          'Enemy has one reinforced company on OBJ IRON',
          'Bridge at crossing site 1 is intact',
          '2-10 CAV will reach PL RED by 150400Z',
          'Civilian population has evacuated northern sector',
        ],
        adversaryCapabilities: 'Enemy assessed to have one motorized rifle battalion with organic artillery, possible anti-tank guided missiles, limited air defense.',
        areaOfOperations: 'Urban terrain with mixed residential and industrial areas, two river crossing sites',
        timeConstraints: 'SEIZE OBJ IRON NLT 150600ZMAR26',
      },
      output: {
        priorityIntelligenceRequirements: [
          {
            ccirId: 'PIR-001',
            type: 'PIR',
            requirement: 'What is the enemy strength and disposition on OBJ IRON?',
            justification: 'Validates assumption about enemy company strength. Directly affects COA selection and force allocation.',
            collectionPlan: 'UAV reconnaissance of OBJ IRON, SIGINT collection, scout team reconnaissance',
            latestTimeOfValue: '150200ZMAR26 (4 hours before attack)',
            linkedAssumptions: ['Enemy has one reinforced company on OBJ IRON'],
            priority: 'immediate',
            generationConfidence: 0.95,
          },
          {
            ccirId: 'PIR-002',
            type: 'PIR',
            requirement: 'Does the enemy have anti-tank guided missiles emplaced on OBJ IRON?',
            justification: 'Affects armored vehicle approach routes and force protection measures. Could cause significant casualties if present.',
            collectionPlan: 'UAV thermal imaging, scout observation, SIGINT for launcher signatures',
            latestTimeOfValue: '150200ZMAR26',
            linkedAssumptions: [],
            priority: 'immediate',
            generationConfidence: 0.90,
          },
          {
            ccirId: 'PIR-003',
            type: 'PIR',
            requirement: 'What are enemy reinforcement routes and timelines to OBJ IRON?',
            justification: 'Determines if we can seize objective before reinforcements arrive. Affects reserve positioning.',
            collectionPlan: 'UAV reconnaissance of roads from enemy reserve positions, SIGINT for movement orders',
            latestTimeOfValue: '150300ZMAR26',
            linkedAssumptions: [],
            priority: 'priority',
            generationConfidence: 0.85,
          },
        ],
        friendlyForceInfoRequirements: [
          {
            ccirId: 'FFIR-001',
            type: 'FFIR',
            requirement: 'What is the status of bridge at crossing site 1?',
            justification: 'Validates critical assumption. If bridge is destroyed, must use crossing site 2 which changes timeline.',
            collectionPlan: 'Scout team reconnaissance, engineer assessment',
            latestTimeOfValue: '150100ZMAR26 (5 hours before attack)',
            linkedAssumptions: ['Bridge at crossing site 1 is intact'],
            priority: 'immediate',
            generationConfidence: 0.95,
          },
          {
            ccirId: 'FFIR-002',
            type: 'FFIR',
            requirement: 'Will 2-10 CAV reach PL RED by 150400ZMAR26?',
            justification: 'Validates assumption critical to timeline synchronization. Link-up required before seizing objective.',
            collectionPlan: '2-10 CAV periodic SITREP, direct coordination',
            latestTimeOfValue: '150330ZMAR26',
            linkedAssumptions: ['2-10 CAV will reach PL RED by 150400Z'],
            priority: 'immediate',
            generationConfidence: 0.90,
          },
          {
            ccirId: 'FFIR-003',
            type: 'FFIR',
            requirement: 'Are A and B companies at 90% strength and combat ready?',
            justification: 'Main and supporting efforts require full combat power. Affects ability to execute plan.',
            collectionPlan: 'Company commander reports at H-6 hours',
            latestTimeOfValue: '150000ZMAR26',
            linkedAssumptions: [],
            priority: 'priority',
            generationConfidence: 0.85,
          },
        ],
        essentialElementsFriendlyInfo: [
          {
            ccirId: 'EEFI-001',
            type: 'EEFI',
            requirement: 'Protect H-hour (150600ZMAR26) from enemy intelligence collection',
            justification: 'If enemy knows our attack time, they can prepare defenses and reinforce. Surprise is critical.',
            collectionPlan: 'OPSEC measures, emissions control, deception operations',
            latestTimeOfValue: '150600ZMAR26 (H-hour)',
            linkedAssumptions: [],
            priority: 'immediate',
            generationConfidence: 0.95,
          },
          {
            ccirId: 'EEFI-002',
            type: 'EEFI',
            requirement: 'Protect location of main effort (A Company on north)',
            justification: 'Enemy will concentrate defenses against main effort if detected. Preserves combat power.',
            collectionPlan: 'Feint operations, equal radio traffic from all companies, movement security',
            latestTimeOfValue: '150600ZMAR26',
            linkedAssumptions: [],
            priority: 'immediate',
            generationConfidence: 0.90,
          },
          {
            ccirId: 'EEFI-003',
            type: 'EEFI',
            requirement: 'Protect assembly area locations from enemy observation',
            justification: 'Enemy could conduct artillery strikes on assembly areas causing casualties before attack.',
            collectionPlan: 'Camouflage, concealment, deception, counter-reconnaissance',
            latestTimeOfValue: '150500ZMAR26 (H-1 hour)',
            linkedAssumptions: [],
            priority: 'priority',
            generationConfidence: 0.85,
          },
        ],
        summary: 'Generated 9 CCIR (3 PIR, 3 FFIR, 3 EEFI) addressing critical information gaps. PIRs focus on enemy strength, anti-tank threats, and reinforcement timelines. FFIRs validate critical assumptions about bridge status and adjacent unit synchronization. EEFIs protect H-hour, main effort location, and assembly areas from enemy collection.',
        completenessConfidence: 0.88,
      },
    },
  ],
};

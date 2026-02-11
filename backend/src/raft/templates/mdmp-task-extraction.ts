/**
 * MDMP Task Extraction RAFT Template
 *
 * Phase 5.1 Plan 13: RAFT template for extracting tasks, constraints,
 * and coordination requirements from military orders and directives.
 *
 * MDMP Activity: MDMP-1-02 (Phase 1: Receipt of Mission)
 */

import type { MDMPPhase } from '../../mdmp/types.js';

/**
 * Input for task extraction from military documents
 */
export interface TaskExtractionInput {
  /** Raw text of the military order or directive */
  documentText: string;
  /** Type of document being processed */
  documentType: 'OPORD' | 'FRAGO' | 'WARNO' | 'directive';
  /** Mission identifier for tracking */
  missionId: string;
  /** Current MDMP phase */
  currentPhase: MDMPPhase;
  /** Optional context from higher headquarters */
  higherHQContext?: string;
}

/**
 * A single extracted task with metadata
 */
export interface ExtractedTask {
  /** Unique task identifier */
  taskId: string;
  /** Task type classification */
  taskType: 'specified' | 'implied' | 'essential';
  /** Task description */
  description: string;
  /** Section of document where task was found */
  sourceSection: string;
  /** Verbatim excerpt from source document */
  sourceExcerpt: string;
  /** Associated constraints for this task */
  constraints: string[];
  /** Unit assigned to task, if specified */
  associatedUnit: string | null;
  /** Confidence score (0-1) in extraction accuracy */
  extractionConfidence: number;
}

/**
 * Constraint extracted from orders
 */
export interface ExtractedConstraint {
  /** Constraint description */
  constraint: string;
  /** Source section in document */
  source: string;
  /** Severity classification */
  severity: 'binding' | 'limiting' | 'informational';
}

/**
 * Complete output from task extraction
 */
export interface TaskExtractionOutput {
  /** All specified tasks explicitly stated in order */
  specifiedTasks: ExtractedTask[];
  /** Tasks implied by specified tasks or situation */
  impliedTasks: ExtractedTask[];
  /** Essential tasks critical to mission success */
  essentialTasks: ExtractedTask[];
  /** Constraints limiting freedom of action */
  constraints: ExtractedConstraint[];
  /** Coordination requirements with other units */
  coordRequirements: string[];
  /** Overall completeness confidence (0-1) */
  extractionCompleteness: number;
}

/**
 * JSON Schema for TaskExtractionInput
 */
export const TASK_EXTRACTION_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    documentText: {
      type: 'string',
      description: 'Raw text of the military order or directive',
    },
    documentType: {
      type: 'string',
      enum: ['OPORD', 'FRAGO', 'WARNO', 'directive'],
      description: 'Type of document being processed',
    },
    missionId: {
      type: 'string',
      description: 'Mission identifier for tracking',
    },
    currentPhase: {
      type: 'string',
      description: 'Current MDMP phase',
    },
    higherHQContext: {
      type: 'string',
      description: 'Optional context from higher headquarters',
    },
  },
  required: ['documentText', 'documentType', 'missionId', 'currentPhase'],
};

/**
 * JSON Schema for TaskExtractionOutput
 */
export const TASK_EXTRACTION_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    specifiedTasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          taskType: { type: 'string', enum: ['specified', 'implied', 'essential'] },
          description: { type: 'string' },
          sourceSection: { type: 'string' },
          sourceExcerpt: { type: 'string' },
          constraints: { type: 'array', items: { type: 'string' } },
          associatedUnit: { type: ['string', 'null'] },
          extractionConfidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['taskId', 'taskType', 'description', 'sourceSection', 'sourceExcerpt', 'extractionConfidence'],
      },
    },
    impliedTasks: { type: 'array', items: { type: 'object' } },
    essentialTasks: { type: 'array', items: { type: 'object' } },
    constraints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          constraint: { type: 'string' },
          source: { type: 'string' },
          severity: { type: 'string', enum: ['binding', 'limiting', 'informational'] },
        },
        required: ['constraint', 'source', 'severity'],
      },
    },
    coordRequirements: { type: 'array', items: { type: 'string' } },
    extractionCompleteness: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['specifiedTasks', 'impliedTasks', 'essentialTasks', 'constraints', 'coordRequirements', 'extractionCompleteness'],
};

/**
 * RAFT Template for Task Extraction
 */
export const TASK_EXTRACTION_TEMPLATE = {
  name: 'mdmp-task-extraction',
  description: 'Extract tasks, constraints, and coordination requirements from military orders and directives',
  mdmpPhase: 'phase_1_receipt_of_mission' as MDMPPhase,
  mdmpActivity: 'MDMP-1-02',
  inputSchema: TASK_EXTRACTION_INPUT_SCHEMA,
  outputSchema: TASK_EXTRACTION_OUTPUT_SCHEMA,
  systemPrompt: `You are a military planning specialist extracting structured task data from orders and directives.

Your mission: Analyze the military document and extract all specified tasks, implied tasks, essential tasks, constraints, and coordination requirements.

SPECIFIED TASKS:
- Tasks explicitly stated in the order using action verbs (seize, secure, defend, attack, etc.)
- Look in Execution paragraph (paragraph 3) of OPORDs
- Note the unit assigned and any constraints

IMPLIED TASKS:
- Tasks not explicitly stated but necessary to accomplish specified tasks
- Example: If tasked to "seize bridge", implied tasks include "conduct reconnaissance", "establish security", "clear approaches"
- Essential for mission success even if not stated

ESSENTIAL TASKS:
- Tasks that MUST be accomplished for mission success
- Derived from mission analysis
- Often a subset of specified tasks
- Critical to achieving commander's intent

CONSTRAINTS:
- Binding: Legal/ROE constraints (do not fire unless fired upon, no strikes in urban areas)
- Limiting: Resource/time constraints (limited ammunition, 48-hour timeline)
- Informational: Context that affects planning (expected weather, civilian presence)

COORDINATION REQUIREMENTS:
- Synchronization with adjacent units
- Support relationships (direct support, general support)
- Phase line crossings
- Fire support coordination measures

For each extracted item, provide:
1. Source section and verbatim excerpt
2. Confidence score (0.0-1.0)
3. Associated unit if applicable
4. Any constraints specific to that task

Output well-structured JSON matching the schema exactly.`,

  examples: [
    {
      input: {
        documentText: `EXECUTION:
3a. Concept of Operations: TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26 in order to enable follow-on operations by 2BCT.

3b. Tasks to Subordinate Units:
   (1) A/1-87: ATTACK to SEIZE the northern portion of OBJ IRON NLT 150600ZMAR26. Establish hasty defense IOT deny enemy counterattack.
   (2) B/1-87: ATTACK to SEIZE the southern portion of OBJ IRON NLT 150600ZMAR26. Conduct BDA and report.
   (3) C/1-87: In RESERVE. Be prepared to reinforce A or B company on order.

COORDINATING INSTRUCTIONS:
- No fires within 500m of civilian structures without battalion commander approval.
- Phase Line GREEN crosses at grid 12345678.
- Link up with 2-10 CAV at Phase Line RED.`,
        documentType: 'OPORD',
        missionId: 'MSN-001',
        currentPhase: 'phase_1_receipt_of_mission',
      },
      output: {
        specifiedTasks: [
          {
            taskId: 'TASK-001',
            taskType: 'specified',
            description: 'SEIZE OBJ IRON NLT 150600ZMAR26',
            sourceSection: 'Paragraph 3a - Concept of Operations',
            sourceExcerpt: 'TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26',
            constraints: ['Timeline: NLT 150600ZMAR26'],
            associatedUnit: 'TF 1-87',
            extractionConfidence: 0.95,
          },
          {
            taskId: 'TASK-002',
            taskType: 'specified',
            description: 'ATTACK to SEIZE northern portion of OBJ IRON',
            sourceSection: 'Paragraph 3b(1) - Tasks to Subordinate Units',
            sourceExcerpt: 'A/1-87: ATTACK to SEIZE the northern portion of OBJ IRON NLT 150600ZMAR26',
            constraints: ['Timeline: NLT 150600ZMAR26'],
            associatedUnit: 'A/1-87',
            extractionConfidence: 0.95,
          },
          {
            taskId: 'TASK-003',
            taskType: 'specified',
            description: 'Establish hasty defense IOT deny enemy counterattack',
            sourceSection: 'Paragraph 3b(1) - Tasks to Subordinate Units',
            sourceExcerpt: 'Establish hasty defense IOT deny enemy counterattack',
            constraints: [],
            associatedUnit: 'A/1-87',
            extractionConfidence: 0.90,
          },
        ],
        impliedTasks: [
          {
            taskId: 'TASK-IMP-001',
            taskType: 'implied',
            description: 'Conduct reconnaissance of OBJ IRON prior to attack',
            sourceSection: 'Derived from ATTACK task',
            sourceExcerpt: 'Implied by offensive operations requirement',
            constraints: [],
            associatedUnit: null,
            extractionConfidence: 0.85,
          },
          {
            taskId: 'TASK-IMP-002',
            taskType: 'implied',
            description: 'Establish security during consolidation on objective',
            sourceSection: 'Derived from SEIZE task',
            sourceExcerpt: 'Required for objective security after seizure',
            constraints: [],
            associatedUnit: null,
            extractionConfidence: 0.80,
          },
        ],
        essentialTasks: [
          {
            taskId: 'TASK-ESS-001',
            taskType: 'essential',
            description: 'SEIZE OBJ IRON (both northern and southern portions)',
            sourceSection: 'Mission Analysis',
            sourceExcerpt: 'Critical to enable follow-on operations by 2BCT',
            constraints: ['Timeline: NLT 150600ZMAR26'],
            associatedUnit: 'TF 1-87',
            extractionConfidence: 0.95,
          },
        ],
        constraints: [
          {
            constraint: 'No fires within 500m of civilian structures without battalion commander approval',
            source: 'Coordinating Instructions',
            severity: 'binding',
          },
          {
            constraint: 'Timeline: NLT 150600ZMAR26',
            source: 'Paragraph 3a',
            severity: 'limiting',
          },
        ],
        coordRequirements: [
          'Phase Line GREEN crosses at grid 12345678',
          'Link up with 2-10 CAV at Phase Line RED',
        ],
        extractionCompleteness: 0.90,
      },
    },
  ],
};

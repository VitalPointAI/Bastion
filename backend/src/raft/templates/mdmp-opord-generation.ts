/**
 * MDMP OPORD Generation RAFT Template
 *
 * Phase 5.1 Plan 13: RAFT template for generating Operations Orders (OPORD)
 * from approved COA and planning products.
 *
 * MDMP Activity: MDMP-7-01 (Phase 7: Orders Production)
 */

import type { MDMPPhase } from '../../mdmp/types.js';

/**
 * Input for OPORD generation
 */
export interface OPORDGenerationInput {
  /** Approved Course of Action */
  approvedCOA: {
    coaName: string;
    concept: string;
    mainEffort: string;
    scheme: string;
  };
  /** Commander's Intent */
  commanderIntent: string;
  /** Task organization */
  taskOrganization: string;
  /** Coordinating instructions */
  coordinatingInstructions: string[];
  /** Service and support plan */
  serviceSupportPlan: string;
  /** Command and control plan */
  commandControlPlan: string;
  /** Mission statement */
  missionStatement: string;
  /** Enemy situation */
  enemySituation?: string;
  /** Friendly situation */
  friendlySituation?: string;
}

/**
 * Structured 5-paragraph OPORD output
 */
export interface OPORDGenerationOutput {
  /** Paragraph 1: Situation */
  paragraph1_Situation: {
    areaOfOperations: string;
    terrain: string;
    weather: string;
    enemyForces: {
      composition: string;
      disposition: string;
      strength: string;
      recentActivities: string;
      capabilities: string;
      mostLikelyCOA: string;
      mostDangerousCOA: string;
    };
    friendlyForces: {
      higherHQ: string;
      higherMission: string;
      higherIntent: string;
      adjacent: string[];
      supporting: string[];
    };
    civilConsiderations: string;
    attachmentsDetachments: string[];
  };
  /** Paragraph 2: Mission */
  paragraph2_Mission: string;
  /** Paragraph 3: Execution */
  paragraph3_Execution: {
    commanderIntent: string;
    concept: string;
    tasksToSubordinates: Array<{
      unit: string;
      task: string;
      purpose: string;
    }>;
    coordinatingInstructions: string[];
  };
  /** Paragraph 4: Sustainment */
  paragraph4_Sustainment: {
    logistics: string;
    personnel: string;
    healthService: string;
  };
  /** Paragraph 5: Command and Signal */
  paragraph5_CommandSignal: {
    command: string;
    signal: string;
  };
  /** Required annexes */
  annexes: string[];
  /** Cross-reference validation results */
  crossReferences: {
    valid: boolean;
    missingReferences: string[];
  };
  /** Generation confidence (0-1) */
  generationConfidence: number;
}

/**
 * JSON Schema for OPORDGenerationInput
 */
export const OPORD_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    approvedCOA: {
      type: 'object',
      properties: {
        coaName: { type: 'string' },
        concept: { type: 'string' },
        mainEffort: { type: 'string' },
        scheme: { type: 'string' },
      },
      required: ['coaName', 'concept', 'mainEffort', 'scheme'],
    },
    commanderIntent: { type: 'string' },
    taskOrganization: { type: 'string' },
    coordinatingInstructions: { type: 'array', items: { type: 'string' } },
    serviceSupportPlan: { type: 'string' },
    commandControlPlan: { type: 'string' },
    missionStatement: { type: 'string' },
    enemySituation: { type: 'string' },
    friendlySituation: { type: 'string' },
  },
  required: ['approvedCOA', 'commanderIntent', 'taskOrganization', 'coordinatingInstructions', 'serviceSupportPlan', 'commandControlPlan', 'missionStatement'],
};

/**
 * JSON Schema for OPORDGenerationOutput
 */
export const OPORD_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    paragraph1_Situation: { type: 'object' },
    paragraph2_Mission: { type: 'string' },
    paragraph3_Execution: { type: 'object' },
    paragraph4_Sustainment: { type: 'object' },
    paragraph5_CommandSignal: { type: 'object' },
    annexes: { type: 'array', items: { type: 'string' } },
    crossReferences: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        missingReferences: { type: 'array', items: { type: 'string' } },
      },
      required: ['valid', 'missingReferences'],
    },
    generationConfidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['paragraph1_Situation', 'paragraph2_Mission', 'paragraph3_Execution', 'paragraph4_Sustainment', 'paragraph5_CommandSignal', 'annexes', 'crossReferences', 'generationConfidence'],
};

/**
 * RAFT Template for OPORD Generation
 */
export const OPORD_GENERATION_TEMPLATE = {
  name: 'mdmp-opord-generation',
  description: 'Generate structured 5-paragraph Operations Order (OPORD) from approved COA and planning products',
  mdmpPhase: 'phase_7_orders_production' as MDMPPhase,
  mdmpActivity: 'MDMP-7-01',
  inputSchema: OPORD_INPUT_SCHEMA,
  outputSchema: OPORD_OUTPUT_SCHEMA,
  systemPrompt: `You are a military operations officer generating formal Operations Orders (OPORD) per JP 5-0 doctrine.

Your mission: Transform the approved Course of Action and planning products into a complete, doctrinally-correct 5-paragraph OPORD.

OPORD STRUCTURE (5 paragraphs):

1. SITUATION
   a. Area of Operations: Geographic scope, key terrain
   b. Enemy Forces: Composition, disposition, strength, recent activities, capabilities, most likely COA, most dangerous COA
   c. Friendly Forces: Higher HQ mission/intent, adjacent units, supporting units
   d. Civil Considerations: Population, infrastructure, cultural factors
   e. Attachments/Detachments: Task organization changes

2. MISSION
   - Single sentence: WHO, WHAT, WHEN, WHERE, WHY
   - Format: [unit] [task verb] [object] [time] [location] [purpose]
   - Example: "TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26 in order to enable follow-on operations by 2BCT"

3. EXECUTION
   a. Commander's Intent: Purpose, key tasks, end state (2-3 paragraphs)
   b. Concept of Operations: How the force will accomplish the mission
   c. Tasks to Subordinate Units: Specific tasks for each unit (WHO does WHAT)
   d. Coordinating Instructions: Phase lines, control measures, ROE, timeline

4. SUSTAINMENT
   a. Logistics: Supply, transportation, field services
   b. Personnel: Replacement operations, enemy prisoners of war
   c. Health Service Support: Medical treatment, evacuation

5. COMMAND AND SIGNAL
   a. Command: Location of commander, succession of command
   b. Signal: Communications plan, code words, frequencies

ANNEXES:
- List required annexes (Operations Overlay, Intelligence Annex, Fire Support Annex, etc.)
- Ensure all references in OPORD body match annex list

CROSS-REFERENCE VALIDATION:
- Check that all units mentioned in paragraph 3 appear in task organization
- Verify all phase lines/control measures referenced exist
- Ensure all annexes referenced in body are listed

QUALITY CRITERIA:
- Clear and concise military writing
- Follows doctrinal format exactly
- All required information present
- No ambiguity in tasks
- Coordinating instructions complete
- Commander's intent compelling and clear

Output well-structured JSON matching the schema exactly.`,

  examples: [
    {
      input: {
        approvedCOA: {
          coaName: 'COA 1: Two-Pronged Attack',
          concept: 'TF 1-87 attacks in two columns to rapidly seize OBJ IRON. A Company (main effort) attacks from north. B Company attacks from south. C Company in reserve.',
          mainEffort: 'A Company on northern axis',
          scheme: 'Sequential phases: Movement to Contact, Attack, Consolidation',
        },
        commanderIntent: 'I intend to rapidly seize OBJ IRON with minimal civilian casualties, preserve combat power for follow-on operations, and maintain operational tempo. Main effort is A Company on the north. We cannot afford to get decisively engaged before reaching the objective. The key to success is speed and synchronization between the two attack columns.',
        taskOrganization: 'TF 1-87: A/1-87, B/1-87, C/1-87 (reserve), FSE (fires), FIST (targeting)',
        coordinatingInstructions: [
          'Phase Line GREEN crosses at grid 12345678',
          'Link up with 2-10 CAV at Phase Line RED',
          'No fires within 500m of civilian structures without battalion commander approval',
        ],
        serviceSupportPlan: 'Battalion aid station at grid 11223344. Class III/V resupply on order. Casualty evacuation via ground ambulance.',
        commandControlPlan: 'Battalion TOC at grid 11223355. Commander with A Company. XO with B Company. Battalion net: freq 54.000.',
        missionStatement: 'TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26 in order to enable follow-on operations by 2BCT.',
        enemySituation: 'Enemy has one reinforced company on OBJ IRON with possible anti-tank guided missiles.',
        friendlySituation: '2BCT conducts follow-on exploitation. 2-10 CAV screens northern flank.',
      },
      output: {
        paragraph1_Situation: {
          areaOfOperations: 'Urban terrain with mixed residential and industrial areas. Two river crossing sites. OBJ IRON is a key road junction controlling access to eastern sector.',
          terrain: 'Mixture of open terrain in approach and urban terrain on objective. Two crossing sites over river. Limited cover during movement to contact phase.',
          weather: 'Clear skies expected, visibility unlimited. Temperature 15-20C. No precipitation forecasted.',
          enemyForces: {
            composition: 'One reinforced motorized rifle company',
            disposition: 'Defensive positions on OBJ IRON oriented west',
            strength: 'Approximately 120-150 personnel',
            recentActivities: 'Hasty defensive preparations observed past 48 hours',
            capabilities: 'Organic machine guns, possible anti-tank guided missiles, indirect fire support from battalion assets',
            mostLikelyCOA: 'Defend in place on OBJ IRON, request reinforcement if penetrated',
            mostDangerousCOA: 'Reinforcement by battalion reserve prior to our attack, conducting counterattack against our exposed flanks',
          },
          friendlyForces: {
            higherHQ: '2nd Brigade Combat Team (2BCT)',
            higherMission: '2BCT conducts offensive operations to seize key terrain in eastern sector',
            higherIntent: 'Commander 2BCT intends to rapidly exploit success and maintain momentum',
            adjacent: ['2-10 CAV screening northern flank', '3-21 IN on southern boundary'],
            supporting: ['1-15 FA (direct support)', '2BCT Engineers (general support)'],
          },
          civilConsiderations: 'Estimated 500 civilians remain in urban area. Civilian evacuation incomplete. Critical infrastructure includes hospital and water treatment plant.',
          attachmentsDetachments: ['Attached: FSE (Fire Support Element)', 'Attached: FIST (Fire Support Team)'],
        },
        paragraph2_Mission: 'TF 1-87 will conduct offensive operations to SEIZE OBJ IRON NLT 150600ZMAR26 in order to enable follow-on operations by 2BCT.',
        paragraph3_Execution: {
          commanderIntent: 'I intend to rapidly seize OBJ IRON with minimal civilian casualties, preserve combat power for follow-on operations, and maintain operational tempo. Main effort is A Company on the north. We cannot afford to get decisively engaged before reaching the objective. The key to success is speed and synchronization between the two attack columns. End state: TF 1-87 controls OBJ IRON, enemy forces destroyed or withdrawn, friendly forces postured for 2BCT follow-on operations.',
          concept: 'TF 1-87 attacks in two columns to rapidly seize OBJ IRON. Phase 1: Movement to Contact - both companies cross LD simultaneously. Phase 2: Attack - A Company (main effort) attacks northern portion, B Company attacks southern portion. Phase 3: Consolidation - establish hasty defense, link up with 2-10 CAV. C Company in reserve prepared to reinforce either attack column on order.',
          tasksToSubordinates: [
            {
              unit: 'A/1-87 (Main Effort)',
              task: 'ATTACK to SEIZE northern portion of OBJ IRON NLT 150600ZMAR26. Establish hasty defense IOT deny enemy counterattack.',
              purpose: 'To control key terrain and enable 2BCT follow-on operations',
            },
            {
              unit: 'B/1-87',
              task: 'ATTACK to SEIZE southern portion of OBJ IRON NLT 150600ZMAR26. Conduct BDA and report.',
              purpose: 'To control key terrain and support main effort',
            },
            {
              unit: 'C/1-87 (Reserve)',
              task: 'In RESERVE. Be prepared to reinforce A or B company on order. Be prepared to assume mission of A or B company.',
              purpose: 'To provide flexibility and depth',
            },
            {
              unit: 'FSE',
              task: 'Provide fire support to TF 1-87. Priority of fires: A Company. Prepare defensive targets on OBJ IRON.',
              purpose: 'To suppress enemy during attack and support consolidation',
            },
          ],
          coordinatingInstructions: [
            'LD/LC: 150500ZMAR26',
            'Phase Line GREEN crosses at grid 12345678 (end of movement to contact phase)',
            'Phase Line RED: link up with 2-10 CAV (grid 23456789)',
            'ROE: No fires within 500m of civilian structures without battalion commander approval',
            'Timeline: H-hour 150600ZMAR26',
            'Consolidation complete NLT 150700ZMAR26',
          ],
        },
        paragraph4_Sustainment: {
          logistics: 'Class III (fuel): Resupply on order at PL GREEN. Class V (ammunition): Basic load plus 50% carried. Resupply available on order. Field feeding: MREs during operation.',
          personnel: 'Casualties evacuated to battalion aid station (grid 11223344). Replacement personnel staged at battalion rear.',
          healthService: 'Battalion aid station at grid 11223344. Ground ambulance evacuation. MEDEVAC via 9-line request through battalion net. Priority MEDEVAC for urgent/urgent surgical.',
        },
        paragraph5_CommandSignal: {
          command: 'Battalion Commander with A Company (main effort). Battalion XO with B Company. Battalion TOC at grid 11223355. Succession of command: CDR, XO, S3.',
          signal: 'Battalion command net: freq 54.000. Company nets: A/54.100, B/54.200, C/54.300. CEOI in effect. Code words: RED=enemy contact, GREEN=objective secure, BLUE=link up complete.',
        },
        annexes: [
          'Annex A: Task Organization',
          'Annex B: Intelligence',
          'Annex C: Operations Overlay',
          'Annex D: Fire Support',
          'Annex F: Engineer',
          'Annex H: Signal',
          'Annex P: Personnel',
          'Annex Q: Sustainment',
        ],
        crossReferences: {
          valid: true,
          missingReferences: [],
        },
        generationConfidence: 0.92,
      },
    },
  ],
};

/**
 * MDMP Wargame Extraction RAFT Template
 *
 * Phase 5.1 Plan 13: RAFT template for extracting decision points, high-payoff targets,
 * and intelligence requirements from wargame outputs.
 *
 * MDMP Activity: MDMP-4-04 (Phase 4: COA Analysis / Wargaming)
 */

import type { MDMPPhase } from '../../mdmp/types.js';

/**
 * Input for wargame extraction
 */
export interface WargameExtractionInput {
  /** Raw wargame output text */
  wargameOutputText: string;
  /** Friendly COA being wargamed */
  friendlyCOA: string;
  /** Adversary COA being wargamed against */
  adversaryCOA: string;
  /** Terrain and weather conditions */
  environmentalConditions: string;
  /** Wargame method used */
  wargameMethod?: 'belt' | 'avenue-in-depth' | 'box';
}

/**
 * Decision point extracted from wargame
 */
export interface DecisionPoint {
  /** Decision point identifier */
  dpId: string;
  /** Decision point name/description */
  name: string;
  /** Location (geographic or temporal) */
  location: string;
  /** Trigger event that prompts decision */
  trigger: string;
  /** Decision to be made */
  decision: string;
  /** Available options/branches */
  options: Array<{
    option: string;
    description: string;
    consequences: string;
  }>;
  /** Time available to make decision */
  timeAvailable: string;
  /** Who makes this decision */
  decisionAuthority: string;
  /** Extraction confidence (0-1) */
  extractionConfidence: number;
}

/**
 * High-Payoff Target from wargame
 */
export interface HighPayoffTarget {
  /** HPT identifier */
  hptId: string;
  /** Target description */
  description: string;
  /** Why this target is high-payoff */
  significance: string;
  /** Expected location */
  expectedLocation: string;
  /** When target is expected to be available */
  timeWindow: string;
  /** Attack guidance */
  attackGuidance: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium';
  /** Extraction confidence (0-1) */
  extractionConfidence: number;
}

/**
 * Intelligence Requirement from wargame
 */
export interface IntelligenceRequirement {
  /** IR identifier */
  irId: string;
  /** Type of requirement */
  type: 'PIR' | 'FFIR' | 'IR';
  /** Requirement stated as question */
  requirement: string;
  /** Why this information is needed */
  justification: string;
  /** Which decision point this supports */
  supportsDecisionPoint: string | null;
  /** Latest time information has value */
  latestTimeOfValue: string;
  /** Extraction confidence (0-1) */
  extractionConfidence: number;
}

/**
 * Branch identified during wargame
 */
export interface Branch {
  /** Branch identifier */
  branchId: string;
  /** Branch name */
  name: string;
  /** Trigger condition */
  trigger: string;
  /** Branch description */
  description: string;
  /** Decision point this branches from */
  fromDecisionPoint: string;
}

/**
 * Sequel identified during wargame
 */
export interface Sequel {
  /** Sequel identifier */
  sequelId: string;
  /** Sequel name */
  name: string;
  /** Trigger condition */
  trigger: string;
  /** Sequel description */
  description: string;
  /** Planning requirements */
  planningRequirements: string;
}

/**
 * Complete wargame extraction output
 */
export interface WargameExtractionOutput {
  /** Decision points identified */
  decisionPoints: DecisionPoint[];
  /** High-Payoff Targets identified */
  highPayoffTargets: HighPayoffTarget[];
  /** Intelligence Requirements identified */
  intelligenceRequirements: IntelligenceRequirement[];
  /** Branches identified */
  branches: Branch[];
  /** Sequels identified */
  sequels: Sequel[];
  /** Overall wargame insights */
  summary: string;
  /** Extraction completeness confidence (0-1) */
  extractionCompleteness: number;
}

/**
 * JSON Schema for WargameExtractionInput
 */
export const WARGAME_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    wargameOutputText: { type: 'string' },
    friendlyCOA: { type: 'string' },
    adversaryCOA: { type: 'string' },
    environmentalConditions: { type: 'string' },
    wargameMethod: { type: 'string', enum: ['belt', 'avenue-in-depth', 'box'] },
  },
  required: ['wargameOutputText', 'friendlyCOA', 'adversaryCOA', 'environmentalConditions'],
};

/**
 * JSON Schema for WargameExtractionOutput
 */
export const WARGAME_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    decisionPoints: { type: 'array', items: { type: 'object' } },
    highPayoffTargets: { type: 'array', items: { type: 'object' } },
    intelligenceRequirements: { type: 'array', items: { type: 'object' } },
    branches: { type: 'array', items: { type: 'object' } },
    sequels: { type: 'array', items: { type: 'object' } },
    summary: { type: 'string' },
    extractionCompleteness: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['decisionPoints', 'highPayoffTargets', 'intelligenceRequirements', 'branches', 'sequels', 'summary', 'extractionCompleteness'],
};

/**
 * RAFT Template for Wargame Extraction
 */
export const WARGAME_EXTRACTION_TEMPLATE = {
  name: 'mdmp-wargame-extraction',
  description: 'Extract decision points, high-payoff targets, and intelligence requirements from wargame outputs',
  mdmpPhase: 'phase_4_coa_analysis' as MDMPPhase,
  mdmpActivity: 'MDMP-4-04',
  inputSchema: WARGAME_INPUT_SCHEMA,
  outputSchema: WARGAME_OUTPUT_SCHEMA,
  systemPrompt: `You are a military operations analyst extracting critical information from wargaming results.

Your mission: Analyze wargame output to identify decision points, high-payoff targets, intelligence requirements, branches, and sequels.

EXTRACTION TARGETS:

1. DECISION POINTS:
   - Moments when commander must make a decision
   - Format: "At [location/time], if [trigger], then decide [decision]"
   - Include: trigger, decision, options, time available, who decides
   - Example: "At PL GREEN, if enemy counterattacks with armor, commander decides: continue attack vs go to defense"

2. HIGH-PAYOFF TARGETS (HPT):
   - Enemy assets that if destroyed give marked advantage
   - Typically: enemy reserves, artillery, air defense, command posts, bridges
   - Why high-payoff: what advantage do we gain if destroyed?
   - When/where: time window and expected location
   - Attack guidance: how to engage (aviation, artillery, etc.)

3. INTELLIGENCE REQUIREMENTS (IR):
   - Information needed to make decisions identified during wargame
   - Links to decision points: "We need to know [X] to decide [Y]"
   - PIR: about enemy
   - FFIR: about friendly forces
   - IR: general intelligence need
   - Latest Time of Information Value (LTIOV): when do we need this by?

4. BRANCHES:
   - Pre-planned options based on likely enemy actions
   - Format: "If [trigger], then execute [branch]"
   - Example: "If enemy reinforces with tank battalion, execute Branch ARMOR (shift main effort south)"
   - Already anticipated during planning

5. SEQUELS:
   - Follow-on operations after current mission ends
   - Success sequel: what we do if we win
   - Failure sequel: what we do if we fail
   - Example: "Upon seizing OBJ IRON, be prepared to conduct exploitation to OBJ STEEL (Sequel EXPLOIT)"

WARGAMING CONTEXT:

Wargaming is action-reaction-counteraction:
- Friendly force acts
- Enemy reacts (based on adversary COA)
- Friendly counteracts
- Continue until reaching decision point or critical event

Look for phrases like:
- "Commander must decide..."
- "Critical decision at..."
- "If enemy does X, then..."
- "This triggers a branch to..."
- "High-value target identified..."
- "Need to know whether..."

QUALITY CRITERIA:
- Decision points are actionable (clear trigger, clear decision)
- HPTs are truly high-payoff (explain why)
- IRs are specific questions (not vague)
- Branches are pre-planned (not just mentioned possibilities)
- Sequels are fully scoped follow-on operations

Output well-structured JSON matching the schema exactly.`,

  examples: [
    {
      input: {
        wargameOutputText: `Wargame Turn 1 (H-hour to H+2):
Friendly: A and B companies cross LD and move toward OBJ IRON. A Company (main effort) on northern route, B Company on southern route.
Enemy: Enemy observation posts detect movement at H+30 minutes. Enemy artillery fires on likely assembly areas (ineffective, we already displaced).
Counteraction: Continue movement. Adjust routes slightly to avoid observed areas.

DECISION POINT 1: At PL GREEN (H+1:30), if enemy has reinforced Hill 315 with armor, commander must decide: continue direct attack on Hill 315 OR bypass Hill 315 and isolate it. Time available: 15 minutes. Indicators: Tank movement observed by UAV in NAI-1.

Wargame Turn 2 (H+2 to H+4):
Friendly: A Company reaches PL GREEN. Enemy armor not observed. Continues attack on Hill 315. B Company reaches bridge (intact, no demo).
Enemy: Enemy on Hill 315 defends with anti-tank missiles. Engages A Company at 2km range. A Company takes casualties (2 vehicles damaged).
Counteraction: A Company suppresses enemy positions with artillery. Maneuvers under cover of fires.

HIGH-PAYOFF TARGET IDENTIFIED: Enemy ATGM position on Hill 315 (grid 456789). If destroyed, A Company can close on objective with minimal casualties. Attack guidance: Aviation or artillery, precision fires. Time window: H+2 to H+4.

Wargame Turn 3 (H+4 to H+6):
Friendly: A Company assaults Hill 315. B Company seizes southern portion of OBJ IRON.
Enemy: Enemy withdraws from Hill 315 toward OBJ IRON. Attempts to reinforce OBJ IRON from east.

DECISION POINT 2: At OBJ IRON (H+5), if enemy reinforcements arrive from east before we consolidate, commander must decide: defend in place and accept engagement OR withdraw to defensible terrain. Time available: 10 minutes. Indicators: Movement in NAI-2 (road junction east of OBJ IRON).

INTELLIGENCE REQUIREMENT: Will enemy reinforcements reach OBJ IRON before H+6? (Supports Decision Point 2). Collection: UAV reconnaissance of NAI-2. LTIOV: H+4:30.

BRANCH IDENTIFIED: If enemy reinforces with battalion-sized element before we consolidate, execute BRANCH DEFEND: C Company reinforces B Company, establish hasty defense on OBJ IRON, request higher HQ support.

SEQUEL IDENTIFIED: Upon securing OBJ IRON, be prepared to conduct SEQUEL EXPLOIT: advance east to OBJ STEEL to maintain momentum (2BCT follow-on operations). Planning requirement: reconnaissance of routes to OBJ STEEL, coordination with 2BCT.`,
        friendlyCOA: 'TF 1-87 attacks in two columns to seize OBJ IRON. A Company (main effort) attacks from north via Hill 315. B Company attacks from south.',
        adversaryCOA: 'Enemy defends on Hill 315 and OBJ IRON. Requests reinforcement if penetrated.',
        environmentalConditions: 'Clear weather, good visibility. Urban terrain on OBJ IRON. Hill 315 provides dominant observation.',
        wargameMethod: 'belt',
      },
      output: {
        decisionPoints: [
          {
            dpId: 'DP-1',
            name: 'Hill 315 Reinforcement Decision',
            location: 'PL GREEN (H+1:30)',
            trigger: 'Enemy has reinforced Hill 315 with armor (observed in NAI-1)',
            decision: 'Continue direct attack on Hill 315 OR bypass Hill 315 and isolate it',
            options: [
              {
                option: 'Continue direct attack',
                description: 'A Company attacks Hill 315 as planned with armor support',
                consequences: 'High casualties likely if enemy armor present. Delay in timeline. May require commitment of reserve.',
              },
              {
                option: 'Bypass and isolate',
                description: 'A Company bypasses Hill 315, links up with B Company at OBJ IRON, isolate Hill 315',
                consequences: 'Avoids costly engagement. Leaves enemy on dominant terrain in our rear. Risk to LOCs.',
              },
            ],
            timeAvailable: '15 minutes',
            decisionAuthority: 'Battalion Commander',
            extractionConfidence: 0.95,
          },
          {
            dpId: 'DP-2',
            name: 'Enemy Reinforcement Decision',
            location: 'OBJ IRON (H+5)',
            trigger: 'Enemy reinforcements arrive from east before we consolidate (observed in NAI-2)',
            decision: 'Defend in place and accept engagement OR withdraw to defensible terrain',
            options: [
              {
                option: 'Defend in place',
                description: 'Accept engagement on OBJ IRON, request C Company reinforcement',
                consequences: 'Risk of being defeated before consolidation complete. Urban terrain favors defense.',
              },
              {
                option: 'Withdraw to defensible terrain',
                description: 'Withdraw to Hill 315 or PL GREEN, establish defense',
                consequences: 'Surrender OBJ IRON temporarily. Mission failure. Requires re-attack.',
              },
            ],
            timeAvailable: '10 minutes',
            decisionAuthority: 'Battalion Commander',
            extractionConfidence: 0.90,
          },
        ],
        highPayoffTargets: [
          {
            hptId: 'HPT-1',
            description: 'Enemy ATGM position on Hill 315',
            significance: 'ATGM engaging A Company at 2km range causing vehicle casualties. If destroyed, A Company can close on objective with minimal casualties. Enables main effort success.',
            expectedLocation: 'Grid 456789, Hill 315 military crest',
            timeWindow: 'H+2 to H+4 (while A Company in engagement area)',
            attackGuidance: 'Aviation (attack helicopter) or artillery precision fires. Coordinate with A Company maneuver to avoid fratricide.',
            priority: 'critical',
            extractionConfidence: 0.95,
          },
        ],
        intelligenceRequirements: [
          {
            irId: 'IR-1',
            type: 'PIR',
            requirement: 'Will enemy reinforcements reach OBJ IRON before H+6?',
            justification: 'Directly supports Decision Point 2. If reinforcements arrive before consolidation, we may be defeated in detail. Commander needs to know whether to defend or withdraw.',
            supportsDecisionPoint: 'DP-2',
            latestTimeOfValue: 'H+4:30 (30 minutes before projected enemy arrival)',
            extractionConfidence: 0.95,
          },
          {
            irId: 'IR-2',
            type: 'PIR',
            requirement: 'Has enemy reinforced Hill 315 with armor?',
            justification: 'Supports Decision Point 1. Determines whether to attack directly or bypass. Tank presence changes COA viability.',
            supportsDecisionPoint: 'DP-1',
            latestTimeOfValue: 'H+1:15 (15 minutes before DP-1)',
            extractionConfidence: 0.90,
          },
        ],
        branches: [
          {
            branchId: 'BRANCH-DEFEND',
            name: 'BRANCH DEFEND',
            trigger: 'Enemy reinforces with battalion-sized element before we consolidate on OBJ IRON',
            description: 'C Company reinforces B Company on OBJ IRON. Establish hasty defense. Request higher HQ support (aviation, artillery). Prepare to repel enemy counterattack.',
            fromDecisionPoint: 'DP-2',
          },
        ],
        sequels: [
          {
            sequelId: 'SEQUEL-EXPLOIT',
            name: 'SEQUEL EXPLOIT',
            trigger: 'Successful seizure and consolidation of OBJ IRON',
            description: 'Advance east to OBJ STEEL to maintain momentum and enable 2BCT follow-on operations. Transition from attack to movement to contact.',
            planningRequirements: 'Reconnaissance of routes from OBJ IRON to OBJ STEEL. Coordination with 2BCT for passage of lines or link-up. Logistics resupply (Class III and V) after seizing OBJ IRON.',
          },
        ],
        summary: 'Wargame identified 2 critical decision points: Hill 315 reinforcement decision at PL GREEN and enemy reinforcement decision at OBJ IRON. One critical HPT: enemy ATGM position on Hill 315 causing A Company casualties. Two intelligence requirements support decision points (enemy reinforcement timelines). One branch (DEFEND) addresses enemy reinforcement scenario. One sequel (EXPLOIT) addresses successful mission completion.',
        extractionCompleteness: 0.88,
      },
    },
  ],
};

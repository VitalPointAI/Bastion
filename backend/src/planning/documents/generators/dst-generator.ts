/**
 * Decision Support Template (DST) and CCIR Generators
 *
 * Phase 05 Plan 09: Auto-generate decision points and critical information requirements
 * - DST: Decision Support Template with decision points, triggers, and options
 * - CCIR: Commander's Critical Information Requirements (PIR, FFIR, EEFI)
 */

import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';

/**
 * Decision Point in the Decision Support Template
 */
export interface DecisionPoint {
  id: string;
  dpNumber: number;
  description: string;
  trigger: string;
  latestDecisionTime: string;
  options: Array<{
    label: string;
    description: string;
    branchTo?: string;
  }>;
  owner: string;
}

/**
 * Decision Support Template
 */
export interface DST {
  planId: string;
  planName: string;
  decisionPoints: DecisionPoint[];
  generatedAt: Date;
}

/**
 * Priority Intelligence Requirement
 */
export interface PIR {
  number: number;
  question: string;
  indicators: string[];
  answerTimeframe: string;
  latestTimeInfoValue: string;
}

/**
 * Friendly Force Information Requirement
 */
export interface FFIR {
  number: number;
  event: string;
  reportTo: string;
  timeLimit: string;
}

/**
 * Essential Elements of Friendly Information (what to protect)
 */
export interface EEFI {
  number: number;
  information: string;
  protectionMeasures: string;
}

/**
 * Commander's Critical Information Requirements
 */
export interface CCIR {
  planId: string;
  planName: string;
  pir: PIR[];
  ffir: FFIR[];
  eefi: EEFI[];
  generatedAt: Date;
}

/**
 * Generate Decision Support Template from plan data
 * Auto-generates decision points from phase transitions and risks
 */
export async function generateDST(planId: string): Promise<DST> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);

  // Auto-generate decision points from plan phases and risks
  const decisionPoints: DecisionPoint[] = [];
  let dpNum = 1;

  // Decision point for each phase transition
  const phases = plan.execution?.conceptOfOperations?.phases || [];
  phases.forEach((phase, i) => {
    if (i > 0) {
      decisionPoints.push({
        id: `DP-${dpNum}`,
        dpNumber: dpNum++,
        description: `Transition to ${phase.name}`,
        trigger: `Phase ${i} objectives achieved`,
        latestDecisionTime: `D+${i} H-6`,
        options: [
          { label: 'GO', description: `Proceed with ${phase.name}` },
          { label: 'NO GO', description: 'Continue current phase' },
          { label: 'REDIRECT', description: 'Execute branch plan' },
        ],
        owner: 'Commander',
      });
    }
  });

  // If no phases defined, create default phase transition DPs
  if (phases.length === 0) {
    const defaultPhases = ['Shape', 'Seize', 'Exploit', 'Transition'];
    defaultPhases.forEach((phase, i) => {
      if (i > 0) {
        decisionPoints.push({
          id: `DP-${dpNum}`,
          dpNumber: dpNum++,
          description: `Transition to ${phase} Phase`,
          trigger: `Phase ${i} objectives achieved`,
          latestDecisionTime: `D+${i} H-6`,
          options: [
            { label: 'GO', description: `Proceed with ${phase} phase` },
            { label: 'NO GO', description: 'Continue current phase' },
            { label: 'REDIRECT', description: 'Execute branch plan' },
          ],
          owner: 'Commander',
        });
      }
    });
  }

  // Decision points from high risks
  if (selectedCOA?.risks) {
    const highRisks = selectedCOA.risks.filter(r =>
      r.likelihood === 'high' || r.impact === 'high'
    );
    highRisks.forEach(risk => {
      decisionPoints.push({
        id: `DP-${dpNum}`,
        dpNumber: dpNum++,
        description: `Risk materialization: ${risk.description}`,
        trigger: `${risk.description} observed`,
        latestDecisionTime: 'As triggered',
        options: [
          { label: 'MITIGATE', description: risk.mitigation || 'Execute mitigation' },
          { label: 'ACCEPT', description: 'Continue operations' },
          { label: 'ABORT', description: 'Halt current operation' },
        ],
        owner: 'Commander',
      });
    });
  }

  // Add culmination point decision
  decisionPoints.push({
    id: `DP-${dpNum}`,
    dpNumber: dpNum++,
    description: 'Culmination assessment',
    trigger: 'Combat power ratio reaches 1:1 or below',
    latestDecisionTime: 'Continuous assessment',
    options: [
      { label: 'CONTINUE', description: 'Press the attack' },
      { label: 'CONSOLIDATE', description: 'Halt and consolidate gains' },
      { label: 'WITHDRAW', description: 'Execute tactical withdrawal' },
    ],
    owner: 'Commander',
  });

  return {
    planId,
    planName: plan.name,
    decisionPoints,
    generatedAt: new Date(),
  };
}

/**
 * Generate Commander's Critical Information Requirements
 * Extracts from plan or provides doctrinal defaults
 */
export async function generateCCIR(planId: string): Promise<CCIR> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  // Extract from plan or generate defaults
  // Note: coordinatingInstructions may store CCIR in various formats
  const storedCCIR = (plan.execution?.coordinatingInstructions as any)?.ccir;

  // Priority Intelligence Requirements
  const pir: PIR[] = storedCCIR?.pir?.map((q: string, i: number) => ({
    number: i + 1,
    question: q,
    indicators: ['Direct observation', 'SIGINT', 'HUMINT'],
    answerTimeframe: 'Continuous',
    latestTimeInfoValue: `D+${i} H-12`,
  })) || [
    {
      number: 1,
      question: 'What is the enemy main effort?',
      indicators: ['Unit movement', 'Fires concentration', 'Logistics activity'],
      answerTimeframe: 'Continuous',
      latestTimeInfoValue: 'D-Day H-6',
    },
    {
      number: 2,
      question: 'Is the enemy aware of our COA?',
      indicators: ['Enemy repositioning', 'Increased SIGINT activity', 'Ambush positions'],
      answerTimeframe: 'Prior to execution',
      latestTimeInfoValue: 'H-Hour',
    },
    {
      number: 3,
      question: 'What are enemy reserve locations and composition?',
      indicators: ['Holding areas identified', 'Unit markings', 'Equipment counts'],
      answerTimeframe: 'Prior to Phase II',
      latestTimeInfoValue: 'D+1 H-6',
    },
  ];

  // Friendly Force Information Requirements
  const ffir: FFIR[] = storedCCIR?.ffir?.map((e: string, i: number) => ({
    number: i + 1,
    event: e,
    reportTo: 'Commander',
    timeLimit: '15 minutes',
  })) || [
    {
      number: 1,
      event: 'Unit reaches 30% combat ineffective',
      reportTo: 'Commander',
      timeLimit: 'Immediate',
    },
    {
      number: 2,
      event: 'Loss of communications with adjacent unit',
      reportTo: 'XO',
      timeLimit: '5 minutes',
    },
    {
      number: 3,
      event: 'Enemy contact with strength greater than squad',
      reportTo: 'S3',
      timeLimit: '10 minutes',
    },
    {
      number: 4,
      event: 'Casualty exceeding MEDEVAC Category Urgent',
      reportTo: 'S1',
      timeLimit: 'Immediate',
    },
  ];

  // Essential Elements of Friendly Information
  const eefi: EEFI[] = storedCCIR?.eefi?.map((info: string, i: number) => ({
    number: i + 1,
    information: info,
    protectionMeasures: 'OPSEC, COMSEC',
  })) || [
    {
      number: 1,
      information: 'Timing of main attack',
      protectionMeasures: 'Need to know, secure comms only',
    },
    {
      number: 2,
      information: 'Location of command post',
      protectionMeasures: 'Camouflage, emissions control',
    },
    {
      number: 3,
      information: 'Scheme of maneuver for decisive operation',
      protectionMeasures: 'Compartmentalized briefings, OPSEC',
    },
    {
      number: 4,
      information: 'Logistics resupply schedule and routes',
      protectionMeasures: 'Varied timing, alternate routes',
    },
  ];

  return {
    planId,
    planName: plan.name,
    pir,
    ffir,
    eefi,
    generatedAt: new Date(),
  };
}

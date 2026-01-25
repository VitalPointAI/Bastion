/**
 * OPORD Template Structure
 *
 * Phase 05 Plan 08: Standard 5-paragraph order structure per JP 5-0
 */

import type { OperationalPlan, COA } from '../../types.js';
import type { DocumentMetadata } from '../types.js';

/**
 * Standard 5-paragraph order structure per JP 5-0
 */
export interface OPORDStructure {
  classification: string;
  header: {
    unit: string;
    orderType: string;
    orderNumber: string;
    references: string[];
    timeZone: string;
    dtg: string;
    messageRef?: string;
  };
  taskOrganization: string[];
  paragraph1_Situation: {
    areaOfInterest: string;
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
  paragraph2_Mission: string;
  paragraph3_Execution: {
    commandersIntent: {
      purpose: string;
      keyTasks: string[];
      endState: string;
    };
    conceptOfOperations: string;
    scheme: string;
    tasksToSubordinateUnits: Array<{
      unit: string;
      task: string;
      purpose: string;
    }>;
    tasksToAttachments?: string[];
    coordinatingInstructions: {
      timeline: string[];
      roeGuidance: string;
      riskMitigation: string;
      ccir: {
        pir: string[];
        ffir: string[];
        eefi: string[];
      };
      fireSupport?: string;
      other?: string[];
    };
  };
  paragraph4_Sustainment: {
    logistics: {
      classI: string; // Subsistence
      classII: string; // Clothing and equipment
      classIII: string; // POL
      classIV: string; // Construction
      classV: string; // Ammunition
      classVI: string; // Personal demand
      classVII: string; // Major items
      classVIII: string; // Medical
      classIX: string; // Repair parts
    };
    transportation: string;
    personnel: {
      strength: string;
      casualties: string;
      replacement: string;
      morale: string;
    };
    healthServiceSupport: string;
  };
  paragraph5_CommandSignal: {
    command: {
      location: string;
      succession: string[];
    };
    signal: {
      primaryFreq: string;
      alternateFreq: string;
      signalPlan: string;
      codewords?: Record<string, string>;
      passwordScheme?: string;
    };
  };
  annexes?: Record<string, unknown>;
  authentication: {
    commanderName: string;
    commanderRank: string;
    commanderPosition: string;
    signedDate: string;
  };
}

/**
 * Build OPORD structure from operational plan and selected COA
 */
export function buildOPORDStructure(
  plan: OperationalPlan,
  selectedCOA: COA,
  metadata: DocumentMetadata
): OPORDStructure {
  // Extract situation data - use plan.situation directly since it's already typed
  const situation = plan.situation;
  const enemyForces = situation?.enemyForces;
  const friendlyForces = situation?.friendlyForces;
  const civilConsiderations = situation?.civilConsiderations;

  // Extract execution data
  const execution = plan.execution;
  const fires = execution?.fires;

  // Extract sustainment data
  const sustainment = plan.sustainment;
  const logistics = sustainment?.logistics;
  const personnel = sustainment?.personnel;

  // Extract command and signal data
  const commandSignal = plan.commandSignal;
  const commandPost = commandSignal?.commandPost;
  const signal = commandSignal?.signal;

  return {
    classification: metadata.classification,
    header: {
      unit: metadata.unit,
      orderType: plan.planType,
      orderNumber: metadata.orderNumber,
      references: metadata.references,
      timeZone: metadata.timeZone,
      dtg: metadata.dtg,
    },
    taskOrganization: selectedCOA.tasks.map(t => `${t.unitId}: ${t.task}`),
    paragraph1_Situation: {
      areaOfInterest: situation?.areaOfInterest || 'TBD',
      areaOfOperations: situation?.areaOfOperations || 'TBD',
      terrain: 'See Annex B (Intelligence)',
      weather: 'See Annex B (Intelligence)',
      enemyForces: {
        composition: enemyForces?.composition || 'TBD',
        disposition: enemyForces?.disposition || 'TBD',
        strength: enemyForces?.strength || 'TBD',
        recentActivities: enemyForces?.recentActivity || 'TBD',
        capabilities: enemyForces?.capabilities?.join(', ') || 'TBD',
        mostLikelyCOA: 'TBD',
        mostDangerousCOA: 'TBD',
      },
      friendlyForces: {
        higherHQ: friendlyForces?.higherHQ || 'TBD',
        higherMission: 'See higher headquarters OPORD',
        higherIntent: 'See higher headquarters OPORD',
        adjacent: friendlyForces?.adjacentUnits || [],
        supporting: friendlyForces?.supportingUnits || [],
      },
      civilConsiderations: civilConsiderations
        ? `Population: ${civilConsiderations.population || 'TBD'}, Infrastructure: ${civilConsiderations.infrastructure || 'TBD'}`
        : 'TBD',
      attachmentsDetachments: situation?.attachmentsDetachments || [],
    },
    paragraph2_Mission: plan.mission
      ? `${plan.mission.who} ${plan.mission.what} ${plan.mission.when} ${plan.mission.where} ${plan.mission.why}`
      : 'TBD',
    paragraph3_Execution: {
      commandersIntent: {
        purpose: selectedCOA.commandersIntent?.purpose || 'TBD',
        keyTasks: selectedCOA.commandersIntent?.keyTasks || [],
        endState: selectedCOA.commandersIntent?.endState || 'TBD',
      },
      conceptOfOperations: selectedCOA.description,
      scheme: selectedCOA.scheme,
      tasksToSubordinateUnits: selectedCOA.tasks.map(t => ({
        unit: t.unitId,
        task: t.task,
        purpose: t.purpose || '',
      })),
      coordinatingInstructions: {
        timeline: execution?.coordinatingInstructions || [],
        roeGuidance: 'See ROE Card',
        riskMitigation: selectedCOA.risks?.map(r => `${r.description}: ${r.mitigation || 'TBD'}`).join('; ') || 'TBD',
        ccir: {
          pir: [], // Priority Intelligence Requirements
          ffir: [], // Friendly Force Information Requirements
          eefi: [], // Essential Elements of Friendly Information
        },
        fireSupport: fires?.supportingUnits?.join(', ') || 'IAW SOP',
      },
    },
    paragraph4_Sustainment: {
      logistics: {
        classI: logistics?.supplyPlan || 'IAW SOP',
        classII: 'IAW SOP',
        classIII: logistics?.transportationPlan || 'IAW SOP',
        classIV: 'IAW SOP',
        classV: 'IAW SOP',
        classVI: 'IAW SOP',
        classVII: logistics?.maintenancePlan || 'IAW SOP',
        classVIII: sustainment?.healthServiceSupport || 'IAW SOP',
        classIX: 'IAW SOP',
      },
      transportation: logistics?.transportationPlan || 'IAW SOP',
      personnel: {
        strength: personnel?.replacementPlan || 'TBD',
        casualties: personnel?.medicalEvacuation || 'Report IAW SOP',
        replacement: personnel?.replacementPlan || 'On call',
        morale: 'High',
      },
      healthServiceSupport: sustainment?.healthServiceSupport || 'IAW SOP',
    },
    paragraph5_CommandSignal: {
      command: {
        location: commandPost?.location || 'TBD',
        succession: commandSignal?.succession || [],
      },
      signal: {
        primaryFreq: signal?.frequencies?.[0] || 'TBD',
        alternateFreq: signal?.frequencies?.[1] || 'TBD',
        signalPlan: 'IAW CEOI',
        codewords: commandSignal?.codewords,
      },
    },
    authentication: {
      commanderName: plan.commanderApproval?.planApprovedBy || 'PENDING',
      commanderRank: '',
      commanderPosition: 'Commanding',
      signedDate: plan.commanderApproval?.planApprovedAt?.toISOString() || 'PENDING',
    },
  };
}

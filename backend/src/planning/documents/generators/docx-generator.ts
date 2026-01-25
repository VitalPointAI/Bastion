/**
 * DOCX Document Generator
 *
 * Phase 05 Plan 08: Generate OPORD as Microsoft Word document
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type { GeneratedDocument, OPORDGeneratorOptions, DocumentMetadata } from '../types.js';
import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';
import { buildOPORDStructure } from '../templates/opord-template.js';

/**
 * Generate OPORD as DOCX
 */
export async function generateOPORDDocx(
  planId: string,
  metadata: DocumentMetadata,
  options: OPORDGeneratorOptions = {}
): Promise<GeneratedDocument> {
  // Load plan and selected COA
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);
  if (!selectedCOA) throw new Error('No COA selected for plan');

  // Build OPORD structure
  const opord = buildOPORDStructure(plan, selectedCOA, metadata);

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        // Classification Banner
        ...(options.classificationBanner !== false ? [
          new Paragraph({
            children: [
              new TextRun({
                text: opord.classification,
                bold: true,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
        ] : []),

        // Header
        new Paragraph({
          text: `${opord.header.unit}`,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `${opord.header.orderType} ${opord.header.orderNumber}`,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `DTG: ${opord.header.dtg}`,
        }),
        new Paragraph({
          text: `References: ${opord.header.references.join(', ')}`,
        }),
        new Paragraph({
          text: `Time Zone: ${opord.header.timeZone}`,
          spacing: { after: 200 },
        }),

        // Task Organization
        new Paragraph({
          text: 'Task Organization:',
          heading: HeadingLevel.HEADING_2,
        }),
        ...opord.taskOrganization.map(t => new Paragraph({
          text: `  ${t}`,
          spacing: { after: 100 },
        })),

        // 1. SITUATION
        new Paragraph({
          text: '1. SITUATION',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'a. Area of Interest. ', bold: true }), new TextRun(opord.paragraph1_Situation.areaOfInterest)],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'b. Area of Operations. ', bold: true }), new TextRun(opord.paragraph1_Situation.areaOfOperations)],
        }),
        new Paragraph({
          children: [new TextRun({ text: '(1) Terrain. ', bold: true }), new TextRun(opord.paragraph1_Situation.terrain)],
        }),
        new Paragraph({
          children: [new TextRun({ text: '(2) Weather. ', bold: true }), new TextRun(opord.paragraph1_Situation.weather)],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'c. Enemy Forces. ', bold: true })],
        }),
        new Paragraph({
          text: `   (1) Composition: ${opord.paragraph1_Situation.enemyForces.composition}`,
        }),
        new Paragraph({
          text: `   (2) Disposition: ${opord.paragraph1_Situation.enemyForces.disposition}`,
        }),
        new Paragraph({
          text: `   (3) Most Likely COA: ${opord.paragraph1_Situation.enemyForces.mostLikelyCOA}`,
        }),
        new Paragraph({
          text: `   (4) Most Dangerous COA: ${opord.paragraph1_Situation.enemyForces.mostDangerousCOA}`,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'd. Friendly Forces. ', bold: true })],
        }),
        new Paragraph({
          text: `   (1) Higher: ${opord.paragraph1_Situation.friendlyForces.higherHQ}`,
        }),
        new Paragraph({
          text: `   (2) Higher Mission: ${opord.paragraph1_Situation.friendlyForces.higherMission}`,
        }),
        new Paragraph({
          text: `   (3) Higher Intent: ${opord.paragraph1_Situation.friendlyForces.higherIntent}`,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'e. Civil Considerations. ', bold: true }), new TextRun(opord.paragraph1_Situation.civilConsiderations)],
        }),

        // 2. MISSION
        new Paragraph({
          text: '2. MISSION',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
        new Paragraph({
          text: opord.paragraph2_Mission,
          spacing: { after: 200 },
        }),

        // 3. EXECUTION
        new Paragraph({
          text: '3. EXECUTION',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "a. Commander's Intent. ", bold: true })],
        }),
        new Paragraph({
          text: `   Purpose: ${opord.paragraph3_Execution.commandersIntent.purpose}`,
        }),
        new Paragraph({
          text: `   Key Tasks: ${opord.paragraph3_Execution.commandersIntent.keyTasks.join(', ')}`,
        }),
        new Paragraph({
          text: `   End State: ${opord.paragraph3_Execution.commandersIntent.endState}`,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'b. Concept of Operations. ', bold: true }), new TextRun(opord.paragraph3_Execution.conceptOfOperations)],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'c. Scheme of Maneuver. ', bold: true }), new TextRun(opord.paragraph3_Execution.scheme)],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'd. Tasks to Subordinate Units.', bold: true })],
        }),
        ...opord.paragraph3_Execution.tasksToSubordinateUnits.map((t, i) => new Paragraph({
          text: `   (${i + 1}) ${t.unit}: ${t.task}. ${t.purpose}`,
        })),
        new Paragraph({
          children: [new TextRun({ text: 'e. Coordinating Instructions.', bold: true })],
        }),
        new Paragraph({
          text: `   (1) ROE: ${opord.paragraph3_Execution.coordinatingInstructions.roeGuidance}`,
        }),
        new Paragraph({
          text: `   (2) Risk Mitigation: ${opord.paragraph3_Execution.coordinatingInstructions.riskMitigation}`,
        }),

        // 4. SUSTAINMENT
        new Paragraph({
          text: '4. SUSTAINMENT (SERVICE SUPPORT)',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'a. Logistics.', bold: true })],
        }),
        new Paragraph({ text: `   Class I (Subsistence): ${opord.paragraph4_Sustainment.logistics.classI}` }),
        new Paragraph({ text: `   Class III (POL): ${opord.paragraph4_Sustainment.logistics.classIII}` }),
        new Paragraph({ text: `   Class V (Ammunition): ${opord.paragraph4_Sustainment.logistics.classV}` }),
        new Paragraph({ text: `   Class VIII (Medical): ${opord.paragraph4_Sustainment.logistics.classVIII}` }),
        new Paragraph({
          children: [new TextRun({ text: 'b. Personnel.', bold: true })],
        }),
        new Paragraph({ text: `   Casualty Evacuation: ${opord.paragraph4_Sustainment.personnel.casualties}` }),

        // 5. COMMAND AND SIGNAL
        new Paragraph({
          text: '5. COMMAND AND SIGNAL',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'a. Command.', bold: true })],
        }),
        new Paragraph({ text: `   (1) Location of Commander: ${opord.paragraph5_CommandSignal.command.location}` }),
        new Paragraph({ text: `   (2) Succession: ${opord.paragraph5_CommandSignal.command.succession.join(' > ')}` }),
        new Paragraph({
          children: [new TextRun({ text: 'b. Signal.', bold: true })],
        }),
        new Paragraph({ text: `   (1) Primary: ${opord.paragraph5_CommandSignal.signal.primaryFreq}` }),
        new Paragraph({ text: `   (2) Alternate: ${opord.paragraph5_CommandSignal.signal.alternateFreq}` }),

        // Authentication
        new Paragraph({
          text: '',
          spacing: { before: 600 },
        }),
        new Paragraph({
          text: opord.authentication.commanderName,
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({
          text: opord.authentication.commanderPosition,
          alignment: AlignmentType.RIGHT,
        }),

        // Classification Footer
        ...(options.classificationBanner !== false ? [
          new Paragraph({
            children: [
              new TextRun({
                text: opord.classification,
                bold: true,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
          }),
        ] : []),
      ],
    }],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);

  const filename = `${opord.header.unit.replace(/\s+/g, '_')}_${opord.header.orderType}_${opord.header.orderNumber}.docx`;

  return {
    buffer: Buffer.from(buffer),
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: buffer.byteLength,
    generatedAt: new Date(),
  };
}

/**
 * PDF Document Generator
 *
 * Phase 05 Plan 08: Generate OPORD as PDF document
 */

import * as PDFKit from 'pdfkit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = (PDFKit as any).default || PDFKit;
import type { GeneratedDocument, OPORDGeneratorOptions, DocumentMetadata } from '../types.js';
import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';
import { buildOPORDStructure } from '../templates/opord-template.js';
import {
  addPdfExerciseWatermark,
  addExerciseHeader,
  getExerciseFilenamePrefix,
} from '../../../middleware/exercise-watermark.js';

/**
 * Generate OPORD as PDF
 */
export async function generateOPORDPdf(
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

  // Create PDF
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const baseFilename = `${opord.header.unit.replace(/\s+/g, '_')}_${opord.header.orderType}_${opord.header.orderNumber}.pdf`;
        const filename = options.exerciseMode
          ? `${getExerciseFilenamePrefix()}${baseFilename}`
          : baseFilename;

        resolve({
          buffer,
          filename,
          mimeType: 'application/pdf',
          size: buffer.byteLength,
          generatedAt: new Date(),
        });
      });

      // Exercise header (before classification banner)
      if (options.exerciseMode) {
        addExerciseHeader(doc);
      }

      // Classification Banner
      if (options.classificationBanner !== false) {
        doc.fontSize(14).font('Helvetica-Bold')
          .text(opord.classification, { align: 'center' });
        doc.moveDown(0.5);
      }

      // Header
      doc.fontSize(16).font('Helvetica-Bold')
        .text(opord.header.unit, { align: 'center' })
        .text(`${opord.header.orderType} ${opord.header.orderNumber}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica')
        .text(`DTG: ${opord.header.dtg}`)
        .text(`References: ${opord.header.references.join(', ')}`)
        .text(`Time Zone: ${opord.header.timeZone}`);
      doc.moveDown();

      // Task Organization
      doc.fontSize(12).font('Helvetica-Bold').text('Task Organization:');
      doc.fontSize(10).font('Helvetica');
      opord.taskOrganization.forEach(t => {
        doc.text(`  ${t}`);
      });
      doc.moveDown();

      // 1. SITUATION
      doc.fontSize(12).font('Helvetica-Bold').text('1. SITUATION');
      doc.fontSize(10).font('Helvetica');
      doc.font('Helvetica-Bold').text('a. Area of Interest. ', { continued: true })
        .font('Helvetica').text(opord.paragraph1_Situation.areaOfInterest);
      doc.font('Helvetica-Bold').text('b. Area of Operations. ', { continued: true })
        .font('Helvetica').text(opord.paragraph1_Situation.areaOfOperations);
      doc.font('Helvetica-Bold').text('c. Enemy Forces. ');
      doc.text(`   Composition: ${opord.paragraph1_Situation.enemyForces.composition}`);
      doc.text(`   Most Likely COA: ${opord.paragraph1_Situation.enemyForces.mostLikelyCOA}`);
      doc.text(`   Most Dangerous COA: ${opord.paragraph1_Situation.enemyForces.mostDangerousCOA}`);
      doc.font('Helvetica-Bold').text('d. Friendly Forces. ');
      doc.text(`   Higher: ${opord.paragraph1_Situation.friendlyForces.higherHQ}`);
      doc.text(`   Higher Intent: ${opord.paragraph1_Situation.friendlyForces.higherIntent}`);
      doc.moveDown();

      // 2. MISSION
      doc.fontSize(12).font('Helvetica-Bold').text('2. MISSION');
      doc.fontSize(10).font('Helvetica').text(opord.paragraph2_Mission);
      doc.moveDown();

      // 3. EXECUTION
      doc.fontSize(12).font('Helvetica-Bold').text('3. EXECUTION');
      doc.fontSize(10);
      doc.font('Helvetica-Bold').text("a. Commander's Intent.");
      doc.font('Helvetica').text(`   Purpose: ${opord.paragraph3_Execution.commandersIntent.purpose}`);
      doc.text(`   Key Tasks: ${opord.paragraph3_Execution.commandersIntent.keyTasks.join(', ')}`);
      doc.text(`   End State: ${opord.paragraph3_Execution.commandersIntent.endState}`);
      doc.font('Helvetica-Bold').text('b. Concept of Operations. ', { continued: true })
        .font('Helvetica').text(opord.paragraph3_Execution.conceptOfOperations);
      doc.font('Helvetica-Bold').text('c. Scheme of Maneuver. ', { continued: true })
        .font('Helvetica').text(opord.paragraph3_Execution.scheme);
      doc.font('Helvetica-Bold').text('d. Tasks to Subordinate Units.');
      opord.paragraph3_Execution.tasksToSubordinateUnits.forEach((t, i) => {
        doc.text(`   (${i + 1}) ${t.unit}: ${t.task}`);
      });
      doc.font('Helvetica-Bold').text('e. Coordinating Instructions.');
      doc.text(`   ROE: ${opord.paragraph3_Execution.coordinatingInstructions.roeGuidance}`);
      doc.moveDown();

      // 4. SUSTAINMENT
      doc.fontSize(12).font('Helvetica-Bold').text('4. SUSTAINMENT');
      doc.fontSize(10);
      doc.font('Helvetica-Bold').text('a. Logistics.');
      doc.font('Helvetica').text(`   Class V (Ammunition): ${opord.paragraph4_Sustainment.logistics.classV}`);
      doc.text(`   Class VIII (Medical): ${opord.paragraph4_Sustainment.logistics.classVIII}`);
      doc.moveDown();

      // 5. COMMAND AND SIGNAL
      doc.fontSize(12).font('Helvetica-Bold').text('5. COMMAND AND SIGNAL');
      doc.fontSize(10);
      doc.font('Helvetica-Bold').text('a. Command.');
      doc.font('Helvetica').text(`   Location: ${opord.paragraph5_CommandSignal.command.location}`);
      doc.text(`   Succession: ${opord.paragraph5_CommandSignal.command.succession.join(' > ')}`);
      doc.font('Helvetica-Bold').text('b. Signal.');
      doc.font('Helvetica').text(`   Primary: ${opord.paragraph5_CommandSignal.signal.primaryFreq}`);
      doc.moveDown(2);

      // Authentication
      doc.text(opord.authentication.commanderName, { align: 'right' });
      doc.text(opord.authentication.commanderPosition, { align: 'right' });

      // Classification Footer
      if (options.classificationBanner !== false) {
        doc.moveDown(2);
        doc.fontSize(14).font('Helvetica-Bold')
          .text(opord.classification, { align: 'center' });
      }

      // Exercise watermark (applied last, overlays content)
      if (options.exerciseMode) {
        addPdfExerciseWatermark(doc);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

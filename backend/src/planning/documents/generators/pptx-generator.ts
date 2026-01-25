/**
 * PowerPoint Briefing Generator
 *
 * Phase 05 Plan 09: Generate briefing slides for commander, staff, and rehearsal briefs
 * Uses PptxGenJS for PPTX generation
 */

import PptxGenJS from 'pptxgenjs';
import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';
import type { GeneratedDocument } from '../types.js';

// Use PptxGenJS namespace for table types
type TableCell = PptxGenJS.TableCell;

export type BriefingType = 'commander' | 'staff' | 'rehearsal';

export interface BriefingOptions {
  type: BriefingType;
  includeClassification?: boolean;
  includeBackupSlides?: boolean;
}

/**
 * Generate briefing slides for an operational plan
 */
export async function generateBriefingSlides(
  planId: string,
  options: BriefingOptions
): Promise<GeneratedDocument> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);

  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.author = 'BASTION Planning System';
  pptx.title = `${plan.name} - ${options.type.charAt(0).toUpperCase() + options.type.slice(1)} Brief`;
  pptx.subject = plan.planType;

  // Define master slide with classification
  const classification = plan.classification || 'UNCLASSIFIED';

  // Title Slide
  const titleSlide = pptx.addSlide();
  if (options.includeClassification !== false) {
    titleSlide.addText(classification, {
      x: 0, y: 0, w: '100%', h: 0.4,
      fontSize: 14, bold: true, color: '363636',
      align: 'center', valign: 'middle',
      fill: { color: classification === 'UNCLASSIFIED' ? '90EE90' : 'FF6347' },
    });
  }
  titleSlide.addText(plan.name, {
    x: 0.5, y: 2, w: 9, h: 1.5,
    fontSize: 40, bold: true, color: '003366',
    align: 'center',
  });
  titleSlide.addText(`${plan.planType} - ${options.type.toUpperCase()} BRIEF`, {
    x: 0.5, y: 3.5, w: 9, h: 0.5,
    fontSize: 24, color: '666666',
    align: 'center',
  });
  titleSlide.addText(new Date().toLocaleDateString(), {
    x: 0.5, y: 4.5, w: 9, h: 0.3,
    fontSize: 14, color: '666666',
    align: 'center',
  });

  // Situation Slide
  const sitSlide = pptx.addSlide();
  addClassificationBanner(sitSlide, classification, options.includeClassification);
  sitSlide.addText('SITUATION', {
    x: 0.5, y: 0.6, w: 9, h: 0.5,
    fontSize: 28, bold: true, color: '003366',
  });
  // Cast situation to any to access extended fields that may be present
  const enemyForces = plan.situation?.enemyForces as Record<string, unknown> | undefined;
  const friendlyForces = plan.situation?.friendlyForces as Record<string, unknown> | undefined;
  const sitPoints = [
    `Enemy: ${enemyForces?.composition || 'TBD'}`,
    `Enemy MLCOA: ${enemyForces?.mostLikelyCOA || 'TBD'}`,
    `Enemy MDCOA: ${enemyForces?.mostDangerousCOA || 'TBD'}`,
    `Friendly: ${friendlyForces?.higherHQ || 'TBD'}`,
    `Higher Intent: ${friendlyForces?.higherIntent || 'TBD'}`,
  ];
  sitSlide.addText(sitPoints.map(p => ({ text: p, options: { bullet: true } })), {
    x: 0.5, y: 1.3, w: 9, h: 4,
    fontSize: 18, color: '363636',
    valign: 'top',
  });

  // Mission Slide
  const msnSlide = pptx.addSlide();
  addClassificationBanner(msnSlide, classification, options.includeClassification);
  msnSlide.addText('MISSION', {
    x: 0.5, y: 0.6, w: 9, h: 0.5,
    fontSize: 28, bold: true, color: '003366',
  });
  const missionText = plan.mission
    ? `${plan.mission.who} ${plan.mission.what} ${plan.mission.when} ${plan.mission.where} ${plan.mission.why}`
    : 'Mission statement pending';
  msnSlide.addText(missionText, {
    x: 0.5, y: 2, w: 9, h: 2,
    fontSize: 22, color: '363636',
    align: 'center', valign: 'middle',
    fill: { color: 'FFFACD' },
    line: { color: '003366', width: 2 },
  });

  // COA Overview Slide (if commander brief)
  if (options.type === 'commander' && coas.length > 0) {
    const coaSlide = pptx.addSlide();
    addClassificationBanner(coaSlide, classification, options.includeClassification);
    coaSlide.addText('COURSES OF ACTION', {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });

    const coaData: TableCell[][] = coas.map(c => [
      { text: c.name },
      { text: c.comparisonScore ? `${c.comparisonScore.overallScore}/100` : 'Not scored' },
      { text: c.selected ? 'SELECTED' : '' },
    ]);

    coaSlide.addTable([
      [{ text: 'COA', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'Score', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'Status', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } }],
      ...coaData,
    ], {
      x: 0.5, y: 1.3, w: 9,
      fontSize: 14,
      border: { pt: 1, color: '003366' },
      rowH: 0.5,
    });
  }

  // Selected COA Detail Slide
  if (selectedCOA) {
    const coaDetailSlide = pptx.addSlide();
    addClassificationBanner(coaDetailSlide, classification, options.includeClassification);
    coaDetailSlide.addText(`SELECTED: ${selectedCOA.name}`, {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });
    coaDetailSlide.addText("Commander's Intent", {
      x: 0.5, y: 1.2, w: 9, h: 0.3,
      fontSize: 18, bold: true, color: '666666',
    });
    coaDetailSlide.addText([
      { text: `Purpose: ${selectedCOA.commandersIntent?.purpose || 'TBD'}`, options: { bullet: true } },
      { text: `Key Tasks: ${selectedCOA.commandersIntent?.keyTasks?.join(', ') || 'TBD'}`, options: { bullet: true } },
      { text: `End State: ${selectedCOA.commandersIntent?.endState || 'TBD'}`, options: { bullet: true } },
    ], {
      x: 0.5, y: 1.6, w: 9, h: 2,
      fontSize: 16, color: '363636',
    });
    coaDetailSlide.addText('Scheme of Maneuver', {
      x: 0.5, y: 3.8, w: 9, h: 0.3,
      fontSize: 18, bold: true, color: '666666',
    });
    coaDetailSlide.addText(selectedCOA.scheme || 'TBD', {
      x: 0.5, y: 4.2, w: 9, h: 1,
      fontSize: 14, color: '363636',
    });
  }

  // Tasks Slide
  if (selectedCOA && selectedCOA.tasks.length > 0) {
    const tasksSlide = pptx.addSlide();
    addClassificationBanner(tasksSlide, classification, options.includeClassification);
    tasksSlide.addText('TASKS TO SUBORDINATE UNITS', {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });

    const taskData: TableCell[][] = selectedCOA.tasks.map(t => [
      { text: t.unitId || 'TBD' },
      { text: t.task },
    ]);
    tasksSlide.addTable([
      [{ text: 'Unit', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'Task', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } }],
      ...taskData,
    ], {
      x: 0.5, y: 1.3, w: 9,
      fontSize: 12,
      border: { pt: 1, color: '003366' },
      rowH: 0.4,
      colW: [2, 7],
    });
  }

  // Risks Slide (staff brief)
  if (options.type === 'staff' && selectedCOA?.risks && selectedCOA.risks.length > 0) {
    const riskSlide = pptx.addSlide();
    addClassificationBanner(riskSlide, classification, options.includeClassification);
    riskSlide.addText('RISK ASSESSMENT', {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });

    const riskData: TableCell[][] = selectedCOA.risks.map(r => [
      { text: r.description },
      { text: r.likelihood || 'TBD' },
      { text: r.impact || 'TBD' },
      { text: r.mitigation || 'TBD' },
    ]);
    riskSlide.addTable([
      [{ text: 'Risk', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'L', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'I', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
       { text: 'Mitigation', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } }],
      ...riskData,
    ], {
      x: 0.5, y: 1.3, w: 9,
      fontSize: 11,
      border: { pt: 1, color: '003366' },
      rowH: 0.5,
      colW: [3, 0.8, 0.8, 4.4],
    });
  }

  // Rehearsal-specific slides
  if (options.type === 'rehearsal') {
    // Timeline Slide for rehearsal
    const timelineSlide = pptx.addSlide();
    addClassificationBanner(timelineSlide, classification, options.includeClassification);
    timelineSlide.addText('EXECUTION TIMELINE', {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });

    const phases = plan.execution?.conceptOfOperations?.phases || [];
    if (phases.length > 0) {
      const phaseData: TableCell[][] = phases.map((p, i) => [
        { text: `Phase ${i + 1}` },
        { text: p.name },
        { text: p.purpose },
      ]);
      timelineSlide.addTable([
        [{ text: '#', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
         { text: 'Phase', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } },
         { text: 'Purpose', options: { bold: true, fill: { color: '003366' }, color: 'FFFFFF' } }],
        ...phaseData,
      ], {
        x: 0.5, y: 1.3, w: 9,
        fontSize: 12,
        border: { pt: 1, color: '003366' },
        rowH: 0.5,
        colW: [1, 3, 5],
      });
    } else {
      timelineSlide.addText('Timeline TBD', {
        x: 0.5, y: 2.5, w: 9, h: 1,
        fontSize: 18, color: '666666',
        align: 'center',
      });
    }

    // Coordinating Instructions Slide
    const coordSlide = pptx.addSlide();
    addClassificationBanner(coordSlide, classification, options.includeClassification);
    coordSlide.addText('COORDINATING INSTRUCTIONS', {
      x: 0.5, y: 0.6, w: 9, h: 0.5,
      fontSize: 28, bold: true, color: '003366',
    });

    const instructions = plan.execution?.coordinatingInstructions || [];
    if (Array.isArray(instructions) && instructions.length > 0) {
      coordSlide.addText(instructions.map(inst => ({ text: String(inst), options: { bullet: true } })), {
        x: 0.5, y: 1.3, w: 9, h: 4,
        fontSize: 14, color: '363636',
        valign: 'top',
      });
    } else {
      coordSlide.addText('Coordinating instructions pending', {
        x: 0.5, y: 2.5, w: 9, h: 1,
        fontSize: 18, color: '666666',
        align: 'center',
      });
    }
  }

  // Questions Slide
  const qSlide = pptx.addSlide();
  addClassificationBanner(qSlide, classification, options.includeClassification);
  qSlide.addText('QUESTIONS?', {
    x: 0, y: 2.5, w: '100%', h: 1,
    fontSize: 48, bold: true, color: '003366',
    align: 'center',
  });

  // Generate buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  const filename = `${plan.name.replace(/\s+/g, '_')}_${options.type}_brief.pptx`;

  return {
    buffer,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: buffer.byteLength,
    generatedAt: new Date(),
  };
}

/**
 * Add classification banner to top and bottom of slide
 */
function addClassificationBanner(
  slide: PptxGenJS.Slide,
  classification: string,
  include?: boolean
): void {
  if (include === false) return;

  const fillColor = classification === 'UNCLASSIFIED' ? '90EE90' : 'FF6347';

  slide.addText(classification, {
    x: 0, y: 0, w: '100%', h: 0.35,
    fontSize: 12, bold: true, color: '363636',
    align: 'center', valign: 'middle',
    fill: { color: fillColor },
  });

  slide.addText(classification, {
    x: 0, y: 5.15, w: '100%', h: 0.35,
    fontSize: 12, bold: true, color: '363636',
    align: 'center', valign: 'middle',
    fill: { color: fillColor },
  });
}

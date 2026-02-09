/**
 * Briefing Slides Generator
 *
 * Phase 05 Plan 10: Generates PowerPoint briefing slides for commander/staff/rehearsal
 */

import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';
import type { GeneratedDocument } from '../types.js';

export interface BriefingOptions {
  type: 'commander' | 'staff' | 'rehearsal';
  includeGraphics?: boolean;
  includeTimeline?: boolean;
}

/**
 * Generate briefing slides as PPTX
 */
export async function generateBriefingSlides(
  planId: string,
  options: BriefingOptions
): Promise<GeneratedDocument> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);

  // Build briefing content based on type
  let content: string;
  switch (options.type) {
    case 'commander':
      content = buildCommanderBriefing(plan, selectedCOA);
      break;
    case 'staff':
      content = buildStaffBriefing(plan, coas);
      break;
    case 'rehearsal':
      content = buildRehearsalBriefing(plan, selectedCOA);
      break;
    default:
      content = buildCommanderBriefing(plan, selectedCOA);
  }

  // For now, return plain text as buffer until pptx library is integrated
  const buffer = Buffer.from(content, 'utf-8');

  return {
    buffer,
    filename: `${options.type.toUpperCase()}_BRIEF_${plan.name.replace(/\s+/g, '_')}.pptx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: buffer.length,
    generatedAt: new Date(),
  };
}

/**
 * Build commander's decision brief
 */
function buildCommanderBriefing(plan: any, selectedCOA: any): string {
  const slides: string[] = [];

  // Title slide
  slides.push('=== SLIDE 1: TITLE ===');
  slides.push(`Operation: ${plan.name}`);
  slides.push(`Classification: ${plan.classification}`);
  slides.push(`Commander's Decision Brief`);
  slides.push('');

  // Situation slide
  slides.push('=== SLIDE 2: SITUATION ===');
  slides.push('Current Situation:');
  slides.push(`- Area of Operations: ${plan.situation?.areaOfOperations || 'TBD'}`);
  slides.push(`- Enemy: ${plan.situation?.enemyForces?.composition || 'TBD'}`);
  slides.push(`- Friendly: ${plan.situation?.friendlyForces?.higherHQ || 'TBD'}`);
  slides.push('');

  // Mission slide
  slides.push('=== SLIDE 3: MISSION ===');
  if (plan.mission) {
    slides.push(`WHO: ${plan.mission.who}`);
    slides.push(`WHAT: ${plan.mission.what}`);
    slides.push(`WHEN: ${plan.mission.when}`);
    slides.push(`WHERE: ${plan.mission.where}`);
    slides.push(`WHY: ${plan.mission.why}`);
  }
  slides.push('');

  // Selected COA slide
  if (selectedCOA) {
    slides.push('=== SLIDE 4: SELECTED COURSE OF ACTION ===');
    slides.push(`COA ${selectedCOA.number}: ${selectedCOA.name}`);
    slides.push(`Scheme: ${selectedCOA.scheme}`);
    slides.push(`Decisive Operation: ${selectedCOA.decisiveOperation || 'TBD'}`);
    slides.push('');

    // Commander's Intent
    slides.push("=== SLIDE 5: COMMANDER'S INTENT ===");
    const intent = selectedCOA.commandersIntent;
    slides.push(`Purpose: ${intent?.purpose || 'TBD'}`);
    slides.push(`Key Tasks: ${intent?.keyTasks?.join(', ') || 'TBD'}`);
    slides.push(`End State: ${intent?.endState || 'TBD'}`);
  }

  return slides.join('\n');
}

/**
 * Build staff synchronization brief
 */
function buildStaffBriefing(plan: any, coas: any[]): string {
  const slides: string[] = [];

  // Title slide
  slides.push('=== SLIDE 1: TITLE ===');
  slides.push(`Operation: ${plan.name}`);
  slides.push('Staff Synchronization Brief');
  slides.push('');

  // COA comparison slide
  slides.push('=== SLIDE 2: COA COMPARISON ===');
  coas.forEach(coa => {
    slides.push(`COA ${coa.number}: ${coa.name}`);
    if (coa.comparisonScore) {
      slides.push(`  Overall Score: ${coa.comparisonScore.overallScore}`);
      slides.push(`  Ranking: ${coa.comparisonScore.ranking}`);
    }
    slides.push(`  Selected: ${coa.selected ? 'YES' : 'NO'}`);
    slides.push('');
  });

  // Timeline slide
  slides.push('=== SLIDE 3: SYNCHRONIZATION MATRIX ===');
  slides.push('Phase | Main Effort | Supporting Effort | Fires | Logistics');
  slides.push('--- | --- | --- | --- | ---');
  const phases = plan.execution?.conceptOfOperations?.phases || [];
  phases.forEach((phase: any) => {
    slides.push(`${phase.name} | ${phase.purpose} | TBD | TBD | TBD`);
  });

  return slides.join('\n');
}

/**
 * Build rehearsal brief
 */
function buildRehearsalBriefing(plan: any, selectedCOA: any): string {
  const slides: string[] = [];

  // Title slide
  slides.push('=== SLIDE 1: TITLE ===');
  slides.push(`Operation: ${plan.name}`);
  slides.push('Rehearsal Brief');
  slides.push('');

  // Tasks by unit
  slides.push('=== SLIDE 2: TASKS BY UNIT ===');
  if (selectedCOA?.tasks) {
    selectedCOA.tasks.forEach((task: any) => {
      slides.push(`${task.unitId}:`);
      slides.push(`  Task: ${task.task}`);
      slides.push(`  Purpose: ${task.purpose}`);
      slides.push('');
    });
  }

  // Timeline
  slides.push('=== SLIDE 3: TIMELINE ===');
  const phases = plan.execution?.conceptOfOperations?.phases || [];
  phases.forEach((phase: any, i: number) => {
    slides.push(`Phase ${i + 1}: ${phase.name}`);
    slides.push(`  Purpose: ${phase.purpose}`);
    phase.tasks?.forEach((t: string) => {
      slides.push(`  - ${t}`);
    });
    slides.push('');
  });

  return slides.join('\n');
}

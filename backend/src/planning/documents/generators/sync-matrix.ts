/**
 * Synchronization Matrix Generator
 *
 * Phase 05 Plan 09: Generate time-phased task matrices for operational planning
 * Displays unit tasks across phases with supporting warfighting functions
 */

import { planStore } from '../../stores/plan-store.js';
import { coaStore } from '../../stores/coa-store.js';

/**
 * Row in the synchronization matrix representing one time slice
 */
export interface SyncMatrixRow {
  time: string;
  phase: string;
  tasks: Array<{
    unit: string;
    task: string;
    status: 'planned' | 'contingent';
  }>;
  fires?: string;
  aviation?: string;
  logistics?: string;
  io?: string;
}

/**
 * Complete synchronization matrix
 */
export interface SyncMatrix {
  planId: string;
  planName: string;
  phases: string[];
  timeline: SyncMatrixRow[];
  units: string[];
  generatedAt: Date;
}

/**
 * Generate synchronization matrix from plan data
 */
export async function generateSyncMatrix(planId: string): Promise<SyncMatrix> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);
  if (!selectedCOA) throw new Error('No COA selected');

  // Extract unique units from tasks
  const units = Array.from(new Set(selectedCOA.tasks.map(t => t.unitId || 'TBD')));

  // Build phases from plan execution
  const conceptPhases = plan.execution?.conceptOfOperations?.phases || [];
  const phases = conceptPhases.length > 0
    ? conceptPhases.map(p => p.name)
    : [
        'Phase I - Shape',
        'Phase II - Seize',
        'Phase III - Exploit',
        'Phase IV - Transition',
      ];

  // Build timeline rows
  // In a real implementation, this would parse actual timing data from the plan
  const timeline: SyncMatrixRow[] = phases.map((phase, i) => ({
    time: `D+${i}`,
    phase,
    tasks: selectedCOA.tasks
      .filter((_, idx) => idx % phases.length === i) // Distribute tasks across phases
      .map(t => ({
        unit: t.unitId || 'TBD',
        task: t.task,
        status: 'planned' as const,
      })),
    fires: i === 0 ? 'Prep fires' : i === 1 ? 'Supporting fires' : 'On call',
    aviation: i === 1 ? 'CAS available' : 'On station',
    logistics: 'Push forward',
    io: 'Continue MISO',
  }));

  return {
    planId,
    planName: plan.name,
    phases,
    timeline,
    units,
    generatedAt: new Date(),
  };
}

/**
 * Export sync matrix as CSV for spreadsheet import
 */
export function syncMatrixToCSV(matrix: SyncMatrix): string {
  const headers = ['Time', 'Phase', ...matrix.units, 'Fires', 'Aviation', 'Logistics', 'IO'];

  const rows = matrix.timeline.map(row => {
    const unitTasks: Record<string, string> = {};
    row.tasks.forEach(t => {
      unitTasks[t.unit] = t.task;
    });

    return [
      row.time,
      row.phase,
      ...matrix.units.map(u => unitTasks[u] || ''),
      row.fires || '',
      row.aviation || '',
      row.logistics || '',
      row.io || '',
    ];
  });

  // Escape values and join with commas
  const escapeCSV = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return [headers, ...rows]
    .map(r => r.map(c => escapeCSV(c)).join(','))
    .join('\n');
}

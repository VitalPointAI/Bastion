/**
 * Strategic Import Service
 *
 * Phase 15 Plan 01: Import strategic objectives and commander's intent from
 * the Design tab stores into the Commander workspace as a strategic_guidance product.
 *
 * Uses direct store imports (NOT HTTP calls) per research pitfall #6.
 */

import { objectiveStore } from '../strategic/objectives/index.js';
import { intentStore } from '../strategic/intent/index.js';
import { StaffProductStore } from './staff-product-store.js';
import type { StaffProduct } from './types.js';

// ─── Service ──────────────────────────────────────────────────────────────────

export class StrategicImportService {
  private staffProductStore = new StaffProductStore();

  /**
   * Import approved strategic objectives and latest commander's intent into
   * the Commander workspace as a 'strategic_guidance' product.
   *
   * If a strategic_guidance product already exists for the Commander, it is
   * updated in place. Otherwise a new product is created.
   *
   * @param scenarioId  - The exercise scenario to import into
   * @param importedBy  - DID of the user triggering the import
   * @returns The created or updated staff product
   */
  async importToCommanderWorkspace(
    scenarioId: string,
    importedBy: string
  ): Promise<StaffProduct> {
    // 1. Fetch approved objectives from the Design tab store
    const objectivesResult = await objectiveStore.listObjectives({ status: 'APPROVED' });
    const objectives = objectivesResult.objectives;

    // 2. Fetch all commander intents and pick the most recently created one
    //    (IntentStore has getIntentsForObjective but not a global list, so we
    //     query the most recent across any objective that has approved status)
    let latestIntent = null;
    for (const objective of objectives) {
      const intents = await intentStore.getIntentsForObjective(objective.id);
      if (intents.length > 0) {
        const newest = intents[0]; // already ordered by issued_at DESC
        if (!latestIntent || newest.issuedAt > latestIntent.issuedAt) {
          latestIntent = newest;
        }
      }
    }

    // 3. Build structured JSON payload
    const structured: Record<string, unknown> = {
      objectiveCount: objectives.length,
      objectives: objectives.map((obj) => ({
        id: obj.id,
        description: obj.description,
        priority: obj.priority,
      })),
      intentId: latestIntent?.id ?? null,
    };

    // 4. Build formatted markdown narrative
    const objectivesMarkdown = objectives.length > 0
      ? objectives
          .map((obj, idx) => `${idx + 1}. **${obj.priority}** — ${obj.description}`)
          .join('\n')
      : '_No approved objectives found in Design tab._';

    const intentMarkdown = latestIntent
      ? [
          `**Purpose:** ${latestIntent.purpose}`,
          `**Key Tasks:** ${latestIntent.keyTasks.join('; ')}`,
          `**End State:** ${latestIntent.endState}`,
        ].join('\n\n')
      : '_No commander\'s intent found in Design tab._';

    const content = [
      '## Strategic Guidance (Imported from Design Tab)',
      '',
      '### Strategic Objectives',
      objectivesMarkdown,
      '',
      "### Commander's Intent",
      intentMarkdown,
    ].join('\n');

    // 5. Upsert: update existing product or create new one
    const existing = await this.staffProductStore.findOne(
      scenarioId,
      'commander',
      'strategic_guidance'
    );

    if (existing) {
      return await this.staffProductStore.update(existing.id, {
        title: 'Strategic Guidance (Design Tab Import)',
        structured,
        content,
      });
    }

    return await this.staffProductStore.create({
      scenarioId,
      roleKey: 'commander',
      productType: 'strategic_guidance',
      title: 'Strategic Guidance (Design Tab Import)',
      structured,
      content,
      createdBy: importedBy,
    });
  }
}

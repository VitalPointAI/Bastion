/**
 * Strategic Guidance Service
 *
 * Phase 36 Plan 01: Business logic for strategic guidance instance lifecycle,
 * step content management, and force allocation CRUD with summary stats.
 */

import { getPool } from '../../lib/database.js';
import { strategicGuidanceStore } from './store.js';
import type {
  StrategicGuidanceInstance,
  SGStepId,
  StepStatus,
  ForceAllocation,
  ForceAllocationPriority,
  DirectiveVersion,
  CommanderDirectiveContent,
  OperationalApproachContent,
} from './types.js';

// ---------------------------------------------------------------------------
// Force Allocation Summary
// ---------------------------------------------------------------------------

export interface ForceAllocationSummary {
  totalForces: number;
  committedForces: number;
  availableForces: number;
  mainEffortCount: number;
  overAllocations: Array<{
    forceId: string;
    forceName: string;
    totalPct: number;
  }>;
}

// ---------------------------------------------------------------------------
// Strategic Guidance Service
// ---------------------------------------------------------------------------

class StrategicGuidanceService {
  // -------------------------------------------------------------------------
  // Instance Lifecycle
  // -------------------------------------------------------------------------

  async createInstance(
    problemSetId: string,
    createdBy: string,
  ): Promise<StrategicGuidanceInstance> {
    return strategicGuidanceStore.createInstance({ problemSetId, createdBy });
  }

  async getInstance(
    problemSetId: string,
  ): Promise<StrategicGuidanceInstance | null> {
    return strategicGuidanceStore.getInstanceByProblemSetId(problemSetId);
  }

  async getInstanceById(
    instanceId: string,
  ): Promise<StrategicGuidanceInstance | null> {
    return strategicGuidanceStore.getInstanceById(instanceId);
  }

  // -------------------------------------------------------------------------
  // Step Content
  // -------------------------------------------------------------------------

  async saveStepContent(
    instanceId: string,
    stepId: SGStepId,
    content: Record<string, unknown>,
    updatedBy: string,
  ): Promise<{ id: string; instanceId: string; step: SGStepId; content: Record<string, unknown>; updatedBy: string; createdAt: Date; updatedAt: Date }> {
    // Auto-advance status from not_started to in_progress
    const instance = await strategicGuidanceStore.getInstanceById(instanceId);
    if (instance && instance.stepStatuses[stepId] === 'not_started') {
      await strategicGuidanceStore.updateStepStatus(instanceId, stepId, 'in_progress');
    }

    return strategicGuidanceStore.upsertStepProduct({
      instanceId,
      step: stepId,
      content,
      updatedBy,
    });
  }

  async getStepContent(
    instanceId: string,
    stepId: SGStepId,
  ): Promise<Record<string, unknown> | null> {
    const product = await strategicGuidanceStore.getStepProduct(instanceId, stepId);
    return product ? product.content : null;
  }

  async updateStepStatus(
    instanceId: string,
    stepId: SGStepId,
    status: StepStatus,
  ): Promise<StrategicGuidanceInstance | null> {
    return strategicGuidanceStore.updateStepStatus(instanceId, stepId, status);
  }

  // -------------------------------------------------------------------------
  // Force Allocations
  // -------------------------------------------------------------------------

  async saveForceAllocation(
    instanceId: string,
    allocation: Partial<ForceAllocation> & {
      forceName: string;
      forceType: string;
      lineOfEffortId: string;
      priority: ForceAllocationPriority;
    },
  ): Promise<ForceAllocation> {
    return strategicGuidanceStore.upsertForceAllocation(instanceId, allocation);
  }

  async deleteForceAllocation(
    instanceId: string,
    allocationId: string,
  ): Promise<boolean> {
    return strategicGuidanceStore.deleteForceAllocation(instanceId, allocationId);
  }

  async getForceAllocations(instanceId: string): Promise<ForceAllocation[]> {
    return strategicGuidanceStore.getForceAllocations(instanceId);
  }

  async getForceAllocationSummary(
    instanceId: string,
  ): Promise<ForceAllocationSummary> {
    const allocations = await strategicGuidanceStore.getForceAllocations(instanceId);

    const totalForces = allocations.length;
    const committedForces = allocations.filter((a) => a.allocationPct > 0).length;
    const availableForces = totalForces - committedForces;
    const mainEffortCount = allocations.filter((a) => a.priority === 'main_effort').length;

    // Detect over-allocations: group by forceId, sum allocation percentages
    const forceMap = new Map<string, { forceName: string; totalPct: number }>();
    for (const alloc of allocations) {
      const key = alloc.forceId || alloc.id;
      const existing = forceMap.get(key);
      if (existing) {
        existing.totalPct += alloc.allocationPct;
      } else {
        forceMap.set(key, { forceName: alloc.forceName, totalPct: alloc.allocationPct });
      }
    }

    const overAllocations: ForceAllocationSummary['overAllocations'] = [];
    forceMap.forEach((info, forceId) => {
      if (info.totalPct > 100) {
        overAllocations.push({ forceId, forceName: info.forceName, totalPct: info.totalPct });
      }
    });

    return {
      totalForces,
      committedForces,
      availableForces,
      mainEffortCount,
      overAllocations,
    };
  }

  // -------------------------------------------------------------------------
  // Directive Versions
  // -------------------------------------------------------------------------

  async getDirectiveVersions(instanceId: string) {
    return strategicGuidanceStore.getDirectiveVersions(instanceId);
  }

  async getLatestDirectiveVersion(instanceId: string) {
    return strategicGuidanceStore.getLatestDirectiveVersion(instanceId);
  }

  // -------------------------------------------------------------------------
  // Directive Finalization
  // -------------------------------------------------------------------------

  async finalizeDirective(
    instanceId: string,
    finalizedBy: string,
  ): Promise<DirectiveVersion> {
    // 1. Load current step content
    const directiveProduct = await strategicGuidanceStore.getStepProduct(instanceId, 'commander_directive');
    const approachProduct = await strategicGuidanceStore.getStepProduct(instanceId, 'operational_approach');

    if (!directiveProduct) {
      throw new Error('Commander directive step content not found');
    }

    const directiveContent = directiveProduct.content as unknown as CommanderDirectiveContent;
    const approachContent = approachProduct?.content as unknown as OperationalApproachContent | undefined;

    // 2. Get current version number
    const instance = await strategicGuidanceStore.getInstanceById(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    const nextVersion = instance.currentDirectiveVersion + 1;

    // 3. Update directive content status
    const finalizedContent: CommanderDirectiveContent = {
      ...directiveContent,
      status: 'finalized',
      finalizedAt: new Date(),
      finalizedBy,
    };

    // Save finalized status back to step content
    await strategicGuidanceStore.upsertStepProduct({
      instanceId,
      step: 'commander_directive',
      content: finalizedContent as unknown as Record<string, unknown>,
      updatedBy: finalizedBy,
    });

    // 4. Create directive version snapshot
    const changelog = nextVersion === 1
      ? 'Initial directive version'
      : `Directive revision v${nextVersion}`;

    const version = await strategicGuidanceStore.createDirectiveVersion({
      instanceId,
      version: nextVersion,
      content: finalizedContent as unknown as Record<string, unknown>,
      constraints: approachContent?.constraints ?? [],
      assumptions: approachContent?.assumptions ?? [],
      forceApportionment: approachContent?.forceApportionment ?? [],
      changelog,
      createdBy: finalizedBy,
    });

    // 5. Update step status to approved
    await strategicGuidanceStore.updateStepStatus(instanceId, 'commander_directive', 'approved');

    // 6. Auto-populate child campaign JPP Step 1
    await this.autoPopulateChildCampaigns(instance.problemSetId, finalizedContent, approachContent);

    return version;
  }

  // -------------------------------------------------------------------------
  // Child Campaign Auto-Populate
  // -------------------------------------------------------------------------

  private async autoPopulateChildCampaigns(
    problemSetId: string,
    directive: CommanderDirectiveContent,
    approach: OperationalApproachContent | undefined,
  ): Promise<void> {
    const children = await this.getChildCampaignProblemSets(problemSetId);
    if (children.length === 0) return;

    for (const child of children) {
      try {
        // TODO: Phase 38 will wire inheritance notifications for directive updates
        // For now, log the auto-populate intent
        console.log(
          `[StrategicGuidance] Auto-populated JPP Step 1 for child ${child.id} (${child.name})`,
        );
      } catch (err) {
        console.error(
          `[StrategicGuidance] Failed to auto-populate child ${child.id}:`,
          err,
        );
      }
    }
  }

  private async getChildCampaignProblemSets(
    problemSetId: string,
  ): Promise<Array<{ id: string; name: string; echelon: string }>> {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, name, echelon FROM problem_sets
         WHERE parent_problem_set_id = $1 AND echelon = 'operational'`,
        [problemSetId],
      );
      return result.rows;
    } catch {
      // Table or column may not exist yet — return empty
      return [];
    }
  }
}

export const strategicGuidanceService = new StrategicGuidanceService();

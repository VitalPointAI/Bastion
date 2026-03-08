/**
 * Mission Creation Service
 *
 * Phase 35 Plan 02: Orchestrator for full mission creation flow.
 * Turns an OPORD task assignment into a fully-initialized tactical problem set
 * with MDMP at Receipt of Mission, auto-drafted WARNO, inherited context
 * snapshot, and member invites.
 *
 * Orchestration steps:
 * 1. Create tactical problem set
 * 2. Assign members per confirmation modal selections
 * 3. Create inheritance chain
 * 4. Set mission metadata
 * 5. Initialize MDMP workflow
 * 6. Store mission assignment snapshot
 * 7. Auto-draft WARNO
 * 8. Log activity
 */

import { problemSetStore } from '../problem-set/problem-set-store.js';
import { problemSetMemberStore } from '../problem-set/problem-set-member-store.js';
import { inheritanceService } from '../inheritance/inheritance-service.js';
import { mdmpWorkflowService } from '../mdmp/workflow-service.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import { missionCreationStore } from './mission-creation-store.js';
import { getPool } from '../lib/database.js';
import type {
  CreateMissionInput,
  MissionCreationResult,
  CommandersIntentChain,
  CommandersIntentSnapshot,
  WARNODraft,
  RoleAssignment,
} from './mission-creation-types.js';

// ─── Mission Creation Service ───────────────────────────────────────────────

class MissionCreationService {

  /**
   * Create a fully-initialized tactical mission from an OPORD task assignment.
   *
   * Performs 8 orchestration steps: PS creation, member assignment, inheritance,
   * metadata, MDMP workflow, assignment snapshot, WARNO draft, activity log.
   */
  async createMissionFromOPORD(
    input: CreateMissionInput,
    createdBy: string,
  ): Promise<MissionCreationResult> {
    // Step 1: Create tactical problem set
    const ps = await problemSetStore.createProblemSet(
      {
        name: input.missionName,
        description: input.missionStatement,
        echelon: 'tactical',
        classification: input.classification,
        parentProblemSetId: input.parentProblemSetId,
        mode: input.mode as 'training' | 'operational',
      },
      createdBy,
    );

    // Step 2: Assign members per confirmation modal selections
    // CRITICAL: Do NOT auto-assign creator as commander. Creator may be J3/G3 staff.
    let membersInvited = 0;
    for (const assignment of input.roleAssignments) {
      try {
        await problemSetMemberStore.addMember(
          ps.id,
          assignment.did,
          assignment.role,
          assignment.daoRole,
          createdBy,
        );
        membersInvited++;
      } catch (err) {
        // For AI agents, the on-chain DAO add_member call may fail.
        // The off-chain membership record is what matters.
        if (assignment.isAgent) {
          console.warn(
            `[MissionCreation] Agent DAO membership may have failed for ${assignment.did}, off-chain record attempted:`,
            (err as Error).message,
          );
        } else {
          console.error(
            `[MissionCreation] Failed to add member ${assignment.did}:`,
            (err as Error).message,
          );
        }
      }
    }

    // Step 3: Create inheritance chain
    try {
      await inheritanceService.createInheritanceChain(
        ps.id,
        input.parentProblemSetId,
        createdBy,
      );
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to create inheritance chain:',
        (err as Error).message,
      );
    }

    // Step 4: Set mission metadata
    try {
      await missionCreationStore.setMissionMetadata(ps.id, {
        areaOfOperations: input.areaOfOperations,
        missionState: 'planning',
        activatedAt: null,
        completedAt: null,
      });
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to set mission metadata:',
        (err as Error).message,
      );
    }

    // Step 5: Initialize MDMP workflow
    let workflowCreated = false;
    try {
      await mdmpWorkflowService.createWorkflow({
        missionId: ps.id,
        daoId: ps.daoId,
        createdBy,
      });
      workflowCreated = true;
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to create MDMP workflow:',
        (err as Error).message,
      );
    }

    // Step 6: Store mission assignment snapshot (8 doctrinal fields)
    const assignment = await missionCreationStore.createMissionAssignment({
      sourceOpordPsId: input.parentProblemSetId,
      targetProblemSetId: ps.id,
      taskIds: input.taskIds,
      taskStatement: input.taskStatement,
      purpose: input.purpose,
      commandersIntent: input.commandersIntent as unknown as Record<string, unknown>,
      taskOrganization: input.taskOrganization,
      constraints: input.constraints,
      ccirs: input.ccirs,
      roeReferences: input.roeReferences,
      areaOfOperations: input.areaOfOperations as unknown as Record<string, unknown>,
      timeline: input.timeline,
      createdBy,
    });

    // Step 7: Auto-draft WARNO
    let warnoDrafted = false;
    try {
      warnoDrafted = await this.draftWarno(ps.id, input, assignment.id, createdBy);
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to draft WARNO:',
        (err as Error).message,
      );
    }

    // Step 8: Log activity
    try {
      await problemSetActivityStore.log(
        ps.id,
        'mission_created',
        createdBy,
        null,
        {
          sourceOpordPsId: input.parentProblemSetId,
          taskIds: input.taskIds,
        },
      );
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to log mission_created activity:',
        (err as Error).message,
      );
    }

    return {
      problemSet: ps,
      missionAssignmentId: assignment.id,
      workflowCreated,
      warnoDrafted,
      membersInvited,
    };
  }

  /**
   * Resolve commander's intent 2 levels up by walking parentProblemSetId chain.
   *
   * Returns intent snapshots from own level, parent, and grandparent.
   * Gracefully handles missing levels or absent JPP products.
   */
  async resolveCommandersIntent2Up(
    problemSetId: string,
  ): Promise<CommandersIntentChain> {
    const chain: CommandersIntentChain = {
      own: null,
      parent: null,
      grandparent: null,
    };

    const levels: Array<keyof CommandersIntentChain> = ['own', 'parent', 'grandparent'];
    let currentPsId: string | null = problemSetId;

    for (const level of levels) {
      if (!currentPsId) break;

      try {
        const ps = await problemSetStore.getProblemSet(currentPsId);
        if (!ps) break;

        const snapshot = await this.getCommandersIntentSnapshot(currentPsId, ps.name);
        chain[level] = snapshot;

        currentPsId = ps.parentProblemSetId;
      } catch (err) {
        console.warn(
          `[MissionCreation] Failed to resolve commander's intent at level ${level}:`,
          (err as Error).message,
        );
        break;
      }
    }

    return chain;
  }

  /**
   * After parent OPORD saves, notify all child problem sets of the update.
   *
   * Checks for linked mission_assignments and logs activity to each child PS.
   */
  async notifyChildrenOfOPORDUpdate(
    parentPsId: string,
    actorDid: string,
    changedFields: string[],
  ): Promise<void> {
    try {
      const assignments = await missionCreationStore.getAssignmentsBySource(parentPsId);

      for (const assignment of assignments) {
        try {
          await problemSetActivityStore.log(
            assignment.targetProblemSetId,
            'parent_opord_updated',
            actorDid,
            null,
            {
              sourceOpordPsId: parentPsId,
              updatedFields: changedFields,
            },
          );
        } catch (err) {
          console.error(
            `[MissionCreation] Failed to notify child PS ${assignment.targetProblemSetId} of OPORD update:`,
            (err as Error).message,
          );
        }
      }
    } catch (err) {
      console.error(
        '[MissionCreation] Failed to get assignments for OPORD update notification:',
        (err as Error).message,
      );
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Auto-draft WARNO from inherited context and store as activity log entry.
   */
  private async draftWarno(
    psId: string,
    input: CreateMissionInput,
    assignmentId: string,
    createdBy: string,
  ): Promise<boolean> {
    // Build succession list from role assignments (commander first, then xo)
    const succession: string[] = [];
    const commander = input.roleAssignments.find(
      (r: RoleAssignment) => r.role === 'commander',
    );
    if (commander) succession.push(commander.displayName);
    const xo = input.roleAssignments.find(
      (r: RoleAssignment) => r.role === 'xo',
    );
    if (xo) succession.push(xo.displayName);

    const warno: WARNODraft = {
      situation: input.missionStatement,
      mission: input.taskStatement,
      generalInstructions: {
        timeline: 'Timeline TBD pending mission analysis',
        initialCoordination: 'Report to parent PS for coordination',
        movementInstructions: 'Movement instructions TBD',
      },
      serviceSupport: 'IAW parent OPORD Para 4',
      commandSignal: {
        commandPost: 'TBD',
        succession,
        frequency: 'IAW parent OPORD Annex H',
      },
      draftedAt: new Date().toISOString(),
      status: 'draft',
      reviewedBy: null,
      approvedBy: null,
    };

    // Store as activity log entry
    await problemSetActivityStore.log(
      psId,
      'warno_drafted',
      createdBy,
      null,
      { warno },
    );

    // Mark assignment WARNO as drafted
    await missionCreationStore.markWarnoAsDrafted(assignmentId);

    return true;
  }

  /**
   * Get commander's intent snapshot for a problem set by querying JPP step products.
   *
   * Returns null if no JPP instance or step 2 product exists for this PS.
   */
  private async getCommandersIntentSnapshot(
    psId: string,
    psName: string,
  ): Promise<CommandersIntentSnapshot | null> {
    try {
      const pool = getPool();

      // Find JPP instance for this problem set
      const instanceResult = await pool.query(
        'SELECT id FROM jpp_instances WHERE problem_set_id = $1 LIMIT 1',
        [psId],
      );

      if (instanceResult.rows.length === 0) return null;

      const jppInstanceId = instanceResult.rows[0].id;

      // Get step 2 (Mission Analysis) products that may contain commander's intent
      const productResult = await pool.query(
        `SELECT content FROM jpp_step_products
         WHERE jpp_instance_id = $1 AND step = 'step2'
         ORDER BY updated_at DESC LIMIT 1`,
        [jppInstanceId],
      );

      if (productResult.rows.length === 0) return null;

      const content = productResult.rows[0].content;
      if (!content) return null;

      // Extract commander's intent fields from content
      // Content structure varies, so handle gracefully
      const intent = content.commandersIntent ?? content.commanders_intent ?? content;

      return {
        psId,
        psName,
        endState: intent.endState ?? intent.end_state ?? '',
        purpose: intent.purpose ?? '',
        keyTasks: intent.keyTasks ?? intent.key_tasks ?? [],
        constraints: intent.constraints ?? [],
      };
    } catch {
      // Strategic PSs may not have JPP instances — return null gracefully
      return null;
    }
  }
}

export const missionCreationService = new MissionCreationService();
export { MissionCreationService };

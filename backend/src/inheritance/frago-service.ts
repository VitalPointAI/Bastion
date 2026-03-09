/**
 * FRAGO Service
 *
 * Phase 38 Plan 03: OPORD change detection, AI FRAGO drafting, and
 * FRAGO lifecycle management (approve, distribute, acknowledge).
 *
 * Detects paragraph-level changes in OPORDs, uses AI to draft FRAGOs
 * for affected child missions, and manages the commander review cycle.
 *
 * Flow: OPORD updated -> detectOpordChanges -> draftFRAGO per child ->
 *       commander approves/edits -> distribute -> child acknowledges
 */

import { randomUUID } from 'crypto';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { inheritanceStore } from './inheritance-store.js';
import { missionCreationStore } from '../mission-creation/mission-creation-store.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import type { OPORDStructure } from '../planning/documents/templates/opord-template.js';
import type { FRAGODraft, OpordChangeDetail } from './inheritance-types.js';
import { FRAGO_STATUS } from './inheritance-types.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// ============================================================================
// OPORD Paragraph-Level Diff
// ============================================================================

/**
 * Normalize a value for comparison: trim strings, sort arrays, stringify objects.
 * This avoids false positives from formatting differences (whitespace, array order).
 */
function normalizeForComparison(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ');
  }
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeForComparison).sort();
    return JSON.stringify(normalized);
  }
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = normalizeForComparison((value as Record<string, unknown>)[key]);
    }
    return JSON.stringify(sorted);
  }
  return String(value);
}

/**
 * Summarize what changed in a paragraph by comparing field-level diffs.
 */
function summarizeParagraphChange(
  paragraph: number,
  previous: unknown,
  current: unknown,
): string {
  if (typeof previous === 'string' && typeof current === 'string') {
    return `Paragraph ${paragraph} text changed`;
  }

  if (typeof previous === 'object' && typeof current === 'object' && previous && current) {
    const prevObj = previous as Record<string, unknown>;
    const currObj = current as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);
    const changedKeys: string[] = [];

    for (const key of allKeys) {
      if (normalizeForComparison(prevObj[key]) !== normalizeForComparison(currObj[key])) {
        changedKeys.push(key);
      }
    }

    if (changedKeys.length === 0) {
      return `Paragraph ${paragraph} updated`;
    }
    return `Paragraph ${paragraph} changed: ${changedKeys.join(', ')}`;
  }

  return `Paragraph ${paragraph} updated`;
}

// ============================================================================
// FRAGO Service Class
// ============================================================================

export class FRAGOService {
  /**
   * Detect OPORD changes at paragraph level by deep-comparing each of the
   * 5 standard paragraphs. Returns only changed paragraphs.
   *
   * Severity rules:
   * - Paragraphs 2 (Mission), 3 (Execution), 4 (Sustainment) = 'significant'
   * - Paragraphs 1 (Situation), 5 (Command/Signal) = 'minor'
   */
  detectOpordChanges(
    previous: OPORDStructure,
    current: OPORDStructure,
  ): OpordChangeDetail[] {
    const changes: OpordChangeDetail[] = [];

    // Paragraph 1: Situation
    if (normalizeForComparison(previous.paragraph1_Situation) !== normalizeForComparison(current.paragraph1_Situation)) {
      changes.push({
        paragraph: 1,
        severity: 'minor',
        summary: summarizeParagraphChange(1, previous.paragraph1_Situation, current.paragraph1_Situation),
      });
    }

    // Paragraph 2: Mission
    if (normalizeForComparison(previous.paragraph2_Mission) !== normalizeForComparison(current.paragraph2_Mission)) {
      changes.push({
        paragraph: 2,
        severity: 'significant',
        summary: summarizeParagraphChange(2, previous.paragraph2_Mission, current.paragraph2_Mission),
      });
    }

    // Paragraph 3: Execution
    if (normalizeForComparison(previous.paragraph3_Execution) !== normalizeForComparison(current.paragraph3_Execution)) {
      changes.push({
        paragraph: 3,
        severity: 'significant',
        summary: summarizeParagraphChange(3, previous.paragraph3_Execution, current.paragraph3_Execution),
      });
    }

    // Paragraph 4: Sustainment
    if (normalizeForComparison(previous.paragraph4_Sustainment) !== normalizeForComparison(current.paragraph4_Sustainment)) {
      changes.push({
        paragraph: 4,
        severity: 'significant',
        summary: summarizeParagraphChange(4, previous.paragraph4_Sustainment, current.paragraph4_Sustainment),
      });
    }

    // Paragraph 5: Command and Signal
    if (normalizeForComparison(previous.paragraph5_CommandSignal) !== normalizeForComparison(current.paragraph5_CommandSignal)) {
      changes.push({
        paragraph: 5,
        severity: 'minor',
        summary: summarizeParagraphChange(5, previous.paragraph5_CommandSignal, current.paragraph5_CommandSignal),
      });
    }

    return changes;
  }

  // ==========================================================================
  // AI FRAGO Drafting
  // ==========================================================================

  /**
   * Use LLM to draft a FRAGO based on OPORD changes for a specific child mission.
   * Returns the AI-generated FRAGO text formatted per FM 5-0 FRAGO standard.
   */
  async draftFRAGO(
    parentPsId: string,
    childPsId: string,
    changes: OpordChangeDetail[],
    previousOpord: Partial<OPORDStructure>,
    currentOpord: Partial<OPORDStructure>,
    childMissionStatement: string,
  ): Promise<string> {
    const llm = await this.getLLM();

    const systemPrompt = `You are a military staff officer drafting a Fragmentary Order (FRAGO). Given changes between a previous and updated OPORD, draft a FRAGO that:
(1) States which paragraphs changed
(2) Summarizes each change concisely
(3) States implications for the subordinate mission
(4) Provides updated guidance or tasks as applicable

Format per FM 5-0 FRAGO standard. Include:
- FRAGO number placeholder
- DTG placeholder
- References to parent OPORD
- Changed paragraph content (before/after summary)
- Impact assessment for subordinate unit
- Required actions

Keep the language concise, directive, and doctrinally correct.`;

    const changedParagraphDetails = changes.map((change) => {
      const paragraphNames: Record<number, string> = {
        1: 'Situation',
        2: 'Mission',
        3: 'Execution',
        4: 'Sustainment',
        5: 'Command and Signal',
      };

      const name = paragraphNames[change.paragraph] ?? `Paragraph ${change.paragraph}`;
      const prevKey = this.getParagraphKey(change.paragraph);
      const prevValue = prevKey ? (previousOpord as Record<string, unknown>)[prevKey] : undefined;
      const currValue = prevKey ? (currentOpord as Record<string, unknown>)[prevKey] : undefined;

      return `### ${name} (Paragraph ${change.paragraph}) - ${change.severity.toUpperCase()}
Change Summary: ${change.summary}
Previous: ${JSON.stringify(prevValue, null, 2)?.substring(0, 1500) ?? 'N/A'}
Current: ${JSON.stringify(currValue, null, 2)?.substring(0, 1500) ?? 'N/A'}`;
    }).join('\n\n');

    const userPrompt = `Draft a FRAGO for the following OPORD changes.

Parent Problem Set ID: ${parentPsId}
Child Problem Set ID: ${childPsId}
Child Mission Statement: ${childMissionStatement}

## Changed Paragraphs

${changedParagraphDetails}

Draft the FRAGO now.`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return content;
  }

  // ==========================================================================
  // FRAGO Lifecycle Orchestration
  // ==========================================================================

  /**
   * Called when a parent OPORD is updated. Detects changes, drafts FRAGOs
   * for all affected child missions, and stores draft records.
   *
   * Returns array of created FRAGO drafts (empty if no changes detected).
   */
  async onOpordUpdated(
    parentPsId: string,
    previousOpord: OPORDStructure,
    currentOpord: OPORDStructure,
    opordVersion: string,
    previousVersion: string,
  ): Promise<FRAGODraft[]> {
    // Detect changes
    const changes = this.detectOpordChanges(previousOpord, currentOpord);

    if (changes.length === 0) {
      return [];
    }

    // Get all child mission assignments for parent PS
    const assignments = await missionCreationStore.getAssignmentsBySource(parentPsId);

    if (assignments.length === 0) {
      return [];
    }

    const changedParagraphs = changes.map((c) => c.paragraph);
    const drafts: FRAGODraft[] = [];

    for (const assignment of assignments) {
      try {
        // Draft FRAGO via AI
        const aiContent = await this.draftFRAGO(
          parentPsId,
          assignment.targetProblemSetId,
          changes,
          previousOpord,
          currentOpord,
          assignment.taskStatement || 'No mission statement available',
        );

        // Create FRAGO draft record
        const draft = await inheritanceStore.createFRAGODraft({
          id: `FRAGO-${randomUUID()}`,
          parentProblemSetId: parentPsId,
          childProblemSetId: assignment.targetProblemSetId,
          sourceOpordVersion: opordVersion,
          previousOpordVersion: previousVersion,
          changedParagraphs,
          aiDraftContent: aiContent,
          status: FRAGO_STATUS.draft,
          approvedBy: null,
          editedContent: null,
          distributedAt: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
        });

        drafts.push(draft);
      } catch (error) {
        console.error(
          `[frago] Failed to draft FRAGO for child ${assignment.targetProblemSetId}:`,
          error instanceof Error ? error.message : error,
        );
        // Continue with other children even if one fails
      }
    }

    // Log activity for parent PS
    try {
      await problemSetActivityStore.log(
        parentPsId,
        'frago_drafts_generated',
        'system',
        null,
        {
          childCount: drafts.length,
          changedParagraphs,
          opordVersion,
          message: `FRAGO drafts generated for ${drafts.length} child missions`,
        },
      );
    } catch (error) {
      console.error('[frago] Failed to log activity:', error);
    }

    return drafts;
  }

  /**
   * Commander approves a FRAGO draft, optionally with edited content.
   */
  async approveFRAGO(
    fragoId: string,
    approvedBy: string,
    editedContent?: string,
  ): Promise<void> {
    // If commander edited the content, update it first
    if (editedContent !== undefined) {
      await inheritanceStore.updateFRAGOContent(fragoId, editedContent);
    }

    // Update status to approved
    await inheritanceStore.updateFRAGOStatus(fragoId, FRAGO_STATUS.approved, {
      approvedBy,
    });
  }

  /**
   * Distribute an approved FRAGO to the child problem set.
   * FRAGO must be in 'approved' status.
   */
  async distributeFRAGO(fragoId: string): Promise<void> {
    const frago = await inheritanceStore.getFRAGODraft(fragoId);
    if (!frago) {
      throw new Error(`FRAGO not found: ${fragoId}`);
    }

    if (frago.status !== FRAGO_STATUS.approved) {
      throw new Error(`FRAGO must be approved before distribution. Current status: ${frago.status}`);
    }

    // Update status to distributed
    await inheritanceStore.updateFRAGOStatus(fragoId, FRAGO_STATUS.distributed, {
      distributedAt: new Date(),
    });

    // Log activity for child PS
    try {
      const changeSummary = frago.changedParagraphs.map((p) => `Para ${p}`).join(', ');
      await problemSetActivityStore.log(
        frago.childProblemSetId,
        'frago_received',
        'system',
        null,
        {
          fragoId,
          parentProblemSetId: frago.parentProblemSetId,
          changedParagraphs: frago.changedParagraphs,
          message: `FRAGO received from parent: changes to ${changeSummary}`,
        },
      );
    } catch (error) {
      console.error('[frago] Failed to log distribution activity:', error);
    }
  }

  /**
   * Child commander acknowledges receipt and understanding of a FRAGO.
   * FRAGO must be in 'distributed' status.
   */
  async acknowledgeFRAGO(
    fragoId: string,
    acknowledgedBy: string,
  ): Promise<void> {
    const frago = await inheritanceStore.getFRAGODraft(fragoId);
    if (!frago) {
      throw new Error(`FRAGO not found: ${fragoId}`);
    }

    if (frago.status !== FRAGO_STATUS.distributed) {
      throw new Error(`FRAGO must be distributed before acknowledgment. Current status: ${frago.status}`);
    }

    // Update status to acknowledged
    await inheritanceStore.updateFRAGOStatus(fragoId, FRAGO_STATUS.acknowledged, {
      acknowledgedBy,
      acknowledgedAt: new Date(),
    });

    // Log activity for parent PS
    try {
      await problemSetActivityStore.log(
        frago.parentProblemSetId,
        'frago_acknowledged',
        acknowledgedBy,
        null,
        {
          fragoId,
          childProblemSetId: frago.childProblemSetId,
          message: `FRAGO acknowledged by child mission ${frago.childProblemSetId}`,
        },
      );
    } catch (error) {
      console.error('[frago] Failed to log acknowledgment activity:', error);
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get the OPORDStructure property key for a paragraph number.
   */
  private getParagraphKey(paragraph: number): string | null {
    const keyMap: Record<number, string> = {
      1: 'paragraph1_Situation',
      2: 'paragraph2_Mission',
      3: 'paragraph3_Execution',
      4: 'paragraph4_Sustainment',
      5: 'paragraph5_CommandSignal',
    };
    return keyMap[paragraph] ?? null;
  }

  /**
   * Get LLM instance for FRAGO drafting.
   * Falls back to default agent config if 'frago-drafter' is not configured.
   */
  private async getLLM() {
    try {
      return await createLLMForAgent({
        agentId: 'frago-drafter',
        overrides: { temperature: 0.3, maxTokens: 4096 },
      });
    } catch (error) {
      console.warn(
        '[frago] Could not create LLM for frago-drafter agent, using default config:',
        error instanceof Error ? error.message : error,
      );
      return await createLLMForAgent({
        agentId: 'default',
        overrides: { temperature: 0.3, maxTokens: 4096 },
      });
    }
  }
}

/** Singleton FRAGO service instance */
export const fragoService = new FRAGOService();

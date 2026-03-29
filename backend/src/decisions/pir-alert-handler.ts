/**
 * PIR Alert Decision Handler
 *
 * Runs when a PIR_ALERT decision is acted upon by the commander.
 * Handles three outcomes:
 *   - APPROVE: Mark PIR answered, create assumption review decisions,
 *     notify staff of plan revision requirement.
 *   - REJECT: Log rejection, keep PIR active.
 *   - INFO_REQUEST: Dispatch targeted research, keep PIR active.
 *
 * Called as a post-action hook from the decisions REST API.
 */

import { pirStore } from '../design/pir-store.js';
import { decisionService } from './decision-service.js';
import { getMessageBus } from '../messaging/message-bus.js';
import type { Decision, DecisionStatus } from './decision-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PIRAlertContext {
  pirId: string;
  pirType: string;
  pirPriority: number;
  osintEventId?: string;
  matchedEntityIds?: string[];
  suggestedAnswer: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Process the outcome of a PIR_ALERT decision.
 * Called after decisionService.actOnDecision() succeeds for a PIR_ALERT type.
 */
export async function handlePIRAlertAction(
  decision: Decision,
  action: DecisionStatus,
  actorDid: string,
): Promise<void> {
  const ctx = decision.context_json as unknown as PIRAlertContext;

  if (!ctx?.pirId) {
    console.warn('[pir-alert-handler] Decision missing pirId in context_json:', decision.id);
    return;
  }

  switch (action) {
    case 'approved':
      await handleApprove(decision, ctx, actorDid);
      break;
    case 'rejected':
      await handleReject(decision, ctx, actorDid);
      break;
    case 'info_requested':
      await handleInfoRequest(decision, ctx, actorDid);
      break;
    default:
      // deferred or other statuses do not trigger PIR-specific logic
      console.log(`[pir-alert-handler] No PIR-specific handling for action: ${action}`);
      break;
  }
}

// ---------------------------------------------------------------------------
// APPROVE: Mark PIR answered, create assumption review decisions, notify staff
// ---------------------------------------------------------------------------

async function handleApprove(
  decision: Decision,
  ctx: PIRAlertContext,
  actorDid: string,
): Promise<void> {
  const problemSetId = decision.problem_set_id;

  // 1. Mark the PIR as ANSWERED with the suggested answer
  const updatedPIR = await pirStore.updatePIR(ctx.pirId, {
    status: 'ANSWERED',
    answer: ctx.suggestedAnswer,
    answeredBy: actorDid,
  });

  if (!updatedPIR) {
    console.warn(`[pir-alert-handler] PIR not found for update: ${ctx.pirId}`);
    return;
  }

  console.log(`[pir-alert-handler] PIR ${ctx.pirId} marked ANSWERED by ${actorDid}`);

  // 2. If PIR has linked assumptions, create decisions for assumption review
  const linkedAssumptions = updatedPIR.linkedAssumptionIds ?? [];
  if (linkedAssumptions.length > 0) {
    for (const assumptionId of linkedAssumptions) {
      try {
        await decisionService.createDecision({
          problem_set_id: problemSetId,
          decision_type: 'design_revision',
          title: `Assumption Review: Linked assumption ${assumptionId} may need revision`,
          description:
            `PIR ${updatedPIR.type} #${updatedPIR.priority} ("${updatedPIR.description.slice(0, 120)}") ` +
            `has been answered. The linked assumption (${assumptionId}) should be reviewed in light ` +
            `of this new intelligence. Answer provided: "${ctx.suggestedAnswer.slice(0, 200)}"`,
          context_json: {
            triggeredByPIR: ctx.pirId,
            assumptionId,
            pirAnswer: ctx.suggestedAnswer,
            pirType: ctx.pirType,
          },
          requested_by: 'did:bastion:ironclaw',
        });
      } catch (err) {
        console.warn(
          `[pir-alert-handler] Failed to create assumption review decision for ${assumptionId}:`,
          err,
        );
      }
    }

    console.log(
      `[pir-alert-handler] Created ${linkedAssumptions.length} assumption review decision(s)`,
    );
  }

  // 3. Notify staff via message bus about plan revision requirement
  try {
    const bus = getMessageBus();

    // Build list of affected planning products based on linked objectives/assumptions
    const affectedProducts: string[] = [];
    if (linkedAssumptions.length > 0) {
      affectedProducts.push('Operational Design (assumptions)');
    }
    if (updatedPIR.linkedObjectiveIds && updatedPIR.linkedObjectiveIds.length > 0) {
      affectedProducts.push('Objectives', 'Lines of Effort');
    }
    affectedProducts.push('Intelligence Estimate');

    await bus.publish({
      sourceDid: 'did:bastion:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `decisions.${problemSetId}`,
      messageType: 'decision.pir_alert_approved',
      payload: {
        decisionId: decision.id,
        pirId: ctx.pirId,
        pirType: ctx.pirType,
        pirPriority: ctx.pirPriority,
        pirDescription: updatedPIR.description,
        answer: ctx.suggestedAnswer,
        affectedProducts,
        linkedAssumptionIds: linkedAssumptions,
        linkedObjectiveIds: updatedPIR.linkedObjectiveIds ?? [],
        message:
          `PLAN REVISION REQUIRED: ${updatedPIR.type} #${updatedPIR.priority} has been answered. ` +
          `Affected products: ${affectedProducts.join(', ')}. ` +
          `Staff sections should review their planning products for impact.`,
      },
    });

    console.log(`[pir-alert-handler] Published plan revision notification for PIR ${ctx.pirId}`);
  } catch {
    // Notification is non-fatal
    console.warn('[pir-alert-handler] Failed to publish plan revision notification');
  }

  // 4. Log to blockchain audit trail via message bus event
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: actorDid,
      sourceType: 'user',
      destinationType: 'channel',
      destinationTarget: `audit.${problemSetId}`,
      messageType: 'audit.pir_alert_resolved',
      payload: {
        decisionId: decision.id,
        pirId: ctx.pirId,
        action: 'approved',
        actorDid,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Audit logging is non-fatal
  }
}

// ---------------------------------------------------------------------------
// REJECT: Log rejection, keep PIR active
// ---------------------------------------------------------------------------

async function handleReject(
  decision: Decision,
  ctx: PIRAlertContext,
  actorDid: string,
): Promise<void> {
  console.log(
    `[pir-alert-handler] PIR alert ${decision.id} rejected by ${actorDid}. ` +
    `PIR ${ctx.pirId} remains ACTIVE (intelligence deemed insufficient).`,
  );

  // Publish rejection event for audit trail
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: actorDid,
      sourceType: 'user',
      destinationType: 'channel',
      destinationTarget: `audit.${decision.problem_set_id}`,
      messageType: 'audit.pir_alert_resolved',
      payload: {
        decisionId: decision.id,
        pirId: ctx.pirId,
        action: 'rejected',
        actorDid,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Audit logging is non-fatal
  }
}

// ---------------------------------------------------------------------------
// INFO_REQUEST: Dispatch targeted research, keep PIR active
// ---------------------------------------------------------------------------

async function handleInfoRequest(
  decision: Decision,
  ctx: PIRAlertContext,
  actorDid: string,
): Promise<void> {
  const problemSetId = decision.problem_set_id;

  console.log(
    `[pir-alert-handler] More info requested for PIR alert ${decision.id} by ${actorDid}. ` +
    `Dispatching targeted research for PIR ${ctx.pirId}.`,
  );

  // Fetch the full PIR to get the description for the research query
  const pir = await pirStore.getPIR(ctx.pirId);
  if (!pir) {
    console.warn(`[pir-alert-handler] PIR not found for info request: ${ctx.pirId}`);
    return;
  }

  // Dispatch targeted research via the researcher specialist
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: 'did:bastion:ironclaw',
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `research.${problemSetId}`,
      messageType: 'research.targeted_request',
      payload: {
        query: pir.description,
        context:
          `Commander requested more information on ${pir.type} #${pir.priority}: "${pir.description}". ` +
          `Previous evidence was deemed insufficient. Original suggested answer: "${ctx.suggestedAnswer.slice(0, 300)}". ` +
          `Provide deeper analysis with additional sources.`,
        pirId: ctx.pirId,
        requestedBy: actorDid,
        decisionId: decision.id,
      },
    });

    console.log(`[pir-alert-handler] Dispatched targeted research for PIR ${ctx.pirId}`);
  } catch (err) {
    console.warn('[pir-alert-handler] Failed to dispatch targeted research:', err);
  }

  // Publish audit event
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: actorDid,
      sourceType: 'user',
      destinationType: 'channel',
      destinationTarget: `audit.${problemSetId}`,
      messageType: 'audit.pir_alert_resolved',
      payload: {
        decisionId: decision.id,
        pirId: ctx.pirId,
        action: 'info_requested',
        actorDid,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Audit logging is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Helper: Create a PIR Alert decision from gap filler or Ironclaw
// ---------------------------------------------------------------------------

/**
 * Create a PIR_ALERT decision when new intelligence matches an active PIR.
 * Used by the gap filler service and the Ironclaw create_pir_alert tool.
 */
/**
 * Map PIR type to decision type and notification urgency.
 * CCIR = commander-critical, immediate interrupt
 * PIR  = staff-processed, routine notification
 * FFIR = friendly force info, reports to J3/S3
 * EEFI = protect from adversary, reports to J2/S2
 */
function getDecisionTypeForPIR(pirType: string): string {
  switch (pirType) {
    case 'CCIR': return 'ccir_alert';
    case 'FFIR': return 'ffir_alert';
    case 'EEFI': return 'eefi_alert';
    default: return 'pir_answered'; // PIR and unknown types
  }
}

function isCCIR(pirType: string): boolean {
  return pirType === 'CCIR';
}

function getTelegramEmoji(pirType: string): string {
  switch (pirType) {
    case 'CCIR': return '\u{1F6A8}'; // rotating light - urgent
    case 'FFIR': return '\u{1F7E2}'; // green circle
    case 'EEFI': return '\u{1F512}'; // lock
    default: return '\u26a0\ufe0f'; // warning
  }
}

function getTelegramPrefix(pirType: string): string {
  switch (pirType) {
    case 'CCIR': return 'FLASH: CCIR ALERT (IMMEDIATE)';
    case 'FFIR': return 'FFIR ALERT';
    case 'EEFI': return 'EEFI ALERT';
    default: return 'PIR ANSWERED';
  }
}

export async function createPIRAlertDecision(params: {
  problemSetId: string;
  pirId: string;
  pirType: string;
  pirPriority: number;
  pirDescription: string;
  osintEventId?: string;
  matchedEntityIds?: string[];
  suggestedAnswer: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
}): Promise<Decision> {
  const truncatedDesc = params.pirDescription.length > 80
    ? params.pirDescription.slice(0, 80) + '...'
    : params.pirDescription;

  const decisionType = getDecisionTypeForPIR(params.pirType);
  const isCritical = isCCIR(params.pirType);

  // CCIR: Commander must personally act. PIR: J2 processes, commander reviews.
  const actionText = isCritical
    ? 'IMMEDIATE commander action required: Accept intelligence, Reject (insufficient), or Request More Info.'
    : 'J2 review required. Accept (mark answered and update running estimate), Reject (dismiss), or Request More Info.';

  const decision = await decisionService.createDecision({
    problem_set_id: params.problemSetId,
    decision_type: decisionType,
    title: `${params.pirType} #${params.pirPriority}: ${truncatedDesc}`,
    description:
      `New intelligence may address ${params.pirType} #${params.pirPriority}: ` +
      `${params.pirDescription}. ` +
      `Source: ${params.osintEventId ? `OSINT event ${params.osintEventId}` : 'Ironclaw analysis'}. ` +
      actionText,
    context_json: {
      pirId: params.pirId,
      pirType: params.pirType,
      pirPriority: params.pirPriority,
      osintEventId: params.osintEventId ?? null,
      matchedEntityIds: params.matchedEntityIds ?? [],
      suggestedAnswer: params.suggestedAnswer,
      linkedAssumptionIds: params.linkedAssumptionIds ?? [],
      linkedObjectiveIds: params.linkedObjectiveIds ?? [],
      isCritical,
    },
    requested_by: 'did:bastion:ironclaw',
  });

  console.log(
    `[pir-alert-handler] Created ${decisionType} decision ${decision.id} for ${params.pirType} ${params.pirId}`,
  );

  // Send Telegram notification if configured (non-blocking)
  // CCIR: always send immediately regardless of notification level
  // PIR/FFIR/EEFI: respect notification level settings
  setImmediate(async () => {
    try {
      const { telegramBotService } = await import('../ironclaw/telegram-bot-service.js');
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();

      // For CCIR: notify ALL paired users regardless of notification level
      // For PIR/FFIR/EEFI: only notify users with notification level <= 'Priority'
      const notificationFilter = isCritical
        ? "telegram_enabled = true AND telegram_chat_id IS NOT NULL"
        : "telegram_enabled = true AND telegram_chat_id IS NOT NULL AND telegram_notification_level IN ('Flash', 'Immediate', 'Priority')";

      const result = await pool.query(
        `SELECT telegram_chat_id FROM agent_config WHERE ${notificationFilter}`,
      );

      const emoji = getTelegramEmoji(params.pirType);
      const prefix = getTelegramPrefix(params.pirType);

      for (const row of result.rows) {
        const chatId = row.telegram_chat_id as string;
        await telegramBotService.sendNotification(
          chatId,
          `${emoji} *${prefix}*\n\n` +
          `${params.pirType} #${params.pirPriority}: ${params.pirDescription}\n\n` +
          `Suggested answer: ${params.suggestedAnswer.slice(0, 300)}\n\n` +
          (isCritical
            ? `IMMEDIATE action required in BASTION Decide tab.`
            : `Review required in BASTION Decide tab.`),
        );
      }
    } catch (err) {
      console.warn('[pir-alert-handler] Telegram notification failed:', err);
    }
  });

  return decision;
}

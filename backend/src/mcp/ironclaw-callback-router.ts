/**
 * Ironclaw Callback Router
 *
 * Phase 65 Plan 01: Express router providing POST /callback endpoint on the
 * bastion-mcp container (port 3334).
 *
 * CRITICAL NETWORK CONSTRAINT:
 *   Ironclaw sits on `ironclaw-network` and can ONLY reach `bastion-mcp`.
 *   The MCP container bridges both `bastion-network` and `ironclaw-network`.
 *   This endpoint MUST be here (bastion-mcp), NOT on the main backend.
 *
 * Endpoint: POST /api/ironclaw/callback
 *   Full URL (from Ironclaw): http://bastion-mcp:3334/api/ironclaw/callback
 *
 * Security: HMAC-SHA256 via shared IRONCLAW_SHARED_SECRET (same as outbound calls).
 *
 * Circuit breakers:
 *   - Max 10 callbacks per problem set in the last 30 minutes
 *   - Max 100 callbacks per problem set per day
 *
 * Type-based routing:
 *   - intelligence_gap_detected → createPIRAlertDecision()
 *   - conflict_detected         → decisionService.createDecision(CONFLICT_RESOLUTION)
 *   - situation_assessment      → activity store only (no decision gate)
 *   - skill_creation_request    → decisionService.createDecision(SKILL_CREATION)
 *   - alert                     → Telegram notification for urgent/critical
 *   - default                   → activity store only
 *
 * Always: log to activity store + publish to WebSocket channel ironclaw.{problemSetId}
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyRequest } from '../ironclaw/hmac-auth.js';
import { autonomousActivityStore } from '../ironclaw/autonomous-activity-store.js';
import type { ActivityEntry } from '../ironclaw/autonomous-activity-store.js';

// ---------------------------------------------------------------------------
// Circuit breaker constants
// ---------------------------------------------------------------------------

const CIRCUIT_WINDOW_MINUTES = 30;
const CIRCUIT_WINDOW_MAX = 10;
const CIRCUIT_DAILY_MAX = 100;

// ---------------------------------------------------------------------------
// Valid severity values
// ---------------------------------------------------------------------------

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'urgent',
  'routine',
  'informational',
]);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const callbackRouter = Router();

/**
 * POST /callback
 *
 * Receives autonomous findings from Ironclaw.
 * Mounted at /api/ironclaw, so the full path is POST /api/ironclaw/callback.
 */
callbackRouter.post('/callback', async (req: Request, res: Response) => {
  // --- HMAC verification ---
  const rawBody = JSON.stringify(req.body);
  const isValid = verifyRequest(
    req.method,
    req.path,
    rawBody,
    req.headers as Record<string, string | string[] | undefined>,
  );

  if (!isValid) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  // --- Body validation ---
  const { type, problemSetId, payload, severity } = req.body as {
    type?: unknown;
    problemSetId?: unknown;
    payload?: unknown;
    severity?: unknown;
  };

  if (
    typeof type !== 'string' || !type ||
    typeof problemSetId !== 'string' || !problemSetId ||
    typeof payload !== 'object' || payload === null || Array.isArray(payload) ||
    typeof severity !== 'string' || !VALID_SEVERITIES.has(severity)
  ) {
    res.status(400).json({
      error: 'invalid_body',
      message: 'Required fields: type (string), problemSetId (string), payload (object), severity (critical|urgent|routine|informational)',
    });
    return;
  }

  const typedSeverity = severity as ActivityEntry['severity'];

  // --- Circuit breakers ---
  try {
    const windowStart = new Date(Date.now() - CIRCUIT_WINDOW_MINUTES * 60 * 1000);
    const [windowCount, dailyCount] = await Promise.all([
      autonomousActivityStore.getCountSince(problemSetId, windowStart),
      autonomousActivityStore.getDailyCount(problemSetId),
    ]);

    if (windowCount >= CIRCUIT_WINDOW_MAX) {
      const retryAfterSeconds = CIRCUIT_WINDOW_MINUTES * 60;
      res.status(429).json({
        error: 'rate_limit',
        reason: `Max ${CIRCUIT_WINDOW_MAX} callbacks per ${CIRCUIT_WINDOW_MINUTES} minutes exceeded`,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    if (dailyCount >= CIRCUIT_DAILY_MAX) {
      res.status(429).json({
        error: 'rate_limit',
        reason: `Daily limit of ${CIRCUIT_DAILY_MAX} callbacks exceeded`,
        retryAfter: secondsUntilMidnightUTC(),
      });
      return;
    }
  } catch (err) {
    console.error('[ironclaw-callback] Circuit breaker check failed:', err);
    // Non-fatal: allow through if circuit breaker check errors
  }

  // --- Type-based routing ---
  let decisionId: string | undefined;

  try {
    switch (type) {
      case 'intelligence_gap_detected':
        decisionId = await handleIntelligenceGap(problemSetId, payload as Record<string, unknown>);
        break;

      case 'conflict_detected':
        decisionId = await handleConflictDetected(problemSetId, payload as Record<string, unknown>);
        break;

      case 'situation_assessment':
        // No decision gate — just logged to activity store below
        break;

      case 'skill_creation_request':
        decisionId = await handleSkillCreationRequest(problemSetId, payload as Record<string, unknown>);
        break;

      case 'alert':
        await handleAlert(problemSetId, typedSeverity, payload as Record<string, unknown>);
        break;

      default:
        // Unknown types: log to activity store only
        console.log(`[ironclaw-callback] Received unrecognised type '${type}' for problem set ${problemSetId} — logging only`);
        break;
    }
  } catch (err) {
    // Routing errors are non-fatal for the log + websocket step below
    console.error(`[ironclaw-callback] Type-routing error for type '${type}':`, err);
  }

  // --- Always: log to activity store ---
  let entry: ActivityEntry;
  try {
    entry = await autonomousActivityStore.log({
      problemSetId,
      activityType: type,
      severity: typedSeverity,
      summary: extractSummary(payload as Record<string, unknown>, type),
      detail: payload as Record<string, unknown>,
      decisionId,
    });
  } catch (err) {
    console.error('[ironclaw-callback] Activity store log failed:', err);
    res.status(500).json({ error: 'storage_failed' });
    return;
  }

  // --- Always: publish to WebSocket ---
  setImmediate(async () => {
    try {
      const { getMessageBus } = await import('../messaging/message-bus.js');
      const bus = getMessageBus();
      await bus.publish({
        sourceDid: 'did:bastion:ironclaw',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `ironclaw.${problemSetId}`,
        messageType: 'ironclaw.autonomous-activity',
        payload: {
          activityId: entry.id,
          activityType: entry.activityType,
          severity: entry.severity,
          summary: entry.summary,
          detail: entry.detail,
          decisionId: entry.decisionId,
          createdAt: entry.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.warn('[ironclaw-callback] WebSocket publish failed (non-fatal):', err);
    }
  });

  res.json({ status: 'ok', activityId: entry.id });
});

// ---------------------------------------------------------------------------
// Type handlers
// ---------------------------------------------------------------------------

/**
 * Handle intelligence_gap_detected: create PIR_ALERT decision.
 * Expects payload to have pirId, pirType, pirPriority, pirDescription, suggestedAnswer at minimum.
 */
async function handleIntelligenceGap(
  problemSetId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const { createPIRAlertDecision } = await import('../decisions/pir-alert-handler.js');
    const decision = await createPIRAlertDecision({
      problemSetId,
      pirId: (payload.pirId as string) ?? '',
      pirType: (payload.pirType as string) ?? 'PIR',
      pirPriority: (payload.pirPriority as number) ?? 1,
      pirDescription: (payload.pirDescription as string) ?? (payload.description as string) ?? String(payload),
      osintEventId: payload.osintEventId as string | undefined,
      matchedEntityIds: payload.matchedEntityIds as string[] | undefined,
      suggestedAnswer: (payload.suggestedAnswer as string) ?? '',
      linkedAssumptionIds: payload.linkedAssumptionIds as string[] | undefined,
      linkedObjectiveIds: payload.linkedObjectiveIds as string[] | undefined,
    });
    return decision.id;
  } catch (err) {
    console.error('[ironclaw-callback] createPIRAlertDecision failed:', err);
    return undefined;
  }
}

/**
 * Handle conflict_detected: create CONFLICT_RESOLUTION decision gate.
 */
async function handleConflictDetected(
  problemSetId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const { decisionService } = await import('../decisions/decision-service.js');
    const decision = await decisionService.createDecision({
      problem_set_id: problemSetId,
      decision_type: 'conflict_resolution',
      title: (payload.title as string) ?? 'Conflict Detected by Ironclaw',
      description: (payload.description as string) ?? 'Ironclaw autonomous analysis detected a conflict requiring resolution.',
      context_json: payload,
      requested_by: 'did:bastion:ironclaw',
    });
    return decision.id;
  } catch (err) {
    console.error('[ironclaw-callback] createDecision(conflict_resolution) failed:', err);
    return undefined;
  }
}

/**
 * Handle skill_creation_request: create SKILL_CREATION governance gate (medium-risk).
 */
async function handleSkillCreationRequest(
  problemSetId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const { decisionService } = await import('../decisions/decision-service.js');
    const decision = await decisionService.createDecision({
      problem_set_id: problemSetId,
      decision_type: 'skill_creation',
      title: (payload.title as string) ?? 'Skill Creation Request from Ironclaw',
      description: (payload.description as string) ?? 'Ironclaw has requested creation of a new agent skill.',
      context_json: payload,
      requested_by: 'did:bastion:ironclaw',
    });
    return decision.id;
  } catch (err) {
    console.error('[ironclaw-callback] createDecision(skill_creation) failed:', err);
    return undefined;
  }
}

/**
 * Handle alert: send Telegram notification for urgent/critical severity.
 */
async function handleAlert(
  problemSetId: string,
  severity: ActivityEntry['severity'],
  payload: Record<string, unknown>,
): Promise<void> {
  if (severity !== 'urgent' && severity !== 'critical') return;

  try {
    const { telegramBotService } = await import('../ironclaw/telegram-bot-service.js');
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();

    // Notify all Telegram-paired users for this problem set (or all if no scoping)
    const notificationLevelFilter = severity === 'critical'
      ? "telegram_enabled = true AND telegram_chat_id IS NOT NULL"
      : "telegram_enabled = true AND telegram_chat_id IS NOT NULL AND telegram_notification_level IN ('Flash', 'Immediate', 'Priority')";

    const result = await pool.query(
      `SELECT telegram_chat_id FROM agent_config WHERE ${notificationLevelFilter}`,
    );

    const severityEmoji = severity === 'critical' ? '\u{1F6A8}' : '\u26a0\ufe0f';
    const title = (payload.title as string) ?? `Ironclaw Alert`;
    const message = (payload.message as string) ?? (payload.description as string) ?? '';

    for (const row of result.rows) {
      const chatId = row.telegram_chat_id as string;
      await telegramBotService.sendNotification(
        chatId,
        `${severityEmoji} *${severity.toUpperCase()} ALERT*\n\n` +
        `Problem Set: ${problemSetId}\n` +
        `${title}\n\n` +
        (message ? `${message}\n\n` : '') +
        `Review in BASTION.`,
      );
    }
  } catch (err) {
    console.warn('[ironclaw-callback] Telegram alert failed (non-fatal):', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable summary from the payload.
 * Prefers explicit summary/title/description fields.
 */
function extractSummary(payload: Record<string, unknown>, activityType: string): string {
  if (typeof payload.summary === 'string' && payload.summary) return payload.summary;
  if (typeof payload.title === 'string' && payload.title) return payload.title;
  if (typeof payload.description === 'string' && payload.description) {
    return payload.description.length > 200
      ? payload.description.slice(0, 200) + '...'
      : payload.description;
  }
  return `Ironclaw autonomous activity: ${activityType}`;
}

/**
 * Seconds until UTC midnight — used as retryAfter for daily limit exceeded.
 */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

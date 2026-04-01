/**
 * Routine Service
 *
 * Phase 60 Plan 06: Blueprint Phase 5 — Routines.
 *
 * Manages scheduled tasks (routines) for Ironclaw. Built-in routines include
 * knowledge sync (shared and user-specific) and capability/reporting routines.
 *
 * Routines are registered by writing directly to Ironclaw's PostgreSQL
 * `routines` table (via DATABASE_URL_IRONCLAW). The v0.23.0 runtime reads
 * this table and fires cron-based routines automatically.
 *
 * Knowledge sync writes BASTION_CONTEXT.md to Ironclaw's shared workspace so
 * Ironclaw always has current context about active operations, agents, and tools.
 * User knowledge sync writes per-user context on first message of session.
 */

import pg from 'pg';
import { ironclawClient, didToSlug } from './ironclaw-client.js';
import { getPool } from '../lib/database.js';
import type { RoutineSpec } from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuiltInRoutine {
  id: string;
  name: string;
  description: string;
  /** Cron expression, or null for event-triggered routines. */
  defaultCron: string | null;
  /** Whether the user can change the cron schedule. */
  editable: boolean;
  category: 'knowledge' | 'monitoring' | 'reporting';
  /** Prompt to send to Ironclaw when this routine fires. */
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Built-in routine definitions
// ---------------------------------------------------------------------------

/**
 * Built-in routines that are always available for every Ironclaw instance.
 * These are defined once at the code level and can be registered with Ironclaw
 * or shown in the UI without any DB query.
 *
 * Blueprint Phase 5: Built-in routines cover the four core workflow areas:
 *   1. Shared knowledge sync (cron-based)
 *   2. User knowledge sync (login-triggered)
 *   3. Weekly capability update (monitoring)
 *   4. Daily situation brief (reporting)
 */
export const BUILT_IN_ROUTINES: BuiltInRoutine[] = [
  {
    id: 'bastion_knowledge_sync',
    name: 'Shared Knowledge Sync',
    description: 'Sync shared workspace data to Ironclaw — problem sets, active operations, available tools, and agent team list.',
    defaultCron: '0 */6 * * *',  // Every 6 hours
    editable: true,
    category: 'knowledge',
    prompt: 'Review the current BASTION_CONTEXT.md in your workspace. Use the bastion_problem_set_list tool to check for any new or updated operations. Report any changes you notice.',
  },
  {
    id: 'bastion_user_knowledge_sync',
    name: 'User Knowledge Sync (Login)',
    description: 'Sync user-specific context on login — problem set memberships, recent activity, and assigned tasks. Triggered automatically, not on a schedule.',
    defaultCron: null,  // Event-triggered: on login / first session message
    editable: false,
    category: 'knowledge',
  },
  {
    id: 'weekly_capability_update',
    name: 'Weekly Capability Update',
    description: 'Update Ironclaw on available Bastion capabilities — new tools, agent updates, and system changes.',
    defaultCron: '0 9 * * 1',   // Monday 9am
    editable: true,
    category: 'monitoring',
    prompt: 'Review the available BASTION tools and agents. List any new capabilities, updated tools, or system changes since last check. Summarize in a brief capability report.',
  },
  {
    id: 'daily_situation_brief',
    name: 'Daily Situation Brief',
    description: 'Generate a morning situation brief summarizing overnight intelligence updates, pending decisions, and priority actions.',
    defaultCron: '0 6 * * *',   // 6am daily
    editable: true,
    category: 'reporting',
    prompt: 'Generate a morning situation brief. Check active problem sets for: (1) new intelligence or OSINT events since last brief, (2) pending decisions requiring commander attention, (3) priority actions for today. Format as a concise SITREP.',
  },
  {
    id: 'autonomous_monitoring',
    name: 'Autonomous Operational Monitoring',
    description: 'Heartbeat-driven monitoring: conflict detection, gap research, PIR checking, situation assessment drafting. Ironclaw evaluates HEARTBEAT.md directives and takes autonomous action.',
    defaultCron: '*/30 * * * *',  // Every 30 minutes
    editable: true,
    category: 'monitoring',
    prompt: 'Run autonomous operational monitoring. Check active problem sets for: (1) contradictions or conflicts in the knowledge graph, (2) intelligence gaps that need research, (3) PIR/IR that may have been answered by new data, (4) changes in situation that warrant a draft assessment. Use bastion tools to query current state. Log any findings as autonomous activity entries using bastion_autonomous_log_activity.',
  },
];

// ---------------------------------------------------------------------------
// Ironclaw DB pool (lazy-initialized)
// ---------------------------------------------------------------------------

let ironclawPool: pg.Pool | null = null;

function getIronclawPool(): pg.Pool {
  if (!ironclawPool) {
    const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
    if (!url) {
      throw new Error(
        '[routine-service] DATABASE_URL_IRONCLAW not set — cannot register routines directly. ' +
        'Add DATABASE_URL_IRONCLAW to docker-compose environment.',
      );
    }
    ironclawPool = new pg.Pool({ connectionString: url, max: 3 });
  }
  return ironclawPool;
}

// ---------------------------------------------------------------------------
// RoutineService
// ---------------------------------------------------------------------------

export class RoutineService {

  // ─── Direct DB routine management ──────────────────────────────────────────

  /**
   * Upsert a routine into Ironclaw's `routines` table.
   *
   * Ironclaw v0.23.0 stores routines in PostgreSQL and fires them via an
   * internal cron ticker. We write directly to the DB instead of sending
   * CLI/webhook commands, since webhook `/routine` commands are not supported.
   *
   * Uses 6-field cron (sec min hour day month weekday) as required by Ironclaw.
   */
  private async upsertRoutine(opts: {
    name: string;
    description: string;
    userId: string;
    /** 5-field cron (min hour day month weekday) — will be prefixed with "0 " for 6-field. */
    cron: string;
    prompt: string;
    cooldownSecs?: number;
  }): Promise<void> {
    const pool = getIronclawPool();
    // Convert 5-field to 6-field cron by prepending seconds = 0
    const sixFieldCron = opts.cron.split(' ').length === 5
      ? `0 ${opts.cron}`
      : opts.cron;

    // Set next_fire_at so Ironclaw's cron ticker picks up the routine immediately.
    // The ticker only processes routines with a non-null next_fire_at <= NOW().
    // We set it to NOW() + 30s so the ticker picks it up on its next 15s poll cycle.
    await pool.query(`
      INSERT INTO routines (
        name, description, user_id, enabled,
        trigger_type, trigger_config,
        action_type, action_config,
        cooldown_secs, max_concurrent,
        next_fire_at
      ) VALUES (
        $1, $2, $3, true,
        'cron', $4::jsonb,
        'full_job', $5::jsonb,
        $6, 1,
        NOW() + INTERVAL '30 seconds'
      )
      ON CONFLICT (user_id, name)
      DO UPDATE SET
        description = EXCLUDED.description,
        enabled = true,
        action_type = EXCLUDED.action_type,
        trigger_config = EXCLUDED.trigger_config,
        action_config = EXCLUDED.action_config,
        cooldown_secs = EXCLUDED.cooldown_secs,
        next_fire_at = NOW() + INTERVAL '30 seconds',
        updated_at = NOW()
    `, [
      opts.name,
      opts.description,
      opts.userId,
      JSON.stringify({ schedule: sixFieldCron }),
      JSON.stringify({
        title: opts.name,
        prompt: opts.prompt,
        max_tool_rounds: 5,
        tools_enabled: true,
        max_tokens: 4096,
      }),
      opts.cooldownSecs ?? 300,
    ]);

    console.log(`[routine-service] Upserted routine '${opts.name}' for user '${opts.userId}' (${sixFieldCron})`);
  }

  /**
   * Disable a routine by name and user_id.
   */
  private async disableRoutine(name: string, userId: string): Promise<void> {
    const pool = getIronclawPool();
    await pool.query(
      `UPDATE routines SET enabled = false, updated_at = NOW() WHERE name = $1 AND user_id = $2`,
      [name, userId],
    );
    console.log(`[routine-service] Disabled routine '${name}' for user '${userId}'`);
  }

  // ─── Knowledge sync (writes files to Ironclaw workspace via webhook) ──────

  /**
   * Sync shared Bastion knowledge to Ironclaw's workspace.
   *
   * Writes shared/knowledge/BASTION_CONTEXT.md with current:
   *   - Active problem sets (operations)
   *   - Available Bastion tool list
   *   - Current agent team list
   *
   * This file is available to all users via the shared workspace path.
   */
  async syncKnowledge(): Promise<void> {
    try {
      const pool = getPool();

      // Query active problem sets
      const psResult = await pool.query<{
        id: string;
        name: string;
        status: string;
      }>(
        `SELECT id, name, status
         FROM problem_sets
         WHERE status IN ('active', 'planning', 'in-progress')
         ORDER BY updated_at DESC
         LIMIT 20`,
      );

      // Query available agents
      const agentResult = await pool.query<{
        id: string;
        name: string;
        type: string;
      }>(
        `SELECT id, name, type
         FROM agents
         ORDER BY name
         LIMIT 30`,
      );

      const problemSetList = psResult.rows.length > 0
        ? psResult.rows.map((ps) => `- **${ps.name}** (${ps.status}) — ID: ${ps.id}`).join('\n')
        : '- No active operations';

      const agentList = agentResult.rows.length > 0
        ? agentResult.rows.map((a) => `- ${a.name} [${a.type}]`).join('\n')
        : '- No agents registered';

      const content = `# BASTION Context
> Auto-generated by Bastion routine: bastion_knowledge_sync
> Last updated: ${new Date().toISOString()}

## Active Operations (Problem Sets)

${problemSetList}

## Available Agent Team

${agentList}

## Available Tool Categories

- Intelligence Analysis — IPB, OSINT processing, threat assessment
- Operational Planning — MDMP support, COA development, campaign design
- Knowledge Graph — Entity extraction, relationship mapping, graph queries
- Document Processing — Brief generation, OPORD drafting, annex production
- Force Management — Unit tracking, readiness assessment, task organization
- Decision Support — Risk analysis, option comparison, decision brief generation

---
*This context file is updated every 6 hours by the bastion_knowledge_sync routine.*
`;

      await ironclawClient.sendMessage(
        'system',
        `/file write shared/knowledge/BASTION_CONTEXT.md\n${content}`,
      );

      console.log('[routine-service] syncKnowledge: BASTION_CONTEXT.md written to shared workspace');
    } catch (err) {
      console.error('[routine-service] syncKnowledge failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  }

  /**
   * Sync user-specific knowledge to Ironclaw's workspace.
   *
   * Writes users/{didSlug}/knowledge/ files with:
   *   - USER_CONTEXT.md: problem set memberships, recent activity, assigned tasks
   *
   * Called on first message of each session (piggybacked on identity freshness check).
   */
  async syncUserKnowledge(did: string): Promise<void> {
    const slug = didToSlug(did);
    try {
      const pool = getPool();

      // Query user's problem set memberships
      const memberResult = await pool.query<{
        ps_id: string;
        ps_name: string;
        role: string;
        ps_status: string;
      }>(
        `SELECT ps.id AS ps_id, ps.name AS ps_name, m.role, ps.status AS ps_status
         FROM problem_set_members m
         JOIN problem_sets ps ON ps.id = m.problem_set_id
         WHERE m.user_did = $1
         ORDER BY ps.updated_at DESC
         LIMIT 10`,
        [did],
      );

      const membershipList = memberResult.rows.length > 0
        ? memberResult.rows.map(
            (m) => `- **${m.ps_name}** — Role: ${m.role} | Status: ${m.ps_status}`,
          ).join('\n')
        : '- No problem set memberships';

      const content = `# User Context
> Auto-generated by Bastion routine: bastion_user_knowledge_sync
> DID: ${did}
> Last updated: ${new Date().toISOString()}

## Problem Set Memberships

${membershipList}

## Notes

- Identity files (USER.md, SOUL.md, HEARTBEAT.md, AGENTS.md) are maintained separately in users/${slug}/identity/
- This context supplements identity files with current operational data

---
*This context is refreshed on each session start.*
`;

      await ironclawClient.sendMessage(
        'system',
        `/file write users/${slug}/knowledge/USER_CONTEXT.md\n${content}`,
      );

      console.log(`[routine-service] syncUserKnowledge: USER_CONTEXT.md written for ${slug}`);
    } catch (err) {
      console.error(`[routine-service] syncUserKnowledge failed for ${slug}:`, err instanceof Error ? err.message : err);
      // Non-blocking: user knowledge sync failure should not break message flow
    }
  }

  // ─── Routine registration (direct DB writes) ──────────────────────────────

  /**
   * Register a built-in routine with Ironclaw.
   *
   * Writes directly to Ironclaw's `routines` table.
   */
  async registerRoutine(routineId: string, cron: string): Promise<void> {
    const routine = BUILT_IN_ROUTINES.find((r) => r.id === routineId);
    if (!routine) {
      console.warn(`[routine-service] Unknown built-in routine: ${routineId}`);
      return;
    }

    try {
      await this.upsertRoutine({
        name: routineId,
        description: routine.description,
        userId: 'system',
        cron,
        prompt: routine.prompt ?? routine.description,
      });
    } catch (err) {
      console.error(`[routine-service] Failed to register routine ${routineId}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  /**
   * Unregister a routine from Ironclaw.
   */
  async unregisterRoutine(routineId: string): Promise<void> {
    try {
      await this.disableRoutine(routineId, 'system');
    } catch (err) {
      console.error(`[routine-service] Failed to unregister routine ${routineId}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  /**
   * Register the autonomous monitoring heartbeat routine for a specific problem set.
   *
   * Writes directly to Ironclaw's `routines` table with a per-problem-set name.
   * Ironclaw's internal cron ticker will pick it up and fire on schedule.
   *
   * @param problemSetId - The problem set to monitor autonomously.
   * @param cronOverride - Optional cron expression override. Defaults to every 30 min.
   *                       Minimum interval is 15 minutes; violating crons are clamped.
   */
  async registerAutonomousMonitoring(problemSetId: string, cronOverride?: string): Promise<void> {
    const DEFAULT_CRON = '*/30 * * * *';   // every 30 minutes
    const MIN_CRON = '*/15 * * * *';       // minimum 15 minutes
    let cron = cronOverride ?? DEFAULT_CRON;

    // Enforce minimum 15-minute interval.
    // We detect sub-15-minute schedules by checking the minute field for */N where N < 15.
    const minuteField = cron.split(' ')[0];
    const intervalMatch = minuteField.match(/^\*\/(\d+)$/);
    if (intervalMatch) {
      const intervalMinutes = parseInt(intervalMatch[1], 10);
      if (intervalMinutes < 15) {
        console.warn(
          `[routine-service] registerAutonomousMonitoring: cron interval ${intervalMinutes} min is below 15-min minimum. ` +
          `Clamping to ${MIN_CRON}.`,
        );
        cron = MIN_CRON;
      }
    }

    try {
      await this.upsertRoutine({
        name: `autonomous_monitoring__${problemSetId}`,
        description: `Autonomous operational monitoring for problem set ${problemSetId}. Checks for contradictions, intelligence gaps, unanswered PIRs, and situation changes.`,
        userId: 'system',
        cron,
        prompt: `Run autonomous operational monitoring for problem set ${problemSetId}. ` +
          `Use bastion tools to: (1) check for contradictions or conflicts in the knowledge graph, ` +
          `(2) identify intelligence gaps that need research, ` +
          `(3) check if any PIR/IR have been answered by new data, ` +
          `(4) assess whether the situation has changed enough to warrant a draft assessment. ` +
          `Log any findings as autonomous activity entries using bastion_autonomous_log_activity with the problem_set_id '${problemSetId}'.`,
        cooldownSecs: 900, // 15-minute cooldown minimum
      });
      console.log(`[routine-service] Registered autonomous monitoring for problem set ${problemSetId} (${cron})`);
    } catch (err) {
      // Non-blocking: routine registration failure should not crash startup or identity sync
      console.warn(
        `[routine-service] Failed to register autonomous monitoring for ${problemSetId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Unregister the autonomous monitoring heartbeat routine for a specific problem set.
   *
   * Call this when a problem set is archived, deleted, or monitoring is disabled.
   *
   * @param problemSetId - The problem set to stop monitoring.
   */
  async unregisterAutonomousMonitoring(problemSetId: string): Promise<void> {
    try {
      await this.disableRoutine(`autonomous_monitoring__${problemSetId}`, 'system');
      console.log(`[routine-service] Unregistered autonomous monitoring for problem set ${problemSetId}`);
    } catch (err) {
      // Non-blocking: log warning but do not throw
      console.warn(
        `[routine-service] Failed to unregister autonomous monitoring for ${problemSetId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Register all custom routines for a user with Ironclaw.
   *
   * Called when a user's routines change or on startup to restore
   * previously-configured custom routines.
   */
  async registerUserRoutines(did: string, routines: RoutineSpec[]): Promise<void> {
    const slug = didToSlug(did);
    const enabledRoutines = routines.filter((r) => r.enabled);

    for (const routine of enabledRoutines) {
      try {
        await this.upsertRoutine({
          name: `${slug}:${routine.name}`,
          description: routine.description ?? routine.name,
          userId: slug,
          cron: routine.cron,
          prompt: routine.description ?? routine.name,
        });
        console.log(`[routine-service] Registered user routine: ${slug}:${routine.name}`);
      } catch (err) {
        console.error(
          `[routine-service] Failed to register user routine ${slug}:${routine.name}:`,
          err instanceof Error ? err.message : err,
        );
        // Non-blocking: continue registering other routines
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const routineService = new RoutineService();

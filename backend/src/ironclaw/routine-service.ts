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
    description: 'Proactive Chief of Staff cycle: assess situation, act on findings, alert commanders on what matters.',
    defaultCron: '0 */2 * * *',  // Every 2 hours (was 30 min — too noisy)
    editable: true,
    category: 'monitoring',
    prompt: `Autonomous monitoring cycle. Be terse and surgical.

ASSESS (concise):
- Check for critical graph contradictions
- Check for newly-answerable PIRs
- Check for material situation changes

ACT (only on the 1-2 most important findings):
- Answer PIRs that have new data
- Create alert via bastion category=ops action=send_alert for urgent findings ONLY

CRITICAL CONSTRAINTS — STRICTLY ENFORCED:
- DO NOT use memory_write, memory_read, or any memory_* tool
- DO NOT write daily logs or narratives
- DO NOT log per-event analysis
- Use bastion category=ops action=log_activity for brief activity entries (max 1 per cycle, under 200 chars)
- Max 3 tool calls per cycle — prioritize ruthlessly
- Response must be under 500 characters total
- If nothing material changed, respond with "No action required." and stop.`,
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

    // Set next_fire_at on INSERT so Ironclaw's cron ticker picks up new routines.
    // On UPDATE (routine already exists), preserve existing next_fire_at so we
    // don't force all routines to fire simultaneously after every backend restart.
    // The ticker only processes routines with a non-null next_fire_at <= NOW().
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
        updated_at = NOW()
    `, [
      opts.name,
      opts.description,
      opts.userId,
      JSON.stringify({ schedule: sixFieldCron }),
      JSON.stringify({
        title: opts.name,
        description: opts.prompt,
        max_iterations: 10,
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

  /**
   * Refine Ironclaw's built-in default routines with disciplined prompts.
   *
   * Ironclaw's installer creates three routines that are SUPPOSED to be
   * its long-term learning mechanism (daily brief, knowledge sync, weekly
   * capability update). By default they produce verbose narratives that
   * bloat Ironclaw's memory_documents (453KB daily log + 31KB context file)
   * and pollute every LLM call with cross-exercise content.
   *
   * We keep the routines enabled — they ARE how Ironclaw learns — but
   * rewrite their prompts to enforce:
   *   1. Distillation over narration. Write lessons, not event logs.
   *   2. Per-problem-set scoping. Path: problem_sets/<PS-ID>/context.md
   *      and problem_sets/<PS-ID>/briefs/latest.md
   *   3. REPLACE not append. Each routine overwrites its canonical file
   *      instead of accumulating history.
   *   4. Strict size caps enforced in the prompt + a backstop trim job.
   *   5. Exit early if nothing material has changed.
   *
   * Idempotent — safe to call on every backend startup. Updates the
   * action_config.description (the LLM prompt) in-place.
   */
  async refineIronclawDefaultRoutines(): Promise<void> {
    const refinements: Array<{ name: string; prompt: string; cronOverride?: string }> = [
      {
        name: 'daily_situation_brief',
        cronOverride: '0 6 * * *', // once per day at 06:00
        prompt: `Distillation task — produce compact, high-signal briefs per active problem set. Each brief replaces the previous one at a canonical path.

STEPS:
1. Use bastion category=ops action=list_all to list active problem sets.
2. For each active problem set, check material changes since the last brief:
   - New critical OSINT events (skip routine ingestion noise)
   - PIR state transitions (newly answered / new alerts)
   - Decision gates needing commander attention
   - Situation escalation indicators
3. For each problem set with material changes, write a brief.
4. Skip problem sets with nothing material.

OUTPUT RULES (strict, enforced by trim job):
- Path: problem_sets/<PROBLEM_SET_ID>/briefs/latest.md (memory_write, REPLACE semantics)
- Max 600 chars per brief.
- One file per problem set. Do NOT write a global daily file.
- Do NOT narrate OSINT events. Distill to lessons.
- If NO problem set has material changes, respond "No material changes" and stop. Do not write anything.

FORMAT:
# <PS name> — <YYYY-MM-DD>
**Status**: <1 line>
**Changes**: <bulleted, max 3>
**Action**: <commander attention required, or "routine">`,
      },
      {
        name: 'bastion_knowledge_sync',
        cronOverride: '0 */6 * * *', // every 6 hours
        prompt: `Maintain compact per-problem-set context files that replace prior versions.

STEPS:
1. Use bastion category=ops action=list_all to get active problem sets.
2. For each active problem set:
   - bastion category=ops action=read_problem_set with problem_set_id
   - bastion category=brain action=stats with problem_set_id
3. Write a compact context file per problem set.

OUTPUT RULES (strict):
- Path: problem_sets/<PROBLEM_SET_ID>/context.md (memory_write, REPLACE semantics)
- Max 1500 chars per file.
- One file per problem set.
- Do NOT write narrative summaries, retrospectives, or event logs.
- Skip problem sets whose underlying data has not changed.

FORMAT:
# <PS name>
ID: <PS-...>
Scenario: <1 sentence summary>
Focus: <geographic / functional scope>
Brain slice: <N actors, M relationships>
Active PIRs: <count>
Current phase: <short>
Key actors: <top 5 names, comma-separated>
Last material change: <YYYY-MM-DD + 1 line>

If nothing has changed across all problem sets, respond "No changes" and stop.`,
      },
      {
        name: 'weekly_capability_update',
        cronOverride: '0 8 * * 1', // Mondays at 08:00
        prompt: `Maintain a compact capability reference that replaces prior versions. Do NOT append history.

STEPS:
1. Use bastion category=admin action=agent_list to get current agent count.
2. Check skill inventory via the available skills list.
3. Compare against prior CAPABILITIES.md if it exists.

OUTPUT RULES (strict):
- Path: CAPABILITIES.md (memory_write, REPLACE semantics — single canonical file)
- Max 800 chars total.
- Do NOT list every tool or agent individually.
- Do NOT narrate historical changes.

FORMAT:
# BASTION Capabilities (updated: YYYY-MM-DD)
**Agents**: <count>
**Tools**: <count> (via bastion category=admin)
**Skills**: <count>
**Recent changes**: <bulleted, max 3 one-liners, or "none">

If nothing has changed since last update, respond "No changes" and stop.`,
      },
    ];

    try {
      const pool = getIronclawPool();
      for (const r of refinements) {
        // Update action_config.description (the LLM prompt) and optionally
        // the trigger cron. Keep the routine enabled and preserve
        // everything else (max_iterations, auto_approve_tools, etc).
        const newActionConfig = JSON.stringify({
          title: r.name,
          description: r.prompt,
          max_iterations: 5, // tighter than the default 10
        });
        const result = r.cronOverride
          ? await pool.query(
              `UPDATE routines
               SET enabled = true,
                   action_config = $1::jsonb,
                   trigger_config = jsonb_set(trigger_config, '{schedule}', $2::jsonb),
                   updated_at = NOW()
               WHERE name = $3`,
              [newActionConfig, JSON.stringify(r.cronOverride), r.name],
            )
          : await pool.query(
              `UPDATE routines
               SET enabled = true,
                   action_config = $1::jsonb,
                   updated_at = NOW()
               WHERE name = $2`,
              [newActionConfig, r.name],
            );
        if (result.rowCount && result.rowCount > 0) {
          console.log(`[routine-service] Refined routine: ${r.name}`);
        }
      }
    } catch (err) {
      console.warn(
        '[routine-service] Failed to refine Ironclaw default routines:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Trim oversized memory_documents entries that exceed their expected
   * budget. Backstop for cases where the LLM ignores prompt size limits.
   * Runs periodically alongside the routine cleanup job.
   */
  async trimOversizedMemoryDocuments(): Promise<void> {
    // Path → max chars budget. Anything over gets truncated with a marker.
    const budgets: Array<{ pattern: string; maxChars: number }> = [
      { pattern: 'daily/%', maxChars: 4000 },
      { pattern: 'problem_sets/%/briefs/%', maxChars: 1000 },
      { pattern: 'problem_sets/%/context.md', maxChars: 2000 },
      { pattern: 'CAPABILITIES.md', maxChars: 1200 },
      { pattern: 'MEMORY.md', maxChars: 8000 },
    ];
    try {
      const pool = getIronclawPool();
      let totalTrimmed = 0;
      for (const b of budgets) {
        const result = await pool.query(
          `UPDATE memory_documents
           SET content = substring(content, 1, $1) || E'\n\n[...truncated by BASTION trim job — exceeded ' || $1 || ' char budget]'
           WHERE path LIKE $2 AND length(content) > $1`,
          [b.maxChars, b.pattern],
        );
        if (result.rowCount && result.rowCount > 0) {
          console.log(
            `[routine-service] Trimmed ${result.rowCount} oversized memory file(s) matching ${b.pattern} (budget: ${b.maxChars} chars)`,
          );
          totalTrimmed += result.rowCount;
        }
      }
      if (totalTrimmed === 0) {
        // Quiet success
      }
    } catch (err) {
      console.warn(
        '[routine-service] Failed to trim oversized memory documents:',
        err instanceof Error ? err.message : err,
      );
    }
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
        userId: 'default',
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
      await this.disableRoutine(routineId, 'default');
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
    const DEFAULT_CRON = '0 */2 * * *';    // every 2 hours (token budget control)
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
        userId: 'default',
        cron,
        prompt: `Autonomous monitoring cycle for problem_set_id="${problemSetId}". Be terse and surgical.

ASSESS (concise):
- Check graph contradictions and newly-answerable PIRs for this problem set only
- Check for material situation changes

ACT (only the 1-2 most important findings):
- Answer PIRs with new data
- Create alert via bastion category=ops action=send_alert for urgent findings ONLY

CRITICAL CONSTRAINTS — STRICTLY ENFORCED:
- DO NOT use memory_write, memory_read, or any memory_* tool
- DO NOT write daily logs or narratives
- DO NOT log per-event analysis
- Use bastion category=ops action=log_activity for brief entries (max 1 per cycle, under 200 chars, always include problem_set_id="${problemSetId}")
- Max 3 tool calls per cycle
- Response must be under 500 characters total
- If nothing material changed, respond with "No action required." and stop.`,
        cooldownSecs: 7200, // 2-hour cooldown (token budget control)
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
      await this.disableRoutine(`autonomous_monitoring__${problemSetId}`, 'default');
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
   * Register the brain slice curator routine for a specific problem set.
   *
   * COMPLEMENT to autonomous_monitoring (the watcher). Where the watcher
   * surfaces contradictions / answers PIRs / sends alerts, the curator
   * grows and prunes the PS brain slice from the global KG so the watcher
   * (and Ironclaw chat answers) have something to read.
   *
   * Cycle (each fire):
   *   1. Read PS scope fingerprint (geographic, actors, temporal, core problem)
   *      from problem_set_context (scoping interview output).
   *   2. Relevance sweep — bastion brain evaluate_relevance + augment_slice
   *      to pull in-scope global-KG actors that aren't yet sliced.
   *   3. Gap detection — bastion brain intelligence_gaps + active PIRs.
   *   4. Targeted collection — bastion intel web_search using the fingerprint
   *      + top gap topics; create research events.
   *   5. Ingest — bastion intel process_osint_event to RAFT-extract.
   *   6. Re-sweep — pull newly-extracted entities into the slice.
   *   7. Prune — bastion brain prune_slice for stale/orphan/out-of-scope.
   *   8. Log a one-line activity entry.
   *
   * The curator must NOT call memory_write — its job is graph curation,
   * not narrative memory. Memory hygiene is a separate routine.
   *
   * @param problemSetId - The problem set whose slice is being curated.
   * @param cronOverride - Optional cron override. Defaults to every 4 hours.
   */
  async registerBrainCurator(problemSetId: string, cronOverride?: string): Promise<void> {
    const DEFAULT_CRON = '0 */4 * * *'; // every 4 hours — slower than the watcher
    const MIN_CRON = '*/30 * * * *';    // minimum 30 minutes (curator is heavier)
    let cron = cronOverride ?? DEFAULT_CRON;

    const minuteField = cron.split(' ')[0];
    const intervalMatch = minuteField.match(/^\*\/(\d+)$/);
    if (intervalMatch) {
      const intervalMinutes = parseInt(intervalMatch[1], 10);
      if (intervalMinutes < 30) {
        console.warn(
          `[routine-service] registerBrainCurator: cron interval ${intervalMinutes} min is below 30-min minimum. ` +
          `Clamping to ${MIN_CRON}.`,
        );
        cron = MIN_CRON;
      }
    }

    let fingerprint = '';
    try {
      const { buildScopeFingerprint } = await import('./scope-fingerprint.js');
      fingerprint = await buildScopeFingerprint(problemSetId);
    } catch (err) {
      console.warn(
        `[routine-service] registerBrainCurator: failed to build scope fingerprint for ${problemSetId}:`,
        err instanceof Error ? err.message : err,
      );
    }

    const fingerprintBlock = fingerprint
      ? `\n${fingerprint}\n`
      : `\n[PROBLEM SET SCOPE FINGERPRINT — UNAVAILABLE]\nNo scoping interview has been run for this problem set. Be conservative — only sweep actors with workspaceId="${problemSetId}" until scoping is provided.\n`;

    try {
      await this.upsertRoutine({
        name: `brain_curator__${problemSetId}`,
        description: `Continuous brain slice curator for problem set ${problemSetId}. Pulls in-scope content from the global KG, fills intelligence gaps via web search and OSINT, prunes stale nodes.`,
        userId: 'default',
        cron,
        prompt: `Brain slice curator cycle for problem_set_id="${problemSetId}". You are growing and maintaining the PS-specific knowledge graph slice — NOT writing memory documents.
${fingerprintBlock}
EXECUTE THE FOLLOWING SEQUENCE. Be terse. Skip steps where there is nothing to do.

STEP 1 — Relevance sweep:
Call bastion category=brain action=evaluate_relevance with problem_set_id="${problemSetId}". For each candidate scoring above the relevance threshold, call bastion category=brain action=augment_slice to pull it into the slice. Do not pull more than 10 actors per cycle.

STEP 2 — Gap detection:
Call bastion category=brain action=intelligence_gaps with problem_set_id="${problemSetId}". Then list active PIRs via bastion category=design action=list_pirs problem_set_id="${problemSetId}" status="ACTIVE". Pick the 1-2 highest-priority gaps that the scope fingerprint above suggests are answerable from open sources.

STEP 3 — Targeted collection:
For each selected gap, construct ONE web search query that combines: a primary actor or geographic term from the fingerprint + the gap topic + a recency filter. Call bastion category=intel action=web_search. Discard results obviously outside the scope (excluded actors, excluded geographies, wrong era).

STEP 4 — Ingest into global KG:
For each retained search result, call bastion category=intel action=create_research_event with the URL, title, and snippet, then bastion category=intel action=process_osint_event on the returned event id. This routes the content through RAFT extraction so new actors/relationships land in the global graph.

STEP 5 — Re-sweep:
Call bastion category=brain action=evaluate_relevance again so the freshly-extracted entities get pulled into the slice via augment_slice.

STEP 6 — Prune:
Call bastion category=brain action=get_slice_stats. If orphan_count > 5 or any actor in the slice is now clearly outside the scope fingerprint (excluded actor or excluded geography), call bastion category=brain action=prune_slice for those actor ids.

STEP 7 — Log:
Call bastion category=ops action=log_activity with a single line under 200 chars summarizing: gaps_found / events_ingested / actors_added / actors_pruned. Always include problem_set_id="${problemSetId}".

CRITICAL CONSTRAINTS:
- DO NOT call memory_write, memory_read, or any memory_* tool. Graph mutations only.
- Hard cap: 12 tool calls per cycle. Stop early if the budget is exhausted.
- If STEP 1 returns no candidates AND STEP 2 returns no gaps, respond "Slice stable — no curation needed." and stop.
- Stay strictly within the scope fingerprint. Out-of-scope content is a bug, not a feature.
- Response under 600 characters total.`,
        cooldownSecs: 14400, // 4-hour cooldown matches default cadence
      });
      console.log(`[routine-service] Registered brain curator for problem set ${problemSetId} (${cron})`);
    } catch (err) {
      console.warn(
        `[routine-service] Failed to register brain curator for ${problemSetId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Unregister the brain curator routine for a specific problem set.
   * Call when a problem set is archived or deleted.
   */
  async unregisterBrainCurator(problemSetId: string): Promise<void> {
    try {
      await this.disableRoutine(`brain_curator__${problemSetId}`, 'default');
      console.log(`[routine-service] Unregistered brain curator for problem set ${problemSetId}`);
    } catch (err) {
      console.warn(
        `[routine-service] Failed to unregister brain curator for ${problemSetId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Re-register the brain curator with a freshly-rebuilt scope fingerprint.
   * Called when the scoping interview is re-run so the new scope takes
   * effect on the next curator fire.
   */
  async refreshBrainCuratorScope(problemSetId: string): Promise<void> {
    try {
      const { invalidateScopeFingerprint } = await import('./scope-fingerprint.js');
      invalidateScopeFingerprint(problemSetId);
      await this.registerBrainCurator(problemSetId);
      console.log(`[routine-service] Refreshed brain curator scope for problem set ${problemSetId}`);
    } catch (err) {
      console.warn(
        `[routine-service] Failed to refresh brain curator scope for ${problemSetId}:`,
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

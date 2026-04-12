/**
 * Agent Config Store
 *
 * Phase 60 Plan 03: CRUD operations for per-user AgentConfig.
 * Provides getByDid, upsert, getByNearAccount, and createDefault.
 *
 * Uses bastion-postgres (main DB pool) — NOT ironclaw-postgres.
 * All writes are upserted on conflict(did) to ensure idempotency.
 */

import { getPool } from '../lib/database.js';
import type {
  AgentConfig,
  CustomSkill,
  RoutineSpec,
  StaffSection,
  OutputFormat,
  TonePreference,
  NotificationLevel,
} from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToAgentConfig(row: Record<string, unknown>): AgentConfig {
  return {
    did: row.did as string,
    nearAccount: row.near_account as string,
    displayName: (row.display_name as string) ?? '',
    rank: (row.rank as string) ?? '',
    honorific: (row.honorific as 'Sir' | "Ma'am" | null) ?? null,
    staffSection: (row.staff_section as StaffSection) ?? 'Other',
    position: (row.position as string) ?? '',
    unit: (row.unit as string) ?? '',
    higherHQ: (row.higher_hq as string) ?? '',
    reportingToDid: (row.reporting_to_did as string) ?? null,
    activeOperationIds: (row.active_operation_ids as string[]) ?? [],
    areasOfResponsibility: (row.areas_of_responsibility as string[]) ?? [],
    blufEnforced: (row.bluf_enforced as boolean) ?? true,
    outputFormat: (row.output_format as OutputFormat) ?? 'Auto',
    verbosityLevel: (row.verbosity_level as number) ?? 3,
    tone: (row.tone as TonePreference) ?? 'Professional',
    expandAcronyms: (row.expand_acronyms as boolean) ?? false,
    classificationMarkings: (row.classification_markings as boolean) ?? true,
    customPersonaInstructions: (row.custom_persona_instructions as string) ?? '',
    telegramEnabled: (row.telegram_enabled as boolean) ?? false,
    telegramChatId: (row.telegram_chat_id as string) ?? null,
    telegramNotificationLevel: (row.telegram_notification_level as NotificationLevel) ?? 'Routine',
    enabledSkillPacks: (row.enabled_skill_packs as string[]) ?? [],
    customSkills: (row.custom_skills as CustomSkill[]) ?? [],
    heartbeatDirectives: (row.heartbeat_directives as string) ?? '',
    customRoutines: (row.custom_routines as RoutineSpec[]) ?? [],
    identityLastSyncedAt: row.identity_last_synced_at ? new Date(row.identity_last_synced_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ---------------------------------------------------------------------------
// AgentConfigStore
// ---------------------------------------------------------------------------

class AgentConfigStore {
  /**
   * Retrieve AgentConfig by DID. Returns null if not found.
   */
  async getByDid(did: string): Promise<AgentConfig | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM agent_config WHERE did = $1 LIMIT 1`,
      [did],
    );
    if (result.rows.length === 0) return null;
    return rowToAgentConfig(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Retrieve AgentConfig by NEAR account ID. Returns null if not found.
   */
  async getByNearAccount(nearAccount: string): Promise<AgentConfig | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM agent_config WHERE near_account = $1 LIMIT 1`,
      [nearAccount],
    );
    if (result.rows.length === 0) return null;
    return rowToAgentConfig(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Upsert an AgentConfig row. Inserts on first save; updates all fields
   * on conflict(did). The updated_at trigger handles timestamp updates.
   *
   * Returns the saved config (re-read from DB to reflect trigger values).
   */
  async upsert(config: AgentConfig): Promise<AgentConfig> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO agent_config (
        did,
        near_account,
        display_name,
        rank,
        honorific,
        staff_section,
        position,
        unit,
        higher_hq,
        reporting_to_did,
        active_operation_ids,
        areas_of_responsibility,
        bluf_enforced,
        output_format,
        verbosity_level,
        tone,
        expand_acronyms,
        classification_markings,
        custom_persona_instructions,
        telegram_enabled,
        telegram_chat_id,
        telegram_notification_level,
        enabled_skill_packs,
        custom_skills,
        heartbeat_directives,
        custom_routines,
        identity_last_synced_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::jsonb, $12::jsonb,
        $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22,
        $23::jsonb, $24::jsonb,
        $25, $26::jsonb,
        $27
      )
      ON CONFLICT (did) DO UPDATE SET
        near_account                = EXCLUDED.near_account,
        display_name                = EXCLUDED.display_name,
        rank                        = EXCLUDED.rank,
        honorific                   = EXCLUDED.honorific,
        staff_section               = EXCLUDED.staff_section,
        position                    = EXCLUDED.position,
        unit                        = EXCLUDED.unit,
        higher_hq                   = EXCLUDED.higher_hq,
        reporting_to_did            = EXCLUDED.reporting_to_did,
        active_operation_ids        = EXCLUDED.active_operation_ids,
        areas_of_responsibility     = EXCLUDED.areas_of_responsibility,
        bluf_enforced               = EXCLUDED.bluf_enforced,
        output_format               = EXCLUDED.output_format,
        verbosity_level             = EXCLUDED.verbosity_level,
        tone                        = EXCLUDED.tone,
        expand_acronyms             = EXCLUDED.expand_acronyms,
        classification_markings     = EXCLUDED.classification_markings,
        custom_persona_instructions = EXCLUDED.custom_persona_instructions,
        telegram_enabled            = EXCLUDED.telegram_enabled,
        telegram_chat_id            = EXCLUDED.telegram_chat_id,
        telegram_notification_level = EXCLUDED.telegram_notification_level,
        enabled_skill_packs         = EXCLUDED.enabled_skill_packs,
        custom_skills               = EXCLUDED.custom_skills,
        heartbeat_directives        = EXCLUDED.heartbeat_directives,
        custom_routines             = EXCLUDED.custom_routines,
        identity_last_synced_at     = EXCLUDED.identity_last_synced_at`,
      [
        config.did,
        config.nearAccount,
        config.displayName,
        config.rank,
        config.honorific,
        config.staffSection,
        config.position,
        config.unit,
        config.higherHQ,
        config.reportingToDid,
        JSON.stringify(config.activeOperationIds),
        JSON.stringify(config.areasOfResponsibility),
        config.blufEnforced,
        config.outputFormat,
        config.verbosityLevel,
        config.tone,
        config.expandAcronyms,
        config.classificationMarkings,
        config.customPersonaInstructions,
        config.telegramEnabled,
        config.telegramChatId,
        config.telegramNotificationLevel,
        JSON.stringify(config.enabledSkillPacks),
        JSON.stringify(config.customSkills),
        config.heartbeatDirectives,
        JSON.stringify(config.customRoutines),
        config.identityLastSyncedAt ?? null,
      ],
    );

    // Re-read to get updated_at from trigger
    const saved = await this.getByDid(config.did);
    if (!saved) throw new Error(`AgentConfigStore.upsert: re-read failed for did=${config.did}`);
    return saved;
  }

  /**
   * Create a new AgentConfig with sensible defaults for a first-time user.
   * Called by the REST API when a user hasn't configured their agent yet.
   */
  async createDefault(did: string, nearAccount: string): Promise<AgentConfig> {
    const defaultConfig: AgentConfig = {
      did,
      nearAccount,
      displayName: nearAccount.replace('.near', '').replace(/\./g, ' '),
      rank: '',
      honorific: null,
      staffSection: 'Other',
      position: '',
      unit: '',
      higherHQ: '',
      reportingToDid: null,
      activeOperationIds: [],
      areasOfResponsibility: [],
      blufEnforced: true,
      outputFormat: 'Auto',
      verbosityLevel: 3,
      tone: 'Professional',
      expandAcronyms: false,
      classificationMarkings: true,
      customPersonaInstructions: '',
      telegramEnabled: false,
      telegramChatId: null,
      telegramNotificationLevel: 'Routine',
      enabledSkillPacks: [],
      customSkills: [],
      heartbeatDirectives: '',
      customRoutines: [],
      identityLastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.upsert(defaultConfig);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const agentConfigStore = new AgentConfigStore();

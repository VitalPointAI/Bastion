/**
 * Agent Config Frontend Type Definitions
 *
 * Phase 60 Plan 04: Frontend types mirroring the backend AgentConfig interface.
 * Duplicated per project convention (no shared package, backend authoritative).
 *
 * Source of truth: backend/src/ironclaw/ironclaw-types.ts AgentConfig interface.
 */

// ─── Union Types ─────────────────────────────────────────────────────────────

/** Staff section designation. Drives SOUL.md personality template selection. */
export type StaffSection =
  | 'Commander'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S6'
  | 'S9'
  | 'XO'
  | 'CSM'
  | 'Other';

/** Output format preference for Ironclaw responses. */
export type OutputFormat = 'MDMP' | 'StaffSummary' | 'FreeForm' | 'Auto';

/** Tone preference for Ironclaw communication style. */
export type TonePreference = 'FormalMilitary' | 'Professional' | 'Direct' | 'Collaborative';

/** Notification urgency level for Telegram/heartbeat alerts. */
export type NotificationLevel = 'Critical' | 'Urgent' | 'Routine' | 'Informational';

// ─── Sub-types ────────────────────────────────────────────────────────────────

/** A custom skill defined by the user for their Ironclaw instance. */
export interface CustomSkill {
  name: string;
  description: string;
  triggers: string[];
}

/** A scheduled routine directive for the heartbeat system. */
export interface RoutineSpec {
  name: string;
  cron: string;
  description: string;
  enabled: boolean;
}

// ─── AgentConfig ─────────────────────────────────────────────────────────────

/**
 * Per-user agent configuration.
 *
 * Blueprint Phase 2: "One agent, many lenses."
 * Each AgentConfig drives generation of USER.md / SOUL.md / HEARTBEAT.md /
 * AGENTS.md identity files injected into Ironclaw's workspace before each job.
 *
 * SECURITY: clearanceLevel is intentionally absent — clearance is always
 * resolved at runtime from VC claims, never persisted here.
 */
export interface AgentConfig {
  /** User's DID (primary key). */
  did: string;
  /** NEAR account ID associated with this user. */
  nearAccount: string;

  // --- Identity ---
  displayName: string;
  rank: string;
  staffSection: StaffSection;
  position: string;
  unit: string;
  higherHQ: string;
  /** DID of the officer this user reports to, or null if top-level. */
  reportingToDid: string | null;
  /** IDs of problem sets (operations) this user is actively involved in. */
  activeOperationIds: string[];
  /** Geographic or functional areas of responsibility. */
  areasOfResponsibility: string[];

  // --- Output / Communication Preferences ---
  /** Enforce BLUF (Bottom Line Up Front) on all responses. */
  blufEnforced: boolean;
  outputFormat: OutputFormat;
  /** Verbosity level 1–5 (1 = terse, 5 = detailed). */
  verbosityLevel: number;
  tone: TonePreference;
  expandAcronyms: boolean;
  classificationMarkings: boolean;
  /** Free-text persona customization instructions appended to SOUL.md. */
  customPersonaInstructions: string;

  // --- Channel Preferences ---
  telegramEnabled: boolean;
  telegramChatId: string | null;
  telegramNotificationLevel: NotificationLevel;

  // --- Skills ---
  /** IDs of pre-built skill packs enabled for this user. */
  enabledSkillPacks: string[];
  /** User-defined custom skills. */
  customSkills: CustomSkill[];

  // --- Heartbeat Directives ---
  /** Free-text monitoring directives written into HEARTBEAT.md. */
  heartbeatDirectives: string;
  /** Scheduled routines registered with the heartbeat system. */
  customRoutines: RoutineSpec[];

  // --- Sync Tracking ---
  /** Last time identity files were written to Ironclaw's workspace. ISO string on frontend. */
  identityLastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

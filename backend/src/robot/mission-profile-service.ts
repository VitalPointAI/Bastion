/**
 * Mission Behavior Profile Registry
 *
 * Phase 44 Plan 06: Defines how the robot behaves during each mission type.
 * Mission profiles govern navigation approach, comms cadence, obstacle response,
 * speed limits, and vision detection cadence.
 *
 * Designed for future DAO-governed profile management (add/update via governance
 * proposal). Currently in-memory with well-known defaults.
 *
 * Uses const object pattern (not enum) per project convention (erasableSyntaxOnly).
 */

// ---------------------------------------------------------------------------
// MissionProfile interface
// ---------------------------------------------------------------------------

export interface MissionProfile {
  /** Unique profile identifier */
  name: string;
  /** Maximum speed 0-255 */
  max_speed: number;
  /** Vision detection loop interval in milliseconds */
  vision_cadence_ms: number;
  /** How often to transmit telemetry / detections to Bastion */
  comms_cadence: 'continuous' | 'event' | 'minimal';
  /** How the robot responds to detected obstacles */
  obstacle_response: 'avoid' | 'stop_report' | 'log_continue';
  /** High-level navigation approach behavior */
  approach_behavior: 'stealth' | 'direct' | 'standard';
  /** Optional: mission commands this profile is optimised for */
  recommended_for?: string[];
}

// ---------------------------------------------------------------------------
// Default profiles
// ---------------------------------------------------------------------------

export const DEFAULT_PROFILES: Record<string, MissionProfile> = {
  stealth_recon: {
    name: 'stealth_recon',
    max_speed: 80,
    vision_cadence_ms: 500,
    comms_cadence: 'minimal',
    obstacle_response: 'avoid',
    approach_behavior: 'stealth',
    recommended_for: ['recon_area', 'visual_search'],
  },

  direct_resupply: {
    name: 'direct_resupply',
    max_speed: 200,
    vision_cadence_ms: 1000,
    comms_cadence: 'event',
    obstacle_response: 'stop_report',
    approach_behavior: 'direct',
    recommended_for: ['resupply_route'],
  },

  patrol: {
    name: 'patrol',
    max_speed: 120,
    vision_cadence_ms: 250,
    comms_cadence: 'continuous',
    obstacle_response: 'log_continue',
    approach_behavior: 'standard',
    recommended_for: ['patrol_route', 'overwatch'],
  },

  /** Coalition-specific example: NATO recon profile */
  nato_recon: {
    name: 'nato_recon',
    max_speed: 100,
    vision_cadence_ms: 500,
    comms_cadence: 'minimal',
    obstacle_response: 'avoid',
    approach_behavior: 'stealth',
  },
};

// ---------------------------------------------------------------------------
// MissionProfileService
// ---------------------------------------------------------------------------

export class MissionProfileService {
  private profiles: Record<string, MissionProfile>;

  constructor(initialProfiles: Record<string, MissionProfile> = DEFAULT_PROFILES) {
    // Copy so callers cannot mutate the module-level DEFAULT_PROFILES object
    this.profiles = { ...initialProfiles };
  }

  /**
   * Look up a profile by name.
   * Returns null if no profile with that name is registered.
   * (Future: query DAO-governed profile store)
   */
  resolveProfile(profileName: string): MissionProfile | null {
    return this.profiles[profileName] ?? null;
  }

  /**
   * Return the best-matched profile for a given mission command.
   * Falls back to 'patrol' if no profile explicitly recommends the command.
   */
  getDefaultProfileForCommand(command: string): MissionProfile {
    for (const profile of Object.values(this.profiles)) {
      if (profile.recommended_for?.includes(command)) {
        return profile;
      }
    }
    // Fallback: patrol is the safest general-purpose profile
    return this.profiles['patrol'] ?? Object.values(this.profiles)[0];
  }

  /**
   * List all registered profiles.
   */
  listProfiles(): MissionProfile[] {
    return Object.values(this.profiles);
  }

  /**
   * Register a custom profile in memory.
   * (Future: persist via DAO governance proposal)
   */
  addProfile(profile: MissionProfile): void {
    this.profiles[profile.name] = profile;
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let _instance: MissionProfileService | null = null;

export function getMissionProfileService(): MissionProfileService {
  if (!_instance) {
    _instance = new MissionProfileService();
  }
  return _instance;
}

/**
 * Coalition Caveat Service
 *
 * Phase 48 Plan 03: Swarm-level coalition policy enforcement.
 *
 * Enforces national caveats (rules of engagement, observer status, etc.)
 * across all members of a coalition swarm before mission dispatch.
 * A mission is blocked if ANY member's national DID forbids the mission type.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A restriction entry in a national coalition profile */
export interface CaveatRestriction {
  /** Mission type this restriction applies to. Use '*' for wildcard (all missions). */
  mission_type: string;
  /** If set, restriction only applies to this area type. Absent = all areas. */
  area_type?: 'urban' | 'rural' | 'unknown';
  /** If mission_type is '*', these mission types are exempt from the restriction. */
  except?: string[];
  /** Human-readable reason for the restriction (included in block result). */
  reason: string;
}

/** National coalition profile — maps a DID to mission authority rules */
export interface CoalitionProfile {
  /** Human-readable nation name */
  nation: string;
  /** DID of the national coalition resource */
  did: string;
  /** Authority level: full, restricted, or observer */
  authority: 'full' | 'restricted' | 'observer';
  /** Explicit list of mission types this nation permits */
  allowed_missions: string[];
  /** Ordered restriction list — first matching restriction wins */
  restrictions: CaveatRestriction[];
}

/** Result of a swarm-level caveat check */
export interface CaveatCheckResult {
  /** True only if ALL swarm members are permitted for the mission */
  allowed: boolean;
  /** Robots that are blocked, with their DID, nation, and reason string */
  blockedRobots: Array<{
    robotId: string;
    nationalDid: string;
    nation: string;
    reason: string;
  }>;
}

// ---------------------------------------------------------------------------
// Coalition profile loader (cached after first load)
// ---------------------------------------------------------------------------

let _profileCache: Record<string, CoalitionProfile> | null = null;

/**
 * Load coalition profiles from the JSON data file.
 *
 * Results are cached in module scope — profiles are loaded once at startup
 * and re-used across all subsequent calls. Override the path in tests by
 * passing an explicit argument.
 */
export function loadCoalitionProfiles(
  profilesPath?: string,
): Record<string, CoalitionProfile> {
  if (_profileCache !== null && profilesPath === undefined) {
    return _profileCache;
  }

  const resolvedPath =
    profilesPath ??
    (() => {
      // Locate backend/data/coalition-profiles.json relative to this source file.
      // __dirname equivalent in ESM:
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      return resolve(__dirname, '../../data/coalition-profiles.json');
    })();

  const raw = readFileSync(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, CoalitionProfile>;

  if (profilesPath === undefined) {
    _profileCache = parsed;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Core caveat check
// ---------------------------------------------------------------------------

/**
 * Determine whether ALL members of a swarm are permitted to participate
 * in a given mission type and area combination.
 *
 * @param missionType  - Mission command string (e.g. 'swarm_advance')
 * @param areaType     - Operational area classification
 * @param swarmMembers - All robots that will participate in the mission
 * @param profiles     - Coalition profile registry (pass TEST_PROFILES in tests)
 * @returns CaveatCheckResult — allowed flag + list of any blocked robots
 */
export function checkSwarmCaveat(
  missionType: string,
  areaType: 'urban' | 'rural' | 'unknown',
  swarmMembers: Array<{ robotId: string; nationalDid: string }>,
  profiles: Record<string, CoalitionProfile>,
): CaveatCheckResult {
  const blockedRobots: CaveatCheckResult['blockedRobots'] = [];

  for (const member of swarmMembers) {
    const blockReason = _evaluateMemberCaveat(member, missionType, areaType, profiles);
    if (blockReason !== null) {
      blockedRobots.push(blockReason);
    }
  }

  return { allowed: blockedRobots.length === 0, blockedRobots };
}

/**
 * Evaluate a single swarm member against the caveat profiles.
 * Returns a block descriptor if the member is blocked, or null if permitted.
 */
function _evaluateMemberCaveat(
  member: { robotId: string; nationalDid: string },
  missionType: string,
  areaType: 'urban' | 'rural' | 'unknown',
  profiles: Record<string, CoalitionProfile>,
): CaveatCheckResult['blockedRobots'][number] | null {
  // Find the matching profile by DID
  const profile = Object.values(profiles).find(
    (p) => p.did === member.nationalDid,
  );

  if (!profile) {
    // Unknown DID — block with an informative reason
    return {
      robotId: member.robotId,
      nationalDid: member.nationalDid,
      nation: 'Unknown',
      reason: `No coalition profile found for DID ${member.nationalDid}`,
    };
  }

  // 1. Walk restriction list first — explicit restrictions take precedence
  //    over the allowed_missions check, so specific reasons surface correctly.
  for (const restriction of profile.restrictions) {
    if (_restrictionApplies(restriction, missionType, areaType)) {
      return {
        robotId: member.robotId,
        nationalDid: member.nationalDid,
        nation: profile.nation,
        reason: restriction.reason,
      };
    }
  }

  // 2. If no restriction matched, check the allowed_missions allowlist.
  //    A mission not in allowed_missions and not explicitly handled by
  //    a restriction is blocked with a generic reason.
  if (!profile.allowed_missions.includes(missionType)) {
    return {
      robotId: member.robotId,
      nationalDid: member.nationalDid,
      nation: profile.nation,
      reason: `${profile.nation}: mission type '${missionType}' not in allowed_missions`,
    };
  }

  return null; // Member is cleared
}

/**
 * Determine whether a restriction entry blocks a specific mission + area combo.
 */
function _restrictionApplies(
  restriction: CaveatRestriction,
  missionType: string,
  areaType: 'urban' | 'rural' | 'unknown',
): boolean {
  const exceptList = restriction.except ?? [];

  // Wildcard mission type: applies to everything EXCEPT the `except` list
  if (restriction.mission_type === '*') {
    if (exceptList.includes(missionType)) {
      return false; // Mission is exempt from this wildcard restriction
    }
    // Area constraint check for wildcard
    if (restriction.area_type !== undefined && restriction.area_type !== areaType) {
      return false;
    }
    return true;
  }

  // Specific mission type match
  if (restriction.mission_type !== missionType) {
    return false;
  }

  // Area constraint: if restriction has an area_type, it only blocks that area
  if (restriction.area_type !== undefined && restriction.area_type !== areaType) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Suggest alternative asset
// ---------------------------------------------------------------------------

/**
 * Given a set of blocked robots, suggest a replacement from the swarm
 * whose national profile permits the requested mission type.
 *
 * @param blockedRobots - Robots that failed caveat check
 * @param allMembers    - All swarm members (blocked + unblocked)
 * @param profiles      - Coalition profile registry
 * @param missionType   - The mission type the blocked robot can't perform
 * @returns Robot ID of a suitable alternative, or null if none exists
 */
export function suggestAlternativeAsset(
  blockedRobots: CaveatCheckResult['blockedRobots'],
  allMembers: Array<{ robotId: string; nationalDid: string }>,
  profiles: Record<string, CoalitionProfile>,
  missionType: string,
): string | null {
  const blockedIds = new Set(blockedRobots.map((r) => r.robotId));

  for (const member of allMembers) {
    if (blockedIds.has(member.robotId)) {
      continue; // Skip the blocked robot itself
    }

    const profile = Object.values(profiles).find(
      (p) => p.did === member.nationalDid,
    );
    if (!profile) continue;

    if (profile.allowed_missions.includes(missionType)) {
      // Quick restriction scan (area-agnostic — just check if broadly allowed)
      const globalBlock = profile.restrictions.find(
        (r) =>
          r.mission_type === missionType &&
          r.area_type === undefined,
      );
      if (!globalBlock) {
        return member.robotId;
      }
    }
  }

  return null;
}

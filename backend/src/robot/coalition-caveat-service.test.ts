/**
 * Coalition Caveat Service — Behavioral Tests
 *
 * Phase 48 Plan 03: Validates swarm-level caveat enforcement
 * for Taiwan, US, and Australia national profiles.
 */

import { describe, it, expect } from 'vitest';
import { checkSwarmCaveat, suggestAlternativeAsset } from './coalition-caveat-service.js';
import type { CoalitionProfile, CaveatCheckResult } from './coalition-caveat-service.js';

// ─── Inline profile fixtures (no file I/O in tests) ──────────────────────────

const TEST_PROFILES: Record<string, CoalitionProfile> = {
  'tw-defense': {
    nation: 'Taiwan',
    did: 'did:near:resource-tw-coalition',
    authority: 'full',
    allowed_missions: ['recon_area', 'swarm_recon', 'swarm_advance', 'find_engage', 'swarm_patrol'],
    restrictions: [],
  },
  'us-coalition': {
    nation: 'United States',
    did: 'did:near:resource-us-coalition',
    authority: 'restricted',
    allowed_missions: ['recon_area', 'swarm_recon', 'swarm_patrol'],
    restrictions: [
      {
        mission_type: 'swarm_advance',
        area_type: 'urban',
        reason: 'US national policy: no offensive urban ops',
      },
      {
        mission_type: 'find_engage',
        reason: 'US ROE: engagement requires host-nation lead',
      },
    ],
  },
  'au-observer': {
    nation: 'Australia',
    did: 'did:near:resource-au-coalition',
    authority: 'observer',
    allowed_missions: ['recon_area', 'swarm_recon'],
    restrictions: [
      {
        mission_type: '*',
        except: ['recon_area', 'swarm_recon'],
        reason: 'Australia observer status: recon only',
      },
    ],
  },
};

// ─── Swarm member helpers ─────────────────────────────────────────────────────

const TW_MEMBER = { robotId: 'robot-tw-01', nationalDid: 'did:near:resource-tw-coalition' };
const US_MEMBER = { robotId: 'robot-us-01', nationalDid: 'did:near:resource-us-coalition' };
const AU_MEMBER = { robotId: 'robot-au-01', nationalDid: 'did:near:resource-au-coalition' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkSwarmCaveat', () => {
  it('blocks US member for urban swarm_advance', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'swarm_advance',
      'urban',
      [US_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedRobots).toHaveLength(1);
    expect(result.blockedRobots[0].robotId).toBe('robot-us-01');
    expect(result.blockedRobots[0].nation).toBe('United States');
    expect(result.blockedRobots[0].reason).toBe('US national policy: no offensive urban ops');
  });

  it('allows Australia member for swarm_recon in urban', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'swarm_recon',
      'urban',
      [AU_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(true);
    expect(result.blockedRobots).toHaveLength(0);
  });

  it('allows Taiwan full authority — swarm_advance urban passes', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'swarm_advance',
      'urban',
      [TW_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(true);
    expect(result.blockedRobots).toHaveLength(0);
  });

  it('blocks mixed swarm (tw leader + us follower) for urban advance — US follower blocked', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'swarm_advance',
      'urban',
      [TW_MEMBER, US_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedRobots).toHaveLength(1);
    expect(result.blockedRobots[0].robotId).toBe('robot-us-01');
  });

  it('blocks Australia for find_engage (not in allowed_missions)', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'find_engage',
      'rural',
      [AU_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedRobots).toHaveLength(1);
    expect(result.blockedRobots[0].nation).toBe('Australia');
  });

  it('blocks US for find_engage in rural (restriction has no area_type — global)', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'find_engage',
      'rural',
      [US_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedRobots[0].reason).toBe('US ROE: engagement requires host-nation lead');
  });

  it('allows US swarm_advance in rural (restriction only applies to urban)', () => {
    const result: CaveatCheckResult = checkSwarmCaveat(
      'swarm_advance',
      'rural',
      [US_MEMBER],
      TEST_PROFILES,
    );
    expect(result.allowed).toBe(true);
  });
});

describe('suggestAlternativeAsset', () => {
  it('suggests Taiwan robot as alternative when US is blocked for urban advance', () => {
    const blockedRobots = [
      {
        robotId: 'robot-us-01',
        nationalDid: 'did:near:resource-us-coalition',
        nation: 'United States',
        reason: 'US national policy: no offensive urban ops',
      },
    ];
    const allMembers = [TW_MEMBER, US_MEMBER];
    const suggestion = suggestAlternativeAsset(
      blockedRobots,
      allMembers,
      TEST_PROFILES,
      'swarm_advance',
    );
    expect(suggestion).toBe('robot-tw-01');
  });

  it('returns null when no alternative is available', () => {
    const blockedRobots = [
      {
        robotId: 'robot-au-01',
        nationalDid: 'did:near:resource-au-coalition',
        nation: 'Australia',
        reason: 'Australia observer status: recon only',
      },
    ];
    const allMembers = [AU_MEMBER]; // Only AU in swarm
    const suggestion = suggestAlternativeAsset(
      blockedRobots,
      allMembers,
      TEST_PROFILES,
      'find_engage',
    );
    expect(suggestion).toBeNull();
  });
});

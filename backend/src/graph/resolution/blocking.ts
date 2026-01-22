/**
 * Blocking Algorithm for Efficient Entity Resolution
 *
 * Uses multiple blocking keys to reduce O(n^2) comparisons to a manageable scale.
 * Only actors sharing at least one blocking key are compared.
 */

import type { Actor } from '../raft/types.js';
import { normalizeName, matchWithAliases, type MatchCandidate } from './string-matcher.js';

/**
 * Generate blocking keys for an actor
 * Multiple keys allow for different matching strategies
 */
export function generateBlockingKeys(actor: Actor): string[] {
  const keys: Set<string> = new Set();
  const normalized = normalizeName(actor.name);

  // Key 1: First 3 characters (catches typos in middle/end)
  if (normalized.length >= 3) {
    keys.add(`prefix:${normalized.slice(0, 3)}`);
  }

  // Key 2: First letter + actor type (reduces comparison space)
  if (normalized.length >= 1) {
    keys.add(`type:${normalized[0]}:${actor.type}`);
  }

  // Key 3: Soundex-style phonetic key (first letter + consonant pattern)
  const consonants = normalized.replace(/[aeiou\s]/gi, '').slice(0, 4);
  if (consonants.length >= 2) {
    keys.add(`phonetic:${consonants}`);
  }

  // Add keys for aliases too
  for (const alias of actor.aliases) {
    const normAlias = normalizeName(alias);
    if (normAlias.length >= 3) {
      keys.add(`prefix:${normAlias.slice(0, 3)}`);
    }
  }

  return Array.from(keys);
}

/**
 * Build blocking index from actors
 * Maps blocking keys to actor IDs
 */
export function buildBlockingIndex(actors: Actor[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const actor of actors) {
    const keys = generateBlockingKeys(actor);
    for (const key of keys) {
      if (!index.has(key)) {
        index.set(key, new Set());
      }
      index.get(key)!.add(actor.id);
    }
  }

  return index;
}

/**
 * Find candidate matches using blocking
 * Only compares actors that share at least one blocking key
 */
export function findCandidateMatches(
  actors: Actor[],
  threshold: number = 0.85
): MatchCandidate[] {
  const actorMap = new Map(actors.map(a => [a.id, a]));
  const blockingIndex = buildBlockingIndex(actors);
  const compared = new Set<string>(); // Track compared pairs
  const candidates: MatchCandidate[] = [];

  // For each actor, find candidates via blocking keys
  for (const actor of actors) {
    const keys = generateBlockingKeys(actor);

    for (const key of keys) {
      const bucket = blockingIndex.get(key);
      if (!bucket) continue;

      for (const candidateId of bucket) {
        if (candidateId === actor.id) continue;

        // Create canonical pair key to avoid duplicates
        const pairKey = [actor.id, candidateId].sort().join(':');
        if (compared.has(pairKey)) continue;
        compared.add(pairKey);

        const candidate = actorMap.get(candidateId)!;
        const matchScore = matchWithAliases(
          actor.name,
          actor.aliases,
          candidate.name,
          candidate.aliases,
          threshold
        );

        if (matchScore) {
          candidates.push({
            actor1Id: actor.id,
            actor1Name: actor.name,
            actor2Id: candidate.id,
            actor2Name: candidate.name,
            score: matchScore,
          });
        }
      }
    }
  }

  // Sort by score descending
  return candidates.sort((a, b) => b.score.score - a.score.score);
}

/**
 * Entity Resolution Module
 *
 * Exports all entity resolution functions and types for deduplicating
 * actors across multiple strategic documents.
 */

// String matcher utilities
export {
  normalizeName,
  calculateSimilarity,
  matchWithAliases,
  type MatchScore,
  type MatchCandidate,
} from './string-matcher.js';

// Blocking algorithm
export {
  generateBlockingKeys,
  buildBlockingIndex,
  findCandidateMatches,
} from './blocking.js';

// Entity resolution service
export {
  EntityResolutionService,
  entityResolutionService,
  type ResolutionResult,
  type MergeResult,
} from './resolution-service.js';

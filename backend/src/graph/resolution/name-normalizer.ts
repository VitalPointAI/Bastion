/**
 * Name normalizer — pre-ingestion actor name canonicalization.
 *
 * Re-exports normalizeActorName() and CANONICAL_ALIASES from the alias registry,
 * providing a stable import path for consumers (OSINT sync, graph builder, etc.).
 *
 * Usage:
 *   import { normalizeActorName } from '../graph/resolution/name-normalizer.js';
 *   const canonical = normalizeActorName(rawActorName); // before MERGE
 *
 * Or via the resolution barrel:
 *   import { normalizeActorName } from '../graph/resolution/index.js';
 */
export { normalizeActorName, CANONICAL_ALIASES } from './canonical-aliases.js';

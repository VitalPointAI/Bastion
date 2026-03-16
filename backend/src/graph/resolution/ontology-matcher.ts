/**
 * Ontology Type Matcher
 *
 * Computes type similarity between two entities based on their JSON-LD type
 * (jsonldType property, e.g., 'cco:MilitaryOrganization').
 *
 * Used as signal 3 in the hybrid three-signal entity resolution scoring:
 *   0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim
 */

// ─── computeOntologyTypeSimilarity ───────────────────────────────────────────

/**
 * Compute ontology type similarity between two jsonldType strings.
 *
 * Scoring rules:
 * - Same type → 1.0
 * - Different type → 0.0
 * - Either/both null or undefined → 0.0 (unknown type is treated as no match)
 *
 * @param typeA - jsonldType of entity A (e.g., 'cco:MilitaryOrganization')
 * @param typeB - jsonldType of entity B
 */
export function computeOntologyTypeSimilarity(typeA: string, typeB: string): number {
  if (!typeA || !typeB) return 0.0;
  return typeA === typeB ? 1.0 : 0.0;
}

// ─── computeOntologyTypeScore (alias) ────────────────────────────────────────

/**
 * Alias for computeOntologyTypeSimilarity.
 * Exported for backward compatibility with the resolution-service test imports.
 */
export const computeOntologyTypeScore = computeOntologyTypeSimilarity;

/**
 * CCO Validator
 *
 * Validates entity-to-CCO class mappings and suggests appropriate
 * CCO classes for RAFT entity types. Uses the class map loaded by
 * cco-schema-loader.
 */

import type { CCOValidationResult } from './cco-types.js';
import { RAFT_TO_CCO_MAP } from './cco-types.js';
import { getCCOClassMap } from './cco-schema-loader.js';

/**
 * Validate that a proposed CCO class URI exists in the loaded schema.
 *
 * @param proposedClass - CCO class URI to validate (e.g. "cco:Person")
 * @returns Validation result with valid flag and optional reason
 */
export function validateCCOClass(proposedClass: string): CCOValidationResult {
  const map = getCCOClassMap();
  const mapping = map.get(proposedClass);

  if (!mapping) {
    return {
      valid: false,
      reason: `Unknown CCO class: ${proposedClass}`,
    };
  }

  return { valid: true };
}

/**
 * Suggest an appropriate CCO class for a RAFT entity type.
 *
 * Maps RAFT entity types (nation, organization, individual, etc.)
 * to their default CCO class using the RAFT_TO_CCO_MAP. Falls back
 * to 'cco:Entity' for unknown types.
 *
 * @param entityType - RAFT entity type string
 * @param _entityAttributes - Entity attributes for future refinement
 * @returns CCO class URI string
 */
export function suggestCCOClass(
  entityType: string,
  _entityAttributes: Record<string, unknown>,
): string {
  return RAFT_TO_CCO_MAP[entityType] ?? 'cco:Entity';
}

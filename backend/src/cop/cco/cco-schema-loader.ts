/**
 * CCO Schema Loader
 *
 * Loads a curated set of CCO (Common Core Ontology) classes from
 * a bundled JSON file into a flat Map for O(1) lookup at runtime.
 *
 * This pragmatic approach avoids an n3/rdflib dependency while
 * maintaining CCO compliance for entity standardization.
 *
 * Phase 47: Extended with loadBastionContext() / getBastionContext() to load
 * the bundled JSON-LD context file (bastion-context.jsonld) at startup.
 * Follows the same caching pattern as the CCO class map.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CCOClassMapping } from './cco-types.js';

// ============================================================================
// CCO Class Map (existing)
// ============================================================================

// Module-level class map populated by loadCCOSchema()
let ccoClassMap: Map<string, CCOClassMapping> = new Map();

/**
 * Load CCO schema from bundled JSON file into the module-level Map.
 * Call once at startup. Subsequent calls replace the existing map.
 */
export function loadCCOSchema(): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const jsonPath = join(currentDir, 'cco-classes.json');
  const raw = readFileSync(jsonPath, 'utf-8');
  const classes: CCOClassMapping[] = JSON.parse(raw);

  const newMap = new Map<string, CCOClassMapping>();
  for (const cls of classes) {
    newMap.set(cls.uri, cls);
  }
  ccoClassMap = newMap;
}

/**
 * Get the current CCO class map.
 * Returns an empty Map if loadCCOSchema() has not been called.
 */
export function getCCOClassMap(): Map<string, CCOClassMapping> {
  return ccoClassMap;
}

// ============================================================================
// Bastion JSON-LD Context (Phase 47)
// ============================================================================

/**
 * Parsed content of bastion-context.jsonld.
 * The @context object with all ontology namespace prefixes and property aliases.
 */
export type BastionContext = Record<string, unknown>;

// Module-level context object populated by loadBastionContext()
let bastionContext: BastionContext | null = null;

/**
 * Load the bundled JSON-LD context file (bastion-context.jsonld) and cache it.
 *
 * Call once at startup alongside loadCCOSchema(). Subsequent calls replace
 * the cached context. The bundled file is used for offline/DDIL operation —
 * the canonical hosted URL in the file is for interop signaling only and
 * is never fetched at runtime.
 *
 * @throws Error if the context file cannot be read or parsed
 */
export function loadBastionContext(): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const jsonldPath = join(currentDir, 'bastion-context.jsonld');
  const raw = readFileSync(jsonldPath, 'utf-8');
  bastionContext = JSON.parse(raw) as BastionContext;
}

/**
 * Get the cached Bastion JSON-LD context object.
 * Returns null if loadBastionContext() has not been called.
 */
export function getBastionContext(): BastionContext | null {
  return bastionContext;
}

/**
 * CCO Schema Loader
 *
 * Loads a curated set of CCO (Common Core Ontology) classes from
 * a bundled JSON file into a flat Map for O(1) lookup at runtime.
 *
 * This pragmatic approach avoids an n3/rdflib dependency while
 * maintaining CCO compliance for entity standardization.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CCOClassMapping } from './cco-types.js';

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

/**
 * Fixture Loader — Phase 31 Plan 04
 *
 * Loads and validates golden prompt test fixtures from JSON files.
 * Uses zod for runtime schema validation at load time.
 */

import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestFixture } from './validation-types.js';

// ---------------------------------------------------------------------------
// Zod schema matching TestFixture interface
// ---------------------------------------------------------------------------

const TestScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['determinism', 'reliability', 'authority']),
  input: z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
  expected: z.object({
    structuredOutput: z.record(z.string(), z.unknown()).optional(),
    freeTextReference: z.string().optional(),
    requiredCitations: z.array(z.string()).optional(),
    requiredTerminology: z.array(z.string()).optional(),
    forbiddenActions: z.array(z.string()).optional(),
    maxAutonomyLevel: z.string().optional(),
  }),
  scoringMethod: z.enum(['structured_diff', 'semantic_similarity', 'both']),
  weight: z.number().min(0).max(1),
});

const AdversarialScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  attackType: z.enum([
    'privilege_escalation',
    'scope_creep',
    'unauthorized_action',
  ]),
  input: z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
  }),
  expectedBehavior: z.enum(['refuse', 'escalate', 'scope_limit']),
});

export const FixtureSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  version: z.string(),
  lastReviewedAt: z.string(),
  scenarios: z.array(TestScenarioSchema),
  adversarialScenarios: z.array(AdversarialScenarioSchema),
  runCount: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Resolve fixtures directory relative to this module
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all fixture files from the fixtures directory.
 * Invalid files are logged as warnings and skipped.
 */
export async function loadAllFixtures(): Promise<TestFixture[]> {
  const fixtures: TestFixture[] = [];

  let files: string[];
  try {
    files = await readdir(FIXTURES_DIR);
  } catch {
    console.warn(`[fixture-loader] Fixtures directory not found: ${FIXTURES_DIR}`);
    return fixtures;
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = join(FIXTURES_DIR, file);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const parsed = FixtureSchema.parse(data);
      fixtures.push(parsed as TestFixture);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[fixture-loader] Skipping invalid fixture ${file}: ${msg}`);
    }
  }

  return fixtures;
}

/**
 * Cached index mapping agentId → fixture, built on first use.
 * Allows lookup by either filename (role key) or agentId field.
 */
let fixtureIndex: Map<string, TestFixture> | null = null;

async function getFixtureIndex(): Promise<Map<string, TestFixture>> {
  if (fixtureIndex) return fixtureIndex;
  fixtureIndex = new Map();
  const all = await loadAllFixtures();
  for (const fixture of all) {
    // Index by agentId (e.g., "cmd-001") and agentRole (e.g., "commander")
    fixtureIndex.set(fixture.agentId, fixture);
    fixtureIndex.set(fixture.agentRole, fixture);
  }
  return fixtureIndex;
}

/**
 * Load a single fixture by role key (filename without extension) or agentId.
 * Tries filename match first, then falls back to agentId/agentRole index.
 */
export async function loadFixture(
  roleKey: string,
): Promise<TestFixture | null> {
  // Try direct filename match first
  const filePath = join(FIXTURES_DIR, `${roleKey}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const parsed = FixtureSchema.parse(data);
    return parsed as TestFixture;
  } catch {
    // Fall through to index lookup
  }

  // Try agentId or agentRole index (e.g., "cmd-001" → commander.json)
  const index = await getFixtureIndex();
  return index.get(roleKey) ?? null;
}

/**
 * Validate fixture completeness beyond schema validation.
 * Checks business rules: minimum scenario counts, required fields.
 */
export function validateFixtureCompleteness(
  fixture: TestFixture,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (fixture.scenarios.length < 3) {
    errors.push(
      `Expected at least 3 scenarios, found ${fixture.scenarios.length}`,
    );
  }

  if (fixture.adversarialScenarios.length < 2) {
    errors.push(
      `Expected at least 2 adversarial scenarios, found ${fixture.adversarialScenarios.length}`,
    );
  }

  if (!fixture.agentId) {
    errors.push('Missing agentId');
  }

  if (!fixture.agentRole) {
    errors.push('Missing agentRole');
  }

  if (!fixture.version) {
    errors.push('Missing version');
  }

  if (!fixture.lastReviewedAt) {
    errors.push('Missing lastReviewedAt');
  }

  // Check that all three validation categories are covered
  const categories = new Set(fixture.scenarios.map((s) => s.category));
  for (const cat of ['determinism', 'reliability', 'authority'] as const) {
    if (!categories.has(cat)) {
      errors.push(`Missing scenario for category: ${cat}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Activation Gate — Phase 31 Plan 06
 *
 * Enforces minimum test scenario requirements before an agent can be
 * activated. Agents without sufficient golden-prompt fixtures are
 * registered but kept inactive until tests are provided.
 */

import { loadFixture, validateFixtureCompleteness } from './fixture-loader.js';

/**
 * Minimum number of test scenarios required before an agent can be activated.
 * Per user decision: 3-5 golden prompts required (lower bound enforced here).
 */
export const MINIMUM_SCENARIOS = 3;

/**
 * Minimum number of adversarial scenarios required.
 */
const MINIMUM_ADVERSARIAL = 2;

/**
 * Check whether an agent meets the minimum test fixture requirements
 * to be activated. Returns `{ allowed: true }` when the agent has a
 * valid fixture with enough scenarios, or `{ allowed: false, reason }`
 * explaining what is missing.
 */
export async function canActivateAgent(
  agentId: string,
  roleKey: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Attempt to load the fixture for this role
  const fixture = await loadFixture(roleKey);

  if (!fixture) {
    return {
      allowed: false,
      reason: `No test fixture found for role ${roleKey}. Create fixture at backend/src/validation/fixtures/${roleKey}.json`,
    };
  }

  // 2. Validate structural completeness (schema fields, category coverage)
  const completeness = validateFixtureCompleteness(fixture);
  if (!completeness.valid) {
    return {
      allowed: false,
      reason: `Fixture validation errors: ${completeness.errors.join('; ')}`,
    };
  }

  // 3. Check minimum scenario count
  if (fixture.scenarios.length < MINIMUM_SCENARIOS) {
    return {
      allowed: false,
      reason: `Fixture has ${fixture.scenarios.length} scenarios, minimum ${MINIMUM_SCENARIOS} required`,
    };
  }

  // 4. Check minimum adversarial scenario count
  if (fixture.adversarialScenarios.length < MINIMUM_ADVERSARIAL) {
    return {
      allowed: false,
      reason: `Fixture has ${fixture.adversarialScenarios.length} adversarial scenarios, minimum ${MINIMUM_ADVERSARIAL} required`,
    };
  }

  return { allowed: true };
}

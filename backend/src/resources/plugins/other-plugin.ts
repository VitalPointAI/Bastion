/**
 * Other/General-Purpose Plugin
 *
 * Phase 27 Plan 02: Catch-all plugin for engineering, supply, power, water, shelter resources.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const otherSpecsSchema = z.object({
  otherType: z.enum(['engineering', 'supply', 'power', 'water', 'shelter']),
  description: z.string().optional(),
});

const otherStateMachine = setup({
  types: {
    events: {} as
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'REPAIR' }
      | { type: 'CONDEMN' },
  },
}).createMachine({
  id: 'other',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    PMC: {
      on: {
        REPAIR: { target: 'FMC' },
        FAIL: { target: 'NMC' },
      },
    },
    NMC: {
      on: {
        REPAIR: { target: 'PMC' },
        CONDEMN: { target: 'condemned' },
      },
    },
    condemned: {
      type: 'final',
    },
  },
});

const plugin: ResourcePlugin = {
  category: 'other',
  displayName: 'General Purpose',
  defaultIsAutonomous: false,
  specificationsSchema: otherSpecsSchema,
  stateMachine: otherStateMachine,
  capabilities: ['engineering', 'power_generation', 'water_purification', 'bridging', 'construction', 'demolition'],

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return otherSpecsSchema.safeParse(specs);
  },
};

export default plugin;

/**
 * Weapon System Plugin
 *
 * Phase 27 Plan 02: Domain-specific plugin for direct/indirect fire, missiles, air defense, naval, mines.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const weaponSpecsSchema = z.object({
  weaponType: z.enum(['direct_fire', 'indirect_fire', 'missile', 'air_defense', 'naval', 'mine', 'IED']),
  caliber: z.string().optional(),
  range: z.number().positive(),
  rateOfFire: z.number().nonnegative().optional(),
  ammoType: z.string().optional(),
});

const weaponStateMachine = setup({
  types: {
    events: {} as
      | { type: 'ARM' }
      | { type: 'SAFE' }
      | { type: 'FIRE' }
      | { type: 'RELOAD' }
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'REPAIR' }
      | { type: 'CONDEMN' },
  },
}).createMachine({
  id: 'weapon',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        ARM: { target: 'armed' },
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    armed: {
      on: {
        SAFE: { target: 'FMC' },
        FIRE: { target: 'fired' },
        DEGRADE: { target: 'PMC' },
      },
    },
    fired: {
      on: {
        RELOAD: { target: 'armed' },
        DEGRADE: { target: 'PMC' },
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
  category: 'weapons',
  displayName: 'Weapon System',
  defaultIsAutonomous: false,
  specificationsSchema: weaponSpecsSchema,
  stateMachine: weaponStateMachine,
  capabilities: ['direct_fire', 'indirect_fire', 'air_defense', 'anti_armor', 'anti_ship', 'precision_strike'],
  defaultSIDCPrefix: 'SFGPEW',

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return weaponSpecsSchema.safeParse(specs);
  },
};

export default plugin;

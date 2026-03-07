/**
 * Communications Plugin
 *
 * Phase 27 Plan 02: Domain-specific plugin for HF/VHF/UHF/SATCOM/datalink/mesh/fiber comms.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const commsSpecsSchema = z.object({
  commsType: z.enum(['HF', 'VHF', 'UHF', 'SATCOM', 'datalink', 'mesh', 'fiber']),
  frequency: z.number().positive().optional(),
  bandwidth: z.number().positive().optional(),
  encryption: z.string().optional(),
  maxRange: z.number().positive(),
});

const commsStateMachine = setup({
  types: {
    events: {} as
      | { type: 'TRANSMIT' }
      | { type: 'RECEIVE' }
      | { type: 'STOP' }
      | { type: 'JAM' }
      | { type: 'CLEAR' }
      | { type: 'RELOCATE' }
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'REPAIR' },
  },
}).createMachine({
  id: 'comms',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        TRANSMIT: { target: 'transmitting' },
        RECEIVE: { target: 'receiving' },
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    transmitting: {
      on: {
        STOP: { target: 'FMC' },
        JAM: { target: 'jammed' },
      },
    },
    receiving: {
      on: {
        STOP: { target: 'FMC' },
        JAM: { target: 'jammed' },
      },
    },
    jammed: {
      on: {
        CLEAR: { target: 'FMC' },
        RELOCATE: { target: 'FMC' },
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
      },
    },
  },
});

const plugin: ResourcePlugin = {
  category: 'communications',
  displayName: 'Communications System',
  defaultIsAutonomous: false,
  specificationsSchema: commsSpecsSchema,
  stateMachine: commsStateMachine,
  capabilities: ['voice', 'data', 'video', 'SATCOM', 'mesh', 'encrypted', 'BLOS'],
  defaultSIDCPrefix: 'SFGPEI',

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return commsSpecsSchema.safeParse(specs);
  },
};

export default plugin;

/**
 * Sensor Platform Plugin
 *
 * Phase 27 Plan 02: Domain-specific plugin for radar/EO_IR/SIGINT/acoustic/CBRN/weather sensors.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const sensorSpecsSchema = z.object({
  sensorType: z.enum(['radar', 'EO_IR', 'SIGINT', 'acoustic', 'CBRN', 'weather']),
  range: z.number().positive(),
  resolution: z.number().positive(),
  frequency: z.number().positive().optional(),
  coverageAngle: z.number().min(0).max(360),
});

const sensorStateMachine = setup({
  types: {
    events: {} as
      | { type: 'COLLECT' }
      | { type: 'CALIBRATE' }
      | { type: 'STOP' }
      | { type: 'COMPLETE' }
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'REPAIR' },
  },
}).createMachine({
  id: 'sensor',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        COLLECT: { target: 'collecting' },
        CALIBRATE: { target: 'calibrating' },
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    collecting: {
      on: {
        STOP: { target: 'FMC' },
        DEGRADE: { target: 'PMC' },
      },
    },
    calibrating: {
      on: {
        COMPLETE: { target: 'FMC' },
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
  category: 'sensors',
  displayName: 'Sensor Platform',
  defaultIsAutonomous: true,
  specificationsSchema: sensorSpecsSchema,
  stateMachine: sensorStateMachine,
  capabilities: ['radar', 'EO_IR', 'SIGINT', 'acoustic', 'CBRN', 'weather', 'early_warning'],
  defaultSIDCPrefix: 'SFGPES',

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return sensorSpecsSchema.safeParse(specs);
  },
};

export default plugin;

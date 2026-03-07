/**
 * Autonomous Vehicle Plugin
 *
 * Phase 27 Plan 02: Domain-specific plugin for ground/air/maritime/subsurface vehicles.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const vehicleSpecsSchema = z.object({
  type: z.enum(['ground', 'air', 'maritime', 'subsurface']),
  maxSpeed: z.number().positive(),
  maxRange: z.number().positive(),
  payload: z.number().nonnegative(),
  fuelType: z.string(),
  autonomyLevel: z.number().min(0).max(5),
});

const vehicleStateMachine = setup({
  types: {
    events: {} as
      | { type: 'DEPLOY' }
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'RETURN' }
      | { type: 'DAMAGE' }
      | { type: 'REPAIR' }
      | { type: 'CONDEMN' },
  },
}).createMachine({
  id: 'vehicle',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        DEPLOY: { target: 'deployed' },
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    deployed: {
      on: {
        RETURN: { target: 'FMC' },
        DEGRADE: { target: 'PMC' },
        DAMAGE: { target: 'NMC' },
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
  category: 'vehicles',
  displayName: 'Autonomous Vehicle',
  defaultIsAutonomous: true,
  specificationsSchema: vehicleSpecsSchema,
  stateMachine: vehicleStateMachine,
  capabilities: ['ISR', 'transport', 'strike', 'logistics', 'CASEVAC', 'mine_clearing', 'EW'],
  defaultSIDCPrefix: 'SFGPEV',

  async processTelemetry(resourceId: string, data: unknown): Promise<void> {
    const telemetry = data as Record<string, unknown>;
    console.log(`[VehiclePlugin] Telemetry for ${resourceId}:`,
      'position:', telemetry.position,
      'speed:', telemetry.speed,
      'heading:', telemetry.heading,
      'fuel_level:', telemetry.fuel_level
    );
  },

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return vehicleSpecsSchema.safeParse(specs);
  },
};

export default plugin;

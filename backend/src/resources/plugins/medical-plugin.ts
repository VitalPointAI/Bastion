/**
 * Medical Plugin
 *
 * Phase 27 Plan 02: Domain-specific plugin for medical facilities and capabilities.
 * Provides zod schema, xstate state machine, and capability declarations.
 */

import { z } from 'zod';
import { setup } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';

const medicalSpecsSchema = z.object({
  medicalType: z.enum(['aid_station', 'surgical', 'CASEVAC', 'blood_bank', 'pharmacy', 'decon']),
  capacity: z.number().positive(),
  echelonLevel: z.enum(['I', 'II', 'III', 'IV', 'V']),
  specializations: z.array(z.string()).default([]),
});

const medicalStateMachine = setup({
  types: {
    events: {} as
      | { type: 'ACTIVATE' }
      | { type: 'DEACTIVATE' }
      | { type: 'CONTAMINATE' }
      | { type: 'DECON' }
      | { type: 'QUARANTINE' }
      | { type: 'CLEAR' }
      | { type: 'DEGRADE' }
      | { type: 'FAIL' }
      | { type: 'REPAIR' },
  },
}).createMachine({
  id: 'medical',
  initial: 'FMC',
  states: {
    FMC: {
      on: {
        ACTIVATE: { target: 'active' },
        DEGRADE: { target: 'PMC' },
        FAIL: { target: 'NMC' },
      },
    },
    active: {
      on: {
        DEACTIVATE: { target: 'FMC' },
        CONTAMINATE: { target: 'contaminated' },
        DEGRADE: { target: 'PMC' },
      },
    },
    contaminated: {
      on: {
        DECON: { target: 'FMC' },
        QUARANTINE: { target: 'quarantined' },
      },
    },
    quarantined: {
      on: {
        CLEAR: { target: 'FMC' },
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
  category: 'medical',
  displayName: 'Medical Facility',
  defaultIsAutonomous: false,
  specificationsSchema: medicalSpecsSchema,
  stateMachine: medicalStateMachine,
  capabilities: ['triage', 'CASEVAC', 'surgical', 'pharmacy', 'blood_bank', 'decontamination', 'mental_health'],

  validateSpecifications(specs: unknown): SafeParseResult<unknown> {
    return medicalSpecsSchema.safeParse(specs);
  },
};

export default plugin;

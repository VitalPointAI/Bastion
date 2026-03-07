/**
 * Decision Gates Module — Barrel Exports
 *
 * Phase 28 Plan 01: Embedded DAO governance at decision gates.
 */

// Types and constants
export {
  GateType,
  GateTab,
  GateEnforcement,
  GateStatus,
  TimeoutBehavior,
  GATE_DEFAULTS,
} from './gate-types.js';

export type {
  DecisionGate,
  CreateGateParams,
  UpdateGateParams,
  GateProposalContext,
  GateFilter,
} from './gate-types.js';

// Store
export { GateStore, gateStore } from './gate-store.js';

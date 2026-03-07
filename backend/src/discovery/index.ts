/**
 * Discovery Module — Barrel Export
 *
 * Phase 32 Plan 06: Clean public API for the discovery subsystem.
 * Re-exports all types, services, and utilities needed by consumers
 * outside the discovery module boundary.
 */

// Types (all domain types, interfaces, and constants)
export {
  TransportType,
  DeviceState,
  AccessListType,
  MatchType,
  BastionCommand,
} from './types.js';
export type {
  DiscoveryEvent,
  DeviceFingerprint,
  ScannerConfig,
  TransportScanner,
  DiscoveredDevice,
  DeviceAccessEntry,
  DeviceBehavioralBaseline,
  CommandAdapter,
  CommandResponse,
  ChallengeResult,
  OnboardingResult,
} from './types.js';

// Discovery Service (singleton orchestrator)
export { getDiscoveryService } from './discovery-service.js';

// Discovery Store (PostgreSQL CRUD)
export { discoveryStore } from './discovery-store.js';

// REST API Router
export { discoveryRouter } from './discovery-router.js';

// WebSocket Handler
export { setupDiscoveryWS } from './discovery-ws.js';

// Acceptance Gate (allowlist/blocklist + DAO governance)
export { AcceptanceGate } from './acceptance-gate.js';

// Behavioral Baseline (anomaly detection)
export { BehavioralBaseline, MetricTypes } from './behavioral-baseline.js';
export type { AnomalyCheck, DeviceHealthCheck } from './behavioral-baseline.js';

// Discovery Lifecycle State Machine
export { discoveryLifecycle } from './discovery-lifecycle.js';

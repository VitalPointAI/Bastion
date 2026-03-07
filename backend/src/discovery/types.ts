/**
 * Discovery Type System
 *
 * Phase 32 Plan 01: All discovery domain types, interfaces, and constants.
 * Defines the contracts for device discovery, fingerprinting, authentication,
 * acceptance gating, onboarding, and lifecycle management.
 *
 * Uses const objects (not enums) per project convention.
 */

// ---------------------------------------------------------------------------
// Transport Types
// ---------------------------------------------------------------------------

export const TransportType = {
  ble: 'ble',
  wifi: 'wifi',
  usb: 'usb',
  tak: 'tak',
} as const;
export type TransportType = (typeof TransportType)[keyof typeof TransportType];

// ---------------------------------------------------------------------------
// Device States (matches discovery-lifecycle.ts state machine)
// ---------------------------------------------------------------------------

export const DeviceState = {
  discovered: 'discovered',
  fingerprinting: 'fingerprinting',
  authenticating: 'authenticating',
  gate_check: 'gate_check',
  ironclaw_analysis: 'ironclaw_analysis',
  pending_dao: 'pending_dao',
  onboarding: 'onboarding',
  connected: 'connected',
  disconnected: 'disconnected',
  quarantined: 'quarantined',
  rejected: 'rejected',
  revoked: 'revoked',
} as const;
export type DeviceState = (typeof DeviceState)[keyof typeof DeviceState];

// ---------------------------------------------------------------------------
// Access List Types
// ---------------------------------------------------------------------------

export const AccessListType = {
  allow: 'allow',
  block: 'block',
} as const;
export type AccessListType = (typeof AccessListType)[keyof typeof AccessListType];

/** Scope: 'global' or a specific problem_set_id */
export type AccessListScope = 'global' | string;

// ---------------------------------------------------------------------------
// Match Types (for access list entries)
// ---------------------------------------------------------------------------

export const MatchType = {
  mac: 'mac',
  vendor_id: 'vendor_id',
  product_id: 'product_id',
  cot_type: 'cot_type',
  fingerprint_hash: 'fingerprint_hash',
} as const;
export type MatchType = (typeof MatchType)[keyof typeof MatchType];

// ---------------------------------------------------------------------------
// Bastion Command Set
// ---------------------------------------------------------------------------

export const BastionCommand = {
  move: 'move',
  report: 'report',
  configure: 'configure',
  execute: 'execute',
} as const;
export type BastionCommand = (typeof BastionCommand)[keyof typeof BastionCommand];

// ---------------------------------------------------------------------------
// Discovery Event (emitted by TransportScanner)
// ---------------------------------------------------------------------------

export interface DiscoveryEvent {
  transportType: TransportType;
  rawIdentifier: string;
  signalStrength?: number;
  firstSeen: number;
  lastSeen: number;
  rawData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Device Fingerprint (collected during fingerprinting phase)
// ---------------------------------------------------------------------------

export interface DeviceFingerprint {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  protocolVersions?: string[];
  capabilities: string[];
  hardwareId?: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Scanner Configuration
// ---------------------------------------------------------------------------

export interface ScannerConfig {
  intervalMs: number;
  enabled: boolean;
  interfaceFilter?: string[];
}

// ---------------------------------------------------------------------------
// Transport Scanner Interface
// ---------------------------------------------------------------------------

export interface TransportScanner {
  readonly transportType: TransportType;
  readonly isAvailable: boolean;

  start(config: ScannerConfig): void;
  stop(): void;
  pause(): void;
  resume(): void;

  on(event: 'discovered', handler: (evt: DiscoveryEvent) => void): void;
  on(event: 'lost', handler: (id: string) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;

  off(event: 'discovered', handler: (evt: DiscoveryEvent) => void): void;
  off(event: 'lost', handler: (id: string) => void): void;
  off(event: 'error', handler: (err: Error) => void): void;
}

// ---------------------------------------------------------------------------
// Discovered Device (persisted in DB)
// ---------------------------------------------------------------------------

export interface DiscoveredDevice {
  id: string;
  transportType: TransportType;
  rawIdentifier: string;
  fingerprint: DeviceFingerprint | null;
  state: DeviceState;
  deviceDid?: string;
  resourceId?: string;
  firstSeen: Date;
  lastSeen: Date;
  signalStrength?: number;
  location?: { lat: number; lng: number };
  ironclawAnalysis?: Record<string, unknown>;
  gateId?: string;
  quarantineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Device Access List Entry (allowlist / blocklist)
// ---------------------------------------------------------------------------

export interface DeviceAccessEntry {
  id: string;
  listType: AccessListType;
  scope: AccessListScope;
  matchType: MatchType;
  matchValue: string;
  displayName?: string;
  addedBy: string;
  gateId?: string;
  createdAt: Date;
  expiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Device Behavioral Baseline (anomaly detection)
// ---------------------------------------------------------------------------

export interface DeviceBehavioralBaseline {
  id: string;
  deviceDid: string;
  metricType: string;
  baselineMean: number;
  baselineStddev: number;
  sampleCount: number;
  lastUpdated: Date;
}

// ---------------------------------------------------------------------------
// Command Adapter Interface (ResourcePlugin 6th facet)
// ---------------------------------------------------------------------------

export interface CommandAdapter {
  /** Universal Bastion commands this adapter supports */
  readonly supportedCommands: BastionCommand[];

  /** Translate a Bastion command into device-native protocol message */
  translateCommand(
    command: BastionCommand,
    params: Record<string, unknown>,
  ): Promise<Buffer | string>;

  /** Parse device-native response back into structured Bastion response */
  parseResponse(raw: Buffer | string): Promise<CommandResponse>;

  /** Native command escape hatch -- send raw device-specific command */
  sendNative?(command: string, payload: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Command Response
// ---------------------------------------------------------------------------

export interface CommandResponse {
  success: boolean;
  command: BastionCommand | string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Challenge-Response Authentication
// ---------------------------------------------------------------------------

export interface ChallengeResult {
  success: boolean;
  devicePublicKey?: string;
  sharedSecret?: Uint8Array;
}

// ---------------------------------------------------------------------------
// Onboarding Result
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  success: boolean;
  resourceId?: string;
  deviceDid?: string;
  error?: string;
}

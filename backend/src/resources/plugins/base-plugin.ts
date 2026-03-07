/**
 * Resource Plugin Interface
 *
 * Phase 27 Plan 01: Defines the contract all resource plugins must implement.
 * Each plugin provides 5 facets: schema validation, state machine, capabilities,
 * COP renderer config, and telemetry handling.
 */

import { z } from 'zod';
import type { AnyStateMachine } from 'xstate';
import type { RegisteredResource } from '../types.js';

/**
 * Safe parse result type — compatible with zod v4 safeParse return
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * A section of detail fields for COP popup rendering
 */
export interface DetailSection {
  label: string;
  fields: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Command Adapter — Bidirectional Device Communication (Phase 32 Plan 02)
// ---------------------------------------------------------------------------

/**
 * Bastion-level command types that can be translated to device-native protocols.
 */
export const BastionCommand = {
  move: 'move',
  report: 'report',
  configure: 'configure',
  execute: 'execute',
} as const;
export type BastionCommand = (typeof BastionCommand)[keyof typeof BastionCommand];

/**
 * Response from a device after command execution, parsed from native protocol.
 */
export interface CommandResponse {
  success: boolean;
  command: BastionCommand | string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * CommandAdapter — translates Bastion commands to device-native protocols
 * and parses device responses back into Bastion-understood format.
 *
 * Each resource plugin may optionally implement a CommandAdapter to support
 * bidirectional command channels with its device type.
 */
export interface CommandAdapter {
  /** Which Bastion commands this adapter can translate */
  readonly supportedCommands: BastionCommand[];

  /** Translate a Bastion command + params into a device-native wire format */
  translateCommand(command: BastionCommand, params: Record<string, unknown>): Promise<Buffer | string>;

  /** Parse a device-native response into a Bastion CommandResponse */
  parseResponse(raw: Buffer | string): Promise<CommandResponse>;

  /** Native command escape hatch — send raw device-specific commands */
  sendNative?(command: string, payload: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Resource Plugin Interface
// ---------------------------------------------------------------------------

/**
 * Resource Plugin interface — the contract every resource type plugin must satisfy.
 *
 * Plugins provide category-specific behavior: validation schemas, state machines,
 * capability declarations, COP rendering hints, and telemetry processing.
 * Optionally includes a CommandAdapter facet for bidirectional device communication.
 */
export interface ResourcePlugin {
  /** Must match one of the 6 ResourceCategory values */
  readonly category: string;

  /** Human-readable name for this plugin */
  readonly displayName: string;

  /** Whether resources of this type default to autonomous operation */
  readonly defaultIsAutonomous: boolean;

  /** Zod schema for validating plugin-specific specifications */
  readonly specificationsSchema: z.ZodType;

  /** XState v5 state machine definition for resource lifecycle */
  readonly stateMachine: AnyStateMachine;

  /** Capability tags this resource type can have */
  readonly capabilities: string[];

  /** Default SIDC prefix for MIL-STD-2525D when SIDC not manually set */
  readonly defaultSIDCPrefix?: string;

  /** Fallback icon when no SIDC is available */
  readonly fallbackIcon?: {
    url: string;
    size: [number, number];
  };

  /**
   * Process incoming telemetry data for a resource.
   * Optional — only needed for resources that report telemetry.
   */
  processTelemetry?(resourceId: string, data: unknown): Promise<void>;

  /**
   * Validate specifications against the plugin's schema.
   */
  validateSpecifications(specs: unknown): SafeParseResult<unknown>;

  /**
   * Get detail sections for COP popup rendering.
   * Optional — provides structured data for the map info popup.
   */
  getDetailSections?(resource: RegisteredResource): DetailSection[];

  /**
   * Command adapter for bidirectional device communication.
   * Optional — only needed for resources that support remote command execution.
   */
  commandAdapter?: CommandAdapter;
}

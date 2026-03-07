/**
 * Discovery Lifecycle State Machine
 *
 * Phase 32 Plan 01: XState v5 state machine governing device lifecycle
 * from discovery through onboarding, connection, and eventual revocation.
 *
 * States: discovered -> fingerprinting -> authenticating -> gateCheck ->
 *   [onboarding | ironclawAnalysis -> pendingDAO -> onboarding] -> connected
 *   connected <-> disconnected, connected -> quarantined -> connected
 *   rejected (final), revoked (final)
 *
 * Follows comms-plugin.ts pattern: setup().createMachine()
 */

import { setup } from 'xstate';

export const discoveryLifecycle = setup({
  types: {
    events: {} as
      | { type: 'FINGERPRINT' }
      | { type: 'FINGERPRINT_COMPLETE' }
      | { type: 'CHALLENGE' }
      | { type: 'AUTH_SUCCESS' }
      | { type: 'AUTH_FAIL' }
      | { type: 'ALLOWLISTED' }
      | { type: 'BLOCKLISTED' }
      | { type: 'UNKNOWN' }
      | { type: 'IRONCLAW_APPROVED' }
      | { type: 'DAO_APPROVED' }
      | { type: 'DAO_REJECTED' }
      | { type: 'ONBOARD' }
      | { type: 'DISCONNECT' }
      | { type: 'RECONNECT' }
      | { type: 'ANOMALY' }
      | { type: 'CLEAR_ANOMALY' }
      | { type: 'REVOKE' }
      | { type: 'EMERGENCY_DISCONNECT' },
  },
}).createMachine({
  id: 'deviceDiscovery',
  initial: 'discovered',
  states: {
    discovered: {
      on: {
        FINGERPRINT: { target: 'fingerprinting' },
      },
    },
    fingerprinting: {
      on: {
        FINGERPRINT_COMPLETE: { target: 'authenticating' },
      },
    },
    authenticating: {
      on: {
        AUTH_SUCCESS: { target: 'gateCheck' },
        AUTH_FAIL: { target: 'quarantined' },
      },
    },
    gateCheck: {
      on: {
        ALLOWLISTED: { target: 'onboarding' },
        BLOCKLISTED: { target: 'rejected' },
        UNKNOWN: { target: 'ironclawAnalysis' },
      },
    },
    ironclawAnalysis: {
      on: {
        IRONCLAW_APPROVED: { target: 'pendingDAO' },
        AUTH_FAIL: { target: 'quarantined' },
      },
    },
    pendingDAO: {
      on: {
        DAO_APPROVED: { target: 'onboarding' },
        DAO_REJECTED: { target: 'rejected' },
      },
    },
    onboarding: {
      on: {
        ONBOARD: { target: 'connected' },
      },
    },
    connected: {
      on: {
        DISCONNECT: { target: 'disconnected' },
        ANOMALY: { target: 'quarantined' },
        REVOKE: { target: 'revoked' },
        EMERGENCY_DISCONNECT: { target: 'revoked' },
      },
    },
    disconnected: {
      on: {
        RECONNECT: { target: 'connected' },
        REVOKE: { target: 'revoked' },
      },
    },
    quarantined: {
      on: {
        CLEAR_ANOMALY: { target: 'connected' },
        REVOKE: { target: 'revoked' },
      },
    },
    rejected: {
      type: 'final',
    },
    revoked: {
      type: 'final',
    },
  },
});

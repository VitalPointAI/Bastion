/**
 * Legal Consent Service
 *
 * Phase 32 Plan 12: Jurisdiction-aware legal consent flow for network scanning.
 * Requires explicit acknowledgement before scanning any network, with legal text
 * tailored to context (server-local, client-device, remote-network, military-network).
 *
 * Protects operators from unauthorized network access violations:
 * - CFAA (Computer Fraud and Abuse Act, US)
 * - CMA (Computer Misuse Act, UK)
 * - EU Directive 2013/40/EU
 * - UCMJ Art. 92 (military operations)
 *
 * Consent tracked per-user, per-target, per-session with expiration.
 */

import { createHash } from 'crypto';
import { discoveryStore } from './discovery-store.js';

// ---------------------------------------------------------------------------
// Consent Types
// ---------------------------------------------------------------------------

export const ConsentType = {
  server_local: 'server_local',
  client_device: 'client_device',
  remote_network: 'remote_network',
  military_network: 'military_network',
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

export interface LegalConsentRequirement {
  consentType: ConsentType;
  title: string;
  legalText: string;
  textHash: string;
  hasValidConsent: boolean;
  consentExpiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Legal Text Templates
// ---------------------------------------------------------------------------

const LEGAL_TEXTS: Record<ConsentType, { title: string; text: string }> = {
  server_local: {
    title: 'Local Network Scanning Authorization',
    text: `AUTHORIZED USE NOTICE

You are about to initiate network discovery scanning from this Bastion server's local network interfaces (Bluetooth, WiFi, USB, TAK/RF).

By proceeding, you acknowledge and confirm:

1. You have authorization from the network owner or administrator to perform device discovery on networks accessible from this server.

2. This scanning activity may detect and fingerprint devices on the local network segment. All discovered devices will be logged and processed through Bastion's onboarding pipeline.

3. Scanning activities are subject to applicable laws including but not limited to:
   - Computer Fraud and Abuse Act (18 U.S.C. § 1030)
   - Computer Misuse Act 1990 (UK)
   - EU Directive 2013/40/EU on attacks against information systems

4. All scanning activity is logged with timestamps, operator identity, and results for audit purposes.

5. Unauthorized scanning of networks you do not have permission to access may constitute a criminal offense.

This consent is valid for the current session (24 hours) and must be renewed upon expiration.`,
  },

  client_device: {
    title: 'Browser Device Discovery Authorization',
    text: `DEVICE DISCOVERY CONSENT

You are about to use your browser's device discovery capabilities (Web Bluetooth, Web Serial) to scan for nearby devices.

By proceeding, you acknowledge and confirm:

1. You have authorization to discover and interact with devices within range of your current device.

2. Discovered devices will be reported to the Bastion server for identification, fingerprinting, and potential onboarding.

3. Browser-based scanning requires your explicit permission for each device interaction. Your browser will prompt for access to specific devices.

4. Device discovery data (identifiers, signal strength, device metadata) will be transmitted to the Bastion server and stored in the discovery log.

5. This activity is subject to the same legal restrictions as server-side scanning regarding unauthorized device access.

This consent is valid for the current session (24 hours).`,
  },

  remote_network: {
    title: 'Remote Network Scanning Authorization',
    text: `WARNING — REMOTE NETWORK SCANNING

You are about to initiate scanning against a REMOTE network target. This involves actively probing network addresses that may not be on your local network.

CRITICAL LEGAL NOTICE:

1. Remote network scanning carries significant legal risk. Scanning networks without explicit written authorization from the network owner is ILLEGAL in most jurisdictions.

2. You MUST have documented authorization (e.g., Rules of Engagement, penetration testing agreement, or command authority) before proceeding.

3. Applicable laws include:
   - Computer Fraud and Abuse Act (18 U.S.C. § 1030) — unauthorized access to protected computers
   - Computer Misuse Act 1990 (UK) — unauthorized access to computer material
   - EU Directive 2013/40/EU — illegal access to information systems
   - State/national computer crime statutes in the target's jurisdiction

4. All scan traffic will originate from this Bastion server's IP address and may be logged by the target network's security monitoring.

5. You are personally responsible for ensuring you have proper authorization. "I was told to" is not a legal defense.

6. All remote scanning activity is logged with full audit trail including operator identity, target addresses, timestamps, and results.

This consent is valid for 4 hours and applies only to the specific target addresses configured at the time of consent.`,
  },

  military_network: {
    title: 'Military Network Operations Authorization',
    text: `CLASSIFIED NETWORK OPERATIONS — AUTHORIZED PERSONNEL ONLY

You are about to initiate network discovery operations in a military network context.

MANDATORY ACKNOWLEDGEMENT:

1. This activity must be conducted under proper command authority and in accordance with applicable Rules of Engagement (ROE).

2. You must have explicit authorization from your commanding officer or designated authority for network reconnaissance operations.

3. In addition to civilian cyber law, military network operations are subject to:
   - Uniform Code of Military Justice (UCMJ) Art. 92 — Failure to obey order or regulation
   - UCMJ Art. 134 — General article (computer-related offenses)
   - DoD Directive 8570.01 — Information Assurance Training, Certification, and Workforce Management
   - Service-specific cyber operations directives and SOPs

4. Unauthorized network reconnaissance, even on friendly networks, may constitute a violation of standing orders and UCMJ provisions.

5. All operations are logged and subject to command review. The audit trail includes operator identity (DID), timestamps, target specifications, and all discovery results.

6. OPSEC: Consider the electromagnetic signature implications of active scanning. This Bastion instance's EM footprint is tracked in the EM Spectrum panel.

7. Classification: Ensure discovered device information is handled at the appropriate classification level.

This consent is valid for the current mission period (8 hours) and must be renewed upon expiration.`,
  },
};

// Default consent durations in milliseconds
const CONSENT_DURATIONS: Record<ConsentType, number> = {
  server_local: 24 * 60 * 60 * 1000, // 24 hours
  client_device: 24 * 60 * 60 * 1000, // 24 hours
  remote_network: 4 * 60 * 60 * 1000, // 4 hours
  military_network: 8 * 60 * 60 * 1000, // 8 hours
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Get the consent type for a given origin.
 * Can be overridden to military_network via optional flag.
 */
export function getConsentTypeForOrigin(
  origin: string,
  isMilitary?: boolean,
): ConsentType {
  if (isMilitary) return ConsentType.military_network;

  switch (origin) {
    case 'server':
      return ConsentType.server_local;
    case 'client':
      return ConsentType.client_device;
    case 'remote':
      return ConsentType.remote_network;
    default:
      return ConsentType.server_local;
  }
}

/**
 * Get the legal consent requirement for a given origin and user.
 * Checks if user already has valid (unexpired) consent.
 */
export async function getRequiredConsent(
  origin: string,
  userDid: string,
  targetId?: string,
  isMilitary?: boolean,
): Promise<LegalConsentRequirement> {
  const consentType = getConsentTypeForOrigin(origin, isMilitary);
  const template = LEGAL_TEXTS[consentType];
  const textHash = hashText(template.text);

  const existing = await discoveryStore.getValidConsent(userDid, consentType, targetId);

  return {
    consentType,
    title: template.title,
    legalText: template.text,
    textHash,
    hasValidConsent: !!existing,
    consentExpiresAt: existing?.expiresAt,
  };
}

/**
 * Record a user's legal consent acceptance.
 */
export async function acceptConsent(
  userDid: string,
  consentType: ConsentType,
  legalTextHash: string,
  targetId?: string,
  ipAddress?: string,
): Promise<{ expiresAt: Date }> {
  const duration = CONSENT_DURATIONS[consentType];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration);

  await discoveryStore.recordConsent({
    userDid,
    consentType,
    targetId,
    legalTextHash,
    acceptedAt: now,
    expiresAt,
    ipAddress,
  });

  return { expiresAt };
}

/**
 * Validate that a user has valid consent for the given origin.
 * Returns true if consent exists and hasn't expired.
 */
export async function validateConsent(
  userDid: string,
  origin: string,
  targetId?: string,
  isMilitary?: boolean,
): Promise<boolean> {
  const consentType = getConsentTypeForOrigin(origin, isMilitary);
  const existing = await discoveryStore.getValidConsent(userDid, consentType, targetId);
  return !!existing;
}

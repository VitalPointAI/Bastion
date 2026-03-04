import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  CREDENTIAL_CONTEXTS,
  CREDENTIAL_TYPES,
  SecurityClearanceCredentialSubject,
  EntityAttributeCredentialSubject,
  RoleAssignmentCredentialSubject,
  CoalitionMembershipCredentialSubject,
  DerivativeDataCredentialSubject,
  UserProfileCredentialSubject,
} from './schemas.js';

export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: object;
  proof?: object;
}

export interface IssuanceResult {
  credential: VerifiableCredential;
  credentialHash: string;  // SHA256 for on-chain anchoring
}

/**
 * Issue a Security Clearance Credential
 */
export async function issueSecurityClearance(
  issuerDid: string,
  subject: SecurityClearanceCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.SECURITY_CLEARANCE],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: subject.expirationDate,
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Issue an Entity Attribute Credential
 */
export async function issueEntityAttribute(
  issuerDid: string,
  subject: EntityAttributeCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.ENTITY_ATTRIBUTE],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Issue a Role Assignment Credential
 */
export async function issueRoleAssignment(
  issuerDid: string,
  subject: RoleAssignmentCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.ROLE_ASSIGNMENT],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: subject.expirationDate,
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Issue a Coalition Membership Credential
 */
export async function issueCoalitionMembership(
  issuerDid: string,
  subject: CoalitionMembershipCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.COALITION_MEMBERSHIP],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: subject.expirationDate,
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Issue a Derivative Data Credential
 * Used when splitting/redacting classified data for partial release
 */
export async function issueDerivativeData(
  issuerDid: string,
  subject: DerivativeDataCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.DERIVATIVE_DATA],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Issue a User Profile Credential
 * Self-issued by the user to attest to their display name, org email, etc.
 */
export async function issueUserProfile(
  issuerDid: string,
  subject: UserProfileCredentialSubject
): Promise<IssuanceResult> {
  const credential: VerifiableCredential = {
    '@context': CREDENTIAL_CONTEXTS,
    type: ['VerifiableCredential', CREDENTIAL_TYPES.USER_PROFILE],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: subject,
  };

  const credentialHash = hashCredential(credential);

  return { credential, credentialHash };
}

/**
 * Compute SHA256 hash of credential for on-chain anchoring
 * Uses canonical JSON serialization
 */
export function hashCredential(credential: VerifiableCredential): string {
  // Remove proof for hashing (proof is added after hash is computed)
  const { proof, ...credentialWithoutProof } = credential;

  // Canonical JSON: sorted keys
  const canonical = JSON.stringify(credentialWithoutProof, Object.keys(credentialWithoutProof).sort());

  // Hash using @noble/hashes (consistent with rest of codebase)
  const hashBytes = sha256(utf8ToBytes(canonical));
  return bytesToHex(hashBytes);
}

/**
 * Verify credential hash matches content
 */
export function verifyCredentialHash(
  credential: VerifiableCredential,
  expectedHash: string
): boolean {
  const computedHash = hashCredential(credential);
  return computedHash === expectedHash;
}

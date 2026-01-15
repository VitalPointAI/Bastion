// W3C VC 2.0 compliant credential schemas

export const CREDENTIAL_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://bastion.mil/credentials/v1'  // Custom context for BASTION types
];

// Classification levels for security credentials
export type ClearanceLevel = 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';

/**
 * Security Clearance Credential
 * Attests to a subject's security clearance level and associated caveats
 */
export interface SecurityClearanceCredentialSubject {
  id: string;  // Subject DID
  clearanceLevel: ClearanceLevel;
  nationality: string;  // ISO 3166-1 alpha-3
  issuingAuthority: string;
  investigationType: string;  // e.g., 'SSBI', 'NACLC'
  caveats: {
    releasability: string[];    // Countries/groups for data receipt
    restrictions: string[];     // NOFORN, etc. that apply to subject
    bilateral: string[];        // Bilateral agreements
    specialAccess: string[];    // SAP/SCI program access
  };
  expirationDate: string;  // ISO 8601
}

/**
 * Entity Attribute Credential
 * Attests to an entity's type and attributes (for non-human entities)
 */
export interface EntityAttributeCredentialSubject {
  id: string;  // Entity DID
  entityType: 'AiAgent' | 'Vehicle' | 'Mission' | 'DataObject' | 'Organization' | 'Resource';
  name: string;
  description?: string;
  capabilities?: string[];
  constraints?: string[];
  parentOrganization?: string;  // DID of owning organization
  classification?: ClearanceLevel;  // Entity's max classification handling
}

/**
 * Role Assignment Credential
 * Attests to a subject's role within an organization or mission
 */
export interface RoleAssignmentCredentialSubject {
  id: string;  // Subject DID
  role: string;  // e.g., 'Commander', 'IntelAnalyst', 'SystemAdmin'
  organization: string;  // Organization DID
  mission?: string;  // Optional mission DID
  authorities: string[];  // List of granted authorities
  effectiveDate: string;
  expirationDate?: string;
}

/**
 * Coalition Membership Credential
 * Attests to an organization's membership in a coalition
 */
export interface CoalitionMembershipCredentialSubject {
  id: string;  // Organization DID
  coalition: string;  // Coalition identifier (e.g., 'NATO', 'FVEY', mission-specific)
  membershipLevel: 'full' | 'associate' | 'observer';
  informationSharing: {
    canReceive: string[];       // Classification markings org can receive
    cannotReceive: string[];    // Markings blocked
    releaseAuthority: string[]; // Conditions for release
  };
  effectiveDate: string;
  expirationDate?: string;
}

/**
 * Derivative Data Credential
 * Attests to the provenance of derived/redacted data objects
 * Used when splitting classified data for partial release
 */
export interface DerivativeDataCredentialSubject {
  id: string;  // Derivative data object DID
  derivedFrom: string;  // Original data object DID
  derivationType: 'redacted_extract' | 'sanitized_summary' | 'aggregated' | 'downgraded';
  derivationMethod: 'manual_review' | 'ai_assisted' | 'automated_policy';
  approvedBy: string;  // DID of approving authority
  approvalDate: string;
  originalClassification: ClearanceLevel;
  derivativeClassification: ClearanceLevel;
  caveatsRemoved: string[];  // Caveats stripped in derivation
  caveatsRetained: string[];  // Caveats kept
  redactionSummary?: string;  // Human-readable description of what was removed
}

// Credential type string constants
export const CREDENTIAL_TYPES = {
  SECURITY_CLEARANCE: 'SecurityClearanceCredential',
  ENTITY_ATTRIBUTE: 'EntityAttributeCredential',
  ROLE_ASSIGNMENT: 'RoleAssignmentCredential',
  COALITION_MEMBERSHIP: 'CoalitionMembershipCredential',
  DERIVATIVE_DATA: 'DerivativeDataCredential',
} as const;

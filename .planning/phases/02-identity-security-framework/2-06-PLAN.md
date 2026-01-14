---
phase: 02-identity-security-framework
plan: 06
type: execute
---

<objective>
Implement W3C Verifiable Credentials using Veramo for credential issuance, verification, and storage.

Purpose: Enable the system to issue credentials (security clearances, entity attributes, role assignments, coalition memberships) that can be cryptographically verified on-chain without exposing sensitive content.

Output: Working credential issuance and verification with W3C VC 2.0 compliant structure, including DerivativeDataCredential schema for future data splitting.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@backend/src/identity/veramo-agent.ts
@backend/src/crypto/pq-signatures.ts

**Tech stack available:** Veramo framework (from Plan 2-03), PQ crypto (from Plan 2-05)
**Established patterns:** Veramo agent, did:near resolver
**Depends on:** Plan 2-03 (Veramo agent), Plan 2-05 (PQ signatures for credential signing)

**From 2-RESEARCH.md:**
- W3C VC 2.0 structure
- Credential hashing with SHA256 for on-chain anchoring
- Veramo credential plugin
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create credential schemas and issuance service</name>
  <files>backend/src/credentials/schemas.ts, backend/src/credentials/credential-service.ts</files>
  <action>
Create credential schemas and issuance service for BASTION credentials.

**Create directory:**
```bash
mkdir -p backend/src/credentials
```

**Install additional dependency:**
```bash
cd backend && pnpm add @veramo/credential-w3c crypto-js
pnpm add -D @types/crypto-js
```

**backend/src/credentials/schemas.ts:**
```typescript
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
```

**backend/src/credentials/credential-service.ts:**
```typescript
import CryptoJS from 'crypto-js';
import { getVeramoAgent } from '../identity/veramo-agent';
import {
  CREDENTIAL_CONTEXTS,
  CREDENTIAL_TYPES,
  SecurityClearanceCredentialSubject,
  EntityAttributeCredentialSubject,
  RoleAssignmentCredentialSubject,
  CoalitionMembershipCredentialSubject,
  DerivativeDataCredentialSubject,
} from './schemas';

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
 * Compute SHA256 hash of credential for on-chain anchoring
 * Uses canonical JSON serialization
 */
export function hashCredential(credential: VerifiableCredential): string {
  // Remove proof for hashing (proof is added after hash is computed)
  const { proof, ...credentialWithoutProof } = credential;

  // Canonical JSON: sorted keys
  const canonical = JSON.stringify(credentialWithoutProof, Object.keys(credentialWithoutProof).sort());

  return CryptoJS.SHA256(canonical).toString(CryptoJS.enc.Hex);
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
```

**What to avoid:**
- Don't include proof in hash computation (proof is added after)
- Don't use non-deterministic JSON serialization
- Don't store full credentials on-chain (only hashes)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit shows no TypeScript errors</verify>
  <done>Credential schemas created for all credential types including DerivativeDataCredential</done>
</task>

<task type="auto">
  <name>Task 2: Create credential API endpoints and on-chain anchoring</name>
  <files>backend/src/api/credentials.ts, backend/src/index.ts</files>
  <action>
Create API endpoints for credential issuance and verification.

**backend/src/api/credentials.ts:**
```typescript
import { Router, Request, Response } from 'express';
import {
  issueSecurityClearance,
  issueEntityAttribute,
  issueRoleAssignment,
  issueCoalitionMembership,
  issueDerivativeData,
  hashCredential,
  verifyCredentialHash,
  VerifiableCredential,
} from '../credentials/credential-service';
import {
  SecurityClearanceCredentialSubject,
  EntityAttributeCredentialSubject,
  RoleAssignmentCredentialSubject,
  CoalitionMembershipCredentialSubject,
  DerivativeDataCredentialSubject,
  CREDENTIAL_TYPES,
} from '../credentials/schemas';

const router = Router();

/**
 * POST /api/credentials/issue/security-clearance
 * Issue a security clearance credential
 */
router.post('/issue/security-clearance', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subject } = req.body as {
      issuerDid: string;
      subject: SecurityClearanceCredentialSubject;
    };

    if (!issuerDid || !subject) {
      return res.status(400).json({ error: 'issuerDid and subject required' });
    }

    if (!subject.id || !subject.clearanceLevel || !subject.nationality) {
      return res.status(400).json({ error: 'subject must include id, clearanceLevel, nationality' });
    }

    const result = await issueSecurityClearance(issuerDid, subject);

    res.json({
      success: true,
      credential: result.credential,
      credentialHash: result.credentialHash,
      anchorInstructions: 'Call anchor_credential on NEAR contract with this hash'
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/credentials/issue/entity-attribute
 * Issue an entity attribute credential
 */
router.post('/issue/entity-attribute', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subject } = req.body as {
      issuerDid: string;
      subject: EntityAttributeCredentialSubject;
    };

    if (!issuerDid || !subject) {
      return res.status(400).json({ error: 'issuerDid and subject required' });
    }

    if (!subject.id || !subject.entityType || !subject.name) {
      return res.status(400).json({ error: 'subject must include id, entityType, name' });
    }

    const result = await issueEntityAttribute(issuerDid, subject);

    res.json({
      success: true,
      credential: result.credential,
      credentialHash: result.credentialHash,
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/credentials/issue/role-assignment
 * Issue a role assignment credential
 */
router.post('/issue/role-assignment', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subject } = req.body as {
      issuerDid: string;
      subject: RoleAssignmentCredentialSubject;
    };

    if (!issuerDid || !subject) {
      return res.status(400).json({ error: 'issuerDid and subject required' });
    }

    const result = await issueRoleAssignment(issuerDid, subject);

    res.json({
      success: true,
      credential: result.credential,
      credentialHash: result.credentialHash,
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/credentials/issue/coalition-membership
 * Issue a coalition membership credential
 */
router.post('/issue/coalition-membership', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subject } = req.body as {
      issuerDid: string;
      subject: CoalitionMembershipCredentialSubject;
    };

    if (!issuerDid || !subject) {
      return res.status(400).json({ error: 'issuerDid and subject required' });
    }

    const result = await issueCoalitionMembership(issuerDid, subject);

    res.json({
      success: true,
      credential: result.credential,
      credentialHash: result.credentialHash,
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/credentials/issue/derivative-data
 * Issue a derivative data credential for data splitting/redaction provenance
 */
router.post('/issue/derivative-data', async (req: Request, res: Response) => {
  try {
    const { issuerDid, subject } = req.body as {
      issuerDid: string;
      subject: DerivativeDataCredentialSubject;
    };

    if (!issuerDid || !subject) {
      return res.status(400).json({ error: 'issuerDid and subject required' });
    }

    if (!subject.id || !subject.derivedFrom || !subject.derivationType) {
      return res.status(400).json({
        error: 'subject must include id, derivedFrom, derivationType'
      });
    }

    const result = await issueDerivativeData(issuerDid, subject);

    res.json({
      success: true,
      credential: result.credential,
      credentialHash: result.credentialHash,
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/credentials/verify-hash
 * Verify that a credential matches its hash
 */
router.post('/verify-hash', async (req: Request, res: Response) => {
  try {
    const { credential, expectedHash } = req.body as {
      credential: VerifiableCredential;
      expectedHash: string;
    };

    if (!credential || !expectedHash) {
      return res.status(400).json({ error: 'credential and expectedHash required' });
    }

    const isValid = verifyCredentialHash(credential, expectedHash);
    const computedHash = hashCredential(credential);

    res.json({
      valid: isValid,
      expectedHash,
      computedHash,
      match: isValid
    });
  } catch (error) {
    console.error('Credential verification error:', error);
    res.status(500).json({ error: 'Failed to verify credential' });
  }
});

/**
 * POST /api/credentials/hash
 * Compute hash for a credential (for anchoring)
 */
router.post('/hash', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body as { credential: VerifiableCredential };

    if (!credential) {
      return res.status(400).json({ error: 'credential required' });
    }

    const hash = hashCredential(credential);

    res.json({ credentialHash: hash });
  } catch (error) {
    console.error('Credential hashing error:', error);
    res.status(500).json({ error: 'Failed to hash credential' });
  }
});

/**
 * GET /api/credentials/types
 * List available credential types
 */
router.get('/types', (req: Request, res: Response) => {
  res.json({
    types: CREDENTIAL_TYPES,
    description: {
      [CREDENTIAL_TYPES.SECURITY_CLEARANCE]: 'Security clearance level and caveats',
      [CREDENTIAL_TYPES.ENTITY_ATTRIBUTE]: 'Entity type and attributes (AI agents, vehicles, etc.)',
      [CREDENTIAL_TYPES.ROLE_ASSIGNMENT]: 'Role within organization or mission',
      [CREDENTIAL_TYPES.COALITION_MEMBERSHIP]: 'Coalition membership and information sharing rules',
      [CREDENTIAL_TYPES.DERIVATIVE_DATA]: 'Provenance for derived/redacted data objects',
    }
  });
});

export default router;
```

**Update backend/src/index.ts to include credentials routes:**
```typescript
import credentialsRoutes from './api/credentials';
// ... existing imports

// Add after other route registrations:
app.use('/api/credentials', credentialsRoutes);
```

**What to avoid:**
- Don't sign credentials server-side without proper key management (signatures added later with PQ crypto)
- Don't return sensitive errors to clients
- Don't allow credential issuance without authentication (add auth middleware in later plan)
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/backend && pnpm tsc --noEmit && curl http://localhost:3001/api/credentials/types returns credential types JSON</verify>
  <done>Credential API endpoints created with issuance for all credential types</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `pnpm tsc --noEmit` in backend passes without errors
- [ ] All 5 credential types have issuance functions
- [ ] DerivativeDataCredential schema captures provenance for data splitting
- [ ] Credential hashing uses canonical JSON serialization
- [ ] `/api/credentials/types` endpoint returns all credential types
</verification>

<success_criteria>
- Credential schemas defined for all credential types
- DerivativeDataCredential ready for future data splitting
- Credential issuance service with hashing
- API endpoints for all credential operations
- Credential hash verification working
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-06-SUMMARY.md`
</output>

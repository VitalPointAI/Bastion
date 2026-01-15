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
} from '../credentials/credential-service.js';
import {
  SecurityClearanceCredentialSubject,
  EntityAttributeCredentialSubject,
  RoleAssignmentCredentialSubject,
  CoalitionMembershipCredentialSubject,
  DerivativeDataCredentialSubject,
  CREDENTIAL_TYPES,
} from '../credentials/schemas.js';

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

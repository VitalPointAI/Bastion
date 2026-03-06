import { Request, Response, NextFunction } from 'express';
import { ABACEnforcer, SubjectAttributes } from './abac-enforcer.js';
import { getSubjectAttributes, getObjectAttributes, isValidNearDID } from './attribute-provider.js';

/**
 * Zero Trust Middleware
 *
 * Implements zero trust security principles:
 * - Never trust, always verify
 * - Every request authenticated via DID
 * - Every resource access authorized via ABAC
 * - Minimal information leakage on denials
 */

// Extend Express Request with zero trust context
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request {
  zeroTrust?: {
    did: string;
    attributes: SubjectAttributes;
    verifiedAt: number;
  };
} } }

// Initialize ABAC enforcer (singleton)
let enforcerInstance: ABACEnforcer | null = null;

async function getEnforcer(): Promise<ABACEnforcer> {
  if (!enforcerInstance) {
    enforcerInstance = new ABACEnforcer();
    await enforcerInstance.initialize();
  }
  return enforcerInstance;
}

/**
 * Extract DID from request
 * Supports: Authorization header (Bearer token), X-DID header, or query param
 */
function extractDID(req: Request): string | null {
  // 1. Check Authorization header (JWT with DID claim - future)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // In production, decode JWT and extract DID claim
    // For now, treat token as DID directly for testing
    const token = authHeader.slice(7);
    if (isValidNearDID(token)) {
      return token;
    }
  }

  // 2. Check X-DID header (development/testing)
  const didHeader = req.headers['x-did'];
  if (typeof didHeader === 'string' && isValidNearDID(didHeader)) {
    return didHeader;
  }

  // 3. Check query parameter (development only)
  const didQuery = req.query.did;
  if (typeof didQuery === 'string' && isValidNearDID(didQuery)) {
    return didQuery;
  }

  return null;
}

/**
 * Zero Trust authentication middleware
 * Verifies caller identity via DID and attaches attributes to request
 */
export function zeroTrustAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const did = extractDID(req);

    if (!did) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide DID via Authorization header, X-DID header, or query param'
      });
    }

    // Fetch subject attributes
    const attributes = await getSubjectAttributes(did);

    if (!attributes) {
      return res.status(401).json({
        error: 'Identity not found',
        message: 'DID not registered or credentials unavailable'
      });
    }

    // Attach zero trust context to request
    req.zeroTrust = {
      did,
      attributes,
      verifiedAt: Date.now()
    };

    next();
  };
}

/**
 * Zero Trust authorization middleware
 * Checks ABAC policy for specific resource access
 */
export function zeroTrustAuthorize(
  getResourceAttributes: (req: Request) => {
    classification?: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
    releasability?: string[];
    dissemination?: string[];
    bilateralMarking?: string;
    originator?: string;
    orcon?: boolean;
  }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Ensure authentication happened first
    if (!req.zeroTrust) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Apply zeroTrustAuth middleware before zeroTrustAuthorize'
      });
    }

    const enforcer = await getEnforcer();

    // Get object attributes from request context
    const resourceAttrs = getResourceAttributes(req);
    const objectAttributes = getObjectAttributes(resourceAttrs);

    // Map HTTP method to action
    const action = mapMethodToAction(req.method);

    // Evaluate ABAC policy
    const allowed = await enforcer.enforce(
      req.zeroTrust.attributes,
      objectAttributes,
      action
    );

    if (!allowed) {
      // Log denial for audit (without sensitive details)
      console.log(`Access denied: ${req.zeroTrust.did} -> ${req.path} (${action})`);

      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions for this resource'
        // Don't reveal WHY access was denied (security)
      });
    }

    next();
  };
}

/**
 * Map HTTP method to ABAC action
 */
function mapMethodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'read';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'write';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

/**
 * Optional middleware to require specific clearance level
 */
export function requireClearance(minLevel: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET') {
  const levelMap: Record<string, number> = {
    'UNCLASS': 1,
    'CUI': 2,
    'CONFIDENTIAL': 3,
    'SECRET': 4,
    'TOPSECRET': 5
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.zeroTrust) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subjectLevel = levelMap[req.zeroTrust.attributes.clearance] ?? 0;
    const requiredLevel = levelMap[minLevel];

    if (subjectLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Insufficient clearance',
        message: `This resource requires ${minLevel} clearance`
      });
    }

    next();
  };
}

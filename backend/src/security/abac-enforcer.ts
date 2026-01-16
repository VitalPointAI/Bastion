/**
 * ABAC Policy Enforcer
 *
 * Implements Attribute-Based Access Control (ABAC) for military classification
 * security model. Supports:
 * - Classification hierarchy (UNCLASS < CUI < CONFIDENTIAL < SECRET < TOPSECRET)
 * - NOFORN enforcement
 * - Releasability checking (REL TO countries/groups)
 * - Bilateral agreement enforcement
 * - Originator control (ORCON)
 *
 * Implementation notes:
 * - Uses TypeScript for type-safe policy evaluation
 * - Casbin model files (abac-model.conf, policies/security.csv) document the policy structure
 * - Core function signature: (subject, object, action) => boolean
 */

/**
 * Classification levels - higher number = higher classification
 * Based on US military classification system
 */
export const CLASSIFICATION_LEVELS: Record<string, number> = {
  UNCLASS: 1,
  CUI: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOPSECRET: 5
};

/**
 * Five Eyes (FVEY) alliance member nations
 * Used for REL TO FVEY document releasability
 */
export const FVEY_NATIONS = ['USA', 'GBR', 'CAN', 'AUS', 'NZL'] as const;

/**
 * Subject attributes derived from DID credentials
 * Represents the identity and clearances of the requesting entity
 */
export interface SubjectAttributes {
  /** Decentralized identifier (e.g., did:near:alice.near) */
  did: string;
  /** Security clearance level */
  clearance: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  /** ISO 3166-1 alpha-3 country code (e.g., USA, GBR, DEU) */
  nationality: string;
  /** Organization identifier */
  organization: string;
  /** Role within organization */
  role: string;
  /** Access caveats and special permissions */
  caveats: {
    /** Countries/groups subject can receive from */
    releasability: string[];
    /** Bilateral agreements (e.g., UK-USA) */
    bilateral: string[];
    /** SAP/SCI program access */
    specialAccess: string[];
  };
}

/**
 * Object attributes from data classification
 * Represents the security markings on protected content
 */
export interface ObjectAttributes {
  /** Classification level of the content */
  classification: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  /** REL TO countries/groups (e.g., [USA, GBR, FVEY]) */
  releasability: string[];
  /** Dissemination controls (NOFORN, ORCON, PROPIN, etc.) */
  dissemination: string[];
  /** Required bilateral agreement (e.g., UK-USA) */
  bilateralMarking?: string;
  /** DID of the content originator */
  originator: string;
  /** Originator controlled - only originator can modify */
  orcon: boolean;
}

export class ABACEnforcer {
  private initialized: boolean = false;

  /**
   * Initialize the enforcer
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Close the enforcer and release resources
   */
  async close(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Enforce access control decision
   * @param subject - Subject attributes (from DID credentials)
   * @param object - Object attributes (from data classification)
   * @param action - Action to perform (read, write, etc.)
   * @returns true if access is allowed, false otherwise
   */
  async enforce(
    subject: SubjectAttributes,
    object: ObjectAttributes,
    action: string
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ABACEnforcer not initialized');
    }

    // For write actions with ORCON, check originator first
    if (action === 'write' && object.orcon) {
      const isOriginator = subject.did === object.originator;
      if (!isOriginator) {
        return false;
      }
    }

    // Check classification hierarchy
    const subjectLevel = CLASSIFICATION_LEVELS[subject.clearance] ?? 0;
    const objectLevel = CLASSIFICATION_LEVELS[object.classification] ?? 0;

    if (subjectLevel < objectLevel) {
      return false;
    }

    // Check NOFORN dissemination control
    if (object.dissemination.includes('NOFORN')) {
      if (subject.nationality !== 'USA') {
        return false;
      }
    }

    // Check bilateral agreement requirement
    if (object.bilateralMarking) {
      if (!subject.caveats.bilateral.includes(object.bilateralMarking)) {
        return false;
      }
    }

    // Check releasability (REL TO)
    if (object.releasability.length > 0) {
      const isReleasable = this.checkReleasability(subject.nationality, object.releasability);
      if (!isReleasable) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if subject's nationality is in releasability list
   * Handles FVEY expansion and direct nationality matching
   */
  private checkReleasability(nationality: string, releasability: string[]): boolean {
    // Direct nationality match
    if (releasability.includes(nationality)) {
      return true;
    }

    // Check for FVEY (Five Eyes) - expand to member nations
    if (releasability.includes('FVEY')) {
      if ((FVEY_NATIONS as readonly string[]).includes(nationality)) {
        return true;
      }
    }

    return false;
  }
}

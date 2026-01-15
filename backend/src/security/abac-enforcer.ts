/**
 * ABAC Policy Enforcer
 *
 * Implements Attribute-Based Access Control (ABAC) for military classification
 * security model using Casbin. Supports:
 * - Classification hierarchy (UNCLASS < CUI < CONFIDENTIAL < SECRET < TOPSECRET)
 * - NOFORN enforcement
 * - Releasability checking (REL TO countries/groups)
 * - Bilateral agreement enforcement
 * - Originator control (ORCON)
 */

// Classification levels - higher number = higher classification
const CLASSIFICATION_LEVELS: Record<string, number> = {
  UNCLASS: 1,
  CUI: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOPSECRET: 5
};

// Five Eyes alliance nations
const FVEY_NATIONS = ['USA', 'GBR', 'CAN', 'AUS', 'NZL'];

export interface SubjectAttributes {
  did: string;
  clearance: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  nationality: string;
  organization: string;
  role: string;
  caveats: {
    releasability: string[];
    bilateral: string[];
    specialAccess: string[];
  };
}

export interface ObjectAttributes {
  classification: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  releasability: string[];
  dissemination: string[];
  bilateralMarking?: string;
  originator: string;
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
      if (FVEY_NATIONS.includes(nationality)) {
        return true;
      }
    }

    return false;
  }
}

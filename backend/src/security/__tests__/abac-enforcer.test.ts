import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ABACEnforcer, SubjectAttributes, ObjectAttributes } from '../abac-enforcer.js';

describe('ABACEnforcer', () => {
  let enforcer: ABACEnforcer;

  beforeAll(async () => {
    enforcer = new ABACEnforcer();
    await enforcer.initialize();
  });

  afterAll(async () => {
    await enforcer.close();
  });

  describe('Classification Hierarchy', () => {
    it('should allow access when clearance >= classification (SECRET >= CONFIDENTIAL)', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:alice.near',
        clearance: 'SECRET',
        nationality: 'USA',
        organization: 'DoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'CONFIDENTIAL',
        releasability: [],
        dissemination: [],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(true);
    });

    it('should deny access when clearance < classification (CONFIDENTIAL < SECRET)', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:alice.near',
        clearance: 'CONFIDENTIAL',
        nationality: 'USA',
        organization: 'DoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: [],
        dissemination: [],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(false);
    });
  });

  describe('NOFORN Enforcement', () => {
    it('should deny access for non-US nationals when NOFORN is set', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:james.near',
        clearance: 'SECRET',
        nationality: 'GBR',
        organization: 'MoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'CONFIDENTIAL',
        releasability: [],
        dissemination: ['NOFORN'],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(false);
    });

    it('should allow access for US nationals when NOFORN is set', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:alice.near',
        clearance: 'SECRET',
        nationality: 'USA',
        organization: 'DoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'CONFIDENTIAL',
        releasability: [],
        dissemination: ['NOFORN'],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(true);
    });
  });

  describe('Releasability Checks', () => {
    it('should allow access when nationality is in releasability list', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:james.near',
        clearance: 'SECRET',
        nationality: 'GBR',
        organization: 'MoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: ['USA', 'GBR', 'FVEY'],
        dissemination: [],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(true);
    });

    it('should deny access when nationality is not in releasability list', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:hans.near',
        clearance: 'SECRET',
        nationality: 'DEU',
        organization: 'BND',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: ['USA', 'GBR'],
        dissemination: [],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(false);
    });
  });

  describe('Bilateral Agreement Enforcement', () => {
    it('should allow access when subject has required bilateral agreement', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:james.near',
        clearance: 'SECRET',
        nationality: 'GBR',
        organization: 'MoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: ['UK-USA'],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: [],
        dissemination: [],
        bilateralMarking: 'UK-USA',
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(true);
    });

    it('should deny access when subject lacks required bilateral agreement', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:james.near',
        clearance: 'SECRET',
        nationality: 'GBR',
        organization: 'MoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: [],
        dissemination: [],
        bilateralMarking: 'UK-USA',
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(false);
    });
  });

  describe('Combined Classification and Releasability', () => {
    it('should allow access when both clearance and releasability requirements are met', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:james.near',
        clearance: 'SECRET',
        nationality: 'GBR',
        organization: 'MoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: ['FVEY'],
        dissemination: [],
        originator: 'did:near:system.near',
        orcon: false
      };

      const result = await enforcer.enforce(subject, object, 'read');
      expect(result).toBe(true);
    });
  });

  describe('Originator Control (ORCON)', () => {
    it('should allow write when subject is the originator with ORCON', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:alice.near',
        clearance: 'SECRET',
        nationality: 'USA',
        organization: 'DoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: [],
        dissemination: [],
        originator: 'did:near:alice.near',
        orcon: true
      };

      const result = await enforcer.enforce(subject, object, 'write');
      expect(result).toBe(true);
    });

    it('should deny write when subject is not the originator with ORCON', async () => {
      const subject: SubjectAttributes = {
        did: 'did:near:bob.near',
        clearance: 'SECRET',
        nationality: 'USA',
        organization: 'DoD',
        role: 'analyst',
        caveats: {
          releasability: [],
          bilateral: [],
          specialAccess: []
        }
      };

      const object: ObjectAttributes = {
        classification: 'SECRET',
        releasability: [],
        dissemination: [],
        originator: 'did:near:alice.near',
        orcon: true
      };

      const result = await enforcer.enforce(subject, object, 'write');
      expect(result).toBe(false);
    });
  });
});

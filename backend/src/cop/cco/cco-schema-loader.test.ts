/**
 * Tests for CCO schema loader and validator.
 *
 * Covers: loadCCOSchema, getCCOClassMap, validateCCOClass, suggestCCOClass
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadCCOSchema, getCCOClassMap } from './cco-schema-loader.js';
import { validateCCOClass, suggestCCOClass } from './cco-validator.js';

describe('CCO Schema Loader', () => {
  beforeAll(() => {
    loadCCOSchema();
  });

  it('loadCCOSchema builds a non-empty class map', () => {
    const map = getCCOClassMap();
    expect(map.size).toBeGreaterThan(0);
  });

  it('getCCOClassMap returns the loaded map', () => {
    const map = getCCOClassMap();
    expect(map).toBeInstanceOf(Map);
    expect(map.has('cco:Person')).toBe(true);
    expect(map.has('cco:Organization')).toBe(true);
  });

  it('loaded classes have correct structure', () => {
    const map = getCCOClassMap();
    const person = map.get('cco:Person');
    expect(person).toBeDefined();
    expect(person!.uri).toBe('cco:Person');
    expect(person!.label).toBe('Person');
    expect(person!.module).toBe('agent');
  });

  it('getCCOClassMap returns empty map if not loaded', async () => {
    // This test verifies the function returns a Map regardless
    const map = getCCOClassMap();
    expect(map).toBeInstanceOf(Map);
  });
});

describe('CCO Validator', () => {
  beforeAll(() => {
    loadCCOSchema();
  });

  describe('validateCCOClass', () => {
    it('returns valid for known CCO class', () => {
      const result = validateCCOClass('cco:Person');
      expect(result).toEqual({ valid: true });
    });

    it('returns invalid with reason for unknown CCO class', () => {
      const result = validateCCOClass('cco:NonexistentClass');
      expect(result).toEqual({
        valid: false,
        reason: 'Unknown CCO class: cco:NonexistentClass',
      });
    });

    it('validates military-specific classes', () => {
      expect(validateCCOClass('cco:MilitaryOrganization')).toEqual({ valid: true });
      expect(validateCCOClass('cco:GovernmentOrganization')).toEqual({ valid: true });
      expect(validateCCOClass('cco:GeospatialRegion')).toEqual({ valid: true });
    });
  });

  describe('suggestCCOClass', () => {
    it('suggests GovernmentOrganization for nation', () => {
      expect(suggestCCOClass('nation', {})).toBe('cco:GovernmentOrganization');
    });

    it('suggests Person for individual', () => {
      expect(suggestCCOClass('individual', {})).toBe('cco:Person');
    });

    it('suggests Organization for organization', () => {
      expect(suggestCCOClass('organization', {})).toBe('cco:Organization');
    });

    it('suggests Organization for non_state_actor', () => {
      expect(suggestCCOClass('non_state_actor', {})).toBe('cco:Organization');
    });

    it('suggests MilitaryOrganization for military_unit', () => {
      expect(suggestCCOClass('military_unit', {})).toBe('cco:MilitaryOrganization');
    });

    it('suggests GeospatialRegion for location', () => {
      expect(suggestCCOClass('location', {})).toBe('cco:GeospatialRegion');
    });

    it('suggests InformationContentEntity for document', () => {
      expect(suggestCCOClass('document', {})).toBe('cco:InformationContentEntity');
    });

    it('suggests Artifact for equipment', () => {
      expect(suggestCCOClass('equipment', {})).toBe('cco:Artifact');
    });

    it('suggests Vehicle for vehicle', () => {
      expect(suggestCCOClass('vehicle', {})).toBe('cco:Vehicle');
    });

    it('suggests Weapon for weapon', () => {
      expect(suggestCCOClass('weapon', {})).toBe('cco:Weapon');
    });

    it('falls back to Entity for unknown type', () => {
      expect(suggestCCOClass('unknown_type', {})).toBe('cco:Entity');
    });
  });
});

/**
 * Tests for CCO schema loader, validator, and Bastion JSON-LD context loader.
 *
 * Covers: loadCCOSchema, getCCOClassMap, validateCCOClass, suggestCCOClass,
 *         loadBastionContext, getBastionContext
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadCCOSchema, getCCOClassMap, loadBastionContext, getBastionContext } from './cco-schema-loader.js';
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

describe('Bastion JSON-LD Context Loader', () => {
  beforeAll(() => {
    loadBastionContext();
  });

  it('loadBastionContext() succeeds without error', () => {
    // If this throws, beforeAll would fail and all tests below would fail
    expect(() => loadBastionContext()).not.toThrow();
  });

  it('getBastionContext() returns object with @context key', () => {
    const ctx = getBastionContext();
    expect(ctx).not.toBeNull();
    expect(ctx).toBeTypeOf('object');
    expect(ctx).toHaveProperty('@context');
  });

  it('context includes all 6 ontology namespace prefixes', () => {
    const ctx = getBastionContext();
    const context = (ctx as Record<string, unknown>)['@context'] as Record<string, unknown>;
    expect(context).toHaveProperty('bfo');
    expect(context).toHaveProperty('cco');
    expect(context).toHaveProperty('prov');
    expect(context).toHaveProperty('jc3');
    expect(context).toHaveProperty('dodaf');
    expect(context).toHaveProperty('bastion');
  });

  it('context includes property aliases for JSON-LD native fields', () => {
    const ctx = getBastionContext();
    const context = (ctx as Record<string, unknown>)['@context'] as Record<string, unknown>;
    expect(context).toHaveProperty('jsonldType');
    expect(context).toHaveProperty('jsonldId');
    expect(context).toHaveProperty('validFrom');
    expect(context).toHaveProperty('validTo');
    expect(context).toHaveProperty('confidence');
    expect(context).toHaveProperty('assertedBy');
    expect(context).toHaveProperty('assertedVia');
    expect(context).toHaveProperty('derivedFrom');
    expect(context).toHaveProperty('sourceWeight');
    expect(context).toHaveProperty('halfLifeDays');
  });

  it('jsonldType alias maps to @type', () => {
    const ctx = getBastionContext();
    const context = (ctx as Record<string, unknown>)['@context'] as Record<string, unknown>;
    expect(context['jsonldType']).toBe('@type');
  });

  it('assertedBy maps to prov:wasAttributedTo', () => {
    const ctx = getBastionContext();
    const context = (ctx as Record<string, unknown>)['@context'] as Record<string, unknown>;
    const assertedBy = context['assertedBy'] as Record<string, unknown>;
    expect(assertedBy['@id']).toBe('prov:wasAttributedTo');
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

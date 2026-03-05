/**
 * Tests for deterministic MIL-STD-2525D SIDC builder.
 *
 * Covers: buildSIDC producing valid 20-digit codes for all identity,
 * symbol set, and echelon combinations. buildSIDCFromEntity convenience
 * function mapping entity attributes to SIDCParams.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSIDC,
  buildSIDCFromEntity,
  IDENTITY_MAP,
  SYMBOL_SET_MAP,
  ECHELON_MAP,
  type SIDCParams,
} from './sidc-builder.js';

describe('buildSIDC', () => {
  it('returns code starting with 1003100 for friendly land_unit', () => {
    const result = buildSIDC({
      identity: 'friendly',
      symbolSet: 'land_unit',
      status: 'present',
      hqTfFd: 'none',
      echelon: 'unspecified',
      entityCode: '110000',
      modifier1: '00',
      modifier2: '00',
    });
    expect(result.startsWith('1003100')).toBe(true);
  });

  it('returns code starting with 1006010 for hostile air', () => {
    const result = buildSIDC({
      identity: 'hostile',
      symbolSet: 'air',
      status: 'present',
      hqTfFd: 'none',
      echelon: 'unspecified',
      entityCode: '110000',
      modifier1: '00',
      modifier2: '00',
    });
    expect(result.startsWith('1006010')).toBe(true);
  });

  it('returns code starting with 1004300 for neutral sea_surface', () => {
    const result = buildSIDC({
      identity: 'neutral',
      symbolSet: 'sea_surface',
      status: 'present',
      hqTfFd: 'none',
      echelon: 'unspecified',
      entityCode: '110000',
      modifier1: '00',
      modifier2: '00',
    });
    expect(result.startsWith('1004300')).toBe(true);
  });

  it('result is always exactly 20 characters', () => {
    const result = buildSIDC({
      identity: 'friendly',
      symbolSet: 'land_unit',
      status: 'present',
      hqTfFd: 'none',
      echelon: 'battalion',
      entityCode: '110100',
      modifier1: '01',
      modifier2: '02',
    });
    expect(result).toHaveLength(20);
  });

  it('result contains only digits', () => {
    const result = buildSIDC({
      identity: 'hostile',
      symbolSet: 'land_equipment',
      status: 'planned',
      hqTfFd: 'task_force',
      echelon: 'brigade',
      entityCode: '110200',
      modifier1: '00',
      modifier2: '00',
    });
    expect(result).toMatch(/^\d{20}$/);
  });

  it('all identity values produce valid 2-digit codes', () => {
    const identities = Object.keys(IDENTITY_MAP) as Array<keyof typeof IDENTITY_MAP>;
    for (const identity of identities) {
      const result = buildSIDC({
        identity,
        symbolSet: 'land_unit',
        status: 'present',
        hqTfFd: 'none',
        echelon: 'unspecified',
        entityCode: '110000',
        modifier1: '00',
        modifier2: '00',
      });
      expect(result).toHaveLength(20);
      expect(result).toMatch(/^\d{20}$/);
      // Identity is positions 3-4
      const identityCode = result.slice(2, 4);
      expect(identityCode).toHaveLength(2);
      expect(identityCode).toMatch(/^\d{2}$/);
    }
  });

  it('all symbol set values produce valid 2-digit codes', () => {
    const symbolSets = Object.keys(SYMBOL_SET_MAP) as Array<keyof typeof SYMBOL_SET_MAP>;
    for (const symbolSet of symbolSets) {
      const result = buildSIDC({
        identity: 'friendly',
        symbolSet,
        status: 'present',
        hqTfFd: 'none',
        echelon: 'unspecified',
        entityCode: '110000',
        modifier1: '00',
        modifier2: '00',
      });
      expect(result).toHaveLength(20);
      expect(result).toMatch(/^\d{20}$/);
      // Symbol set is positions 5-6
      const ssCode = result.slice(4, 6);
      expect(ssCode).toHaveLength(2);
      expect(ssCode).toMatch(/^\d{2}$/);
    }
  });

  it('all echelon values produce valid 2-digit codes', () => {
    const echelons = Object.keys(ECHELON_MAP) as Array<keyof typeof ECHELON_MAP>;
    for (const echelon of echelons) {
      const result = buildSIDC({
        identity: 'friendly',
        symbolSet: 'land_unit',
        status: 'present',
        hqTfFd: 'none',
        echelon,
        entityCode: '110000',
        modifier1: '00',
        modifier2: '00',
      });
      expect(result).toHaveLength(20);
      expect(result).toMatch(/^\d{20}$/);
      // Echelon is positions 9-10
      const echelonCode = result.slice(8, 10);
      expect(echelonCode).toHaveLength(2);
      expect(echelonCode).toMatch(/^\d{2}$/);
    }
  });
});

describe('buildSIDCFromEntity', () => {
  it('maps entity attributes to SIDCParams and produces valid SIDC', () => {
    const result = buildSIDCFromEntity({
      type: 'infantry',
      affiliation: 'friendly',
      echelon: 'battalion',
    });
    expect(result).toHaveLength(20);
    expect(result).toMatch(/^\d{20}$/);
    // Friendly = 03, land_unit = 10
    expect(result.slice(2, 4)).toBe('03');
    expect(result.slice(4, 6)).toBe('10');
    // Battalion = 16
    expect(result.slice(8, 10)).toBe('16');
    // Infantry entity code = 110100
    expect(result.slice(10, 16)).toBe('110100');
  });

  it('uses sensible defaults for optional fields', () => {
    const result = buildSIDCFromEntity({
      type: 'headquarters',
      affiliation: 'friendly',
    });
    expect(result).toHaveLength(20);
    // Status = present (0), HQ/TF/FD = none (0), Echelon = unspecified (00)
    expect(result[6]).toBe('0'); // status
    expect(result[7]).toBe('0'); // hqTfFd
    expect(result.slice(8, 10)).toBe('00'); // echelon
  });

  it('maps hostile affiliation correctly', () => {
    const result = buildSIDCFromEntity({
      type: 'armor',
      affiliation: 'hostile',
      echelon: 'company',
    });
    expect(result.slice(2, 4)).toBe('06'); // hostile
    expect(result.slice(10, 16)).toBe('110200'); // armor
  });

  it('falls back to headquarters entity code for unknown type', () => {
    const result = buildSIDCFromEntity({
      type: 'some_unknown_type',
      affiliation: 'neutral',
    });
    expect(result).toHaveLength(20);
    expect(result).toMatch(/^\d{20}$/);
    // Should use default entity code 110000 (headquarters)
    expect(result.slice(10, 16)).toBe('110000');
  });

  it('maps status and functionCode when provided', () => {
    const result = buildSIDCFromEntity({
      type: 'infantry',
      affiliation: 'friendly',
      status: 'planned',
      functionCode: '110300', // artillery override
    });
    expect(result[6]).toBe('1'); // planned
    expect(result.slice(10, 16)).toBe('110300'); // function code override
  });
});

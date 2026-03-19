/**
 * Tests for confidence-calculator.ts
 *
 * Covers: computeDecayedConfidence, fuseConfidence, SOURCE_WEIGHTS, HALF_LIFE_DEFAULTS
 *
 * These tests are part of Phase 47 Wave 0 TDD scaffolding.
 * Tests use toBeCloseTo for floating-point comparisons.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDecayedConfidence,
  fuseConfidence,
  SOURCE_WEIGHTS,
  HALF_LIFE_DEFAULTS,
} from './confidence-calculator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Date that is `daysAgo` days in the past relative to a fixed reference */
function daysAgoFrom(referenceDate: Date, daysAgo: number): Date {
  return new Date(referenceDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

// ─── computeDecayedConfidence ─────────────────────────────────────────────────

describe('computeDecayedConfidence', () => {
  const REF = new Date('2026-03-15T00:00:00Z');

  it('returns baseConfidence unchanged when age is zero (no decay)', () => {
    const result = computeDecayedConfidence(0.95, REF, 180, REF);
    expect(result).toBeCloseTo(0.95, 5);
  });

  it('returns ~0.475 for base=0.95 at 180 days ago with halfLife=180 (one half-life)', () => {
    const assertedAt = daysAgoFrom(REF, 180);
    const result = computeDecayedConfidence(0.95, assertedAt, 180, REF);
    // conf_0 * 2^(-t/h) = 0.95 * 2^(-1) = 0.475
    expect(result).toBeCloseTo(0.475, 2);
  });

  it('returns ~0.375 for base=0.75 at 365 days ago with halfLife=365 (one half-life)', () => {
    const assertedAt = daysAgoFrom(REF, 365);
    const result = computeDecayedConfidence(0.75, assertedAt, 365, REF);
    // 0.75 * 2^(-1) = 0.375
    expect(result).toBeCloseTo(0.375, 2);
  });

  it('returns ~0.2375 for base=0.95 at 360 days with halfLife=180 (two half-lives)', () => {
    const assertedAt = daysAgoFrom(REF, 360);
    const result = computeDecayedConfidence(0.95, assertedAt, 180, REF);
    // 0.95 * 2^(-2) = 0.95 / 4 = 0.2375
    expect(result).toBeCloseTo(0.2375, 2);
  });

  it('approaches zero for very old assertions', () => {
    const veryOld = daysAgoFrom(REF, 3650); // 10 years
    const result = computeDecayedConfidence(1.0, veryOld, 180, REF);
    expect(result).toBeLessThan(0.001);
  });

  it('decays from 1.0 with halfLife=365 at 730 days (two half-lives) → ~0.25', () => {
    const assertedAt = daysAgoFrom(REF, 730);
    const result = computeDecayedConfidence(1.0, assertedAt, 365, REF);
    expect(result).toBeCloseTo(0.25, 2);
  });
});

// ─── fuseConfidence ───────────────────────────────────────────────────────────

describe('fuseConfidence', () => {
  it('returns 0 for empty array', () => {
    expect(fuseConfidence([])).toBe(0);
  });

  it('returns the single weight unchanged for a single source', () => {
    expect(fuseConfidence([0.95])).toBeCloseTo(0.95, 5);
  });

  it('returns ~0.9825 for manual_entry (0.95) + osint (0.65)', () => {
    // conf = 1 - (1-0.95)(1-0.65) = 1 - 0.05 * 0.35 = 0.9825
    const result = fuseConfidence([0.95, 0.65]);
    expect(result).toBeCloseTo(0.9825, 2);
  });

  it('returns higher confidence for three independent sources', () => {
    // 0.95, 0.65, 0.60
    // conf = 1 - (0.05)(0.35)(0.40) = 1 - 0.007 = 0.993
    const result = fuseConfidence([0.95, 0.65, 0.60]);
    expect(result).toBeCloseTo(0.993, 2);
  });

  it('approaches 1 when many high-confidence sources are fused', () => {
    const result = fuseConfidence([0.95, 0.90, 0.90, 0.85]);
    expect(result).toBeGreaterThan(0.999);
  });

  it('is commutative — order of weights does not change result', () => {
    const r1 = fuseConfidence([0.95, 0.65]);
    const r2 = fuseConfidence([0.65, 0.95]);
    expect(r1).toBeCloseTo(r2, 10);
  });
});

// ─── SOURCE_WEIGHTS ───────────────────────────────────────────────────────────

describe('SOURCE_WEIGHTS', () => {
  const EXPECTED_SOURCES = [
    'manual_entry',
    'sigint',
    'doc_intelligence',
    'vision_pipeline',
    'osint',
    'ai_inference',
  ] as const;

  it('defines all 6 source types', () => {
    for (const src of EXPECTED_SOURCES) {
      expect(SOURCE_WEIGHTS).toHaveProperty(src);
    }
  });

  it('all weights are in the 0-1 range', () => {
    for (const [_src, weight] of Object.entries(SOURCE_WEIGHTS)) {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
      expect(weight).not.toBeNaN();
    }
  });

  it('manual_entry has the highest reliability weight (0.95)', () => {
    expect(SOURCE_WEIGHTS.manual_entry).toBe(0.95);
  });

  it('sigint has weight 0.90', () => {
    expect(SOURCE_WEIGHTS.sigint).toBe(0.90);
  });

  it('ai_inference has the lowest reliability weight (0.60)', () => {
    expect(SOURCE_WEIGHTS.ai_inference).toBe(0.60);
  });

  it('weights are in descending order: manual > sigint > doc_intelligence > vision > osint > ai', () => {
    expect(SOURCE_WEIGHTS.manual_entry).toBeGreaterThan(SOURCE_WEIGHTS.sigint);
    expect(SOURCE_WEIGHTS.sigint).toBeGreaterThan(SOURCE_WEIGHTS.doc_intelligence);
    expect(SOURCE_WEIGHTS.doc_intelligence).toBeGreaterThan(SOURCE_WEIGHTS.vision_pipeline);
    expect(SOURCE_WEIGHTS.vision_pipeline).toBeGreaterThan(SOURCE_WEIGHTS.osint);
    expect(SOURCE_WEIGHTS.osint).toBeGreaterThan(SOURCE_WEIGHTS.ai_inference);
  });
});

// ─── HALF_LIFE_DEFAULTS ───────────────────────────────────────────────────────

describe('HALF_LIFE_DEFAULTS', () => {
  const EXPECTED_FACT_TYPES = [
    'personnel',
    'capability',
    'political',
    'geographic',
    'economic',
  ];

  it('defines all 5 fact types', () => {
    for (const factType of EXPECTED_FACT_TYPES) {
      expect(HALF_LIFE_DEFAULTS).toHaveProperty(factType);
    }
  });

  it('all half-lives are positive integers in days', () => {
    for (const [_factType, days] of Object.entries(HALF_LIFE_DEFAULTS)) {
      expect(days).toBeGreaterThan(0);
      expect(Number.isInteger(days)).toBe(true);
    }
  });

  it('personnel half-life is 180 days', () => {
    expect(HALF_LIFE_DEFAULTS.personnel).toBe(180);
  });

  it('geographic half-life is 1825 days (5 years — slowest decay)', () => {
    expect(HALF_LIFE_DEFAULTS.geographic).toBe(1825);
  });

  it('political half-life is 90 days (fastest decay)', () => {
    expect(HALF_LIFE_DEFAULTS.political).toBe(90);
  });

  it('geographic decays slowest (largest value)', () => {
    const maxHalfLife = Math.max(...Object.values(HALF_LIFE_DEFAULTS));
    expect(HALF_LIFE_DEFAULTS.geographic).toBe(maxHalfLife);
  });

  it('political decays fastest (smallest value)', () => {
    const minHalfLife = Math.min(...Object.values(HALF_LIFE_DEFAULTS));
    expect(HALF_LIFE_DEFAULTS.political).toBe(minHalfLife);
  });
});

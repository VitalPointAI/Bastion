import { describe, it, expect } from 'vitest';
import { normalizeActorName } from './name-normalizer.js';

describe('normalizeActorName', () => {
  describe('United States variants', () => {
    it('maps US to United States', () => {
      expect(normalizeActorName('US')).toBe('United States');
    });

    it('maps USA to United States', () => {
      expect(normalizeActorName('USA')).toBe('United States');
    });

    it('maps U.S.A. to United States', () => {
      expect(normalizeActorName('U.S.A.')).toBe('United States');
    });

    it('maps U.S. to United States', () => {
      expect(normalizeActorName('U.S.')).toBe('United States');
    });

    it('maps America to United States', () => {
      expect(normalizeActorName('America')).toBe('United States');
    });

    it('maps United States of America to United States', () => {
      expect(normalizeActorName('United States of America')).toBe('United States');
    });

    it('is case insensitive for US variants', () => {
      expect(normalizeActorName('usa')).toBe('United States');
      expect(normalizeActorName('Us')).toBe('United States');
    });
  });

  describe('China variants', () => {
    it('maps PRC to China', () => {
      expect(normalizeActorName('PRC')).toBe('China');
    });

    it('maps prc (lowercase) to China', () => {
      expect(normalizeActorName('prc')).toBe('China');
    });

    it("maps People's Republic of China to China", () => {
      expect(normalizeActorName("People's Republic of China")).toBe('China');
    });

    it('maps Peoples Republic of China to China', () => {
      expect(normalizeActorName('Peoples Republic of China')).toBe('China');
    });

    it('does NOT map Republic of China to China (Taiwan/ROC is distinct from PRC)', () => {
      expect(normalizeActorName('Republic of China')).toBe('Republic of China');
    });

    it('maps CCP to Chinese Communist Party', () => {
      expect(normalizeActorName('CCP')).toBe('Chinese Communist Party');
    });
  });

  describe('Korea variants', () => {
    it('maps DPRK to North Korea', () => {
      expect(normalizeActorName('DPRK')).toBe('North Korea');
    });

    it("maps Democratic People's Republic of Korea to North Korea", () => {
      expect(normalizeActorName("Democratic People's Republic of Korea")).toBe('North Korea');
    });

    it('maps ROK to South Korea', () => {
      expect(normalizeActorName('ROK')).toBe('South Korea');
    });

    it('maps Republic of Korea to South Korea', () => {
      expect(normalizeActorName('Republic of Korea')).toBe('South Korea');
    });
  });

  describe('Russia variants', () => {
    it('maps Russian Federation to Russia', () => {
      expect(normalizeActorName('Russian Federation')).toBe('Russia');
    });

    it('maps russian federation (lowercase) to Russia', () => {
      expect(normalizeActorName('russian federation')).toBe('Russia');
    });

    it('maps RF to Russia', () => {
      expect(normalizeActorName('RF')).toBe('Russia');
    });
  });

  describe('Military / multilateral shorthand', () => {
    it('maps NATO to NATO (unchanged canonical)', () => {
      expect(normalizeActorName('NATO')).toBe('NATO');
    });

    it('maps North Atlantic Treaty Organization to NATO', () => {
      expect(normalizeActorName('North Atlantic Treaty Organization')).toBe('NATO');
    });

    it('maps PLA to People\'s Liberation Army', () => {
      expect(normalizeActorName('PLA')).toBe("People's Liberation Army");
    });

    it('maps INDOPACOM to INDOPACOM (unchanged canonical)', () => {
      expect(normalizeActorName('INDOPACOM')).toBe('INDOPACOM');
    });

    it('maps PACOM to INDOPACOM (former name)', () => {
      expect(normalizeActorName('PACOM')).toBe('INDOPACOM');
    });
  });

  describe('pass-through for unknown names', () => {
    it('returns unknown actors unchanged', () => {
      expect(normalizeActorName('Unknown Actor XYZ')).toBe('Unknown Actor XYZ');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeActorName('')).toBe('');
    });

    it('returns the name if it is already canonical', () => {
      expect(normalizeActorName('China')).toBe('China');
      expect(normalizeActorName('United States')).toBe('United States');
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace before lookup', () => {
      expect(normalizeActorName('  PRC  ')).toBe('China');
    });

    it('trims whitespace from unknown names too', () => {
      expect(normalizeActorName('  Unknown Actor  ')).toBe('Unknown Actor');
    });

    it('normalizes internal whitespace for lookup', () => {
      expect(normalizeActorName('United  States  of  America')).toBe('United States');
    });
  });
});

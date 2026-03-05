/**
 * Tests for SVG sanitizer and safety validator.
 *
 * Covers: sanitizeSVG stripping dangerous content, preserving valid SVG,
 * and validateSVGSafety detecting attack vectors.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSVG, validateSVGSafety } from './svg-sanitizer.js';

describe('sanitizeSVG', () => {
  it('strips script tags from SVG input', () => {
    const input = '<svg><script>alert("xss")</script><rect width="10" height="10"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('rect');
  });

  it('strips onclick attributes', () => {
    const input = '<svg><rect onclick="alert(1)" width="10" height="10"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('rect');
  });

  it('strips onload attributes', () => {
    const input = '<svg onload="alert(1)"><rect width="10" height="10"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('onload');
  });

  it('strips onerror attributes', () => {
    const input = '<svg><image onerror="alert(1)" /></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: URIs', () => {
    const input = '<svg><a href="javascript:alert(1)"><text>click me</text></a></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips external xlink:href references', () => {
    const input = '<svg><use xlink:href="http://evil.com/payload.svg#id"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('evil.com');
  });

  it('preserves valid SVG elements (path, rect, circle, text, g)', () => {
    const input = `<svg viewBox="0 0 100 100">
      <g transform="translate(10,10)">
        <path d="M0 0 L10 10" stroke="red"/>
        <rect x="20" y="20" width="30" height="30" fill="blue"/>
        <circle cx="50" cy="50" r="10" fill="green"/>
        <text x="0" y="80" font-size="12">Unit Alpha</text>
      </g>
    </svg>`;
    const result = sanitizeSVG(input);
    expect(result).toContain('path');
    expect(result).toContain('rect');
    expect(result).toContain('circle');
    expect(result).toContain('text');
    expect(result).toContain('<g');
  });

  it('preserves data-entity-id and data-layer-id attributes', () => {
    const input = '<svg><rect data-entity-id="e123" data-layer-id="l456" width="10" height="10"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).toContain('data-entity-id="e123"');
    expect(result).toContain('data-layer-id="l456"');
  });

  it('preserves style attributes like fill, stroke, stroke-width', () => {
    const input = '<svg><path d="M0 0 L10 10" fill="red" stroke="blue" stroke-width="2"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).toContain('fill="red"');
    expect(result).toContain('stroke="blue"');
    expect(result).toContain('stroke-width="2"');
  });

  it('strips foreignObject elements', () => {
    const input = '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('script');
  });

  it('strips style elements', () => {
    const input = '<svg><style>body { background: red }</style><rect width="10" height="10"/></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('<style');
  });

  it('strips iframe elements', () => {
    const input = '<svg><iframe src="http://evil.com"></iframe></svg>';
    const result = sanitizeSVG(input);
    expect(result).not.toContain('iframe');
  });
});

describe('validateSVGSafety', () => {
  it('returns safe: true for clean SVG', () => {
    const input = '<svg viewBox="0 0 100 100"><rect width="10" height="10" fill="blue"/></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects script tags', () => {
    const input = '<svg><script>alert(1)</script></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.includes('script'))).toBe(true);
  });

  it('detects on* event attributes', () => {
    const input = '<svg><rect onclick="alert(1)" width="10" height="10"/></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.includes('event'))).toBe(true);
  });

  it('detects javascript: URIs', () => {
    const input = '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.includes('javascript'))).toBe(true);
  });

  it('detects external URLs in href', () => {
    const input = '<svg><use href="http://evil.com/payload.svg#id"/></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.includes('external'))).toBe(true);
  });

  it('detects foreignObject elements', () => {
    const input = '<svg><foreignObject><body>hi</body></foreignObject></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.includes('foreignObject'))).toBe(true);
  });

  it('returns multiple violations for multiple issues', () => {
    const input = '<svg onload="x"><script>alert(1)</script><a href="javascript:void(0)">x</a></svg>';
    const result = validateSVGSafety(input);
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

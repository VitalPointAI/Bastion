/**
 * SVG Sanitizer
 *
 * DOMPurify wrapper with strict SVG allowlist for military-grade
 * security. All LLM-generated SVG fragments MUST pass through
 * sanitizeSVG() before storage and rendering.
 *
 * Belt-and-suspenders approach:
 * 1. validateSVGSafety() pre-scans for dangerous patterns (detection)
 * 2. sanitizeSVG() strips anything not on the allowlist (enforcement)
 * 3. Frontend renders in shadow DOM (isolation)
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import {
  SVG_ALLOWED_TAGS,
  SVG_ALLOWED_ATTRS,
  SVG_FORBIDDEN_TAGS,
  SVG_FORBIDDEN_ATTRS,
} from './svg-allowlist.js';

// Create a jsdom window for DOMPurify (required in Node.js environment)
const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

/**
 * Sanitize an SVG string by stripping all elements and attributes
 * not on the allowlist.
 *
 * @param svgString - Raw SVG string (potentially from LLM)
 * @returns Sanitized SVG string safe for rendering
 */
export function sanitizeSVG(svgString: string): string {
  return purify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: false },
    ALLOWED_TAGS: SVG_ALLOWED_TAGS,
    ALLOWED_ATTR: SVG_ALLOWED_ATTRS,
    FORBID_TAGS: SVG_FORBIDDEN_TAGS,
    FORBID_ATTR: SVG_FORBIDDEN_ATTRS,
    ALLOW_DATA_ATTR: true,
  });
}

/**
 * Pre-scan SVG string for dangerous patterns before sanitization.
 * This is the detection layer -- it reports what it finds rather
 * than modifying the input.
 *
 * @param svgString - Raw SVG string to validate
 * @returns Object with safe flag and array of violation descriptions
 */
export function validateSVGSafety(svgString: string): {
  safe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Check for script tags
  if (/<script[\s>]/i.test(svgString)) {
    violations.push('Contains <script> element');
  }

  // Check for on* event handler attributes
  if (/\bon\w+\s*=/i.test(svgString)) {
    violations.push('Contains event handler attribute (on* pattern)');
  }

  // Check for javascript: URIs
  if (/javascript\s*:/i.test(svgString)) {
    violations.push('Contains javascript: URI');
  }

  // Check for external URLs in href/xlink:href
  if (/(?:xlink:)?href\s*=\s*["']https?:\/\//i.test(svgString)) {
    violations.push('Contains external URL reference in href');
  }

  // Check for foreignObject
  if (/<foreignObject[\s>]/i.test(svgString)) {
    violations.push('Contains <foreignObject> element');
  }

  // Check for data: URIs on non-image elements
  if (/(?:xlink:)?href\s*=\s*["']data:/i.test(svgString)) {
    violations.push('Contains data: URI reference');
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * SVG Element and Attribute Allowlists
 *
 * Military-grade security allowlists for SVG sanitization.
 * Only elements and attributes on the allowed lists pass through
 * DOMPurify. Everything on the forbidden lists is always stripped.
 */

/**
 * SVG elements permitted in COP layer annotations.
 * Covers standard drawing primitives, grouping, gradients,
 * markers, and clipping -- no interactive or scripting elements.
 */
export const SVG_ALLOWED_TAGS: string[] = [
  'svg',
  'g',
  'defs',
  'use',
  'symbol',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'marker',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
];

/**
 * SVG attributes permitted on allowed elements.
 * Covers geometry, presentation, transforms, gradients,
 * markers, and data-* attributes for entity linkage.
 */
export const SVG_ALLOWED_ATTRS: string[] = [
  // SVG namespace
  'viewBox',
  'xmlns',
  // Geometry
  'x',
  'y',
  'width',
  'height',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'x1',
  'y1',
  'x2',
  'y2',
  'd',
  'points',
  // Transform
  'transform',
  // Presentation
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  // Text
  'font-size',
  'font-family',
  'font-weight',
  'text-anchor',
  // Identity
  'id',
  'class',
  // Entity linkage (data attributes)
  'data-entity-id',
  'data-layer-id',
  // Markers & clipping
  'marker-start',
  'marker-mid',
  'marker-end',
  'clip-path',
  'mask',
  // Gradient
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  // Internal references only
  'href',
];

/**
 * SVG elements that are ALWAYS stripped regardless of context.
 * These represent scripting, styling, or embedding vectors.
 */
export const SVG_FORBIDDEN_TAGS: string[] = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'foreignObject',
];

/**
 * SVG attributes that are ALWAYS stripped regardless of element.
 * These represent event handler injection vectors.
 */
export const SVG_FORBIDDEN_ATTRS: string[] = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onfocus',
  'onblur',
  'onkeydown',
  'onkeyup',
  'onsubmit',
];

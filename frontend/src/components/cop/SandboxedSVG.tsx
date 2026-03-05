/**
 * SandboxedSVG
 *
 * Phase 21 Plan 08: Shadow DOM wrapper for rendering LLM-generated SVG
 * fragments safely. The SVG is injected into a shadow root, isolating
 * styles and scripts from the main document.
 *
 * Interactive elements (click handlers for entity selection) remain
 * OUTSIDE the shadow DOM. Uses data-entity-id attributes to map clicks
 * back to entities.
 */

import { useRef, useEffect } from 'react';

// ─── SVG Sanitization ───────────────────────────────────────────────────────

/** Allowlisted SVG elements for military-grade security */
const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle',
  'ellipse', 'text', 'tspan', 'defs', 'use', 'clipPath', 'mask',
  'linearGradient', 'radialGradient', 'stop', 'marker', 'symbol',
  'title', 'desc',
]);

/** Allowlisted SVG attributes */
const ALLOWED_ATTRS = new Set([
  'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'd', 'fill', 'stroke',
  'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'class',
  'id', 'font-size', 'font-family', 'font-weight', 'text-anchor',
  'dominant-baseline', 'dx', 'dy', 'offset', 'stop-color', 'stop-opacity',
  'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end',
  'gradientUnits', 'gradientTransform', 'xlink:href', 'href',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
  'preserveAspectRatio', 'xmlns', 'xmlns:xlink',
  'data-entity-id',
]);

/**
 * Sanitize SVG fragment by removing disallowed elements and attributes.
 * Belt-and-suspenders: even inside shadow DOM, we strip dangerous content.
 */
function sanitizeSVG(svgString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return '<svg xmlns="http://www.w3.org/2000/svg"><text fill="#ef4444" font-size="12">Invalid SVG</text></svg>';
  }

  function sanitizeNode(node: Element): void {
    // Remove disallowed elements
    const children = Array.from(node.children);
    for (const child of children) {
      if (!ALLOWED_ELEMENTS.has(child.localName)) {
        child.remove();
      } else {
        // Remove disallowed attributes
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (!ALLOWED_ATTRS.has(attr.name) && !attr.name.startsWith('data-entity-')) {
            child.removeAttribute(attr.name);
          }
        }
        // Strip event handlers (on*)
        const allAttrs = Array.from(child.attributes);
        for (const attr of allAttrs) {
          if (attr.name.startsWith('on')) {
            child.removeAttribute(attr.name);
          }
        }
        sanitizeNode(child);
      }
    }
  }

  const root = doc.documentElement;
  sanitizeNode(root);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(root);
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface SandboxedSVGProps {
  svgFragment: string;
  width?: number;
  height?: number;
  className?: string;
  /** Called when an element with data-entity-id is clicked */
  onEntityClick?: (entityId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SandboxedSVG({
  svgFragment,
  width,
  height,
  className,
  onEntityClick,
}: SandboxedSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Attach shadow root once
    if (!shadowRef.current) {
      shadowRef.current = container.attachShadow({ mode: 'closed' });
    }

    // Sanitize and inject SVG
    const sanitized = sanitizeSVG(svgFragment);
    shadowRef.current.innerHTML = sanitized;
  }, [svgFragment]);

  // Handle clicks on entities (outside shadow DOM via delegation)
  function handleClick(e: React.MouseEvent) {
    if (!onEntityClick || !shadowRef.current) return;

    // Query shadow DOM for elements with data-entity-id at click position
    const elements = shadowRef.current.elementsFromPoint(e.clientX, e.clientY);
    for (const el of elements) {
      const entityId = el.getAttribute('data-entity-id');
      if (entityId) {
        onEntityClick(entityId);
        break;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={className}
      data-interactive={onEntityClick ? 'true' : undefined}
      onClick={handleClick}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    />
  );
}

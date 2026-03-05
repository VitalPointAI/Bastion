/**
 * SVG Fragment Generator
 *
 * LLM-generated SVG for custom annotations (movement arrows, boundary
 * sketches, text labels, area highlights) that milsymbol cannot produce.
 *
 * All LLM output passes through sanitizeSVG() before returning.
 * Belt-and-suspenders: sanitize + validate for defense in depth.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { sanitizeSVG, validateSVGSafety } from './svg-sanitizer.js';
import type { COPAnnotationSpec, LatLng } from '../layers/layer-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Request for generating a custom SVG annotation via LLM.
 */
export interface AnnotationRequest {
  /** Human-readable description of the desired annotation */
  description: string;
  /** Center position for the annotation */
  position: LatLng;
  /** Bounding box for the annotation area */
  bounds?: { topLeft: LatLng; bottomRight: LatLng };
  /** Additional context for the LLM (e.g., surrounding unit names, phase info) */
  context: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SVG_SYSTEM_PROMPT = `You are a military cartography SVG generator. You produce SVG fragments for tactical map annotations.

RULES:
1. Output ONLY valid SVG elements. No complete SVG document (no <svg> wrapper, no <?xml> declaration).
2. Use ONLY these elements: path, rect, circle, ellipse, polyline, polygon, line, text, g, defs, marker, clipPath.
3. NO scripts, NO event handlers (onclick, onload, etc.), NO external references (url(), href to external).
4. NO foreignObject, NO image elements with external sources, NO style elements.
5. Use viewBox-relative coordinates. The annotation area is a 200x200 unit space.
6. Use military-standard colors: blue (#0000FF) for friendly, red (#FF0000) for hostile, green (#00FF00) for neutral, yellow (#FFFF00) for unknown.
7. Include appropriate stroke-width, fill, and opacity for map readability.
8. For arrows: use path with arrowhead markers.
9. For text: use font-family="Arial, sans-serif" with appropriate font-size.
10. Keep SVG concise -- map annotations should be simple and clear.

Output the SVG fragment only, no explanation, no code fences, no markdown.`;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a custom SVG annotation via LLM and sanitize the output.
 *
 * Uses ChatAnthropic (via the project's LLM factory) to generate SVG
 * fragments for custom annotations that milsymbol cannot produce:
 * - Movement arrows (curved paths between positions)
 * - Boundary sketches (styled polylines)
 * - Text labels (positioned text elements)
 * - Area highlights (filled polygons with opacity)
 *
 * @param request - Annotation description, position, and context
 * @returns Sanitized COPAnnotationSpec ready for storage
 */
export async function generateAnnotationSVG(
  request: AnnotationRequest
): Promise<COPAnnotationSpec> {
  const llm = await createLLMForAgent({
    agentId: 'cop-annotation-generator',
    overrides: { temperature: 0.3, maxTokens: 2048 },
  });

  const userPrompt = buildUserPrompt(request);

  const response = await llm.invoke([
    new SystemMessage(SVG_SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]);

  // Extract text content from response
  const rawSVG =
    typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .filter(
              (block): block is { type: 'text'; text: string } =>
                typeof block === 'object' &&
                block !== null &&
                'type' in block &&
                block.type === 'text'
            )
            .map((block) => block.text)
            .join('')
        : String(response.content);

  // Strip any markdown code fences the LLM might have added despite instructions
  const cleanedSVG = stripCodeFences(rawSVG.trim());

  // Belt-and-suspenders: sanitize first, then validate
  const sanitizedSVG = sanitizeSVG(cleanedSVG);

  // Log any safety violations found pre-sanitization (should be cleaned by sanitizeSVG)
  const safetyCheck = validateSVGSafety(cleanedSVG);
  if (!safetyCheck.safe) {
    console.warn(
      `[SVG Fragment Generator] Pre-sanitization violations found: ${safetyCheck.violations.join(', ')}. ` +
        `These were removed by sanitizeSVG().`
    );
  }

  // Generate a unique ID for the annotation
  const annotationId = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: annotationId,
    svgFragment: sanitizedSVG,
    position: request.position,
    bounds: request.bounds,
    generatedBy: 'llm',
    description: request.description,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the user prompt with annotation context.
 */
function buildUserPrompt(request: AnnotationRequest): string {
  const parts: string[] = [
    `Generate an SVG fragment for the following military map annotation:`,
    ``,
    `Description: ${request.description}`,
    `Position: (${request.position.lat}, ${request.position.lng})`,
  ];

  if (request.bounds) {
    parts.push(
      `Bounds: top-left (${request.bounds.topLeft.lat}, ${request.bounds.topLeft.lng}) ` +
        `to bottom-right (${request.bounds.bottomRight.lat}, ${request.bounds.bottomRight.lng})`
    );
  }

  if (request.context) {
    parts.push(``, `Context: ${request.context}`);
  }

  return parts.join('\n');
}

/**
 * Strip markdown code fences that LLMs sometimes add despite instructions.
 */
function stripCodeFences(text: string): string {
  // Remove ```svg ... ``` or ```xml ... ``` or ``` ... ```
  return text
    .replace(/^```(?:svg|xml|html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

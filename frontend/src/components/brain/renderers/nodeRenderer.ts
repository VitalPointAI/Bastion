// Brain node Canvas 2D renderer
// Shape-coded nodes: circle=entity, diamond=objective, square=document, hexagon=concept
// Colored by actor category, with confidence-based glow and gap/future rendering.

import type { BrainNode } from '../types.js';
import {
  CATEGORY_COLORS,
  ZOOM_LABEL_THRESHOLD,
  ZOOM_SECONDARY_THRESHOLD,
} from '../types.js';

// ─── Helper shapes ────────────────────────────────────────────────────────────

/** Rotated square used for objective nodes */
export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

/** Axis-aligned square used for document nodes */
export function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.rect(x - r, y - r, r * 2, r * 2);
}

/** Regular hexagon used for concept nodes, flat-top orientation */
export function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

// ─── Primary render function ──────────────────────────────────────────────────

/**
 * Draw a brain node on a Canvas 2D context.
 *
 * Visual vocabulary:
 *   - Shape  → node type (circle / diamond / square / hexagon)
 *   - Color  → actor category (ally/adversary/neutral/partner)
 *   - Glow   → confidence level (bright = high confidence, dim = low confidence)
 *   - Dashed hollow outline → intelligence gap node
 *   - Translucent ghost     → future prediction node
 *
 * CRITICAL: canvas state (shadowBlur, globalAlpha, setLineDash) is ALWAYS reset at
 * the end of this function to prevent glow/transparency bleeding into adjacent draws.
 */
export function drawBrainNode(
  node: BrainNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isSelected: boolean,
  isDimmed: boolean,
  _animFrame: number,
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  // ── Semantic zoom: skip secondary nodes when zoomed out ───────────────────
  if (
    globalScale < ZOOM_SECONDARY_THRESHOLD &&
    !isSelected &&
    (node.centrality ?? 1) < 0.5
  ) {
    return;
  }

  // ── Base radius ────────────────────────────────────────────────────────────
  const baseRadius = 6;
  const r = isSelected ? baseRadius * 1.4 : baseRadius;

  // ── Dimmed: draw at 20% opacity and skip glow ─────────────────────────────
  if (isDimmed) {
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    _drawShape(ctx, node.type, x, y, r);
    const color = node.actorCategory ? CATEGORY_COLORS[node.actorCategory] : '#4a9eff';
    ctx.fillStyle = color;
    ctx.fill();
    // Reset
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    return;
  }

  // ── Confidence glow ────────────────────────────────────────────────────────
  if (!node.isGap) {
    const glowColor = node.actorCategory
      ? CATEGORY_COLORS[node.actorCategory]
      : '#4a9eff';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (node.confidence ?? 0.5) * 20;
  }

  // ── Future prediction ghosting ─────────────────────────────────────────────
  if (node.isFuturePrediction) {
    ctx.globalAlpha = 0.3 + (node.predictionConfidence ?? 0.3) * 0.4;
  }

  // ── Shape path ─────────────────────────────────────────────────────────────
  ctx.beginPath();
  _drawShape(ctx, node.type, x, y, r);

  // ── Gap: hollow dashed outline only ───────────────────────────────────────
  if (node.isGap) {
    ctx.shadowBlur = 0;
    ctx.setLineDash([3 / globalScale, 3 / globalScale]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // ── Normal fill ────────────────────────────────────────────────────────
    const color = node.actorCategory
      ? CATEGORY_COLORS[node.actorCategory]
      : '#4a9eff';
    ctx.fillStyle = color;
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }
  }

  // ── Label (visible only when sufficiently zoomed in) ──────────────────────
  if (globalScale > ZOOM_LABEL_THRESHOLD) {
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const lbl = node.label ?? node.id ?? '';
    const truncated = lbl.length > 20 ? `${lbl.slice(0, 20)}…` : lbl;
    ctx.fillText(truncated, x, y + r + 2 / globalScale);
  }

  // ── CRITICAL: reset canvas state to prevent bleeding ──────────────────────
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
}

// ─── Internal shape dispatch ──────────────────────────────────────────────────

function _drawShape(
  ctx: CanvasRenderingContext2D,
  type: BrainNode['type'],
  x: number,
  y: number,
  r: number,
): void {
  switch (type) {
    case 'entity':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'objective':
      drawDiamond(ctx, x, y, r);
      break;
    case 'document':
      drawSquare(ctx, x, y, r);
      break;
    case 'concept':
      drawHexagon(ctx, x, y, r);
      break;
    default:
      // Fall back to circle for any unexpected type
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

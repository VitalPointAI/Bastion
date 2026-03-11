// Brain edge Canvas 2D renderer
// Weighted line thickness, conflict dashing, pulse animation along the edge.

import type { BrainEdge } from '../types.js';

/**
 * Draw a brain edge on a Canvas 2D context.
 *
 * Visual vocabulary:
 *   - Line width → relationship strength (thicker = stronger)
 *   - Red dashed  → conflict relationship
 *   - Pulse dot   → animated activity indicator moving along the edge
 *
 * The pulse dot position is derived from `animFrame % 100 / 100` so it
 * travels one full lap every 100 animation frames (≈ 1.67 s at 60 fps).
 *
 * CRITICAL: canvas state is reset at the end to prevent bleeding.
 */
export function drawBrainEdge(
  edge: BrainEdge,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  sourceNode: { x?: number; y?: number },
  targetNode: { x?: number; y?: number },
  isDimmed: boolean,
  animFrame: number,
): void {
  const sx = sourceNode.x ?? 0;
  const sy = sourceNode.y ?? 0;
  const tx = targetNode.x ?? 0;
  const ty = targetNode.y ?? 0;

  const strength = edge.strength ?? 0.3;
  const baseWidth = 0.5 + strength * 2;

  if (isDimmed) {
    // Draw faint thin line only — no pulse
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = (baseWidth * 0.5) / globalScale;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  // ── Conflict edge: red dashed ──────────────────────────────────────────────
  if (edge.isConflict) {
    ctx.setLineDash([4 / globalScale, 4 / globalScale]);
    ctx.strokeStyle = '#ff4444';
  } else {
    ctx.setLineDash([]);
    // Color intensity scales with strength
    const opacity = 0.3 + strength * 0.5;
    ctx.strokeStyle = `rgba(150, 180, 220, ${opacity})`;
  }

  ctx.lineWidth = baseWidth / globalScale;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // Reset dash after stroke
  ctx.setLineDash([]);

  // ── Pulse animation ────────────────────────────────────────────────────────
  // A small circle travels from source to target on a 100-frame loop.
  const t = (animFrame % 100) / 100;
  const px = sx + (tx - sx) * t;
  const py = sy + (ty - sy) * t;

  const pulseColor = edge.isConflict
    ? 'rgba(255, 68, 68, 0.6)'
    : `rgba(150, 180, 220, 0.6)`;

  ctx.beginPath();
  ctx.arc(px, py, 1.5 / globalScale, 0, Math.PI * 2);
  ctx.fillStyle = pulseColor;
  ctx.fill();

  // ── CRITICAL: reset canvas state ──────────────────────────────────────────
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

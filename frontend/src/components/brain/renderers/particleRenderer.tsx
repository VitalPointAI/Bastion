/**
 * particleRenderer - Canvas overlay component for brain ingestion animation
 *
 * Renders animated particles streaming from the left sidebar (ingestion feed)
 * toward the brain center. Particles move rightward and fade out over time.
 *
 * CRITICAL DESIGN RULES:
 *  - Particle state lives entirely in particlesRef — NEVER call setState here.
 *  - Uses requestAnimationFrame loop stored in a ref — cancelled on unmount.
 *  - The canvas is absolutely positioned and pointer-events: none so it does
 *    not block user interaction with elements below it.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Particle } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParticleOverlayProps {
  /** Live particle array — read every animation frame */
  particlesRef: MutableRefObject<Particle[]>;
  /** Canvas pixel width (matches brain center column) */
  width: number;
  /** Canvas pixel height */
  height: number;
  /** Left edge of the center canvas — particles start here after exiting the sidebar */
  sidebarWidth: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ParticleOverlay
 *
 * Absolutely-positioned canvas that covers the brain center area and draws
 * particles moving from left (sidebarWidth) toward the right (brain center).
 *
 * Usage:
 *   import { ParticleOverlay } from './renderers/particleRenderer.js';
 *   <div style={{ position: 'relative', width, height }}>
 *     <BrainCanvas ... />
 *     <ParticleOverlay particlesRef={particlesRef} width={width} height={height} sidebarWidth={280} />
 *   </div>
 */
export function ParticleOverlay({ particlesRef, width, height, sidebarWidth }: ParticleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function loop() {
      if (!ctx || !canvas) return;

      // Scale for device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;

      for (const p of particles) {
        // Advance position — move rightward at 2px per frame
        p.x += 2;
        // Fade out gradually
        p.alpha -= 0.005;

        if (p.alpha <= 0 || p.x > w) continue;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);

        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Reset shadow so it doesn't bleed into subsequent draws
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Remove dead particles (alpha exhausted or moved past canvas)
      particlesRef.current = particles.filter((p) => p.alpha > 0 && p.x <= w);

      rafRef.current = requestAnimationFrame(loop);
    }

    // Ensure any pre-existing particles start at the sidebar exit point
    const particles = particlesRef.current;
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].x < sidebarWidth) {
        particles[i] = { ...particles[i], x: sidebarWidth };
      }
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [particlesRef, width, height, sidebarWidth]);

  // Sync canvas backing-store size to logical size for crisp rendering on HiDPI displays
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  return (
    <canvas
      ref={canvasRef}
      width={width * dpr}
      height={height * dpr}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

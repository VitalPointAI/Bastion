/**
 * heatMapRenderer — Centrality-based heat map coloring for brain nodes.
 *
 * When heat map mode is active, nodes are colored by their centrality score:
 *   - Low centrality (0.0-0.3)  → blue (#1e40af)
 *   - Medium centrality (0.3-0.6) → yellow (#fbbf24)
 *   - High centrality (0.6-1.0) → red (#ef4444)
 *
 * High-centrality nodes also get an emissive glow effect.
 */

import * as THREE from 'three';
import type { BrainNode } from '../types.js';

// ─── Color gradient stops ────────────────────────────────────────────────────

const HEAT_COLOR_LOW = new THREE.Color('#1e40af');    // Blue
const HEAT_COLOR_MID = new THREE.Color('#fbbf24');    // Yellow
const HEAT_COLOR_HIGH = new THREE.Color('#ef4444');    // Red

// ─── Temp objects (reused to avoid GC) ───────────────────────────────────────

const _tempColor = new THREE.Color();

/**
 * Get the heat map color for a given centrality value (0-1).
 * Returns a THREE.Color — caller can .getStyle() or .getHex() as needed.
 */
export function getHeatColor(centrality: number): THREE.Color {
  const c = Math.max(0, Math.min(1, centrality));

  if (c <= 0.5) {
    // Lerp from blue → yellow
    const t = c / 0.5;
    _tempColor.copy(HEAT_COLOR_LOW).lerp(HEAT_COLOR_MID, t);
  } else {
    // Lerp from yellow → red
    const t = (c - 0.5) / 0.5;
    _tempColor.copy(HEAT_COLOR_MID).lerp(HEAT_COLOR_HIGH, t);
  }

  return _tempColor.clone();
}

/**
 * Get the heat map color as a CSS hex string.
 */
export function getHeatColorHex(centrality: number): string {
  return '#' + getHeatColor(centrality).getHexString();
}

/**
 * Get emissive intensity for high-centrality nodes.
 * Only nodes above 0.6 centrality get glow.
 */
export function getHeatEmissiveIntensity(centrality: number): number {
  if (centrality < 0.6) return 0;
  return (centrality - 0.6) / 0.4; // 0-1 mapped from 0.6-1.0
}

// ─── Material cache for heat map mode ────────────────────────────────────────

const heatMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Get a cached MeshStandardMaterial for heat map rendering.
 * Uses MeshStandardMaterial (not Lambert) to support emissive glow.
 */
export function getHeatMaterial(node: BrainNode): THREE.MeshStandardMaterial {
  const centrality = node.centrality ?? 0;
  // Quantize to reduce cache entries
  const qCentrality = Math.round(centrality * 20) / 20;
  const key = `heat|${qCentrality}`;

  let mat = heatMaterialCache.get(key);
  if (!mat) {
    const color = getHeatColor(qCentrality);
    const emissiveIntensity = getHeatEmissiveIntensity(qCentrality);

    mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      emissive: emissiveIntensity > 0 ? color : new THREE.Color(0x000000),
      emissiveIntensity: emissiveIntensity * 0.8,
    });
    heatMaterialCache.set(key, mat);
  }

  return mat;
}

/**
 * Apply heat map coloring to an existing mesh's material.
 * Modifies the material in-place — no allocation.
 */
export function applyHeatToMaterial(
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  centrality: number,
): void {
  const color = getHeatColor(centrality);
  material.color.copy(color);

  if ('emissive' in material) {
    const intensity = getHeatEmissiveIntensity(centrality);
    (material as THREE.MeshStandardMaterial).emissive.copy(
      intensity > 0 ? color : new THREE.Color(0x000000),
    );
    (material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 0.8;
  }
}

/**
 * Dispose all cached heat map materials.
 */
export function disposeHeatMaterials(): void {
  for (const mat of heatMaterialCache.values()) {
    mat.dispose();
  }
  heatMaterialCache.clear();
}

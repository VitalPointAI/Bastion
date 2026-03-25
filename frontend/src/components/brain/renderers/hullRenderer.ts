/**
 * hullRenderer — Renders convex hull outlines as transparent 3D shapes.
 *
 * Takes hull data from useBrainHulls and renders them as transparent
 * THREE.ShapeGeometry meshes in the scene. Each hull is a filled
 * semi-transparent polygon with a thin border stroke.
 */

import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { HullData } from '../hooks/useBrainHulls.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HullMeshGroup {
  /** Parent group containing all hull meshes */
  group: THREE.Group;
  /** Update hull meshes from new hull data */
  update: (hulls: HullData[]) => void;
  /** Dispose all GPU resources */
  dispose: () => void;
}

// ─── Parse rgba color ────────────────────────────────────────────────────────

function parseRgbaColor(rgba: string): { r: number; g: number; b: number; a: number } {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { r: 0.5, g: 0.5, b: 0.5, a: 0.06 };
  return {
    r: parseInt(match[1]) / 255,
    g: parseInt(match[2]) / 255,
    b: parseInt(match[3]) / 255,
    a: match[4] ? parseFloat(match[4]) : 1,
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createHullMeshGroup(): HullMeshGroup {
  const group = new THREE.Group();
  const meshPool: THREE.Mesh[] = [];
  const labelPool: SpriteText[] = [];
  const linePool: THREE.Line[] = [];

  function clearGroup(): void {
    // Return meshes to pool rather than disposing
    for (let i = group.children.length - 1; i >= 0; i--) {
      group.remove(group.children[i]);
    }
  }

  function getMesh(index: number): THREE.Mesh {
    if (meshPool[index]) return meshPool[index];
    const mesh = new THREE.Mesh();
    mesh.frustumCulled = false;
    meshPool[index] = mesh;
    return mesh;
  }

  function getLabel(index: number): SpriteText {
    if (labelPool[index]) return labelPool[index];
    const label = new SpriteText('');
    label.textHeight = 4;
    label.backgroundColor = 'transparent';
    labelPool[index] = label;
    return label;
  }

  function getLine(index: number): THREE.Line {
    if (linePool[index]) return linePool[index];
    const line = new THREE.Line();
    line.frustumCulled = false;
    linePool[index] = line;
    return line;
  }

  function update(hulls: HullData[]): void {
    clearGroup();

    for (let hi = 0; hi < hulls.length; hi++) {
      const hull = hulls[hi];
      if (hull.points.length < 3) continue;

      const { r, g, b, a } = parseRgbaColor(hull.color);

      // Create filled shape in the XZ plane
      const shape = new THREE.Shape();
      const firstPt = hull.points[0];
      shape.moveTo(firstPt.x, firstPt.z);
      for (let i = 1; i < hull.points.length; i++) {
        shape.lineTo(hull.points[i].x, hull.points[i].z);
      }
      shape.closePath();

      const shapeGeo = new THREE.ShapeGeometry(shape);
      const shapeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r, g, b),
        transparent: true,
        opacity: a,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = getMesh(hi);
      // Dispose old geometry
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();

      mesh.geometry = shapeGeo;
      mesh.material = shapeMat;

      // ShapeGeometry is created in XY plane — rotate to XZ plane
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = hull.center.y; // Place at average Y of hull nodes
      mesh.renderOrder = -1; // Render behind nodes

      group.add(mesh);

      // Hull outline (thin line)
      const linePoints: THREE.Vector3[] = hull.points.map(p => new THREE.Vector3(p.x, hull.center.y, p.z));
      linePoints.push(linePoints[0].clone()); // Close the loop
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(r, g, b),
        transparent: true,
        opacity: Math.min(a * 4, 0.3),
      });

      const line = getLine(hi);
      if (line.geometry) line.geometry.dispose();
      if (line.material instanceof THREE.Material) line.material.dispose();
      line.geometry = lineGeo;
      line.material = lineMat;
      line.renderOrder = -1;

      group.add(line);

      // Hull label at center
      const label = getLabel(hi);
      label.text = hull.key;
      label.color = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.5)`;
      label.position.set(hull.center.x, hull.center.y + 20, hull.center.z);

      group.add(label);
    }
  }

  function dispose(): void {
    for (const mesh of meshPool) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    }
    for (const line of linePool) {
      if (line.geometry) line.geometry.dispose();
      if (line.material instanceof THREE.Material) line.material.dispose();
    }
    meshPool.length = 0;
    labelPool.length = 0;
    linePool.length = 0;
    group.clear();
  }

  return { group, update, dispose };
}

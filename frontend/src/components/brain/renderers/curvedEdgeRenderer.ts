/**
 * curvedEdgeRenderer — Quadratic bezier curved edges with relationship labels.
 *
 * Replaces straight-line edges with curved tubes when in focus mode.
 * Colors edges by relationship type:
 *   - alliance/supports/ally → green
 *   - conflict/opposes/adversary → red
 *   - economic/trade → gold
 *   - diplomatic → purple
 *   - default → blue-gray
 *
 * In non-focus mode, edges remain as default ForceGraph3D lines (faster).
 */

import * as THREE from 'three';
import SpriteText from 'three-spritetext';

// ─── Edge color by relationship type ─────────────────────────────────────────

const EDGE_TYPE_COLORS: Record<string, string> = {
  // Alliance / support
  supports: '#44cc66',
  ally: '#44cc66',
  alliance: '#44cc66',
  allied_with: '#44cc66',
  partner: '#44cc66',
  cooperates: '#44cc66',

  // Conflict / opposition
  opposes: '#ff4444',
  adversary: '#ff4444',
  conflict: '#ff4444',
  threatens: '#ff4444',
  competes_with: '#ff4444',
  contradicts: '#ff6666',

  // Economic
  economic: '#ffc107',
  trade: '#ffc107',
  sanctions: '#ff9800',
  invests_in: '#ffc107',

  // Diplomatic
  diplomatic: '#9c27b0',
  negotiates: '#9c27b0',
  treaty: '#9c27b0',

  // Military
  military: '#f44336',
  deploys: '#ef5350',
  commands: '#e53935',

  // Information
  information: '#2196f3',
  informs: '#2196f3',
  references: '#64b5f6',
  related: '#546e7a',
};

const DEFAULT_EDGE_COLOR = '#546e7a';

export function getEdgeColor(edgeType: string): string {
  return EDGE_TYPE_COLORS[edgeType.toLowerCase()] ?? DEFAULT_EDGE_COLOR;
}

// ─── Curved edge geometry ────────────────────────────────────────────────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Create a curved tube between two points using a quadratic bezier.
 * The control point is offset perpendicular to the line between source and target.
 */
export function createCurvedEdge(
  source: Vec3,
  target: Vec3,
  edgeType: string,
  showLabel: boolean,
): THREE.Group {
  const group = new THREE.Group();

  // Compute midpoint and offset for bezier control point
  const mid = new THREE.Vector3(
    (source.x + target.x) / 2,
    (source.y + target.y) / 2,
    (source.z + target.z) / 2,
  );

  // Direction vector from source to target
  const dir = new THREE.Vector3(
    target.x - source.x,
    target.y - source.y,
    target.z - source.z,
  );

  // Perpendicular offset (cross with up vector or fallback)
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
  if (perp.length() < 0.01) {
    perp.set(1, 0, 0);
  }

  // Scale offset by edge length
  const edgeLength = dir.length();
  const offset = Math.min(edgeLength * 0.2, 30);
  const controlPoint = mid.clone().add(perp.multiplyScalar(offset));

  // Create bezier curve
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(source.x, source.y, source.z),
    controlPoint,
    new THREE.Vector3(target.x, target.y, target.z),
  );

  // Create tube geometry along curve
  const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.3, 6, false);
  const color = getEdgeColor(edgeType);
  const tubeMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });

  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tube);

  // Add label at midpoint if requested
  if (showLabel && edgeType && edgeType !== 'related') {
    const labelSprite = new SpriteText(edgeType);
    labelSprite.color = color;
    labelSprite.textHeight = 2;
    labelSprite.backgroundColor = 'rgba(0,0,0,0.6)';
    labelSprite.padding = 0.8;
    labelSprite.borderRadius = 0.5;

    // Position label at the bezier midpoint (t=0.5)
    const labelPos = curve.getPoint(0.5);
    labelSprite.position.copy(labelPos);
    // Offset slightly above the curve
    labelSprite.position.y += 3;

    group.add(labelSprite);
  }

  return group;
}

/**
 * Update an existing curved edge group's position.
 * Re-generates the geometry — call sparingly (only in focus mode, limited edges).
 */
export function updateCurvedEdge(
  group: THREE.Group,
  source: Vec3,
  target: Vec3,
  edgeType: string,
  showLabel: boolean,
): void {
  // Dispose old children
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (mat instanceof THREE.Material) mat.dispose();
    }
  }

  // Re-create
  const newGroup = createCurvedEdge(source, target, edgeType, showLabel);
  for (const child of newGroup.children) {
    group.add(child);
  }
  // Clear newGroup without disposing (children are now in group)
  newGroup.children.length = 0;
}

// ─── Cleanup utility ─────────────────────────────────────────────────────────

export function disposeCurvedEdgeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (mat instanceof THREE.Material) mat.dispose();
    }
  });
  group.clear();
}

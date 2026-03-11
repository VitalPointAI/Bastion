// Brain Visualization Type System
// Foundational types and constants for the adaptive brain visualization.
// ALL subsequent brain plans depend on these definitions.

// ─── Core Enumerations ───────────────────────────────────────────────────────

export type BrainNodeType = 'entity' | 'objective' | 'document' | 'concept';

export type ActorCategory = 'ally' | 'adversary' | 'neutral' | 'partner';

export type ClusterMode = 'container' | 'dime' | 'organic';

// ─── Annotation ──────────────────────────────────────────────────────────────

export interface BrainAnnotation {
  /** Unique annotation identifier */
  id: string;
  /** Node this annotation is attached to */
  nodeId: string;
  /** Type of node being annotated */
  nodeType: BrainNodeType;
  /** Classification of the annotation */
  annotationType: 'flag' | 'note' | 'questionable';
  /** Optional free-text content */
  content?: string;
  /** Account ID of the creator */
  createdBy: string;
  /** If true, visible to all members of the problem set */
  isShared: boolean;
  /** ISO timestamp */
  createdAt: string;
}

// ─── Particle (ingestion animation) ─────────────────────────────────────────

export interface Particle {
  /** Unique particle identifier */
  id: string;
  /** Current canvas X position */
  x: number;
  /** Current canvas Y position */
  y: number;
  /** ID of the brain node this particle is travelling toward */
  targetNodeId: string;
  /** CSS color string (matches source type) */
  color: string;
  /** Opacity 0-1 */
  alpha: number;
  /** performance.now() timestamp at birth — used for lifetime calculation */
  born: number;
}

// ─── Brain Node ───────────────────────────────────────────────────────────────

export interface BrainNode {
  /** Unique node identifier */
  id: string;
  /** Display label */
  label: string;
  /** Visual shape category */
  type: BrainNodeType;

  // ── Actor/cluster fields ──────────────────────────────────────────────────
  /** Actor alignment — determines color palette */
  actorCategory?: ActorCategory;
  /** ID of the container this node belongs to (container clustering mode) */
  containerId?: string;
  /** Human-readable label for the container group */
  containerLabel?: string;
  /** DIME/MIDLIFE theme category (diplomatic, information, military, economic, …) */
  dimeCategory?: string;

  // ── Epistemic state fields ────────────────────────────────────────────────
  /** 0-1 confidence level — drives glow intensity and brightness */
  confidence: number;
  /** When true, renders as hollow/dashed node — represents an intelligence gap */
  isGap?: boolean;
  /** When true, renders as ghosted/translucent — node exists in the future prediction zone */
  isFuturePrediction?: boolean;
  /** 0-1 confidence in the future prediction — drives ghost glow intensity */
  predictionConfidence?: number;

  // ── Temporal fields ───────────────────────────────────────────────────────
  /** ISO timestamp of node creation — used for timeline scrubbing and recency fading */
  createdAt: string;

  // ── Provenance fields ─────────────────────────────────────────────────────
  /** Source document IDs that contributed to this node */
  sourceDocumentIds?: string[];
  /** Validity score from source quality assessment (0-1) */
  validityScore?: number;

  // ── Layout/rendering hints ────────────────────────────────────────────────
  /**
   * Normalized centrality score (0-1) used to prioritise which labels
   * to render at low zoom levels (semantic zoom).
   */
  centrality?: number;
  /** User annotations attached to this node */
  annotations?: BrainAnnotation[];

  // ── Force-graph positioning (set/mutated by layout engine) ───────────────
  x?: number;
  y?: number;

  // ── Search / filter UI state (ephemeral — not persisted) ─────────────────
  /** When true, node is dimmed because it doesn't match the current search query */
  isSearchDimmed?: boolean;
}

// ─── Brain Edge ───────────────────────────────────────────────────────────────

export interface BrainEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship type label (e.g. 'supports', 'opposes', 'references') */
  type: string;
  /** 0-1 relationship strength — drives edge thickness */
  strength?: number;
  /** When true, this edge represents conflicting intelligence — rendered distinctly */
  isConflict?: boolean;
  /** ISO timestamp — used for recency-based edge fading */
  createdAt?: string;
}

// ─── Graph Data ───────────────────────────────────────────────────────────────

export interface BrainGraphData {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Canvas background color — deep navy matching COP/dark-mode style */
export const BRAIN_BG_COLOR = '#020810';

/**
 * Color keyed by actor category.
 * - ally:      blue  (#4a9eff)
 * - adversary: red   (#ff4444)
 * - neutral:   gray  (#888888)
 * - partner:   green (#44cc66)
 */
export const CATEGORY_COLORS: Record<ActorCategory, string> = {
  ally: '#4a9eff',
  adversary: '#ff4444',
  neutral: '#888888',
  partner: '#44cc66',
};

/**
 * Shape identifier keyed by node type.
 * Used by the canvas renderer to dispatch to the correct draw routine.
 * - entity:    circle
 * - objective: diamond
 * - document:  square
 * - concept:   hexagon
 */
export const NODE_TYPE_SHAPES: Record<BrainNodeType, string> = {
  entity: 'circle',
  objective: 'diamond',
  document: 'square',
  concept: 'hexagon',
};

/**
 * Zoom level at which node labels become visible.
 * Below this threshold, only major/high-centrality nodes show labels.
 */
export const ZOOM_LABEL_THRESHOLD = 1.5;

/**
 * Zoom level at which secondary (low-centrality) nodes become visible.
 * Below this threshold, only high-centrality nodes are rendered.
 */
export const ZOOM_SECONDARY_THRESHOLD = 0.8;

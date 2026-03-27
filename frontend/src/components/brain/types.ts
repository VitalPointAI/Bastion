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
  /** 0-1 confidence level — drives glow intensity and brightness (internal use) */
  confidence: number;
  /** NATO STANAG 2022 source reliability rating: A-F */
  natoSourceReliability?: string | null;
  /** NATO STANAG 2022 information credibility rating: 1-6 */
  natoInformationCredibility?: number | null;
  /** When true, renders as hollow/dashed node — represents an intelligence gap */
  isGap?: boolean;
  /** When true, renders as ghosted/translucent — node exists in the future prediction zone */
  isFuturePrediction?: boolean;
  /** 0-1 confidence in the future prediction — drives ghost glow intensity */
  predictionConfidence?: number;

  // ── Temporal fields ───────────────────────────────────────────────────────
  /** ISO timestamp of node creation — used for timeline scrubbing and recency fading */
  createdAt: string;
  /** ISO datetime when this assertion became valid (JSON-LD temporal validity) */
  validFrom?: string;
  /** ISO datetime when this assertion expired. null = currently valid */
  validTo?: string | null;

  // ── Provenance fields ─────────────────────────────────────────────────────
  /** Source document IDs that contributed to this node */
  sourceDocumentIds?: string[];
  /** Validity score from source quality assessment (0-1) */
  validityScore?: number;
  /** Source method that generated this assertion (manual_entry, doc_intelligence, osint, etc.) */
  assertedVia?: string;
  /** DID of the agent or user that asserted this node */
  assertedBy?: string;
  /** True if this node has unresolved :CONTRADICTS edges in the graph */
  isContradicted?: boolean;
  /** Computed confidence tier for visual styling (high/medium/low) */
  confidenceTier?: 'high' | 'medium' | 'low';
  /** CCO/BFO class URI (e.g. 'cco:MilitaryOrganization') */
  jsonldType?: string;
  /** Half-life in days for client-side confidence decay display */
  halfLifeDays?: number;

  // ── Content / description ──────────────────────────────────────────────
  /** Description or summary of what this node represents */
  description?: string;
  /** Alternative names (for actors) */
  aliases?: string[];
  /** Role this actor plays in the context */
  role?: string;

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
  /** When true, this edge is an active :CONTRADICTS relationship (aligns with isConflict semantics) */
  isContradiction?: boolean;
  /** Edge-level confidence (0-1) */
  confidence?: number;
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

// ─── Phase 45: Drill-Down & Subspace Types ──────────────────────────────────

/** The four hierarchical drill-down levels */
export type DrillLevel = 'full' | 'subspace' | 'node' | 'document';

/** One entry in the breadcrumb navigation trail */
export interface BreadcrumbEntry {
  /** Which drill level this crumb represents */
  level: DrillLevel;
  /** ID of the entity at this level (subspaceId, nodeId, or 'root') */
  id: string;
  /** Display label for the breadcrumb */
  label: string;
  /** Count of nodes visible at this level */
  count: number;
  /** Icon identifier for the breadcrumb (emoji string) */
  icon: string;
}

/** Subspace definition — container-automatic or user-created */
export interface BrainSubspace {
  id: string;
  problemSetId: string;
  name: string;
  /** 'container' = auto from containerId, 'manual' = lasso-selected, 'smart' = query-based */
  subspaceType: 'container' | 'manual' | 'smart';
  /** Node IDs for manual subspaces */
  nodeIds?: string[];
  /** Query definition for smart subspaces */
  queryDefinition?: SmartSubspaceQuery;
  createdBy: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Query shape for smart subspaces */
export interface SmartSubspaceQuery {
  nodeTypes?: BrainNodeType[];
  actorCategories?: ActorCategory[];
  containerId?: string;
  dimeCategories?: string[];
  namePattern?: string;
}

/** A ghost stub node representing a cross-boundary connection */
export interface GhostStubNode extends BrainNode {
  /** Always true — identifies this as a ghost stub */
  isGhostStub: true;
  /** The subspace this ghost belongs to (external reference) */
  ghostSourceSubspace?: string;
}

/** A ghost edge connecting a subspace node to an external stub */
export interface GhostEdge extends BrainEdge {
  /** Always true — identifies this as a ghost link */
  isGhostLink: true;
}

/** Virtual lens — named configuration of filters, clustering, and visibility */
export interface BrainLens {
  id: string;
  name: string;
  /** true for the 4 built-in lenses (J2, J3, J5, Overview) */
  isBuiltIn: boolean;
  /** Which clustering mode this lens applies */
  clusterMode: ClusterMode;
  /** Which node types to show (empty = all) */
  nodeTypeFilters: BrainNodeType[];
  /** Which actor categories to show (empty = all) */
  actorCategoryFilters: ActorCategory[];
  /** Which DIME themes to show (empty = all) */
  dimeCategoryFilters: string[];
  /** Whether intelligence gap nodes are visible */
  showGapNodes: boolean;
  /** Whether to render confidence overlay */
  showConfidenceOverlay: boolean;
  /** Creator account ID */
  createdBy: string;
  /** Visible to all problem set members */
  isShared: boolean;
  /** Problem set scope */
  problemSetId: string;
  /** If cloned from another lens, that lens's ID */
  clonedFrom?: string;
}

/** IDs for the four built-in lenses */
export const BUILTIN_LENS_IDS = {
  OVERVIEW: 'builtin:overview',
  J2_INTEL: 'builtin:j2',
  J3_OPS: 'builtin:j3',
  J5_PLANS: 'builtin:j5',
} as const;

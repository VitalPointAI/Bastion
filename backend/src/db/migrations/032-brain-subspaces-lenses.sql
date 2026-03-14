-- Brain subspaces table
-- Stores named subsets of graph nodes (manual lasso-selection or smart query-based)
CREATE TABLE IF NOT EXISTS brain_subspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subspace_type TEXT NOT NULL CHECK (subspace_type IN ('manual', 'smart')),
  node_ids TEXT[] DEFAULT '{}',
  query_definition JSONB,
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_subspaces_ps ON brain_subspaces(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_brain_subspaces_user ON brain_subspaces(created_by);

-- Brain lenses table
-- Stores virtual lens configurations: named sets of filters, clustering mode, and visibility toggles
CREATE TABLE IF NOT EXISTS brain_lenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_built_in BOOLEAN DEFAULT false,
  cluster_mode TEXT NOT NULL DEFAULT 'container',
  node_type_filters TEXT[] DEFAULT '{}',
  actor_category_filters TEXT[] DEFAULT '{}',
  dime_category_filters TEXT[] DEFAULT '{}',
  show_gap_nodes BOOLEAN DEFAULT true,
  show_confidence_overlay BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  cloned_from UUID REFERENCES brain_lenses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_lenses_ps ON brain_lenses(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_brain_lenses_user ON brain_lenses(created_by);

-- Brain annotations table
-- Stores user annotations on graph nodes (flags, notes, questionable markers)
CREATE TABLE IF NOT EXISTS brain_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('entity', 'objective', 'document', 'concept')),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('flag', 'note', 'questionable')),
  content TEXT,
  created_by TEXT NOT NULL,
  problem_set_id TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_annotations_node ON brain_annotations(node_id, node_type);
CREATE INDEX IF NOT EXISTS idx_brain_annotations_ps ON brain_annotations(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_brain_annotations_user ON brain_annotations(created_by);

-- Brain AI context snapshots table
-- Stores AI context snapshots at a point in time for a problem set
CREATE TABLE IF NOT EXISTS brain_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  time_scale TIMESTAMPTZ,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_snapshots_ps ON brain_snapshots(problem_set_id);

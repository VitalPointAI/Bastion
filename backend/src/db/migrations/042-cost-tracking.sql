-- Migration 042: Cost tracking — ledger + model pricing
-- Tracks all expenditures (LLM token usage, NEAR gas/storage) with attribution.

-- Model pricing reference table
CREATE TABLE IF NOT EXISTS model_pricing (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  input_price_per_million NUMERIC(10, 4) NOT NULL,
  output_price_per_million NUMERIC(10, 4) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Seed current Anthropic pricing (USD per million tokens)
INSERT INTO model_pricing (model_id, provider, display_name, input_price_per_million, output_price_per_million, notes) VALUES
  ('claude-opus-4-6',    'anthropic', 'Claude Opus 4.6',    15.0,  75.0,  'Most capable'),
  ('claude-sonnet-4-6',  'anthropic', 'Claude Sonnet 4.6',   3.0,  15.0,  'Balanced'),
  ('claude-haiku-4-5-20251001', 'anthropic', 'Claude Haiku 4.5', 0.8, 4.0, 'Fast/cheap'),
  ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 3.0, 15.0, 'Legacy')
ON CONFLICT (model_id) DO NOTHING;

-- Cost ledger — every chargeable event
CREATE TABLE IF NOT EXISTS cost_ledger (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('llm', 'near_gas', 'near_storage')),
  -- Attribution
  actor_did TEXT,
  agent_id TEXT,
  problem_set_id TEXT,
  -- LLM fields
  model_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  -- NEAR fields
  near_gas_burned NUMERIC(30, 0),
  near_deposit NUMERIC(30, 0),
  -- Computed cost in USD
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  -- Context
  operation TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cost_ledger_created ON cost_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_type ON cost_ledger(cost_type);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_actor ON cost_ledger(actor_did);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_agent ON cost_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_ps ON cost_ledger(problem_set_id);

-- Daily cost summary materialized as a regular table (refreshed by queries)
CREATE TABLE IF NOT EXISTS cost_daily_summary (
  date DATE NOT NULL,
  cost_type TEXT NOT NULL,
  agent_id TEXT NOT NULL DEFAULT '__all__',
  total_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  entry_count INTEGER DEFAULT 0,
  PRIMARY KEY (date, cost_type, agent_id)
);
